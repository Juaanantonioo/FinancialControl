/**
 * Gastos fijos, suscripciones, ingresos periódicos y aportaciones
 * mensuales (T-064 a T-066, dashboard D9).
 *
 * Una regla recurrente no crea movimientos por sí sola: dice qué día se
 * espera un cobro. Cada mes produce como mucho una «ocurrencia», que está
 * pendiente hasta que la persona la confirma. Nada de esto se guarda: las
 * ocurrencias se calculan a partir de las reglas y de los movimientos.
 * «Hoy» entra siempre como parámetro.
 */
import type { CamposComunes, Movimiento } from './modelo';
import { moverMes } from './resumen';
import { diasDelMes } from './tiempo';

export const CLASES_DE_REGLA = ['fijo', 'suscripcion', 'ingreso', 'aportacion'] as const;
export type ClaseDeRegla = (typeof CLASES_DE_REGLA)[number];

export const PERIODICIDADES = ['mensual', 'anual'] as const;
export type Periodicidad = (typeof PERIODICIDADES)[number];

export type TipoDeRegla = 'gasto' | 'ingreso' | 'transferencia';

/** Tipo de movimiento que genera cada clase de regla. */
export function tipoDeLaClase(clase: ClaseDeRegla): TipoDeRegla {
  if (clase === 'ingreso') return 'ingreso';
  if (clase === 'aportacion') return 'transferencia';
  return 'gasto';
}

export type ReglaRecurrente = CamposComunes & {
  nombre: string;
  clase: ClaseDeRegla;
  tipoMovimiento: TipoDeRegla;
  /** Céntimos, siempre positivo. */
  importe: number;
  divisa: string;
  cuentaId: string;
  /** Solo en aportaciones. */
  cuentaDestinoId: string | null;
  /** En gastos e ingresos. */
  categoriaId: string | null;
  periodicidad: Periodicidad;
  /** De 1 a 31. Si el mes es más corto, cae en su último día. */
  diaDelMes: number;
  /** Día local desde el que la regla existe. En las anuales fija también el mes. */
  fechaInicio: string;
  fechaFin: string | null;
  activa: boolean;
  avisoDiasAntes: number;
  /** Objetivo al que suma una aportación. */
  objetivoId: string | null;
};

type ReglaParaOcurrencias = Pick<
  ReglaRecurrente,
  'id' | 'periodicidad' | 'diaDelMes' | 'fechaInicio' | 'fechaFin' | 'activa' | 'borradoEn'
>;
type MovimientoDeRegla = Pick<Movimiento, 'id' | 'fecha' | 'reglaRecurrenteId' | 'borradoEn'>;

