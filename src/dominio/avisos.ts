/**
 * Avisos locales (T-040, T-066, T-067 y T-077): qué hay que avisar y cuándo.
 *
 * Es una función pura. Recibe los datos y el instante actual y devuelve dos
 * listas: los avisos que hay que dejar programados para más adelante y los
 * que hay que mostrar ya. No habla con el sistema de notificaciones: de eso
 * se encarga una capa fina en `src/lib/notificaciones.ts`.
 *
 * Los instantes van en milisegundos desde 1970 (UTC). «Las 9:00» es la hora
 * local del dispositivo: se calcula con el calendario local, así que sigue
 * siendo las 9:00 aunque entre medias cambie la hora de verano o invierno.
 */
import type { Captura } from './captura';
import type { ValorRegistrado } from './inversion';
import { DIAS_PARA_AVISAR } from './inversion';
import type { EstadoDelPresupuesto } from './presupuesto';
import { ocurrenciasDelMes, sumarDias, type ReglaRecurrente } from './recurrentes';
import { moverMes } from './resumen';
import type { Cuenta, Movimiento } from './modelo';

export const TIPOS_DE_AVISO = ['cobros', 'presupuesto', 'capturas', 'inversion'] as const;
export type TipoDeAviso = (typeof TIPOS_DE_AVISO)[number];

/** Qué tipos de aviso tiene activados la persona. */
export type Preferencias = Record<TipoDeAviso, boolean>;

export const SIN_AVISOS: Preferencias = {
  cobros: false,
  presupuesto: false,
  capturas: false,
  inversion: false,
};

/** Hora local a la que se dan los avisos con día fijo. */
export const HORA_DE_LOS_AVISOS = 9;
/** Avisos pendientes como mucho a la vez. iOS admite 64; se deja margen. */
export const MAXIMO_DE_AVISOS = 40;
/** Tiempo que una captura puede estar pendiente antes de avisar. */
export const ESPERA_DE_CAPTURAS_MS = 24 * 60 * 60 * 1000;
/** Meses hacia delante en los que se buscan cobros que avisar. */
const MESES_DE_HORIZONTE = 2;

/** Lo que el aviso dice. El texto lo compone la capa de presentación con el catálogo. */
export type ContenidoDeAviso =
  | { clase: 'cobro'; nombre: string; importe: number; divisa: string; fecha: string; tipo: string }
  | { clase: 'presupuesto_cerca'; categoriaId: string; porcentaje: number }
  | { clase: 'presupuesto_excedido'; categoriaId: string; exceso: number }
  | { clase: 'capturas'; pendientes: number }
  | { clase: 'inversion'; nombre: string; dias: number };

/** Pantalla que se abre al tocar el aviso. */
export type DestinoDeAviso = { ruta: string; parametros: Record<string, string> };

export type Aviso = {
  /** Identifica el aviso. Dos cálculos con los mismos datos dan las mismas claves. */
  clave: string;
  tipo: TipoDeAviso;
  contenido: ContenidoDeAviso;
  destino: DestinoDeAviso;
};

export type AvisoProgramado = Aviso & {
  /** Instante en que debe mostrarse, en milisegundos desde 1970 (UTC). */
  instante: number;
};

export type AvisoInmediato = Aviso & {
  /** Claves que quedan cubiertas al emitirlo, para no repetirlo ni dar uno menor después. */
  cubre: string[];
};

/** Instante de una hora local de un día "AAAA-MM-DD". */
export function instanteLocal(fecha: string, hora: number, minuto = 0): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  // Se construye con el calendario local: no depende de cuántas horas tenga el día.
  return new Date(anio, mes - 1, dia, hora, minuto, 0, 0).getTime();
}

