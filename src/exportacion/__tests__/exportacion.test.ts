/** Exportación de datos (D-m, R-24): JSON con todo y CSV de movimientos. */
import { FORMATO_ES } from '@/dominio/dinero';
import { crearExportador } from '@/exportacion/exportador';
import {
  aJson,
  csvDeMovimientos,
  exportarTodo,
  FORMATO_DE_EXPORTACION,
  importeConSigno,
  leerExportacion,
  nombreDeFichero,
  tablasDeDatos,
  type TextosDelCsv,
} from '@/exportacion/exportacion';
import es from '@/i18n/es.json';
import { prepararPrueba } from '@/pruebas/bdDePrueba';
import { INICIALES, sembrarTodo, type Dispositivo } from '@/pruebas/sincronizacionDePrueba';
import { TABLAS, TABLAS_SOLO_LOCALES } from '@/sincronizacion/tablas';

const AHORA = new Date('2026-11-22T18:30:00.000Z');
const TEXTOS: TextosDelCsv = {
  columnas: {
    fecha: es.exportar.csvFecha,
    tipo: es.exportar.csvTipo,
    importe: es.exportar.csvImporte,
    divisa: es.exportar.csvDivisa,
    cuenta: es.exportar.csvCuenta,
    cuentaDestino: es.exportar.csvCuentaDestino,
    categoria: es.exportar.csvCategoria,
    nombre: es.exportar.csvNombre,
    comercio: es.exportar.csvComercio,
    nota: es.exportar.csvNota,
  },
  tipos: es.tipoDeMovimiento,
};

async function conDatos() {
  const d = await prepararPrueba(INICIALES);
  const datos = await sembrarTodo(d as unknown as Dispositivo);
  await d.avisos.registrar('aviso-de-ejemplo');
  return { ...d, datos };
}

/** Lee un CSV sencillo: separador, comillas dobles y saltos de línea dentro de comillas. */
function leerCsv(texto: string, separador: string): string[][] {
  const filas: string[][] = [[]];
  let celda = '';
  let entreComillas = false;
  const cuerpo = texto.replace(/^﻿/, '');
  for (let i = 0; i < cuerpo.length; i += 1) {
    const letra = cuerpo[i];
    if (entreComillas) {
      if (letra === '"' && cuerpo[i + 1] === '"') {
        celda += '"';
        i += 1;
      } else if (letra === '"') entreComillas = false;
      else celda += letra;
    } else if (letra === '"') entreComillas = true;
    else if (letra === separador) {
      filas[filas.length - 1].push(celda);
      celda = '';
    } else if (letra === '\r' && cuerpo[i + 1] === '\n') {
      filas[filas.length - 1].push(celda);
      celda = '';
      filas.push([]);
      i += 1;
    } else celda += letra;
  }
  return filas.filter((fila) => fila.length > 0);
}

describe('exportación en JSON', () => {
  it('contiene todas las filas de todas las tablas locales, y se puede volver a leer', async () => {
    const { bd, datos, movimientos } = await conDatos();
    // También lo borrado es un dato de la persona.
    await movimientos.borrar(datos.movimiento.id);
    const exportacion = await exportarTodo(bd, AHORA);
    const tablas = [...TABLAS.map((t) => t.nombre), ...TABLAS_SOLO_LOCALES].sort();
    expect(Object.keys(exportacion.tablas).sort()).toEqual(tablas);
    for (const tabla of tablas) {
      const enLaBase = await bd.consultar(`SELECT * FROM ${tabla} ORDER BY id`);
      expect(enLaBase.length).toBeGreaterThan(0);
      expect(exportacion.tablas[tabla]).toEqual(enLaBase);
    }
    const borrado = exportacion.tablas.movimiento.find((m) => m.id === datos.movimiento.id);
    expect(borrado?.borrado_en).not.toBeNull();

    const texto = aJson(exportacion);
    const leida = leerExportacion(texto);
    expect(leida).toEqual(exportacion);
    expect(leida).toMatchObject({
      formato: FORMATO_DE_EXPORTACION,
      version: 1,
      esquema: 5,
      cifrado: false,
      exportadoEn: '2026-11-22T18:30:00.000Z',
    });
  });

  it('es legible por una persona: en claro, con sangría y con los nombres de las columnas', async () => {
    const { bd } = await conDatos();
    const texto = aJson(await exportarTodo(bd, AHORA));
    expect(texto).toContain('\n  "tablas": {\n    "alias_de_tarjeta": [');
    expect(texto).toContain('"nombre": "Mercado"');
    expect(texto).toContain('"importe": 2340');
    expect(texto).toContain('"nota": "Con tilde: señal, café y 5 €"');
    expect(texto.endsWith('}\n')).toBe(true);
  });

  it('no incluye el estado interno de la sincronización ni nada de la cuenta', async () => {
    const { bd } = await conDatos();
    await bd.ejecutar("INSERT INTO sinc_estado (clave, valor) VALUES ('usuario', 'un-usuario')");
    expect(await tablasDeDatos(bd)).not.toEqual(expect.arrayContaining(['sinc_estado']));
    const texto = aJson(await exportarTodo(bd, AHORA));
    expect(texto).not.toMatch(/sinc_|un-usuario|sqlite_/);
  });

  it('una base recién instalada también se exporta', async () => {
    const { bd } = await prepararPrueba(INICIALES);
    const exportacion = await exportarTodo(bd, AHORA);
    expect(exportacion.tablas.categoria).toHaveLength(3);
    expect(exportacion.tablas.movimiento).toEqual([]);
    expect(leerExportacion(aJson(exportacion))).toEqual(exportacion);
  });

  it('una tabla que añada una migración futura entra sola en la exportación', async () => {
    const { bd } = await conDatos();
    await bd.ejecutar('CREATE TABLE tabla_futura (id TEXT PRIMARY KEY, dato TEXT)');
    await bd.ejecutar("INSERT INTO tabla_futura VALUES ('1', 'algo')");
    expect((await exportarTodo(bd, AHORA)).tablas.tabla_futura).toEqual([
      { id: '1', dato: 'algo' },
    ]);
  });

  it('al leer rechaza lo que no es una exportación', () => {
    for (const malo of ['{}', 'null', '[]', '{"formato":"otro","version":1}']) {
      expect(() => leerExportacion(malo)).toThrow();
    }
    const base = { formato: FORMATO_DE_EXPORTACION, version: 1, exportadoEn: 'x', esquema: 5 };
    expect(() =>
      leerExportacion(JSON.stringify({ ...base, tablas: { t: [{ a: {} }] } })),
    ).toThrow();
    expect(() => leerExportacion(JSON.stringify({ ...base, version: 2, tablas: {} }))).toThrow();
    expect(() => leerExportacion('no es json')).toThrow();
  });
});

