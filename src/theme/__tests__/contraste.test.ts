import { COLORES, INDICE_NEUTRO, PALETA_DE_CATEGORIAS, type Modo } from '..';
import { contraste, luminancia } from '../contraste';

const MODOS: Modo[] = ['claro', 'oscuro'];

describe('cálculo de contraste', () => {
  it('negro sobre blanco da 21 y un color consigo mismo da 1', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contraste('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contraste('#4F46E5', '#4F46E5')).toBeCloseTo(1, 5);
  });

  it('coincide con un valor de referencia conocido (#767676 sobre blanco, 4,54)', () => {
    expect(contraste('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });

  it('rechaza un color mal escrito', () => {
    expect(() => luminancia('azul')).toThrow();
    expect(() => luminancia('#FFF')).toThrow();
  });
});

describe.each(MODOS)('paleta de categorías en modo %s', (modo) => {
  const c = COLORES[modo];
  const paleta = PALETA_DE_CATEGORIAS[modo];

  it('tiene entre 10 y 12 colores, todos distintos', () => {
    expect(paleta.length).toBeGreaterThanOrEqual(10);
    expect(paleta.length).toBeLessThanOrEqual(12);
    expect(new Set(paleta).size).toBe(paleta.length);
    expect(INDICE_NEUTRO).toBeLessThan(paleta.length);
  });

  it.each(paleta.map((color, i) => [i, color]))(
    'el color %i (%s) cumple 3:1 sobre la superficie',
    (_i, color) => {
      expect(contraste(color as string, c.superficie)).toBeGreaterThanOrEqual(3);
    },
  );

  it('el blanco o el negro del icono cumple 3:1 sobre cada color', () => {
    for (const color of paleta) {
      expect(contraste(c.sobreAcento, color)).toBeGreaterThanOrEqual(modo === 'claro' ? 3 : 4.5);
    }
  });
});

describe.each(MODOS)('colores semánticos en modo %s', (modo) => {
  const c = COLORES[modo];

  // Texto normal: 4,5:1 (WCAG 1.4.3).
  const TEXTO: [string, string, string][] = [
    ['texto sobre fondo', c.texto, c.fondo],
    ['texto sobre superficie', c.texto, c.superficie],
    ['texto sobre superficie suave', c.texto, c.superficieSuave],
    ['texto secundario sobre fondo', c.textoSecundario, c.fondo],
    ['texto secundario sobre superficie', c.textoSecundario, c.superficie],
    ['texto secundario sobre superficie suave', c.textoSecundario, c.superficieSuave],
    ['acento sobre fondo', c.acento, c.fondo],
    ['acento sobre superficie', c.acento, c.superficie],
    ['acento sobre acento suave', c.acento, c.acentoSuave],
    ['texto sobre acento', c.sobreAcento, c.acento],
    ['positivo sobre fondo', c.positivo, c.fondo],
    ['positivo sobre superficie', c.positivo, c.superficie],
    ['positivo sobre positivo suave', c.positivo, c.positivoSuave],
    ['negativo sobre fondo', c.negativo, c.fondo],
    ['negativo sobre superficie', c.negativo, c.superficie],
    ['negativo sobre negativo suave', c.negativo, c.negativoSuave],
    ['aviso sobre superficie', c.aviso, c.superficie],
    ['aviso sobre fondo', c.aviso, c.fondo],
    ['texto sobre el inicio del degradado', c.sobreDegradado, c.degradadoInicio],
    ['texto sobre el final del degradado', c.sobreDegradado, c.degradadoFin],
    [
      'texto secundario sobre el inicio del degradado',
      c.sobreDegradadoSecundario,
      c.degradadoInicio,
    ],
    ['texto secundario sobre el final del degradado', c.sobreDegradadoSecundario, c.degradadoFin],
    ['aviso flotante: fondo sobre texto', c.fondo, c.texto],
  ];

  it.each(TEXTO)('%s cumple 4,5:1', (_nombre, delante, detras) => {
    expect(contraste(delante, detras)).toBeGreaterThanOrEqual(4.5);
  });
});
