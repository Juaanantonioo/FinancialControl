/**
 * Datos de planificación que comparten Inicio y la pestaña Plan: reglas
 * recurrentes, objetivos, aportaciones y el presupuesto de un mes. Los
 * cálculos los hacen las funciones de `src/dominio`.
 */
import { useAviso } from '@/estado/Aviso';
import { textoDeError, useConsulta, useDatos } from '@/estado/Datos';
import { t } from '@/i18n';

export function usePlan() {
  const reglas = useConsulta((r) => r.reglas.listar());
  const objetivos = useConsulta((r) => r.objetivos.listar({ incluirArchivados: true }));
  const aportaciones = useConsulta((r) => r.objetivos.listarAportaciones());
  return {
    cargado: reglas !== undefined && objetivos !== undefined && aportaciones !== undefined,
    reglas: reglas ?? [],
    objetivos: objetivos ?? [],
    aportaciones: aportaciones ?? [],
  };
}

/** Presupuesto de un mes: `undefined` mientras carga y `null` si no existe. */
export function usePresupuesto(mes: string) {
  return useConsulta((r) => r.presupuestos.delMes(mes), [mes]);
}

/**
 * Confirma un cobro en un toque, con los datos de su regla, y ofrece
 * deshacerlo. Si no se puede (por ejemplo, la cuenta está archivada) lo
 * explica en el aviso.
 */
export function useConfirmarCobro() {
  const { repos, notificarCambio } = useDatos();
  const mostrarAviso = useAviso();
  return async (reglaId: string, mes: string, nombre: string) => {
    try {
      const mov = await repos.reglas.confirmar(reglaId, mes);
      notificarCambio();
      mostrarAviso({
        texto: t('fijos.confirmado', { nombre }),
        accion: {
          texto: t('comun.deshacer'),
          alPulsar: () => {
            repos.movimientos.borrar(mov.id).then(notificarCambio, () => undefined);
          },
        },
      });
    } catch (e) {
      mostrarAviso({ texto: textoDeError(e) });
    }
  };
}
