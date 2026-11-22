import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Boton,
  Fila,
  PasoDeFecha,
  Segmentos,
  Selector,
  TextoDeError,
  type OpcionDeSelector,
} from '@/componentes/basicos';
import { TecladoDeImporte } from '@/componentes/TecladoDeImporte';
import {
  centimosDelTeclado,
  dinero,
  formatearDinero,
  mostrarTeclado,
  pulsarTecla,
  simboloDeDivisa,
  tecladoDesdeCentimos,
} from '@/dominio/dinero';
import { leerParametros } from '@/dominio/entradas';
import type { Captura } from '@/dominio/captura';
import { fechaLocal, type Movimiento } from '@/dominio/modelo';
import { aspectoDeCategoria } from '@/estado/aspecto';
import { useAviso } from '@/estado/Aviso';
import { superaElLimite } from '@/dominio/textos';
import { textoDeError, useConsulta, useDatos } from '@/estado/Datos';
import { diaLocalDe } from '@/estado/fechas';
import { formatoRegional } from '@/estado/formato';
import { t } from '@/i18n';
import {
  cifrasTabulares,
  Espacio,
  Letra,
  Radio,
  TactilMinimo,
  useColores,
  usePaleta,
} from '@/theme';

type TipoEditable = 'gasto' | 'ingreso' | 'transferencia';

/**
 * P07 · Alta y edición de movimiento (T-023, T-024 y T-028).
 *
 * Flujo F2: la pantalla se abre con el teclado de importe visible, el tipo
 * Gasto, la última cuenta usada y la fecha de hoy. Un gasto se guarda con
 * [+], los dígitos, una categoría y Guardar.
 *
 * Sin parámetro `id` es un alta; con él, edita ese movimiento.
 */
