/**
 * Avisos locales: une el cálculo de `src/dominio/avisos.ts` con los datos de
 * la app y con el sistema de notificaciones.
 *
 * Los avisos programados se recalculan enteros cada vez: se cancelan los que
 * la app tenía puestos y se vuelven a programar los que tocan. Así un cobro
 * que se confirma, o una regla que se borra, deja de avisar sin llevar
 * cuenta de qué había programado.
 */
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import type { Repositorios } from '@/datos';
import { calcularAvisos, diaLocal, type Aviso, type Preferencias } from '@/dominio/avisos';
import { esRutaDeAviso } from '@/dominio/entradas';
import { estadoDelPresupuesto } from '@/dominio/presupuesto';
import { useDatos } from '@/estado/Datos';
import { diaYMes } from '@/estado/fechas';
import { importe } from '@/estado/formato';
import { t } from '@/i18n';
import {
  alTocarUnAviso,
  mostrarAvisosEnPrimerPlano,
  notificador,
  PREFIJO,
  type AvisoParaMostrar,
  type Notificador,
} from '@/lib/notificaciones';
import { leerPreferencias } from '@/lib/preferencias';

/** Título y cuerpo de un aviso, con los textos del catálogo. */
export function textoDeAviso(
  aviso: Aviso,
  nombreDeCategoria: (id: string) => string,
  hoy: string,
): { titulo: string; cuerpo: string } {
  const c = aviso.contenido;
  switch (c.clase) {
    case 'cobro': {
      const cifra = importe(c.importe, c.divisa);
      const esIngreso = c.tipo === 'ingreso';
      const cuerpo =
        c.fecha === hoy
          ? t(esIngreso ? 'avisos.ingresoHoy' : 'avisos.cobroHoy', { importe: cifra })
          : t(esIngreso ? 'avisos.ingresoEl' : 'avisos.cobroEl', {
              importe: cifra,
              fecha: diaYMes(c.fecha),
            });
      return { titulo: t('avisos.cobroTitulo', { nombre: c.nombre }), cuerpo };
    }
    case 'presupuesto_cerca':
      return {
        titulo: t('avisos.presupuestoTitulo', { categoria: nombreDeCategoria(c.categoriaId) }),
        cuerpo: t('avisos.presupuestoCerca', { porcentaje: c.porcentaje }),
      };
    case 'presupuesto_excedido':
      return {
        titulo: t('avisos.presupuestoTitulo', { categoria: nombreDeCategoria(c.categoriaId) }),
        // El presupuesto se entiende en la divisa principal.
        cuerpo: t('avisos.presupuestoExcedido', { importe: importe(c.exceso, 'EUR') }),
      };
    case 'capturas':
      return { titulo: t('avisos.capturasTitulo'), cuerpo: t('avisos.capturasCuerpo') };
    case 'inversion':
      return {
        titulo: t('avisos.inversionTitulo', { nombre: c.nombre }),
        cuerpo: t('avisos.inversionCuerpo', { dias: c.dias }),
      };
  }
}

/** Datos que viajan con el aviso para abrir su pantalla al tocarlo. */
function datosDe(aviso: Aviso): Record<string, string> {
  return { ruta: aviso.destino.ruta, parametros: JSON.stringify(aviso.destino.parametros) };
}

/**
 * Recalcula los avisos. Cancela los que la app tenía programados y programa
 * los que tocan ahora; muestra los de presupuesto que aún no se habían
 * dado. Sin permiso del sistema no programa nada. Devuelve cuántos quedan
 * programados.
 */
