import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  BotonAnadir,
  Cabecera,
  Selector,
  useMargenDeLista,
  type OpcionDeSelector,
} from '@/componentes/basicos';
import { FilaDeMovimiento } from '@/componentes/FilaDeMovimiento';
import { agruparPorDia } from '@/datos/movimientos';
import { esFechaValida } from '@/dominio/modelo';
import { esMesValido } from '@/dominio/resumen';
import { aspectoDeMovimiento } from '@/estado/aspecto';
import { useConsulta } from '@/estado/Datos';
import { describirFecha, describirMes, fechaLarga } from '@/estado/fechas';
import { t } from '@/i18n';
import { Espacio, Letra, Radio, TactilMinimo, useColores, usePaleta } from '@/theme';

/**
 * P06 · Movimientos: lista agrupada por día, con búsqueda por nombre y
 * filtros por cuenta, categoría y mes (T-025).
 *
 * Inicio puede abrirla con filtros ya puestos mediante los parámetros
 * `categoriaId`, `cuentaId` y `mes` de la ruta.
 */
export default function Movimientos() {
  const c = useColores();
  const [texto, setTexto] = useState('');
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [mes, setMes] = useState<string | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const paleta = usePaleta();
  const margenDeLista = useMargenDeLista();

  // Filtros pedidos desde otra pantalla. Se aplican una vez por petición:
  // después la persona puede cambiarlos o quitarlos con libertad.
  const pedido = useLocalSearchParams<{
    categoriaId?: string;
    cuentaId?: string;
    mes?: string;
    dia?: string;
    peticion?: string;
  }>();
  const firma = [pedido.peticion, pedido.categoriaId, pedido.cuentaId, pedido.mes, pedido.dia].join(
    '|',
  );
  const [aplicada, setAplicada] = useState('||||');
  if (firma !== aplicada) {
    setAplicada(firma);
    if (firma !== '||||') {
      setTexto('');
      setCategoriaId(pedido.categoriaId || null);
      setCuentaId(pedido.cuentaId || null);
      setMes(pedido.mes && esMesValido(pedido.mes) ? pedido.mes : null);
      setDia(pedido.dia && esFechaValida(pedido.dia) ? pedido.dia : null);
    }
  }

  const lista = useConsulta(
    (r) =>
      r.movimientos.listar({
        texto,
        cuentaId: cuentaId ?? undefined,
        categoriaId: categoriaId ?? undefined,
        mes: mes ?? undefined,
        dia: dia ?? undefined,
      }),
    [texto, cuentaId, categoriaId, mes, dia],
  );
  // Para los filtros se ofrecen también las archivadas: siguen teniendo movimientos.
  const cuentas = useConsulta((r) => r.cuentas.listar({ incluirArchivadas: true }));
  const categorias = useConsulta((r) => r.categorias.listar({ incluirArchivadas: true }));
  const meses = useConsulta((r) => r.movimientos.mesesConMovimientos());

  const secciones = useMemo(
    () => agruparPorDia(lista ?? []).map((g) => ({ fecha: g.fecha, data: g.movimientos })),
    [lista],
  );

  const opcionesDeCuenta: OpcionDeSelector[] = [
    { valor: null, texto: t('comun.todas') },
    ...(cuentas ?? []).map((x) => ({ valor: x.id, texto: x.nombre })),
  ];
  const opcionesDeCategoria: OpcionDeSelector[] = [
    { valor: null, texto: t('comun.todas') },
    ...(categorias ?? []).map((x) => ({
      valor: x.id,
      texto: x.nombre,
      detalle: t(`tipoDeCategoria.${x.tipo}`),
    })),
  ];
  const opcionesDeMes: OpcionDeSelector[] = [
    { valor: null, texto: t('comun.todos') },
    // El mes pedido se ofrece aunque no tenga movimientos, para que se vea cuál es.
    ...[...new Set([...(mes ? [mes] : []), ...(meses ?? [])])]
      .sort()
      .reverse()
      .map((m) => ({ valor: m, texto: describirMes(m) })),
  ];

  const hayFiltros =
    texto.trim() !== '' ||
    cuentaId !== null ||
    categoriaId !== null ||
    mes !== null ||
    dia !== null;
  const sinCuentas = cuentas !== undefined && cuentas.length === 0;

  let mensajeVacio = t('movimientos.vacio');
  if (sinCuentas) mensajeVacio = t('movimientos.sinCuentas');
  else if (hayFiltros) mensajeVacio = t('movimientos.sinResultados');

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <Cabecera titulo={t('movimientos.titulo')}>
        <BotonAnadir
          etiqueta={t('movimientos.nuevo')}
          alPulsar={() => router.push('/movimiento')}
        />
      </Cabecera>
      <View style={estilos.busqueda}>
        <TextInput
          value={texto}
          onChangeText={setTexto}
          placeholder={t('movimientos.buscar')}
          placeholderTextColor={c.textoSecundario}
          accessibilityLabel={t('movimientos.buscar')}
          testID="buscar"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          style={[
            estilos.campoBusqueda,
            { backgroundColor: c.superficie, color: c.texto, borderColor: c.borde },
          ]}
        />
      </View>
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={estilos.filtros}>
          <Selector
            compacto
            titulo={t('movimientos.filtroCuenta')}
            opciones={opcionesDeCuenta}
            valor={cuentaId}
            alElegir={setCuentaId}
            textoVacio={t('comun.todas')}
            testID="filtro-cuenta"
          />
          <Selector
            compacto
            titulo={t('movimientos.filtroCategoria')}
            opciones={opcionesDeCategoria}
            valor={categoriaId}
            alElegir={setCategoriaId}
            textoVacio={t('comun.todas')}
            testID="filtro-categoria"
          />
          <Selector
            compacto
            titulo={t('movimientos.filtroMes')}
            opciones={opcionesDeMes}
            valor={mes}
            alElegir={setMes}
            textoVacio={t('comun.todos')}
            testID="filtro-mes"
          />
          {dia ? (
            <Pressable
              onPress={() => setDia(null)}
              accessibilityRole="button"
              accessibilityLabel={t('movimientos.quitarDia', { fecha: fechaLarga(dia) })}
              testID="filtro-dia"
              style={[
                estilos.pildoraDeDia,
                { borderColor: c.acento, backgroundColor: c.acentoSuave },
              ]}>
              <Text style={{ color: c.acento, fontSize: Letra.secundario, fontWeight: '700' }}>
                {`${fechaLarga(dia)}  ✕`}
              </Text>
            </Pressable>
          ) : null}
          {hayFiltros ? (
            <Pressable
              onPress={() => {
                setTexto('');
                setCuentaId(null);
                setCategoriaId(null);
                setMes(null);
                setDia(null);
              }}
              accessibilityRole="button"
              testID="quitar-filtros"
              style={estilos.quitar}>
              <Text style={{ color: c.acento, fontSize: Letra.secundario, fontWeight: '600' }}>
                {t('movimientos.quitarFiltros')}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
      <SectionList
        sections={secciones}
        keyExtractor={(m) => m.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: margenDeLista }}
        renderSectionHeader={({ section }) => (
          <Text style={[estilos.dia, { color: c.textoSecundario }]} accessibilityRole="header">
            {describirFecha(section.fecha)}
          </Text>
        )}
        renderItem={({ item }) => (
          <FilaDeMovimiento
            mov={item}
            aspecto={aspectoDeMovimiento(item, categorias ?? [], paleta)}
            alPulsar={() => router.push({ pathname: '/movimiento', params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          lista === undefined ? undefined : (
            <Text style={[estilos.vacio, { color: c.textoSecundario }]} testID="lista-vacia">
              {mensajeVacio}
            </Text>
          )
        }
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  busqueda: { paddingHorizontal: Espacio.m },
  campoBusqueda: {
    minHeight: TactilMinimo,
    borderRadius: Radio.m,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Espacio.m,
    fontSize: Letra.cuerpo,
  },
  filtros: { paddingHorizontal: Espacio.m, paddingVertical: Espacio.s, gap: Espacio.s },
  pildoraDeDia: {
    minHeight: TactilMinimo,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radio.circulo,
    paddingHorizontal: Espacio.m,
  },
  quitar: { minHeight: TactilMinimo, justifyContent: 'center', paddingHorizontal: Espacio.s },
  dia: {
    fontSize: Letra.pequeno,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: Espacio.m + Espacio.xs,
    paddingTop: Espacio.m,
    paddingBottom: Espacio.s,
  },
  vacio: { fontSize: Letra.secundario, textAlign: 'center', padding: Espacio.xl, lineHeight: 22 },
});
