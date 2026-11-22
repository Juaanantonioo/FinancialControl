/** Cifrado de filas: formato en claro, relleno y datos autenticados. */
import { randomUUID } from 'node:crypto';

import { descifrarTexto, cifrarTexto, generarClaveDeDatos } from '@/cripto';
import * as cripto from '@/cripto';
import {
  BLOQUE_DE_RELLENO,
  cifrarFila,
  descifrarFila,
  ErrorDeFila,
  filaDeTexto,
  textoDeFila,
  usoDeFila,
} from '@/sincronizacion/filas';
import { compararMarcas, esMarca, marcaMayor, restarAMarca } from '@/sincronizacion/marcas';
import type { FilaLocal } from '@/sincronizacion/tablas';

const usuario = randomUUID();
const id = randomUUID();
const cuenta = (extra: Partial<FilaLocal> = {}): FilaLocal => ({
  id,
  nombre: 'Banco «principal» 🏦',
  tipo: 'banco',
  divisa: 'EUR',
  saldo_inicial: 215000,
  fecha_saldo_inicial: '2026-10-01',
  archivada: 0,
  orden: 0,
  creado_en: '2026-11-15T10:00:01.000Z',
  modificado_en: '2026-11-15T10:00:01.000Z',
  borrado_en: null,
  ...extra,
});
const motivoDe = async (promesa: Promise<unknown>) =>
  promesa.then(
    () => 'ninguno',
    (error) => (error instanceof ErrorDeFila ? error.motivo : 'otro error'),
  );

let clave: Uint8Array;
beforeAll(async () => {
  clave = await generarClaveDeDatos();
});

describe('la fila en claro', () => {
  it('lleva todas las columnas, la versión, y va rellenada a un múltiplo de 256 bytes', () => {
    const texto = textoDeFila('cuenta', cuenta());
    expect(new TextEncoder().encode(texto).length % BLOQUE_DE_RELLENO).toBe(0);
    expect(JSON.parse(texto)).toEqual({ v: 1, f: cuenta() });
    // Dos nombres de longitud parecida dan el mismo tamaño.
    const corto = textoDeFila('cuenta', cuenta({ nombre: 'A' }));
    const largo = textoDeFila('cuenta', cuenta({ nombre: 'Abcdefghijklmnñ' }));
    expect(new TextEncoder().encode(corto).length).toBe(new TextEncoder().encode(largo).length);
  });

  it('ignora columnas que no son de la tabla y exige las que sí', () => {
    const conExtra = textoDeFila('cuenta', { ...cuenta(), ajena: 'x' });
    expect(JSON.parse(conExtra).f).toEqual(cuenta());
    const { nombre: _nombre, ...sinNombre } = cuenta();
    expect(() => textoDeFila('cuenta', sinNombre)).toThrow(ErrorDeFila);
    expect(() => textoDeFila('tabla_inventada', cuenta())).toThrow(ErrorDeFila);
  });

  it('al leer rechaza lo que no es exactamente una fila de esa tabla', () => {
    const leer = (objeto: unknown) => {
      try {
        filaDeTexto('cuenta', id, JSON.stringify(objeto));
        return 'ninguno';
      } catch (error) {
        return (error as ErrorDeFila).motivo;
      }
    };
    expect(leer({ v: 1, f: cuenta() })).toBe('ninguno');
    expect(leer({ v: 2, f: cuenta() })).toBe('no_aplicable');
    expect(leer({ v: 1, f: { ...cuenta(), nueva: 1 } })).toBe('no_aplicable');
    const { orden: _orden, ...sinOrden } = cuenta();
    expect(leer({ v: 1, f: sinOrden })).toBe('no_aplicable');
    expect(leer({ v: 1, f: cuenta({ id: randomUUID() }) })).toBe('ilegible');
    expect(leer({ v: 1, f: cuenta({ archivada: true as never }) })).toBe('ilegible');
    expect(leer({ v: 1, f: cuenta({ saldo_inicial: 1.5 }) })).toBe('ilegible');
    expect(leer({ v: 1, f: cuenta({ nombre: { $ne: 1 } as never }) })).toBe('ilegible');
    expect(leer({ f: cuenta() })).toBe('ilegible');
    expect(leer([1, 2])).toBe('ilegible');
    expect(leer(null)).toBe('ilegible');
    expect(() => filaDeTexto('cuenta', id, 'no es json')).toThrow(ErrorDeFila);
  });
});