/** Día local "AAAA-MM-DD" de un instante. */
export function diaLocal(instante: number): string {
  const d = new Date(instante);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${String(d.getDate()).padStart(2, '0')}`;
}

export type DatosParaAvisos = {
  reglas: ReglaRecurrente[];
  movimientos: Pick<Movimiento, 'id' | 'fecha' | 'reglaRecurrenteId' | 'borradoEn'>[];
  /** Estado del presupuesto del mes en curso, o `null` si no hay presupuesto. */
  presupuesto: EstadoDelPresupuesto | null;
  capturas: Pick<Captura, 'id' | 'recibidaEn' | 'estado' | 'borradoEn'>[];
  cuentas: Pick<
    Cuenta,
    'id' | 'nombre' | 'tipo' | 'archivada' | 'borradoEn' | 'fechaSaldoInicial'
  >[];
  valores: ValorRegistrado[];
  /** Claves de los avisos inmediatos que ya se emitieron. */
  emitidos: string[];
};

/** Clave del aviso de presupuesto de una categoría, un mes y un nivel (80 o 100). */
export function claveDePresupuesto(mes: string, categoriaId: string, nivel: 80 | 100): string {
  return `presupuesto:${mes}:${categoriaId}:${nivel}`;
}

/**
 * Avisos de cobros próximos: uno por ocurrencia pendiente, a las 9:00 del
 * día que resulta de restar `avisoDiasAntes` a su fecha. Un cobro ya
 * confirmado no avisa. Un aviso cuyo momento ya pasó no se programa.
 */
export function avisosDeCobros(
  reglas: ReglaRecurrente[],
  movimientos: DatosParaAvisos['movimientos'],
  ahora: number,
): AvisoProgramado[] {
  const hoy = diaLocal(ahora);
  const mes = hoy.slice(0, 7);
  const avisos: AvisoProgramado[] = [];
  for (let salto = 0; salto <= MESES_DE_HORIZONTE; salto++) {
    const delMes = moverMes(mes, salto);
    for (const o of ocurrenciasDelMes(reglas, movimientos, delMes, hoy)) {
      if (o.estado === 'confirmada') continue;
      const dias = Math.max(0, Math.trunc(o.regla.avisoDiasAntes));
      const instante = instanteLocal(sumarDias(o.fecha, -dias), HORA_DE_LOS_AVISOS);
      if (instante <= ahora) continue;
      avisos.push({
        clave: `cobro:${o.regla.id}:${o.mes}`,
        tipo: 'cobros',
        instante,
        contenido: {
          clase: 'cobro',
          nombre: o.regla.nombre,
          importe: o.regla.importe,
          divisa: o.regla.divisa,
          fecha: o.fecha,
          tipo: o.regla.tipoMovimiento,
        },
        destino: { ruta: '/cobro', parametros: { reglaId: o.regla.id, mes: o.mes } },
      });
    }
  }
  return avisos;
}

/**
 * Avisos de presupuesto: uno por categoría, mes y nivel (80 % o excedida),
 * y solo la primera vez. Se muestran en el momento, no se programan. Una
 * línea que se excede de golpe da solo el aviso de excedida, y este cubre
 * también el del 80 % para que no llegue después.
 */
export function avisosDePresupuesto(
  presupuesto: EstadoDelPresupuesto | null,
  mes: string,
  emitidos: string[],
): AvisoInmediato[] {
  if (!presupuesto) return [];
  const ya = new Set(emitidos);
  const avisos: AvisoInmediato[] = [];
  const destino = { ruta: '/plan', parametros: { seccion: 'presupuesto', mes } };
  for (const linea of presupuesto.lineas) {
    const cerca = claveDePresupuesto(mes, linea.categoriaId, 80);
    const excedida = claveDePresupuesto(mes, linea.categoriaId, 100);
    if (linea.estado === 'excedida' && !ya.has(excedida)) {
      avisos.push({
        clave: excedida,
        tipo: 'presupuesto',
        contenido: {
          clase: 'presupuesto_excedido',
          categoriaId: linea.categoriaId,
          exceso: -linea.queda,
        },
        destino,
        cubre: [excedida, cerca],
      });
    } else if (linea.estado === 'cerca' && !ya.has(cerca) && !ya.has(excedida)) {
      avisos.push({
        clave: cerca,
        tipo: 'presupuesto',
        contenido: {
          clase: 'presupuesto_cerca',
          categoriaId: linea.categoriaId,
          porcentaje: linea.porcentaje ?? 100,
        },
        destino,
        cubre: [cerca],
      });
    }
  }
  return avisos;
}

/**
 * Aviso de capturas sin revisar: uno, cuando la pendiente más antigua cumple
 * 24 horas. Sin pendientes no hay aviso. Si ya las cumplió, no se programa:
 * la persona lo verá al abrir la app.
 */
export function avisoDeCapturas(
  capturas: DatosParaAvisos['capturas'],
  ahora: number,
): AvisoProgramado[] {
  const pendientes = capturas.filter((c) => c.borradoEn === null && c.estado === 'pendiente');
  if (pendientes.length === 0) return [];
  let masAntigua = pendientes[0];
  for (const c of pendientes) {
    if (Date.parse(c.recibidaEn) < Date.parse(masAntigua.recibidaEn)) masAntigua = c;
  }
  const instante = Date.parse(masAntigua.recibidaEn) + ESPERA_DE_CAPTURAS_MS;
  if (Number.isNaN(instante) || instante <= ahora) return [];
  return [
    {
      clave: `capturas:${masAntigua.id}`,
      tipo: 'capturas',
      instante,
      contenido: { clase: 'capturas', pendientes: pendientes.length },
      destino: { ruta: '/capturas', parametros: {} },
    },
  ];
}

/**
 * Avisos de valor de inversión: uno por cuenta de inversión con algún valor
 * anotado, a las 9:00 del día en que su último valor cumple 30 días.
 */
export function avisosDeInversion(
  cuentas: DatosParaAvisos['cuentas'],
  valores: ValorRegistrado[],
  ahora: number,
): AvisoProgramado[] {
  const avisos: AvisoProgramado[] = [];
  for (const cuenta of cuentas) {
    if (cuenta.tipo !== 'inversion' || cuenta.archivada || cuenta.borradoEn !== null) continue;
    let ultima: string | null = null;
    for (const v of valores) {
      if (v.borradoEn !== null || v.cuentaId !== cuenta.id) continue;
      if (ultima === null || v.fecha > ultima) ultima = v.fecha;
    }
    if (ultima === null) continue;
    const instante = instanteLocal(sumarDias(ultima, DIAS_PARA_AVISAR), HORA_DE_LOS_AVISOS);
    if (instante <= ahora) continue;
    avisos.push({
      clave: `inversion:${cuenta.id}:${ultima}`,
      tipo: 'inversion',
      instante,
      contenido: { clase: 'inversion', nombre: cuenta.nombre, dias: DIAS_PARA_AVISAR },
      destino: { ruta: '/detalle-de-cuenta', parametros: { id: cuenta.id } },
    });
  }
  return avisos;
}

/**
 * Todos los avisos que tocan con estos datos. Solo se incluyen los tipos
 * activados. Los programados van del más cercano al más lejano y nunca son
 * más de 40: si hay más, se quedan los más cercanos.
 */
export function calcularAvisos(
  datos: DatosParaAvisos,
  preferencias: Preferencias,
  ahora: number,
): { programados: AvisoProgramado[]; inmediatos: AvisoInmediato[] } {
  const programados: AvisoProgramado[] = [];
  if (preferencias.cobros) {
    programados.push(...avisosDeCobros(datos.reglas, datos.movimientos, ahora));
  }
  if (preferencias.capturas) programados.push(...avisoDeCapturas(datos.capturas, ahora));
  if (preferencias.inversion) {
    programados.push(...avisosDeInversion(datos.cuentas, datos.valores, ahora));
  }
  programados.sort((a, b) => a.instante - b.instante || (a.clave < b.clave ? -1 : 1));
  const inmediatos = preferencias.presupuesto
    ? avisosDePresupuesto(datos.presupuesto, diaLocal(ahora).slice(0, 7), datos.emitidos)
    : [];
  return { programados: programados.slice(0, MAXIMO_DE_AVISOS), inmediatos };
}
