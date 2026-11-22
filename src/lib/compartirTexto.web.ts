/** En el navegador no hay hoja de compartir: el texto se descarga como fichero. */
import { compartirFichero } from './compartirFichero';

export async function compartirTexto(nombre: string, texto: string): Promise<void> {
  await compartirFichero(nombre, `${texto}\n`);
}
