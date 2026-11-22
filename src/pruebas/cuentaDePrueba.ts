/**
 * Dobles de prueba para la cuenta: un almacén de secretos en memoria y un
 * servidor de mentira que se comporta como Supabase en lo que la cuenta usa,
 * y que apunta todo lo que recibe para poder comprobar qué sale del dispositivo.
 */
import type { ClienteDeCuenta } from '@/estado/cuenta';
import type { AlmacenSeguro } from '@/lib/almacenSeguro';

export function almacenEnMemoria() {
  const datos = new Map<string, string>();
  const almacen: AlmacenSeguro = {
    leer: async (clave) => datos.get(clave) ?? null,
    guardar: async (clave, valor) => {
      datos.set(clave, valor);
    },
    borrar: async (clave) => {
      datos.delete(clave);
    },
  };
  return { almacen, datos };
}

type Usuario = { id: string; email: string; password: string };
export type Corte = 'antes' | 'despues' | 'rechazo';

export function servidorDeMentira() {
  const usuarios = new Map<string, Usuario>();
  const claves = new Map<string, Record<string, unknown>>();
  /** Todo lo que el «servidor» ha recibido, tal cual. */
  const recibido: unknown[] = [];
  let sesion: Usuario | null = null;
  const estado = {
    /** Sin red: toda petición falla como falla `fetch` sin conexión. */
    sinRed: false,
    /** El servidor no contesta nunca. */
    colgado: false,
    /** Fallo del servidor al guardar las claves. */
    fallaAlGuardarClaves: false,
    /** Operaciones pedidas, en orden. */
    llamadas: [] as string[],
    /**
     * Para cortar una operación concreta: «antes» falla sin hacer nada (la
     * petición no llega); «despues» la hace y pierde la respuesta; «rechazo»
     * es el servidor diciendo que no. Recibe el nombre y cuántas veces va pedida.
     */
    cortar: null as null | ((operacion: string, vez: number) => Corte | undefined),
  };
  const veces = new Map<string, number>();
  /** Qué corte toca en esta llamada, si toca alguno. */
  function corteDe(operacion: string): Corte | undefined {
    const vez = (veces.get(operacion) ?? 0) + 1;
    veces.set(operacion, vez);
    return estado.cortar?.(operacion, vez);
  }
  const DE_RED = { name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 };
  const colgar = () => new Promise<never>(() => undefined);
  const sesionDe = (u: Usuario) => ({ user: { id: u.id, email: u.email } });

  async function antes(operacion: string, datos?: unknown) {
    estado.llamadas.push(operacion);
    if (datos !== undefined) recibido.push(datos);
    if (estado.colgado) await colgar();
  }

  const cliente: ClienteDeCuenta = {
    auth: {
      async signUp(datos) {
        await antes('signUp', datos);
        if (estado.sinRed) return { data: { user: null, session: null }, error: DE_RED };
        if (usuarios.has(datos.email)) {
          return {
            data: { user: null, session: null },
            error: { message: 'User already registered', status: 422, code: 'user_already_exists' },
          };
        }
        const usuario = { id: `u-${usuarios.size + 1}`, ...datos };
        usuarios.set(datos.email, usuario);
        sesion = usuario;
        return { data: { user: { id: usuario.id }, session: sesionDe(usuario) }, error: null };
      },
      async signInWithPassword(datos) {
        await antes('signInWithPassword', datos);
        if (estado.sinRed) return { data: { session: null }, error: DE_RED };
        const usuario = usuarios.get(datos.email);
        if (!usuario || usuario.password !== datos.password) {
          return {
            data: { session: null },
            error: {
              message: 'Invalid login credentials',
              status: 400,
              code: 'invalid_credentials',
            },
          };
        }
        sesion = usuario;
        return { data: { session: sesionDe(usuario) }, error: null };
      },
      async updateUser(datos) {
        await antes('updateUser', datos);
        const corte = corteDe('updateUser');
        if (estado.sinRed || corte === 'antes') return { error: DE_RED };
        if (corte === 'rechazo') return { error: { message: 'no', status: 422, code: 'weak' } };
        if (!sesion) return { error: { message: 'sin sesión', status: 401, code: 'no_session' } };
        if (datos.current_password !== undefined && datos.current_password !== sesion.password) {
          return { error: { message: 'no', status: 400, code: 'current_password_mismatch' } };
        }
        sesion.password = datos.password;
        return corte === 'despues' ? { error: DE_RED } : { error: null };
      },
      async signOut() {
        estado.llamadas.push('signOut');
        sesion = null;
        return { error: null };
      },
      async getSession() {
        return { data: { session: sesion ? sesionDe(sesion) : null }, error: null };
      },
    },
    from() {
      return {
        select() {
          return {
            async maybeSingle() {
              await antes('select claves');
              if (estado.sinRed)
                return { data: null, error: { message: 'TypeError: fetch failed' } };
              return { data: sesion ? (claves.get(sesion.id) ?? null) : null, error: null };
            },
          };
        },
        async insert(fila) {
          await antes('insert claves', fila);
          if (estado.sinRed) return { error: { message: 'TypeError: Network request failed' } };
          if (estado.fallaAlGuardarClaves) return { error: { message: 'fallo', code: '500' } };
          if (!sesion) return { error: { message: 'sin sesión', code: '42501' } };
          claves.set(sesion.id, fila);
          return { error: null };
        },
        update(fila) {
          return {
            eq(_columna, usuario) {
              return {
                async select() {
                  await antes('update claves', fila);
                  const corte = corteDe('update claves');
                  const DE_RED_AQUI = { message: 'TypeError: Network request failed' };
                  if (estado.sinRed || corte === 'antes') return { data: null, error: DE_RED_AQUI };
                  if (corte === 'rechazo')
                    return { data: null, error: { message: 'no', code: '500' } };
                  // Como RLS: solo la fila propia, y sin sesión no cambia ninguna.
                  const actual = sesion?.id === usuario ? claves.get(usuario) : undefined;
                  if (!actual) return { data: [], error: null };
                  claves.set(usuario, { ...actual, ...fila });
                  if (corte === 'despues') return { data: null, error: DE_RED_AQUI };
                  return { data: [{ user_id: usuario }], error: null };
                },
              };
            },
          };
        },
      };
    },
    async rpc() {
      await antes('rpc borrar_mi_cuenta');
      if (estado.sinRed) return { error: { message: 'TypeError: fetch failed' } };
      if (!sesion) return { error: { message: 'sin sesión', code: '28000' } };
      claves.delete(sesion.id);
      usuarios.delete(sesion.email);
      return { error: null };
    },
  };

  return { cliente, usuarios, claves, recibido, estado, sesionActual: () => sesion };
}
