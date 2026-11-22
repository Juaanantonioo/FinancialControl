/**
 * Entrega un texto a la persona como fichero, en el navegador: lo DESCARGA.
 * No hay hoja de compartir. El fichero se crea en memoria, se ofrece con un
 * enlace de descarga y la referencia se libera enseguida; el sitio no lo
 * guarda en ningún almacén del navegador.
 *
 * Un navegador no dice si la persona llegó a guardar el fichero o canceló el
 * diálogo, así que el resultado es «compartido» en cuanto la descarga se lanza.
 */
import type { CompartirFichero } from './compartirFichero';

export type { CompartirFichero, ResultadoDeCompartir } from './compartirFichero';

const TIPOS: Record<string, string> = {
  json: 'application/json;charset=utf-8',
  csv: 'text/csv;charset=utf-8',
};

export const compartirFichero: CompartirFichero = async (nombre, contenido) => {
  try {
    const extension = nombre.split('.').pop() ?? '';
    const blob = new Blob([contenido], { type: TIPOS[extension] ?? 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.rel = 'noopener';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    // Se libera después de que el navegador haya empezado la descarga.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return 'compartido';
  } catch {
    return 'no_disponible';
  }
};