describe('exportación de movimientos en CSV', () => {
  it('cada movimiento lleva su importe con signo y su divisa', async () => {
    const { bd, datos, cuentas, movimientos } = await conDatos();
    const cartera = await cuentas.crear({
      nombre: 'Cartera',
      tipo: 'efectivo',
      saldoInicial: 0,
      fechaSaldoInicial: '2026-10-01',
    });
    await movimientos.crear({
      tipo: 'ingreso',
      fecha: '2026-11-15',
      importe: 185050,
      cuentaId: datos.banco.id,
      nombre: 'Nómina',
    });
    await movimientos.crear({
      tipo: 'transferencia',
      fecha: '2026-11-16',
      importe: 4000,
      cuentaId: datos.banco.id,
      cuentaDestinoId: cartera.id,
      nombre: 'Al bolsillo',
    });
    await movimientos.crear({
      tipo: 'ajuste',
      fecha: '2026-11-17',
      importe: -125,
      cuentaId: cartera.id,
      nombre: 'Descuadre',
    });
    await movimientos.crear({
      tipo: 'ajuste',
      fecha: '2026-11-18',
      importe: 5,
      cuentaId: cartera.id,
      nombre: 'Moneda',
    });
    const csv = await csvDeMovimientos(bd, TEXTOS);
    expect(csv.startsWith('﻿')).toBe(true);
    const [titulos, ...filas] = leerCsv(csv, ';');
    expect(titulos).toEqual([
      'Fecha',
      'Tipo',
      'Importe',
      'Divisa',
      'Cuenta',
      'Cuenta de destino',
      'Categoría',
      'Nombre',
      'Comercio',
      'Nota',
    ]);
    const por = (nombre: string) => filas.find((f) => f[7] === nombre)!;
    // fecha, tipo, importe con signo, divisa, cuenta…
    expect(por('Mercado').slice(0, 7)).toEqual([
      '2026-11-10',
      'Gasto',
      '-23,40',
      'EUR',
      'Banco',
      '',
      'Comida',
    ]);
    expect(por('Nómina').slice(1, 4)).toEqual(['Ingreso', '1850,50', 'EUR']);
    expect(por('Al bolsillo').slice(1, 6)).toEqual([
      'Transferencia',
      '-40,00',
      'EUR',
      'Banco',
      'Cartera',
    ]);
    expect(por('Descuadre').slice(1, 4)).toEqual(['Ajuste', '-1,25', 'EUR']);
    expect(por('Moneda').slice(1, 4)).toEqual(['Ajuste', '0,05', 'EUR']);
    // Todos llevan divisa, y están todos los no borrados, del más antiguo al más reciente.
    expect(filas.every((f) => f.length === 10 && f[3] === 'EUR')).toBe(true);
    const vivos = await bd.consultar('SELECT id FROM movimiento WHERE borrado_en IS NULL');
    expect(filas).toHaveLength(vivos.length);
    expect(filas.map((f) => f[0])).toEqual([...filas.map((f) => f[0])].sort());
  });

  it('los importes se leen como números en una hoja de cálculo en español y en una en inglés', async () => {
    expect(importeConSigno('gasto', 123456)).toBe('-1234,56');
    expect(importeConSigno('ingreso', 123456)).toBe('1234,56');
    expect(importeConSigno('transferencia', 100)).toBe('-1,00');
    expect(importeConSigno('ajuste', -5)).toBe('-0,05');
    const ingles = { ...FORMATO_ES, separadorDecimal: '.', separadorDeMiles: ',' };
    expect(importeConSigno('gasto', 123456, ingles)).toBe('-1234.56');
    const { bd } = await conDatos();
    const csv = await csvDeMovimientos(bd, TEXTOS, ingles);
    const [, primera] = leerCsv(csv, ',');
    expect(primera[2]).toMatch(/^-?\d+\.\d{2}$/);
  });

  it('no incluye los movimientos borrados', async () => {
    const { bd, datos, movimientos } = await conDatos();
    await movimientos.borrar(datos.movimiento.id);
    const filas = leerCsv(await csvDeMovimientos(bd, TEXTOS), ';');
    expect(filas.some((f) => f[7] === 'Mercado')).toBe(false);
  });

  it('textos con separadores, comillas, saltos de línea o aspecto de fórmula no rompen ni engañan', async () => {
    const { bd, datos, movimientos } = await conDatos();
    await movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-19',
      importe: 100,
      cuentaId: datos.banco.id,
      nombre: 'Cena; con "amigos"',
      nota: 'Primera línea\nSegunda línea',
    });
    await movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-20',
      importe: 200,
      cuentaId: datos.banco.id,
      nombre: '=HYPERLINK("http://example.com";"pulsa")',
      nota: '+34 600 000 000',
    });
    const filas = leerCsv(await csvDeMovimientos(bd, TEXTOS), ';');
    const cena = filas.find((f) => f[7].startsWith('Cena'))!;
    expect(cena[7]).toBe('Cena; con "amigos"');
    expect(cena[9]).toBe('Primera línea\nSegunda línea');
    expect(cena).toHaveLength(10);
    // Lo que una hoja de cálculo tomaría por fórmula queda como texto.
    const formula = filas.find((f) => f[7].includes('HYPERLINK'))!;
    expect(formula[7].startsWith("'=")).toBe(true);
    expect(formula[9]).toBe("'+34 600 000 000");
    // El importe negativo no se toca: es un número, no un texto.
    expect(formula[2]).toBe('-2,00');
  });

  it('sin movimientos sale solo la cabecera', async () => {
    const { bd } = await prepararPrueba(INICIALES);
    expect(leerCsv(await csvDeMovimientos(bd, TEXTOS), ';')).toHaveLength(1);
  });
});

