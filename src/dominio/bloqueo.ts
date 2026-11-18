/**
 * Bloqueo de la app: cuándo toca pedir autenticación.
 *
 * El bloqueo es una barrera de acceso a la interfaz. No cifra nada: los datos
 * siguen guardados igual con el bloqueo puesto o quitado, y ninguna clave
 * depende de la cara, la huella o el código.
 *
 * Todo aquí es puro: «ahora» entra como parámetro.
 */

/** Tiempo que la app puede pasar en segundo plano sin volver a pedir autenticación. */
export const ESPERAS = ['inmediato', '1min', '5min'] as const;
export type Espera = (typeof ESPERAS)[number];

export const MILISEGUNDOS_DE_ESPERA: Record<Espera, number> = {
  inmediato: 0,
  '1min': 60_000,
  '5min': 300_000,
};

export type AjustesDeBloqueo = { activo: boolean; espera: Espera };

/** Como viene la app recién instalada: sin bloqueo. */
export const SIN_BLOQUEO: AjustesDeBloqueo = { activo: false, espera: 'inmediato' };

/** Lo que se aplica cuando lo guardado no se entiende: bloqueo puesto y sin espera. */
export const BLOQUEO_MAS_ESTRICTO: AjustesDeBloqueo = { activo: true, espera: 'inmediato' };

/**
 * Convierte lo guardado en ajustes válidos.
 *
 * - Nada guardado: sin bloqueo. Es el estado de una instalación nueva.
 * - Algo guardado que no se entiende (texto roto, tipos equivocados): el
 *   bloqueo más estricto. Si había algo guardado es porque la persona entró
 *   en Seguridad, y ante la duda es más seguro pedir autenticación de más
 *   que dejar pasar sin ella. No deja a nadie fuera: se desbloquea con la
 *   cara, la huella o el código del iPhone, igual que siempre.
 * - Bloqueo activo con una espera desconocida: activo y sin espera.
 */
export function interpretarBloqueo(texto: string | null | undefined): AjustesDeBloqueo {
  if (texto === null || texto === undefined) return { ...SIN_BLOQUEO };
  let guardado: unknown;
  try {
    guardado = JSON.parse(texto);
  } catch {
    return { ...BLOQUEO_MAS_ESTRICTO };
  }
  if (typeof guardado !== 'object' || guardado === null || Array.isArray(guardado)) {
    return { ...BLOQUEO_MAS_ESTRICTO };
  }
  const { activo, espera } = guardado as Record<string, unknown>;
  if (typeof activo !== 'boolean') return { ...BLOQUEO_MAS_ESTRICTO };
  const esperaValida = (ESPERAS as readonly unknown[]).includes(espera);
  if (!activo) return { activo: false, espera: esperaValida ? (espera as Espera) : 'inmediato' };
  return { activo: true, espera: esperaValida ? (espera as Espera) : 'inmediato' };
}

/**
 * Un instante medido con dos relojes:
 * - `reloj`: la hora del iPhone en milisegundos. La persona puede cambiarla.
 * - `monotono`: milisegundos de un reloj que solo avanza y que nadie puede
 *   cambiar, pero que se para mientras el iPhone duerme.
 */
export type Instante = { reloj: number; monotono: number };

/** Desajuste que se admite entre los dos relojes antes de sospechar de un cambio de hora. */
export const TOLERANCIA_ENTRE_RELOJES = 2_000;

/**
 * `true` si al volver a primer plano hay que pedir autenticación.
 *
 * `salida` es el instante en que la app pasó a segundo plano, o `null` si no
 * ha salido. Ante cualquier dato raro se bloquea:
 * - la hora ha ido hacia atrás (alguien cambió el reloj del iPhone);
 * - la hora ha avanzado menos que el reloj que no se puede cambiar;
 * - algún valor no es un número.
 * En lo demás cuenta el mayor de los dos tiempos transcurridos.
 */
export function tocaBloquear(
  ajustes: AjustesDeBloqueo,
  salida: Instante | null,
  ahora: Instante,
): boolean {
  if (!ajustes.activo) return false;
  if (salida === null) return false;
  const limite = MILISEGUNDOS_DE_ESPERA[ajustes.espera];
  if (limite === undefined || limite <= 0) return true;
  const porReloj = ahora.reloj - salida.reloj;
  const porMonotono = ahora.monotono - salida.monotono;
  if (!Number.isFinite(porReloj) || !Number.isFinite(porMonotono)) return true;
  if (porReloj < 0 || porMonotono < 0) return true;
  if (porReloj + TOLERANCIA_ENTRE_RELOJES < porMonotono) return true;
  return Math.max(porReloj, porMonotono) >= limite;
}

/** Con qué puede protegerse este iPhone. */
export type Capacidad = 'ninguna' | 'codigo' | 'biometria';

/** Cómo acabó un intento de autenticación. */
export type ResultadoDeAutenticacion = 'correcto' | 'cancelado' | 'fallido' | 'no_disponible';

/**
 * Qué hacer tras un intento de desbloqueo.
 *
 * Solo se entra sin autenticación correcta en un caso: el iPhone ya no tiene
 * código ni biometría (`no_disponible` y capacidad `ninguna`). Entonces no
 * hay con qué autenticarse y mantener el bloqueo dejaría a la persona sin
 * acceso a sus datos para siempre. Quitar el código del iPhone exige
 * escribirlo, así que no es un atajo para quien no lo conoce.
 */
export function trasAutenticar(
  resultado: ResultadoDeAutenticacion,
  capacidad: Capacidad,
): 'entrar' | 'entrar_sin_proteccion' | 'seguir_bloqueada' {
  if (resultado === 'correcto') return 'entrar';
  if (resultado === 'no_disponible' && capacidad === 'ninguna') return 'entrar_sin_proteccion';
  return 'seguir_bloqueada';
}
