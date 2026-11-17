import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton, CabeceraConVuelta } from '@/componentes/basicos';
import { EstadoVacio } from '@/componentes/Tarjeta';
import type { CapturaListada } from '@/datos/capturas';
import { loQueFalta, seGuardaConUnToque } from '@/dominio/captura';
import { useAviso } from '@/estado/Aviso';
import { textoDeError, useConsulta, useDatos } from '@/estado/Datos';
import { describirFecha, diaLocalDe, horaLocalDe } from '@/estado/fechas';
import { importe } from '@/estado/formato';
import { t, type ClaveTexto } from '@/i18n';
import { cifrasTabulares, Espacio, Letra, Radio, sombraDeTarjeta, useColores } from '@/theme';

/** Capturas que la bandeja pinta de una vez. Con más, avisa de cuántas quedan. */
const MAXIMO_VISIBLE = 100;

/**
 * P08 · Bandeja de capturas: los pagos que han llegado desde Atajos y están
 * por revisar. Cada uno se guarda con un toque si está completo, se edita
 * en el alta o se descarta. Las duplicadas y las descartadas quedan en un
 * apartado plegado, de donde se pueden recuperar.
 *
 * Parámetros opcionales de la ruta: `id` de la captura que se abre desde un
 * aviso, o `cola`, el identificador de su entrada en la cola de Atajos.
 */
