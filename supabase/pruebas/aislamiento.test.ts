/**
 * Aislamiento entre usuarios en el esquema remoto (B4b-1), contra la
 * instancia local de Supabase. Dos usuarios, A y B, y un cliente sin sesión.
 * Todo se hace con la clave pública, como la app.
 */
import { randomUUID } from 'node:crypto';

import {
  clavesDeEjemplo,
  clienteAnonimo,
  consultar,
  crearUsuario,
  filaDeEjemplo,
  sobreDeMentira,
  type Usuario,
} from './apoyo';

const TABLAS = ['claves_de_usuario', 'fila_cifrada'] as const;
/** Valores con los que se intenta modificar una fila en cada tabla. */
const CAMBIO = {
  claves_de_usuario: { clave_por_contrasena: sobreDeMentira(100) },
  fila_cifrada: { contenido: sobreDeMentira(130) },
} as const;

let a: Usuario;
let b: Usuario;
let idDeFilaDeA: string;
let idDeFilaDeB: string;

const fila = (id: string) => filaDeEjemplo(id);
const nuevaFila = (tabla: (typeof TABLAS)[number], userId?: string): Record<string, unknown> => ({
  ...(tabla === 'claves_de_usuario' ? clavesDeEjemplo() : filaDeEjemplo()),
  ...(userId ? { user_id: userId } : {}),
});

beforeAll(async () => {
  a = await crearUsuario('a');
  b = await crearUsuario('b');
  idDeFilaDeA = randomUUID();
  idDeFilaDeB = randomUUID();
  for (const [usuario, id] of [
    [a, idDeFilaDeA],
    [b, idDeFilaDeB],
  ] as const) {
    expect(
      (await usuario.cliente.from('claves_de_usuario').insert(clavesDeEjemplo())).error,
    ).toBeNull();
    expect((await usuario.cliente.from('fila_cifrada').insert(fila(id))).error).toBeNull();
  }
});

