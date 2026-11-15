import { Stack } from 'expo-router';

import { ProveedorDeAvisos } from '@/estado/Aviso';
import { ProveedorDeDatos } from '@/estado/Datos';
import { t } from '@/i18n';
import { useColores } from '@/theme';

/**
 * Raíz de la navegación. Expo Router convierte cada fichero de `src/app` en
 * una pantalla; este fichero define el contenedor que las envuelve y da
 * acceso a los datos a todas ellas.
 */
export default function RootLayout() {
  const c = useColores();
  return (
    <ProveedorDeDatos>
      <ProveedorDeAvisos>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: c.superficie },
            headerTintColor: c.acento,
            headerTitleStyle: { color: c.texto },
            contentStyle: { backgroundColor: c.fondo },
            headerBackButtonDisplayMode: 'minimal',
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="movimiento" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="cuenta" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="categorias" options={{ title: t('categorias.titulo') }} />
          <Stack.Screen name="diagnostico" options={{ title: t('diagnostico.titulo') }} />
        </Stack>
      </ProveedorDeAvisos>
    </ProveedorDeDatos>
  );
}
