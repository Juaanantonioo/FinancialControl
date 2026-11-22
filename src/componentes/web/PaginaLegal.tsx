import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/componentes/basicos';
import { Tarjeta } from '@/componentes/Tarjeta';
import { t, type ClaveTexto } from '@/i18n';
import { Espacio, Letra, useColores } from '@/theme';

/**
 * Una página legal: política de privacidad o condiciones de uso. Los textos
 * están en el catálogo (`legal.*`). Son un BORRADOR: lo dice arriba, y los
 * datos del titular van entre corchetes hasta que los complete.
 */
export function PaginaLegal({ cual }: { cual: 'privacidad' | 'condiciones' }) {
  const c = useColores();
  const total = Number(t(`legal.${cual}Secciones`));
  const secciones = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <ScrollView contentContainerStyle={estilos.contenido} testID={`pagina-${cual}`}>
        <Text accessibilityRole="header" style={[estilos.titulo, { color: c.texto }]}>
          {t(`legal.${cual}Titulo`)}
        </Text>
        <View
          style={[estilos.borrador, { borderColor: c.negativo, backgroundColor: c.superficie }]}
          testID="aviso-de-borrador">
          <Text style={[estilos.texto, { color: c.texto }]}>{`⚠ ${t('legal.borrador')}`}</Text>
          <Text style={[estilos.nota, { color: c.textoSecundario }]}>{t('legal.actualizado')}</Text>
        </View>
        {secciones.map((n) => (
          <Tarjeta key={n} titulo={t(`legal.${cual}${n}Titulo` as ClaveTexto)}>
            {t(`legal.${cual}${n}Texto` as ClaveTexto)
              .split('\n')
              .map((parrafo, i) => (
                <Text key={i} style={[estilos.texto, { color: c.texto }]}>
                  {parrafo}
                </Text>
              ))}
          </Tarjeta>
        ))}
        <Boton
          texto={t('web.volver')}
          alPulsar={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          testID="volver-de-legal"
        />
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Espacio.m, gap: Espacio.m, paddingBottom: Espacio.xl * 2 },
  titulo: { fontSize: Letra.titulo, fontWeight: '700' },
  borrador: { borderWidth: 2, borderRadius: 12, padding: Espacio.m, gap: Espacio.xs },
  texto: { fontSize: Letra.secundario, lineHeight: 22 },
  nota: { fontSize: Letra.pequeno, lineHeight: 18 },
});
