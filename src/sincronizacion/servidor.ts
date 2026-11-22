/**
 * Lo que el motor de sincronización necesita del servidor, y su versión con el
 * cliente de Supabase.
 *
 * El motor solo conoce la interfaz `ServidorDeFilas`: así se puede probar con
 * un servidor de mentira y también contra un Supabase de verdad. Aquí no se
 * cifra ni se descifra nada: lo que entra y sale son sobres ya cifrados.
 *
 * Ninguna función lanza errores ni devuelve mensajes del servidor: solo dice
 * qué clase de fallo ha habido, para que la pantalla lo explique con sus textos.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { esUuid } from './filas';
import { esMarca } from './marcas';
import { tablaSincronizada } from './tablas';

/** Clase de fallo: sin red, sin sesión válida, o el servidor ha rechazado la petición. */
export type ErrorRemoto = 'red' | 'sesion' | 'servidor';
export type Respuesta<T> = { ok: true; datos: T } | { ok: false; error: ErrorRemoto };

export type FilaParaSubir = {
  tabla: string;
  id: string;
  contenido: string;
  version_de_formato: number;
  borrada: boolean;
};
export type MarcaRemota = { tabla: string; id: string; actualizada_en: string };
export type FilaRemota = MarcaRemota & { contenido: string };
/** Última fila de una página: la siguiente empieza justo después. */
export type Posicion = MarcaRemota;

export interface ServidorDeFilas {
  /** Id del usuario de la sesión guardada, o `null` si no hay sesión. */
  usuario(): Promise<Respuesta<string | null>>;
  /** `true` si la cuenta tiene alguna fila en el servidor. */
  hayFilas(usuario: string): Promise<Respuesta<boolean>>;
  /** Guarda o sustituye filas. Devuelve la marca de tiempo que el servidor ha puesto a cada una. */
  subir(usuario: string, filas: FilaParaSubir[]): Promise<Respuesta<MarcaRemota[]>>;
  /**
   * Una página de filas ordenadas por (actualizada_en, tabla, id): las de marca
   * igual o posterior a `desde` o, si se da `tras`, las que van después de esa fila.
   */
  cambios(
    usuario: string,
    desde: string | null,
    tras: Posicion | null,
    limite: number,
  ): Promise<Respuesta<FilaRemota[]>>;
  /** Una página de marcas (sin contenido) de todas las filas, ordenadas por (tabla, id). */
  marcas(
    usuario: string,
    tras: { tabla: string; id: string } | null,
    limite: number,
  ): Promise<Respuesta<MarcaRemota[]>>;
  /** Filas de una tabla por sus ids. */
  porIds(usuario: string, tabla: string, ids: string[]): Promise<Respuesta<FilaRemota[]>>;
}

/** Milisegundos que se espera como mucho a una respuesta. */
export const ESPERA_MAXIMA_MS = 20_000;

const TABLA_REMOTA = 'fila_cifrada';
const fallo = (error: ErrorRemoto) => ({ ok: false as const, error });

type ErrorDelCliente = { message?: string; code?: string; name?: string; status?: number } | null;

/** Traduce el error del cliente a una de las tres clases, sin conservar su texto. */
function clasificar(error: ErrorDelCliente, estadoHttp?: number): ErrorRemoto {
  const codigo = error?.code ?? '';
  const mensaje = error?.message ?? '';
  // Sesión que el servidor no acepta: sin token, token caducado o rol sin permiso.
  if (estadoHttp === 401 || estadoHttp === 403) return 'sesion';
  if (codigo === 'PGRST301' || codigo === 'PGRST302' || codigo === 'PGRST303') return 'sesion';
  if (codigo === '42501' || codigo === '28000') return 'sesion';
  if (error?.name === 'AuthSessionMissingError') return 'sesion';
  if (error?.name === 'AuthRetryableFetchError' || estadoHttp === 0) return 'red';
  if (!codigo && (estadoHttp === undefined || estadoHttp === 0 || estadoHttp >= 500)) {
    if (/network|fetch|timeout|failed to|abort|load failed/i.test(mensaje) || !estadoHttp) {
      return 'red';
    }
  }
  return 'servidor';
}

class Tardanza extends Error {}

function conLimite<T>(promesa: PromiseLike<T>, limite: number): Promise<T> {
  return new Promise<T>((resolver, rechazar) => {
    const reloj = setTimeout(() => rechazar(new Tardanza()), limite);
    Promise.resolve(promesa).then(
      (valor) => {
        clearTimeout(reloj);
        resolver(valor);
      },
      (error) => {
        clearTimeout(reloj);
        rechazar(error);
      },
    );
  });
}

/** Comprueba que lo que devuelve el servidor tiene forma de marca. Lo que no, se descarta. */
function esMarcaRemota(fila: unknown): fila is MarcaRemota {
  const f = fila as Partial<MarcaRemota> | null;
  return !!f && esNombreDeTabla(f.tabla) && esUuid(f.id) && esMarca(f.actualizada_en);
}

/** Nombre de tabla con forma segura para ir dentro de un filtro, la conozca o no esta versión. */
const esNombreDeTabla = (texto: unknown): texto is string =>
  typeof texto === 'string' && /^[a-z_]{1,64}$/.test(texto);

