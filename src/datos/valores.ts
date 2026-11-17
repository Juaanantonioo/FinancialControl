/**
 * Repositorio de valores de inversión (T-070): el valor que la persona
 * escribe para una cuenta de inversión en un día.
 *
 * Reglas: solo en cuentas de tipo `inversion`, valor entero mayor o igual
 * que cero, fecha real, no futura y no anterior a la fecha del saldo inicial
 * de la cuenta. Hay un único valor por cuenta y día: registrar otro el mismo
 * día lo sustituye.
 */
import type { ValorDeInversion } from '@/dominio/inversion';
import { ErrorDeDominio, esFechaValida, fechaLocal } from '@/dominio/modelo';

import type { BaseDeDatos, Entorno } from './bd';
import type { FilaCuenta } from './cuentas';

type FilaValor = {
  id: string;
  cuenta_id: string;
  fecha: string;
  valor: number;
  creado_en: string;
  modificado_en: string;
  borrado_en: string | null;
};

function filaAValor(f: FilaValor): ValorDeInversion {
  return {
    id: f.id,
    cuentaId: f.cuenta_id,
    fecha: f.fecha,
    valor: f.valor,
    creadoEn: f.creado_en,
    modificadoEn: f.modificado_en,
    borradoEn: f.borrado_en,
  };
}

export type DatosDeValor = { cuentaId: string; fecha: string; valor: number };

