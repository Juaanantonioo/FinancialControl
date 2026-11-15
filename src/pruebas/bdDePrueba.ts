/**
 * Base de datos para las pruebas automáticas.
 *
 * Usa el SQLite que trae Node (módulo `node:sqlite`), en memoria. Cumple el
 * mismo contrato `BaseDeDatos` que el adaptador de la app, así que las
 * pruebas ejecutan el mismo SQL y las mismas reglas que el iPhone.
 */
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import type { BaseDeDatos, Entorno, ValorSql } from '@/datos/bd';
import { prepararBaseDeDatos, type CategoriaInicial } from '@/datos';

export function crearBdDePrueba(): BaseDeDatos {
  const sqlite = new DatabaseSync(':memory:');
  return {
    async ejecutar(sql: string, parametros: ValorSql[] = []) {
      sqlite.prepare(sql).run(...parametros);
    },
    async consultar<T>(sql: string, parametros: ValorSql[] = []) {
      // Se copian las filas a objetos normales para poder compararlas con toEqual.
      return sqlite
        .prepare(sql)
        .all(...parametros)
        .map((fila) => ({ ...fila })) as T[];
    },
    async transaccion<T>(tarea: () => Promise<T>) {
      sqlite.exec('BEGIN');
      try {
        const resultado = await tarea();
        sqlite.exec('COMMIT');
        return resultado;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

/**
 * Entorno con un reloj que las pruebas controlan. Cada llamada a `ahora`
 * avanza un segundo, para que el orden de creación sea siempre el mismo.
 */
export function crearEntornoDePrueba(inicio = '2026-11-15T10:00:00.000Z') {
  let instante = new Date(inicio).getTime();
  const entorno: Entorno = {
    generarId: () => randomUUID(),
    ahora: () => {
      instante += 1000;
      return new Date(instante);
    },
  };
  return entorno;
}

export async function prepararPrueba(categoriasIniciales: CategoriaInicial[] = []) {
  const bd = crearBdDePrueba();
  const entorno = crearEntornoDePrueba();
  const repos = await prepararBaseDeDatos(bd, entorno, categoriasIniciales);
  return { bd, entorno, ...repos };
}

/** Comprueba que una promesa falla con un error de dominio de ese código. */
export async function esperarError(promesa: Promise<unknown>, codigo: string) {
  await expect(promesa).rejects.toMatchObject({ name: 'ErrorDeDominio', codigo });
}
