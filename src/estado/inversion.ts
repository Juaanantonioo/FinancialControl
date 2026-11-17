/** Textos de ganancia o pérdida de una inversión, comunes a varias pantallas. */
import { importe, porcentaje } from '@/estado/formato';
import { t } from '@/i18n';

/**
 * «Ganas 150,00 € (+7,5 %)», «Pierdes 20,00 € (-10 %)» o «Ni ganas ni
 * pierdes». La palabra acompaña siempre al color.
 */
export function textoDeGanancia(
  ganancia: number,
  rentabilidad: number | null,
  divisa: string,
): { texto: string; color: 'positivo' | 'negativo' | 'textoSecundario' } {
  if (ganancia === 0) return { texto: t('inversion.sinCambio'), color: 'textoSecundario' };
  const datos = {
    etiqueta: ganancia > 0 ? t('inversion.ganas') : t('inversion.pierdes'),
    importe: importe(Math.abs(ganancia), divisa),
  };
  return {
    texto:
      rentabilidad === null
        ? t('inversion.resultado', datos)
        : t('inversion.resultadoConPorcentaje', {
            ...datos,
            porcentaje: porcentaje(rentabilidad),
          }),
    color: ganancia > 0 ? 'positivo' : 'negativo',
  };
}
