/**
 * Valores hostiles para probar las entradas externas (bloque 4a, apartado 7
 * del encargo). Ninguno es un identificador, un mes, un día ni una sección.
 */
export const UUID_DE_EJEMPLO = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

export const HOSTILES: [string, unknown][] = [
  ['texto', 'hola'],
  ['10.000 caracteres', 'a'.repeat(10_000)],
  ['comillas y punto y coma', `' OR 1=1; DROP TABLE movimiento; --"`],
  ['saltos de línea', `${UUID_DE_EJEMPLO}\n${UUID_DE_EJEMPLO}`],
  ['retorno y nulo', `${UUID_DE_EJEMPLO}\r\u0000`],
  ['emojis', '💸🔥👨‍👩‍👧'],
  ['secuencias ../', '../../etc/passwd'],
  ['repetido dos veces', [UUID_DE_EJEMPLO, UUID_DE_EJEMPLO]],
  ['un número', 42],
  ['un objeto', { id: UUID_DE_EJEMPLO }],
  ['UUID con espacio', ` ${UUID_DE_EJEMPLO}`],
  ['UUID con sufijo', `${UUID_DE_EJEMPLO}x`],
];
