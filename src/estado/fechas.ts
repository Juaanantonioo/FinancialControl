/** Textos de fechas para las pantallas, construidos con el catálogo. */
import { fechaLocal } from '@/dominio/modelo';
import { t, type ClaveTexto } from '@/i18n';

/** Convierte "AAAA-MM-DD" en un objeto Date a mediodía local (evita saltos por cambio de hora). */
export function aFecha(fecha: string): Date {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia, 12);
}

/** Suma o resta días a una fecha "AAAA-MM-DD". */
export function moverDias(fecha: string, dias: number): string {
  const d = aFecha(fecha);
  d.setDate(d.getDate() + dias);
  return fechaLocal(d);
}

/** "Hoy", "Ayer" o "martes, 10 de noviembre de 2026". */
export function describirFecha(fecha: string, hoy: string = fechaLocal()): string {
  if (fecha === hoy) return t('comun.hoy');
  if (fecha === moverDias(hoy, -1)) return t('comun.ayer');
  const d = aFecha(fecha);
  return t('fechas.formato', {
    diaSemana: t(`fechas.dia${d.getDay()}` as ClaveTexto),
    dia: d.getDate(),
    mes: t(`fechas.mes${d.getMonth() + 1}` as ClaveTexto),
    anio: d.getFullYear(),
  });
}

/** "noviembre de 2026" a partir de "2026-11". */
export function describirMes(mes: string): string {
  const [anio, numero] = mes.split('-').map(Number);
  return t('fechas.mesYAnio', { mes: t(`fechas.mes${numero}` as ClaveTexto), anio });
}

/** "nov" a partir de "2026-11". */
export function mesCorto(mes: string): string {
  return t(`fechas.mesCorto${Number(mes.split('-')[1])}` as ClaveTexto);
}

/** "15 de noviembre de 2026" a partir de "2026-11-15". */
export function fechaLarga(fecha: string): string {
  const d = aFecha(fecha);
  return t('fechas.diaYMes', {
    dia: d.getDate(),
    mes: t(`fechas.mes${d.getMonth() + 1}` as ClaveTexto),
    anio: d.getFullYear(),
  });
}