/** Suma días a una fecha "AAAA-MM-DD" (negativos para restar). */
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia + dias));
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${String(d.getUTCFullYear()).padStart(4, '0')}-${mm}-${dd}`;
}

/**
 * Día en que una regla ocurre en un mes "AAAA-MM", o `null` si ese mes no
 * le toca: regla inactiva o borrada, mes que no es el suyo (anual), o fecha
 * anterior a su inicio o posterior a su fin.
 */
export function fechaDeOcurrencia(regla: ReglaParaOcurrencias, mes: string): string | null {
  if (!regla.activa || regla.borradoEn !== null) return null;
  if (regla.periodicidad === 'anual' && mes.slice(5, 7) !== regla.fechaInicio.slice(5, 7)) {
    return null;
  }
  // El día 31 cae en el último día de los meses más cortos.
  const dia = Math.min(regla.diaDelMes, diasDelMes(mes));
  const fecha = `${mes}-${String(dia).padStart(2, '0')}`;
  if (fecha < regla.fechaInicio) return null;
  if (regla.fechaFin !== null && fecha > regla.fechaFin) return null;
  return fecha;
}

/**
 * - `confirmada`: hay un movimiento de esa regla en ese mes.
 * - `por_confirmar`: pendiente y su día ya ha llegado.
 * - `proximo`: pendiente y su día aún no ha llegado.
 */
export type EstadoDeOcurrencia = 'confirmada' | 'por_confirmar' | 'proximo';

export type Ocurrencia<R> = {
  regla: R;
  mes: string;
  fecha: string;
  estado: EstadoDeOcurrencia;
  /** Movimiento que la confirma, si lo hay. */
  movimientoId: string | null;
};

/** Movimiento no borrado de esa regla con fecha dentro de ese mes. */
export function movimientoQueConfirma(
  reglaId: string,
  mes: string,
  movimientos: MovimientoDeRegla[],
): MovimientoDeRegla | null {
  for (const mov of movimientos) {
    if (mov.borradoEn !== null || mov.reglaRecurrenteId !== reglaId) continue;
    if (mov.fecha.slice(0, 7) === mes) return mov;
  }
  return null;
}

/** Ocurrencias de un mes, ordenadas por día. */
export function ocurrenciasDelMes<R extends ReglaParaOcurrencias>(
  reglas: R[],
  movimientos: MovimientoDeRegla[],
  mes: string,
  hoy: string,
): Ocurrencia<R>[] {
  const lista: Ocurrencia<R>[] = [];
  for (const regla of reglas) {
    const fecha = fechaDeOcurrencia(regla, mes);
    if (fecha === null) continue;
    const mov = movimientoQueConfirma(regla.id, mes, movimientos);
    lista.push({
      regla,
      mes,
      fecha,
      estado: mov ? 'confirmada' : fecha <= hoy ? 'por_confirmar' : 'proximo',
      movimientoId: mov?.id ?? null,
    });
  }
  return lista.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

/** Ocurrencias pendientes (por confirmar o próximas) de un mes. */
export function pendientesDelMes<R extends ReglaParaOcurrencias>(
  reglas: R[],
  movimientos: MovimientoDeRegla[],
  mes: string,
  hoy: string,
): Ocurrencia<R>[] {
  return ocurrenciasDelMes(reglas, movimientos, mes, hoy).filter((o) => o.estado !== 'confirmada');
}

/**
 * Cobros que ya deberían haberse producido y siguen sin confirmar: los del
 * mes en curso con día igual o anterior a hoy y los del mes anterior. Más
 * atrás no se mira, para no acumular una lista interminable.
 */
export function porConfirmar<R extends ReglaParaOcurrencias>(
  reglas: R[],
  movimientos: MovimientoDeRegla[],
  hoy: string,
): Ocurrencia<R>[] {
  const mes = hoy.slice(0, 7);
  return [moverMes(mes, -1), mes].flatMap((m) =>
    ocurrenciasDelMes(reglas, movimientos, m, hoy).filter((o) => o.estado === 'por_confirmar'),
  );
}

/** Cobros pendientes con día posterior a hoy y dentro de los próximos `dias` días. */
export function proximosCobros<R extends ReglaParaOcurrencias>(
  reglas: R[],
  movimientos: MovimientoDeRegla[],
  hoy: string,
  dias = 14,
): Ocurrencia<R>[] {
  const limite = sumarDias(hoy, dias);
  const meses = [...new Set([hoy.slice(0, 7), limite.slice(0, 7)])];
  return meses
    .flatMap((m) => ocurrenciasDelMes(reglas, movimientos, m, hoy))
    .filter((o) => o.estado === 'proximo' && o.fecha <= limite);
}

/** `true` si la regla sigue vigente hoy: activa, sin borrar y sin fecha de fin pasada. */
export function estaVigente(
  regla: Pick<ReglaRecurrente, 'activa' | 'borradoEn' | 'fechaFin'>,
  hoy: string,
): boolean {
  return (
    regla.activa && regla.borradoEn === null && (regla.fechaFin === null || regla.fechaFin >= hoy)
  );
}

/** Suma de las reglas mensuales de gasto vigentes: lo que se va cada mes en fijos. */
export function totalMensualDeFijos(
  reglas: Pick<
    ReglaRecurrente,
    'tipoMovimiento' | 'periodicidad' | 'importe' | 'activa' | 'borradoEn' | 'fechaFin'
  >[],
  hoy: string,
): number {
  let total = 0;
  for (const regla of reglas) {
    if (regla.tipoMovimiento !== 'gasto' || regla.periodicidad !== 'mensual') continue;
    if (estaVigente(regla, hoy)) total += regla.importe;
  }
  return total;
}

/** Suma de las ocurrencias de gasto pendientes de un mes (para el disponible, D1). */
export function fijosPendientes(
  ocurrencias: Ocurrencia<Pick<ReglaRecurrente, 'tipoMovimiento' | 'importe'>>[],
): number {
  let total = 0;
  for (const o of ocurrencias) {
    if (o.estado !== 'confirmada' && o.regla.tipoMovimiento === 'gasto') total += o.regla.importe;
  }
  return total;
}
