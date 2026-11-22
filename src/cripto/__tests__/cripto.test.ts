/**
 * Módulo criptográfico: vectores conocidos, idas y vueltas, y fallos.
 *
 * Los vectores de `vectores.json` los calcula `scripts/vectores-de-cripto.cjs`
 * llamando a libsodium directamente, sin pasar por este módulo. Todos los
 * datos son de ejemplo.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// La biblioteca se usa por su exportación por defecto, que es la que queda lista tras `ready`.
/* eslint-disable import/no-named-as-default-member */
import sodio from 'libsodium-wrappers-sumo';

import {
  borrar,
  cifrar,
  claveATexto,
  claveDeTexto,
  derivarClaveMaestra,
  derivarClaves,
  descifrar,
  desenvolverConCodigo,
  desenvolverConContrasena,
  envolverConCodigo,
  envolverConContrasena,
  ErrorDeCripto,
  generarClaveDeDatos,
  generarCodigoDeRecuperacion,
  GRUPOS_DEL_CODIGO,
  gruposDelCodigo,
  leerCodigoDeRecuperacion,
  normalizarCorreo,
  salDelCorreo,
  subclavesDe,
} from '@/cripto';
import { aBase32, ALFABETO, deBase32 } from '@/cripto/base32';
import {
  autocomprobarCripto,
  medirDerivacion,
  olvidarAutocomprobacion,
} from '@/cripto/autocomprobacion';
import {
  ARGON2ID,
  SUBCLAVE_DE_AUTENTICACION,
  SUBCLAVE_DE_ENVOLTURA,
  SUBCLAVE_DE_RECUPERACION,
} from '@/cripto/parametros';

import v from '../vectores.json';

const hex = (bytes: Uint8Array) => sodio.to_hex(bytes);
const deHex = (texto: string) => sodio.from_hex(texto);
const utf8 = (texto: string) => new TextEncoder().encode(texto);
const CLAVE_DE_DATOS = () => deHex(v.entrada.clave_de_datos_hex);
const CORREO = v.entrada.correo_normalizado;
const CONTRASENA = v.entrada.contrasena;

/** Espera un fallo del módulo y comprueba que no dice nada sobre el motivo. */
async function fallaSinMotivo(promesa: Promise<unknown>): Promise<string> {
  let error: unknown;
  let devuelto: unknown;
  try {
    devuelto = await promesa;
  } catch (e) {
    error = e;
  }
  expect(devuelto).toBeUndefined();
  expect(error).toBeInstanceOf(ErrorDeCripto);
  const e = error as ErrorDeCripto;
  expect(Object.keys(e)).toEqual(['name']);
  expect((e as { cause?: unknown }).cause).toBeUndefined();
  return e.message;
}

beforeAll(async () => {
  await sodio.ready;
});

