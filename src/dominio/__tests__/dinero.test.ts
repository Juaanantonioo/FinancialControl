import {
  analizarImporte,
  centimosDelTeclado,
  dinero,
  ErrorDeDinero,
  formatearDinero,
  formatearNumero,
  mostrarTeclado,
  pulsarTecla,
  restar,
  sumar,
  tecladoDesdeCentimos,
  type FormatoRegional,
  type TeclaDeImporte,
} from '@/dominio/dinero';

const FORMATO_EN: FormatoRegional = {
  separadorDecimal: '.',
  separadorDeMiles: ',',
  simboloDelante: true,
};

describe('suma de dinero', () => {
  it('0,10 + 0,20 da exactamente 0,30', () => {
    const total = sumar(dinero(10, 'EUR'), dinero(20, 'EUR'));
    expect(total).toEqual({ centimos: 30, divisa: 'EUR' });
    expect(formatearDinero(total)).toBe('0,30 €');
    // Lo que pasaría con decimales en coma flotante:
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it('suma importes con miles', () => {
    const total = sumar(dinero(123456, 'EUR'), dinero(876544, 'EUR'));
    expect(total.centimos).toBe(1000000);
    expect(formatearDinero(total)).toBe('10.000,00 €');
  });

  it('suma cero y negativos', () => {
    expect(sumar(dinero(0, 'EUR'), dinero(0, 'EUR')).centimos).toBe(0);
    expect(sumar(dinero(500, 'EUR'), dinero(-700, 'EUR')).centimos).toBe(-200);
    expect(restar(dinero(500, 'EUR'), dinero(700, 'EUR')).centimos).toBe(-200);
  });

  it('rechaza sumar divisas distintas', () => {
    expect(() => sumar(dinero(1, 'EUR'), dinero(1, 'USD'))).toThrow(ErrorDeDinero);
  });

  it('rechaza céntimos que no son enteros', () => {
    expect(() => dinero(0.5, 'EUR')).toThrow(ErrorDeDinero);
    expect(() => dinero(NaN, 'EUR')).toThrow(ErrorDeDinero);
    expect(() => dinero(Infinity, 'EUR')).toThrow(ErrorDeDinero);
  });
});

describe('formato de dinero', () => {
  it.each([
    [0, '0,00 €'],
    [5, '0,05 €'],
    [30, '0,30 €'],
    [2340, '23,40 €'],
    [100000, '1.000,00 €'],
    [123456, '1.234,56 €'],
    [845000, '8.450,00 €'],
    [123456789, '1.234.567,89 €'],
    [-2340, '-23,40 €'],
    [-5, '-0,05 €'],
  ])('%i céntimos se escribe %s en España', (centimos, esperado) => {
    expect(formatearDinero(dinero(centimos, 'EUR'))).toBe(esperado);
  });

  it('respeta la región: punto decimal y símbolo delante', () => {
    expect(formatearDinero(dinero(123456, 'USD'), FORMATO_EN)).toBe('$1,234.56');
    expect(formatearDinero(dinero(-123456, 'USD'), FORMATO_EN)).toBe('-$1,234.56');
  });

  it('usa el código si no conoce el símbolo de la divisa', () => {
    expect(formatearDinero(dinero(100, 'CHF'))).toBe('1,00 CHF');
  });

  it('formatea solo el número', () => {
    expect(formatearNumero(123456)).toBe('1.234,56');
  });
});

describe('análisis de un importe escrito', () => {
  it.each([
    ['23,40', 2340],
    ['23.40', 2340],
    ['23,4', 2340],
    ['23', 2300],
    ['0', 0],
    ['0,00', 0],
    ['0,10', 10],
    ['0,05', 5],
    [',5', 50],
    ['5,', 500],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1.234', 123400],
    ['1,234', 123400],
    ['12,345', 1234500],
    ['1.234.567', 123456700],
    ['1.234.567,89', 123456789],
    ['1234,56', 123456],
    ['1234567', 123456700],
    [' 23,40 € ', 2340],
    ['€23.40', 2340],
    ['-12,30', -1230],
    ['−12,30', -1230],
    ['+7', 700],
    ['-0', 0],
  ])('"%s" son %i céntimos', (texto, esperado) => {
    expect(analizarImporte(texto)).toBe(esperado);
  });

  it.each([
    [''],
    ['   '],
    ['abc'],
    ['12a'],
    ['1,2,3'],
    ['1.2.3'],
    ['0,123'],
    ['1,23,45'],
    ['1.23,456'],
    ['12.34,5'],
    ['1,234,56'],
    [','],
    ['.'],
    ['-'],
    ['--5'],
    ['5-'],
    ['1e3'],
    ['999999999999999999'],
    ['😀'],
  ])('"%s" no es un importe', (texto) => {
    expect(analizarImporte(texto)).toBeNull();
  });
});

describe('teclado de importe', () => {
  function pulsar(...teclas: TeclaDeImporte[]): string {
    return teclas.reduce((texto, tecla) => pulsarTecla(texto, tecla), '');
  }

  it('compone 23,40', () => {
    const texto = pulsar('2', '3', 'decimal', '4', '0');
    expect(texto).toBe('23,40');
    expect(centimosDelTeclado(texto)).toBe(2340);
  });

  it('no admite más de dos decimales ni dos separadores', () => {
    expect(pulsar('1', 'decimal', '2', '3', '4')).toBe('1,23');
    expect(pulsar('1', 'decimal', 'decimal', '5')).toBe('1,5');
  });

  it('no acumula ceros a la izquierda', () => {
    expect(pulsar('0', '0', '5')).toBe('5');
    expect(pulsar('0', 'decimal', '5')).toBe('0,5');
    expect(pulsar('decimal', '5')).toBe('0,5');
  });

  it('borra de derecha a izquierda y aguanta borrar en vacío', () => {
    expect(pulsar('1', '2', 'borrar')).toBe('1');
    expect(pulsar('borrar', 'borrar')).toBe('');
    expect(centimosDelTeclado('')).toBe(0);
  });

  it('limita la parte entera a nueve cifras', () => {
    const texto = pulsar('1', '2', '3', '4', '5', '6', '7', '8', '9', '9', '9');
    expect(texto).toBe('123456789');
  });

  it('un importe a medias cuenta por lo que lleva escrito', () => {
    expect(centimosDelTeclado('12,')).toBe(1200);
    expect(centimosDelTeclado('0,')).toBe(0);
  });

  it('muestra miles y separador regional mientras se escribe', () => {
    expect(mostrarTeclado('')).toBe('0');
    expect(mostrarTeclado('1234,5')).toBe('1.234,5');
    expect(mostrarTeclado('12,')).toBe('12,');
    expect(mostrarTeclado('1234,5', FORMATO_EN)).toBe('1,234.5');
  });

  it('va y vuelve entre céntimos y texto', () => {
    expect(tecladoDesdeCentimos(2340)).toBe('23,40');
    expect(tecladoDesdeCentimos(5000)).toBe('50');
    expect(tecladoDesdeCentimos(5)).toBe('0,05');
    for (const c of [0, 1, 99, 100, 2340, 123456]) {
      expect(centimosDelTeclado(tecladoDesdeCentimos(c))).toBe(c);
    }
  });
});
