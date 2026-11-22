/** Cuándo se sincroniza: agrupación de cambios, un ciclo a la vez, reintentos y estado. */
import { randomUUID } from 'node:crypto';

import { generarClaveDeDatos } from '@/cripto';
import { nubeDeMentira, type NubeDeMentira } from '@/pruebas/nubeDeMentira';
import { crearDispositivo, sembrarTodo, type Dispositivo } from '@/pruebas/sincronizacionDePrueba';
import {
  AGRUPACION_DE_CAMBIOS_MS,
  crearSincronizador,
  ESPERAS_DE_REINTENTO_MS,
  type Temporizador,
} from '@/sincronizacion/sincronizador';

/** Un reloj que solo avanza cuando la prueba lo dice. */
function relojDePrueba() {
  let siguiente = 1;
  const puestos = new Map<number, { tarea: () => void; ms: number }>();
  const temporizador: Temporizador = {
    poner(tarea, ms) {
      puestos.set(siguiente, { tarea, ms });
      return siguiente++;
    },
    quitar(reloj) {
      puestos.delete(reloj as number);
    },
  };
  return {
    temporizador,
    esperas: () => [...puestos.values()].map((p) => p.ms),
    /** Hace saltar todos los relojes puestos. */
    saltar() {
      const tareas = [...puestos.values()].map((p) => p.tarea);
      puestos.clear();
      tareas.forEach((tarea) => tarea());
    },
  };
}

let nube: NubeDeMentira;
let usuario: string;
let d: Dispositivo;
let reloj: ReturnType<typeof relojDePrueba>;
let conSesion: boolean;
let aplicados: number;

async function montar(opciones: { sembrar?: boolean } = {}) {
  nube = nubeDeMentira();
  usuario = randomUUID();
  const clave = await generarClaveDeDatos();
  d = await crearDispositivo({ servidor: nube.servidorDe(() => usuario), clave });
  if (opciones.sembrar !== false) await sembrarTodo(d);
  reloj = relojDePrueba();
  conSesion = true;
  aplicados = 0;
  const s = crearSincronizador({
    motor: async () => d.motor,
    haySesion: () => conSesion,
    alAplicar: () => {
      aplicados += 1;
    },
    temporizador: reloj.temporizador,
  });
  return { s, clave };
}

/** Deja terminar lo que el sincronizador tenga en marcha. */
const asentar = async (s: { estado: () => { trabajando: boolean } }) => {
  const ceder = () => new Promise((seguir) => setImmediate(seguir));
  await ceder();
  for (let i = 0; i < 500 && s.estado().trabajando; i += 1) await ceder();
};

describe('sin sesión', () => {
  it('no hace nada: ni toca el motor ni la red', async () => {
    const { s } = await montar();
    conSesion = false;
    const motor = jest.spyOn(d.motor, 'ciclo');
    for (const motivo of ['arranque', 'primer_plano', 'cambio', 'manual'] as const) {
      await s.pedir(motivo);
    }
    reloj.saltar();
    expect(motor).not.toHaveBeenCalled();
    expect(nube.estado.llamadas).toEqual([]);
    expect(reloj.esperas()).toEqual([]);
    expect(s.estado()).toMatchObject({ fase: 'inactiva', trabajando: false, ultima: null });
  });
});

