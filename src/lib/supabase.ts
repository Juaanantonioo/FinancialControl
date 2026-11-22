/**
 * Cliente de Supabase (T-008).
 *
 * La dirección del proyecto y la clave pública se leen del fichero `.env`,
 * que git ignora. Expo solo incluye en la app las variables cuyo nombre
 * empieza por EXPO_PUBLIC_. Aquí va únicamente la clave pública ("anon" o
 * "publishable"): la clave de servicio nunca debe entrar en la app, porque
 * cualquiera que descargue la app puede leer lo que lleva dentro.
 *
 * Desde el bloque 4b-1 hay cuentas de usuario. La sesión se guarda solo en el
 * llavero del sistema (`almacenSeguro`), nunca en SQLite ni en las
 * preferencias. No se renueva sola en segundo plano: se renueva cuando hace
 * falta, al hacer una petición.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { SESION_EN_EL_ALMACEN } from './almacenSeguro';
import { almacenSeguro } from './almacenSeguroNativo';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const clavePublica = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Tabla con la que Diagnóstico comprueba la conexión y que el esquema está aplicado. */
export const TABLA_DE_PRUEBA = 'claves_de_usuario';

let cliente: SupabaseClient | null = null;

export function supabaseConfigurado(): boolean {
  return Boolean(url && clavePublica);
}

export function obtenerSupabase(): SupabaseClient | null {
  if (!url || !clavePublica) return null;
  if (!cliente) {
    cliente = createClient(url, clavePublica, {
      auth: {
        persistSession: true,
        storageKey: SESION_EN_EL_ALMACEN,
        storage: {
          getItem: (clave) => almacenSeguro.leer(clave),
          setItem: (clave, valor) => almacenSeguro.guardar(clave, valor),
          removeItem: (clave) => almacenSeguro.borrar(clave),
        },
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return cliente;
}

export type ResultadoPrueba =
  | { estado: 'sin_configurar' }
  /** Hay sesión y se han leído las filas propias. */
  | { estado: 'correcto'; filas: number }
  /** El servidor responde y el esquema está aplicado. Sin sesión no deja leer nada: es lo esperado. */
  | { estado: 'conectado' }
  /** El servidor responde, pero no tiene las tablas: faltan las migraciones. */
  | { estado: 'sin_esquema' }
  | { estado: 'sin_conexion' }
  | { estado: 'error' };

/** Tiempo máximo de la prueba de conexión. */
const ESPERA_DE_LA_PRUEBA_MS = 10_000;

/**
 * Comprueba la conexión leyendo la tabla de claves de la cuenta. No devuelve
 * el mensaje interno del servidor: solo qué ha pasado, para que la pantalla
 * lo explique con sus textos.
 */
export async function probarConexion(): Promise<ResultadoPrueba> {
  const supabase = obtenerSupabase();
  if (!supabase) return { estado: 'sin_configurar' };
  let reloj: ReturnType<typeof setTimeout> | undefined;
  try {
    const { data, error } = await Promise.race([
      supabase.from(TABLA_DE_PRUEBA).select('user_id').limit(5),
      new Promise<never>((_, rechazar) => {
        reloj = setTimeout(() => rechazar(new Error('sin respuesta')), ESPERA_DE_LA_PRUEBA_MS);
      }),
    ]);
    if (!error) return { estado: 'correcto', filas: data?.length ?? 0 };
    // Permiso denegado: es lo que RLS responde a quien no tiene sesión.
    if (error.code === '42501') return { estado: 'conectado' };
    if (error.code === 'PGRST205' || error.code === '42P01') return { estado: 'sin_esquema' };
    if (!error.code) return { estado: 'sin_conexion' };
    return { estado: 'error' };
  } catch {
    return { estado: 'sin_conexion' };
  } finally {
    clearTimeout(reloj);
  }
}