describe('vectores conocidos', () => {
  it('los parámetros del módulo son los de los vectores', () => {
    expect(ARGON2ID.pasadas).toBe(v.entrada.argon2id_pasadas);
    expect(ARGON2ID.memoria).toBe(v.entrada.argon2id_memoria_bytes);
  });

  it('la sal sale del correo normalizado', async () => {
    expect(hex(await salDelCorreo(CORREO))).toBe(v.salida.sal_hex);
  });

  it('la misma contraseña y el mismo correo dan siempre la misma clave maestra', async () => {
    expect(hex(await derivarClaveMaestra(CONTRASENA, CORREO))).toBe(v.salida.clave_maestra_hex);
    expect(hex(await derivarClaveMaestra(CONTRASENA, CORREO))).toBe(v.salida.clave_maestra_hex);
  });

  it('las subclaves son las del vector', async () => {
    const claves = await subclavesDe(deHex(v.salida.clave_maestra_hex));
    expect(claves.autenticacion).toBe(v.salida.subclave_de_autenticacion_base64url);
    expect(hex(claves.envoltura)).toBe(v.salida.subclave_de_envoltura_hex);
    const directas = await derivarClaves(CONTRASENA, CORREO);
    expect(directas.autenticacion).toBe(v.salida.subclave_de_autenticacion_base64url);
    expect(hex(directas.envoltura)).toBe(v.salida.subclave_de_envoltura_hex);
  });

  it('abre los sobres del vector, con contraseña y con código', async () => {
    const envoltura = deHex(v.salida.subclave_de_envoltura_hex);
    expect(hex(await desenvolverConContrasena(v.salida.sobre_por_contrasena, envoltura))).toBe(
      v.entrada.clave_de_datos_hex,
    );
    expect(
      hex(
        await desenvolverConCodigo(
          v.salida.sobre_por_recuperacion,
          v.salida.codigo_de_recuperacion,
        ),
      ),
    ).toBe(v.entrada.clave_de_datos_hex);
  });

  it('el código del vector es el secreto y su control en base32', async () => {
    const completo = deBase32(v.salida.codigo_de_recuperacion)!;
    expect(hex(completo.subarray(0, 32))).toBe(v.entrada.secreto_de_recuperacion_hex);
    expect(hex(completo.subarray(32))).toBe(v.salida.control_del_codigo_hex);
    expect(await leerCodigoDeRecuperacion(v.salida.codigo_de_recuperacion)).toBe(
      v.salida.codigo_de_recuperacion,
    );
  });
});

describe('correo y contraseña', () => {
  it.each([
    ['mayúsculas', 'ANA.EJEMPLO@EXAMPLE.COM'],
    ['espacios', '   ana.ejemplo@example.com\n'],
    ['mezcla', v.entrada.correo_escrito],
    ['ancho completo (NFKC)', 'ａｎａ.ejemplo@example.com'],
  ])('el mismo correo con %s da la misma sal', async (_n, escrito) => {
    expect(normalizarCorreo(escrito)).toBe(CORREO);
    expect(hex(await salDelCorreo(escrito))).toBe(v.salida.sal_hex);
  });

  it('otro correo da otra sal y, con la misma contraseña, otras claves', async () => {
    expect(hex(await salDelCorreo('otra@example.com'))).not.toBe(v.salida.sal_hex);
    const otras = await derivarClaves(CONTRASENA, 'otra@example.com');
    expect(otras.autenticacion).not.toBe(v.salida.subclave_de_autenticacion_base64url);
  });

  it('la contraseña con el acento compuesto o descompuesto da la misma clave', async () => {
    const descompuesta = CONTRASENA.normalize('NFD');
    expect(descompuesta).not.toBe(CONTRASENA);
    expect(hex(await derivarClaveMaestra(descompuesta, CORREO))).toBe(v.salida.clave_maestra_hex);
  });

  it('la contraseña distingue mayúsculas y espacios', async () => {
    for (const otra of [CONTRASENA.toUpperCase(), `${CONTRASENA} `, ` ${CONTRASENA}`]) {
      expect(hex(await derivarClaveMaestra(otra, CORREO))).not.toBe(v.salida.clave_maestra_hex);
    }
  });

  it('la subclave de autenticación es distinta de la de envoltura, de la maestra y de la contraseña', async () => {
    const auth = v.salida.subclave_de_autenticacion_hex;
    expect(auth).not.toBe(v.salida.subclave_de_envoltura_hex);
    expect(auth).not.toBe(v.salida.clave_maestra_hex);
    expect(v.salida.subclave_de_envoltura_hex).not.toBe(v.salida.clave_maestra_hex);
    const { autenticacion } = await derivarClaves(CONTRASENA, CORREO);
    expect(autenticacion).not.toBe(CONTRASENA);
    expect(autenticacion).not.toContain(CONTRASENA);
    expect(autenticacion).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hex(utf8(CONTRASENA))).not.toContain(auth);
  });
});

