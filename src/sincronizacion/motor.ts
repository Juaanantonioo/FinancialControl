/**
 * Motor de la sincronización cifrada: sube los cambios locales, baja los
 * remotos y los aplica. Sin pantallas, sin React y sin nada nativo: recibe la
 * base de datos, el servidor, la clave y el reloj.
 *
 * Reglas que este fichero garantiza (diseño completo en
 * `docs/seguridad/diseno-sincronizacion.md`):
 * - No sube ni baja nada si la base local no está ligada a la cuenta de la sesión.
 * - Al servidor solo van sobres cifrados. Nunca se usa DELETE.
 * - Un ciclo es subir y luego bajar: gana la última escritura que llega al servidor.
 * - Una fila que falla no detiene a las demás.
 * - Ningún error sale con el mensaje del servidor ni con contenido de una fila.
 */
import { borrar, VERSION_DE_FORMATO } from '@/cripto';
import type { CategoriaInicial } from '@/datos';
import type { BaseDeDatos, ValorSql } from '@/datos/bd';

import { cifrarFila, descifrarFila, ErrorDeFila, esUuid, type MotivoDeRetencion } from './filas';
import { compararMarcas, marcaMayor, restarAMarca } from './marcas';
import type {
  ErrorRemoto,
  FilaParaSubir,
  FilaRemota,
  MarcaRemota,
  Posicion,
  ServidorDeFilas,
} from './servidor';
import {
  ordenDeTabla,
  TABLAS,
  TABLAS_SOLO_LOCALES,
  tablaSincronizada,
  type FilaLocal,
  type TablaSincronizada,
} from './tablas';

/** Margen hacia atrás con el que se pide desde el cursor. */
export const VENTANA_DE_SOLAPE_MS = 5 * 60 * 1000;
/** Filas por petición de subida. */
export const FILAS_POR_LOTE = 100;
/** Filas por página de bajada. */
export const FILAS_POR_PAGINA = 500;
/** Filas que se aplican por transacción, para no retener la base mucho rato. */
const FILAS_POR_TRANSACCION = 200;
/** Días entre dos repasos completos automáticos. */
export const DIAS_ENTRE_REPASOS = 7;

export type EstadoDeCiclo =
  | 'correcto'
  /** Ha terminado, pero alguna fila local no se ha podido subir. */
  | 'parcial'
  | 'sin_conexion'
  | 'sesion_caducada'
  | 'error'
  /** La base local no está ligada a la cuenta de la sesión: falta decidir la entrada. */
  | 'sin_ligar'
  | 'sin_clave';

export type ResultadoDeCiclo = {
  estado: EstadoDeCiclo;
  /** Filas locales subidas. */
  subidas: number;
  /** Filas locales que el servidor ha rechazado o que no se han podido cifrar. */
  noSubidas: number;
  /** Filas remotas escritas en la base local. */
  aplicadas: number;
  /** Filas remotas que no se han podido aplicar en este ciclo. */
  retenidas: number;
  /** Repaso completo: filas que el servidor devolvió con una marca anterior a la conocida. */
  revertidas: number;
  /** Repaso completo: filas conocidas que el servidor ya no lista. */
  desaparecidas: number;
};

export type Resumen = {
  /** Cuenta a la que está ligada la base local, o `null`. */
  usuario: string | null;
  pendientes: number;
  ilegibles: number;
  noAplicables: number;
  /** Instante de la última sincronización correcta, o `null`. */
  ultima: string | null;
};

export type Entrada =
  /** La base queda ligada a la cuenta: ya se puede sincronizar. */
  | { estado: 'lista'; accion: 'continuar' | 'subir' | 'bajar' }
  /**
   * Hay que preguntar a la persona antes de hacer nada. «subir»: el dispositivo
   * tiene datos y la nube está vacía (¿subirlos a la cuenta?). «nube»: los dos
   * tienen datos y no se fusionan (¿usar los de la nube?).
   */
  | { estado: 'preguntar'; pregunta: 'subir' | 'nube' }
  | { estado: 'sin_conexion' | 'sesion_caducada' | 'error' | 'sin_clave' };

export type ResultadoDeUsarLaNube =
  | { estado: 'hecho'; aplicadas: number; retenidas: number }
  /** La persona no ha guardado la copia de sus datos locales: no se ha tocado nada. */
  | { estado: 'sin_copia' }
  | { estado: 'sin_conexion' | 'sesion_caducada' | 'error' | 'sin_clave' };

export type DependenciasDelMotor = {
  bd: BaseDeDatos;
  servidor: ServidorDeFilas;
  /** La clave de datos de la cuenta, o `null` si no hay. El motor la borra al acabar. */
  leerClave: () => Promise<Uint8Array | null>;
  ahora: () => Date;
  /** Las categorías que la app crea al instalarse, para reconocer un dispositivo sin datos. */
  categoriasIniciales: CategoriaInicial[];
  ventanaMs?: number;
  filasPorLote?: number;
  filasPorPagina?: number;
};

