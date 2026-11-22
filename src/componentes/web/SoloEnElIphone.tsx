import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CabeceraConVuelta } from '@/componentes/basicos';
import { Tarjeta } from '@/componentes/Tarjeta';
import { t } from '@/i18n';
import { Espacio, Letra, useColores } from '@/theme';

/**
 * Lo que la web enseña en la dirección de una pantalla que solo tiene sentido
 * en el iPhone (Apple Pay y Atajos, avisos, bloqueo, bandeja de capturas). La
 * web no enlaza a ellas; esto es para quien escribe la dirección a mano.
 */
export function SoloEnElIphone() {
  const c = useColores();
  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraConVuelta titulo={t('web.soloIphoneTitulo')} />
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Tarjeta testID="solo-en-el-iphone">
          <Text maxFontSizeMultiplier={1.6} style={[estilos.texto, { color: c.texto }]}>
            {t('web.soloIphoneTexto')}
          </Text>
        </Tarjeta>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Espacio.m, gap: Espacio.m },
  texto: { fontSize: Letra.secundario, lineHeight: 22 },
});
