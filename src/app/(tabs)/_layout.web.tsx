import { TabList, Tabs, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { t, type ClaveTexto } from '@/i18n';
import { Espacio, Letra, Radio, TactilMinimo, useColores } from '@/theme';

/** A partir de este ancho la navegación pasa de barra inferior a barra lateral. */
export const ANCHO_DE_ESCRITORIO = 900;

const PESTANAS: {
  nombre: string;
  ruta: '/' | '/movimientos' | '/analisis' | '/plan' | '/cuentas';
  texto: ClaveTexto;
}[] = [
  { nombre: 'index', ruta: '/', texto: 'pestanas.inicio' },
  { nombre: 'movimientos', ruta: '/movimientos', texto: 'pestanas.movimientos' },
  { nombre: 'analisis', ruta: '/analisis', texto: 'pestanas.analisis' },
  { nombre: 'plan', ruta: '/plan', texto: 'pestanas.plan' },
  { nombre: 'cuentas', ruta: '/cuentas', texto: 'pestanas.cuentas' },
];

type PropsDeEnlace = TabTriggerSlotProps & { texto: string; lateral: boolean; nombre: string };

/** Un enlace de la navegación. `TabTrigger` le pasa si es la pestaña abierta y qué hacer al pulsar. */
function Enlace({ texto, lateral, nombre, isFocused, ref: _ref, ...resto }: PropsDeEnlace) {
  const c = useColores();
  return (
    <Pressable
      {...resto}
      accessibilityRole="link"
      aria-current={isFocused ? 'page' : undefined}
      testID={`pestana-${nombre}`}
      style={({ hovered, focused }: { hovered?: boolean; focused?: boolean }) => [
        lateral ? estilos.enlaceLateral : estilos.enlaceInferior,
        (hovered || focused) && { backgroundColor: c.fondo },
      ]}>
      <Text
        numberOfLines={1}
        style={[
          lateral ? estilos.textoLateral : estilos.textoInferior,
          { color: isFocused ? c.acento : c.textoSecundario },
          isFocused && estilos.activo,
        ]}>
        {texto}
      </Text>
    </Pressable>
  );
}

/**
 * Las cinco pestañas en el navegador. En iOS la barra es la nativa del sistema
 * (`_layout.tsx`); aquí es una lista de enlaces de verdad, navegable con el
 * teclado: abajo en un móvil y a la izquierda en una pantalla ancha. Las
 * pantallas de cada pestaña son las mismas que en iOS.
 */
export default function Pestanas() {
  const c = useColores();
  const { width } = useWindowDimensions();
  const lateral = width >= ANCHO_DE_ESCRITORIO;
  return (
    <Tabs style={[estilos.raiz, { backgroundColor: c.fondo }, lateral && estilos.enFila]}>
      <View style={estilos.contenido}>
        <View style={estilos.columna}>
          {/* Sin esto el contenedor de pantallas crece con su contenido y la lista no se desplaza. */}
          <TabSlot style={estilos.pantallas} />
        </View>
      </View>
      <TabList
        accessibilityLabel={t('web.navegacion')}
        style={[
          lateral ? estilos.lateral : estilos.inferior,
          { backgroundColor: c.superficie, borderColor: c.borde },
        ]}>
        {lateral ? (
          <Text accessibilityRole="header" style={[estilos.marca, { color: c.texto }]}>
            {t('web.nombre')}
          </Text>
        ) : null}
        {PESTANAS.map((pestana) => (
          <TabTrigger key={pestana.nombre} name={pestana.nombre} href={pestana.ruta} asChild>
            <Enlace texto={t(pestana.texto)} lateral={lateral} nombre={pestana.nombre} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, flexDirection: 'column' },
  // La barra lateral va antes en pantalla aunque esté después en el árbol.
  enFila: { flexDirection: 'row-reverse' },
  contenido: { flex: 1, alignItems: 'center' },
  // En escritorio el contenido no se estira a todo lo ancho: se lee mejor en una columna.
  columna: { flex: 1, width: '100%', maxWidth: 760 },
  pantallas: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0 },
  inferior: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Espacio.xs,
  },
  lateral: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    width: 220,
    borderRightWidth: StyleSheet.hairlineWidth,
    padding: Espacio.m,
    gap: Espacio.xs,
  },
  marca: { fontSize: Letra.cuerpo, fontWeight: '700', marginBottom: Espacio.m },
  enlaceInferior: {
    flex: 1,
    minHeight: TactilMinimo + Espacio.s,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.s,
  },
  enlaceLateral: {
    minHeight: TactilMinimo,
    justifyContent: 'center',
    paddingHorizontal: Espacio.s,
    borderRadius: Radio.s,
  },
  textoInferior: { fontSize: 12 },
  textoLateral: { fontSize: Letra.secundario },
  activo: { fontWeight: '700' },
});
