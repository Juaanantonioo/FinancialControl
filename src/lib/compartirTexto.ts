/**
 * Entrega un texto corto a la persona para que lo guarde (el código de
 * recuperación). En iOS, con la hoja de compartir del sistema.
 */
import { Share } from 'react-native';

export async function compartirTexto(_nombre: string, texto: string): Promise<void> {
  try {
    await Share.share({ message: texto });
  } catch {
    // Si la hoja no se abre, el código sigue en pantalla para copiarlo a mano.
  }
}
