/**
 * Aviso breve en la parte baja de la pantalla con una acción opcional.
 * Se usa para "Movimiento borrado · Deshacer" (T-028).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Espacio, Letra, Radio, sombraFlotante, TactilMinimo, useColores } from '@/theme';

type Aviso = { texto: string; accion?: { texto: string; alPulsar: () => void } };

const Contexto = createContext<(aviso: Aviso) => void>(() => undefined);

/** Segundos que el aviso permanece visible. */
const DURACION_MS = 7000;

export function ProveedorDeAvisos({ children }: { children: ReactNode }) {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cerrar = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    setAviso(null);
  }, []);

  const mostrar = useCallback((nuevo: Aviso) => {
    if (temporizador.current) clearTimeout(temporizador.current);
    setAviso(nuevo);
    temporizador.current = setTimeout(() => setAviso(null), DURACION_MS);
  }, []);

  useEffect(() => cerrar, [cerrar]);

  const valor = useMemo(() => mostrar, [mostrar]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      {aviso ? (
        <View
          style={[
            estilos.aviso,
            sombraFlotante(c),
            { backgroundColor: c.texto, bottom: margen.bottom + 96 },
          ]}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert">
          <Text style={[estilos.texto, { color: c.fondo }]}>{aviso.texto}</Text>
          {aviso.accion ? (
            <Pressable
              accessibilityRole="button"
              testID="aviso-accion"
              onPress={() => {
                // Se cierra antes de actuar: así la acción no puede pulsarse dos veces.
                const accion = aviso.accion;
                cerrar();
                accion?.alPulsar();
              }}
              style={estilos.accion}>
              <Text style={[estilos.textoAccion, { color: c.fondo }]}>{aviso.accion.texto}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Contexto.Provider>
  );
}

export function useAviso() {
  return useContext(Contexto);
}

const estilos = StyleSheet.create({
  aviso: {
    position: 'absolute',
    left: Espacio.m,
    right: Espacio.m,
    borderRadius: Radio.m,
    paddingLeft: Espacio.m,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.s,
    // En una pantalla ancha (la web en escritorio) el aviso no se estira de lado a lado.
    maxWidth: 560,
    marginHorizontal: 'auto',
  },
  texto: { flex: 1, fontSize: Letra.secundario, paddingVertical: Espacio.s },
  accion: {
    minHeight: TactilMinimo,
    minWidth: TactilMinimo,
    paddingHorizontal: Espacio.m,
    justifyContent: 'center',
  },
  textoAccion: { fontSize: Letra.secundario, fontWeight: '700', textDecorationLine: 'underline' },
});