export function crearRepositorioDeValores(bd: BaseDeDatos, entorno: Entorno) {
  async function obtener(id: string): Promise<ValorDeInversion | null> {
    const filas = await bd.consultar<FilaValor>('SELECT * FROM valor_de_inversion WHERE id = ?', [
      id,
    ]);
    return filas[0] ? filaAValor(filas[0]) : null;
  }

  async function validar(datos: DatosDeValor): Promise<void> {
    const cuentas = await bd.consultar<FilaCuenta>(
      'SELECT * FROM cuenta WHERE id = ? AND borrado_en IS NULL',
      [datos.cuentaId],
    );
    const cuenta = cuentas[0];
    if (!cuenta) throw new ErrorDeDominio('cuenta_no_encontrada');
    if (cuenta.tipo !== 'inversion') throw new ErrorDeDominio('cuenta_no_es_de_inversion');
    if (!Number.isSafeInteger(datos.valor) || datos.valor < 0) {
      throw new ErrorDeDominio('valor_no_valido');
    }
    if (!esFechaValida(datos.fecha)) throw new ErrorDeDominio('fecha_no_valida');
    if (datos.fecha > fechaLocal(entorno.ahora())) throw new ErrorDeDominio('fecha_futura');
    if (datos.fecha < cuenta.fecha_saldo_inicial) {
      throw new ErrorDeDominio('fecha_anterior_a_la_cuenta');
    }
  }

  /** Valor no borrado de esa cuenta en ese día, si existe. */
  async function delDia(cuentaId: string, fecha: string): Promise<ValorDeInversion | null> {
    const filas = await bd.consultar<FilaValor>(
      `SELECT * FROM valor_de_inversion
       WHERE cuenta_id = ? AND fecha = ? AND borrado_en IS NULL`,
      [cuentaId, fecha],
    );
    return filas[0] ? filaAValor(filas[0]) : null;
  }

  /**
   * Registra el valor de un día. Si ese día ya tenía valor, lo sustituye:
   * se conserva la misma fila y cambia su importe.
   */
  async function registrar(datos: DatosDeValor): Promise<ValorDeInversion> {
    await validar(datos);
    const ahora = entorno.ahora().toISOString();
    const existente = await delDia(datos.cuentaId, datos.fecha);
    if (existente) {
      await bd.ejecutar('UPDATE valor_de_inversion SET valor = ?, modificado_en = ? WHERE id = ?', [
        datos.valor,
        ahora,
        existente.id,
      ]);
      return (await obtener(existente.id))!;
    }
    const id = entorno.generarId();
    await bd.ejecutar(
      `INSERT INTO valor_de_inversion (id, cuenta_id, fecha, valor, creado_en, modificado_en, borrado_en)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [id, datos.cuentaId, datos.fecha, datos.valor, ahora, ahora],
    );
    return (await obtener(id))!;
  }

  /**
   * Cambia la fecha o el importe de un valor. Si se mueve a un día que ya
   * tenía otro valor, ese otro se borra: sigue habiendo uno por día.
   */
  async function modificar(
    id: string,
    cambios: { fecha: string; valor: number },
  ): Promise<ValorDeInversion> {
    const actual = await obtener(id);
    if (!actual || actual.borradoEn !== null) throw new ErrorDeDominio('valor_no_encontrado');
    await validar({ cuentaId: actual.cuentaId, ...cambios });
    const ahora = entorno.ahora().toISOString();
    await bd.transaccion(async () => {
      const otro = await delDia(actual.cuentaId, cambios.fecha);
      if (otro && otro.id !== id) {
        await bd.ejecutar(
          'UPDATE valor_de_inversion SET borrado_en = ?, modificado_en = ? WHERE id = ?',
          [ahora, ahora, otro.id],
        );
      }
      await bd.ejecutar(
        'UPDATE valor_de_inversion SET fecha = ?, valor = ?, modificado_en = ? WHERE id = ?',
        [cambios.fecha, cambios.valor, ahora, id],
      );
    });
    return (await obtener(id))!;
  }

  /** Borrado lógico: se puede deshacer con `restaurar`. */
  async function borrar(id: string): Promise<void> {
    const actual = await obtener(id);
    if (!actual || actual.borradoEn !== null) throw new ErrorDeDominio('valor_no_encontrado');
    const ahora = entorno.ahora().toISOString();
    await bd.ejecutar(
      'UPDATE valor_de_inversion SET borrado_en = ?, modificado_en = ? WHERE id = ?',
      [ahora, ahora, id],
    );
  }

  /**
   * Deshace un borrado. Si entretanto se registró otro valor ese mismo día,
   * el restaurado lo sustituye.
   */
  async function restaurar(id: string): Promise<ValorDeInversion> {
    const actual = await obtener(id);
    if (!actual) throw new ErrorDeDominio('valor_no_encontrado');
    const ahora = entorno.ahora().toISOString();
    await bd.transaccion(async () => {
      const otro = await delDia(actual.cuentaId, actual.fecha);
      if (otro && otro.id !== id) {
        await bd.ejecutar(
          'UPDATE valor_de_inversion SET borrado_en = ?, modificado_en = ? WHERE id = ?',
          [ahora, ahora, otro.id],
        );
      }
      await bd.ejecutar(
        'UPDATE valor_de_inversion SET borrado_en = NULL, modificado_en = ? WHERE id = ?',
        [ahora, id],
      );
    });
    return (await obtener(id))!;
  }

  /** Valores no borrados de una cuenta, del más reciente al más antiguo. */
  async function listarPorCuenta(cuentaId: string): Promise<ValorDeInversion[]> {
    const filas = await bd.consultar<FilaValor>(
      `SELECT * FROM valor_de_inversion
       WHERE cuenta_id = ? AND borrado_en IS NULL ORDER BY fecha DESC`,
      [cuentaId],
    );
    return filas.map(filaAValor);
  }

  /** Todos los valores no borrados, para calcular el patrimonio. */
  async function listar(): Promise<ValorDeInversion[]> {
    const filas = await bd.consultar<FilaValor>(
      'SELECT * FROM valor_de_inversion WHERE borrado_en IS NULL ORDER BY fecha DESC',
    );
    return filas.map(filaAValor);
  }

  return { obtener, registrar, modificar, borrar, restaurar, listarPorCuenta, listar };
}

export type RepositorioDeValores = ReturnType<typeof crearRepositorioDeValores>;
