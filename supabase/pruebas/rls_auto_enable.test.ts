/**
 * La migración que retira EXECUTE sobre public.rls_auto_enable() (D-n).
 *
 * Esa función solo existe en el proyecto remoto: la crea Supabase al activar
 * «RLS en tablas nuevas». Aquí se reproduce en la instancia local con la
 * definición que Supabase publica en su documentación (guía «Event Triggers»,
 * consultada el 22/11/2026), se aplica la migración y se comprueba lo único
 * que importa: que una tabla nueva de `public` sigue quedando con RLS.
 *
 * Es la única prueba que cambia el esquema de la instancia local. Lo hace como
 * administrador, con sentencias sueltas, y deshace todo al terminar.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { consultar } from './apoyo';

/** Ejecuta una sentencia en la base LOCAL, como administrador. */
function administrar(sql: string): void {
  execFileSync('npx', ['supabase', 'db', 'query', sql], { stdio: ['ignore', 'pipe', 'pipe'] });
}

const MIGRACION = readFileSync(
  join(__dirname, '..', 'migrations', '20261122120000_retirar_execute_de_rls_auto_enable.sql'),
  'utf8',
);
/** La única sentencia de la migración: el bloque DO. */
const BLOQUE = /do \$\$[\s\S]*\$\$;/.exec(MIGRACION)?.[0] ?? '';

const FUNCION = `
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS EVENT_TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
          RAISE;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$`;

const DISPARADOR = `
CREATE EVENT TRIGGER ensure_rls
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
EXECUTE FUNCTION public.rls_auto_enable()`;

type Permisos = { anon: boolean; authenticated: boolean; publico: boolean };
const PERMISOS = `
  select has_function_privilege('anon', 'public.rls_auto_enable()', 'execute') as anon,
         has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute') as authenticated,
         exists (
           select 1 from pg_proc p, aclexplode(p.proacl) a
            where p.oid = 'public.rls_auto_enable()'::regprocedure
              and a.grantee = 0 and a.privilege_type = 'EXECUTE'
         ) as publico`;

const conRls = (tabla: string) =>
  consultar<{ relrowsecurity: boolean }>(
    `select relrowsecurity from pg_class where oid = 'public.${tabla}'::regclass`,
  )[0]?.relrowsecurity;

function limpiar(): void {
  for (const tabla of [
    'zz_prueba_rls_antes',
    'zz_prueba_rls_despues',
    'zz_prueba_rls_sin',
    'zz_prueba_rls_otro_rol',
  ]) {
    administrar(`drop table if exists public.${tabla}`);
  }
  administrar(
    `do $$ begin
       if exists (select 1 from pg_roles where rolname = 'zz_prueba_sin_permiso') then
         revoke all on schema public from zz_prueba_sin_permiso;
         drop role zz_prueba_sin_permiso;
       end if;
     end $$`,
  );
  administrar('drop event trigger if exists ensure_rls');
  administrar('drop function if exists public.rls_auto_enable()');
}

describe('migración: retirar EXECUTE de rls_auto_enable()', () => {
  beforeAll(limpiar);
  afterAll(limpiar);

  it('la migración es un único bloque que solo retira ese permiso', () => {
    const sinComentarios = MIGRACION.replace(/^--.*$/gm, '').trim();
    expect(sinComentarios).toBe(BLOQUE);
    expect(BLOQUE).toContain("to_regprocedure('public.rls_auto_enable()') is not null");
    const sentencias = BLOQUE.match(/\b(revoke|grant|alter|drop|create|delete|update|insert)\b/gi);
    expect(sentencias).toEqual(['revoke']);
    expect(BLOQUE).not.toContain('borrar_mi_cuenta');
  });

  it('no falla si la función no existe, como en la instancia local', () => {
    expect(
      consultar<{ existe: boolean }>(
        "select to_regprocedure('public.rls_auto_enable()') is not null as existe",
      )[0].existe,
    ).toBe(false);
    expect(() => administrar(BLOQUE)).not.toThrow();
  });

  it('sin la función, una tabla nueva de public NO queda con RLS: la prueba distingue', () => {
    administrar('create table public.zz_prueba_rls_sin (id int)');
    expect(conRls('zz_prueba_rls_sin')).toBe(false);
  });

  it('retira el permiso a public, anon y authenticated, y las tablas nuevas siguen quedando con RLS', () => {
    // Estado del proyecto remoto: la función, su disparador y los permisos por defecto de `public`.
    administrar(FUNCION);
    administrar(DISPARADOR);
    const antes = consultar<Permisos>(PERMISOS)[0];
    // Lo que avisa el asesor: anon y authenticated pueden ejecutarla.
    expect(antes.anon).toBe(true);
    expect(antes.authenticated).toBe(true);
    administrar('create table public.zz_prueba_rls_antes (id int)');
    expect(conRls('zz_prueba_rls_antes')).toBe(true);

    administrar(BLOQUE);

    expect(consultar<Permisos>(PERMISOS)[0]).toEqual({
      anon: false,
      authenticated: false,
      publico: false,
    });
    administrar('create table public.zz_prueba_rls_despues (id int)');
    expect(conRls('zz_prueba_rls_despues')).toBe(true);
    // Aplicarla dos veces no cambia nada.
    expect(() => administrar(BLOQUE)).not.toThrow();
  });

  it('también cuando crea la tabla un rol que no puede ejecutar la función', () => {
    // El disparador de eventos lanza la función sin mirar el permiso de quien crea la tabla.
    administrar('create role zz_prueba_sin_permiso nologin');
    administrar('grant usage, create on schema public to zz_prueba_sin_permiso');
    administrar('grant zz_prueba_sin_permiso to current_user');
    expect(
      consultar<{ puede: boolean }>(
        "select has_function_privilege('zz_prueba_sin_permiso', 'public.rls_auto_enable()', 'execute') as puede",
      )[0].puede,
    ).toBe(false);
    administrar(
      `do $$ begin
         set local role zz_prueba_sin_permiso;
         create table public.zz_prueba_rls_otro_rol (id int);
         reset role;
       end $$`,
    );
    const [tabla] = consultar<{ propietario: string; relrowsecurity: boolean }>(
      `select pg_get_userbyid(relowner) as propietario, relrowsecurity from pg_class
        where oid = 'public.zz_prueba_rls_otro_rol'::regclass`,
    );
    expect(tabla).toEqual({ propietario: 'zz_prueba_sin_permiso', relrowsecurity: true });
  });

  it('no cambia nada más: borrar_mi_cuenta() y las dos tablas siguen igual', () => {
    const permisos = consultar<{ anon: boolean; authenticated: boolean }>(
      `select has_function_privilege('anon', 'public.borrar_mi_cuenta()', 'execute') as anon,
              has_function_privilege('authenticated', 'public.borrar_mi_cuenta()', 'execute') as authenticated`,
    )[0];
    expect(permisos).toEqual({ anon: false, authenticated: true });
    const tablas = consultar<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `select relname, relrowsecurity, relforcerowsecurity from pg_class
        where oid in ('public.fila_cifrada'::regclass, 'public.claves_de_usuario'::regclass)
        order by relname`,
    );
    expect(tablas).toEqual([
      { relname: 'claves_de_usuario', relrowsecurity: true, relforcerowsecurity: true },
      { relname: 'fila_cifrada', relrowsecurity: true, relforcerowsecurity: true },
    ]);
    const politicas = consultar<{ total: number }>(
      "select count(*)::int as total from pg_policies where schemaname = 'public'",
    )[0].total;
    expect(politicas).toBe(8);
  });
});
