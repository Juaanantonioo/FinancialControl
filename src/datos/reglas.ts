/**
 * Repositorio de reglas recurrentes (T-064 a T-066 y T-072): gastos fijos,
 * suscripciones, ingresos periódicos y aportaciones mensuales.
 *
 * Una regla no crea movimientos sola. `confirmar` crea el movimiento de un
 * mes cuando la persona lo confirma, y `enlazar` marca como confirmación un
 * movimiento que ya había anotado.
 */
import { ErrorDeDominio, esFechaValida, fechaLocal, normalizarNombre } from '@/dominio/modelo';
import type { Movimiento } from '@/dominio/modelo';
import {
  CLASES_DE_REGLA,
  fechaDeOcurrencia,
  PERIODICIDADES,
  tipoDeLaClase,
  type ClaseDeRegla,
  type Periodicidad,
  type ReglaRecurrente,
  type TipoDeRegla,
} from '@/dominio/recurrentes';
import { esMesValido } from '@/dominio/resumen';

import type { BaseDeDatos, Entorno } from './bd';
import { filaAMovimiento, type FilaMovimiento } from './filas';
import type { MovimientoListado, RepositorioDeMovimientos } from './movimientos';
import type { RepositorioDeObjetivos } from './objetivos';

type FilaRegla = {
  id: string;
  nombre: string;
  clase: ClaseDeRegla;
  tipo_movimiento: TipoDeRegla;
  importe: number;
  divisa: string;
  cuenta_id: string;
  cuenta_destino_id: string | null;
  categoria_id: string | null;
  periodicidad: Periodicidad;
  dia_del_mes: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  activa: number;
  aviso_dias_antes: number;
  objetivo_id: string | null;
  creado_en: string;
  modificado_en: string;
  borrado_en: string | null;
};

function filaARegla(f: FilaRegla): ReglaRecurrente {
  return {
    id: f.id,
    nombre: f.nombre,
    clase: f.clase,
    tipoMovimiento: f.tipo_movimiento,
    importe: f.importe,
    divisa: f.divisa,
    cuentaId: f.cuenta_id,
    cuentaDestinoId: f.cuenta_destino_id,
    categoriaId: f.categoria_id,
    periodicidad: f.periodicidad,
    diaDelMes: f.dia_del_mes,
    fechaInicio: f.fecha_inicio,
    fechaFin: f.fecha_fin,
    activa: f.activa === 1,
    avisoDiasAntes: f.aviso_dias_antes,
    objetivoId: f.objetivo_id,
    creadoEn: f.creado_en,
    modificadoEn: f.modificado_en,
    borradoEn: f.borrado_en,
  };
}

export type DatosDeRegla = {
  nombre: string;
  clase: ClaseDeRegla;
  importe: number;
  cuentaId: string;
  /** Obligatoria en aportaciones. */
  cuentaDestinoId?: string | null;
  /** Solo en gastos e ingresos. */
  categoriaId?: string | null;
  periodicidad: Periodicidad;
  diaDelMes: number;
  /** Por defecto, hoy. */
  fechaInicio?: string;
  fechaFin?: string | null;
  activa?: boolean;
  avisoDiasAntes?: number;
  objetivoId?: string | null;
};