describe('con sesión', () => {
  it('al entrar liga la base, sube, y deja el estado al día', async () => {
    const { s } = await montar();
    const fases: string[] = [];
    s.suscribir(() => fases.push(`${s.estado().fase}/${s.estado().trabajando}`));
    await s.pedir('sesion');
    expect(s.estado()).toMatchObject({ fase: 'al_dia', trabajando: false, pendientes: 0 });
    expect(s.estado().ultima).not.toBeNull();
    expect(fases[0]).toBe('inactiva/true');
    expect(nube.de(usuario).length).toBeGreaterThan(12);
  });

  it('los cambios seguidos se agrupan en una sola sincronización, poco después', async () => {
    const { s } = await montar();
    await s.pedir('sesion');
    const subidas = () => nube.estado.llamadas.filter((l) => l === 'subir').length;
    const antes = subidas();
    for (let i = 0; i < 5; i += 1) {
      await d.categorias.crear({ nombre: `Nueva ${i}`, tipo: 'gasto' });
      void s.pedir('cambio');
    }
    // Todavía no ha salido nada: hay un único reloj, con la espera de agrupación.
    expect(subidas()).toBe(antes);
    expect(reloj.esperas()).toEqual([AGRUPACION_DE_CAMBIOS_MS]);
    reloj.saltar();
    await asentar(s);
    await s.pedir('primer_plano');
    expect(subidas()).toBe(antes + 1);
    expect(s.estado().pendientes).toBe(0);
  });

  it('solo hay un ciclo a la vez; lo pedido mientras tanto se hace al terminar', async () => {
    const { s } = await montar();
    const ciclo = jest.spyOn(d.motor, 'ciclo');
    const todas = [s.pedir('sesion'), s.pedir('primer_plano'), s.pedir('manual')];
    await Promise.all(todas);
    // La primera vuelta (sin ligar → entrada → ciclo) y una más por lo pedido entretanto.
    expect(ciclo).toHaveBeenCalledTimes(3);
    expect(ciclo.mock.calls[2][0]).toEqual({ repaso: true });
    expect(s.estado().trabajando).toBe(false);
  });

  it('«Sincronizar ahora» hace además el repaso completo', async () => {
    const { s } = await montar();
    await s.pedir('sesion');
    const marcas = () => nube.estado.llamadas.filter((l) => l === 'marcas').length;
    await s.pedir('primer_plano');
    expect(marcas()).toBe(0);
    await s.pedir('manual');
    expect(marcas()).toBe(1);
  });

  it('avisa a las pantallas solo cuando ha traído cambios', async () => {
    const { s, clave } = await montar();
    await s.pedir('sesion');
    expect(aplicados).toBe(0);
    const otro = await crearDispositivo({ servidor: nube.servidorDe(() => usuario), clave });
    await otro.motor.evaluarEntrada();
    await otro.motor.ciclo();
    await otro.categorias.crear({ nombre: 'Desde el otro', tipo: 'gasto' });
    await otro.motor.ciclo();
    await s.pedir('primer_plano');
    expect(aplicados).toBe(1);
    await s.pedir('primer_plano');
    expect(aplicados).toBe(1);
  });
});

describe('fallos y reintentos', () => {
  it('sin conexión lo dice, guarda lo pendiente y reintenta con espera creciente', async () => {
    const { s } = await montar();
    await s.pedir('sesion');
    nube.estado.sinRed = true;
    await d.categorias.crear({ nombre: 'Sin red', tipo: 'gasto' });
    await s.pedir('primer_plano');
    expect(s.estado()).toMatchObject({ fase: 'sin_conexion', pendientes: 1 });
    const vistas: number[] = [];
    for (let i = 0; i < ESPERAS_DE_REINTENTO_MS.length + 2; i += 1) {
      vistas.push(...reloj.esperas());
      reloj.saltar();
      await asentar(s);
    }
    // Crece hasta el tope y ahí se queda.
    expect(vistas.slice(0, 4)).toEqual(ESPERAS_DE_REINTENTO_MS);
    expect(vistas[vistas.length - 1]).toBe(ESPERAS_DE_REINTENTO_MS[3]);
    // Vuelve la red: el siguiente reintento sube y la espera vuelve a cero.
    nube.estado.sinRed = false;
    reloj.saltar();
    await asentar(s);
    await s.pedir('primer_plano');
    expect(s.estado()).toMatchObject({ fase: 'al_dia', pendientes: 0 });
    expect(reloj.esperas()).toEqual([]);
    nube.estado.sinRed = true;
    await s.pedir('primer_plano');
    expect(reloj.esperas()).toEqual([ESPERAS_DE_REINTENTO_MS[0]]);
  });

  it('una sesión caducada no se reintenta sola: hay que volver a entrar', async () => {
    const { s } = await montar();
    await s.pedir('sesion');
    const sesion = usuario;
    usuario = null as unknown as string;
    await s.pedir('primer_plano');
    expect(s.estado().fase).toBe('sesion_caducada');
    expect(reloj.esperas()).toEqual([]);
    usuario = sesion;
    await s.pedir('manual');
    expect(s.estado().fase).toBe('al_dia');
  });

  it('un servidor averiado es «error», no «sin conexión», y cuenta lo que no se puede aplicar', async () => {
    const { s } = await montar();
    await s.pedir('sesion');
    nube.estado.averiado = true;
    await s.pedir('primer_plano');
    expect(s.estado().fase).toBe('error');
    nube.estado.averiado = false;
    // Un sobre manipulado en el servidor.
    const [fila] = nube.de(usuario);
    fila.contenido = `${fila.contenido.slice(0, 40)}${fila.contenido[40] === 'A' ? 'B' : 'A'}${fila.contenido.slice(41)}`;
    fila.actualizada_en = nube.marca();
    await s.pedir('manual');
    expect(s.estado()).toMatchObject({ fase: 'al_dia', ilegibles: 1 });
  });

  it('una fila que el servidor rechaza deja el estado en «parcial»', async () => {
    const { s } = await montar();
    await s.pedir('sesion');
    const mala = await d.categorias.crear({ nombre: 'Rechazada', tipo: 'gasto' });
    nube.estado.rechazados.add(mala.id);
    await s.pedir('primer_plano');
    expect(s.estado()).toMatchObject({ fase: 'parcial', pendientes: 1 });
  });
});

