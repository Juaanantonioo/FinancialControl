import { router } from 'expo-router';
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

import { BotonFlotante, Cabecera, Selector, type OpcionDeSelector } from '@/componentes/basicos';
import { FilaDeMovimiento } from '@/componentes/FilaDeMovimiento';
import { agruparPorDia } from '@/datos/movimientos';
import { useConsulta } from '@/estado/Datos';
import { describirFecha, describirMes } from '@/estado/fechas';
import { t } from '@/i18n';
import { Espacio, TactilMinimo, useColores } from '@/theme';

/**
 * P06 · Movimientos: lista agrupada por día, con búsqueda por nombre y
 * filtros por cuenta, categoría y mes (T-025).
 */
export default function Movimientos() {
  const c = useColores();
  const [texto, setTexto] = useState('');
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [mes, setMes] = useState<string | null>(null);

  const lista = useConsulta(
    (r) =>
      r.movimientos.listar({
        texto,
        cuentaId: cuentaId ?? undefined,
        categoriaId: categoriaId ?? undefined,
        mes: mes ?? undefined,
      }),
    [texto, cuentaId, categoriaId, mes],
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
    ...(meses ?? []).map((m) => ({ valor: m, texto: describirMes(m) })),
  ];

  const hayFiltros =
    texto.trim() !== '' || cuentaId !== null || categoriaId !== null || mes !== null;
  const sinCuentas = cuentas !== undefined && cuentas.length === 0;

  let mensajeVacio = t('movimientos.vacio');
  if (sinCuentas) mensajeVacio = t('movimientos.sinCuentas');
  else if (hayFiltros) mensajeVacio = t('movimientos.sinResultados');

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <Cabecera titulo={t('movimientos.titulo')} />
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
          {hayFiltros ? (
            <Pressable
              onPress={() => {
                setTexto('');
                setCuentaId(null);
                setCategoriaId(null);
                setMes(null);
              }}
              accessibilityRole="button"
              testID="quitar-filtros"
              style={estilos.quitar}>
              <Text style={{ color: c.acento, fontSize: 15 }}>
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
        contentContainerStyle={estilos.lista}
        renderSectionHeader={({ section }) => (
          <Text style={[estilos.dia, { color: c.textoSecundario }]} accessibilityRole="header">
            {describirFecha(section.fecha)}
          </Text>
        )}
        renderItem={({ item }) => (
          <FilaDeMovimiento
            mov={item}
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
      <BotonFlotante
        etiqueta={t('movimientos.nuevo')}
        alPulsar={() => router.push('/movimiento')}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  busqueda: { paddingHorizontal: Espacio.m },
  campoBusqueda: {
    minHeight: TactilMinimo,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Espacio.m,
    fontSize: 17,
  },
  filtros: { paddingHorizontal: Espacio.m, paddingVertical: Espacio.s, gap: Espacio.s },
  quitar: { minHeight: TactilMinimo, justifyContent: 'center', paddingHorizontal: Espacio.s },
  lista: { paddingBottom: 160 },
  dia: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: Espacio.m,
    paddingTop: Espacio.m,
    paddingBottom: Espacio.xs,
  },
  vacio: { fontSize: 16, textAlign: 'center', padding: Espacio.xl },
});
