/**
 * Exportación de los datos de la persona (RGPD, R-24): un JSON con todas las
 * filas de todas las tablas locales y un CSV de movimientos.
 *
 * Sin nada nativo: recibe la base de datos y devuelve textos. Escribir el
 * fichero y abrir la hoja de compartir es de `src/lib/compartirFichero.ts`.
 *
 * Lo que sale de aquí va EN CLARO. La pantalla lo avisa antes de exportar.
 */
import type { BaseDeDatos } from '@/datos/bd';
import { versionDelEsquema } from '@/datos/migraciones';
import { FORMATO_ES, type FormatoRegional } from '@/dominio/dinero';

/** Nombre del formato, para reconocer el fichero. */
export const FORMATO_DE_EXPORTACION = 'financialcontrol.exportacion';
/** Versión del formato del fichero. Cambia si cambia su estructura, no si cambia el esquema. */
export const VERSION_DE_EXPORTACION = 1;

type Valor = string | number | null;
export type FilaExportada = Record<string, Valor>;

export type Exportacion = {
  formato: typeof FORMATO_DE_EXPORTACION;
  version: number;
  /** Instante en que se generó. */
  exportadoEn: string;
  /** Versión del esquema de la base local de la que sale. */
  esquema: number;
  /** El fichero no va cifrado. Está escrito para que quien lo abra lo vea. */
  cifrado: false;
  /** Todas las filas de cada tabla, incluidas las borradas (llevan `borrado_en`). */
  tablas: Record<string, FilaExportada[]>;
};

/**
 * Las tablas con datos de la persona: todas las de la base salvo las internas
 * de SQLite y las de estado de la sincronización. Se leen del propio esquema,
 * así una tabla que añada una migración futura entra sola en la exportación.
 */
export async function tablasDeDatos(bd: BaseDeDatos): Promise<string[]> {
  const tablas = await bd.consultar<{ name: string }>(
    `SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'sinc_%'
      ORDER BY name`,
  );
  return tablas.map((tabla) => tabla.name).filter((nombre) => /^[a-z_]+$/.test(nombre));
}

/** Lee todas las filas de todas las tablas de datos. */
export async function exportarTodo(bd: BaseDeDatos, ahora: Date): Promise<Exportacion> {
  // En una transacción, para que el fichero sea una foto coherente.
  return bd.transaccion(async () => {
    const tablas: Record<string, FilaExportada[]> = {};
    for (const nombre of await tablasDeDatos(bd)) {
      tablas[nombre] = await bd.consultar<FilaExportada>(`SELECT * FROM ${nombre} ORDER BY id`);
    }
    return {
      formato: FORMATO_DE_EXPORTACION,
      version: VERSION_DE_EXPORTACION,
      exportadoEn: ahora.toISOString(),
      esquema: await versionDelEsquema(bd),
      cifrado: false,
      tablas,
    };
  });
}

/** El JSON de una exportación, con sangría: está hecho para que una persona pueda leerlo. */
export function aJson(exportacion: Exportacion): string {
  return `${JSON.stringify(exportacion, null, 2)}\n`;
}

/** Lee un fichero de exportación. Lanza un error si no lo es. */
export function leerExportacion(texto: string): Exportacion {
  const leido = JSON.parse(texto) as Partial<Exportacion> | null;
  const esFila = (fila: unknown) =>
    typeof fila === 'object' &&
    fila !== null &&
    Object.values(fila).every(
      (valor) => valor === null || typeof valor === 'string' || typeof valor === 'number',
    );
  if (
    !leido ||
    leido.formato !== FORMATO_DE_EXPORTACION ||
    leido.version !== VERSION_DE_EXPORTACION ||
    typeof leido.exportadoEn !== 'string' ||
    typeof leido.esquema !== 'number' ||
    typeof leido.tablas !== 'object' ||
    leido.tablas === null ||
    !Object.values(leido.tablas).every((filas) => Array.isArray(filas) && filas.every(esFila))
  ) {
    throw new Error('No es un fichero de exportación de FinancialControl.');
  }
  return leido as Exportacion;
}

// ---------------------------------------------------------------------- CSV

/** Títulos de las columnas y nombres de los tipos, del catálogo de textos. */
export type TextosDelCsv = {
  columnas: {
    fecha: string;
    tipo: string;
    importe: string;
    divisa: string;
    cuenta: string;
    cuentaDestino: string;
    categoria: string;
    nombre: string;
    comercio: string;
    nota: string;
  };
  tipos: Record<'gasto' | 'ingreso' | 'transferencia' | 'ajuste', string>;
};