describe('sobre cifrado', () => {
  const clave = () => deHex(v.salida.subclave_de_envoltura_hex);
  const USO = 'fila/movimiento/3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';

  it('ida y vuelta de un contenido', async () => {
    const contenido = utf8('{"importe":1250,"nombre":"Compra de ejemplo 💸"}');
    const sobre = await cifrar(clave(), contenido, USO);
    expect(sobre).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hex(await descifrar(clave(), sobre, USO))).toBe(hex(contenido));
  });

  it('formato: versión 1, 24 bytes de nonce, contenido y 16 de etiqueta', async () => {
    const contenido = utf8('hola');
    const bytes = sodio.from_base64(await cifrar(clave(), contenido, USO));
    expect(bytes[0]).toBe(1);
    expect(bytes.length).toBe(1 + 24 + contenido.length + 16);
  });

  it('un contenido vacío también va y vuelve', async () => {
    const sobre = await cifrar(clave(), new Uint8Array(0), USO);
    expect((await descifrar(clave(), sobre, USO)).length).toBe(0);
  });

  it('dos cifrados del mismo contenido no coinciden, ni en el nonce ni en el resto', async () => {
    const contenido = utf8('mismo contenido');
    const sobres = new Set<string>();
    const nonces = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const sobre = await cifrar(clave(), contenido, USO);
      sobres.add(sobre);
      nonces.add(hex(sodio.from_base64(sobre).subarray(1, 25)));
    }
    expect(sobres.size).toBe(50);
    expect(nonces.size).toBe(50);
  });

  it('un sobre no se abre para otro uso', async () => {
    const sobre = await cifrar(clave(), utf8('x'), USO);
    await fallaSinMotivo(
      descifrar(clave(), sobre, 'fila/cuenta/3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b'),
    );
    await fallaSinMotivo(
      descifrar(clave(), v.salida.sobre_por_contrasena, 'clave-de-datos/recuperacion'),
    );
  });

  it('todos los fallos se ven igual desde fuera', async () => {
    const bueno = v.salida.sobre_por_contrasena;
    const bytes = sodio.from_base64(bueno);
    const conBit = (posicion: number) => {
      const copia = Uint8Array.from(bytes);
      copia[posicion] ^= 0x01;
      return sodio.to_base64(copia);
    };
    const otraVersion = Uint8Array.from(bytes);
    otraVersion[0] = 2;
    const mensajes = new Set<string>();
    const casos: [string, Promise<unknown>][] = [
      ['clave equivocada', desenvolverConContrasena(bueno, CLAVE_DE_DATOS())],
      ['clave de otro tamaño', desenvolverConContrasena(bueno, new Uint8Array(16))],
      ['un bit en la versión', desenvolverConContrasena(conBit(0), clave())],
      ['un bit en el nonce', desenvolverConContrasena(conBit(1), clave())],
      ['un bit al final del nonce', desenvolverConContrasena(conBit(24), clave())],
      ['un bit en el contenido', desenvolverConContrasena(conBit(25), clave())],
      ['un bit en la etiqueta', desenvolverConContrasena(conBit(bytes.length - 1), clave())],
      ['versión desconocida', desenvolverConContrasena(sodio.to_base64(otraVersion), clave())],
      [
        'versión cero',
        desenvolverConContrasena(
          sodio.to_base64(Uint8Array.from([0, ...bytes.subarray(1)])),
          clave(),
        ),
      ],
      [
        'truncado un byte',
        desenvolverConContrasena(sodio.to_base64(bytes.subarray(0, bytes.length - 1)), clave()),
      ],
      [
        'truncado a la cabecera',
        desenvolverConContrasena(sodio.to_base64(bytes.subarray(0, 25)), clave()),
      ],
      ['solo la versión', desenvolverConContrasena('AQ', clave())],
      ['vacío', desenvolverConContrasena('', clave())],
      ['no es base64', desenvolverConContrasena('¡esto no es un sobre!', clave())],
      ['base64 con relleno', desenvolverConContrasena(`${bueno}==`, clave())],
      [
        'con un byte de más',
        desenvolverConContrasena(sodio.to_base64(Uint8Array.from([...bytes, 0])), clave()),
      ],
      ['no es texto', desenvolverConContrasena(null as never, clave())],
      ['sobre de otro uso', desenvolverConContrasena(v.salida.sobre_por_recuperacion, clave())],
      [
        'código equivocado',
        desenvolverConCodigo(
          v.salida.sobre_por_recuperacion,
          'M2GT-58X4-MPKA-FA59-NANT-SBDE-NYRB-3CNK-PJTV-DDXR-Q6XB-QF5X-QTZZ-3Z84',
        ),
      ],
      [
        'código con otra clave',
        (async () =>
          desenvolverConCodigo(
            v.salida.sobre_por_recuperacion,
            await generarCodigoDeRecuperacion(),
          ))(),
      ],
      ['código que no es un código', desenvolverConCodigo(v.salida.sobre_por_recuperacion, 'hola')],
      ['uso con caracteres raros', cifrar(clave(), utf8('x'), 'uso con espacios')],
      ['uso vacío', cifrar(clave(), utf8('x'), '')],
      ['cifrar con clave corta', cifrar(new Uint8Array(8), utf8('x'), USO)],
      ['envolver algo que no es una clave', envolverConContrasena(new Uint8Array(31), clave())],
    ];
    for (const [nombre, promesa] of casos) {
      const mensaje = await fallaSinMotivo(promesa);
      mensajes.add(mensaje);
      expect([nombre, mensajes.size]).toEqual([nombre, 1]);
    }
    const [unico] = mensajes;
    // El mensaje no lleva ni datos ni motivo.
    expect(unico).not.toMatch(/clave|etiqueta|nonce|versi|base64|\d/i);
  });

  it('cada byte del sobre está protegido: cambiar cualquiera lo invalida', async () => {
    const bytes = sodio.from_base64(v.salida.sobre_por_contrasena);
    for (let i = 0; i < bytes.length; i++) {
      const copia = Uint8Array.from(bytes);
      copia[i] ^= 0x80;
      await fallaSinMotivo(desenvolverConContrasena(sodio.to_base64(copia), clave()));
    }
  });
});

