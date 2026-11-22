/**
 * Repositorio de capturas de pagos, alias de tarjeta y reglas de comercio
 * (T-030 a T-034). Las reglas que interpretan los textos están en
 * `src/dominio/captura.ts`; aquí se aplican y se guardan sus resultados.
 */
import {
  categoriaDelComercio,
  cuentaDeLaTarjeta,
  esDuplicada,
  extraerImporte,
  limpiarTexto,
  normalizarComercio,
  normalizarTarjeta,
  ORIGENES_DE_CAPTURA,
  origenDelMovimiento,
  seGuardaConUnToque,
  type AliasDeTarjeta,
  type Captura,
  type EstadoDeCaptura,
  type OrigenDeCaptura,
  type ReglaDeComercio,
} from '@/dominio/captura';
import { ErrorDeDominio, normalizarNombre, type Movimiento } from '@/dominio/modelo';

import { exigirLongitud } from '@/dominio/textos';
import type { BaseDeDatos, Entorno } from './bd';
import { filaACategoria, type FilaCategoria } from './categorias';
import { filaACuenta, type FilaCuenta } from './cuentas';
import type { DatosDeMovimiento, RepositorioDeMovimientos } from './movimientos';

type FilaCaptura = {
  id: string;
  recibida_en: string;
  origen: OrigenDeCaptura;
  importe_texto: string;
  comercio_texto: string;
  tarjeta_texto: string;
  importe: number | null;
  divisa: string | null;
  cuenta_id: string | null;
  categoria_id: string | null;
  estado: EstadoDeCaptura;
  movimiento_id: string | null;
  id_de_cola: string | null;
  creado_en: string;
  modificado_en: string;
  borrado_en: string | null;
};

function filaACaptura(f: FilaCaptura): Captura {
  return {
    id: f.id,
    recibidaEn: f.recibida_en,
    origen: f.origen,
    importeTexto: f.importe_texto,
    comercioTexto: f.comercio_texto,
    tarjetaTexto: f.tarjeta_texto,
    importe: f.importe,
    divisa: f.divisa,
    cuentaId: f.cuenta_id,
    categoriaId: f.categoria_id,
    estado: f.estado,
    movimientoId: f.movimiento_id,
    idDeCola: f.id_de_cola,
    creadoEn: f.creado_en,
    modificadoEn: f.modificado_en,
    borradoEn: f.borrado_en,
  };
}

type FilaAlias = {
  id: string;
  texto: string;
  cuenta_id: string;
  creado_en: string;
  modificado_en: string;
  borrado_en: string | null;
};
type FilaRegla = {
  id: string;
  comercio: string;
  categoria_id: string;
  creado_en: string;
  modificado_en: string;
  borrado_en: string | null;
};

const comunes = (f: {
  id: string;
  creado_en: string;
  modificado_en: string;
  borrado_en: string | null;
}) => ({
  id: f.id,
  creadoEn: f.creado_en,
  modificadoEn: f.modificado_en,
  borradoEn: f.borrado_en,
});

export type DatosDeCaptura = {
  /** Instante de la captura en UTC (ISO 8601). Por defecto, ahora. */
  recibidaEn?: string;
  origen: OrigenDeCaptura;
  importeTexto?: string;
  comercioTexto?: string;
  tarjetaTexto?: string;
  /** Identificador de la entrada de la cola nativa, para no importarla dos veces. */
  idDeCola?: string | null;
};

/** Captura con los nombres que la bandeja necesita mostrar. */
export type CapturaListada = Captura & {
  cuentaNombre: string | null;
  categoriaNombre: string | null;
};