function esFilaRemota(fila: unknown): fila is FilaRemota {
  return esMarcaRemota(fila) && typeof (fila as Partial<FilaRemota>).contenido === 'string';
}

/** El servidor de filas sobre el cliente de Supabase de la app (o el de una prueba). */
export function crearServidorDeFilas(
  cliente: SupabaseClient,
  esperaMaxima: number = ESPERA_MAXIMA_MS,
): ServidorDeFilas {
  type Resultado = { data: unknown; error: ErrorDelCliente; status?: number };

  /** Hace una petición y devuelve sus filas, ya comprobadas, o la clase de fallo. */
  async function pedir<T>(
    peticion: () => PromiseLike<Resultado>,
    valida: (fila: unknown) => fila is T,
  ): Promise<Respuesta<T[]>> {
    let resultado: Resultado;
    try {
      resultado = await conLimite(peticion(), esperaMaxima);
    } catch {
      // No ha contestado a tiempo, o el cliente no ha podido ni enviar la petición.
      return fallo('red');
    }
    if (resultado.error) return fallo(clasificar(resultado.error, resultado.status));
    const filas = Array.isArray(resultado.data) ? resultado.data : [];
    // Una respuesta con filas deformes no es de fiar entera.
    if (!filas.every(valida)) return fallo('servidor');
    return { ok: true, datos: filas };
  }

  return {
    async usuario() {
      try {
        const { data, error } = await conLimite(cliente.auth.getSession(), esperaMaxima);
        if (error) {
          const clase = clasificar(error as ErrorDelCliente, (error as ErrorDelCliente)?.status);
          // Un fallo al renovar que no es de red deja la sesión sin valor.
          return clase === 'red' ? fallo('red') : { ok: true, datos: null };
        }
        const id = data.session?.user?.id;
        return { ok: true, datos: esUuid(id) ? id : null };
      } catch {
        return fallo('red');
      }
    },

    async hayFilas(usuario) {
      if (!esUuid(usuario)) return fallo('servidor');
      const r = await pedir(
        () => cliente.from(TABLA_REMOTA).select('tabla,id').eq('user_id', usuario).limit(1),
        (fila): fila is { id: string } => esUuid((fila as { id?: unknown } | null)?.id),
      );
      return r.ok ? { ok: true, datos: r.datos.length > 0 } : r;
    },

    async subir(usuario, filas) {
      if (!esUuid(usuario)) return fallo('servidor');
      if (filas.length === 0) return { ok: true, datos: [] };
      return pedir(
        () =>
          cliente
            .from(TABLA_REMOTA)
            .upsert(
              filas.map((fila) => ({ user_id: usuario, ...fila })),
              { onConflict: 'user_id,tabla,id' },
            )
            .select('tabla,id,actualizada_en'),
        esMarcaRemota,
      );
    },

    async cambios(usuario, desde, tras, limite) {
      if (!esUuid(usuario)) return fallo('servidor');
      if (desde !== null && !esMarca(desde)) return fallo('servidor');
      if (tras && !esMarcaRemota(tras)) {
        // La posición sale de una respuesta del servidor: no se reenvía sin comprobarla.
        return fallo('servidor');
      }
      return pedir(() => {
        let consulta = cliente
          .from(TABLA_REMOTA)
          .select('tabla,id,contenido,actualizada_en')
          .eq('user_id', usuario);
        if (tras) {
          const marca = `"${tras.actualizada_en}"`;
          consulta = consulta.or(
            `actualizada_en.gt.${marca},` +
              `and(actualizada_en.eq.${marca},tabla.gt.${tras.tabla}),` +
              `and(actualizada_en.eq.${marca},tabla.eq.${tras.tabla},id.gt.${tras.id})`,
          );
        } else if (desde) {
          consulta = consulta.gte('actualizada_en', desde);
        }
        return consulta.order('actualizada_en').order('tabla').order('id').limit(limite);
      }, esFilaRemota);
    },

    async marcas(usuario, tras, limite) {
      if (!esUuid(usuario)) return fallo('servidor');
      if (tras && (!esUuid(tras.id) || !esNombreDeTabla(tras.tabla))) return fallo('servidor');
      return pedir(() => {
        let consulta = cliente
          .from(TABLA_REMOTA)
          .select('tabla,id,actualizada_en')
          .eq('user_id', usuario);
        if (tras) {
          consulta = consulta.or(
            `tabla.gt.${tras.tabla},and(tabla.eq.${tras.tabla},id.gt.${tras.id})`,
          );
        }
        return consulta.order('tabla').order('id').limit(limite);
      }, esMarcaRemota);
    },

    async porIds(usuario, tabla, ids) {
      if (!esUuid(usuario) || !tablaSincronizada(tabla) || !ids.every(esUuid)) {
        return fallo('servidor');
      }
      if (ids.length === 0) return { ok: true, datos: [] };
      return pedir(
        () =>
          cliente
            .from(TABLA_REMOTA)
            .select('tabla,id,contenido,actualizada_en')
            .eq('user_id', usuario)
            .eq('tabla', tabla)
            .in('id', ids),
        esFilaRemota,
      );
    },
  };
}
