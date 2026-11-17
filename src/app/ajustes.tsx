import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CabeceraConVuelta } from '@/componentes/basicos';
import { Tarjeta } from '@/componentes/Tarjeta';
import { t } from '@/i18n';
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
 * engranaje de la cabecera de Inicio y reúne Categorías, Apple Pay y
 * tarjetas, Avisos y Diagnóstico.
 */
export default function Ajustes() {
  const c = useColores();
  const margen = useSafeAreaInsets();
  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraConVuelta titulo={t('ajustes.titulo')} />
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingBottom: margen.bottom + Espacio.xl }]}>
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
