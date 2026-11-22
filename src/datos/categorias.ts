/**
 * Repositorio de categorías (T-020 y T-027): crear, renombrar, ordenar,
 * archivar y borrar.
 */
import {
  ErrorDeDominio,
  normalizarNombre,
  TIPOS_DE_CATEGORIA,
  type Categoria,
  type TipoDeCategoria,
} from '@/dominio/modelo';

import { exigirLongitud } from '@/dominio/textos';
import type { BaseDeDatos, Entorno } from './bd';

export type FilaCategoria = {
  id: string;
  nombre: string;
  tipo: TipoDeCategoria;
  icono: string | null;
  color: string | null;
  padre_id: string | null;
  archivada: number;
  orden: number;
  creado_en: string;
  modificado_en: string;
  borrado_en: string | null;
};

export function filaACategoria(f: FilaCategoria): Categoria {
  return {
    id: f.id,
    nombre: f.nombre,
    tipo: f.tipo,
    icono: f.icono,
    color: f.color,
    padreId: f.padre_id,
    archivada: f.archivada === 1,
    orden: f.orden,
    creadoEn: f.creado_en,
    modificadoEn: f.modificado_en,
    borradoEn: f.borrado_en,
  };
}

export type DatosDeCategoria = {
  nombre: string;
  tipo: TipoDeCategoria;
  icono?: string | null;
  color?: string | null;
};

