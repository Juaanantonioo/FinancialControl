import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton, BotonAnadir, Segmentos, useMargenDeLista } from '@/componentes/basicos';
import { BloqueBalance } from '@/componentes/BloquesDelMes';
import {
  BloqueDisponible,
  BloqueObjetivos,
  BloquePendiente,
  BloquePrimerosPasos,
  BloqueProximos,
} from '@/componentes/plan/BloquesDeInicio';
import { patrimonioEn, variacionDelMes } from '@/dominio/patrimonio';
import { resumenDiario } from '@/dominio/tiempo';
import { fechaLarga } from '@/estado/fechas';
import { conSigno, importe, porcentaje } from '@/estado/formato';
import { abrirAnalisis } from '@/estado/navegar';
import { usePanel } from '@/estado/panel';
import { t } from '@/i18n';
import {
  cifrasTabulares,
  degradado,
  Espacio,
  Letra,
  Radio,
  TactilMinimo,
  useColores,
} from '@/theme';

/**
 * P05 · Inicio: cómo voy y qué tengo que hacer hoy. Siete bloques como
 * mucho, en este orden: lo que tienes, disponible este mes, pendiente,
 * próximos cobros, este mes, objetivos y primeros pasos.
 *
 * Habla siempre de hoy y del mes en curso. Otro mes se mira en Análisis; las
 * cuentas y las inversiones, en Cuentas; la previsión de fin de mes, en
 * Plan. Esta pantalla no suma nada: pide las cifras a `src/dominio`.
 */
export default function Inicio() {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const margenDeLista = useMargenDeLista();
  const panel = usePanel();
  const { hoy, divisa, divisas, cuentas, movimientos, valores } = panel;
  const mes = hoy.slice(0, 7);

  const patrimonio = patrimonioEn(cuentas, movimientos, valores, hoy);
  const variacion = variacionDelMes(cuentas, movimientos, valores, hoy);
  const hayInversion = cuentas.some((x) => x.tipo === 'inversion');
  const diario = resumenDiario(movimientos, mes, hoy);

  let fraseDelPatrimonio = t('inicio.sinVariacion');
  if (variacion) {
    const datos = {
      diferencia: conSigno(variacion.diferencia, divisa),
      fecha: fechaLarga(variacion.desde),
    };
    fraseDelPatrimonio =
      variacion.porcentaje === null
        ? t('inicio.variacionDelMes', datos)
        : t('inicio.variacionConPorcentaje', {
            ...datos,
            porcentaje: porcentaje(variacion.porcentaje),
          });
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: margenDeLista }}>
        {/* Lo que tienes hoy, sobre el degradado de la cabecera. */}
        <View style={[estilos.cabecera, degradado(c), { paddingTop: margen.top + Espacio.s }]}>
          <View style={estilos.lineaSuperior}>
            <Text
              style={[estilos.rotulo, { color: c.sobreDegradadoSecundario }]}
              accessibilityRole="header">
              {t('inicio.patrimonio')}
            </Text>
            <Pressable
              onPress={() => router.push('/ajustes')}
              accessibilityRole="button"
              accessibilityLabel={t('ajustes.abrir')}
              testID="boton-ajustes"
              hitSlop={4}
              style={({ pressed }) => [
                estilos.engranaje,
                { backgroundColor: c.veloSobreDegradado, opacity: pressed ? 0.6 : 1 },
              ]}>
              {/* Es un icono: no crece con el tamaño de letra, su botón ya mide 44 puntos. */}
              <Text allowFontScaling={false} style={{ color: c.sobreDegradado, fontSize: 24 }}>
                {'\u2699\uFE0E'}
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => router.push('/patrimonio')}
            accessibilityRole="button"
            accessibilityLabel={t('inicio.patrimonioLeido', {
              total: importe(patrimonio.total, divisa),
              variacion: fraseDelPatrimonio,
            })}
            testID="patrimonio"
            style={({ pressed }) => [estilos.patrimonio, { opacity: pressed ? 0.7 : 1 }]}>
            <View style={estilos.cifraYFlecha}>
              <Text
                style={[estilos.cifraGrande, cifrasTabulares, { color: c.sobreDegradado }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                maxFontSizeMultiplier={1.6}
                testID="patrimonio-total">
                {importe(patrimonio.total, divisa)}
              </Text>
              <Text
                allowFontScaling={false}
                style={{ color: c.sobreDegradadoSecundario, fontSize: 26 }}>
                ›
              </Text>
            </View>
            <Text
              style={{ color: c.sobreDegradadoSecundario, fontSize: Letra.secundario }}
              testID="patrimonio-variacion">
              {fraseDelPatrimonio}
            </Text>
          </Pressable>
          <View style={estilos.pareja}>
            <CifraDeCabecera
              etiqueta={t('inicio.disponible')}
              valor={importe(patrimonio.disponible, divisa)}
              testID="patrimonio-disponible"
            />
            {hayInversion ? (
              <CifraDeCabecera
                etiqueta={t('inicio.invertido')}
                valor={importe(patrimonio.invertido, divisa)}
                testID="patrimonio-invertido"
              />
            ) : null}
          </View>
        </View>

        <View style={estilos.contenido}>
          {divisas.length > 1 ? (
            <Segmentos
              opciones={divisas.map((d) => ({ valor: d, texto: d }))}
              valor={divisa}
              alCambiar={panel.elegirDivisa}
            />
          ) : null}

          <BloqueDisponible panel={panel} />
          <BloquePendiente panel={panel} />
          <BloqueProximos panel={panel} />

          {/* Este mes: ingresos, gastos y balance, con lo gastado hoy. */}
          <BloqueBalance panel={panel} mes={mes} titulo={t('inicio.esteMes')}>
            <Text
              style={{ color: c.textoSecundario, fontSize: Letra.secundario }}
              accessibilityLabel={`${t('inicio.gastadoHoy')}: ${importe(diario.gastoDeHoy, divisa)}`}>
              {`${t('inicio.gastadoHoy')}: `}
              <Text
                style={[cifrasTabulares, { color: c.texto, fontWeight: '700' }]}
                testID="gasto-de-hoy">
                {importe(diario.gastoDeHoy, divisa)}
              </Text>
            </Text>
            <Boton
              texto={t('inicio.verAnalisis')}
              alPulsar={() => abrirAnalisis('mes', mes)}
              testID="ver-analisis"
              estilo={estilos.enlace}
            />
          </BloqueBalance>

          <BloqueObjetivos panel={panel} />
          <BloquePrimerosPasos panel={panel} />
        </View>
      </ScrollView>
      <BotonAnadir />
    </View>
  );
}

