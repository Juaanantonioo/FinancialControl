/**
 * Lectura de la cola nativa de las acciones de Atajos.
 *
 * «Registrar pago» y «Añadir gasto» (carpeta `app-intents/`, en Swift) dejan
 * cada ejecución en una cola persistente del dispositivo. Aquí se vuelca esa
 * cola en la base de datos al abrir la app, al volver a primer plano y si
 * llega una entrada con la app abierta. Cada entrada se quita de la cola
 * solo después de haberse guardado; si algo falla a medias se reintenta, y
 * su identificador evita que se guarde dos veces.
 */
import * as AppIntents from 'expo-app-intents';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import type { Invocacion } from '@/dominio/captura';
import { importarInvocaciones } from '@/estado/cola';
import { useDatos } from '@/estado/Datos';

export function useColaDeAtajos(): void {
  const { repos, notificarCambio } = useDatos();
  const enCurso = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (!AppIntents.isAvailable()) return;

    async function volcar() {
      const pendientes = await AppIntents.getPendingInvocationsAsync();
      if (pendientes.length === 0) return;
      const entradas: Invocacion[] = pendientes.map((p) => ({
        id: p.id,
        name: p.name,
        params: p.params,
        createdAt: p.createdAt,
      }));
      await importarInvocaciones(repos, entradas, new Date().toISOString());
      for (const entrada of entradas) await AppIntents.removePendingInvocationAsync(entrada.id);
      notificarCambio();
    }
    // Los volcados van en fila: dos a la vez leerían las mismas entradas.
    const pedir = () => {
      enCurso.current = enCurso.current.then(volcar).catch(() => undefined);
    };

    pedir();
    const alVolver = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') pedir();
    });
    const alLlegar = AppIntents.addAppIntentListener(pedir);
    return () => {
      alVolver.remove();
      alLlegar.remove();
    };
  }, [repos, notificarCambio]);
}