describe('clave de datos y su envoltura', () => {
  it('la clave de datos tiene 256 bits y cada vez es distinta', async () => {
    const claves = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const clave = await generarClaveDeDatos();
      expect(clave.length).toBe(32);
      claves.add(hex(clave));
    }
    expect(claves.size).toBe(100);
  });

  it('ida y vuelta con la contraseña', async () => {
    const datos = await generarClaveDeDatos();
    const { envoltura } = await derivarClaves(CONTRASENA, CORREO);
    const sobre = await envolverConContrasena(datos, envoltura);
    expect(hex(await desenvolverConContrasena(sobre, envoltura))).toBe(hex(datos));
  });

  it('ida y vuelta con el código de recuperación', async () => {
    const datos = await generarClaveDeDatos();
    const codigo = await generarCodigoDeRecuperacion();
    const sobre = await envolverConCodigo(datos, codigo);
    expect(hex(await desenvolverConCodigo(sobre, codigo))).toBe(hex(datos));
    // También escrito a mano, en minúsculas y sin guiones.
    const aMano = codigo.toLowerCase().replace(/-/g, ' ');
    expect(hex(await desenvolverConCodigo(sobre, aMano))).toBe(hex(datos));
  });

  it('con otra contraseña no se abre', async () => {
    const datos = await generarClaveDeDatos();
    const buena = await derivarClaves(CONTRASENA, CORREO);
    const mala = await derivarClaves(`${CONTRASENA}!`, CORREO);
    const sobre = await envolverConContrasena(datos, buena.envoltura);
    await fallaSinMotivo(desenvolverConContrasena(sobre, mala.envoltura));
  });

  it('la envoltura por contraseña no se abre con el código, ni al revés', async () => {
    const datos = await generarClaveDeDatos();
    const codigo = await generarCodigoDeRecuperacion();
    const { envoltura } = await derivarClaves(CONTRASENA, CORREO);
    await fallaSinMotivo(
      desenvolverConCodigo(await envolverConContrasena(datos, envoltura), codigo),
    );
    await fallaSinMotivo(
      desenvolverConContrasena(await envolverConCodigo(datos, codigo), envoltura),
    );
  });

  it('la clave pasa a texto para el llavero y vuelve', async () => {
    const datos = await generarClaveDeDatos();
    const texto = await claveATexto(datos);
    expect(texto).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hex(await claveDeTexto(texto))).toBe(hex(datos));
    for (const malo of ['', 'corto', `${texto}A`, texto.replace(/.$/, '!'), null as never]) {
      await fallaSinMotivo(claveDeTexto(malo));
    }
  });

  it('borrar pone a cero las claves', async () => {
    const a = await generarClaveDeDatos();
    const b = await generarClaveDeDatos();
    borrar(a, null, undefined, b);
    expect(hex(a)).toBe('00'.repeat(32));
    expect(hex(b)).toBe('00'.repeat(32));
  });
});

