/**
 * Objetivos de ahorro o inversión (T-070 a T-072, dashboard D8). El avance
 * no se guarda: se calcula sumando las aportaciones.
 */
import type { CamposComunes } from './modelo';

export const TIPOS_DE_OBJETIVO = ['ahorro', 'inversion'] as const;
export type TipoDeObjetivo = (typeof TIPOS_DE_OBJETIVO)[number];

export type Objetivo = CamposComunes & {
  nombre: string;
  tipo: TipoDeObjetivo;
  /** Céntimos, mayor que cero. */
  meta: number;
  divisa: string;
  /** Día local "AAAA-MM-DD", o `null` si no hay plazo. */
  fechaLimite: string | null;
  /** Cuenta donde se guarda el dinero del objetivo, si se indicó. */
  cuentaId: string | null;
  archivado: boolean;
};

export type AportacionAObjetivo = CamposComunes & {
  objetivoId: string;
  fecha: string;
  /** Céntimos, mayor que cero. */
  importe: number;
  /** Movimiento que la originó, si lo hay. */
  movimientoId: string | null;
  nota: string | null;
};

export type SituacionDeObjetivo = 'en_curso' | 'sin_fecha' | 'conseguido' | 'plazo_vencido';

export type EstadoDeObjetivo = {
  aportado: number;
  /** Lo que falta para la meta. Cero si ya se ha llegado. */
  falta: number;
  /** Tanto por ciento entero, con tope de 100. */
  avance: number;
  situacion: SituacionDeObjetivo;
  /** Meses hasta la fecha límite, con mínimo 1. `null` si no hay ritmo que calcular. */
  mesesRestantes: number | null;
  /** Lo que hay que aportar al mes para llegar, redondeado hacia arriba. */
  necesarioAlMes: number | null;
};

/** Suma de las aportaciones no borradas de un objetivo. */
export function aportadoA(
  objetivoId: string,
  aportaciones: Pick<AportacionAObjetivo, 'objetivoId' | 'importe' | 'borradoEn'>[],
): number {
  let total = 0;
  for (const a of aportaciones) {
    if (a.borradoEn === null && a.objetivoId === objetivoId) total += a.importe;
  }
  return total;
}

/** Meses naturales de hoy a la fecha límite, con mínimo 1. */
export function mesesHasta(fechaLimite: string, hoy: string): number {
  const meses =
    (Number(fechaLimite.slice(0, 4)) - Number(hoy.slice(0, 4))) * 12 +
    (Number(fechaLimite.slice(5, 7)) - Number(hoy.slice(5, 7)));
  return Math.max(1, meses);
}

export function estadoDeObjetivo(
  objetivo: Pick<Objetivo, 'id' | 'meta' | 'fechaLimite'>,
  aportaciones: Pick<AportacionAObjetivo, 'objetivoId' | 'importe' | 'borradoEn'>[],
  hoy: string,
): EstadoDeObjetivo {
  const aportado = aportadoA(objetivo.id, aportaciones);
  const falta = Math.max(0, objetivo.meta - aportado);
  const base = {
    aportado,
    falta,
    // Hacia abajo: no se enseña un 100 % hasta que se ha llegado de verdad.
    avance: Math.min(100, Math.floor((aportado * 100) / objetivo.meta)),
    mesesRestantes: null,
    necesarioAlMes: null,
  };
  if (aportado >= objetivo.meta) return { ...base, avance: 100, situacion: 'conseguido' };
  if (objetivo.fechaLimite === null) return { ...base, situacion: 'sin_fecha' };
  if (objetivo.fechaLimite < hoy) return { ...base, situacion: 'plazo_vencido' };
  const meses = mesesHasta(objetivo.fechaLimite, hoy);
  return {
    ...base,
    situacion: 'en_curso',
    mesesRestantes: meses,
    necesarioAlMes: Math.ceil(falta / meses),
  };
}