describe('el sobre de una fila', () => {
  it('va y vuelve idéntica, con acentos y emojis', async () => {
    const sobre = await cifrarFila(clave, usuario, 'cuenta', cuenta());
    expect(sobre).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await descifrarFila(clave, usuario, 'cuenta', id, sobre)).toEqual(cuenta());
  });

  it('cada cifrado usa un nonce nuevo: la misma fila da sobres distintos', async () => {
    const sobres = new Set<string>();
    for (let i = 0; i < 20; i += 1)
      sobres.add(await cifrarFila(clave, usuario, 'cuenta', cuenta()));
    expect(sobres.size).toBe(20);
    // Los 24 bytes de nonce (32 caracteres tras el byte de versión) tampoco se repiten.
    expect(new Set([...sobres].map((s) => s.slice(1, 33))).size).toBe(20);
  });

  it('los datos autenticados llevan versión, usuario, tabla e id, como texto', async () => {
    expect(usoDeFila(usuario, 'cuenta', id)).toBe(`fila/${usuario}/cuenta/${id}`);
    const espia = jest.spyOn(cripto, 'cifrarTexto');
    await cifrarFila(clave, usuario, 'cuenta', cuenta());
    expect(espia.mock.calls[0][2]).toBe(`fila/${usuario}/cuenta/${id}`);
    espia.mockRestore();
    // `cifrarTexto` antepone la versión del formato: FC1|fila/…
    const sobre = await cifrarTexto(clave, 'hola', `fila/${usuario}/cuenta/${id}`);
    expect(await descifrarTexto(clave, sobre, `fila/${usuario}/cuenta/${id}`)).toBe('hola');
  });

  it('no se abre para otro usuario, otra tabla, otro id, otra clave ni con un bit cambiado', async () => {
    const sobre = await cifrarFila(clave, usuario, 'cuenta', cuenta());
    const abrir = (c: Uint8Array, u: string, t: string, i: string, s: string) =>
      motivoDe(descifrarFila(c, u, t, i, s));
    expect(await abrir(clave, usuario, 'cuenta', id, sobre)).toBe('ninguno');
    expect(await abrir(clave, randomUUID(), 'cuenta', id, sobre)).toBe('ilegible');
    expect(await abrir(clave, usuario, 'categoria', id, sobre)).toBe('ilegible');
    expect(await abrir(clave, usuario, 'cuenta', randomUUID(), sobre)).toBe('ilegible');
    expect(await abrir(await generarClaveDeDatos(), usuario, 'cuenta', id, sobre)).toBe('ilegible');
    for (const posicion of [0, 5, 40, sobre.length - 2]) {
      const letra = sobre[posicion] === 'A' ? 'B' : 'A';
      const tocado = sobre.slice(0, posicion) + letra + sobre.slice(posicion + 1);
      expect(await abrir(clave, usuario, 'cuenta', id, tocado)).toBe('ilegible');
    }
    expect(await abrir(clave, usuario, 'cuenta', id, sobre.slice(0, -4))).toBe('ilegible');
    expect(await abrir(clave, usuario, 'cuenta', id, '')).toBe('ilegible');
  });

  it('no cifra para un usuario, una tabla o un id que no tienen la forma debida', async () => {
    expect(await motivoDe(cifrarFila(clave, 'no-es-uuid', 'cuenta', cuenta()))).toBe(
      'no_aplicable',
    );
    expect(await motivoDe(cifrarFila(clave, usuario, 'aviso_emitido', cuenta()))).toBe(
      'no_aplicable',
    );
    expect(await motivoDe(cifrarFila(clave, usuario, 'cuenta', cuenta({ id: 'x/../y' })))).toBe(
      'no_aplicable',
    );
  });

  it('el error no dice nada de la fila ni de la clave', async () => {
    const error = await descifrarFila(clave, usuario, 'cuenta', id, 'AAAA').catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeFila);
    expect(error.message).toBe('La fila no se puede usar.');
    expect(error.cause).toBeUndefined();
  });
});

describe('marcas de tiempo del servidor', () => {
  it('se comparan con sus microsegundos, tengan los decimales que tengan', () => {
    const a = '2026-11-22T10:15:30.123456+00:00';
    expect(compararMarcas(a, a)).toBe(0);
    expect(compararMarcas(a, '2026-11-22T10:15:30.123457+00:00')).toBeLessThan(0);
    expect(compararMarcas('2026-11-22T10:15:30.1+00:00', '2026-11-22T10:15:30.100000+00:00')).toBe(
      0,
    );
    expect(
      compararMarcas('2026-11-22T10:15:30+00:00', '2026-11-22T10:15:30.000001+00:00'),
    ).toBeLessThan(0);
    expect(
      compararMarcas('2026-11-22T10:15:31+00:00', '2026-11-22T10:15:30.999999+00:00'),
    ).toBeGreaterThan(0);
    // La misma hora escrita en otra zona.
    expect(compararMarcas('2026-11-22T11:15:30.5+01:00', '2026-11-22T10:15:30.5Z')).toBe(0);
    expect(compararMarcas('2026-11-22 10:15:30.5+00', '2026-11-22T10:15:30.5Z')).toBe(0);
  });

  it('reconoce lo que no es una marca', () => {
    expect(esMarca('2026-11-22T10:15:30.123456+00:00')).toBe(true);
    for (const mala of [
      '',
      'ayer',
      '2026-11-22',
      '2026-11-22T10:15:30',
      '2026-13-45T10:15:30Z',
      5,
    ]) {
      expect(esMarca(mala)).toBe(false);
    }
    expect(esMarca('2026-11-22T10:15:30Z",id.gt.0')).toBe(false);
  });

  it('la mayor de dos, y restar una ventana', () => {
    const a = '2026-11-22T10:15:30.000100+00:00';
    const b = '2026-11-22T10:15:30.000200+00:00';
    expect(marcaMayor(a, b)).toBe(b);
    expect(marcaMayor(b, a)).toBe(b);
    expect(marcaMayor(null, a)).toBe(a);
    expect(marcaMayor(null, null)).toBeNull();
    expect(restarAMarca('2026-11-22T10:15:30.123999+00:00', 0)).toBe('2026-11-22T10:15:30.123Z');
    expect(restarAMarca('2026-11-22T10:15:30.123999+00:00', 5 * 60_000)).toBe(
      '2026-11-22T10:10:30.123Z',
    );
    expect(restarAMarca('nada', 1000)).toBeNull();
  });
});