describe('código de recuperación', () => {
  it('14 grupos de 4 símbolos: 256 bits de secreto y 24 de control', async () => {
    const codigo = await generarCodigoDeRecuperacion();
    const grupos = gruposDelCodigo(codigo);
    expect(GRUPOS_DEL_CODIGO).toBe(14);
    expect(grupos).toHaveLength(14);
    for (const grupo of grupos) expect(grupo).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}$/);
    const bytes = deBase32(codigo)!;
    // 56 símbolos de 5 bits = 280 bits = 32 bytes de secreto + 3 de control.
    expect(bytes.length).toBe(35);
    expect((bytes.length - 3) * 8).toBeGreaterThanOrEqual(160);
  });

  it('no usa caracteres ambiguos', async () => {
    expect(ALFABETO).toHaveLength(32);
    expect(new Set(ALFABETO).size).toBe(32);
    expect(ALFABETO).not.toMatch(/[ILOU]/);
    for (let i = 0; i < 200; i++) {
      expect(await generarCodigoDeRecuperacion()).not.toMatch(/[ILOUa-z]/);
    }
  });

  it('cada código es distinto y usa todo el alfabeto de forma pareja', async () => {
    const codigos = new Set<string>();
    const cuenta = new Map<string, number>();
    const TOTAL = 400;
    for (let i = 0; i < TOTAL; i++) {
      const codigo = await generarCodigoDeRecuperacion();
      codigos.add(codigo);
      // Solo los símbolos del secreto (los 51 primeros): el resto es control.
      for (const simbolo of codigo.replace(/-/g, '').slice(0, 51)) {
        cuenta.set(simbolo, (cuenta.get(simbolo) ?? 0) + 1);
      }
    }
    expect(codigos.size).toBe(TOTAL);
    expect(cuenta.size).toBe(32);
    const esperado = (TOTAL * 51) / 32;
    for (const veces of cuenta.values()) {
      expect(Math.abs(veces - esperado)).toBeLessThan(esperado * 0.25);
    }
  });

  it('el secreto sale del generador de la biblioteca, no de Math.random ni de la fecha', async () => {
    const azar = jest.spyOn(Math, 'random');
    const fecha = jest.spyOn(Date, 'now');
    const biblioteca = jest.spyOn(sodio, 'randombytes_buf');
    await generarCodigoDeRecuperacion();
    await generarClaveDeDatos();
    await cifrar(await generarClaveDeDatos(), utf8('x'), 'prueba');
    expect(azar).not.toHaveBeenCalled();
    expect(fecha).not.toHaveBeenCalled();
    expect(biblioteca.mock.calls.map(([bytes]) => bytes)).toEqual([32, 32, 32, 24]);
    jest.restoreAllMocks();
  });

  it('se lee aunque se escriba en minúsculas, sin guiones o con O, I y L', async () => {
    const codigo = v.salida.codigo_de_recuperacion;
    expect(await leerCodigoDeRecuperacion(codigo.toLowerCase())).toBe(codigo);
    expect(await leerCodigoDeRecuperacion(codigo.replace(/-/g, ''))).toBe(codigo);
    expect(await leerCodigoDeRecuperacion(`  ${codigo.replace(/-/g, '  ')} `)).toBe(codigo);
    const conLetras = codigo.replace(/0/g, 'O').replace(/1/g, 'l');
    expect(await leerCodigoDeRecuperacion(conLetras)).toBe(codigo);
  });

  it('detecta un error de transcripción en cualquier símbolo', async () => {
    const codigo = v.salida.codigo_de_recuperacion;
    const simbolos = codigo.replace(/-/g, '');
    for (let i = 0; i < simbolos.length; i++) {
      const otro = ALFABETO[(ALFABETO.indexOf(simbolos[i]) + 7) % 32];
      const errado = simbolos.slice(0, i) + otro + simbolos.slice(i + 1);
      expect([i, await leerCodigoDeRecuperacion(errado)]).toEqual([i, null]);
    }
  });

  it('detecta dos símbolos intercambiados, uno de menos y uno de más', async () => {
    const simbolos = v.salida.codigo_de_recuperacion.replace(/-/g, '');
    const intercambiado = simbolos[1] + simbolos[0] + simbolos.slice(2);
    expect(await leerCodigoDeRecuperacion(intercambiado)).toBeNull();
    expect(await leerCodigoDeRecuperacion(simbolos.slice(1))).toBeNull();
    expect(await leerCodigoDeRecuperacion(`${simbolos}0`)).toBeNull();
    for (const malo of [
      '',
      'hola',
      '!!!!-!!!!',
      'U'.repeat(56),
      'A'.repeat(5_000),
      null as never,
    ]) {
      expect(await leerCodigoDeRecuperacion(malo)).toBeNull();
    }
  });

  it('base32 va y vuelve y rechaza lo que no es del alfabeto', () => {
    const bytes = Uint8Array.from({ length: 35 }, (_, i) => (i * 37 + 11) % 256);
    expect(hex(deBase32(aBase32(bytes))!)).toBe(hex(bytes));
    expect(deBase32('U0000000')).toBeNull();
    expect(deBase32('000')).toBeNull();
    expect(() => aBase32(new Uint8Array(3))).toThrow();
  });
});