export function crearRepositorioDeReglas(
  bd: BaseDeDatos,
  entorno: Entorno,
  movimientos: RepositorioDeMovimientos,
  objetivos: RepositorioDeObjetivos,
) {
  async function obtener(id: string): Promise<ReglaRecurrente | null> {
    const filas = await bd.consultar<FilaRegla>('SELECT * FROM regla_recurrente WHERE id = ?', [
      id,
    ]);
    return filas[0] ? filaARegla(filas[0]) : null;
  }

  async function exigir(id: string): Promise<ReglaRecurrente> {
    const regla = await obtener(id);
    if (!regla || regla.borradoEn !== null) throw new ErrorDeDominio('regla_no_encontrada');
    return regla;
  }

  /** Reglas no borradas, por día del mes. Incluye las inactivas. */
  async function listar(): Promise<ReglaRecurrente[]> {
    const filas = await bd.consultar<FilaRegla>(
      'SELECT * FROM regla_recurrente WHERE borrado_en IS NULL ORDER BY dia_del_mes, nombre, id',
    );
    return filas.map(filaARegla);
  }

  /** Cuenta no borrada. Una archivada solo vale si la regla ya la tenía. */
  async function cuentaValida(id: string, yaAsignada: string | null) {
    const filas = await bd.consultar<{ id: string; divisa: string; archivada: number }>(
      'SELECT id, divisa, archivada FROM cuenta WHERE id = ? AND borrado_en IS NULL',
      [id],
    );
    if (!filas[0]) throw new ErrorDeDominio('cuenta_no_encontrada');
    if (filas[0].archivada === 1 && yaAsignada !== id) throw new ErrorDeDominio('cuenta_archivada');
    return filas[0];
  }

  /** Comprueba las reglas de negocio y devuelve los valores listos para guardar. */
  async function validar(datos: DatosDeRegla, anterior: ReglaRecurrente | null) {
    const nombre = datos.nombre.trim().replace(/\s+/g, ' ');
    if (nombre === '') throw new ErrorDeDominio('nombre_vacio');
    const existentes = await bd.consultar<{ id: string; nombre: string }>(
      'SELECT id, nombre FROM regla_recurrente WHERE borrado_en IS NULL',
    );
    const buscado = normalizarNombre(nombre);
    if (existentes.some((r) => r.id !== anterior?.id && normalizarNombre(r.nombre) === buscado)) {
      throw new ErrorDeDominio('nombre_duplicado');
    }
    if (!CLASES_DE_REGLA.includes(datos.clase)) throw new ErrorDeDominio('clase_no_valida');
    if (!PERIODICIDADES.includes(datos.periodicidad)) {
      throw new ErrorDeDominio('periodicidad_no_valida');
    }
    if (!Number.isSafeInteger(datos.importe)) throw new ErrorDeDominio('importe_no_valido');
    if (datos.importe === 0) throw new ErrorDeDominio('importe_cero');
    if (datos.importe < 0) throw new ErrorDeDominio('importe_no_valido');
    if (!Number.isInteger(datos.diaDelMes) || datos.diaDelMes < 1 || datos.diaDelMes > 31) {
      throw new ErrorDeDominio('dia_no_valido');
    }
    const fechaInicio = datos.fechaInicio ?? anterior?.fechaInicio ?? fechaLocal(entorno.ahora());
    if (!esFechaValida(fechaInicio)) throw new ErrorDeDominio('fecha_no_valida');
    const fechaFin = datos.fechaFin ?? null;
    if (fechaFin !== null) {
      if (!esFechaValida(fechaFin)) throw new ErrorDeDominio('fecha_no_valida');
      if (fechaFin < fechaInicio) throw new ErrorDeDominio('fecha_fin_anterior');
    }
    const avisoDiasAntes = datos.avisoDiasAntes ?? anterior?.avisoDiasAntes ?? 0;
    if (!Number.isInteger(avisoDiasAntes) || avisoDiasAntes < 0) {
      throw new ErrorDeDominio('dia_no_valido');
    }

    const tipo = tipoDeLaClase(datos.clase);
    const cuenta = await cuentaValida(datos.cuentaId, anterior?.cuentaId ?? null);
    let cuentaDestinoId: string | null = null;
    let categoriaId: string | null = null;
    if (tipo === 'transferencia') {
      if (!datos.cuentaDestinoId) throw new ErrorDeDominio('cuenta_destino_obligatoria');
      if (datos.cuentaDestinoId === datos.cuentaId) throw new ErrorDeDominio('misma_cuenta');
      const destino = await cuentaValida(datos.cuentaDestinoId, anterior?.cuentaDestinoId ?? null);
      if (destino.divisa !== cuenta.divisa) throw new ErrorDeDominio('divisas_distintas');
      cuentaDestinoId = destino.id;
    } else {
      // Un gasto fijo sin categoría no entraría en ninguna línea del presupuesto.
      if (!datos.categoriaId) throw new ErrorDeDominio('categoria_obligatoria');
      const categorias = await bd.consultar<{ tipo: string; archivada: number }>(
        'SELECT tipo, archivada FROM categoria WHERE id = ? AND borrado_en IS NULL',
        [datos.categoriaId],
      );
      if (!categorias[0]) throw new ErrorDeDominio('categoria_no_encontrada');
      if (categorias[0].tipo !== tipo) throw new ErrorDeDominio('categoria_de_otro_tipo');
      if (categorias[0].archivada === 1 && anterior?.categoriaId !== datos.categoriaId) {
        throw new ErrorDeDominio('categoria_archivada');
      }
      categoriaId = datos.categoriaId;
    }
    const objetivoId = datos.objetivoId ?? null;
    if (objetivoId !== null) await objetivos.exigir(objetivoId);

    return {
      nombre,
      clase: datos.clase,
      tipo,
      importe: datos.importe,
      divisa: cuenta.divisa,
      cuentaId: cuenta.id,
      cuentaDestinoId,
      categoriaId,
      periodicidad: datos.periodicidad,
      diaDelMes: datos.diaDelMes,
      fechaInicio,
      fechaFin,
      activa: datos.activa ?? anterior?.activa ?? true,
      avisoDiasAntes,
      objetivoId,
    };
  }

  async function crear(datos: DatosDeRegla): Promise<ReglaRecurrente> {
    const v = await validar(datos, null);
    const id = entorno.generarId();
    const ahora = entorno.ahora().toISOString();
    await bd.ejecutar(
      `INSERT INTO regla_recurrente (id, nombre, clase, tipo_movimiento, importe, divisa, cuenta_id,
         cuenta_destino_id, categoria_id, periodicidad, dia_del_mes, fecha_inicio, fecha_fin,
         activa, aviso_dias_antes, objetivo_id, creado_en, modificado_en, borrado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        id,
        v.nombre,
        v.clase,
        v.tipo,
        v.importe,
        v.divisa,
        v.cuentaId,
        v.cuentaDestinoId,
        v.categoriaId,
        v.periodicidad,
        v.diaDelMes,
        v.fechaInicio,
        v.fechaFin,
        v.activa ? 1 : 0,
        v.avisoDiasAntes,
        v.objetivoId,
        ahora,
        ahora,
      ],
    );
    return (await obtener(id))!;
  }

  async function modificar(id: string, datos: DatosDeRegla): Promise<ReglaRecurrente> {
    const anterior = await exigir(id);
    const v = await validar(datos, anterior);
    await bd.ejecutar(
      `UPDATE regla_recurrente SET nombre = ?, clase = ?, tipo_movimiento = ?, importe = ?,
         divisa = ?, cuenta_id = ?, cuenta_destino_id = ?, categoria_id = ?, periodicidad = ?,
         dia_del_mes = ?, fecha_inicio = ?, fecha_fin = ?, activa = ?, aviso_dias_antes = ?,
         objetivo_id = ?, modificado_en = ? WHERE id = ?`,
      [
        v.nombre,
        v.clase,
        v.tipo,
        v.importe,
        v.divisa,
        v.cuentaId,
        v.cuentaDestinoId,
        v.categoriaId,
        v.periodicidad,
        v.diaDelMes,
        v.fechaInicio,
        v.fechaFin,
        v.activa ? 1 : 0,
        v.avisoDiasAntes,
        v.objetivoId,
        entorno.ahora().toISOString(),
        id,
      ],
    );
    return (await obtener(id))!;
  }

  /** Activa o desactiva una regla. Desactivada no produce cobros. */
  async function activar(id: string, activa: boolean): Promise<ReglaRecurrente> {
    await exigir(id);
    await bd.ejecutar('UPDATE regla_recurrente SET activa = ?, modificado_en = ? WHERE id = ?', [
      activa ? 1 : 0,
      entorno.ahora().toISOString(),
      id,
    ]);
    return (await obtener(id))!;
  }

  /** Borrado lógico. Los movimientos que confirmó se conservan. */
  async function borrar(id: string): Promise<void> {
    await exigir(id);
    const ahora = entorno.ahora().toISOString();
    await bd.ejecutar(
      'UPDATE regla_recurrente SET borrado_en = ?, modificado_en = ? WHERE id = ?',
      [ahora, ahora, id],
    );
  }

  async function restaurar(id: string): Promise<ReglaRecurrente> {
    const regla = await obtener(id);
    if (!regla) throw new ErrorDeDominio('regla_no_encontrada');
    await bd.ejecutar(
      'UPDATE regla_recurrente SET borrado_en = NULL, modificado_en = ? WHERE id = ?',
      [entorno.ahora().toISOString(), id],
    );
    return (await obtener(id))!;
  }

  // ------------------------------------------------------------ confirmación

  /** Movimiento no borrado de esa regla en ese mes, si existe. */
  async function movimientoDelMes(reglaId: string, mes: string): Promise<Movimiento | null> {
    const filas = await bd.consultar<FilaMovimiento>(
      `SELECT * FROM movimiento
       WHERE regla_recurrente_id = ? AND substr(fecha, 1, 7) = ? AND borrado_en IS NULL
       ORDER BY creado_en LIMIT 1`,
      [reglaId, mes],
    );
    return filas[0] ? filaAMovimiento(filas[0]) : null;
  }

  /** Regla vigente con ocurrencia en ese mes; si no la tiene, error. */
  async function reglaConOcurrencia(reglaId: string, mes: string) {
    if (!esMesValido(mes)) throw new ErrorDeDominio('periodo_no_valido');
    const regla = await exigir(reglaId);
    const fecha = fechaDeOcurrencia(regla, mes);
    if (fecha === null) throw new ErrorDeDominio('sin_ocurrencia');
    return { regla, fecha };
  }

  /**
   * Confirma el cobro de un mes: crea un movimiento con origen `recurrente`
   * enlazado a la regla. Se puede cambiar el importe y la fecha, siempre
   * dentro de ese mes. Confirmar dos veces devuelve el mismo movimiento: no
   * crea otro. En una aportación con objetivo, anota además la aportación.
   */
  async function confirmar(
    reglaId: string,
    mes: string,
    cambios: { importe?: number; fecha?: string } = {},
  ): Promise<Movimiento> {
    const { regla, fecha: fechaPrevista } = await reglaConOcurrencia(reglaId, mes);
    const fecha = cambios.fecha ?? fechaPrevista;
    if (!esFechaValida(fecha)) throw new ErrorDeDominio('fecha_no_valida');
    // Fuera de su mes el movimiento no confirmaría esta ocurrencia.
    if (fecha.slice(0, 7) !== mes) throw new ErrorDeDominio('fecha_no_valida');
    return bd.transaccion(async () => {
      const existente = await movimientoDelMes(reglaId, mes);
      if (existente) return existente;
      const mov = await movimientos.crear({
        tipo: regla.tipoMovimiento,
        fecha,
        importe: cambios.importe ?? regla.importe,
        cuentaId: regla.cuentaId,
        cuentaDestinoId: regla.cuentaDestinoId,
        categoriaId: regla.categoriaId,
        nombre: regla.nombre,
        origen: 'recurrente',
        reglaRecurrenteId: regla.id,
        objetivoId: regla.objetivoId,
      });
      if (regla.objetivoId !== null) {
        await objetivos.aportar({
          objetivoId: regla.objetivoId,
          fecha: mov.fecha,
          importe: mov.importe,
          movimientoId: mov.id,
        });
      }
      return mov;
    });
  }

  /**
   * Movimientos que podrían ser ya el cobro de ese mes («Ya lo anoté»): del
   * mismo mes, mismo tipo y misma cuenta, y que aún no tienen regla.
   */
  async function candidatos(reglaId: string, mes: string): Promise<MovimientoListado[]> {
    const { regla } = await reglaConOcurrencia(reglaId, mes);
    const delMes = await movimientos.listar({ mes, cuentaId: regla.cuentaId });
    return delMes.filter(
      (m) =>
        m.tipo === regla.tipoMovimiento &&
        m.cuentaId === regla.cuentaId &&
        m.reglaRecurrenteId === null,
    );
  }

  /**
   * «Ya lo anoté»: marca un movimiento existente como el cobro de ese mes.
   * No crea ningún movimiento. Si el mes ya estaba confirmado, no cambia nada.
   */
  async function enlazar(reglaId: string, mes: string, movimientoId: string): Promise<Movimiento> {
    const { regla } = await reglaConOcurrencia(reglaId, mes);
    return bd.transaccion(async () => {
      const existente = await movimientoDelMes(reglaId, mes);
      if (existente) return existente;
      const mov = await movimientos.obtener(movimientoId);
      if (
        !mov ||
        mov.borradoEn !== null ||
        mov.fecha.slice(0, 7) !== mes ||
        mov.tipo !== regla.tipoMovimiento ||
        mov.cuentaId !== regla.cuentaId ||
        mov.reglaRecurrenteId !== null
      ) {
        throw new ErrorDeDominio('movimiento_no_enlazable');
      }
      const conObjetivo = regla.objetivoId !== null && mov.objetivoId === null;
      await bd.ejecutar(
        `UPDATE movimiento SET regla_recurrente_id = ?, objetivo_id = COALESCE(objetivo_id, ?),
                               modificado_en = ? WHERE id = ?`,
        [regla.id, regla.objetivoId, entorno.ahora().toISOString(), mov.id],
      );
      if (conObjetivo && regla.objetivoId !== null) {
        await objetivos.aportar({
          objetivoId: regla.objetivoId,
          fecha: mov.fecha,
          importe: mov.importe,
          movimientoId: mov.id,
        });
      }
      return (await movimientos.obtener(mov.id))!;
    });
  }

  return {
    obtener,
    exigir,
    listar,
    crear,
    modificar,
    activar,
    borrar,
    restaurar,
    confirmar,
    candidatos,
    enlazar,
  };
}

export type RepositorioDeReglas = ReturnType<typeof crearRepositorioDeReglas>;
