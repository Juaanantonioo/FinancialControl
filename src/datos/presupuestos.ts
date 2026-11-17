/**
 * Repositorio de presupuestos mensuales (T-060). Un presupuesto por mes,
 * con una línea por categoría de gasto de primer nivel. Los totales no se
 * guardan: se calculan en `src/dominio/presupuesto.ts`.
 */
import { ErrorDeDominio } from '@/dominio/modelo';
import type { LineaDePresupuesto, Presupuesto } from '@/dominio/presupuesto';
import { esMesValido } from '@/dominio/resumen';

import type { BaseDeDatos, Entorno } from './bd';

type FilaPresupuesto = {
  id: string;
  periodo: string;
  nota: string | null;
  creado_en: string;
  modificado_en: string;
  borrado_en: string | null;
};
type FilaLinea = {
  id: string;
  presupuesto_id: string;
  categoria_id: string;
  importe: number;
  creado_en: string;
  modificado_en: string;
  borrado_en: string | null;
};

function filaAPresupuesto(f: FilaPresupuesto): Presupuesto {
  return {
    id: f.id,
    periodo: f.periodo,
    nota: f.nota,
    creadoEn: f.creado_en,
    modificadoEn: f.modificado_en,
    borradoEn: f.borrado_en,
  };
}
function filaALinea(f: FilaLinea): LineaDePresupuesto {
  return {
    id: f.id,
    presupuestoId: f.presupuesto_id,
    categoriaId: f.categoria_id,
    importe: f.importe,
    creadoEn: f.creado_en,
    modificadoEn: f.modificado_en,
    borradoEn: f.borrado_en,
  };
}

export type PresupuestoConLineas = Presupuesto & { lineas: LineaDePresupuesto[] };
export type DatosDeLinea = { categoriaId: string; importe: number };