describe('la pregunta de entrada', () => {
  async function conDatosEnLosDosLados() {
    const { s, clave } = await montar();
    const otro = await crearDispositivo({ servidor: nube.servidorDe(() => usuario), clave });
    await sembrarTodo(otro);
    await otro.motor.evaluarEntrada();
    await otro.motor.ciclo();
    return { s, otro };
  }

  it('con datos en los dos lados se queda preguntando y no sincroniza nada', async () => {
    const { s } = await conDatosEnLosDosLados();
    const local = await d.volcar();
    const remotas = nube.filas.size;
    await s.pedir('sesion');
    expect(s.estado()).toMatchObject({ fase: 'preguntar', trabajando: false });
    // Ni volver a primer plano, ni un cambio, ni el botón mueven nada mientras no se responda.
    await s.pedir('primer_plano');
    await s.pedir('manual');
    void s.pedir('cambio');
    reloj.saltar();
    await asentar(s);
    expect(reloj.esperas()).toEqual([]);
    expect(await d.volcar()).toEqual(local);
    expect(nube.filas.size).toBe(remotas);
  });

  it('«usar la nube» sin copia no cambia nada; con copia, reemplaza y sigue sincronizando', async () => {
    const { s, otro } = await conDatosEnLosDosLados();
    const local = await d.volcar();
    await s.pedir('sesion');
    expect(await s.usarLaNube(async () => false)).toEqual({ estado: 'sin_copia' });
    expect(await d.volcar()).toEqual(local);
    expect(s.estado().fase).toBe('preguntar');

    expect((await s.usarLaNube(async () => true)).estado).toBe('hecho');
    expect(await d.volcar()).toEqual(await otro.volcar());
    expect(aplicados).toBe(1);
    await s.pedir('primer_plano');
    expect(s.estado()).toMatchObject({ fase: 'al_dia', pendientes: 0 });
  });

  it('cancelar (cerrar sesión) deja todo como estaba y el estado en reposo', async () => {
    const { s } = await conDatosEnLosDosLados();
    const local = await d.volcar();
    await s.pedir('sesion');
    conSesion = false;
    s.alCerrarSesion();
    expect(s.estado()).toMatchObject({ fase: 'inactiva', ultima: null });
    expect(await d.volcar()).toEqual(local);
    expect((await d.motor.resumen()).usuario).toBeNull();
  });
});

describe('cerrar sesión y borrar la cuenta', () => {
  it('cerrar sesión para los relojes y conserva la liga; borrar la cuenta la quita', async () => {
    const { s } = await montar();
    await s.pedir('sesion');
    nube.estado.sinRed = true;
    await s.pedir('primer_plano');
    expect(reloj.esperas()).toHaveLength(1);
    conSesion = false;
    s.alCerrarSesion();
    expect(reloj.esperas()).toEqual([]);
    expect((await d.motor.resumen()).usuario).toBe(usuario);
    const datos = await d.volcar();
    await s.alBorrarCuenta();
    expect((await d.motor.resumen()).usuario).toBeNull();
    expect(await d.volcar()).toEqual(datos);
  });
});
