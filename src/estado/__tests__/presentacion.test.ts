import { altoDeBarra, tramosDeAnillo } from '@/componentes/Graficos';
import { OTRAS, SIN_CATEGORIA } from '@/dominio/resumen';
import { debeAnimar } from '@/estado/animacion';
import {
  aspectoDeCategoria,
  aspectoDeMovimiento,
  aspectoDeParte,
  iconoDe,
  indiceDeColor,
  inicial,
} from '@/estado/aspecto';
import { conSigno, importe } from '@/estado/formato';
import { INDICE_NEUTRO, PALETA_DE_CATEGORIAS } from '@/theme';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ decimalSeparator: ',', digitGroupingSeparator: '.', languageCode: 'es' }],
}));

const PALETA = PALETA_DE_CATEGORIAS.claro;

function categoria(parcial: Partial<Parameters<typeof aspectoDeCategoria>[0]> = {}) {
  return {
    id: 'c1',
    nombre: 'Comida',
    tipo: 'gasto' as const,
    icono: null,
    color: null,
    orden: 0,
    ...parcial,
  };
}

describe('aspecto de una categoría', () => {
  it('con color e icono nulos deriva un valor estable sin tocar la base de datos', () => {
    const a = aspectoDeCategoria(categoria(), PALETA);
    expect(a).toEqual({ color: PALETA[0], icono: '🍽️', esLetra: false });
    expect(aspectoDeCategoria(categoria(), PALETA)).toEqual(a);
  });

  it('respeta el color y el icono guardados si los hay', () => {
    const a = aspectoDeCategoria(categoria({ color: '#123ABC', icono: '🎸' }), PALETA);
    expect(a).toEqual({ color: '#123ABC', icono: '🎸', esLetra: false });
  });

  it('ignora un color guardado que no es un color', () => {
    expect(aspectoDeCategoria(categoria({ color: 'rojo', orden: 2 }), PALETA).color).toBe(
      PALETA[2],
    );
  });

  it('una categoría desconocida usa su inicial', () => {
    expect(iconoDe('Xilófonos')).toEqual({ icono: 'X', esLetra: true });
    expect(iconoDe('  ñandú')).toEqual({ icono: 'Ñ', esLetra: true });
    expect(inicial('')).toBe('·');
    expect(inicial('   ')).toBe('·');
  });

  it('reconoce el nombre sin acentos ni mayúsculas', () => {
    expect(iconoDe('NÓMINA').icono).toBe('💼');
    expect(iconoDe('Otros gastos').icono).toBe('📦');
  });

  it('categorías vecinas no comparten color y ninguna recibe el neutro', () => {
    const indices = Array.from({ length: 30 }, (_, orden) =>
      indiceDeColor({ tipo: 'gasto', orden }),
    );
    expect(new Set(indices.slice(0, INDICE_NEUTRO)).size).toBe(INDICE_NEUTRO);
    expect(indices).not.toContain(INDICE_NEUTRO);
    expect(indiceDeColor({ tipo: 'gasto', orden: -3 })).toBe(0);
    expect(indiceDeColor({ tipo: 'gasto', orden: 1.5 })).toBe(0);
    expect(indiceDeColor({ tipo: 'ingreso', orden: 0 })).not.toBe(
      indiceDeColor({ tipo: 'gasto', orden: 0 }),
    );
  });

  it('«Otras», «Sin categoría» y una categoría que ya no existe usan el neutro', () => {
    for (const clave of [OTRAS, SIN_CATEGORIA, 'borrada']) {
      const a = aspectoDeParte(clave, [categoria()], PALETA);
      expect(a.color).toBe(PALETA[INDICE_NEUTRO]);
      expect(a.esLetra).toBe(true);
    }
    expect(aspectoDeParte('c1', [categoria()], PALETA).icono).toBe('🍽️');
  });

  it('transferencias y ajustes tienen su propio distintivo', () => {
    const transferencia = aspectoDeMovimiento(
      { tipo: 'transferencia', categoriaId: null },
      [],
      PALETA,
    );
    expect(transferencia.icono).toBe('⇄');
    expect(aspectoDeMovimiento({ tipo: 'ajuste', categoriaId: null }, [], PALETA).icono).toBe('±');
    expect(
      aspectoDeMovimiento({ tipo: 'gasto', categoriaId: 'c1' }, [categoria()], PALETA).icono,
    ).toBe('🍽️');
    expect(aspectoDeMovimiento({ tipo: 'gasto', categoriaId: null }, [], PALETA).icono).toBe('?');
  });
});

describe('importes con signo', () => {
  it('usa el formato regional y añade siempre el signo', () => {
    // El número y el símbolo van unidos por un espacio de no separación (\u00a0).
    expect(importe(123456789, 'EUR')).toBe('1.234.567,89\u00a0€');
    expect(conSigno(123456789, 'EUR')).toBe('+1.234.567,89\u00a0€');
    expect(conSigno(-160000, 'EUR')).toBe('-1.600,00\u00a0€');
    expect(conSigno(0, 'EUR')).toBe('0,00\u00a0€');
    expect(importe(-250, 'EUR')).toBe('-2,50\u00a0€');
  });
});

describe('geometría de los gráficos', () => {
  it('los tramos del anillo cubren el perímetro en proporción', () => {
    const tramos = tramosDeAnillo([75, 25], 400, 4);
    expect(tramos).toEqual([
      { largo: 296, inicio: 0 },
      { largo: 96, inicio: 300 },
    ]);
  });

  it('un solo sector cierra el anillo sin hueco', () => {
    expect(tramosDeAnillo([10], 400, 4)).toEqual([{ largo: 400, inicio: 0 }]);
    expect(tramosDeAnillo([10, 0], 400, 4)[0].largo).toBe(400);
  });

  it('sin datos no dibuja tramos', () => {
    expect(tramosDeAnillo([0, 0], 400, 4)).toEqual([
      { largo: 0, inicio: 0 },
      { largo: 0, inicio: 0 },
    ]);
    expect(tramosDeAnillo([], 400, 4)).toEqual([]);
  });

  it('un sector diminuto sigue viéndose', () => {
    const [grande, pequeno] = tramosDeAnillo([100000, 1], 400, 4);
    expect(pequeno.largo).toBeGreaterThanOrEqual(1);
    expect(grande.largo).toBeLessThan(400);
  });

  it('la barra mayor ocupa todo el alto y un valor mínimo se ve', () => {
    expect(altoDeBarra(200, 200, 100)).toBe(100);
    expect(altoDeBarra(100, 200, 100)).toBe(50);
    expect(altoDeBarra(1, 123456789, 100)).toBe(3);
    expect(altoDeBarra(0, 200, 100)).toBe(0);
    expect(altoDeBarra(50, 0, 100)).toBe(0);
  });
});

describe('«Reducir movimiento»', () => {
  it('solo se anima cuando se sabe que el ajuste está apagado', () => {
    expect(debeAnimar(false)).toBe(true);
    expect(debeAnimar(true)).toBe(false);
    // Mientras no se conoce el ajuste, no se anima.
    expect(debeAnimar(null)).toBe(false);
  });
});
