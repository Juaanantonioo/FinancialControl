import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { Espacio, TactilMinimo, useColores } from '@/theme';

/** Pantalla inicial de H0: una app vacía que demuestra que el entorno funciona. */
export default function Inicio() {
  const c = useColores();
  return (
    <View style={[estilos.contenedor, { backgroundColor: c.fondo }]}>
      <Text style={[estilos.titulo, { color: c.texto }]} accessibilityRole="header">
        {t('app.nombre')}
      </Text>
      <Text style={{ color: c.textoSecundario }}>{t('inicio.entornoListo')}</Text>
      {__DEV__ ? (
        <Link href="/diagnostico" style={[estilos.enlace, { color: c.acento }]}>
          {t('inicio.diagnostico')}
        </Link>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Espacio.s },
  titulo: { fontSize: 28, fontWeight: '700' },
  enlace: { minHeight: TactilMinimo, paddingVertical: Espacio.m, fontSize: 17 },
});