export default function PantallaDeMovimiento() {
  const c = useColores();
  const paleta = usePaleta();
  const margen = useSafeAreaInsets();
  // `id` edita un movimiento. `capturaId` abre el alta con los datos de una
  // captura de la bandeja y, al guardar, la da por resuelta.
  const { id, capturaId } = leerParametros(useLocalSearchParams(), {
    id: 'id',
    capturaId: 'idOpcional',
  });
  const { repos, notificarCambio } = useDatos();
  const mostrarAviso = useAviso();
  const formato = formatoRegional();

  const [original, setOriginal] = useState<Movimiento | null>(null);
  const [cargado, setCargado] = useState(!id);
  const [noExiste, setNoExiste] = useState(false);

  const [tipo, setTipo] = useState<TipoEditable>('gasto');
  const [importe, setImporte] = useState('');
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(fechaLocal());
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // Cerrojo contra dobles pulsaciones. Es una referencia y no un estado porque
  // dos toques pueden llegar antes de que la pantalla se repinte: el estado
  // aún valdría `false` para el segundo, la referencia ya vale `true`.
  const ocupado = useRef(false);

  const cuentas = useConsulta((r) => r.cuentas.listar({ incluirArchivadas: true }));
  const categorias = useConsulta(
    (r) =>
      tipo === 'transferencia'
        ? Promise.resolve([])
        : r.categorias.listar({ tipo, incluirArchivadas: true }),
    [tipo],
  );
  const frecuentes = useConsulta(
    (r) => (tipo === 'transferencia' ? Promise.resolve([]) : r.categorias.frecuentes(tipo)),
    [tipo],
  );

  // Alta desde una captura: se rellena una vez con lo que la captura ya trae.
  const [captura, setCaptura] = useState<Captura | null>(null);
  useEffect(() => {
    if (id || !capturaId) return;
    let vigente = true;
    repos.capturas.obtener(capturaId).then((encontrada) => {
      if (!vigente || !encontrada || encontrada.borradoEn !== null) return;
      if (encontrada.estado === 'guardada') return;
      setCaptura(encontrada);
      if (encontrada.importe !== null) setImporte(tecladoDesdeCentimos(encontrada.importe));
      if (encontrada.cuentaId !== null) setCuentaId(encontrada.cuentaId);
      if (encontrada.categoriaId !== null) setCategoriaId(encontrada.categoriaId);
      setNombre(encontrada.comercioTexto.slice(0, 80));
      setFecha(diaLocalDe(encontrada.recibidaEn));
    });
    return () => {
      vigente = false;
    };
  }, [id, capturaId, repos]);

  // Edición: carga el movimiento una vez.
  useEffect(() => {
    if (!id) return;
    let vigente = true;
    repos.movimientos.obtener(id).then((mov) => {
      if (!vigente) return;
      if (!mov || mov.borradoEn !== null || mov.tipo === 'ajuste') {
        setNoExiste(true);
      } else {
        setOriginal(mov);
        setTipo(mov.tipo as TipoEditable);
        setImporte(tecladoDesdeCentimos(mov.importe));
        setCuentaId(mov.cuentaId);
        setDestinoId(mov.cuentaDestinoId);
        setCategoriaId(mov.categoriaId);
        setFecha(mov.fecha);
        setNombre(mov.nombre);
      }
      setCargado(true);
    });
    return () => {
      vigente = false;
    };
  }, [id, repos]);

  // Alta: propone la última cuenta usada o, si no hay, la primera activa.
  useEffect(() => {
    if (id || cuentaId !== null || !cuentas) return;
    let vigente = true;
    repos.movimientos.ultimaCuentaUsada().then((ultima) => {
      if (!vigente) return;
      const activas = cuentas.filter((x) => !x.archivada);
      const propuesta = activas.find((x) => x.id === ultima) ?? activas[0];
      if (propuesta) setCuentaId(propuesta.id);
    });
    return () => {
      vigente = false;
    };
  }, [id, cuentaId, cuentas, repos]);

  // Una cuenta o categoría archivada solo se ofrece si el movimiento ya la tenía.
  const cuentasElegibles = (cuentas ?? []).filter(
    (x) => !x.archivada || x.id === original?.cuentaId || x.id === original?.cuentaDestinoId,
  );
  const categoriasElegibles = (categorias ?? []).filter(
    (x) => !x.archivada || x.id === original?.categoriaId,
  );
  // Fila de frecuentes: las más usadas y, si hace falta, la que ya tenía el movimiento.
  const fila = [...(frecuentes ?? [])];
  const actual = categoriasElegibles.find((x) => x.id === categoriaId);
  if (actual && !fila.some((x) => x.id === actual.id)) fila.unshift(actual);

  const cuenta = cuentasElegibles.find((x) => x.id === cuentaId);
  const divisa = cuenta?.divisa ?? 'EUR';
  const centimos = centimosDelTeclado(importe);

  const opcionesDeCuenta: OpcionDeSelector[] = cuentasElegibles.map((x) => ({
    valor: x.id,
    texto: x.nombre,
    detalle: t(`tipoDeCuenta.${x.tipo}`),
  }));
  const opcionesDeCategoria: OpcionDeSelector[] = [
    { valor: null, texto: t('movimiento.sinCategoria') },
    ...categoriasElegibles.map((x) => ({ valor: x.id, texto: x.nombre })),
  ];

  /** Emoji de la categoría delante de su nombre; nada si solo tiene inicial. */
  function iconoDePildora(cat: (typeof fila)[number]): string {
    const aspecto = aspectoDeCategoria(cat, paleta);
    return aspecto.esLetra ? '' : aspecto.icono;
  }

  function cambiarTipo(nuevo: TipoEditable) {
    setTipo(nuevo);
    setError(null);
    // La categoría de un gasto no vale para un ingreso, ni para una transferencia.
    setCategoriaId(null);
    if (nuevo !== 'transferencia') setDestinoId(null);
  }

  // Al terminar de escribir un nombre conocido, propone su categoría (flujo F2).
  async function sugerirCategoria() {
    if (tipo === 'transferencia' || categoriaId !== null) return;
    const sugerida = await repos.movimientos.sugerirCategoria(nombre, tipo);
    if (sugerida) setCategoriaId(sugerida);
  }

  async function guardar() {
    if (ocupado.current) return; // un segundo toque en Guardar no duplica el movimiento
    if (!cuentaId) {
      setError(t('errores.cuenta_no_encontrada'));
      return;
    }
    ocupado.current = true;
    setGuardando(true);
    setError(null);
    try {
      const datos = {
        tipo,
        fecha,
        importe: centimos,
        cuentaId,
        cuentaDestinoId: tipo === 'transferencia' ? destinoId : null,
        categoriaId: tipo === 'transferencia' ? null : categoriaId,
        nombre,
      };
      if (original) await repos.movimientos.modificar(original.id, datos);
      else if (captura) await repos.capturas.guardarEditada(captura.id, datos);
      else await repos.movimientos.crear(datos);
      notificarCambio();
      router.back();
    } catch (e) {
      setError(textoDeError(e));
      ocupado.current = false;
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!original || ocupado.current) return;
    ocupado.current = true;
    setGuardando(true);
    try {
      await repos.movimientos.borrar(original.id);
      notificarCambio();
      const idBorrado = original.id;
      mostrarAviso({
        texto: t('movimientos.borrado'),
        accion: {
          texto: t('comun.deshacer'),
          alPulsar: () => {
            repos.movimientos.restaurar(idBorrado).then(notificarCambio, () => undefined);
          },
        },
      });
      router.back();
    } catch (e) {
      setError(textoDeError(e));
      ocupado.current = false;
      setGuardando(false);
    }
  }

  const cabecera = (
    <View style={[estilos.cabecera, { borderBottomColor: c.borde }]}>
      <Boton texto={t('comun.cancelar')} alPulsar={() => router.back()} testID="cancelar" />
      <Text style={[estilos.titulo, { color: c.texto }]} accessibilityRole="header">
        {id ? t('movimiento.tituloEditar') : t('movimiento.tituloNuevo')}
      </Text>
      <Boton
        texto={t('comun.guardar')}
        alPulsar={guardar}
        desactivado={guardando || !cargado || noExiste || !cuentaId}
        testID="guardar"
      />
    </View>
  );

  if (noExiste || (cuentas !== undefined && cuentasElegibles.length === 0)) {
    return (
      <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
        {cabecera}
        <View style={estilos.mensaje}>
          <Text
            style={{ color: c.textoSecundario, fontSize: Letra.secundario, textAlign: 'center' }}>
            {noExiste ? t('movimiento.noEncontrado') : t('movimiento.sinCuentas')}
          </Text>
          {noExiste ? null : (
            <Boton
              texto={t('movimiento.crearCuenta')}
              variante="primario"
              alPulsar={() => router.replace('/cuenta')}
            />
          )}
        </View>
      </View>
    );
  }

  const importeVisible = `${mostrarTeclado(importe, formato)} ${simboloDeDivisa(divisa)}`;

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      {cabecera}
      <ScrollView
        contentContainerStyle={estilos.contenido}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <Segmentos
          opciones={[
            { valor: 'gasto', texto: t('tipoDeMovimiento.gasto') },
            { valor: 'ingreso', texto: t('tipoDeMovimiento.ingreso') },
            { valor: 'transferencia', texto: t('tipoDeMovimiento.transferencia') },
          ]}
          valor={tipo}
          alCambiar={cambiarTipo}
        />

        <Text
          style={[estilos.importe, cifrasTabulares, { color: c.texto }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          testID="importe"
          accessibilityLabel={t('movimiento.importeLeido', {
            importe: formatearDinero(dinero(centimos, divisa), formato),
          })}>
          {importeVisible}
        </Text>

        <TextoDeError texto={error} />
        {original &&
        (superaElLimite(original.nombre, 'nombre') ||
          superaElLimite(original.comercio, 'comercio') ||
          superaElLimite(original.nota, 'nota')) ? (
          <Text
            maxFontSizeMultiplier={1.6}
            style={{ color: c.textoSecundario, fontSize: 13, lineHeight: 18 }}
            testID="aviso-texto-largo">
            {`⚠ ${t('errores.textoGuardadoLargo')}`}
          </Text>
        ) : null}
        {captura ? (
          <Text
            style={{ color: c.textoSecundario, fontSize: Letra.pequeno, textAlign: 'center' }}
            testID="origen-captura">
            {t('movimiento.deCaptura', {
              texto: [captura.importeTexto, captura.comercioTexto, captura.tarjetaTexto]
                .filter((x) => x !== '')
                .join(' · '),
            })}
          </Text>
        ) : null}

        <Fila
          etiqueta={
            tipo === 'transferencia' ? t('movimiento.cuentaOrigen') : t('movimiento.cuenta')
          }>
          <Selector
            titulo={t('movimiento.cuenta')}
            opciones={opcionesDeCuenta}
            valor={cuentaId}
            alElegir={setCuentaId}
            textoVacio={t('movimiento.elegirCuenta')}
            testID="selector-cuenta"
          />
        </Fila>

        {tipo === 'transferencia' ? (
          <Fila etiqueta={t('movimiento.cuentaDestino')}>
            <Selector
              titulo={t('movimiento.cuentaDestino')}
              opciones={opcionesDeCuenta.filter((o) => o.valor !== cuentaId)}
              valor={destinoId}
              alElegir={setDestinoId}
              textoVacio={t('movimiento.elegirCuenta')}
              testID="selector-destino"
            />
          </Fila>
        ) : (
          <View style={[estilos.categorias, { borderBottomColor: c.borde }]}>
            <Text style={{ color: c.textoSecundario, fontSize: Letra.secundario }}>
              {t('movimiento.categoria')}
            </Text>
            <View style={estilos.filaDeCategorias}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={estilos.pildoras}>
                {fila.map((cat) => {
                  const elegida = cat.id === categoriaId;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setCategoriaId(elegida ? null : cat.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: elegida }}
                      accessibilityLabel={cat.nombre}
                      testID={`categoria-${cat.nombre}`}
                      style={[
                        estilos.pildora,
                        {
                          backgroundColor: elegida ? c.acentoSuave : c.superficie,
                          borderColor: elegida ? c.acento : c.borde,
                        },
                      ]}>
                      <Text
                        style={{
                          color: elegida ? c.acento : c.texto,
                          fontSize: Letra.secundario,
                          fontWeight: elegida ? '700' : '500',
                        }}>
                        {`${elegida ? '✓' : iconoDePildora(cat)} ${cat.nombre}`.trim()}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Selector
                compacto
                titulo={t('movimiento.categoria')}
                opciones={opcionesDeCategoria}
                valor={null}
                alElegir={setCategoriaId}
                textoVacio={t('movimiento.sinCategoria')}
                testID="selector-categoria"
              />
            </View>
          </View>
        )}

        <Fila etiqueta={t('movimiento.fecha')}>
          <PasoDeFecha fecha={fecha} alCambiar={setFecha} />
        </Fila>

        <Fila etiqueta={t('movimiento.nombre')}>
          <TextInput
            value={nombre}
            onChangeText={setNombre}
            onEndEditing={sugerirCategoria}
            placeholder={t('movimiento.nombreOpcional')}
            placeholderTextColor={c.textoSecundario}
            accessibilityLabel={t('movimiento.nombre')}
            testID="nombre"
            maxLength={80}
            returnKeyType="done"
            style={[estilos.campoNombre, { color: c.texto }]}
          />
        </Fila>

        {tipo !== 'transferencia' ? (
          <Boton
            texto={t('movimiento.gestionarCategorias')}
            alPulsar={() => router.push('/categorias')}
            estilo={estilos.enlace}
          />
        ) : null}

        {original ? (
          <Boton
            texto={t('comun.borrar')}
            variante="peligro"
            alPulsar={borrar}
            desactivado={guardando}
            testID="borrar"
            estilo={estilos.enlace}
          />
        ) : null}
      </ScrollView>

      <View style={{ paddingBottom: margen.bottom }}>
        <TecladoDeImporte
          formato={formato}
          alPulsar={(tecla) => {
            setError(null);
            setImporte((actualTexto) => pulsarTecla(actualTexto, tecla));
          }}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Espacio.s,
    paddingBottom: Espacio.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titulo: { fontSize: Letra.cuerpo, fontWeight: '700', flexShrink: 1 },
  contenido: { padding: Espacio.m, paddingBottom: Espacio.l },
  importe: {
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: -1,
    textAlign: 'center',
    paddingVertical: Espacio.m,
  },
  // La etiqueta va encima y las categorías ocupan todo el ancho de la pantalla.
  categorias: {
    paddingTop: Espacio.s + Espacio.xs,
    paddingBottom: Espacio.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Espacio.s,
  },
  filaDeCategorias: { flexDirection: 'row', alignItems: 'center', gap: Espacio.s },
  pildoras: { gap: Espacio.s, alignItems: 'center', paddingRight: Espacio.s },
  pildora: {
    minHeight: TactilMinimo,
    borderWidth: 1,
    borderRadius: Radio.circulo,
    paddingHorizontal: Espacio.m,
    justifyContent: 'center',
  },
  campoNombre: {
    fontSize: Letra.cuerpo,
    minHeight: TactilMinimo,
    alignSelf: 'stretch',
    textAlign: 'right',
  },
  enlace: { alignSelf: 'flex-start', marginTop: Espacio.s, paddingHorizontal: 0 },
  mensaje: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Espacio.m,
    padding: Espacio.xl,
  },
});
