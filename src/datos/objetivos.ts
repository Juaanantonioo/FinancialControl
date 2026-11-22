/**
 * Repositorio de objetivos y de sus aportaciones (T-070 a T-072).
 *
 * El avance de un objetivo no se guarda: es la suma de sus aportaciones.
 * Una aportación puede ir enlazada a un movimiento (una transferencia a la
 * cuenta del objetivo) o ser solo un apunte.
 */
import { ErrorDeDominio, esFechaValida, normalizarNombre } from '@/dominio/modelo';
import {
  TIPOS_DE_OBJETIVO,
  type AportacionAObjetivo,
  type Objetivo,
  type TipoDeObjetivo,
} from '@/dominio/objetivos';

import { exigirLongitud } from '@/dominio/textos';
import type { BaseDeDatos, Entorno } from './bd';
import type { RepositorioDeMovimientos } from './movimientos';

type FilaObjetivo = {
  id: string;
  nombre: string;
  tipo: TipoDeObjetivo;
  meta: number;
  divisa: string;
  fecha_limite: string | null;
  cuenta_id: string | null;
  archivado: number;
  creado_en: string;
  modificado_en: string;
  borrado_en: string | null;
};

function filaAObjetivo(f: FilaObjetivo): Objetivo {
  return {
    id: f.id,
    nombre: f.nombre,
    tipo: f.tipo,
    meta: f.meta,
    divisa: f.divisa,
    fechaLimite: f.fecha_limite,
    cuentaId: f.cuenta_id,
    archivado: f.archivado === 1,
    creadoEn: f.creado_en,
    modificadoEn: f.modificado_en,
    borradoEn: f.borrado_en,
  };
}

type FilaAportacion = {
  id: string;
  objetivo_id: string;
  fecha: string;
  importe: number;
  movimiento_id: string | null;
  nota: string | null;
  creado_en: string;
  modificado_en: string;
  borrado_en: string | null;
};

function filaAAportacion(f: FilaAportacion): AportacionAObjetivo {
  return {
    id: f.id,
    objetivoId: f.objetivo_id,
    fecha: f.fecha,
    importe: f.importe,
    movimientoId: f.movimiento_id,
    nota: f.nota,
    creadoEn: f.creado_en,
    modificadoEn: f.modificado_en,
    borradoEn: f.borrado_en,
  };
}

export type DatosDeObjetivo = {
  nombre: string;
  tipo: TipoDeObjetivo;
  meta: number;
  fechaLimite?: string | null;
  cuentaId?: string | null;
};

export type DatosDeAportacion = {
  objetivoId: string;
  fecha: string;
  importe: number;
  movimientoId?: string | null;
  nota?: string | null;
};

export type DatosDeMovimientoDeDinero = {
  objetivoId: string;
  fecha: string;
  importe: number;
  cuentaId: string;
  cuentaDestinoId: string;
};

