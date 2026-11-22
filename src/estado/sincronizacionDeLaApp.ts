/**
 * La sincronización de la app: une el motor y el sincronizador con la base de
 * datos real, el cliente de Supabase y la cuenta.
 *
 * Sin cuenta abierta no hace nada: ni toca la red, ni carga la biblioteca de
 * cifrado. Lo único que mira al arrancar es si el llavero guarda una clave.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { CLAVE_DE_DATOS_EN_EL_ALMACEN } from '@/lib/almacenSeguro';
import { almacenSeguro } from '@/lib/almacenSeguroNativo';
import { obtenerSupabase } from '@/lib/supabase';
import { crearMotor, type Motor } from '@/sincronizacion/motor';
import { crearServidorDeFilas } from '@/sincronizacion/servidor';
import {
  crearSincronizador,
  type EstadoDeSincronizacion,
  type Sincronizador,
} from '@/sincronizacion/sincronizador';

import { alBorrarLaCuenta, cuenta } from './cuentaDeLaApp';
import {
  alCambiarDatosLocales,
  baseDeDatosDeLaApp,
  categoriasIniciales,
  refrescarDatos,
} from './Datos';

let sincronizador: Sincronizador | null = null;
let motor: Promise<Motor> | null = null;

function motorDeLaApp(): Promise<Motor> {
  motor ??= (async () => {
    const cliente = obtenerSupabase();
    if (!cliente) throw new Error('Sin configuración del servidor.');
    return crearMotor({
      bd: await baseDeDatosDeLaApp(),
      servidor: crearServidorDeFilas(cliente),
      leerClave: () => cuenta().leerClaveDeDatos(),
      ahora: () => new Date(),
      categoriasIniciales: categoriasIniciales(),
    });
  })();
  // Si falla (la base no abre), se reintenta la próxima vez.
  motor.catch(() => {
    motor = null;
  });
  return motor;
}

// Si la cuenta se borra, la base local deja de estar ligada a ella.
alBorrarLaCuenta(() => sincronizacion().alBorrarCuenta());

/** El sincronizador de la app. Se crea la primera vez que se pide. */
export function sincronizacion(): Sincronizador {
  sincronizador ??= crearSincronizador({
    motor: motorDeLaApp,
    haySesion: () => cuenta().estado().fase === 'con_sesion',
    alAplicar: refrescarDatos,
  });
  return sincronizador;
}

/** El estado de la sincronización, para pintarlo en Cuenta. */
export function useSincronizacion(): EstadoDeSincronizacion {
  const s = sincronizacion();
  return useSyncExternalStore(s.suscribir, s.estado, s.estado);
}

/**
 * Lanza la sincronización cuando toca: al abrir la app, al volver de segundo
 * plano, poco después de un cambio local y al iniciar o cerrar sesión. No pinta
 * nada y no espera a la red. Se monta una vez, en la raíz.
 */
export function useSincronizacionAutomatica(): void {
  useEffect(() => {
    const s = sincronizacion();
    const gestor = cuenta();
    let vigente = true;
    let faseAnterior = gestor.estado().fase;

    // Al abrir: solo si el llavero guarda una clave se comprueba la cuenta y se sincroniza.
    almacenSeguro
      .leer(CLAVE_DE_DATOS_EN_EL_ALMACEN)
      .then(async (clave) => {
        if (!clave || !vigente) return;
        await gestor.iniciar();
        if (vigente) void s.pedir('arranque');
      })
      .catch(() => undefined);

    const dejarDeOirLaCuenta = gestor.suscribir(() => {
      const fase = gestor.estado().fase;
      if (fase === faseAnterior) return;
      const antes = faseAnterior;
      faseAnterior = fase;
      if (fase === 'con_sesion') void s.pedir('sesion');
      else if (antes === 'con_sesion') s.alCerrarSesion();
    });
    const dejarDeOirLosDatos = alCambiarDatosLocales(() => void s.pedir('cambio'));
    const alVolver = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') void s.pedir('primer_plano');
    });
    return () => {
      vigente = false;
      dejarDeOirLaCuenta();
      dejarDeOirLosDatos();
      alVolver.remove();
      s.detener();
    };
  }, []);
}
