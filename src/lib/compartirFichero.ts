/**
 * Entrega un texto a la persona como fichero, con la hoja de compartir del
 * sistema (la misma `Share` de React Native que ya usa el código de
 * recuperación).
 *
 * El fichero se escribe en la carpeta temporal de la app, que no entra en las
 * copias de seguridad, y se borra en cuanto la hoja se cierra, se haya
 * guardado o no.
 *
 * `expo-file-system` no es una dependencia nueva: llega con el paquete `expo`
 * y ya está enlazada en la app.
 */
import { File, Paths } from 'expo-file-system';
import { Platform, Share } from 'react-native';

export type ResultadoDeCompartir =
  /** La persona ha elegido un destino en la hoja (guardar en Archivos, AirDrop…). */
  | 'compartido'
  /** Ha cerrado la hoja sin elegir nada. */
  | 'descartado'
  | 'no_disponible';

export type CompartirFichero = (nombre: string, contenido: string) => Promise<ResultadoDeCompartir>;

export const compartirFichero: CompartirFichero = async (nombre, contenido) => {
  // La hoja de compartir con un fichero es de iOS. Android y la web no entran en este bloque.
  if (Platform.OS !== 'ios') return 'no_disponible';
  let fichero: File | null = null;
  try {
    fichero = new File(Paths.cache, nombre);
    fichero.create({ overwrite: true });
    fichero.write(contenido);
    const resultado = await Share.share({ url: fichero.uri });
    return resultado.action === Share.sharedAction ? 'compartido' : 'descartado';
  } catch {
    return 'no_disponible';
  } finally {
    try {
      if (fichero?.exists) fichero.delete();
    } catch {
      // Si no se puede borrar ahora, el sistema vacía la carpeta temporal cuando quiere.
    }
  }
};
