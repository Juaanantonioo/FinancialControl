/**
 * Repositorio de movimientos: gastos, ingresos, transferencias y ajustes
 * (T-020, T-023, T-024, T-025 y T-028).
 */
import {
  ErrorDeDominio,
  esFechaValida,
  normalizarNombre,
  ORIGENES_DE_MOVIMIENTO,
  TIPOS_DE_MOVIMIENTO,
  type Movimiento,
  type OrigenDeMovimiento,
  type TipoDeMovimiento,
} from '@/dominio/modelo';

import type { BaseDeDatos, Entorno, ValorSql } from './bd';
import { filaACategoria, type FilaCategoria } from './categorias';
import { filaACuenta, type FilaCuenta } from './cuentas';
import { filaAMovimiento, type FilaMovimiento } from './filas';

export type DatosDeMovimiento = {
  tipo: TipoDeMovimiento;
  /** "AAAA-MM-DD". */
  fecha: string;
  /** Céntimos. Positivo salvo en ajustes, que llevan signo. */
  importe: number;
  cuentaId: string;
  cuentaDestinoId?: string | null;
  categoriaId?: string | null;
  nombre?: string;
  comercio?: string | null;
  nota?: string | null;
  origen?: OrigenDeMovimiento;
  /** Regla recurrente que confirma este movimiento (H5). */
  reglaRecurrenteId?: string | null;
  /** Objetivo al que aporta este movimiento (H5). */
  objetivoId?: string | null;
};

/** Movimiento con los nombres que la lista necesita mostrar. */
export type MovimientoListado = Movimiento & {
  cuentaNombre: string;
  cuentaDestinoNombre: string | null;
  categoriaNombre: string | null;
};

export type FiltroDeMovimientos = {
  /** Texto a buscar en nombre, comercio, nota y categoría. */
  texto?: string;
  cuentaId?: string;
  categoriaId?: string;
  /** "AAAA-MM". */
  mes?: string;
  /** "AAAA-MM-DD". */
  dia?: string;
};

export type GrupoPorDia = { fecha: string; movimientos: MovimientoListado[] };

type FilaListado = FilaMovimiento & {
  cuenta_nombre: string;
  cuenta_destino_nombre: string | null;
  categoria_nombre: string | null;
};

function textoONulo(valor: string | null | undefined): string | null {
  const limpio = (valor ?? '').trim();
  return limpio === '' ? null : limpio;
}

/** Agrupa una lista ya ordenada por fecha en bloques de un mismo día. */
export function agruparPorDia(movimientos: MovimientoListado[]): GrupoPorDia[] {
  const grupos: GrupoPorDia[] = [];
  for (const mov of movimientos) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.fecha === mov.fecha) ultimo.movimientos.push(mov);
    else grupos.push({ fecha: mov.fecha, movimientos: [mov] });
  }
  return grupos;
}

/** `true` si el movimiento contiene el texto, sin distinguir mayúsculas ni acentos. */
export function coincideConTexto(mov: MovimientoListado, texto: string): boolean {
  const buscado = normalizarNombre(texto);
  if (buscado === '') return true;
  return [mov.nombre, mov.comercio, mov.nota, mov.categoriaNombre].some(
    (campo) => campo !== null && normalizarNombre(campo).includes(buscado),
  );
}