describe('autocomprobación', () => {
  beforeEach(() => olvidarAutocomprobacion());

  it('con la biblioteca correcta, pasa y dice cuánto tardó la derivación', async () => {
    const resultado = await autocomprobarCripto();
    expect(resultado.correcta).toBe(true);
    expect(resultado.milisegundosDeDerivacion).toBeGreaterThan(0);
  });

  it('se calcula una sola vez por arranque', async () => {
    const derivacion = jest.spyOn(sodio, 'crypto_pwhash');
    await Promise.all([autocomprobarCripto(), autocomprobarCripto()]);
    await autocomprobarCripto();
    expect(derivacion).toHaveBeenCalledTimes(1);
    derivacion.mockRestore();
  });

  it.each([
    ['Argon2id', 'crypto_pwhash'],
    ['las subclaves', 'crypto_kdf_derive_from_key'],
    ['BLAKE2b', 'crypto_generichash'],
    ['el descifrado', 'crypto_aead_xchacha20poly1305_ietf_decrypt'],
  ] as const)('si %s da otro resultado, falla', async (_n, funcion) => {
    const real = sodio[funcion] as (...a: unknown[]) => Uint8Array;
    const espia = jest.spyOn(sodio, funcion).mockImplementation(((...args: unknown[]) => {
      const bueno = Uint8Array.from(real(...args));
      bueno[0] ^= 0x01;
      return bueno;
    }) as never);
    expect((await autocomprobarCripto()).correcta).toBe(false);
    espia.mockRestore();
  });

  it('si el cifrado no rechaza un sobre presentado para otro uso, falla', async () => {
    const real = sodio.crypto_aead_xchacha20poly1305_ietf_decrypt as (
      ...a: unknown[]
    ) => Uint8Array;
    const espia = jest
      .spyOn(sodio, 'crypto_aead_xchacha20poly1305_ietf_decrypt')
      .mockImplementation(((...args: unknown[]) => {
        // Un enlace roto que ignorase los datos autenticados.
        const [a, cifrado, datos, nonce, clave] = args;
        return real(a, cifrado, String(datos).replace('/otro-uso', ''), nonce, clave);
      }) as never);
    expect((await autocomprobarCripto()).correcta).toBe(false);
    espia.mockRestore();
  });

  it('si la biblioteca lanza un error, falla sin propagarlo', async () => {
    const espia = jest.spyOn(sodio, 'crypto_pwhash').mockImplementation(() => {
      throw new Error('biblioteca rota');
    });
    await expect(autocomprobarCripto()).resolves.toEqual({
      correcta: false,
      milisegundosDeDerivacion: null,
    });
    espia.mockRestore();
  });

  it('si los vectores no son de los parámetros de la app, falla', async () => {
    const original = v.entrada.argon2id_pasadas;
    v.entrada.argon2id_pasadas = original + 1;
    expect((await autocomprobarCripto()).correcta).toBe(false);
    v.entrada.argon2id_pasadas = original;
  });

  it('la medición de la derivación devuelve solo un tiempo', async () => {
    const tiempo = await medirDerivacion();
    expect(typeof tiempo).toBe('number');
    expect(tiempo).toBeGreaterThan(0);
  });
});

