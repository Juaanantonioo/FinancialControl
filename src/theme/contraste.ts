/**
 * Contraste entre dos colores según WCAG 2.x. Se usa en las pruebas para
 * validar la paleta con un cálculo y no a ojo.
 */

/** Luminancia relativa de un color "#RRGGBB" (0 negro, 1 blanco). */
export function luminancia(hex: string): number {
  const partes = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!partes) throw new Error(`Color no válido: ${hex}`);
  const [r, g, b] = [partes[1], partes[2], partes[3]].map((par) => {
    const canal = parseInt(par, 16) / 255;
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste entre dos colores, de 1 (iguales) a 21 (negro sobre blanco). */
export function contraste(a: string, b: string): number {
  const [clara, oscura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (clara + 0.05) / (oscura + 0.05);
}
