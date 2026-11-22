/**
 * Apoyo para probar la sincronización: «dispositivos» con su propia base de
 * datos en memoria y su propio motor, y datos de ejemplo en las doce tablas.
 */
import type { CategoriaInicial } from '@/datos';
import type { BaseDeDatos } from '@/datos/bd';
import { crearMotor, type DependenciasDelMotor } from '@/sincronizacion/motor';
import type { ServidorDeFilas } from '@/sincronizacion/servidor';
import { TABLAS, type FilaLocal } from '@/sincronizacion/tablas';

import { prepararPrueba } from './bdDePrueba';

export const INICIALES: CategoriaInicial[] = [
  { nombre: 'Comida', tipo: 'gasto' },
  { nombre: 'Ocio', tipo: 'gasto' },
  { nombre: 'Nómina', tipo: 'ingreso' },
];

/** Todas las filas de las tablas sincronizadas, por tabla y ordenadas por id. */
export async function volcar(bd: BaseDeDatos): Promise<Record<string, FilaLocal[]>> {
  const todo: Record<string, FilaLocal[]> = {};
  for (const tabla of TABLAS) {
    todo[tabla.nombre] = await bd.consultar<FilaLocal>(`SELECT * FROM ${tabla.nombre} ORDER BY id`);
  }
  return todo;
}

export async function contarFilas(bd: BaseDeDatos): Promise<number> {
  return Object.values(await volcar(bd)).reduce((suma, filas) => suma + filas.length, 0);
}

type Opciones = {
  servidor: ServidorDeFilas;
  /** La clave de datos de la cuenta. El motor recibe una copia cada vez. */
  clave: Uint8Array;
  iniciales?: CategoriaInicial[];
  /** `false` para un dispositivo sin las categorías iniciales. */
  sembrarIniciales?: boolean;
} & Partial<Pick<DependenciasDelMotor, 'ventanaMs' | 'filasPorLote' | 'filasPorPagina'>>;

/** Un dispositivo: base de datos recién instalada, repositorios y motor. */
export async function crearDispositivo(opciones: Opciones) {
  const iniciales = opciones.iniciales ?? INICIALES;
  const base = await prepararPrueba(opciones.sembrarIniciales === false ? [] : iniciales);
  const motor = crearMotor({
    bd: base.bd,
    servidor: opciones.servidor,
    leerClave: async () => new Uint8Array(opciones.clave),
    ahora: base.entorno.ahora,
    categoriasIniciales: iniciales,
    ventanaMs: opciones.ventanaMs,
    filasPorLote: opciones.filasPorLote,
    filasPorPagina: opciones.filasPorPagina,
  });
  return { ...base, motor, volcar: () => volcar(base.bd) };
}

export type Dispositivo = Awaited<ReturnType<typeof crearDispositivo>>;

/**
 * Entra en la cuenta desde un dispositivo y, si la app pregunta «¿Subir los
 * datos de este dispositivo a tu cuenta?», responde que sí. La otra pregunta
 * (usar los datos de la nube) se devuelve sin responder.
 */
export async function entrarSubiendo(d: Pick<Dispositivo, 'motor'>) {
  const entrada = await d.motor.evaluarEntrada();
  if (entrada.estado === 'preguntar' && entrada.pregunta === 'subir') {
    return d.motor.subirLoLocal();
  }
  return entrada;
}

/**
 * Crea al menos una fila en cada una de las doce tablas, con los
 * repositorios de la app. Devuelve lo que hace falta para seguir trabajando.
 */
export async function sembrarTodo(d: Dispositivo) {
  const banco = await d.cuentas.crear({
    nombre: 'Banco',
    tipo: 'banco',
    saldoInicial: 215000,
    fechaSaldoInicial: '2026-10-01',
  });
  const broker = await d.cuentas.crear({
    nombre: 'Bróker',
    tipo: 'inversion',
    saldoInicial: 0,
    fechaSaldoInicial: '2026-10-01',
  });
  const comida =
    (await d.categorias.listar()).find((c) => c.nombre === 'Comida') ??
    (await d.categorias.crear({ nombre: 'Comida', tipo: 'gasto' }));
  const movimiento = await d.movimientos.crear({
    tipo: 'gasto',
    fecha: '2026-11-10',
    importe: 2340,
    cuentaId: banco.id,
    categoriaId: comida.id,
    nombre: 'Mercado',
    nota: 'Con tilde: señal, café y 5 €',
  });
  await d.valores.registrar({ cuentaId: broker.id, fecha: '2026-11-12', valor: 612000 });
  const regla = await d.reglas.crear({
    nombre: 'Súper',
    clase: 'fijo',
    importe: 5000,
    cuentaId: banco.id,
    categoriaId: comida.id,
    periodicidad: 'mensual',
    diaDelMes: 20,
    fechaInicio: '2026-11-01',
  });
  await d.reglas.confirmar(regla.id, '2026-11');
  await d.presupuestos.guardar('2026-11', [{ categoriaId: comida.id, importe: 30000 }]);
  const viaje = await d.objetivos.crear({ nombre: 'Viaje', tipo: 'ahorro', meta: 150000 });
  await d.objetivos.aportar({ objetivoId: viaje.id, fecha: '2026-11-03', importe: 5000 });
  const captura = await d.capturas.registrar({
    origen: 'prueba',
    importeTexto: '4,50 €',
    comercioTexto: 'Café Central',
    tarjetaTexto: 'Visa Oro',
  });
  await d.capturas.fijarAlias('Visa Oro', banco.id);
  await d.capturas.recordarComercio('Café Central', comida.id);
  return { banco, broker, comida, movimiento, regla, viaje, captura };
}
