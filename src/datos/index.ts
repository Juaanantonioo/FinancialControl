/**
 * Punto de entrada de la capa de datos: prepara la base de datos y entrega
 * los repositorios.
 */
import type { TipoDeCategoria } from '@/dominio/modelo';

import type { BaseDeDatos, Entorno } from './bd';
import { crearRepositorioDeCategorias } from './categorias';
import { crearRepositorioDeCuentas } from './cuentas';
import { migrar } from './migraciones';
import { crearRepositorioDeMovimientos } from './movimientos';
import { crearRepositorioDeObjetivos } from './objetivos';
import { crearRepositorioDePresupuestos } from './presupuestos';
import { crearRepositorioDeReglas } from './reglas';
import { crearRepositorioDeValores } from './valores';

export function crearRepositorios(bd: BaseDeDatos, entorno: Entorno) {
  const movimientos = crearRepositorioDeMovimientos(bd, entorno);
  const objetivos = crearRepositorioDeObjetivos(bd, entorno, movimientos);
  return {
    cuentas: crearRepositorioDeCuentas(bd, entorno),
    categorias: crearRepositorioDeCategorias(bd, entorno),
    movimientos,
    valores: crearRepositorioDeValores(bd, entorno),
    objetivos,
    presupuestos: crearRepositorioDePresupuestos(bd, entorno),
    // Confirmar un cobro crea un movimiento y, si procede, una aportación.
    reglas: crearRepositorioDeReglas(bd, entorno, movimientos, objetivos),
  };
}

export type Repositorios = ReturnType<typeof crearRepositorios>;

export type CategoriaInicial = { nombre: string; tipo: TipoDeCategoria };

/**
 * Aplica las migraciones y, solo la primera vez que se crea la base de
 * datos, añade las categorías iniciales. Sus nombres llegan del catálogo de
 * traducción, no se escriben aquí.
 */
export async function prepararBaseDeDatos(
  bd: BaseDeDatos,
  entorno: Entorno,
  categoriasIniciales: CategoriaInicial[] = [],
): Promise<Repositorios> {
  // Sin esto SQLite no comprueba las claves ajenas (REFERENCES).
  await bd.ejecutar('PRAGMA foreign_keys = ON');
  const { desde } = await migrar(bd);
  const repositorios = crearRepositorios(bd, entorno);
  if (desde === 0) {
    for (const categoria of categoriasIniciales) {
      await repositorios.categorias.crear(categoria);
    }
  }
  return repositorios;
}