function CifraDeCabecera({
  etiqueta,
  valor,
  testID,
}: {
  etiqueta: string;
  valor: string;
  testID: string;
}) {
  const c = useColores();
  return (
    <View
      accessible
      accessibilityLabel={`${etiqueta}: ${valor}`}
      style={[estilos.cifraDeCabecera, { backgroundColor: c.veloSobreDegradado }]}>
      <Text
        style={{ color: c.sobreDegradadoSecundario, fontSize: Letra.pequeno }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={1.8}>
        {etiqueta}
      </Text>
      <Text
        maxFontSizeMultiplier={1.8}
        style={[estilos.valorDeCabecera, cifrasTabulares, { color: c.sobreDegradado }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        testID={testID}>
        {valor}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  cabecera: {
    paddingHorizontal: Espacio.m,
    paddingBottom: Espacio.l,
    borderBottomLeftRadius: Radio.l + 6,
    borderBottomRightRadius: Radio.l + 6,
    gap: Espacio.s,
  },
  lineaSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espacio.s,
  },
  engranaje: {
    width: TactilMinimo,
    height: TactilMinimo,
    borderRadius: TactilMinimo / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotulo: { flex: 1, fontSize: Letra.cuerpo, fontWeight: '600' },
  patrimonio: { minHeight: TactilMinimo, gap: Espacio.xs },
  cifraYFlecha: { flexDirection: 'row', alignItems: 'center', gap: Espacio.s },
  cifraGrande: {
    flexShrink: 1,
    fontSize: Letra.cifraGrande,
    fontWeight: '800',
    letterSpacing: -1,
  },
  pareja: { flexDirection: 'row', gap: Espacio.s, marginTop: Espacio.s },
  cifraDeCabecera: {
    flex: 1,
    borderRadius: Radio.m,
    paddingHorizontal: Espacio.m,
    paddingVertical: Espacio.s + 2,
    gap: 2,
  },
  valorDeCabecera: { fontSize: Letra.cuerpo, fontWeight: '700' },
  contenido: { padding: Espacio.m, gap: Espacio.m },
  enlace: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
