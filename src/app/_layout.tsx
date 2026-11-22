import { Stack } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { PuertaDeSeguridad } from '@/componentes/seguridad/Puerta';
import { iniciarApariencia } from '@/estado/apariencia';
import { ProveedorDeAvisos } from '@/estado/Aviso';
import { seguirReducirMovimiento } from '@/estado/animacion';
import { useAvisosAutomaticos } from '@/estado/avisos';
import { useColaDeAtajos } from '@/estado/colaNativa';
import { iniciarSeguridad } from '@/estado/seguridad';
import { useSincronizacionAutomatica } from '@/estado/sincronizacionDeLaApp';
import { useWidgetAlDia } from '@/estado/widget';
import { ProveedorDeDatos } from '@/estado/Datos';
import { t } from '@/i18n';
import { almacenDeApariencia } from '@/lib/almacenDeApariencia';
import { almacenDeSeguridad } from '@/lib/almacenDeSeguridad';
import { autenticador } from '@/lib/autenticacion';
import { useColores } from '@/theme';

// La apariencia elegida en Ajustes se aplica al cargar este fichero, antes del primer pintado.
iniciarApariencia(almacenDeApariencia);
// El bloqueo también: si está activo, lo primero que se pinta es la pantalla de bloqueo.
iniciarSeguridad(almacenDeSeguridad, autenticador);

/**
 * Las pestañas son siempre la base de la pila. Así, un enlace que abre la
 * app directamente en otra pantalla (el widget abre el alta de movimiento,
 * un aviso abre la bandeja) la pinta sobre las pestañas, con su forma de
 * volver, y no como única pantalla.
 */
export const unstable_settings = { anchor: '(tabs)' };

/**
 * Raíz de la navegación. Expo Router convierte cada fichero de `src/app` en
 * una pantalla; este fichero define el contenedor que las envuelve y da
 * acceso a los datos a todas ellas.
 */
/**
 * Mantiene al día los avisos locales y el widget, vuelca la cola de las
 * acciones de Atajos y lanza la sincronización. No pinta nada: existe como componente
 * para poder leer los datos, que solo están disponibles dentro del proveedor.
 * Sigue trabajando con la app bloqueada: guarda capturas y programa avisos,
 * pero no enseña nada.
 */
function AvisosDelSistema() {
  useAvisosAutomaticos();
  useColaDeAtajos();
  useWidgetAlDia();
  // Sincronización cifrada: solo hace algo si hay una cuenta abierta.
  useSincronizacionAutomatica();
  return null;
}

/** Los datos y los avisos en pantalla, disponibles para toda la app. */
function Proveedores({ children }: { children: ReactNode }) {
  return (
    <ProveedorDeDatos>
      <ProveedorDeAvisos>
        <AvisosDelSistema />
        {children}
      </ProveedorDeAvisos>
    </ProveedorDeDatos>
  );
}

export default function RootLayout() {
  const c = useColores();
  // Hora y batería con el color que se lee sobre el tema que se ve, también cuando la
  // persona elige en Ajustes el contrario al del iPhone.
  const barraDeEstado = useColorScheme() === 'dark' ? 'light' : 'dark';
  // Los gráficos necesitan saber si está activado «Reducir movimiento».
  useEffect(seguirReducirMovimiento, []);
  return (
    <Proveedores>
      <PuertaDeSeguridad>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: c.fondo },
            headerShadowVisible: false,
            headerTintColor: c.acento,
            headerTitleStyle: { color: c.texto },
            contentStyle: { backgroundColor: c.fondo },
            headerBackButtonDisplayMode: 'minimal',
            statusBarStyle: barraDeEstado,
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="movimiento" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="cuenta" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="detalle-de-cuenta" options={{ headerShown: false }} />
          <Stack.Screen name="patrimonio" options={{ headerShown: false }} />
          <Stack.Screen name="capturas" options={{ headerShown: false }} />
          <Stack.Screen name="ajustes" options={{ headerShown: false }} />
          <Stack.Screen name="seguridad" options={{ headerShown: false }} />
          <Stack.Screen name="cuenta-de-usuario" options={{ headerShown: false }} />
          <Stack.Screen name="exportar" options={{ headerShown: false }} />
          <Stack.Screen name="avisos" options={{ headerShown: false }} />
          <Stack.Screen name="apple-pay" options={{ headerShown: false }} />
          <Stack.Screen name="objetivo" options={{ headerShown: false }} />
          <Stack.Screen
            name="presupuesto"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen name="regla" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="cobro" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen
            name="objetivo-editar"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen name="aportacion" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="inversiones" options={{ headerShown: false }} />
          <Stack.Screen
            name="valor-de-inversion"
            options={{ presentation: 'modal', headerShown: false }}
          />
          <Stack.Screen name="categorias" options={{ title: t('categorias.titulo') }} />
          <Stack.Screen name="diagnostico" options={{ title: t('diagnostico.titulo') }} />
        </Stack>
      </PuertaDeSeguridad>
    </Proveedores>
  );
}
