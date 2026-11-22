/**
 * La base de datos en el navegador: el mismo expo-sqlite (SQLite compilado a
 * WebAssembly), abierto SOLO EN MEMORIA.
 *
 * En la web no se guarda nada en el navegador: ni datos, ni claves. La base
 * nace vacía en cada carga de la página, se llena al entrar en la cuenta con
 * lo que se baja y se descifra, y desaparece al cerrar o recargar la pestaña.
 * Con el nombre `:memory:` expo-sqlite usa su almacén en memoria y no escribe
 * en el almacenamiento del navegador.
 *
 * Cumple el mismo contrato `BaseDeDatos` que en iOS: los repositorios, las
 * migraciones y el motor de sincronización son los mismos.
 */
import * as SQLite from 'expo-sqlite';

import { conTransaccionesEnSerie, type BaseDeDatos, type ValorSql } from './bd';

export const NOMBRE_DE_LA_BD = ':memory:';

export async function abrirBdExpo(): Promise<BaseDeDatos> {
  const sqlite = await SQLite.openDatabaseAsync(NOMBRE_DE_LA_BD);
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