export type Motor = ReturnType<typeof crearMotor>;

type Marca = { cambio: number; tabla: string; id: string };
type Candidata = { remota: FilaRemota; fila: FilaLocal };
type Retenida = { remota: FilaRemota; motivo: MotivoDeRetencion };
type Preparadas = {
  candidatas: Candidata[];
  retenidas: Retenida[];
  /** Filas que el servidor devuelve con una marca anterior a la que este dispositivo conocía. */
  revertidas: MarcaRemota[];
  cursor: string | null;
};
type Cuenta = Omit<ResultadoDeCiclo, 'estado'>;

const ESTADO = {
  usuario: 'usuario',
  cursor: 'cursor',
  ultima: 'ultima_sincronizacion',
  repaso: 'ultimo_repaso',
} as const;

const clave = (tabla: string, id: string) => `${tabla}/${id}`;

function estadoDe(error: ErrorRemoto): 'sin_conexion' | 'sesion_caducada' | 'error' {
  if (error === 'red') return 'sin_conexion';
  return error === 'sesion' ? 'sesion_caducada' : 'error';
}

/**
 * `true` si la categoría es una de las iniciales y nadie la ha tocado: mismo
 * nombre y tipo que una del catálogo, nunca modificada, sin borrar ni
 * archivar, y sin madre, icono ni color.
 */
export function esCategoriaInicialIntacta(fila: FilaLocal, iniciales: CategoriaInicial[]): boolean {
  return (
    iniciales.some((inicial) => inicial.nombre === fila.nombre && inicial.tipo === fila.tipo) &&
    fila.creado_en === fila.modificado_en &&
    fila.borrado_en === null &&
    fila.archivada === 0 &&
    fila.padre_id === null &&
    fila.icono === null &&
    fila.color === null
  );
}

/**
 * `true` si el dispositivo tiene datos de la persona: cualquier fila en
 * cualquier tabla sincronizada, salvo las categorías iniciales intactas.
 */
export async function hayDatosDelUsuario(
  bd: BaseDeDatos,
  iniciales: CategoriaInicial[],
): Promise<boolean> {
  for (const tabla of TABLAS) {
    if (tabla.nombre === 'categoria') continue;
    const filas = await bd.consultar(`SELECT 1 AS hay FROM ${tabla.nombre} LIMIT 1`);
    if (filas.length > 0) return true;
  }
  const categorias = await bd.consultar<FilaLocal>('SELECT * FROM categoria');
  return categorias.some((categoria) => !esCategoriaInicialIntacta(categoria, iniciales));
}

