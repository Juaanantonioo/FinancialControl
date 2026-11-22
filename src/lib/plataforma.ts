/**
 * En qué plataforma corre la app. La versión web (bloque 5) usa el mismo
 * código que iOS; lo poco que cambia se decide con esta constante o con
 * ficheros `.web.ts`. Tabla completa: docs/seguridad/diseno-web.md, apartado 9.
 */
import { Platform } from 'react-native';

export const ES_WEB = Platform.OS === 'web';