describe('cada usuario ve y toca solo lo suyo', () => {
  it.each(TABLAS)('%s: user_id se rellena solo con el de la sesión', async (tabla) => {
    for (const usuario of [a, b]) {
      const { data, error } = await usuario.cliente.from(tabla).select('user_id');
      expect(error).toBeNull();
      expect(data).toEqual([{ user_id: usuario.id }]);
    }
  });

  it.each(TABLAS)('%s: A no puede leer filas de B', async (tabla) => {
    const todas = await a.cliente.from(tabla).select('*');
    expect(todas.data?.every((f) => f.user_id === a.id)).toBe(true);
    const deB = await a.cliente.from(tabla).select('*').eq('user_id', b.id);
    expect(deB.error).toBeNull();
    expect(deB.data).toEqual([]);
  });

  it.each(TABLAS)('%s: A no puede insertar con el user_id de B', async (tabla) => {
    const { data, error } = await a.cliente.from(tabla).insert(nuevaFila(tabla, b.id)).select();
    expect(data).toBeNull();
    expect(error?.code).toBe('42501');
    // Tampoco con el de alguien que no existe.
    const ajeno = await a.cliente.from(tabla).insert(nuevaFila(tabla, randomUUID())).select();
    expect(ajeno.error?.code).toBe('42501');
  });

  it.each(TABLAS)('%s: A no puede modificar filas de B', async (tabla) => {
    const antes = await b.cliente.from(tabla).select('*');
    const { data, error } = await a.cliente
      .from(tabla)
      .update(CAMBIO[tabla])
      .eq('user_id', b.id)
      .select();
    // RLS no deja ver la fila: no hay error, pero no se modifica ninguna.
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await b.cliente.from(tabla).select('*')).data).toEqual(antes.data);
  });

  it.each(TABLAS)('%s: A no puede borrar filas de B', async (tabla) => {
    const { data, error } = await a.cliente.from(tabla).delete().eq('user_id', b.id).select();
    expect(error).toBeNull();
    expect(data).toEqual([]);
    // Ni borrando «todo»: solo alcanzaría a las suyas, y aquí no se tocan.
    expect((await b.cliente.from(tabla).select('user_id')).data).toEqual([{ user_id: b.id }]);
  });

  it.each(TABLAS)('%s: A no puede cambiar el user_id de una fila propia', async (tabla) => {
    const aB = await a.cliente.from(tabla).update({ user_id: b.id }).eq('user_id', a.id).select();
    expect(aB.data).toBeNull();
    expect(aB.error?.code).toBe('42501');
    const aOtro = await a.cliente
      .from(tabla)
      .update({ user_id: randomUUID() })
      .eq('user_id', a.id)
      .select();
    expect(aOtro.error?.code).toBe('42501');
    expect((await a.cliente.from(tabla).select('user_id')).data).toEqual([{ user_id: a.id }]);
    expect((await b.cliente.from(tabla).select('user_id')).data).toEqual([{ user_id: b.id }]);
  });

  it('fila_cifrada: A puede crear, cambiar y borrar las suyas', async () => {
    const id = randomUUID();
    expect((await a.cliente.from('fila_cifrada').insert(fila(id))).error).toBeNull();
    const cambio = await a.cliente
      .from('fila_cifrada')
      .update({ contenido: sobreDeMentira(140), borrada: true })
      .eq('id', id)
      .select();
    expect(cambio.data).toHaveLength(1);
    expect(cambio.data?.[0]).toMatchObject({ borrada: true, user_id: a.id });
    const borrado = await a.cliente.from('fila_cifrada').delete().eq('id', id).select();
    expect(borrado.data).toHaveLength(1);
  });

  it('fila_cifrada: el mismo id en dos usuarios son dos filas distintas', async () => {
    const id = randomUUID();
    expect((await a.cliente.from('fila_cifrada').insert(fila(id))).error).toBeNull();
    expect((await b.cliente.from('fila_cifrada').insert(fila(id))).error).toBeNull();
    const deA = await a.cliente.from('fila_cifrada').select('user_id').eq('id', id);
    expect(deA.data).toEqual([{ user_id: a.id }]);
    await a.cliente.from('fila_cifrada').delete().eq('id', id);
    expect((await b.cliente.from('fila_cifrada').select('user_id').eq('id', id)).data).toEqual([
      { user_id: b.id },
    ]);
    await b.cliente.from('fila_cifrada').delete().eq('id', id);
  });
});

describe('sin sesión no se puede nada', () => {
  const anonimo = clienteAnonimo();

  it.each(TABLAS)('%s: ni leer, ni insertar, ni modificar, ni borrar', async (tabla) => {
    const leer = await anonimo.from(tabla).select('*');
    expect(leer.data).toBeNull();
    expect(leer.error?.code).toBe('42501');
    const insertar = await anonimo.from(tabla).insert(nuevaFila(tabla, a.id));
    expect(insertar.error?.code).toBe('42501');
    const sinDueno = await anonimo.from(tabla).insert(nuevaFila(tabla));
    expect(sinDueno.error?.code).toBe('42501');
    const modificar = await anonimo.from(tabla).update(CAMBIO[tabla]).eq('user_id', a.id);
    expect(modificar.error?.code).toBe('42501');
    const borrar = await anonimo.from(tabla).delete().eq('user_id', a.id);
    expect(borrar.error?.code).toBe('42501');
    // Y lo de A sigue ahí.
    expect((await a.cliente.from(tabla).select('user_id')).data?.length).toBeGreaterThan(0);
  });

  it('la función de borrado no se puede llamar sin sesión', async () => {
    const { error } = await anonimo.rpc('borrar_mi_cuenta');
    expect(error?.code).toBe('42501');
  });

  it('la función de los disparadores no se puede llamar desde fuera', async () => {
    for (const cliente of [anonimo, a.cliente]) {
      const { error } = await cliente.rpc('poner_marcas_de_tiempo');
      expect(error).not.toBeNull();
    }
  });
});