export default function Bandeja() {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const { id, cola } = useLocalSearchParams<{ id?: string; cola?: string }>();
  const { repos, notificarCambio } = useDatos();
  const mostrarAviso = useAviso();
  const [verOtras, setVerOtras] = useState(false);
  const capturas = useConsulta((r) => r.capturas.listar(['pendiente', 'duplicada', 'descartada']));

  const pendientes = (capturas ?? []).filter((x) => x.estado === 'pendiente');
  // El aviso de la acción de Atajos solo conoce el identificador de la entrada en la cola.
  const destacada = id ?? (cola ? pendientes.find((x) => x.idDeCola === cola)?.id : undefined);
  const otras = (capturas ?? []).filter((x) => x.estado !== 'pendiente');
  // La que se abre desde un aviso va la primera.
  const ordenadas = [
    ...pendientes.filter((x) => x.id === destacada),
    ...pendientes.filter((x) => x.id !== destacada),
  ];
  const visibles = ordenadas.slice(0, MAXIMO_VISIBLE);
  const filas: Fila[] = [
    ...visibles.map((captura) => ({ tipo: 'captura' as const, captura })),
    ...(otras.length > 0 ? [{ tipo: 'plegado' as const }] : []),
    ...(verOtras ? otras.map((captura) => ({ tipo: 'captura' as const, captura })) : []),
  ];

  const nombreDe = (captura: CapturaListada) => captura.comercioTexto || t('bandeja.sinComercio');
  const editar = (captura: CapturaListada) =>
    router.push({ pathname: '/movimiento', params: { capturaId: captura.id } });

  async function guardar(captura: CapturaListada) {
    try {
      const mov = await repos.capturas.guardar(captura.id);
      notificarCambio();
      mostrarAviso({
        texto: t('bandeja.guardada'),
        accion: {
          texto: t('comun.deshacer'),
          alPulsar: () => {
            // Borrar el movimiento devuelve la captura a pendientes.
            repos.movimientos.borrar(mov.id).then(notificarCambio, () => undefined);
          },
        },
      });
    } catch (e) {
      mostrarAviso({ texto: textoDeError(e) });
    }
  }

  async function descartar(captura: CapturaListada) {
    try {
      await repos.capturas.descartar(captura.id);
      notificarCambio();
      mostrarAviso({
        texto: t('bandeja.descartada'),
        accion: {
          texto: t('comun.deshacer'),
          alPulsar: () => {
            repos.capturas.recuperar(captura.id).then(notificarCambio, () => undefined);
          },
        },
      });
    } catch (e) {
      mostrarAviso({ texto: textoDeError(e) });
    }
  }

  async function recuperar(captura: CapturaListada) {
    try {
      await repos.capturas.recuperar(captura.id);
      notificarCambio();
    } catch (e) {
      mostrarAviso({ texto: textoDeError(e) });
    }
  }

  function pintar({ item }: { item: Fila }) {
    if (item.tipo === 'plegado') {
      return (
        <View style={estilos.plegado}>
          <Boton
            texto={
              verOtras
                ? t('bandeja.ocultarOtras')
                : t('bandeja.mostrarOtras', { total: otras.length })
            }
            alPulsar={() => setVerOtras(!verOtras)}
            testID="ver-otras"
            estilo={estilos.enlace}
          />
          {verOtras ? (
            <Text style={[estilos.nota, { color: c.textoSecundario }]}>
              {t('bandeja.duplicadaAyuda')}
            </Text>
          ) : null}
        </View>
      );
    }
    const { captura } = item;
    const nombre = nombreDe(captura);
    const cifra =
      captura.importe !== null && captura.divisa !== null
        ? importe(captura.importe, captura.divisa)
        : t('bandeja.faltaImporte');
    const faltas = loQueFalta(captura);
    const pendiente = captura.estado === 'pendiente';
    const detalle = !pendiente
      ? t(`bandeja.estado_${captura.estado}` as ClaveTexto)
      : faltas.length > 0
        ? t('bandeja.porCompletar', {
            faltas: faltas.map((f) => t(`bandeja.falta_${f}` as ClaveTexto)).join(', '),
          })
        : t('bandeja.listaParaGuardar', {
            categoria: captura.categoriaNombre ?? '',
            cuenta: captura.cuentaNombre ?? '',
          });
    return (
      <View
        testID={`captura-${captura.id}`}
        style={[
          estilos.tarjeta,
          sombraDeTarjeta(c),
          {
            backgroundColor: c.superficie,
            borderColor: captura.id === destacada ? c.acento : c.transparente,
            opacity: pendiente ? 1 : 0.75,
          },
        ]}>
        <View
          accessible
          accessibilityLabel={t('bandeja.capturaLeida', {
            comercio: nombre,
            importe: cifra,
            detalle,
          })}>
          <View style={estilos.linea}>
            <Text style={[estilos.nombre, { color: c.texto }]}>{nombre}</Text>
            <Text
              style={[
                estilos.importe,
                cifrasTabulares,
                { color: captura.importe === null ? c.aviso : c.texto },
              ]}
              testID={`importe-${captura.id}`}>
              {cifra}
            </Text>
          </View>
          <Text
            style={{
              color: pendiente && faltas.length > 0 ? c.aviso : c.textoSecundario,
              fontSize: Letra.pequeno,
              fontWeight: pendiente && faltas.length > 0 ? '700' : '400',
            }}
            testID={`detalle-${captura.id}`}>
            {pendiente && faltas.length > 0 ? `⚠ ${detalle}` : detalle}
          </Text>
          <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>
            {t('bandeja.recibida', {
              fecha: describirFecha(diaLocalDe(captura.recibidaEn)),
              hora: horaLocalDe(captura.recibidaEn),
              origen: t(`bandeja.origen_${captura.origen}` as ClaveTexto),
            })}
          </Text>
          {captura.tarjetaTexto ? (
            <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>
              {t('bandeja.tarjeta', { tarjeta: captura.tarjetaTexto })}
            </Text>
          ) : null}
          {captura.divisa !== null && captura.divisa !== 'EUR' ? (
            <Text style={{ color: c.aviso, fontSize: Letra.pequeno }}>
              {t('bandeja.otraDivisa', { divisa: captura.divisa })}
            </Text>
          ) : null}
        </View>
        <View style={estilos.botones}>
          {pendiente ? (
            <>
              {seGuardaConUnToque(captura) ? (
                <Boton
                  texto={t('comun.guardar')}
                  etiqueta={t('bandeja.guardarLeido', { comercio: nombre })}
                  variante="primario"
                  alPulsar={() => guardar(captura)}
                  testID={`guardar-${captura.id}`}
                />
              ) : (
                <Boton
                  texto={t('bandeja.completar')}
                  etiqueta={t('bandeja.editarLeido', { comercio: nombre })}
                  variante="primario"
                  alPulsar={() => editar(captura)}
                  testID={`completar-${captura.id}`}
                />
              )}
              {seGuardaConUnToque(captura) ? (
                <Boton
                  texto={t('comun.editar')}
                  etiqueta={t('bandeja.editarLeido', { comercio: nombre })}
                  alPulsar={() => editar(captura)}
                  testID={`editar-${captura.id}`}
                />
              ) : null}
              <Boton
                texto={t('comun.descartar')}
                etiqueta={t('bandeja.descartarLeido', { comercio: nombre })}
                variante="peligro"
                alPulsar={() => descartar(captura)}
                testID={`descartar-${captura.id}`}
              />
            </>
          ) : (
            <Boton
              texto={t('comun.recuperar')}
              etiqueta={t('bandeja.recuperarLeido', { comercio: nombre })}
              alPulsar={() => recuperar(captura)}
              testID={`recuperar-${captura.id}`}
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraConVuelta titulo={t('bandeja.titulo')}>
        <Boton texto={t('bandeja.guia')} alPulsar={() => router.push('/apple-pay')} testID="guia" />
      </CabeceraConVuelta>
      <FlatList
        data={filas}
        keyExtractor={(item) => (item.tipo === 'captura' ? item.captura.id : item.tipo)}
        renderItem={pintar}
        initialNumToRender={12}
        contentContainerStyle={[estilos.contenido, { paddingBottom: margen.bottom + Espacio.xl }]}
        ListHeaderComponent={
          capturas === undefined ? undefined : pendientes.length === 0 ? (
            <EstadoVacio
              texto={t('bandeja.vacia')}
              testID="bandeja-vacia"
              accion={{
                texto: t('bandeja.verGuia'),
                alPulsar: () => router.push('/apple-pay'),
                testID: 'abrir-guia',
              }}
            />
          ) : ordenadas.length > visibles.length ? (
            // Con muchas capturas solo se pintan las más recientes, y se dice arriba.
            <Text style={[estilos.nota, { color: c.textoSecundario }]} testID="mas-antiguas">
              {t('bandeja.masAntiguas', { visibles: visibles.length, total: ordenadas.length })}
            </Text>
          ) : undefined
        }
      />
    </View>
  );
}

type Fila = { tipo: 'captura'; captura: CapturaListada } | { tipo: 'plegado' };

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Espacio.m, gap: Espacio.s },
  tarjeta: { borderRadius: Radio.l, borderWidth: 1.5, padding: Espacio.m, gap: Espacio.s },
  linea: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: Espacio.s,
  },
  nombre: { flexGrow: 1, flexShrink: 1, flexBasis: 120, fontSize: Letra.cuerpo, fontWeight: '600' },
  importe: { fontSize: Letra.cuerpo, fontWeight: '800', marginLeft: 'auto' },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: Espacio.xs },
  plegado: { paddingTop: Espacio.s, gap: Espacio.xs },
  enlace: { alignSelf: 'flex-start', paddingHorizontal: Espacio.xs },
  nota: { fontSize: Letra.pequeno, lineHeight: 18, paddingHorizontal: Espacio.xs },
});
