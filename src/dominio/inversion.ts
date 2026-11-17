/**
 * Cuentas de inversión con valor manual (T-070, T-075).
 *
 * La app no conoce cotizaciones. El valor de una inversión es el que la
 * persona escribe en una fecha; entre un valor y el siguiente la app solo
 * suma lo que entra y resta lo que sale. Por eso se habla de valor ESTIMADO,
 * nunca de valor de mercado. Ninguna cifra de aquí se guarda: todas se
 * calculan a partir de los movimientos y de los valores registrados.
 */
import type { CamposComunes, Cuenta, Movimiento } from './modelo';
import { calcularSaldo, efectoEnCuenta } from './saldo';

/** Valor que la persona ha escrito para una cuenta de inversión en un día. */
export type ValorDeInversion = CamposComunes & {
  cuentaId: string;
  /** Día local "AAAA-MM-DD". Se entiende que incluye los movimientos de ese día. */
  fecha: string;
  /** Céntimos, cero o positivo. */
  valor: number;
};

export type MovimientoDeCuenta = Pick<
  Movimiento,
  'tipo' | 'fecha' | 'importe' | 'cuentaId' | 'cuentaDestinoId' | 'borradoEn'
>;
export type CuentaConSaldoInicial = Pick<Cuenta, 'id' | 'saldoInicial' | 'fechaSaldoInicial'>;
export type ValorRegistrado = Pick<ValorDeInversion, 'cuentaId' | 'fecha' | 'valor' | 'borradoEn'>;

/**
 * Saldo de una cuenta al terminar el día `fecha`. Antes de la fecha de su
 * saldo inicial la cuenta no tiene saldo conocido: devuelve `null`, no un
 * cero inventado.
 */
export function saldoEnFecha(
  cuenta: CuentaConSaldoInicial,
  movimientos: MovimientoDeCuenta[],
  fecha: string,
): number | null {
  if (fecha < cuenta.fechaSaldoInicial) return null;
  return calcularSaldo(
    cuenta,
    movimientos.filter((m) => m.fecha <= fecha),
  );
}

/** Último valor registrado de la cuenta con fecha igual o anterior a `fecha`. */
export function ultimoValor<V extends ValorRegistrado>(
  cuenta: CuentaConSaldoInicial,
  valores: V[],
  fecha: string,
): V | null {
  let ultimo: V | null = null;
  for (const v of valores) {
    if (v.borradoEn !== null || v.cuentaId !== cuenta.id) continue;
    // Un valor anterior a la fecha del saldo inicial no dice nada de esta cuenta.
    if (v.fecha > fecha || v.fecha < cuenta.fechaSaldoInicial) continue;
    if (!ultimo || v.fecha > ultimo.fecha) ultimo = v;
  }
  return ultimo;
}

/**
 * Valor estimado al terminar el día `fecha`: el último valor registrado más
 * lo que ha entrado y menos lo que ha salido desde entonces. Sin ningún
 * valor registrado es lo aportado. `null` antes de que exista la cuenta.
 */
export function valorEstimado(
  cuenta: CuentaConSaldoInicial,
  movimientos: MovimientoDeCuenta[],
  valores: ValorRegistrado[],
  fecha: string,
): number | null {
  const aportado = saldoEnFecha(cuenta, movimientos, fecha);
  if (aportado === null) return null;
  const ultimo = ultimoValor(cuenta, valores, fecha);
  if (!ultimo) return aportado;
  let valor = ultimo.valor;
  for (const mov of movimientos) {
    // El valor registrado ya incluye los movimientos de su mismo día.
    if (mov.fecha <= ultimo.fecha || mov.fecha > fecha) continue;
    valor += efectoEnCuenta(mov, cuenta.id);
  }
  return valor;
}

export type ResumenDeInversion = {
  /** Lo que se ha puesto: saldo inicial más entradas menos salidas. */
  aportado: number;
  /** Valor estimado en la fecha consultada. */
  valor: number;
  /** Valor menos aportado. Negativo si se pierde. */
  ganancia: number;
  /** Tanto por ciento con un decimal, o `null` si lo aportado no es mayor que cero. */
  rentabilidad: number | null;
  /** Último valor escrito por la persona, o `null` si no hay ninguno. */
  ultimo: { fecha: string; valor: number } | null;
};

/** Ganancia entre aportado, en tanto por ciento con un decimal. */
export function rentabilidadSimple(ganancia: number, aportado: number): number | null {
  if (aportado <= 0) return null;
  return Math.round((ganancia * 1000) / aportado) / 10;
}

/** Resumen de una cuenta de inversión al terminar el día `fecha`. */
export function resumenDeInversion(
  cuenta: CuentaConSaldoInicial,
  movimientos: MovimientoDeCuenta[],
  valores: ValorRegistrado[],
  fecha: string,
): ResumenDeInversion {
  const aportado = saldoEnFecha(cuenta, movimientos, fecha) ?? 0;
  const valor = valorEstimado(cuenta, movimientos, valores, fecha) ?? 0;
  const ultimo = ultimoValor(cuenta, valores, fecha);
  const ganancia = valor - aportado;
  return {
    aportado,
    valor,
    ganancia,
    rentabilidad: rentabilidadSimple(ganancia, aportado),
    ultimo: ultimo ? { fecha: ultimo.fecha, valor: ultimo.valor } : null,
  };
}

/** Suma de varias cuentas de inversión de una misma divisa. */
export function resumenDeInversiones(
  cuentas: CuentaConSaldoInicial[],
  movimientos: MovimientoDeCuenta[],
  valores: ValorRegistrado[],
  fecha: string,
): Pick<ResumenDeInversion, 'aportado' | 'valor' | 'ganancia' | 'rentabilidad'> {
  let aportado = 0;
  let valor = 0;
  for (const cuenta of cuentas) {
    const r = resumenDeInversion(cuenta, movimientos, valores, fecha);
    aportado += r.aportado;
    valor += r.valor;
  }
  const ganancia = valor - aportado;
  return { aportado, valor, ganancia, rentabilidad: rentabilidadSimple(ganancia, aportado) };
}

export type PuntoDeInversion = { fecha: string; aportado: number; valor: number };

/** Aportado y valor estimado en cada fecha. Las fechas anteriores a la cuenta se omiten. */
export function evolucionDeInversion(
  cuenta: CuentaConSaldoInicial,
  movimientos: MovimientoDeCuenta[],
  valores: ValorRegistrado[],
  fechas: string[],
): PuntoDeInversion[] {
  const puntos: PuntoDeInversion[] = [];
  for (const fecha of fechas) {
    const aportado = saldoEnFecha(cuenta, movimientos, fecha);
    const valor = valorEstimado(cuenta, movimientos, valores, fecha);
    if (aportado === null || valor === null) continue;
    puntos.push({ fecha, aportado, valor });
  }
  return puntos;
}

/** Días naturales entre dos fechas "AAAA-MM-DD" (positivo si `hasta` es posterior). */
export function diasEntre(desde: string, hasta: string): number {
  const aDias = (fecha: string) => {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    return Math.round(Date.UTC(anio, mes - 1, dia) / 86_400_000);
  };
  return aDias(hasta) - aDias(desde);
}

/** Días a partir de los cuales se invita a actualizar el valor. */
export const DIAS_PARA_AVISAR = 30;

/** `true` si el último valor tiene más de 30 días. Sin valores no hay aviso: hay estado vacío. */
export function valorDesactualizado(ultimaFecha: string | null, hoy: string): boolean {
  return ultimaFecha !== null && diasEntre(ultimaFecha, hoy) > DIAS_PARA_AVISAR;
}