describe('entrega del fichero', () => {
  async function montar(opciones: { autentica?: boolean } = {}) {
    const { bd } = await conDatos();
    const entregados: { nombre: string; contenido: string }[] = [];
    const autenticar = jest.fn(async () => opciones.autentica ?? true);
    const exportador = crearExportador({
      bd: async () => bd,
      compartir: async (nombre, contenido) => {
        entregados.push({ nombre, contenido });
        return 'compartido';
      },
      autenticar,
      ahora: () => new Date(2026, 10, 22, 19, 30),
      textosDelCsv: () => TEXTOS,
      formato: () => FORMATO_ES,
    });
    return { exportador, entregados, autenticar };
  }

  it('entrega el JSON y el CSV con su nombre y su fecha', async () => {
    const { exportador, entregados } = await montar();
    expect(await exportador.todo()).toBe('compartido');
    expect(await exportador.movimientos()).toBe('compartido');
    expect(await exportador.todo('-copia-local')).toBe('compartido');
    expect(entregados.map((e) => e.nombre)).toEqual([
      'financialcontrol-2026-11-22.json',
      'financialcontrol-movimientos-2026-11-22.csv',
      'financialcontrol-copia-local-2026-11-22.json',
    ]);
    expect(leerExportacion(entregados[0].contenido).tablas.movimiento.length).toBeGreaterThan(0);
    expect(entregados[1].contenido).toContain('Mercado');
    expect(nombreDeFichero(new Date(2026, 0, 5), 'csv')).toBe('financialcontrol-2026-01-05.csv');
  });

  it('pide autenticación antes, y sin ella no lee ni entrega nada', async () => {
    const { exportador, entregados, autenticar } = await montar({ autentica: false });
    expect(await exportador.todo()).toBe('no_autenticado');
    expect(await exportador.movimientos()).toBe('no_autenticado');
    expect(autenticar).toHaveBeenCalledTimes(2);
    expect(entregados).toEqual([]);
  });

  it('si la base falla o compartir falla, lo dice sin lanzar errores ni detalles', async () => {
    const exportador = crearExportador({
      bd: async () => {
        throw new Error('detalle interno que no debe verse');
      },
      compartir: async () => 'compartido',
      autenticar: async () => true,
      ahora: () => AHORA,
      textosDelCsv: () => TEXTOS,
      formato: () => FORMATO_ES,
    });
    expect(await exportador.todo()).toBe('error');
  });
});