export function crearRepositorioDeMovimientos(bd: BaseDeDatos, entorno: Entorno) {
  async function obtener(id: string): Promise<Movimiento | null> {
    const filas = await bd.consultar<FilaMovimiento>('SELECT * FROM movimiento WHERE id = ?', [id]);
    return filas[0] ? filaAMovimiento(filas[0]) : null;
  }

  /**
   * Comprueba las reglas de negocio y devuelve los valores listos para
   * guardar. `anterior` es el movimiento que se está editando, si lo hay:
   * permite conservar una cuenta o una categoría que se archivó después.
   */
  async function validar(datos: DatosDeMovimiento, anterior: Movimiento | null) {
    if (!TIPOS_DE_MOVIMIENTO.includes(datos.tipo)) throw new ErrorDeDominio('no_encontrado');
    if (!esFechaValida(datos.fecha)) throw new ErrorDeDominio('fecha_no_valida');

    if (!Number.isSafeInteger(datos.importe)) throw new ErrorDeDominio('importe_no_valido');
    if (datos.importe === 0) throw new ErrorDeDominio('importe_cero');
    if (datos.tipo !== 'ajuste' && datos.importe < 0) throw new ErrorDeDominio('importe_no_valido');

    const origen = datos.origen ?? 'manual';
    if (!ORIGENES_DE_MOVIMIENTO.includes(origen)) throw new ErrorDeDominio('no_encontrado');

    const cuenta = await cuentaActiva(datos.cuentaId, anterior?.cuentaId ?? null);

    let cuentaDestinoId: string | null = null;
    let categoriaId: string | null = null;

    if (datos.tipo === 'transferencia') {
      if (!datos.cuentaDestinoId) throw new ErrorDeDominio('cuenta_destino_obligatoria');
      if (datos.cuentaDestinoId === datos.cuentaId) throw new ErrorDeDominio('misma_cuenta');
      const destino = await cuentaActiva(datos.cuentaDestinoId, anterior?.cuentaDestinoId ?? null);
      // Sin conversión de divisas en V1 (docs/04, A.5).
      if (destino.divisa !== cuenta.divisa) throw new ErrorDeDominio('divisas_distintas');
      cuentaDestinoId = destino.id;
    } else if (datos.tipo === 'gasto' || datos.tipo === 'ingreso') {
      if (datos.categoriaId) {
        const filas = await bd.consultar<FilaCategoria>('SELECT * FROM categoria WHERE id = ?', [
          datos.categoriaId,
        ]);
        const categoria = filas[0] ? filaACategoria(filas[0]) : null;
        if (!categoria || categoria.borradoEn !== null) {
          throw new ErrorDeDominio('categoria_no_encontrada');
        }
        if (categoria.tipo !== datos.tipo) throw new ErrorDeDominio('categoria_de_otro_tipo');
        if (categoria.archivada && anterior?.categoriaId !== categoria.id) {
          throw new ErrorDeDominio('categoria_archivada');
        }
        categoriaId = categoria.id;
      }
    }
    // En transferencias y ajustes la categoría y, salvo en transferencias, el
    // destino se descartan aunque lleguen: no tienen sentido en esos tipos.

    return {
      tipo: datos.tipo,
      fecha: datos.fecha,
      importe: datos.importe,
      divisa: cuenta.divisa,
      cuentaId: cuenta.id,
      cuentaDestinoId,
      categoriaId,
      nombre: (datos.nombre ?? '').trim().replace(/\s+/g, ' '),
      comercio: textoONulo(datos.comercio),
      nota: textoONulo(datos.nota),
      origen,
    };
  }

  async function cuentaActiva(id: string, idYaAsignado: string | null) {
    const filas = await bd.consultar<FilaCuenta>('SELECT * FROM cuenta WHERE id = ?', [id]);
    const cuenta = filas[0] ? filaACuenta(filas[0]) : null;
    if (!cuenta || cuenta.borradoEn !== null) throw new ErrorDeDominio('cuenta_no_encontrada');
    if (cuenta.archivada && idYaAsignado !== cuenta.id)
      throw new ErrorDeDominio('cuenta_archivada');
    return cuenta;
  }

  async function crear(datos: DatosDeMovimiento): Promise<Movimiento> {
    const v = await validar(datos, null);
    const id = entorno.generarId();
    const ahora = entorno.ahora().toISOString();
    await bd.ejecutar(
      `INSERT INTO movimiento (id, tipo, fecha, importe, divisa, cuenta_id, cuenta_destino_id,
                               categoria_id, nombre, comercio, nota, origen,
                               regla_recurrente_id, objetivo_id,
                               creado_en, modificado_en, borrado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        id,
        v.tipo,
        v.fecha,
        v.importe,
        v.divisa,
        v.cuentaId,
        v.cuentaDestinoId,
        v.categoriaId,
        v.nombre,
        v.comercio,
        v.nota,
        v.origen,
        datos.reglaRecurrenteId ?? null,
        datos.objetivoId ?? null,
        ahora,
        ahora,
      ],
    );
    return (await obtener(id))!;
  }

  async function modificar(id: string, datos: DatosDeMovimiento): Promise<Movimiento> {
    const anterior = await obtener(id);
    if (!anterior || anterior.borradoEn !== null) throw new ErrorDeDominio('no_encontrado');
    // El origen no cambia al editar: un pago capturado sigue siendo capturado.
    const v = await validar({ ...datos, origen: anterior.origen }, anterior);
    await bd.ejecutar(
      `UPDATE movimiento SET tipo = ?, fecha = ?, importe = ?, divisa = ?, cuenta_id = ?,
              cuenta_destino_id = ?, categoria_id = ?, nombre = ?, comercio = ?, nota = ?,
              modificado_en = ?
       WHERE id = ?`,
      [
        v.tipo,
        v.fecha,
        v.importe,
        v.divisa,
        v.cuentaId,
        v.cuentaDestinoId,
        v.categoriaId,
        v.nombre,
        v.comercio,
        v.nota,
        entorno.ahora().toISOString(),
        id,
      ],
    );
    return (await obtener(id))!;
  }

  /** Borrado lógico (T-028). Borrar algo ya borrado no cambia nada. */
  async function borrar(id: string): Promise<void> {
    const mov = await obtener(id);
    if (!mov) throw new ErrorDeDominio('no_encontrado');
    if (mov.borradoEn !== null) return;
    const ahora = entorno.ahora().toISOString();
    await bd.transaccion(async () => {
      await bd.ejecutar('UPDATE movimiento SET borrado_en = ?, modificado_en = ? WHERE id = ?', [
        ahora,
        ahora,
        id,
      ]);
      // Si el movimiento aportaba a un objetivo, su aportación se borra con él
      // y con la misma marca de tiempo, para poder recuperarlas juntas.
      if (mov.objetivoId !== null) {
        await bd.ejecutar(
          `UPDATE aportacion_a_objetivo SET borrado_en = ?, modificado_en = ?
           WHERE movimiento_id = ? AND borrado_en IS NULL`,
          [ahora, ahora, id],
        );
      }
    });
  }

  /**
   * Deshace un borrado (T-028): el movimiento vuelve con los mismos datos.
   * Deshacer dos veces es inofensivo: la segunda no cambia nada.
   */
  async function restaurar(id: string): Promise<Movimiento> {
    const mov = await obtener(id);
    if (!mov) throw new ErrorDeDominio('no_encontrado');
    if (mov.borradoEn === null) return mov;
    const ahora = entorno.ahora().toISOString();
    await bd.transaccion(async () => {
      await bd.ejecutar('UPDATE movimiento SET borrado_en = NULL, modificado_en = ? WHERE id = ?', [
        ahora,
        id,
      ]);
      // Recupera la aportación que se borró junto con el movimiento.
      if (mov.objetivoId !== null) {
        await bd.ejecutar(
          `UPDATE aportacion_a_objetivo SET borrado_en = NULL, modificado_en = ?
           WHERE movimiento_id = ? AND borrado_en = ?`,
          [ahora, id, mov.borradoEn],
        );
      }
    });
    return (await obtener(id))!;
  }

  /**
   * Movimientos no borrados, del más reciente al más antiguo (T-025).
   * Los filtros por cuenta, categoría y mes se aplican en SQL. La búsqueda
   * de texto se aplica después en memoria, porque SQLite no sabe ignorar
   * acentos por sí solo.
   */
  async function listar(filtro: FiltroDeMovimientos = {}): Promise<MovimientoListado[]> {
    const condiciones = ['m.borrado_en IS NULL'];
    const parametros: ValorSql[] = [];
    if (filtro.cuentaId) {
      // Una transferencia aparece tanto en la cuenta de origen como en la de destino.
      condiciones.push('(m.cuenta_id = ? OR m.cuenta_destino_id = ?)');
      parametros.push(filtro.cuentaId, filtro.cuentaId);
    }
    if (filtro.categoriaId) {
      // Una categoría principal incluye los movimientos de sus subcategorías,
      // a cualquier nivel (consulta recursiva sobre `padre_id`).
      condiciones.push(
        `m.categoria_id IN (
           WITH RECURSIVE rama (id) AS (
             SELECT ?
             UNION
             SELECT c.id FROM categoria c JOIN rama ON c.padre_id = rama.id
           )
           SELECT id FROM rama
         )`,
      );
      parametros.push(filtro.categoriaId);
    }
    if (filtro.dia) {
      condiciones.push('m.fecha = ?');
      parametros.push(filtro.dia);
    }
    if (filtro.mes) {
      condiciones.push('substr(m.fecha, 1, 7) = ?');
      parametros.push(filtro.mes);
    }
    const filas = await bd.consultar<FilaListado>(
      `SELECT m.*, c.nombre AS cuenta_nombre, d.nombre AS cuenta_destino_nombre,
              k.nombre AS categoria_nombre
       FROM movimiento m
       JOIN cuenta c ON c.id = m.cuenta_id
       LEFT JOIN cuenta d ON d.id = m.cuenta_destino_id
       LEFT JOIN categoria k ON k.id = m.categoria_id
       WHERE ${condiciones.join(' AND ')}
       ORDER BY m.fecha DESC, m.creado_en DESC, m.id`,
      parametros,
    );
    const lista = filas.map((f) => ({
      ...filaAMovimiento(f),
      cuentaNombre: f.cuenta_nombre,
      cuentaDestinoNombre: f.cuenta_destino_nombre,
      categoriaNombre: f.categoria_nombre,
    }));
    const texto = filtro.texto ?? '';
    return texto.trim() === '' ? lista : lista.filter((m) => coincideConTexto(m, texto));
  }

  /** Meses ("AAAA-MM") que tienen algún movimiento, del más reciente al más antiguo. */
  async function mesesConMovimientos(): Promise<string[]> {
    const filas = await bd.consultar<{ mes: string }>(
      `SELECT DISTINCT substr(fecha, 1, 7) AS mes FROM movimiento
       WHERE borrado_en IS NULL ORDER BY mes DESC`,
    );
    return filas.map((f) => f.mes);
  }

  /** Cuenta del último movimiento creado, para proponerla en el alta (flujo F2). */
  async function ultimaCuentaUsada(): Promise<string | null> {
    const filas = await bd.consultar<{ cuenta_id: string }>(
      `SELECT m.cuenta_id FROM movimiento m
       JOIN cuenta c ON c.id = m.cuenta_id
       WHERE m.borrado_en IS NULL AND c.borrado_en IS NULL AND c.archivada = 0
       ORDER BY m.creado_en DESC LIMIT 1`,
    );
    return filas[0]?.cuenta_id ?? null;
  }

  /**
   * Categoría del último movimiento con ese mismo nombre, si sigue activa.
   * Permite que un nombre ya conocido rellene la categoría sola (flujo F2).
   */
  async function sugerirCategoria(
    nombre: string,
    tipo: 'gasto' | 'ingreso',
  ): Promise<string | null> {
    const buscado = normalizarNombre(nombre);
    if (buscado === '') return null;
    const filas = await bd.consultar<{ nombre: string; categoria_id: string }>(
      `SELECT m.nombre, m.categoria_id FROM movimiento m
       JOIN categoria k ON k.id = m.categoria_id
       WHERE m.borrado_en IS NULL AND m.tipo = ? AND m.nombre <> ''
         AND k.borrado_en IS NULL AND k.archivada = 0
       ORDER BY m.creado_en DESC`,
      [tipo],
    );
    return filas.find((f) => normalizarNombre(f.nombre) === buscado)?.categoria_id ?? null;
  }

  return {
    obtener,
    crear,
    modificar,
    borrar,
    restaurar,
    listar,
    mesesConMovimientos,
    ultimaCuentaUsada,
    sugerirCategoria,
  };
}

export type RepositorioDeMovimientos = ReturnType<typeof crearRepositorioDeMovimientos>;