export function crearRepositorioDeObjetivos(
  bd: BaseDeDatos,
  entorno: Entorno,
  movimientos: RepositorioDeMovimientos,
) {
  async function obtener(id: string): Promise<Objetivo | null> {
    const filas = await bd.consultar<FilaObjetivo>('SELECT * FROM objetivo WHERE id = ?', [id]);
    return filas[0] ? filaAObjetivo(filas[0]) : null;
  }

  async function exigir(id: string): Promise<Objetivo> {
    const objetivo = await obtener(id);
    if (!objetivo || objetivo.borradoEn !== null)
      throw new ErrorDeDominio('objetivo_no_encontrado');
    return objetivo;
  }

  /** Objetivos no borrados, del más antiguo al más reciente. Los archivados solo si se piden. */
  async function listar(opciones: { incluirArchivados?: boolean } = {}): Promise<Objetivo[]> {
    const filas = await bd.consultar<FilaObjetivo>(
      `SELECT * FROM objetivo WHERE borrado_en IS NULL
       ${opciones.incluirArchivados ? '' : 'AND archivado = 0'}
       ORDER BY creado_en, id`,
    );
    return filas.map(filaAObjetivo);
  }

  /** Comprueba las reglas y devuelve los valores listos para guardar. */
  async function validar(datos: DatosDeObjetivo, idPropio: string | null) {
    const nombre = datos.nombre.trim().replace(/\s+/g, ' ');
    if (nombre === '') throw new ErrorDeDominio('nombre_vacio');
    if (idPropio === null) exigirLongitud(nombre, 'nombre');
    else exigirLongitud(nombre, 'nombre', (await obtener(idPropio))?.nombre);
    const existentes = await bd.consultar<{ id: string; nombre: string }>(
      'SELECT id, nombre FROM objetivo WHERE borrado_en IS NULL',
    );
    const buscado = normalizarNombre(nombre);
    if (existentes.some((o) => o.id !== idPropio && normalizarNombre(o.nombre) === buscado)) {
      throw new ErrorDeDominio('nombre_duplicado');
    }
    if (!TIPOS_DE_OBJETIVO.includes(datos.tipo)) throw new ErrorDeDominio('no_encontrado');
    if (!Number.isSafeInteger(datos.meta) || datos.meta <= 0) {
      throw new ErrorDeDominio('meta_no_valida');
    }
    const fechaLimite = datos.fechaLimite ?? null;
    if (fechaLimite !== null && !esFechaValida(fechaLimite)) {
      throw new ErrorDeDominio('fecha_no_valida');
    }
    const cuentaId = datos.cuentaId ?? null;
    let divisa = 'EUR';
    if (cuentaId !== null) {
      const cuentas = await bd.consultar<{ divisa: string }>(
        'SELECT divisa FROM cuenta WHERE id = ? AND borrado_en IS NULL',
        [cuentaId],
      );
      if (!cuentas[0]) throw new ErrorDeDominio('cuenta_no_encontrada');
      // El objetivo se mide en la divisa de su cuenta.
      divisa = cuentas[0].divisa;
    }
    return { nombre, tipo: datos.tipo, meta: datos.meta, fechaLimite, cuentaId, divisa };
  }

  async function crear(datos: DatosDeObjetivo): Promise<Objetivo> {
    const v = await validar(datos, null);
    const id = entorno.generarId();
    const ahora = entorno.ahora().toISOString();
    await bd.ejecutar(
      `INSERT INTO objetivo (id, nombre, tipo, meta, divisa, fecha_limite, cuenta_id, archivado,
                             creado_en, modificado_en, borrado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)`,
      [id, v.nombre, v.tipo, v.meta, v.divisa, v.fechaLimite, v.cuentaId, ahora, ahora],
    );
    return (await obtener(id))!;
  }

  async function modificar(id: string, datos: DatosDeObjetivo): Promise<Objetivo> {
    const anterior = await exigir(id);
    const v = await validar(datos, id);
    // Sin cuenta asociada se conserva la divisa que ya tenía.
    const divisa = v.cuentaId === null ? anterior.divisa : v.divisa;
    await bd.ejecutar(
      `UPDATE objetivo SET nombre = ?, tipo = ?, meta = ?, divisa = ?, fecha_limite = ?,
                           cuenta_id = ?, modificado_en = ? WHERE id = ?`,
      [
        v.nombre,
        v.tipo,
        v.meta,
        divisa,
        v.fechaLimite,
        v.cuentaId,
        entorno.ahora().toISOString(),
        id,
      ],
    );
    return (await obtener(id))!;
  }

  async function archivar(id: string, archivado: boolean): Promise<Objetivo> {
    await exigir(id);
    await bd.ejecutar('UPDATE objetivo SET archivado = ?, modificado_en = ? WHERE id = ?', [
      archivado ? 1 : 0,
      entorno.ahora().toISOString(),
      id,
    ]);
    return (await obtener(id))!;
  }

  /** Borrado lógico. Sus aportaciones se conservan y vuelven a contar si se deshace. */
  async function borrar(id: string): Promise<void> {
    await exigir(id);
    const ahora = entorno.ahora().toISOString();
    await bd.transaccion(async () => {
      await bd.ejecutar('UPDATE objetivo SET borrado_en = ?, modificado_en = ? WHERE id = ?', [
        ahora,
        ahora,
        id,
      ]);
      // Sus reglas de aportación mensual se borran con él y con la misma marca
      // de tiempo: sin objetivo seguirían pidiendo cobros que no suman a nada.
      await bd.ejecutar(
        `UPDATE regla_recurrente SET borrado_en = ?, modificado_en = ?
         WHERE objetivo_id = ? AND borrado_en IS NULL`,
        [ahora, ahora, id],
      );
    });
  }

  /** Deshace un borrado: recupera el objetivo y las reglas que se borraron con él. */
  async function restaurar(id: string): Promise<Objetivo> {
    const objetivo = await obtener(id);
    if (!objetivo) throw new ErrorDeDominio('objetivo_no_encontrado');
    if (objetivo.borradoEn === null) return objetivo;
    const ahora = entorno.ahora().toISOString();
    await bd.transaccion(async () => {
      await bd.ejecutar('UPDATE objetivo SET borrado_en = NULL, modificado_en = ? WHERE id = ?', [
        ahora,
        id,
      ]);
      // Solo las que se borraron en el mismo instante que el objetivo: una
      // regla que la persona borró antes a mano sigue borrada.
      await bd.ejecutar(
        `UPDATE regla_recurrente SET borrado_en = NULL, modificado_en = ?
         WHERE objetivo_id = ? AND borrado_en = ?`,
        [ahora, id, objetivo.borradoEn],
      );
    });
    return (await obtener(id))!;
  }

  // ------------------------------------------------------------ aportaciones

  async function obtenerAportacion(id: string): Promise<AportacionAObjetivo | null> {
    const filas = await bd.consultar<FilaAportacion>(
      'SELECT * FROM aportacion_a_objetivo WHERE id = ?',
      [id],
    );
    return filas[0] ? filaAAportacion(filas[0]) : null;
  }

  /** Anota una aportación. `movimientoId` la enlaza a la transferencia que la originó. */
  async function aportar(datos: DatosDeAportacion): Promise<AportacionAObjetivo> {
    const objetivo = await exigir(datos.objetivoId);
    if (objetivo.archivado) throw new ErrorDeDominio('objetivo_archivado');
    if (!esFechaValida(datos.fecha)) throw new ErrorDeDominio('fecha_no_valida');
    if (!Number.isSafeInteger(datos.importe)) throw new ErrorDeDominio('importe_no_valido');
    if (datos.importe === 0) throw new ErrorDeDominio('importe_cero');
    if (datos.importe < 0) throw new ErrorDeDominio('importe_no_valido');
    const id = entorno.generarId();
    const ahora = entorno.ahora().toISOString();
    const nota = (datos.nota ?? '').trim();
    exigirLongitud(nota, 'nota');
    await bd.ejecutar(
      `INSERT INTO aportacion_a_objetivo (id, objetivo_id, fecha, importe, movimiento_id, nota,
                                          creado_en, modificado_en, borrado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        id,
        objetivo.id,
        datos.fecha,
        datos.importe,
        datos.movimientoId ?? null,
        nota === '' ? null : nota,
        ahora,
        ahora,
      ],
    );
    return (await obtenerAportacion(id))!;
  }

  /**
   * «Mover dinero»: crea una transferencia entre dos cuentas, marcada con el
   * objetivo, y la aportación enlazada a ella. O se guardan las dos cosas o
   * ninguna. Las reglas de la transferencia (cuentas distintas, misma
   * divisa, importe mayor que cero) son las de cualquier movimiento.
   */
  async function moverDinero(datos: DatosDeMovimientoDeDinero): Promise<AportacionAObjetivo> {
    const objetivo = await exigir(datos.objetivoId);
    if (objetivo.archivado) throw new ErrorDeDominio('objetivo_archivado');
    return bd.transaccion(async () => {
      const mov = await movimientos.crear({
        tipo: 'transferencia',
        fecha: datos.fecha,
        importe: datos.importe,
        cuentaId: datos.cuentaId,
        cuentaDestinoId: datos.cuentaDestinoId,
        nombre: objetivo.nombre,
        objetivoId: objetivo.id,
      });
      return aportar({
        objetivoId: objetivo.id,
        fecha: mov.fecha,
        importe: mov.importe,
        movimientoId: mov.id,
      });
    });
  }

  async function borrarAportacion(id: string): Promise<void> {
    const aportacion = await obtenerAportacion(id);
    if (!aportacion || aportacion.borradoEn !== null) {
      throw new ErrorDeDominio('aportacion_no_encontrada');
    }
    const ahora = entorno.ahora().toISOString();
    await bd.ejecutar(
      'UPDATE aportacion_a_objetivo SET borrado_en = ?, modificado_en = ? WHERE id = ?',
      [ahora, ahora, id],
    );
  }

  async function restaurarAportacion(id: string): Promise<AportacionAObjetivo> {
    const aportacion = await obtenerAportacion(id);
    if (!aportacion) throw new ErrorDeDominio('aportacion_no_encontrada');
    await bd.ejecutar(
      'UPDATE aportacion_a_objetivo SET borrado_en = NULL, modificado_en = ? WHERE id = ?',
      [entorno.ahora().toISOString(), id],
    );
    return (await obtenerAportacion(id))!;
  }

  /** Aportaciones no borradas, de la más reciente a la más antigua. De un objetivo o de todos. */
  async function listarAportaciones(objetivoId?: string): Promise<AportacionAObjetivo[]> {
    const filas = await bd.consultar<FilaAportacion>(
      `SELECT * FROM aportacion_a_objetivo WHERE borrado_en IS NULL
       ${objetivoId ? 'AND objetivo_id = ?' : ''}
       ORDER BY fecha DESC, creado_en DESC, id`,
      objetivoId ? [objetivoId] : [],
    );
    return filas.map(filaAAportacion);
  }

  return {
    obtener,
    exigir,
    listar,
    crear,
    modificar,
    archivar,
    borrar,
    restaurar,
    aportar,
    moverDinero,
    obtenerAportacion,
    borrarAportacion,
    restaurarAportacion,
    listarAportaciones,
  };
}

export type RepositorioDeObjetivos = ReturnType<typeof crearRepositorioDeObjetivos>;
