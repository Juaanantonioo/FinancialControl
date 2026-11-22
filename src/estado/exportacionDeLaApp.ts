/** El exportador de la app: une la exportación con la base real, el bloqueo y la hoja de compartir. */
import { crearExportador, type Exportador } from '@/exportacion/exportador';
import { t } from '@/i18n';
import { compartirFichero } from '@/lib/compartirFichero';

import { baseDeDatosDeLaApp } from './Datos';
import { formatoRegional } from './formato';
import { autenticarParaAccion } from './seguridad';

let exportador: Exportador | null = null;

export function exportacion(): Exportador {
  exportador ??= crearExportador({
    bd: baseDeDatosDeLaApp,
    compartir: compartirFichero,
    autenticar: () => autenticarParaAccion(t('exportar.motivo')),
    ahora: () => new Date(),
    formato: formatoRegional,
    textosDelCsv: () => ({
      columnas: {
        fecha: t('exportar.csvFecha'),
        tipo: t('exportar.csvTipo'),
        importe: t('exportar.csvImporte'),
        divisa: t('exportar.csvDivisa'),
        cuenta: t('exportar.csvCuenta'),
        cuentaDestino: t('exportar.csvCuentaDestino'),
        categoria: t('exportar.csvCategoria'),
        nombre: t('exportar.csvNombre'),
        comercio: t('exportar.csvComercio'),
        nota: t('exportar.csvNota'),
      },
      tipos: {
        gasto: t('tipoDeMovimiento.gasto'),
        ingreso: t('tipoDeMovimiento.ingreso'),
        transferencia: t('tipoDeMovimiento.transferencia'),
        ajuste: t('tipoDeMovimiento.ajuste'),
      },
    }),
  });
  return exportador;
}