export function crearMotor(dependencias: DependenciasDelMotor) {
  const { bd, servidor, leerClave, ahora, categoriasIniciales } = dependencias;
  const ventanaMs = dependencias.ventanaMs ?? VENTANA_DE_SOLAPE_MS;
  const filasPorLote = dependencias.filasPorLote ?? FILAS_POR_LOTE;
  const filasPorPagina = dependencias.filasPorPagina ?? FILAS_POR_PAGINA;

  // ------------------------------------------------------------ estado local

  async function leerEstado(nombre: string): Promise<string | null> {
    const filas = await bd.consultar<{ valor: string }>(
      'SELECT valor FROM sinc_estado WHERE clave = ?',
      [nombre],
    );
    return filas[0]?.valor ?? null;
  }

  async function guardarEstado(nombre: string, valor: string): Promise<void> {
    await bd.ejecutar(
      `INSERT INTO sinc_estado (clave, valor) VALUES (?, ?)
       ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor`,
      [nombre, valor],
    );
  }

  async function apuntarMarcaRemota(marca: MarcaRemota): Promise<void> {
    await bd.ejecutar(
      `INSERT INTO sinc_remota (tabla, id, actualizada_en) VALUES (?, ?, ?)
       ON CONFLICT (tabla, id) DO UPDATE SET actualizada_en = excluded.actualizada_en`,
      [marca.tabla, marca.id, marca.actualizada_en],
    );
  }

  async function marcarPendiente(tabla: string, id: string): Promise<void> {
    await bd.ejecutar('DELETE FROM sinc_pendiente WHERE tabla = ? AND id = ?', [tabla, id]);
    await bd.ejecutar('INSERT INTO sinc_pendiente (tabla, id) VALUES (?, ?)', [tabla, id]);
  }

  async function guardarRetenida(retenida: Retenida): Promise<void> {
    const { remota, motivo } = retenida;
    await bd.ejecutar(
      `INSERT INTO sinc_retenida (tabla, id, motivo, contenido, actualizada_en)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (tabla, id) DO UPDATE SET motivo = excluded.motivo,
         contenido = excluded.contenido, actualizada_en = excluded.actualizada_en`,
      [
        remota.tabla,
        remota.id,
        motivo,
        // De una fila ilegible no se guarda nada: no hay nada que reintentar.
        motivo === 'no_aplicable' ? remota.contenido : null,
        remota.actualizada_en,
      ],
    );
    // Con la marca apuntada no se vuelve a descifrar en cada bajada.
    await apuntarMarcaRemota(remota);
  }

  async function existeEnLocal(tabla: string, id: string): Promise<boolean> {
    if (!tablaSincronizada(tabla)) return false;
    return (await bd.consultar(`SELECT 1 AS hay FROM ${tabla} WHERE id = ?`, [id])).length > 0;
  }

  async function marcasConocidas(): Promise<Map<string, string>> {
    const filas = await bd.consultar<MarcaRemota>(
      'SELECT tabla, id, actualizada_en FROM sinc_remota',
    );
    return new Map(filas.map((f) => [clave(f.tabla, f.id), f.actualizada_en]));
  }

  /** Liga la base a una cuenta y pone a cero todo el estado del motor. Dentro de una transacción. */
  async function ligar(usuario: string, todoPendiente: boolean): Promise<void> {
    for (const tabla of ['sinc_estado', 'sinc_remota', 'sinc_retenida', 'sinc_pendiente']) {
      await bd.ejecutar(`DELETE FROM ${tabla}`);
    }
    await guardarEstado(ESTADO.usuario, usuario);
    if (!todoPendiente) return;
    for (const tabla of TABLAS) {
      await bd.ejecutar(
        `INSERT INTO sinc_pendiente (tabla, id) SELECT '${tabla.nombre}', id FROM ${tabla.nombre}`,
      );
    }
  }

  // ------------------------------------------------------------------ sesión

  type Sesion =
    | { ok: true; usuario: string; clave: Uint8Array }
    | { ok: false; estado: 'sin_conexion' | 'sesion_caducada' | 'error' | 'sin_clave' };

  /** El usuario de la sesión y la clave de datos. Quien la recibe debe borrar la clave. */
  async function abrirSesion(): Promise<Sesion> {
    const sesion = await servidor.usuario();
    if (!sesion.ok) return { ok: false, estado: estadoDe(sesion.error) };
    if (!sesion.datos) return { ok: false, estado: 'sesion_caducada' };
    const claveDeDatos = await leerClave();
    if (!claveDeDatos) return { ok: false, estado: 'sin_clave' };
    return { ok: true, usuario: sesion.datos, clave: claveDeDatos };
  }

  // ------------------------------------------------------------------ subida

  async function confirmarSubida(
    enviadas: { marca: Marca }[],
    recibidas: MarcaRemota[],
    cuenta: Cuenta,
  ): Promise<void> {
    const porClave = new Map(recibidas.map((r) => [clave(r.tabla, r.id), r]));
    await bd.transaccion(async () => {
      for (const { marca } of enviadas) {
        const recibida = porClave.get(clave(marca.tabla, marca.id));
        if (!recibida) {
          cuenta.noSubidas += 1;
          continue;
        }
        await apuntarMarcaRemota(recibida);
        // Solo si no ha vuelto a cambiar mientras se subía.
        await bd.ejecutar('DELETE FROM sinc_pendiente WHERE tabla = ? AND id = ? AND cambio = ?', [
          marca.tabla,
          marca.id,
          marca.cambio,
        ]);
        await bd.ejecutar('DELETE FROM sinc_retenida WHERE tabla = ? AND id = ?', [
          marca.tabla,
          marca.id,
        ]);
        cuenta.subidas += 1;
      }
    });
  }

  /**
   * Sube lo pendiente a partir del cambio `avance.ultimo`, y lo deja apuntando
   * al último que ha intentado: una segunda pasada en el mismo ciclo no repite
   * las filas que ya han fallado. Devuelve el fallo que obliga a parar, o `null`.
   */
  async function subir(
    usuario: string,
    claveDeDatos: Uint8Array,
    cuenta: Cuenta,
    avance: { ultimo: number },
  ): Promise<ErrorRemoto | null> {
    for (;;) {
      // En una transacción, para no leer una fila a medio escribir por la app.
      const lote = await bd.transaccion(async () => {
        const marcas = await bd.consultar<Marca>(
          'SELECT cambio, tabla, id FROM sinc_pendiente WHERE cambio > ? ORDER BY cambio LIMIT ?',
          [avance.ultimo, filasPorLote],
        );
        const leidas: { marca: Marca; fila: FilaLocal | null }[] = [];
        for (const marca of marcas) {
          const filas = tablaSincronizada(marca.tabla)
            ? await bd.consultar<FilaLocal>(`SELECT * FROM ${marca.tabla} WHERE id = ?`, [marca.id])
            : [];
          leidas.push({ marca, fila: filas[0] ?? null });
        }
        return leidas;
      });
      if (lote.length === 0) return null;
      avance.ultimo = lote[lote.length - 1].marca.cambio;

      const envios: { marca: Marca; envio: FilaParaSubir }[] = [];
      for (const { marca, fila } of lote) {
        if (!fila) {
          // La fila ya no existe en local: no hay nada que subir.
          await bd.ejecutar('DELETE FROM sinc_pendiente WHERE cambio = ?', [marca.cambio]);
          continue;
        }
        try {
          envios.push({
            marca,
            envio: {
              tabla: marca.tabla,
              id: marca.id,
              contenido: await cifrarFila(claveDeDatos, usuario, marca.tabla, fila),
              version_de_formato: VERSION_DE_FORMATO,
              borrada: fila.borrado_en !== null,
            },
          });
        } catch {
          cuenta.noSubidas += 1;
        }
      }
      if (envios.length === 0) continue;

      const respuesta = await servidor.subir(
        usuario,
        envios.map((e) => e.envio),
      );
      if (respuesta.ok) {
        await confirmarSubida(envios, respuesta.datos, cuenta);
        continue;
      }
      if (respuesta.error !== 'servidor') return respuesta.error;
      // El servidor ha rechazado el lote: se prueba fila a fila para aislar la que falla.
      for (const uno of envios) {
        const sola = await servidor.subir(usuario, [uno.envio]);
        if (sola.ok) await confirmarSubida([uno], sola.datos, cuenta);
        else if (sola.error !== 'servidor') return sola.error;
        else cuenta.noSubidas += 1;
      }
    }
  }

  // ------------------------------------------------------------------ bajada

  /** Baja todas las filas con marca igual o posterior a `desde` (o todas), página a página. */
  async function descargar(
    usuario: string,
    desde: string | null,
  ): Promise<{ ok: true; filas: FilaRemota[] } | { ok: false; error: ErrorRemoto }> {
    const filas: FilaRemota[] = [];
    let tras: Posicion | null = null;
    for (;;) {
      const pagina = await servidor.cambios(usuario, desde, tras, filasPorPagina);
      if (!pagina.ok) return pagina;
      filas.push(...pagina.datos);
      if (pagina.datos.length < filasPorPagina) return { ok: true, filas };
      const ultima: FilaRemota = pagina.datos[pagina.datos.length - 1];
      tras = { tabla: ultima.tabla, id: ultima.id, actualizada_en: ultima.actualizada_en };
    }
  }

  /**
   * Descifra las filas bajadas y las separa en aplicables y retenidas. Se
   * saltan las que ya se conocen con esa misma marca. A las aplicables se
   * añaden las retenidas de ciclos anteriores que se pueden reintentar.
   */
  async function preparar(
    usuario: string,
    claveDeDatos: Uint8Array,
    remotas: FilaRemota[],
    opciones: { todas?: boolean } = {},
  ): Promise<Preparadas> {
    // De una misma fila repetida vale la de marca posterior.
    const ultimas = new Map<string, FilaRemota>();
    let cursor: string | null = null;
    for (const remota of remotas) {
      cursor = marcaMayor(cursor, remota.actualizada_en);
      const k = clave(remota.tabla, remota.id);
      const anterior = ultimas.get(k);
      if (!anterior || compararMarcas(remota.actualizada_en, anterior.actualizada_en) >= 0) {
        ultimas.set(k, remota);
      }
    }
    const conocidas = opciones.todas ? new Map<string, string>() : await marcasConocidas();
    const nuevas: FilaRemota[] = [];
    const revertidas: MarcaRemota[] = [];
    for (const remota of ultimas.values()) {
      const conocida = conocidas.get(clave(remota.tabla, remota.id));
      const orden = conocida === undefined ? 1 : compararMarcas(remota.actualizada_en, conocida);
      if (orden === 0) continue;
      // La marca de una fila no retrocede en un servidor que funciona bien. Si
      // retrocede y aquí está la fila, no se aplica: se vuelve a subir la local.
      if (orden < 0 && (await existeEnLocal(remota.tabla, remota.id))) revertidas.push(remota);
      else nuevas.push(remota);
    }
    if (!opciones.todas) {
      const guardadas = await bd.consultar<FilaRemota>(
        `SELECT tabla, id, contenido, actualizada_en FROM sinc_retenida
          WHERE motivo = 'no_aplicable' AND contenido IS NOT NULL`,
      );
      const yaVienen = new Set(nuevas.map((n) => clave(n.tabla, n.id)));
      for (const guardada of guardadas) {
        if (!yaVienen.has(clave(guardada.tabla, guardada.id))) nuevas.push(guardada);
      }
    }

    const candidatas: Candidata[] = [];
    const retenidas: Retenida[] = [];
    for (const remota of nuevas) {
      try {
        const fila = await descifrarFila(
          claveDeDatos,
          usuario,
          remota.tabla,
          remota.id,
          remota.contenido,
        );
        candidatas.push({ remota, fila });
      } catch (error) {
        retenidas.push({
          remota,
          motivo: error instanceof ErrorDeFila ? error.motivo : 'ilegible',
        });
      }
    }
    candidatas.sort((a, b) => ordenDeTabla(a.remota.tabla) - ordenDeTabla(b.remota.tabla));
    return { candidatas, retenidas, revertidas, cursor };
  }

  function iguales(tabla: TablaSincronizada, a: FilaLocal, b: FilaLocal): boolean {
    return tabla.columnas.every((columna) => a[columna] === b[columna]);
  }

  /**
   * Escribe una fila remota en su tabla. Dentro de una transacción. Lanza un
   * error si la base la rechaza (por ejemplo, porque aún no ha llegado la fila
   * a la que apunta).
   */
  async function aplicarUna(candidata: Candidata): Promise<'aplicada' | 'igual' | 'omitida'> {
    const { remota } = candidata;
    const tabla = tablaSincronizada(remota.tabla)!;
    const nombre = tabla.nombre;
    const pendiente = await bd.consultar(
      'SELECT 1 AS hay FROM sinc_pendiente WHERE tabla = ? AND id = ?',
      [nombre, remota.id],
    );
    // Hay un cambio local sin subir: se subirá y ganará. La marca remota no se apunta.
    if (pendiente.length > 0) return 'omitida';

    const locales = await bd.consultar<FilaLocal>(`SELECT * FROM ${nombre} WHERE id = ?`, [
      remota.id,
    ]);
    let fila = candidata.fila;
    if (locales[0] && iguales(tabla, locales[0], fila)) {
      await apuntarMarcaRemota(remota);
      await bd.ejecutar('DELETE FROM sinc_retenida WHERE tabla = ? AND id = ?', [
        nombre,
        remota.id,
      ]);
      return 'igual';
    }

    // Regla de unicidad: de dos filas vivas que no pueden convivir se queda la de id menor.
    let pierde = false;
    const instante = ahora().toISOString();
    if (fila.borrado_en === null) {
      for (const unico of tabla.unicos) {
        if (unico.some((columna) => fila[columna] === null)) continue;
        const rivales = await bd.consultar<{ id: string }>(
          `SELECT id FROM ${nombre}
            WHERE ${unico.map((columna) => `${columna} = ?`).join(' AND ')}
              AND borrado_en IS NULL AND id <> ?`,
          [...unico.map((columna) => fila[columna] as ValorSql), remota.id],
        );
        for (const rival of rivales) {
          if (remota.id < rival.id) {
            // Gana la remota: la local se borra (y el disparador la deja pendiente de subir).
            await bd.ejecutar(
              `UPDATE ${nombre} SET borrado_en = ?, modificado_en = ? WHERE id = ?`,
              [instante, instante, rival.id],
            );
          } else {
            pierde = true;
          }
        }
      }
    }
    if (pierde) fila = { ...fila, borrado_en: instante, modificado_en: instante };

    const columnas = tabla.columnas;
    await bd.ejecutar(
      `INSERT INTO ${nombre} (${columnas.join(', ')})
       VALUES (${columnas.map(() => '?').join(', ')})
       ON CONFLICT (id) DO UPDATE SET ${columnas
         .filter((columna) => columna !== 'id')
         .map((columna) => `${columna} = excluded.${columna}`)
         .join(', ')}`,
      columnas.map((columna) => fila[columna]),
    );
    if (!pierde) {
      // Una fila recién bajada no se vuelve a subir. La que pierde sí: sube ya borrada.
      await bd.ejecutar('DELETE FROM sinc_pendiente WHERE tabla = ? AND id = ?', [
        nombre,
        remota.id,
      ]);
    }
    await apuntarMarcaRemota(remota);
    await bd.ejecutar('DELETE FROM sinc_retenida WHERE tabla = ? AND id = ?', [nombre, remota.id]);
    return 'aplicada';
  }

  /** Intenta aplicar unas filas; devuelve las que la base ha rechazado. Dentro de una transacción. */
  async function aplicarVarias(candidatas: Candidata[], cuenta: Cuenta): Promise<Candidata[]> {
    const rechazadas: Candidata[] = [];
    for (const candidata of candidatas) {
      // Punto de guarda: si la fila falla a medias, se deshace solo ella.
      await bd.ejecutar('SAVEPOINT sinc_fila');
      try {
        if ((await aplicarUna(candidata)) === 'aplicada') cuenta.aplicadas += 1;
        await bd.ejecutar('RELEASE sinc_fila');
      } catch {
        await bd.ejecutar('ROLLBACK TO sinc_fila');
        await bd.ejecutar('RELEASE sinc_fila');
        rechazadas.push(candidata);
      }
    }
    return rechazadas;
  }

  /**
   * Último paso de una bajada, dentro de una transacción: reintenta las
   * rechazadas mientras alguna vuelta avance, retiene las que queden y guarda
   * el cursor.
   */
  async function cerrarBajada(
    rechazadas: Candidata[],
    preparadas: Preparadas,
    cuenta: Cuenta,
  ): Promise<void> {
    let quedan = rechazadas;
    while (quedan.length > 0) {
      const siguen = await aplicarVarias(quedan, cuenta);
      if (siguen.length === quedan.length) break;
      quedan = siguen;
    }
    const retenidas: Retenida[] = [
      ...preparadas.retenidas,
      ...quedan.map((c) => ({ remota: c.remota, motivo: 'no_aplicable' as const })),
    ];
    for (const retenida of retenidas) await guardarRetenida(retenida);
    cuenta.retenidas += retenidas.length;
    for (const revertida of preparadas.revertidas) {
      await marcarPendiente(revertida.tabla, revertida.id);
      await apuntarMarcaRemota(revertida);
    }
    cuenta.revertidas += preparadas.revertidas.length;
    const cursor = marcaMayor(await leerEstado(ESTADO.cursor), preparadas.cursor);
    if (cursor) await guardarEstado(ESTADO.cursor, cursor);
  }

  /** Aplica unas filas ya preparadas, en transacciones cortas. */
  async function escribir(preparadas: Preparadas, cuenta: Cuenta): Promise<void> {
    const rechazadas: Candidata[] = [];
    for (let i = 0; i < preparadas.candidatas.length; i += FILAS_POR_TRANSACCION) {
      const trozo = preparadas.candidatas.slice(i, i + FILAS_POR_TRANSACCION);
      rechazadas.push(...(await bd.transaccion(() => aplicarVarias(trozo, cuenta))));
    }
    await bd.transaccion(() => cerrarBajada(rechazadas, preparadas, cuenta));
  }

  async function bajar(
    usuario: string,
    claveDeDatos: Uint8Array,
    cuenta: Cuenta,
  ): Promise<ErrorRemoto | null> {
    const cursor = await leerEstado(ESTADO.cursor);
    const desde = cursor ? restarAMarca(cursor, ventanaMs) : null;
    const descarga = await descargar(usuario, desde);
    if (!descarga.ok) return descarga.error;
    await escribir(await preparar(usuario, claveDeDatos, descarga.filas), cuenta);
    return null;
  }

  // ----------------------------------------------------------- repaso completo

  async function repasar(
    usuario: string,
    claveDeDatos: Uint8Array,
    cuenta: Cuenta,
  ): Promise<ErrorRemoto | null> {
    const remotas: MarcaRemota[] = [];
    let tras: { tabla: string; id: string } | null = null;
    for (;;) {
      const pagina = await servidor.marcas(usuario, tras, filasPorPagina);
      if (!pagina.ok) return pagina.error;
      remotas.push(...pagina.datos);
      if (pagina.datos.length < filasPorPagina) break;
      const ultima: MarcaRemota = pagina.datos[pagina.datos.length - 1];
      tras = { tabla: ultima.tabla, id: ultima.id };
    }

    const conocidas = await marcasConocidas();
    const vistas = new Set<string>();
    const porBajar = new Map<string, string[]>();
    for (const remota of remotas) {
      const k = clave(remota.tabla, remota.id);
      vistas.add(k);
      const conocida = conocidas.get(k);
      const distinta =
        conocida === undefined || compararMarcas(remota.actualizada_en, conocida) !== 0;
      if (distinta && tablaSincronizada(remota.tabla)) {
        porBajar.set(remota.tabla, [...(porBajar.get(remota.tabla) ?? []), remota.id]);
      }
    }
    const desaparecidas = [...conocidas.keys()].filter((k) => !vistas.has(k));
    if (desaparecidas.length > 0) {
      await bd.transaccion(async () => {
        for (const k of desaparecidas) {
          const corte = k.indexOf('/');
          const tabla = k.slice(0, corte);
          const id = k.slice(corte + 1);
          await bd.ejecutar('DELETE FROM sinc_remota WHERE tabla = ? AND id = ?', [tabla, id]);
          await bd.ejecutar('DELETE FROM sinc_retenida WHERE tabla = ? AND id = ?', [tabla, id]);
          // Si la fila sigue aquí, se vuelve a subir.
          if (await existeEnLocal(tabla, id)) await marcarPendiente(tabla, id);
        }
      });
      cuenta.desaparecidas += desaparecidas.length;
    }

    const filas: FilaRemota[] = [];
    for (const [tabla, ids] of porBajar) {
      for (let i = 0; i < ids.length; i += filasPorLote) {
        const trozo = await servidor.porIds(usuario, tabla, ids.slice(i, i + filasPorLote));
        if (!trozo.ok) return trozo.error;
        filas.push(...trozo.datos);
      }
    }
    if (filas.length > 0) await escribir(await preparar(usuario, claveDeDatos, filas), cuenta);
    await guardarEstado(ESTADO.repaso, ahora().toISOString());
    return null;
  }

  async function tocaRepaso(): Promise<boolean> {
    const ultimo = await leerEstado(ESTADO.repaso);
    if (!ultimo) return false;
    const pasado = ahora().getTime() - new Date(ultimo).getTime();
    return !(pasado < DIAS_ENTRE_REPASOS * 24 * 60 * 60 * 1000);
  }

  // -------------------------------------------------------------------- ciclo

  let enCurso: Promise<unknown> = Promise.resolve();

  /** Las operaciones del motor van de una en una. */
  function enSerie<T>(tarea: () => Promise<T>): Promise<T> {
    const turno = enCurso.then(tarea);
    enCurso = turno.catch(() => undefined);
    return turno;
  }

  /**
   * Un ciclo: subir lo pendiente y bajar lo nuevo. Con `repaso`, además compara
   * todas las marcas del servidor con las conocidas. No lanza errores.
   */
  function ciclo(opciones: { repaso?: boolean } = {}): Promise<ResultadoDeCiclo> {
    return enSerie(async () => {
      const cuenta: Cuenta = {
        subidas: 0,
        noSubidas: 0,
        aplicadas: 0,
        retenidas: 0,
        revertidas: 0,
        desaparecidas: 0,
      };
      const terminar = (estado: EstadoDeCiclo): ResultadoDeCiclo => ({ estado, ...cuenta });
      let claveDeDatos: Uint8Array | null = null;
      try {
        const ligado = await leerEstado(ESTADO.usuario);
        if (!ligado) return terminar('sin_ligar');
        const sesion = await abrirSesion();
        if (!sesion.ok) return terminar(sesion.estado);
        claveDeDatos = sesion.clave;
        if (sesion.usuario !== ligado) return terminar('sin_ligar');

        const avance = { ultimo: 0 };
        let fallo = await subir(ligado, claveDeDatos, cuenta, avance);
        fallo ??= await bajar(ligado, claveDeDatos, cuenta);
        if (!fallo && (opciones.repaso || (await tocaRepaso()))) {
          fallo = await repasar(ligado, claveDeDatos, cuenta);
        }
        // La bajada y el repaso pueden dejar filas por subir (una que pierde por
        // una regla de unicidad, una revertida, una desaparecida): salen ya.
        fallo ??= await subir(ligado, claveDeDatos, cuenta, avance);
        if (fallo) return terminar(estadoDe(fallo));
        if (!(await leerEstado(ESTADO.repaso))) {
          // El primer repaso automático toca a los siete días de empezar.
          await guardarEstado(ESTADO.repaso, ahora().toISOString());
        }
        await guardarEstado(ESTADO.ultima, ahora().toISOString());
        return terminar(cuenta.noSubidas > 0 ? 'parcial' : 'correcto');
      } catch {
        return terminar('error');
      } finally {
        borrar(claveDeDatos);
      }
    });
  }

  // ------------------------------------------------------- entrada en una cuenta

  /**
   * Decide qué hacer al entrar en una cuenta desde este dispositivo y, salvo
   * que haya que preguntar, liga la base. Necesita conexión.
   */
  function evaluarEntrada(): Promise<Entrada> {
    return enSerie(async (): Promise<Entrada> => {
      let claveDeDatos: Uint8Array | null = null;
      try {
        const sesion = await abrirSesion();
        if (!sesion.ok) return { estado: sesion.estado };
        claveDeDatos = sesion.clave;
        const usuario = sesion.usuario;
        if ((await leerEstado(ESTADO.usuario)) === usuario) {
          return { estado: 'lista', accion: 'continuar' };
        }
        const nube = await servidor.hayFilas(usuario);
        if (!nube.ok) return { estado: estadoDe(nube.error) };
        if (!nube.datos) {
          return await bd.transaccion(async (): Promise<Entrada> => {
            // Los datos de este dispositivo no suben a una cuenta sin que la persona lo diga:
            // pueden ser de otra persona, o de otra cuenta.
            if (await hayDatosDelUsuario(bd, categoriasIniciales)) {
              return { estado: 'preguntar', pregunta: 'subir' };
            }
            // Solo hay categorías iniciales intactas: no hay nada de nadie que proteger.
            await ligar(usuario, true);
            return { estado: 'lista', accion: 'subir' };
          });
        }
        return await bd.transaccion(async (): Promise<Entrada> => {
          if (await hayDatosDelUsuario(bd, categoriasIniciales)) {
            return { estado: 'preguntar', pregunta: 'nube' };
          }
          // Solo quedan categorías iniciales intactas: se quitan para no duplicar las de la nube.
          await bd.ejecutar('DELETE FROM categoria');
          await ligar(usuario, false);
          return { estado: 'lista', accion: 'bajar' };
        });
      } catch {
        return { estado: 'error' };
      } finally {
        borrar(claveDeDatos);
      }
    });
  }

  /**
   * Respuesta «sí» a «¿Subir los datos de este dispositivo a tu cuenta?»: liga
   * la base y deja todo pendiente de subir. Vuelve a mirar la nube: si mientras
   * tanto otro dispositivo ha subido datos, ya no se sube encima y toca la otra
   * pregunta.
   */
  function subirLoLocal(): Promise<Entrada> {
    return enSerie(async (): Promise<Entrada> => {
      let claveDeDatos: Uint8Array | null = null;
      try {
        const sesion = await abrirSesion();
        if (!sesion.ok) return { estado: sesion.estado };
        claveDeDatos = sesion.clave;
        const usuario = sesion.usuario;
        if ((await leerEstado(ESTADO.usuario)) === usuario) {
          return { estado: 'lista', accion: 'continuar' };
        }
        const nube = await servidor.hayFilas(usuario);
        if (!nube.ok) return { estado: estadoDe(nube.error) };
        if (nube.datos) return { estado: 'preguntar', pregunta: 'nube' };
        await bd.transaccion(() => ligar(usuario, true));
        return { estado: 'lista', accion: 'subir' };
      } catch {
        return { estado: 'error' };
      } finally {
        borrar(claveDeDatos);
      }
    });
  }

  /**
   * Sustituye los datos locales por los de la nube. Antes llama a `exportar`,
   * que debe dejar una copia de lo local en manos de la persona y devolver
   * `true`; si devuelve `false`, no se toca nada. Si la bajada falla, tampoco.
   */
  function usarLaNube(exportar: () => Promise<boolean>): Promise<ResultadoDeUsarLaNube> {
    return enSerie(async (): Promise<ResultadoDeUsarLaNube> => {
      let claveDeDatos: Uint8Array | null = null;
      try {
        const sesion = await abrirSesion();
        if (!sesion.ok) return { estado: sesion.estado };
        claveDeDatos = sesion.clave;
        const usuario = sesion.usuario;
        if (!(await exportar())) return { estado: 'sin_copia' };
        const descarga = await descargar(usuario, null);
        if (!descarga.ok) return { estado: estadoDe(descarga.error) };
        const preparadas = await preparar(usuario, claveDeDatos, descarga.filas, { todas: true });
        const cuenta: Cuenta = {
          subidas: 0,
          noSubidas: 0,
          aplicadas: 0,
          retenidas: 0,
          revertidas: 0,
          desaparecidas: 0,
        };
        // Todo o nada: vaciar, ligar y escribir lo bajado.
        await bd.transaccion(async () => {
          for (const tabla of [...TABLAS].reverse()) {
            await bd.ejecutar(`DELETE FROM ${tabla.nombre}`);
          }
          for (const tabla of TABLAS_SOLO_LOCALES) await bd.ejecutar(`DELETE FROM ${tabla}`);
          await ligar(usuario, false);
          const rechazadas = await aplicarVarias(preparadas.candidatas, cuenta);
          await cerrarBajada(rechazadas, preparadas, cuenta);
        });
        return { estado: 'hecho', aplicadas: cuenta.aplicadas, retenidas: cuenta.retenidas };
      } catch {
        return { estado: 'error' };
      } finally {
        borrar(claveDeDatos);
      }
    });
  }

  /** Desliga la base de su cuenta (al borrar la cuenta). Los datos locales no se tocan. */
  function desligar(): Promise<void> {
    return enSerie(() =>
      bd.transaccion(async () => {
        for (const tabla of ['sinc_estado', 'sinc_remota', 'sinc_retenida', 'sinc_pendiente']) {
          await bd.ejecutar(`DELETE FROM ${tabla}`);
        }
      }),
    );
  }

  /** Lo que Cuenta enseña del estado de la sincronización. Solo lee la base local. */
  async function resumen(): Promise<Resumen> {
    const contar = async (sql: string) =>
      (await bd.consultar<{ total: number }>(sql))[0]?.total ?? 0;
    const usuario = await leerEstado(ESTADO.usuario);
    return {
      usuario: esUuid(usuario) ? usuario : null,
      pendientes: await contar('SELECT COUNT(*) AS total FROM sinc_pendiente'),
      ilegibles: await contar(
        "SELECT COUNT(*) AS total FROM sinc_retenida WHERE motivo = 'ilegible'",
      ),
      noAplicables: await contar(
        "SELECT COUNT(*) AS total FROM sinc_retenida WHERE motivo = 'no_aplicable'",
      ),
      ultima: await leerEstado(ESTADO.ultima),
    };
  }

  return { ciclo, evaluarEntrada, subirLoLocal, usarLaNube, desligar, resumen };
}
