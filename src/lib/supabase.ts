/**
 * Cliente de Supabase (T-008).
 *
 * La dirección del proyecto y la clave pública se leen del fichero `.env`,
 * que git ignora. Expo solo incluye en la app las variables cuyo nombre
 * empieza por EXPO_PUBLIC_. Aquí va únicamente la clave pública ("anon" o
 * "publishable"): la clave de servicio nunca debe entrar en la app, porque
 * cualquiera que descargue la app puede leer lo que lleva dentro.
 *
 * En H0 solo se comprueba la conexión leyendo una tabla de prueba. El esquema
 * definitivo, las cuentas de usuario y la sincronización llegan en H4.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const clavePublica = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Nombre de la tabla de prueba que el usuario crea en su proyecto. */
export const TABLA_DE_PRUEBA = 'prueba';

let cliente: SupabaseClient | null = null;

export function supabaseConfigurado(): boolean {
  return Boolean(url && clavePublica);
}

export function obtenerSupabase(): SupabaseClient | null {
  if (!url || !clavePublica) return null;
  if (!cliente) {
    cliente = createClient(url, clavePublica, {
      // Sin cuentas de usuario hasta H4: no se guarda ninguna sesión.
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return cliente;
}

export type ResultadoPrueba =
  | { estado: 'sin_configurar' }
  | { estado: 'correcto'; filas: number }
  | { estado: 'error'; mensaje: string };

/** Lee la tabla de prueba y dice cuántas filas ha devuelto. */
export async function probarConexion(): Promise<ResultadoPrueba> {
  const supabase = obtenerSupabase();
  if (!supabase) return { estado: 'sin_configurar' };
  try {
    const { data, error } = await supabase.from(TABLA_DE_PRUEBA).select('*').limit(5);
    if (error) return { estado: 'error', mensaje: error.message };
    return { estado: 'correcto', filas: data?.length ?? 0 };
  } catch (e) {
    return { estado: 'error', mensaje: e instanceof Error ? e.message : String(e) };
  }
}
