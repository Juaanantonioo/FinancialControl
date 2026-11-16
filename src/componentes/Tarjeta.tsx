/**
 * Piezas del sistema visual: tarjeta, estado vacío, distintivo de categoría
 * y selector de mes. Todas toman sus colores y medidas de `src/theme`.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Boton } from '@/componentes/basicos';
import type { Aspecto } from '@/estado/aspecto';
import { describirMes } from '@/estado/fechas';
import { t } from '@/i18n';
import { Espacio, Letra, Radio, sombraDeTarjeta, TactilMinimo, useColores } from '@/theme';

/** Bloque blanco de esquinas amplias y sombra suave. Con `titulo` lleva encabezado. */
export function Tarjeta({
  titulo,
  children,
  estilo,
  testID,
}: {
  titulo?: string;
  children: ReactNode;
  estilo?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = useColores();
  return (
    <View
      testID={testID}
      style={[estilos.tarjeta, sombraDeTarjeta(c), { backgroundColor: c.superficie }, estilo]}>
      {titulo ? (
        <Text style={[estilos.tituloDeTarjeta, { color: c.texto }]} accessibilityRole="header">
          {titulo}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/**
 * Lo que se muestra cuando un bloque no tiene datos: qué falta y, si se
 * puede resolver, el botón que lo resuelve. Nunca un hueco en blanco.
 */
export function EstadoVacio({
  texto,
  accion,
  testID,
}: {
  texto: string;
  accion?: { texto: string; alPulsar: () => void; testID?: string };
  testID?: string;
}) {
  const c = useColores();
  return (
    <View style={estilos.vacio} testID={testID}>
      <Text style={[estilos.textoVacio, { color: c.textoSecundario }]}>{texto}</Text>
      {accion ? (
        <Boton
          texto={accion.texto}
          variante="primario"
          alPulsar={accion.alPulsar}
          testID={accion.testID}
        />
      ) : null}
    </View>
  );
}

/**
 * Círculo de color con el icono de una categoría. Es decorativo: el nombre
 * de la categoría va siempre escrito al lado, así que el lector de pantalla
 * lo ignora.
 */
export function DistintivoDeCategoria({ aspecto, lado = 40 }: { aspecto: Aspecto; lado?: number }) {
  const c = useColores();
  const forma = { width: lado, height: lado, borderRadius: lado / 2 };
  return (
    <View
      style={[estilos.distintivo, forma]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {/* Con emoji, el color va de fondo tenue; con letra, liso y la letra encima. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          forma,
          { backgroundColor: aspecto.color, opacity: aspecto.esLetra ? 1 : 0.2 },
        ]}
      />
      <Text
        allowFontScaling={false}
        style={{
          fontSize: lado * (aspecto.esLetra ? 0.44 : 0.48),
          fontWeight: '700',
          color: aspecto.esLetra ? c.sobreAcento : c.texto,
        }}>
        {aspecto.icono}
      </Text>
    </View>
  );
}

/** Pone en mayúscula la primera letra: «Noviembre de 2026». */
function enMayuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase() + texto.slice(1);
}

/** «‹ Noviembre de 2026 ›». Sobre el degradado usa los colores claros. */
export function SelectorDeMes({
  mes,
  alCambiar,
  sobreDegradado = false,
}: {
  mes: string;
  alCambiar: (salto: -1 | 1) => void;
  sobreDegradado?: boolean;
}) {
  const c = useColores();
  const color = sobreDegradado ? c.sobreDegradado : c.texto;
  const fondo = sobreDegradado ? c.veloSobreDegradado : c.superficieSuave;
  const flecha = (salto: -1 | 1) => (
    <Pressable
      onPress={() => alCambiar(salto)}
      accessibilityRole="button"
      accessibilityLabel={salto === -1 ? t('comun.mesAnterior') : t('comun.mesSiguiente')}
      testID={salto === -1 ? 'mes-anterior' : 'mes-siguiente'}
      style={({ pressed }) => [
        estilos.flecha,
        { backgroundColor: fondo, opacity: pressed ? 0.6 : 1 },
      ]}>
      {/* La flecha es un icono: no crece con el tamaño de letra, su botón ya mide 44 puntos. */}
      <Text
        allowFontScaling={false}
        style={{ color, fontSize: 24, lineHeight: 28, fontWeight: '600' }}>
        {salto === -1 ? '‹' : '›'}
      </Text>
    </Pressable>
  );
  return (
    <View style={estilos.selectorDeMes}>
      {flecha(-1)}
      <Text
        style={[estilos.mes, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        maxFontSizeMultiplier={1.8}
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
        testID="mes-elegido">
        {enMayuscula(describirMes(mes))}
      </Text>
      {flecha(1)}
    </View>
  );
}

/** Etiqueta pequeña sobre una cifra: «Entradas», «Salidas»… */
export function Dato({
  etiqueta,
  valor,
  color,
  testID,
}: {
  etiqueta: string;
  valor: string;
  color?: string;
  testID?: string;
}) {
  const c = useColores();
  return (
    <View style={estilos.dato} accessible accessibilityLabel={`${etiqueta}: ${valor}`}>
      <Text
        style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={1.8}>
        {etiqueta}
      </Text>
      <Text
        testID={testID}
        maxFontSizeMultiplier={1.8}
        style={[estilos.valorDeDato, { color: color ?? c.texto }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}>
        {valor}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { borderRadius: Radio.l, padding: Espacio.m, gap: Espacio.s },
  tituloDeTarjeta: { fontSize: Letra.subtitulo, fontWeight: '700' },
  vacio: { alignItems: 'center', gap: Espacio.m, paddingVertical: Espacio.m },
  textoVacio: { fontSize: Letra.secundario, textAlign: 'center', lineHeight: 21 },
  distintivo: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  selectorDeMes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espacio.s,
  },
  flecha: {
    width: TactilMinimo,
    height: TactilMinimo,
    borderRadius: TactilMinimo / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mes: {
    flex: 1,
    textAlign: 'center',
    fontSize: Letra.cuerpo,
    fontWeight: '700',
  },
  dato: { flex: 1, gap: 2 },
  valorDeDato: { fontSize: Letra.cuerpo, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
