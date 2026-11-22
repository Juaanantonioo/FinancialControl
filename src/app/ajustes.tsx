import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CabeceraConVuelta, Segmentos } from '@/componentes/basicos';
import { Tarjeta } from '@/componentes/Tarjeta';
import { elegirApariencia, useApariencia } from '@/estado/apariencia';
import { t } from '@/i18n';
import { APARIENCIAS } from '@/lib/apariencia';
import { Espacio, Letra, TactilMinimo, useColores } from '@/theme';

/** Los accesos de Ajustes, en el orden en que se muestran. */
export const ACCESOS_DE_AJUSTES = [
  {
    ruta: '/categorias',
    titulo: t('categorias.titulo'),
    ayuda: t('ajustes.categoriasAyuda'),
    testID: 'ajuste-categorias',
  },
  {
    ruta: '/apple-pay',
    titulo: t('guia.abrir'),
    ayuda: t('ajustes.applePayAyuda'),
    testID: 'ajuste-apple-pay',
  },
  {
    ruta: '/avisos',
    titulo: t('avisos.abrir'),
    ayuda: t('ajustes.avisosAyuda'),
    testID: 'ajuste-avisos',
  },
  {
    ruta: '/diagnostico',
    titulo: t('diagnostico.titulo'),
    ayuda: t('ajustes.diagnosticoAyuda'),
    testID: 'ajuste-diagnostico',
  },
] as const;

/**
 * Ajustes: lo que se configura una vez y se toca poco. Se abre con el
 * engranaje de la cabecera de Inicio. Primero, la apariencia de la app
 * (automática, clara u oscura); después, Seguridad (bloqueo y modo privado) y Cuenta;
 * debajo, Categorías, Apple Pay y tarjetas, Avisos y Diagnóstico.
 */
export default function Ajustes() {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const apariencia = useApariencia();
  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraConVuelta titulo={t('ajustes.titulo')} />
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingBottom: margen.bottom + Espacio.xl }]}>
        <Tarjeta titulo={t('ajustes.apariencia')} testID="ajuste-apariencia">
          <Segmentos
            opciones={APARIENCIAS.map((valor) => ({
              valor,
              texto: t(`ajustes.apariencia_${valor}`),
            }))}
            valor={apariencia}
            alCambiar={elegirApariencia}
          />
          <Text
            maxFontSizeMultiplier={1.6}
            style={{ color: c.textoSecundario, fontSize: Letra.pequeno, lineHeight: 18 }}
            testID="ayuda-de-apariencia">
            {t(`ajustes.aparienciaAyuda_${apariencia}`)}
          </Text>
        </Tarjeta>
        <Tarjeta estilo={estilos.tarjeta}>
          <Pressable
            onPress={() => router.push('/seguridad')}
            accessibilityRole="button"
            accessibilityLabel={`${t('seguridad.titulo')}. ${t('ajustes.seguridadAyuda')}`}
            testID="abrir-seguridad"
            style={({ pressed }) => [estilos.fila, { opacity: pressed ? 0.6 : 1 }]}>
            <View style={estilos.textos}>
              <Text maxFontSizeMultiplier={1.6} style={[estilos.titulo, { color: c.texto }]}>
                {t('seguridad.titulo')}
              </Text>
              <Text
                maxFontSizeMultiplier={1.6}
                style={{ color: c.textoSecundario, fontSize: Letra.pequeno, lineHeight: 18 }}>
                {t('ajustes.seguridadAyuda')}
              </Text>
            </View>
            <Text
              allowFontScaling={false}
              style={{ color: c.textoSecundario, fontSize: Letra.subtitulo }}>
              ›
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/cuenta-de-usuario')}
            accessibilityRole="button"
            accessibilityLabel={`${t('usuario.titulo')}. ${t('ajustes.cuentaAyuda')}`}
            testID="abrir-cuenta"
            style={({ pressed }) => [
              estilos.fila,
              { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borde },
              { opacity: pressed ? 0.6 : 1 },
            ]}>
            <View style={estilos.textos}>
              <Text maxFontSizeMultiplier={1.6} style={[estilos.titulo, { color: c.texto }]}>
                {t('usuario.titulo')}
              </Text>
              <Text
                maxFontSizeMultiplier={1.6}
                style={{ color: c.textoSecundario, fontSize: Letra.pequeno, lineHeight: 18 }}>
                {t('ajustes.cuentaAyuda')}
              </Text>
            </View>
            <Text
              allowFontScaling={false}
              style={{ color: c.textoSecundario, fontSize: Letra.subtitulo }}>
              ›
            </Text>
          </Pressable>
        </Tarjeta>
        <Tarjeta estilo={estilos.tarjeta}>
          {ACCESOS_DE_AJUSTES.map((acceso, i) => (
            <Pressable
              key={acceso.ruta}
              onPress={() => router.push(acceso.ruta)}
              accessibilityRole="button"
              accessibilityLabel={`${acceso.titulo}. ${acceso.ayuda}`}
              testID={acceso.testID}
              style={({ pressed }) => [
                estilos.fila,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borde },
                { opacity: pressed ? 0.6 : 1 },
              ]}>
              <View style={estilos.textos}>
                <Text maxFontSizeMultiplier={1.6} style={[estilos.titulo, { color: c.texto }]}>
                  {acceso.titulo}
                </Text>
                <Text
                  maxFontSizeMultiplier={1.6}
                  style={{ color: c.textoSecundario, fontSize: Letra.pequeno, lineHeight: 18 }}>
                  {acceso.ayuda}
                </Text>
              </View>
              <Text
                allowFontScaling={false}
                style={{ color: c.textoSecundario, fontSize: Letra.subtitulo }}>
                ›
              </Text>
            </Pressable>
          ))}
        </Tarjeta>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Espacio.m, gap: Espacio.m },
  tarjeta: { paddingVertical: Espacio.xs, gap: 0 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.s,
    paddingVertical: Espacio.s + 2,
    gap: Espacio.s,
  },
  textos: { flex: 1, gap: 2 },
  titulo: { fontSize: Letra.cuerpo, fontWeight: '600' },
});