export async function recalcularAvisos(
  repos: Repositorios,
  sistema: Notificador,
  preferencias: Preferencias,
  ahora: number,
): Promise<number> {
  for (const id of await sistema.programados()) await sistema.cancelar(id);
  const algunoActivo = Object.values(preferencias).some(Boolean);
  if (!algunoActivo || (await sistema.permiso()) !== 'concedido') return 0;

  const hoy = diaLocal(ahora);
  const mes = hoy.slice(0, 7);
  const [reglas, movimientos, categorias, presupuesto, capturas, cuentas, valores, emitidos] =
    await Promise.all([
      repos.reglas.listar(),
      repos.movimientos.listar(),
      repos.categorias.listar({ incluirArchivadas: true }),
      repos.presupuestos.delMes(mes),
      repos.capturas.listar(['pendiente']),
      repos.cuentas.listar({ incluirArchivadas: true }),
      repos.valores.listar(),
      repos.avisos.clavesEmitidas(),
    ]);
  const { programados, inmediatos } = calcularAvisos(
    {
      reglas,
      movimientos,
      presupuesto: presupuesto
        ? estadoDelPresupuesto(presupuesto.lineas, movimientos, categorias, mes, hoy)
        : null,
      capturas,
      cuentas,
      valores,
      emitidos,
    },
    preferencias,
    ahora,
  );
  const nombreDeCategoria = (id: string) =>
    categorias.find((c) => c.id === id)?.nombre ?? t('avisos.categoriaSinNombre');
  const paraMostrar = (aviso: Aviso): AvisoParaMostrar => ({
    id: `${PREFIJO}${aviso.clave}`,
    ...textoDeAviso(aviso, nombreDeCategoria, hoy),
    datos: datosDe(aviso),
  });

  for (const aviso of programados) await sistema.programar(paraMostrar(aviso), aviso.instante);
  for (const aviso of inmediatos) {
    // Se anota antes de mostrarlo: si dos recálculos coinciden, solo uno lo da.
    if (!(await repos.avisos.registrar(aviso.clave))) continue;
    for (const clave of aviso.cubre) await repos.avisos.registrar(clave);
    await sistema.mostrar(paraMostrar(aviso));
  }
  return programados.length;
}

/** Ruta y parámetros que pide un aviso tocado, o `null` si no trae una ruta de la app. */
export function destinoDelAviso(
  datos: Record<string, unknown>,
): { pathname: string; params: Record<string, string> } | null {
  // El aviso que lanza la acción de Atajos solo trae el identificador de su entrada en la cola.
  if (typeof datos.capturaId === 'string' && typeof datos.ruta !== 'string') {
    return { pathname: '/capturas', params: { cola: datos.capturaId.slice(0, 80) } };
  }
  // Solo las pantallas a las que llevan los avisos de la app; cualquier otra ruta se ignora.
  if (!esRutaDeAviso(datos.ruta)) return null;
  let params: Record<string, string> = {};
  try {
    const leidos: unknown = JSON.parse(
      typeof datos.parametros === 'string' ? datos.parametros : '{}',
    );
    if (typeof leidos === 'object' && leidos !== null) {
      params = Object.fromEntries(
        Object.entries(leidos)
          .filter((par): par is [string, string] => typeof par[1] === 'string')
          .slice(0, 8),
      );
    }
  } catch {
    // Sin parámetros legibles se abre la pantalla sin ellos.
  }
  return { pathname: datos.ruta, params };
}

/**
 * Mantiene los avisos al día: los recalcula al abrir la app y cada vez que
 * cambian los datos, y abre la pantalla que corresponde al tocar uno. Se usa
 * una sola vez, en la raíz de la app.
 */
export function useAvisosAutomaticos(): void {
  const { repos, version } = useDatos();
  const enCurso = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    mostrarAvisosEnPrimerPlano();
    return alTocarUnAviso((datos) => {
      const destino = destinoDelAviso(datos);
      // La ruta viene de un aviso que programó la propia app.
      if (destino) router.push(destino as never);
    });
  }, []);

  useEffect(() => {
    // Los recálculos van en fila: uno no empieza hasta que acaba el anterior.
    enCurso.current = enCurso.current
      .then(async () => recalcularAvisos(repos, notificador, await leerPreferencias(), Date.now()))
      .catch(() => undefined);
  }, [repos, version]);
}
