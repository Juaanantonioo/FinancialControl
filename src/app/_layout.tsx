import { Stack } from 'expo-router';

import { t } from '@/i18n';
import { useColores } from '@/theme';

/**
 * Raíz de la navegación. Expo Router convierte cada fichero de `src/app` en
 * una pantalla; este fichero define el contenedor que las envuelve.
 */
export default function RootLayout() {
  const c = useColores();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.superficie },
        headerTintColor: c.texto,
        contentStyle: { backgroundColor: c.fondo },
      }}>
      <Stack.Screen name="index" options={{ title: t('inicio.titulo') }} />
      <Stack.Screen name="diagnostico" options={{ title: t('diagnostico.titulo') }} />
    </Stack>
  );
}
