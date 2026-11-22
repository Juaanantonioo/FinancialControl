/**
 * Apoyo de las pruebas de sincronización contra la instancia local: «dispositivos»
 * que hablan con el Supabase de verdad, con el cliente de verdad.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { crearDispositivo } from '@/pruebas/sincronizacionDePrueba';
import { crearServidorDeFilas } from '@/sincronizacion/servidor';

import { clienteAnonimo, type Usuario } from './apoyo';

export type Peticion = { metodo: string; url: string; cuerpo: string };

/** Una red que se puede cortar y que apunta todo lo que sale por ella. */
export function redEspiada() {
  const peticiones: Peticion[] = [];
  const estado = { cortada: false };
  const fetchEspiado: typeof fetch = async (entrada, opciones) => {
    if (estado.cortada) throw new TypeError('Network request failed');
    const cuerpo = opciones?.body;
    peticiones.push({
      metodo: opciones?.method ?? 'GET',
      url: String(entrada instanceof Request ? entrada.url : entrada),
      cuerpo: typeof cuerpo === 'string' ? cuerpo : cuerpo ? '[cuerpo no textual]' : '',
    });
    return fetch(entrada, opciones);
  };
  return { peticiones, estado, fetch: fetchEspiado };
}

/** Otro cliente con la misma sesión que `usuario`: otro dispositivo de la misma cuenta. */
export async function otroCliente(usuario: Usuario, red?: typeof fetch): Promise<SupabaseClient> {
  const { data } = await usuario.cliente.auth.getSession();
  if (!data.session) throw new Error('El usuario de prueba no tiene sesión.');
  const cliente = clienteAnonimo(red);
  const { error } = await cliente.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (error) throw new Error('No se pudo copiar la sesión de prueba.');
  return cliente;
}

type Opciones = Partial<Parameters<typeof crearDispositivo>[0]> & { red?: typeof fetch };

/** Un dispositivo de `usuario`: base local nueva y motor contra el Supabase local. */
export async function dispositivoDe(usuario: Usuario, clave: Uint8Array, opciones: Opciones = {}) {
  const { red, ...resto } = opciones;
  const cliente = await otroCliente(usuario, red);
  const dispositivo = await crearDispositivo({
    servidor: crearServidorDeFilas(cliente),
    clave,
    ...resto,
  });
  return { ...dispositivo, cliente };
}

export const pausa = (ms: number) => new Promise<void>((seguir) => setTimeout(seguir, ms));
