import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

/**
 * Pinta su contenido por encima de toda la app, también de las hojas modales,
 * que en iOS son ventanas nativas situadas sobre el resto de pantallas. Una
 * vista normal a pantalla completa quedaría por debajo de ellas.
 */
export function SobreTodo({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'ios') return <View style={StyleSheet.absoluteFill}>{children}</View>;
  return (
    <FullWindowOverlay>
      <View style={StyleSheet.absoluteFill}>{children}</View>
    </FullWindowOverlay>
  );
}