export function crearRepositorioDePresupuestos(bd: BaseDeDatos, entorno: Entorno) {
  async function lineasDe(presupuestoId: string): Promise<LineaDePresupuesto[]> {
    const filas = await bd.consultar<FilaLinea>(
      `SELECT l.* FROM linea_de_presupuesto l
       JOIN categoria c ON c.id = l.categoria_id
       WHERE l.presupuesto_id = ? AND l.borrado_en IS NULL
       ORDER BY c.orden, c.nombre, l.id`,
      [presupuestoId],
    );
    return filas.map(filaALinea);
  }

  /** Presupuesto no borrado de un mes "AAAA-MM" con sus líneas, o `null` si no hay. */
  async function delMes(periodo: string): Promise<PresupuestoConLineas | null> {
    const filas = await bd.consultar<FilaPresupuesto>(
      'SELECT * FROM presupuesto WHERE periodo = ? AND borrado_en IS NULL',
      [periodo],
    );
    if (!filas[0]) return null;
    return { ...filaAPresupuesto(filas[0]), lineas: await lineasDe(filas[0].id) };
  }

  async function validarLineas(lineas: DatosDeLinea[]): Promise<void> {
    const vistas = new Set<string>();
    for (const linea of lineas) {
      if (!Number.isSafeInteger(linea.importe) || linea.importe < 0) {
        throw new ErrorDeDominio('importe_no_valido');
      }
      // Una línea por categoría: una repetida es un error de quien llama.
      if (vistas.has(linea.categoriaId)) throw new ErrorDeDominio('categoria_no_presupuestable');
      vistas.add(linea.categoriaId);
      const categorias = await bd.consultar<{ tipo: string; padre_id: string | null }>(
        'SELECT tipo, padre_id FROM categoria WHERE id = ? AND borrado_en IS NULL',
        [linea.categoriaId],
      );
      if (!categorias[0]) throw new ErrorDeDominio('categoria_no_encontrada');
      // Solo categorías de gasto de primer nivel: las subcategorías suman en su principal.
      if (categorias[0].tipo !== 'gasto' || categorias[0].padre_id !== null) {
        throw new ErrorDeDominio('categoria_no_presupuestable');
      }
    }
  }

  /**
   * Guarda el presupuesto de un mes con exactamente esas líneas: crea el
   * presupuesto si no existía, actualiza las líneas que cambian, añade las
   * nuevas y borra (borrado lógico) las que ya no vienen.
   */
  async function guardar(
    periodo: string,
    lineas: DatosDeLinea[],
    nota: string | null = null,
  ): Promise<PresupuestoConLineas> {
    if (!esMesValido(periodo)) throw new ErrorDeDominio('periodo_no_valido');
    await validarLineas(lineas);
    const ahora = entorno.ahora().toISOString();
    const notaLimpia = (nota ?? '').trim() || null;
    await bd.transaccion(async () => {
      const existente = await delMes(periodo);
      let presupuestoId = existente?.id;
      if (!presupuestoId) {
        presupuestoId = entorno.generarId();
        await bd.ejecutar(
          `INSERT INTO presupuesto (id, periodo, nota, creado_en, modificado_en, borrado_en)
           VALUES (?, ?, ?, ?, ?, NULL)`,
          [presupuestoId, periodo, notaLimpia, ahora, ahora],
        );
      } else {
        await bd.ejecutar('UPDATE presupuesto SET nota = ?, modificado_en = ? WHERE id = ?', [
          notaLimpia,
          ahora,
          presupuestoId,
        ]);
      }
      const anteriores = new Map((existente?.lineas ?? []).map((l) => [l.categoriaId, l]));
      for (const linea of lineas) {
        const anterior = anteriores.get(linea.categoriaId);
        anteriores.delete(linea.categoriaId);
        if (!anterior) {
          await bd.ejecutar(
            `INSERT INTO linea_de_presupuesto (id, presupuesto_id, categoria_id, importe,
                                               creado_en, modificado_en, borrado_en)
             VALUES (?, ?, ?, ?, ?, ?, NULL)`,
            [entorno.generarId(), presupuestoId, linea.categoriaId, linea.importe, ahora, ahora],
          );
        } else if (anterior.importe !== linea.importe) {
          await bd.ejecutar(
            'UPDATE linea_de_presupuesto SET importe = ?, modificado_en = ? WHERE id = ?',
            [linea.importe, ahora, anterior.id],
          );
        }
      }
      for (const sobrante of anteriores.values()) {
        await bd.ejecutar(
          'UPDATE linea_de_presupuesto SET borrado_en = ?, modificado_en = ? WHERE id = ?',
          [ahora, ahora, sobrante.id],
        );
      }
    });
    return (await delMes(periodo))!;
  }

  /** Borrado lógico del presupuesto de un mes. Sus líneas se conservan para poder deshacer. */
  async function borrar(periodo: string): Promise<string> {
    const presupuesto = await delMes(periodo);
    if (!presupuesto) throw new ErrorDeDominio('presupuesto_no_encontrado');
    const ahora = entorno.ahora().toISOString();
    await bd.ejecutar('UPDATE presupuesto SET borrado_en = ?, modificado_en = ? WHERE id = ?', [
      ahora,
      ahora,
      presupuesto.id,
    ]);
    return presupuesto.id;
  }

  /** Deshace un borrado. Si entretanto se creó otro presupuesto ese mes, el restaurado lo sustituye. */
  async function restaurar(id: string): Promise<PresupuestoConLineas> {
    const filas = await bd.consultar<FilaPresupuesto>('SELECT * FROM presupuesto WHERE id = ?', [
      id,
    ]);
    if (!filas[0]) throw new ErrorDeDominio('presupuesto_no_encontrado');
    const ahora = entorno.ahora().toISOString();
    await bd.transaccion(async () => {
      await bd.ejecutar(
        `UPDATE presupuesto SET borrado_en = ?, modificado_en = ?
         WHERE periodo = ? AND borrado_en IS NULL AND id <> ?`,
        [ahora, ahora, filas[0].periodo, id],
      );
      await bd.ejecutar(
        'UPDATE presupuesto SET borrado_en = NULL, modificado_en = ? WHERE id = ?',
        [ahora, id],
      );
    });
    return (await delMes(filas[0].periodo))!;
  }

  return { delMes, guardar, borrar, restaurar };
}

export type RepositorioDePresupuestos = ReturnType<typeof crearRepositorioDePresupuestos>;