describe('límites del paquete en nativo', () => {
  // En iOS y Android, react-native-libsodium 1.7.0:
  //  - solo admite los datos autenticados del cifrado como texto, no como bytes;
  //  - solo admite el contenido cifrado como bytes al descifrar;
  //  - solo admite la clave de BLAKE2b como bytes, no como texto.
  // En las pruebas corre la versión de WebAssembly, que lo admite todo: por eso
  // se vigila aquí con qué tipos llama el módulo a la biblioteca.
  it('el módulo llama a la biblioteca solo con los tipos que la versión nativa admite', async () => {
    const cifrado = jest.spyOn(sodio, 'crypto_aead_xchacha20poly1305_ietf_encrypt');
    const descifrado = jest.spyOn(sodio, 'crypto_aead_xchacha20poly1305_ietf_decrypt');
    const resumen = jest.spyOn(sodio, 'crypto_generichash');
    const subclave = jest.spyOn(sodio, 'crypto_kdf_derive_from_key');
    const derivacion = jest.spyOn(sodio, 'crypto_pwhash');

    // Todas las operaciones del módulo, una vez.
    const { envoltura } = await derivarClaves(CONTRASENA, CORREO);
    const datos = await generarClaveDeDatos();
    const codigo = await generarCodigoDeRecuperacion();
    await desenvolverConContrasena(await envolverConContrasena(datos, envoltura), envoltura);
    await desenvolverConCodigo(await envolverConCodigo(datos, codigo), codigo);
    await descifrar(datos, await cifrar(datos, utf8('x'), 'fila/cuenta/1'), 'fila/cuenta/1');
    await leerCodigoDeRecuperacion(codigo);

    expect(cifrado.mock.calls.length).toBeGreaterThanOrEqual(3);
    for (const [mensaje, autenticados, secreto, nonce, clave, formato] of cifrado.mock.calls) {
      expect(mensaje).toBeInstanceOf(Uint8Array);
      expect(typeof autenticados).toBe('string');
      expect(secreto).toBeNull();
      expect(nonce).toBeInstanceOf(Uint8Array);
      expect(clave).toBeInstanceOf(Uint8Array);
      expect(formato).toBeUndefined();
    }
    expect(descifrado.mock.calls.length).toBeGreaterThanOrEqual(3);
    for (const [secreto, contenido, autenticados, nonce, clave, formato] of descifrado.mock.calls) {
      expect(secreto).toBeNull();
      expect(contenido).toBeInstanceOf(Uint8Array);
      expect(typeof autenticados).toBe('string');
      expect(nonce).toBeInstanceOf(Uint8Array);
      expect(clave).toBeInstanceOf(Uint8Array);
      expect(formato).toBeUndefined();
    }
    expect(resumen.mock.calls.length).toBeGreaterThanOrEqual(3);
    for (const [longitud, mensaje, clave, formato] of resumen.mock.calls) {
      expect(typeof longitud).toBe('number');
      expect(mensaje).toBeInstanceOf(Uint8Array);
      expect(clave).toBeInstanceOf(Uint8Array);
      expect(formato).toBeUndefined();
    }
    for (const [longitud, numero, contexto, clave, formato] of subclave.mock.calls) {
      expect([longitud, typeof numero, typeof contexto]).toEqual([32, 'number', 'string']);
      expect(contexto).toHaveLength(8);
      expect(clave).toBeInstanceOf(Uint8Array);
      expect(formato).toBeUndefined();
    }
    for (const [longitud, contrasena, sal, pasadas, memoria, algoritmo, formato] of derivacion.mock
      .calls) {
      expect(longitud).toBe(32);
      expect(contrasena).toBeInstanceOf(Uint8Array);
      expect(sal).toBeInstanceOf(Uint8Array);
      expect([pasadas, memoria, algoritmo]).toEqual([8, 64 * 1024 * 1024, 2]);
      expect(formato).toBeUndefined();
    }
    jest.restoreAllMocks();
  });

  it('cada contexto de subclave se usa para una sola cosa', () => {
    const contextos = [SUBCLAVE_DE_AUTENTICACION, SUBCLAVE_DE_ENVOLTURA, SUBCLAVE_DE_RECUPERACION];
    expect(new Set(contextos.map((c) => c.contexto)).size).toBe(3);
    for (const { contexto } of contextos) expect(contexto).toMatch(/^[\x21-\x7E]{8}$/);
  });
});