describe('lo que el servidor rechaza', () => {
  it('un contenido mayor que el máximo', async () => {
    const justo = await a.cliente
      .from('fila_cifrada')
      .insert({ ...filaDeEjemplo(), contenido: sobreDeMentira(65536) })
      .select('id');
    expect(justo.error).toBeNull();
    await a.cliente.from('fila_cifrada').delete().eq('id', justo.data![0].id);
    const pasado = await a.cliente
      .from('fila_cifrada')
      .insert({ ...filaDeEjemplo(), contenido: sobreDeMentira(65537) });
    expect(pasado.error?.code).toBe('23514');
    // Tampoco al modificar una fila que ya existe.
    const alCambiar = await a.cliente
      .from('fila_cifrada')
      .update({ contenido: sobreDeMentira(70000) })
      .eq('id', idDeFilaDeA);
    expect(alCambiar.error?.code).toBe('23514');
  });

  it('un contenido que no tiene forma de sobre', async () => {
    for (const contenido of [
      '',
      'corto',
      `${sobreDeMentira(80)} con espacios`,
      `${sobreDeMentira(80)}==`,
    ]) {
      const { error } = await a.cliente
        .from('fila_cifrada')
        .insert({ ...filaDeEjemplo(), contenido });
      expect([contenido.slice(-12), error?.code]).toEqual([contenido.slice(-12), '23514']);
    }
  });

  it('una tabla fuera de la lista', async () => {
    for (const tabla of [
      'auth.users',
      'aviso_emitido',
      'Movimiento',
      '',
      'movimiento; drop table x',
    ]) {
      const { error } = await a.cliente.from('fila_cifrada').insert({ ...filaDeEjemplo(), tabla });
      expect([tabla, error?.code]).toEqual([tabla, '23514']);
    }
  });

  it('las doce tablas locales que se sincronizarán sí se admiten', async () => {
    const tablas = [
      'cuenta',
      'categoria',
      'movimiento',
      'valor_de_inversion',
      'objetivo',
      'aportacion_a_objetivo',
      'regla_recurrente',
      'presupuesto',
      'linea_de_presupuesto',
      'captura',
      'alias_de_tarjeta',
      'regla_de_comercio',
    ];
    const id = randomUUID();
    const { error } = await a.cliente
      .from('fila_cifrada')
      .insert(tablas.map((tabla) => ({ ...filaDeEjemplo(id), tabla })));
    expect(error).toBeNull();
    const borradas = await a.cliente.from('fila_cifrada').delete().eq('id', id).select('tabla');
    expect(borradas.data).toHaveLength(12);
  });

  it('un id que no es un UUID y una versión de formato fuera de rango', async () => {
    const malId = await a.cliente
      .from('fila_cifrada')
      .insert({ ...filaDeEjemplo(), id: 'no-es-uuid' });
    expect(malId.error?.code).toBe('22P02');
    for (const version of [0, 256, -1]) {
      const { error } = await a.cliente
        .from('fila_cifrada')
        .insert({ ...filaDeEjemplo(), version_de_formato: version });
      expect([version, error?.code]).toEqual([version, '23514']);
    }
  });

  it('claves con forma inválida, y unas segundas claves para la misma cuenta', async () => {
    const corta = await a.cliente
      .from('claves_de_usuario')
      .update({ clave_por_contrasena: 'corta' })
      .eq('user_id', a.id);
    expect(corta.error?.code).toBe('23514');
    const larga = await a.cliente
      .from('claves_de_usuario')
      .update({ clave_por_recuperacion: sobreDeMentira(401) })
      .eq('user_id', a.id);
    expect(larga.error?.code).toBe('23514');
    const segunda = await a.cliente.from('claves_de_usuario').insert(clavesDeEjemplo());
    expect(segunda.error?.code).toBe('23505');
  });

  it('actualizada_en no la puede fijar el cliente, ni al crear ni al modificar', async () => {
    const FALSA = '2001-01-01T00:00:00+00:00';
    const id = randomUUID();
    const creada = await a.cliente
      .from('fila_cifrada')
      .insert({ ...fila(id), actualizada_en: FALSA })
      .select('actualizada_en')
      .single();
    expect(creada.error).toBeNull();
    const alCrear = new Date(creada.data!.actualizada_en).getTime();
    expect(Math.abs(alCrear - Date.now())).toBeLessThan(60_000);

    const cambiada = await a.cliente
      .from('fila_cifrada')
      .update({ contenido: sobreDeMentira(150), actualizada_en: FALSA })
      .eq('id', id)
      .select('actualizada_en')
      .single();
    const alCambiar = new Date(cambiada.data!.actualizada_en).getTime();
    expect(Math.abs(alCambiar - Date.now())).toBeLessThan(60_000);
    expect(alCambiar).toBeGreaterThanOrEqual(alCrear);
    await a.cliente.from('fila_cifrada').delete().eq('id', id);

    // En las claves, tampoco la fecha de creación.
    const claves = await a.cliente
      .from('claves_de_usuario')
      .update({ creado_en: FALSA, actualizada_en: FALSA })
      .eq('user_id', a.id)
      .select('creado_en, actualizada_en')
      .single();
    expect(new Date(claves.data!.creado_en).getFullYear()).toBeGreaterThan(2020);
    expect(new Date(claves.data!.actualizada_en).getFullYear()).toBeGreaterThan(2020);
  });
});

