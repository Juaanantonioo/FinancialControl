/**
 * Apoyo de las pruebas contra la instancia local de Supabase. Solo se usa la
 * clave pública, como hace la app: nunca la de servicio.
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const URL_LOCAL = process.env.SUPABASE_LOCAL_URL ?? '';
export const CLAVE_PUBLICA = process.env.SUPABASE_LOCAL_CLAVE_PUBLICA ?? '';

if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL_LOCAL) || !CLAVE_PUBLICA) {
  throw new Error('Lanza estas pruebas con `npm run test:remoto`, contra la instancia local.');
}

export type Usuario = { cliente: SupabaseClient; id: string; correo: string };

/** Un cliente sin sesión, con la clave pública. */
export function clienteAnonimo(fetchPropio?: typeof fetch): SupabaseClient {
  return createClient(URL_LOCAL, CLAVE_PUBLICA, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(fetchPropio ? { global: { fetch: fetchPropio } } : {}),
  });
}

export function correoDePrueba(nombre: string): string {
  return `${nombre}-${randomUUID().slice(0, 8)}@prueba.example`;
}

/** Un sobre con forma válida y contenido aleatorio. No es un cifrado real: al servidor le da igual. */
export function sobreDeMentira(longitud = 98): string {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  return Array.from({ length: longitud }, (_, i) => alfabeto[(i * 7 + longitud) % 64]).join('');
}

/** Da de alta un usuario de prueba y devuelve su cliente con sesión. */
export async function crearUsuario(nombre: string): Promise<Usuario> {
  const cliente = clienteAnonimo();
  const correo = correoDePrueba(nombre);
  const { data, error } = await cliente.auth.signUp({
    email: correo,
    password: sobreDeMentira(43),
  });
  if (error || !data.user || !data.session) {
    throw new Error(`No se pudo crear el usuario de prueba: ${error?.message ?? 'sin sesión'}`);
  }
  return { cliente, id: data.user.id, correo };
}

/** Consulta SQL directa a la base local, como administrador. Solo para mirar, nunca para preparar datos. */
export function consultar<T>(sql: string): T[] {
  const salida = execFileSync('npx', ['supabase', 'db', 'query', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const json = salida.slice(salida.indexOf('{'), salida.lastIndexOf('}') + 1);
  return (JSON.parse(json || '{}').rows ?? []) as T[];
}

export const clavesDeEjemplo = () => ({
  clave_por_contrasena: sobreDeMentira(98),
  clave_por_recuperacion: sobreDeMentira(98),
  version_de_derivacion: 1,
  version_de_formato: 1,
});

export const filaDeEjemplo = (id: string = randomUUID()) => ({
  tabla: 'movimiento',
  id,
  contenido: sobreDeMentira(120),
  version_de_formato: 1,
});