describe('higiene del módulo', () => {
  const raiz = join(__dirname, '..', '..');
  const fuentes = (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('__tests__'))
    .map((f) => [f, readFileSync(join(raiz, f), 'utf8')] as const);

  it('solo src/cripto/sodio.ts carga la biblioteca', () => {
    const usan = fuentes
      .filter(([, codigo]) =>
        /from '(react-native-)?libsodium|require\(['"](react-native-)?libsodium/.test(codigo),
      )
      .map(([f]) => f)
      .sort();
    expect(usan).toEqual(['cripto/sodio.ts', 'pruebas/sodioDePrueba.ts']);
    const sodioInterno = fuentes
      .filter(([f, codigo]) => !f.startsWith('cripto/') && /cripto\/sodio'/.test(codigo))
      .map(([f]) => f);
    expect(sodioInterno).toEqual([]);
  });

  it('el módulo no usa Math.random, fechas, registros ni almacenamiento', () => {
    for (const [fichero, codigo] of fuentes.filter(([f]) => f.startsWith('cripto/'))) {
      const sinComentarios = codigo.replace(/\/\*[^]*?\*\/|\/\/.*$/gm, '');
      expect([
        fichero,
        /Math\.random|Date\.|new Date|console\.|kv-store|Settings|SecureStore|fetch\(/.test(
          sinComentarios,
        ),
      ]).toEqual([fichero, false]);
    }
  });

  it('no hay primitivas a mano: toda operación criptográfica es una llamada a la biblioteca', () => {
    const codigo = fuentes.find(([f]) => f === 'cripto/index.ts')![1];
    const llamadas = [...codigo.matchAll(/sodio\s*\.\s*(crypto_\w+|randombytes_\w+)\(/g)].map(
      (m) => m[1],
    );
    expect([...new Set(llamadas)].sort()).toEqual([
      'crypto_aead_xchacha20poly1305_ietf_decrypt',
      'crypto_aead_xchacha20poly1305_ietf_encrypt',
      'crypto_generichash',
      'crypto_kdf_derive_from_key',
      'crypto_pwhash',
      'randombytes_buf',
      // Solo para elegir qué dos grupos del código se piden al confirmar.
      'randombytes_uniform',
    ]);
    // Ni operaciones de bits sobre claves ni bucles de mezcla fuera de base32, que no es criptografía.
    expect(codigo.replace(/\/\*[^]*?\*\/|\/\/.*$/gm, '')).not.toMatch(/\s\^=?\s|>>>|<<|\s>>\s/);
  });
});
