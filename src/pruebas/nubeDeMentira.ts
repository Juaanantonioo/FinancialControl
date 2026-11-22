/**
 * Un servidor de filas de mentira, en memoria, para probar el motor de
 * sincronización sin red. Se comporta como la tabla `fila_cifrada`: pone él
 * las marcas de tiempo (con microsegundos, y la misma para todo un lote),
 * aísla a cada usuario y pagina por clave. Apunta todo lo que recibe para
 * poder comprobar que solo llegan sobres cifrados, y deja manipular lo
 * guardado para hacer de servidor malicioso.
 */
import { compararMarcas } from '@/sincronizacion/marcas';
import type {
  ErrorRemoto,
  FilaParaSubir,
  FilaRemota,
  MarcaRemota,
  Respuesta,
  ServidorDeFilas,
} from '@/sincronizacion/servidor';

export type FilaGuardada = FilaParaSubir & { usuario: string; actualizada_en: string };

export function nubeDeMentira(inicio = '2026-11-22T09:00:00') {
  const filas = new Map<string, FilaGuardada>();
  let micros = 0;
  const estado = {
    /** Sin red: toda petición falla. */
    sinRed: false,
    /** El servidor responde con error a todo. */
    averiado: false,
    /** Ids que el servidor rechaza al guardar (y con ellos, su lote). */
    rechazados: new Set<string>(),
    /** Todo lo que el «servidor» ha recibido en subidas, tal cual. */
    recibido: [] as FilaParaSubir[],
    /** Operaciones pedidas, en orden. */
    llamadas: [] as string[],
  };

  /** Una marca nueva, posterior a todas las anteriores. */
  function marca(): string {
    // De milisegundo y medio en milisegundo y medio: dos marcas nunca caen en el mismo milisegundo.
    micros += 1500;
    const segundos = String(Math.floor(micros / 1_000_000)).padStart(2, '0');
    const fraccion = String(micros % 1_000_000).padStart(6, '0');
    return `${inicio.slice(0, 17)}${segundos}.${fraccion}+00:00`;
  }

  const k = (usuario: string, tabla: string, id: string) => `${usuario}/${tabla}/${id}`;
  const aRemota = (f: FilaGuardada): FilaRemota => ({
    tabla: f.tabla,
    id: f.id,
    contenido: f.contenido,
    actualizada_en: f.actualizada_en,
  });
  const de = (usuario: string) => [...filas.values()].filter((f) => f.usuario === usuario);

  function antes<T>(operacion: string): Respuesta<T> | null {
    estado.llamadas.push(operacion);
    const error: ErrorRemoto | null = estado.sinRed ? 'red' : estado.averiado ? 'servidor' : null;
    return error ? { ok: false, error } : null;
  }

  /** El servidor visto desde un dispositivo con la sesión de `sesion` (o sin sesión). */
  function servidorDe(sesion: () => string | null): ServidorDeFilas {
    const sinPermiso = (usuario: string) => sesion() !== usuario;
    return {
      async usuario() {
        return antes<string | null>('usuario') ?? { ok: true, datos: sesion() };
      },
      async hayFilas(usuario) {
        const fallo = antes<boolean>('hayFilas');
        if (fallo) return fallo;
        if (sinPermiso(usuario)) return { ok: false, error: 'sesion' };
        return { ok: true, datos: de(usuario).length > 0 };
      },
      async subir(usuario, lote) {
        const fallo = antes<MarcaRemota[]>('subir');
        if (fallo) return fallo;
        estado.recibido.push(...lote);
        if (sinPermiso(usuario)) return { ok: false, error: 'sesion' };
        if (lote.some((f) => estado.rechazados.has(f.id))) return { ok: false, error: 'servidor' };
        const actualizada_en = marca();
        for (const fila of lote) {
          filas.set(k(usuario, fila.tabla, fila.id), { ...fila, usuario, actualizada_en });
        }
        return {
          ok: true,
          datos: lote.map((f) => ({ tabla: f.tabla, id: f.id, actualizada_en })),
        };
      },
      async cambios(usuario, desde, tras, limite) {
        const fallo = antes<FilaRemota[]>('cambios');
        if (fallo) return fallo;
        if (sinPermiso(usuario)) return { ok: false, error: 'sesion' };
        const orden = (a: MarcaRemota, b: MarcaRemota) =>
          compararMarcas(a.actualizada_en, b.actualizada_en) ||
          a.tabla.localeCompare(b.tabla) ||
          a.id.localeCompare(b.id);
        const datos = de(usuario)
          .filter((f) =>
            tras ? orden(f, tras) > 0 : !desde || compararMarcas(f.actualizada_en, desde) >= 0,
          )
          .sort(orden)
          .slice(0, limite)
          .map(aRemota);
        return { ok: true, datos };
      },
      async marcas(usuario, tras, limite) {
        const fallo = antes<MarcaRemota[]>('marcas');
        if (fallo) return fallo;
        if (sinPermiso(usuario)) return { ok: false, error: 'sesion' };
        const orden = (a: { tabla: string; id: string }, b: { tabla: string; id: string }) =>
          a.tabla.localeCompare(b.tabla) || a.id.localeCompare(b.id);
        const datos = de(usuario)
          .filter((f) => !tras || orden(f, tras) > 0)
          .sort(orden)
          .slice(0, limite)
          .map(({ tabla, id, actualizada_en }) => ({ tabla, id, actualizada_en }));
        return { ok: true, datos };
      },
      async porIds(usuario, tabla, ids) {
        const fallo = antes<FilaRemota[]>('porIds');
        if (fallo) return fallo;
        if (sinPermiso(usuario)) return { ok: false, error: 'sesion' };
        const datos = de(usuario)
          .filter((f) => f.tabla === tabla && ids.includes(f.id))
          .map(aRemota);
        return { ok: true, datos };
      },
    };
  }

  return {
    estado,
    filas,
    marca,
    clave: k,
    servidorDe,
    /** Las filas guardadas de un usuario. */
    de,
  };
}

export type NubeDeMentira = ReturnType<typeof nubeDeMentira>;
