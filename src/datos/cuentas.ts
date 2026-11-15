/**
 * Repositorio de cuentas: única puerta de entrada a la tabla `cuenta`.
 * Aplica las reglas de negocio antes de tocar la base de datos.
 */
import {
  ErrorDeDominio,
  esFechaValida,
  fechaLocal,
  normalizarNombre,
  TIPOS_DE_CUENTA,
  type Cuenta,
  type TipoDeCuenta,
} from '@/dominio/modelo';
import { calcularSaldo } from '@/dominio/saldo';

import type { BaseDeDatos, Entorno } from './bd';
import { filaAMovimiento, type FilaMovimiento } from './filas';

export type FilaCuenta = {
  id: string;
  nombre: string;
  tipo: TipoDeCuenta;
  divisa: string;
  saldo_inicial: number;
  fecha_saldo_inicial: string;
  archivada: number;
  orden: number;
  creado_en: string;
  modificado_en: string;
  borrado_en: string | null;
};

export function filaACuenta(f: FilaCuenta): Cuenta {
  return {
    id: f.id,
    nombre: f.nombre,
    tipo: f.tipo,
    divisa: f.divisa,
    saldoInicial: f.saldo_inicial,
    fechaSaldoInicial: f.fecha_saldo_inicial,
    archivada: f.archivada === 1,
    orden: f.orden,
    creadoEn: f.creado_en,
    modificadoEn: f.modificado_en,
    borradoEn: f.borrado_en,
  };
}

export type DatosDeCuenta = {
  nombre: string;
  tipo: TipoDeCuenta;
  /** Céntimos. Por defecto 0. */
  saldoInicial?: number;
  /** Por defecto, hoy. */
  fechaSaldoInicial?: string;
  /** Por defecto, "EUR". Solo se fija al crear. */
  divisa?: string;
};

export type CuentaConSaldo = Cuenta & { saldo: number };

