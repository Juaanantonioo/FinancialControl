/**
 * Adaptador de la base de datos de la app: cumple el contrato `BaseDeDatos`
 * con expo-sqlite, que guarda un fichero SQLite dentro del dispositivo.
 */
import * as SQLite from 'expo-sqlite';

import { conTransaccionesEnSerie, type BaseDeDatos, type ValorSql } from './bd';

export const NOMBRE_DE_LA_BD = 'financialcontrol.db';

export async function abrirBdExpo(nombre: string = NOMBRE_DE_LA_BD): Promise<BaseDeDatos> {
  const sqlite = await SQLite.openDatabaseAsync(nombre);
  return conTransaccionesEnSerie({
    async ejecutar(sql: string, parametros: ValorSql[] = []) {
      await sqlite.runAsync(sql, parametros);
    },
    consultar<T>(sql: string, parametros: ValorSql[] = []) {
      return sqlite.getAllAsync<T>(sql, parametros);
    },
    async transaccion<T>(tarea: () => Promise<T>) {
      let resultado!: T;
      await sqlite.withTransactionAsync(async () => {
        resultado = await tarea();
      });
      return resultado;
    },
  });
}
