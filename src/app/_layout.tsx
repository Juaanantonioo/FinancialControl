import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { ProveedorDeAvisos } from '@/estado/Aviso';
import { seguirReducirMovimiento } from '@/estado/animacion';
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
  // Los gráficos necesitan saber si está activado «Reducir movimiento».
  useEffect(seguirReducirMovimiento, []);
  return (
    <ProveedorDeDatos>
      <ProveedorDeAvisos>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: c.fondo },
            headerShadowVisible: false,
            headerTintColor: c.acento,
            headerTitleStyle: { color: c.texto },
            contentStyle: { backgroundColor: c.fondo },
            headerBackButtonDisplayMode: 'minimal',
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="movimiento" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="cuenta" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="detalle-de-cuenta" options={{ headerShown: false }} />
          <Stack.Screen name="patrimonio" options={{ headerShown: false }} />
          <Stack.Screen name="inversiones" options={{ headerShown: false }} />
          <Stack.Screen
            name="valor-de-inversion"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen name="categorias" options={{ title: t('categorias.titulo') }} />
          <Stack.Screen name="diagnostico" options={{ title: t('diagnostico.titulo') }} />
        </Stack>
      </ProveedorDeAvisos>
    </ProveedorDeDatos>
  );
}