describe('catálogo: ninguna tabla pública sin RLS', () => {
  type Tabla = { tabla: string; rls: boolean; forzado: boolean; politicas: number };

  it('cada tabla del esquema público tiene RLS activado y forzado, y al menos una política', () => {
    const tablas = consultar<Tabla>(
      `select c.relname as tabla, c.relrowsecurity as rls, c.relforcerowsecurity as forzado,
              (select count(*)::int from pg_policy p where p.polrelid = c.oid) as politicas
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1`,
    );
    // Si mañana se añade una tabla sin RLS, aparece aquí y la suite falla.
    expect(tablas.map((t) => t.tabla)).toEqual(['claves_de_usuario', 'fila_cifrada']);
    expect(tablas.filter((t) => !t.rls || !t.forzado || t.politicas === 0)).toEqual([]);
  });

  it('no hay vistas ni tablas externas en el esquema público que se salten RLS', () => {
    const otras = consultar<{ nombre: string }>(
      `select c.relname as nombre from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('v', 'm', 'f')`,
    );
    expect(otras).toEqual([]);
  });

  it('ninguna política es para todos ni se cumple siempre', () => {
    const politicas = consultar<{
      tabla: string;
      roles: string[];
      usando: string | null;
      con: string | null;
    }>(
      `select tablename as tabla, roles::text[] as roles, qual as usando, with_check as con
       from pg_policies where schemaname = 'public'`,
    );
    expect(politicas).toHaveLength(8);
    for (const p of politicas) {
      expect(p.roles).toEqual(['authenticated']);
      for (const condicion of [p.usando, p.con].filter(Boolean)) {
        expect(condicion).toMatch(/auth\.uid\(\).*=.*user_id/);
        expect(condicion).not.toMatch(/^\s*\(?true\)?\s*$/i);
      }
    }
  });

  it('el rol anónimo no tiene ningún permiso sobre las tablas ni sobre las funciones', () => {
    const permisos = consultar<{ rol: string; tabla: string; permiso: string }>(
      `select grantee as rol, table_name as tabla, privilege_type as permiso
       from information_schema.role_table_grants
       where table_schema = 'public' and grantee in ('anon', 'PUBLIC', 'authenticated')`,
    );
    expect(permisos.filter((p) => p.rol !== 'authenticated')).toEqual([]);
    expect([...new Set(permisos.map((p) => p.permiso))].sort()).toEqual([
      'DELETE',
      'INSERT',
      'SELECT',
      'UPDATE',
    ]);
    const funciones = consultar<{ funcion: string; rol: string }>(
      `select routine_name as funcion, grantee as rol from information_schema.role_routine_grants
       where routine_schema = 'public' and grantee in ('anon', 'PUBLIC', 'authenticated')`,
    );
    expect(funciones).toEqual([{ funcion: 'borrar_mi_cuenta', rol: 'authenticated' }]);
  });

  it('la función con privilegios elevados tiene el search_path fijado y no admite parámetros', () => {
    const funciones = consultar<{
      nombre: string;
      definer: boolean;
      config: string[] | null;
      args: number;
    }>(
      `select p.proname as nombre, p.prosecdef as definer, p.proconfig as config, p.pronargs::int as args
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1`,
    );
    expect(funciones).toEqual([
      { nombre: 'borrar_mi_cuenta', definer: true, config: ['search_path=""'], args: 0 },
      { nombre: 'poner_marcas_de_tiempo', definer: false, config: ['search_path=""'], args: 0 },
    ]);
  });
});

