/**
 * La cuenta de la app: une la lógica de `cuenta.ts` con el cliente real de
 * Supabase y con el llavero del sistema.
 */
import { useEffect, useSyncExternalStore } from 'react';

import { almacenSeguro } from '@/lib/almacenSeguroNativo';
import { obtenerSupabase } from '@/lib/supabase';

import {
  crearGestorDeCuenta,
  type ClienteDeCuenta,
  type EstadoDeCuenta,
  type GestorDeCuenta,
} from './cuenta';

let gestor: GestorDeCuenta | null = null;

// Quién quiere enterarse de que la cuenta se ha borrado (la sincronización, para
// desligar de ella la base local). Se apuntan ellos: este fichero no los conoce.
const alBorrar = new Set<() => Promise<void>>();

/** Apunta una tarea que se hará cuando la cuenta se borre del servidor. */
export function alBorrarLaCuenta(tarea: () => Promise<void>): void {
  alBorrar.add(tarea);
}

/** El gestor de la cuenta. Se crea la primera vez que se pide. */
export function cuenta(): GestorDeCuenta {
  gestor ??= crearGestorDeCuenta({
    cliente: obtenerSupabase() as unknown as ClienteDeCuenta | null,
    almacen: almacenSeguro,
    alBorrarCuenta: async () => {
      await Promise.all([...alBorrar].map((tarea) => tarea()));
    },
  });
  return gestor;
}

/** El estado de la cuenta. Al usarlo por primera vez se comprueba la biblioteca y se lee la sesión. */
export function useCuenta(): EstadoDeCuenta {
  const g = cuenta();
  useEffect(() => {
    void g.iniciar();
  }, [g]);
  return useSyncExternalStore(g.suscribir, g.estado, g.estado);
}
