/**
 * Contrato mínimo de base de datos que usan los repositorios.
 *
 * Los repositorios no conocen la biblioteca concreta. En la app el contrato
 * lo cumple expo-sqlite (`bdExpo.ts`); en las pruebas automáticas lo cumple
 * el SQLite que trae Node. Así las pruebas ejecutan el mismo SQL que la app
 * sin necesitar un simulador. Es el mismo papel que una `interface` en Java.
 */
export type ValorSql = string | number | null;

export interface BaseDeDatos {
  /** Ejecuta una sentencia que no devuelve filas (INSERT, UPDATE, CREATE…). */
  ejecutar(sql: string, parametros?: ValorSql[]): Promise<void>;
  /** Ejecuta una consulta y devuelve sus filas. */
  consultar<T>(sql: string, parametros?: ValorSql[]): Promise<T[]>;
  /** Ejecuta la tarea dentro de una transacción: o se aplica todo o nada. */
  transaccion<T>(tarea: () => Promise<T>): Promise<T>;
}

/** Lo que el código necesita del exterior y las pruebas quieren controlar. */
export type Entorno = {
  /** Genera un UUID nuevo. */
  generarId: () => string;
  /** Devuelve el instante actual. */
  ahora: () => Date;
};

/**
 * Devuelve la misma base de datos con las transacciones puestas en fila: una
 * no empieza hasta que termina la anterior.
 *
 * Hace falta desde que la sincronización escribe por su cuenta mientras la
 * persona usa la app: SQLite no admite una transacción dentro de otra, así que
 * sin esto guardar un movimiento justo cuando se aplican filas bajadas daría
 * un error. Las tareas no deben abrir otra transacción dentro de la suya.
 */
export function conTransaccionesEnSerie(bd: BaseDeDatos): BaseDeDatos {
  let anterior: Promise<unknown> = Promise.resolve();
  return {
    ejecutar: (sql, parametros) => bd.ejecutar(sql, parametros),
    consultar: (sql, parametros) => bd.consultar(sql, parametros),
    transaccion<T>(tarea: () => Promise<T>): Promise<T> {
      const turno = anterior.then(() => bd.transaccion(tarea));
      // La fila sigue aunque esta transacción falle; el error lo recibe quien la pidió.
      anterior = turno.catch(() => undefined);
      return turno;
    },
  };
}