export function crearRepositorioDeCategorias(bd: BaseDeDatos, entorno: Entorno) {
  async function obtener(id: string): Promise<Categoria | null> {
    const filas = await bd.consultar<FilaCategoria>('SELECT * FROM categoria WHERE id = ?', [id]);
    return filas[0] ? filaACategoria(filas[0]) : null;
  }

  async function exigir(id: string): Promise<Categoria> {
    const categoria = await obtener(id);
    if (!categoria || categoria.borradoEn !== null) {
      throw new ErrorDeDominio('categoria_no_encontrada');
    }
    return categoria;
  }

  /** Categorías no borradas, en su orden. Las archivadas solo si se piden. */
  async function listar(
    opciones: { tipo?: TipoDeCategoria; incluirArchivadas?: boolean } = {},
  ): Promise<Categoria[]> {
    const filas = await bd.consultar<FilaCategoria>(
      `SELECT * FROM categoria WHERE borrado_en IS NULL
       ${opciones.incluirArchivadas ? '' : 'AND archivada = 0'}
       ${opciones.tipo ? 'AND tipo = ?' : ''}
       ORDER BY orden, creado_en`,
      opciones.tipo ? [opciones.tipo] : [],
    );
    return filas.map(filaACategoria);
  }

  /**
   * Dos categorías del mismo tipo no pueden llamarse igual. "Comida",
   * "comida " y "COMIDÁ" cuentan como el mismo nombre. Las archivadas también
   * cuentan: siguen apareciendo en los movimientos antiguos.
   */
  async function validarNombre(
    nombre: string,
    tipo: TipoDeCategoria,
    idPropio: string | null,
  ): Promise<string> {
    const limpio = nombre.trim().replace(/\s+/g, ' ');
    if (limpio === '') throw new ErrorDeDominio('nombre_vacio');
    const existentes = await listar({ tipo, incluirArchivadas: true });
    exigirLongitud(limpio, 'nombre', existentes.find((c) => c.id === idPropio)?.nombre);
    const clave = normalizarNombre(limpio);
    if (existentes.some((c) => c.id !== idPropio && normalizarNombre(c.nombre) === clave)) {
      throw new ErrorDeDominio('nombre_duplicado');
    }
    return limpio;
  }

  async function crear(datos: DatosDeCategoria): Promise<Categoria> {
    if (!TIPOS_DE_CATEGORIA.includes(datos.tipo)) throw new ErrorDeDominio('no_encontrado');
    const nombre = await validarNombre(datos.nombre, datos.tipo, null);
    const id = entorno.generarId();
    const ahora = entorno.ahora().toISOString();
    const [{ siguiente }] = await bd.consultar<{ siguiente: number }>(
      'SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM categoria WHERE tipo = ?',
      [datos.tipo],
    );
    await bd.ejecutar(
      `INSERT INTO categoria (id, nombre, tipo, icono, color, padre_id, archivada, orden,
                              creado_en, modificado_en, borrado_en)
       VALUES (?, ?, ?, ?, ?, NULL, 0, ?, ?, ?, NULL)`,
      [id, nombre, datos.tipo, datos.icono ?? null, datos.color ?? null, siguiente, ahora, ahora],
    );
    return (await obtener(id))!;
  }

  async function renombrar(id: string, nombre: string): Promise<Categoria> {
    const categoria = await exigir(id);
    const limpio = await validarNombre(nombre, categoria.tipo, id);
    await bd.ejecutar('UPDATE categoria SET nombre = ?, modificado_en = ? WHERE id = ?', [
      limpio,
      entorno.ahora().toISOString(),
      id,
    ]);
    return (await obtener(id))!;
  }

  /**
   * Fija el orden de las categorías: la posición de cada id en la lista pasa
   * a ser su `orden`. Los ids que no existan se ignoran.
   */
  async function ordenar(idsEnOrden: string[]): Promise<void> {
    const ahora = entorno.ahora().toISOString();
    await bd.transaccion(async () => {
      for (let i = 0; i < idsEnOrden.length; i++) {
        await bd.ejecutar(
          'UPDATE categoria SET orden = ?, modificado_en = ? WHERE id = ? AND orden <> ?',
          [i, ahora, idsEnOrden[i], i],
        );
      }
    });
  }

  /**
   * Archivar oculta la categoría al dar de alta movimientos, pero conserva
   * los movimientos que ya la usan (criterio de T-027).
   */
  async function archivar(id: string, archivada: boolean): Promise<Categoria> {
    await exigir(id);
    await bd.ejecutar('UPDATE categoria SET archivada = ?, modificado_en = ? WHERE id = ?', [
      archivada ? 1 : 0,
      entorno.ahora().toISOString(),
      id,
    ]);
    return (await obtener(id))!;
  }

  /**
   * Guarda el icono y el color elegidos para una categoría. `null` vuelve al
   * valor que la app deriva sola. El color es un "#RRGGBB" de la paleta.
   */
  async function cambiarAspecto(
    id: string,
    aspecto: { icono: string | null; color: string | null },
  ): Promise<Categoria> {
    await exigir(id);
    if (aspecto.color !== null && !/^#[0-9a-f]{6}$/i.test(aspecto.color)) {
      throw new ErrorDeDominio('color_no_valido');
    }
    const icono = aspecto.icono?.trim() || null;
    await bd.ejecutar('UPDATE categoria SET icono = ?, color = ?, modificado_en = ? WHERE id = ?', [
      icono,
      aspecto.color?.toUpperCase() ?? null,
      entorno.ahora().toISOString(),
      id,
    ]);
    return (await obtener(id))!;
  }

  /** Borrado lógico. Los movimientos que la usaban la conservan como referencia. */
  async function borrar(id: string): Promise<void> {
    await exigir(id);
    const ahora = entorno.ahora().toISOString();
    await bd.ejecutar('UPDATE categoria SET borrado_en = ?, modificado_en = ? WHERE id = ?', [
      ahora,
      ahora,
      id,
    ]);
  }

  /** Deshace un borrado. Si no estaba borrada, no cambia nada. */
  async function restaurar(id: string): Promise<Categoria> {
    const categoria = await obtener(id);
    if (!categoria) throw new ErrorDeDominio('categoria_no_encontrada');
    if (categoria.borradoEn === null) return categoria;
    await bd.ejecutar('UPDATE categoria SET borrado_en = NULL, modificado_en = ? WHERE id = ?', [
      entorno.ahora().toISOString(),
      id,
    ]);
    return (await obtener(id))!;
  }

  /**
   * Categorías activas de un tipo, primero las más usadas en movimientos.
   * Alimenta la fila de frecuentes de P07.
   */
  async function frecuentes(tipo: TipoDeCategoria): Promise<Categoria[]> {
    const filas = await bd.consultar<FilaCategoria>(
      `SELECT c.* FROM categoria c
       LEFT JOIN movimiento m ON m.categoria_id = c.id AND m.borrado_en IS NULL
       WHERE c.borrado_en IS NULL AND c.archivada = 0 AND c.tipo = ?
       GROUP BY c.id
       ORDER BY COUNT(m.id) DESC, c.orden, c.creado_en`,
      [tipo],
    );
    return filas.map(filaACategoria);
  }

  return {
    obtener,
    exigir,
    listar,
    crear,
    renombrar,
    ordenar,
    archivar,
    cambiarAspecto,
    borrar,
    restaurar,
    frecuentes,
  };
}

export type RepositorioDeCategorias = ReturnType<typeof crearRepositorioDeCategorias>;
