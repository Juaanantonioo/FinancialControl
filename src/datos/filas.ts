/**
 * Traducción entre una fila de la tabla `movimiento` (columnas con guion
 * bajo, como es habitual en SQL) y el objeto `Movimiento` del dominio.
 * Vive en su propio fichero porque la usan varios repositorios.
 */
import type { Movimiento, OrigenDeMovimiento, TipoDeMovimiento } from '@/dominio/modelo';

export type FilaMovimiento = {
  id: string;
  tipo: TipoDeMovimiento;
  fecha: string;
  importe: number;
  divisa: string;
  cuenta_id: string;
  cuenta_destino_id: string | null;
  categoria_id: string | null;
  nombre: string;
  comercio: string | null;
  nota: string | null;
  origen: OrigenDeMovimiento;
  regla_recurrente_id: string | null;
  captura_id: string | null;
  objetivo_id: string | null;
  creado_en: string;
  modificado_en: string;
  borrado_en: string | null;
};

export function filaAMovimiento(f: FilaMovimiento): Movimiento {
  return {
    id: f.id,
    tipo: f.tipo,
    fecha: f.fecha,
    importe: f.importe,
    divisa: f.divisa,
    cuentaId: f.cuenta_id,
    cuentaDestinoId: f.cuenta_destino_id,
    categoriaId: f.categoria_id,
    nombre: f.nombre,
    comercio: f.comercio,
    nota: f.nota,
    origen: f.origen,
    reglaRecurrenteId: f.regla_recurrente_id,
    capturaId: f.captura_id,
    objetivoId: f.objetivo_id,
    creadoEn: f.creado_en,
    modificadoEn: f.modificado_en,
    borradoEn: f.borrado_en,
  };
}