export function crearRepositorioDeCapturas(
  bd: BaseDeDatos,
  entorno: Entorno,
  movimientos: RepositorioDeMovimientos,
) {
  async function obtener(id: string): Promise<Captura | null> {
    const filas = await bd.consultar<FilaCaptura>('SELECT * FROM captura WHERE id = ?', [id]);
    return filas[0] ? filaACaptura(filas[0]) : null;
  }

  async function exigir(id: string): Promise<Captura> {
    const captura = await obtener(id);
    if (!captura || captura.borradoEn !== null) throw new ErrorDeDominio('captura_no_encontrada');
    return captura;
  }

  // --------------------------------------------------- alias y reglas

  async function listarAlias(): Promise<AliasDeTarjeta[]> {
    const filas = await bd.consultar<FilaAlias>(
      'SELECT * FROM alias_de_tarjeta WHERE borrado_en IS NULL ORDER BY texto',
    );
    return filas.map((f) => ({ ...comunes(f), texto: f.texto, cuentaId: f.cuenta_id }));
  }

  /**
   * Asocia el texto de una tarjeta a una cuenta. Si ese texto ya tenía
   * alias, pasa a apuntar a la cuenta nueva: hay uno por texto.
   */
  async function fijarAlias(tarjetaTexto: string, cuentaId: string): Promise<AliasDeTarjeta> {
    const texto = normalizarTarjeta(tarjetaTexto);
    exigirLongitud(texto, 'comercio');
    if (texto === '') throw new ErrorDeDominio('alias_vacio');
    const cuentas = await bd.consultar<{ id: string }>(
      'SELECT id FROM cuenta WHERE id = ? AND borrado_en IS NULL',
      [cuentaId],
    );
    if (!cuentas[0]) throw new ErrorDeDominio('cuenta_no_encontrada');
    const ahora = entorno.ahora().toISOString();
    const existentes = await bd.consultar<FilaAlias>(
      'SELECT * FROM alias_de_tarjeta WHERE texto = ? AND borrado_en IS NULL',
      [texto],
    );
    if (existentes[0]) {
      await bd.ejecutar(
        'UPDATE alias_de_tarjeta SET cuenta_id = ?, modificado_en = ? WHERE id = ?',
        [cuentaId, ahora, existentes[0].id],
      );
    } else {
      await bd.ejecutar(
        `INSERT INTO alias_de_tarjeta (id, texto, cuenta_id, creado_en, modificado_en, borrado_en)
         VALUES (?, ?, ?, ?, ?, NULL)`,
        [entorno.generarId(), texto, cuentaId, ahora, ahora],
      );
    }
    return (await listarAlias()).find((a) => a.texto === texto)!;
  }

  async function borrarAlias(id: string): Promise<void> {
    const filas = await bd.consultar<FilaAlias>(
      'SELECT * FROM alias_de_tarjeta WHERE id = ? AND borrado_en IS NULL',
      [id],
    );
    if (!filas[0]) throw new ErrorDeDominio('alias_no_encontrado');
    const ahora = entorno.ahora().toISOString();
    await bd.ejecutar(
      'UPDATE alias_de_tarjeta SET borrado_en = ?, modificado_en = ? WHERE id = ?',
      [ahora, ahora, id],
    );
  }

  /** Deshace el borrado de un alias. Si su texto ya tiene otro alias, este lo sustituye. */
  async function restaurarAlias(id: string): Promise<void> {
    const filas = await bd.consultar<FilaAlias>('SELECT * FROM alias_de_tarjeta WHERE id = ?', [
      id,
    ]);
    if (!filas[0]) throw new ErrorDeDominio('alias_no_encontrado');
    const ahora = entorno.ahora().toISOString();
    await bd.transaccion(async () => {
      await bd.ejecutar(
        `UPDATE alias_de_tarjeta SET borrado_en = ?, modificado_en = ?
         WHERE texto = ? AND borrado_en IS NULL AND id <> ?`,
        [ahora, ahora, filas[0].texto, id],
      );
      await bd.ejecutar(
        'UPDATE alias_de_tarjeta SET borrado_en = NULL, modificado_en = ? WHERE id = ?',
        [ahora, id],
      );
    });
  }

  async function listarReglasDeComercio(): Promise<ReglaDeComercio[]> {
    const filas = await bd.consultar<FilaRegla>(
      'SELECT * FROM regla_de_comercio WHERE borrado_en IS NULL ORDER BY comercio',
    );
    return filas.map((f) => ({ ...comunes(f), comercio: f.comercio, categoriaId: f.categoria_id }));
  }

  /** Recuerda la categoría de un comercio. La última guardada manda. */
  async function recordarComercio(comercioTexto: string, categoriaId: string): Promise<void> {
    const comercio = normalizarComercio(comercioTexto);
    exigirLongitud(comercio, 'comercio');
    if (comercio === '') return;
    const ahora = entorno.ahora().toISOString();
    const existentes = await bd.consultar<FilaRegla>(
      'SELECT * FROM regla_de_comercio WHERE comercio = ? AND borrado_en IS NULL',
      [comercio],
    );
    if (existentes[0]) {
      if (existentes[0].categoria_id === categoriaId) return;
      await bd.ejecutar(
        'UPDATE regla_de_comercio SET categoria_id = ?, modificado_en = ? WHERE id = ?',
        [categoriaId, ahora, existentes[0].id],
      );
      return;
    }
    await bd.ejecutar(
      `INSERT INTO regla_de_comercio (id, comercio, categoria_id, creado_en, modificado_en, borrado_en)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      [entorno.generarId(), comercio, categoriaId, ahora, ahora],
    );
  }

  // --------------------------------------------------------- capturas

  async function cuentasVivas() {
    const filas = await bd.consultar<FilaCuenta>('SELECT * FROM cuenta WHERE borrado_en IS NULL');
    return filas.map(filaACuenta);
  }
  async function categoriasVivas() {
    const filas = await bd.consultar<FilaCategoria>(
      'SELECT * FROM categoria WHERE borrado_en IS NULL',
    );
    return filas.map(filaACategoria);
  }

  /**
   * Registra una captura a partir de los textos que llegaron (T-030). Extrae
   * el importe, propone cuenta y categoría y comprueba si repite otra. Nunca
   * rechaza una captura por tener datos incompletos: la guarda con lo que
   * haya. Una entrada de la cola ya importada devuelve la captura existente.
   */
  async function registrar(datos: DatosDeCaptura): Promise<Captura> {
    const idDeCola = datos.idDeCola ?? null;
    if (idDeCola !== null) {
      const existentes = await bd.consultar<FilaCaptura>(
        'SELECT * FROM captura WHERE id_de_cola = ? AND borrado_en IS NULL',
        [idDeCola],
      );
      if (existentes[0]) return filaACaptura(existentes[0]);
    }
    const ahora = entorno.ahora().toISOString();
    const recibidaEn =
      datos.recibidaEn && !Number.isNaN(Date.parse(datos.recibidaEn)) ? datos.recibidaEn : ahora;
    const origen = ORIGENES_DE_CAPTURA.includes(datos.origen) ? datos.origen : 'transaccion';
    const importeTexto = limpiarTexto(datos.importeTexto);
    const comercioTexto = limpiarTexto(datos.comercioTexto);
    const tarjetaTexto = limpiarTexto(datos.tarjetaTexto);

    const cuentas = await cuentasVivas();
    const extraido = extraerImporte(importeTexto);
    const { cuentaId } = cuentaDeLaTarjeta(tarjetaTexto, await listarAlias(), cuentas);
    const categoriaId = categoriaDelComercio(
      comercioTexto,
      await listarReglasDeComercio(),
      await categoriasVivas(),
    );
    // Si el texto no dice la divisa, se entiende la de la cuenta propuesta.
    const divisa = extraido
      ? (extraido.divisa ?? cuentas.find((c) => c.id === cuentaId)?.divisa ?? 'EUR')
      : null;
    const importe = extraido?.importe ?? null;

    const anteriores = await bd.consultar<FilaCaptura>(
      `SELECT * FROM captura WHERE borrado_en IS NULL AND estado IN ('pendiente', 'guardada')`,
    );
    const duplicada = esDuplicada({ recibidaEn, importe, cuentaId }, anteriores.map(filaACaptura));
    const id = entorno.generarId();
    await bd.ejecutar(
      `INSERT INTO captura (id, recibida_en, origen, importe_texto, comercio_texto, tarjeta_texto,
         importe, divisa, cuenta_id, categoria_id, estado, movimiento_id, id_de_cola,
         creado_en, modificado_en, borrado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL)`,
      [
        id,
        recibidaEn,
        origen,
        importeTexto,
        comercioTexto,
        tarjetaTexto,
        importe,
        divisa,
        cuentaId,
        categoriaId,
        duplicada ? 'duplicada' : 'pendiente',
        idDeCola,
        ahora,
        ahora,
      ],
    );
    return (await obtener(id))!;
  }

  /** Capturas no borradas, de la más reciente a la más antigua. Por estado si se indica. */
  async function listar(estados?: EstadoDeCaptura[]): Promise<CapturaListada[]> {
    const filtro = estados?.length ? `AND k.estado IN (${estados.map(() => '?').join(', ')})` : '';
    const filas = await bd.consultar<
      FilaCaptura & { cuenta_nombre: string | null; categoria_nombre: string | null }
    >(
      `SELECT k.*, c.nombre AS cuenta_nombre, g.nombre AS categoria_nombre
       FROM captura k
       LEFT JOIN cuenta c ON c.id = k.cuenta_id
       LEFT JOIN categoria g ON g.id = k.categoria_id
       WHERE k.borrado_en IS NULL ${filtro}
       ORDER BY k.recibida_en DESC, k.creado_en DESC, k.id`,
      estados ?? [],
    );
    return filas.map((f) => ({
      ...filaACaptura(f),
      cuentaNombre: f.cuenta_nombre,
      categoriaNombre: f.categoria_nombre,
    }));
  }

  async function contarPendientes(): Promise<number> {
    const filas = await bd.consultar<{ total: number }>(
      `SELECT COUNT(*) AS total FROM captura WHERE borrado_en IS NULL AND estado = 'pendiente'`,
    );
    return filas[0]?.total ?? 0;
  }

  /** Instante de la captura más reciente recibida, o `null` si no hay ninguna. */
  async function ultimaRecibida(): Promise<string | null> {
    const filas = await bd.consultar<{ ultima: string | null }>(
      'SELECT MAX(recibida_en) AS ultima FROM captura WHERE borrado_en IS NULL',
    );
    return filas[0]?.ultima ?? null;
  }

  async function ponerEstado(id: string, estado: EstadoDeCaptura, movimientoId: string | null) {
    await bd.ejecutar(
      'UPDATE captura SET estado = ?, movimiento_id = ?, modificado_en = ? WHERE id = ?',
      [estado, movimientoId, entorno.ahora().toISOString(), id],
    );
  }

  /**
   * Lo que se aprende al guardar una captura: la categoría de ese comercio
   * y, si la tarjeta traía nombre y no tenía alias, a qué cuenta pertenece
   * (docs/04, A.4, paso 6).
   */
  async function aprender(captura: Captura, mov: Movimiento): Promise<void> {
    if (mov.categoriaId !== null) await recordarComercio(captura.comercioTexto, mov.categoriaId);
    const tarjeta = normalizarTarjeta(captura.tarjetaTexto);
    if (tarjeta === '') return;
    const alias = await listarAlias();
    if (!alias.some((a) => a.texto === tarjeta)) await fijarAlias(tarjeta, mov.cuentaId);
  }

  /** La fecha local (del dispositivo) del día en que llegó la captura. */
  function fechaDe(captura: Captura): string {
    const d = new Date(captura.recibidaEn);
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /**
   * Guarda con un toque una captura completa: crea un gasto con origen
   * Apple Pay (o notificación), enlazado a la captura. Si le falta importe,
   * cuenta o categoría no se puede: hay que pasar por el alta.
   */
  async function guardar(id: string): Promise<Movimiento> {
    const captura = await exigir(id);
    if (captura.estado !== 'pendiente') throw new ErrorDeDominio('captura_ya_resuelta');
    if (!seGuardaConUnToque(captura)) throw new ErrorDeDominio('captura_incompleta');
    return guardarEditada(id, {
      tipo: 'gasto',
      fecha: fechaDe(captura),
      importe: captura.importe ?? 0,
      cuentaId: captura.cuentaId ?? '',
      categoriaId: captura.categoriaId,
      nombre: captura.comercioTexto,
    });
  }

  /**
   * Guarda una captura con los datos que la persona ha corregido en el alta.
   * El movimiento hereda el origen y el comercio de la captura.
   */
  async function guardarEditada(id: string, datos: DatosDeMovimiento): Promise<Movimiento> {
    const captura = await exigir(id);
    if (captura.estado === 'guardada') throw new ErrorDeDominio('captura_ya_resuelta');
    return bd.transaccion(async () => {
      const mov = await movimientos.crear({
        ...datos,
        comercio: captura.comercioTexto,
        origen: origenDelMovimiento(captura.origen),
        capturaId: captura.id,
      });
      await ponerEstado(captura.id, 'guardada', mov.id);
      await aprender(captura, mov);
      return mov;
    });
  }

  /** Descartar no borra: la captura queda en «Descartadas» y se puede recuperar. */
  async function descartar(id: string): Promise<void> {
    const captura = await exigir(id);
    if (captura.estado === 'guardada') throw new ErrorDeDominio('captura_ya_resuelta');
    await ponerEstado(id, 'descartada', null);
  }

  /** Devuelve a pendientes una captura descartada o marcada como duplicada. */
  async function recuperar(id: string): Promise<Captura> {
    const captura = await exigir(id);
    if (captura.estado === 'guardada') throw new ErrorDeDominio('captura_ya_resuelta');
    await ponerEstado(id, 'pendiente', null);
    return (await obtener(id))!;
  }

  /** Cambia la cuenta o la categoría propuestas de una captura sin guardar. */
  async function proponer(
    id: string,
    cambios: { cuentaId?: string | null; categoriaId?: string | null },
  ): Promise<Captura> {
    const captura = await exigir(id);
    if (captura.estado === 'guardada') throw new ErrorDeDominio('captura_ya_resuelta');
    await bd.ejecutar(
      'UPDATE captura SET cuenta_id = ?, categoria_id = ?, modificado_en = ? WHERE id = ?',
      [
        cambios.cuentaId === undefined ? captura.cuentaId : cambios.cuentaId,
        cambios.categoriaId === undefined ? captura.categoriaId : cambios.categoriaId,
        entorno.ahora().toISOString(),
        id,
      ],
    );
    return (await obtener(id))!;
  }

  /**
   * «Añadir gasto» desde Atajos (T-038). Con importe y categoría válidos y
   * una cuenta que se pueda determinar, crea el gasto y deja constancia en
   * una captura ya guardada. Si falta algo, deja una captura pendiente en
   * lugar de fallar. La misma entrada de la cola no se procesa dos veces.
   */
  async function anadirGasto(pedido: {
    idDeCola: string;
    recibidaEn: string;
    importeTexto: string;
    categoriaTexto: string;
    cuentaTexto: string;
  }): Promise<Captura> {
    const existentes = await bd.consultar<FilaCaptura>(
      'SELECT * FROM captura WHERE id_de_cola = ? AND borrado_en IS NULL',
      [pedido.idDeCola],
    );
    if (existentes[0]) return filaACaptura(existentes[0]);

    const cuentas = (await cuentasVivas()).filter((c) => !c.archivada);
    const categorias = (await categoriasVivas()).filter((c) => !c.archivada && c.tipo === 'gasto');
    const categoria = categorias.find(
      (c) => normalizarNombre(c.nombre) === normalizarNombre(pedido.categoriaTexto),
    );
    // La cuenta: la que se nombra o, si no se nombra ninguna y solo hay una, esa.
    const porNombre = cuentas.find(
      (c) => normalizarNombre(c.nombre) === normalizarNombre(pedido.cuentaTexto),
    );
    const cuenta =
      porNombre ?? (pedido.cuentaTexto === '' && cuentas.length === 1 ? cuentas[0] : undefined);

    const captura = await registrar({
      idDeCola: pedido.idDeCola,
      recibidaEn: pedido.recibidaEn,
      origen: 'manual',
      importeTexto: pedido.importeTexto,
    });
    const propuesta = await proponer(captura.id, {
      cuentaId: cuenta?.id ?? null,
      categoriaId: categoria?.id ?? null,
    });
    // Una captura marcada como duplicada se queda en la bandeja: no se crea el gasto a ciegas.
    if (!seGuardaConUnToque(propuesta)) return propuesta;
    await bd.transaccion(async () => {
      const mov = await movimientos.crear({
        tipo: 'gasto',
        fecha: fechaDe(propuesta),
        importe: propuesta.importe ?? 0,
        cuentaId: propuesta.cuentaId ?? '',
        categoriaId: propuesta.categoriaId,
        capturaId: propuesta.id,
      });
      await ponerEstado(propuesta.id, 'guardada', mov.id);
    });
    return (await obtener(propuesta.id))!;
  }

  return {
    obtener,
    exigir,
    registrar,
    listar,
    contarPendientes,
    ultimaRecibida,
    guardar,
    guardarEditada,
    descartar,
    recuperar,
    proponer,
    anadirGasto,
    listarAlias,
    fijarAlias,
    borrarAlias,
    restaurarAlias,
    listarReglasDeComercio,
    recordarComercio,
  };
}

export type RepositorioDeCapturas = ReturnType<typeof crearRepositorioDeCapturas>;