describe('borrado de cuenta', () => {
  it('borra solo a quien la llama: B sigue intacto tras el borrado de A', async () => {
    const c = await crearUsuario('c');
    await c.cliente.from('claves_de_usuario').insert(clavesDeEjemplo());
    await c.cliente.from('fila_cifrada').insert([filaDeEjemplo(), filaDeEjemplo()]);
    const deBAntes = {
      claves: (await b.cliente.from('claves_de_usuario').select('*')).data,
      filas: (await b.cliente.from('fila_cifrada').select('*')).data,
    };
    const usuariosAntes = consultar<{ n: number }>('select count(*)::int as n from auth.users')[0]
      .n;

    const { error } = await c.cliente.rpc('borrar_mi_cuenta');
    expect(error).toBeNull();

    // De C no queda nada: ni usuario, ni claves, ni filas.
    const resto = consultar<{ usuarios: number; claves: number; filas: number }>(
      `select (select count(*)::int from auth.users where id = '${c.id}') as usuarios,
              (select count(*)::int from public.claves_de_usuario where user_id = '${c.id}') as claves,
              (select count(*)::int from public.fila_cifrada where user_id = '${c.id}') as filas`,
    )[0];
    expect(resto).toEqual({ usuarios: 0, claves: 0, filas: 0 });
    // Se ha borrado exactamente un usuario.
    expect(consultar<{ n: number }>('select count(*)::int as n from auth.users')[0].n).toBe(
      usuariosAntes - 1,
    );
    // B y A, intactos.
    expect((await b.cliente.from('claves_de_usuario').select('*')).data).toEqual(deBAntes.claves);
    expect((await b.cliente.from('fila_cifrada').select('*')).data).toEqual(deBAntes.filas);
    expect((await a.cliente.from('claves_de_usuario').select('user_id')).data).toEqual([
      { user_id: a.id },
    ]);
  });

  it('la función no acepta decir a quién borrar', async () => {
    for (const parametros of [{ user_id: b.id }, { id: b.id }, { yo: b.id }]) {
      const { error } = await a.cliente.rpc('borrar_mi_cuenta', parametros);
      expect(error).not.toBeNull();
    }
    expect((await b.cliente.from('claves_de_usuario').select('user_id')).data).toEqual([
      { user_id: b.id },
    ]);
  });

  it('con la sesión de una cuenta ya borrada no se puede volver a escribir', async () => {
    const d = await crearUsuario('d');
    expect((await d.cliente.rpc('borrar_mi_cuenta')).error).toBeNull();
    const { error } = await d.cliente.from('fila_cifrada').insert(filaDeEjemplo());
    expect(error).not.toBeNull();
    expect(
      consultar<{ n: number }>(
        `select count(*)::int as n from public.fila_cifrada where user_id = '${d.id}'`,
      )[0].n,
    ).toBe(0);
  });
});