export function crearRepositorioDeCuentas(bd: BaseDeDatos, entorno: Entorno) {
  async function obtener(id: string): Promise<Cuenta | null> {
    const filas = await bd.consultar<FilaCuenta>('SELECT * FROM cuenta WHERE id = ?', [id]);
    return filas[0] ? filaACuenta(filas[0]) : null;
  }

  async function exigir(id: string): Promise<Cuenta> {
    const cuenta = await obtener(id);
    if (!cuenta || cuenta.borradoEn !== null) throw new ErrorDeDominio('cuenta_no_encontrada');
    return cuenta;
  }

  /** Cuentas no borradas. Las archivadas solo si se piden. */
  async function listar(opciones: { incluirArchivadas?: boolean } = {}): Promise<Cuenta[]> {
    const filas = await bd.consultar<FilaCuenta>(
      `SELECT * FROM cuenta WHERE borrado_en IS NULL
       ${opciones.incluirArchivadas ? '' : 'AND archivada = 0'}
       ORDER BY orden, creado_en`,
    );
    return filas.map(filaACuenta);
  }

  async function validarNombre(nombre: string, idPropio: string | null): Promise<string> {
    const limpio = nombre.trim().replace(/\s+/g, ' ');
    if (limpio === '') throw new ErrorDeDominio('nombre_vacio');
    const existentes = await listar({ incluirArchivadas: true });
    const clave = normalizarNombre(limpio);
    if (existentes.some((c) => c.id !== idPropio && normalizarNombre(c.nombre) === clave)) {
      throw new ErrorDeDominio('nombre_duplicado');
    }
    return limpio;
  }

  function validarComunes(datos: DatosDeCuenta): { saldoInicial: number; fecha: string } {
    if (!TIPOS_DE_CUENTA.includes(datos.tipo)) throw new ErrorDeDominio('no_encontrado');
    const saldoInicial = datos.saldoInicial ?? 0;
    if (!Number.isSafeInteger(saldoInicial)) throw new ErrorDeDominio('importe_no_valido');
    const fecha = datos.fechaSaldoInicial ?? fechaLocal(entorno.ahora());
    if (!esFechaValida(fecha)) throw new ErrorDeDominio('fecha_no_valida');
    return { saldoInicial, fecha };
  }

  async function crear(datos: DatosDeCuenta): Promise<Cuenta> {
    const nombre = await validarNombre(datos.nombre, null);
    const { saldoInicial, fecha } = validarComunes(datos);
    const divisa = datos.divisa ?? 'EUR';
    if (!/^[A-Z]{3}$/.test(divisa)) throw new ErrorDeDominio('divisa_no_valida');
    const id = entorno.generarId();
    const ahora = entorno.ahora().toISOString();
    const [{ siguiente }] = await bd.consultar<{ siguiente: number }>(
      'SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM cuenta',
    );
    await bd.ejecutar(
      `INSERT INTO cuenta (id, nombre, tipo, divisa, saldo_inicial, fecha_saldo_inicial,
                           archivada, orden, creado_en, modificado_en, borrado_en)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, NULL)`,
      [id, nombre, datos.tipo, divisa, saldoInicial, fecha, siguiente, ahora, ahora],
    );
    return (await obtener(id))!;
  }

  /** Cambia nombre, tipo, saldo inicial y su fecha. La divisa no se puede cambiar. */
  async function modificar(id: string, datos: DatosDeCuenta): Promise<Cuenta> {
    await exigir(id);
    const nombre = await validarNombre(datos.nombre, id);
    const { saldoInicial, fecha } = validarComunes(datos);
    await bd.ejecutar(
      `UPDATE cuenta SET nombre = ?, tipo = ?, saldo_inicial = ?, fecha_saldo_inicial = ?,
                         modificado_en = ? WHERE id = ?`,
      [nombre, datos.tipo, saldoInicial, fecha, entorno.ahora().toISOString(), id],
    );
    return (await obtener(id))!;
  }

  /** Una cuenta archivada conserva sus movimientos pero no admite nuevos. */
  async function archivar(id: string, archivada: boolean): Promise<Cuenta> {
    await exigir(id);
    await bd.ejecutar('UPDATE cuenta SET archivada = ?, modificado_en = ? WHERE id = ?', [
      archivada ? 1 : 0,
      entorno.ahora().toISOString(),
      id,
    ]);
    return (await obtener(id))!;
  }

  /**
   * Borrado lógico. Una cuenta con movimientos no se puede borrar: dejaría
   * movimientos sin cuenta y descuadraría las transferencias de las demás.
   * Para retirarla hay que archivarla.
   */
  async function borrar(id: string): Promise<void> {
    await exigir(id);
    const [{ total }] = await bd.consultar<{ total: number }>(
      `SELECT COUNT(*) AS total FROM movimiento
       WHERE borrado_en IS NULL AND (cuenta_id = ? OR cuenta_destino_id = ?)`,
      [id, id],
    );
    if (total > 0) throw new ErrorDeDominio('cuenta_con_movimientos');
    const ahora = entorno.ahora().toISOString();
    await bd.ejecutar('UPDATE cuenta SET borrado_en = ?, modificado_en = ? WHERE id = ?', [
      ahora,
      ahora,
      id,
    ]);
  }

  /** Deshace un borrado. Si la cuenta no estaba borrada, no cambia nada. */
  async function restaurar(id: string): Promise<Cuenta> {
    const cuenta = await obtener(id);
    if (!cuenta) throw new ErrorDeDominio('cuenta_no_encontrada');
    if (cuenta.borradoEn === null) return cuenta;
    await bd.ejecutar('UPDATE cuenta SET borrado_en = NULL, modificado_en = ? WHERE id = ?', [
      entorno.ahora().toISOString(),
      id,
    ]);
    return (await obtener(id))!;
  }

  /** Saldo actual de una cuenta, calculado con sus movimientos (T-026). */
  async function saldo(id: string): Promise<number> {
    const cuenta = await exigir(id);
    const filas = await bd.consultar<FilaMovimiento>(
      `SELECT * FROM movimiento
       WHERE borrado_en IS NULL AND (cuenta_id = ? OR cuenta_destino_id = ?)`,
      [id, id],
    );
    return calcularSaldo(cuenta, filas.map(filaAMovimiento));
  }

  /** Cuentas con su saldo calculado, para la pantalla P09. */
  async function listarConSaldo(
    opciones: { incluirArchivadas?: boolean } = {},
  ): Promise<CuentaConSaldo[]> {
    const cuentas = await listar(opciones);
    const filas = await bd.consultar<FilaMovimiento>(
      'SELECT * FROM movimiento WHERE borrado_en IS NULL',
    );
    const movimientos = filas.map(filaAMovimiento);
    return cuentas.map((c) => ({ ...c, saldo: calcularSaldo(c, movimientos) }));
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
    saldo,
    listarConSaldo,
  };
}

export type RepositorioDeCuentas = ReturnType<typeof crearRepositorioDeCuentas>;