/**
 * El importe con su signo, sin separador de miles: un gasto y una
 * transferencia salen de la cuenta (negativo), un ingreso entra (positivo) y
 * un ajuste lleva el signo que tenga.
 */
export function importeConSigno(
  tipo: string,
  centimos: number,
  formato: FormatoRegional = FORMATO_ES,
): string {
  const firmado = tipo === 'gasto' || tipo === 'transferencia' ? -Math.abs(centimos) : centimos;
  const absoluto = Math.abs(firmado);
  const decimales = String(absoluto % 100).padStart(2, '0');
  return `${firmado < 0 ? '-' : ''}${Math.floor(absoluto / 100)}${formato.separadorDecimal}${decimales}`;
}

/**
 * Una celda de CSV. Va entre comillas si hace falta. Un texto que empieza por
 * =, +, - o @ se escribiría como fórmula al abrirlo en una hoja de cálculo:
 * se le antepone un apóstrofo para que se quede en texto.
 */
function celda(valor: string, separador: string, esTexto: boolean): string {
  let texto = valor;
  if (esTexto && /^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return texto.includes(separador) || /["\n\r]/.test(texto)
    ? `"${texto.replace(/"/g, '""')}"`
    : texto;
}

type MovimientoParaCsv = {
  fecha: string;
  tipo: string;
  importe: number;
  divisa: string;
  cuenta: string | null;
  destino: string | null;
  categoria: string | null;
  nombre: string;
  comercio: string | null;
  nota: string | null;
};

/**
 * CSV de los movimientos no borrados, del más antiguo al más reciente. Con
 * coma decimal se separa con punto y coma, que es como lo abren las hojas de
 * cálculo en español; con punto decimal, con coma. Lleva la marca de UTF-8
 * para que Excel lea bien los acentos.
 */
export async function csvDeMovimientos(
  bd: BaseDeDatos,
  textos: TextosDelCsv,
  formato: FormatoRegional = FORMATO_ES,
): Promise<string> {
  const movimientos = await bd.consultar<MovimientoParaCsv>(
    `SELECT m.fecha, m.tipo, m.importe, m.divisa, c.nombre AS cuenta, d.nombre AS destino,
            g.nombre AS categoria, m.nombre, m.comercio, m.nota
       FROM movimiento m
       LEFT JOIN cuenta c ON c.id = m.cuenta_id
       LEFT JOIN cuenta d ON d.id = m.cuenta_destino_id
       LEFT JOIN categoria g ON g.id = m.categoria_id
      WHERE m.borrado_en IS NULL
      ORDER BY m.fecha, m.creado_en, m.id`,
  );
  const separador = formato.separadorDecimal === ',' ? ';' : ',';
  const c = textos.columnas;
  const lineas = [
    [
      c.fecha,
      c.tipo,
      c.importe,
      c.divisa,
      c.cuenta,
      c.cuentaDestino,
      c.categoria,
      c.nombre,
      c.comercio,
      c.nota,
    ]
      .map((titulo) => celda(titulo, separador, true))
      .join(separador),
  ];
  for (const m of movimientos) {
    const tipo = textos.tipos[m.tipo as keyof TextosDelCsv['tipos']] ?? m.tipo;
    lineas.push(
      [
        celda(m.fecha, separador, false),
        celda(tipo, separador, true),
        celda(importeConSigno(m.tipo, m.importe, formato), separador, false),
        celda(m.divisa, separador, true),
        celda(m.cuenta ?? '', separador, true),
        celda(m.destino ?? '', separador, true),
        celda(m.categoria ?? '', separador, true),
        celda(m.nombre, separador, true),
        celda(m.comercio ?? '', separador, true),
        celda(m.nota ?? '', separador, true),
      ].join(separador),
    );
  }
  return `﻿${lineas.join('\r\n')}\r\n`;
}

/** Nombre de fichero con la fecha: «financialcontrol-2026-11-22.json». */
export function nombreDeFichero(ahora: Date, extension: 'json' | 'csv', sufijo = ''): string {
  const dia = [
    ahora.getFullYear(),
    String(ahora.getMonth() + 1).padStart(2, '0'),
    String(ahora.getDate()).padStart(2, '0'),
  ].join('-');
  return `financialcontrol${sufijo}-${dia}.${extension}`;
}
