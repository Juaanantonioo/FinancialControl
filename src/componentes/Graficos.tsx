/**
 * Gráficos propios dibujados con react-native-svg (T-080): un anillo para el
 * reparto del gasto y unas barras para la evolución por meses.
 *
 * Cada gráfico recibe ya las cifras calculadas en `src/dominio`, lleva una
 * descripción textual para el lector de pantalla y aparece sin transición si
 * está activado «Reducir movimiento».
 */
import { useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { intensidad, semanasDelMes, type DiaDelMes } from '@/dominio/tiempo';

import { useEntrada } from '@/estado/animacion';
import { t, type ClaveTexto } from '@/i18n';
import { cifrasTabulares, Espacio, Letra, Radio, TactilMinimo, useColores } from '@/theme';

// ------------------------------------------------------------------ anillo

export type SectorDeAnillo = { clave: string; valor: number; color: string };

/**
 * Tramos del anillo como trazos de una circunferencia: longitud de cada
 * tramo y dónde empieza. Entre tramos queda un hueco, salvo si solo hay uno.
 */
export function tramosDeAnillo(
  valores: number[],
  perimetro: number,
  hueco: number,
): { largo: number; inicio: number }[] {
  const total = valores.reduce((a, b) => a + b, 0);
  if (total <= 0) return valores.map(() => ({ largo: 0, inicio: 0 }));
  const visibles = valores.filter((v) => v > 0).length;
  const separacion = visibles > 1 ? hueco : 0;
  let inicio = 0;
  return valores.map((valor) => {
    const arco = (valor / total) * perimetro;
    const tramo = { largo: Math.max(arco - separacion, valor > 0 ? 1 : 0), inicio };
    inicio += arco;
    return tramo;
  });
}

export function Anillo({
  sectores,
  descripcion,
  clave,
  lado = 150,
  grosor = 22,
  children,
}: {
  sectores: SectorDeAnillo[];
  /** Texto que lee el lector de pantalla en lugar del dibujo. */
  descripcion: string;
  /** Cambia cuando cambian los datos, para repetir la entrada. */
  clave: string;
  lado?: number;
  grosor?: number;
  /** Contenido del centro: la cifra total. */
  children?: ReactNode;
}) {
  const c = useColores();
  const entrada = useEntrada(clave);
  const radio = (lado - grosor) / 2;
  const perimetro = 2 * Math.PI * radio;
  const tramos = tramosDeAnillo(
    sectores.map((s) => s.valor),
    perimetro,
    3,
  );
  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={descripcion}
      testID="grafico-anillo"
      style={{ width: lado, height: lado, opacity: entrada }}>
      <Svg width={lado} height={lado}>
        <Circle
          cx={lado / 2}
          cy={lado / 2}
          r={radio}
          stroke={c.superficieSuave}
          strokeWidth={grosor}
          fill="none"
        />
        {sectores.map((sector, i) =>
          tramos[i].largo > 0 ? (
            <Circle
              key={sector.clave}
              cx={lado / 2}
              cy={lado / 2}
              r={radio}
              stroke={sector.color}
              strokeWidth={grosor}
              fill="none"
              strokeDasharray={`${tramos[i].largo} ${perimetro - tramos[i].largo}`}
              strokeDashoffset={-tramos[i].inicio}
              // El trazo empieza arriba (a las 12) y avanza en el sentido del reloj.
              transform={`rotate(-90 ${lado / 2} ${lado / 2})`}
            />
          ) : null,
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, estilos.centro, { padding: grosor + Espacio.xs }]}>
        {children}
      </View>
    </Animated.View>
  );
}

// ------------------------------------------------------------------ barras

export type GrupoDeBarras = {
  clave: string;
  /** Texto corto bajo el grupo: «nov». */
  etiqueta: string;
  /** Texto completo para el lector de pantalla. */
  descripcion: string;
  valores: [number, number];
};

/** Alto en puntos de una barra. Un valor mayor que cero se ve siempre. */
export function altoDeBarra(valor: number, maximo: number, altoMaximo: number): number {
  if (valor <= 0 || maximo <= 0) return 0;
  return Math.max(3, Math.round((valor / maximo) * altoMaximo));
}

export function Barras({
  grupos,
  colores,
  elegido,
  alElegir,
  alto = 130,
}: {
  grupos: GrupoDeBarras[];
  /** Color de la primera y de la segunda barra de cada grupo. */
  colores: [string, string];
  /** Clave del grupo resaltado. */
  elegido?: string;
  /** Sin esta función las barras no se pueden tocar (por ejemplo, con doce meses). */
  alElegir?: (clave: string) => void;
  alto?: number;
}) {
  const c = useColores();
  const entrada = useEntrada(grupos.map((g) => g.clave).join());
  const maximo = Math.max(0, ...grupos.flatMap((g) => g.valores));
  // Con muchos grupos las barras se estrechan para caber en el ancho.
  const anchoDeBarra = grupos.length > 8 ? 7 : 12;
  const separacion = grupos.length > 8 ? 2 : 4;
  const anchoDeGrupo = anchoDeBarra * 2 + separacion;
  return (
    <Animated.View style={[estilos.barras, { opacity: entrada }]} testID="grafico-barras">
      {grupos.map((grupo) => {
        const esElegido = grupo.clave === elegido;
        const contenido = (
          <>
            <Svg
              width={anchoDeGrupo}
              height={alto}
              opacity={esElegido || elegido === undefined ? 1 : 0.7}>
              {/* Línea de base tenue: se ve aunque el mes no tenga datos. */}
              <Rect x={0} y={alto - 1} width={anchoDeGrupo} height={1} fill={c.borde} />
              {grupo.valores.map((valor, i) => {
                const altura = altoDeBarra(valor, maximo, alto - 4);
                return altura > 0 ? (
                  <Rect
                    key={i}
                    x={i * (anchoDeBarra + separacion)}
                    y={alto - altura}
                    width={anchoDeBarra}
                    height={altura}
                    rx={4}
                    fill={colores[i]}
                  />
                ) : null;
              })}
            </Svg>
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={grupos.length > 8 ? 1.1 : 1.6}
              style={{
                color: esElegido ? c.acento : c.textoSecundario,
                fontSize: grupos.length > 8 ? 11 : Letra.pequeno,
                fontWeight: esElegido ? '700' : '500',
              }}>
              {grupo.etiqueta}
            </Text>
          </>
        );
        if (!alElegir) {
          return (
            <View
              key={grupo.clave}
              accessible
              accessibilityLabel={grupo.descripcion}
              testID={`barras-${grupo.clave}`}
              style={[estilos.grupo, estilos.grupoFijo]}>
              {contenido}
            </View>
          );
        }
        return (
          <Pressable
            key={grupo.clave}
            onPress={() => alElegir(grupo.clave)}
            accessibilityRole="button"
            accessibilityLabel={grupo.descripcion}
            accessibilityState={{ selected: esElegido }}
            testID={`barras-${grupo.clave}`}
            style={[
              estilos.grupo,
              { backgroundColor: esElegido ? c.acentoSuave : c.transparente },
            ]}>
            {contenido}
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

// ------------------------------------------------------------------- línea

export type SerieDeLinea = {
  clave: string;
  color: string;
  valores: number[];
  /** Posición horizontal de cada valor, si la serie no ocupa todo el eje. */
  posiciones?: number[];
  /** Trazo discontinuo, para distinguir dos líneas sin depender del color. */
  discontinua?: boolean;
  /** Rellena el área bajo la línea con el color muy tenue. */
  relleno?: boolean;
};

/**
 * Coordenadas de los puntos de una serie dentro de un rectángulo. Todas las
 * series comparten escala. Si todos los valores son iguales la línea va por
 * el centro. Con un solo punto, este queda centrado.
 */
export function puntosDeLinea(
  valores: number[],
  minimo: number,
  maximo: number,
  ancho: number,
  alto: number,
  margen = 6,
  /** Posición de cada valor en el eje horizontal, de 0 a `total - 1`. Por defecto, su índice. */
  posiciones?: number[],
  /** Número de posiciones del eje horizontal. Por defecto, el número de valores. */
  total: number = valores.length,
): { x: number; y: number }[] {
  const util = Math.max(1, alto - margen * 2);
  const paso = total > 1 ? (ancho - margen * 2) / (total - 1) : 0;
  return valores.map((valor, i) => ({
    x: total > 1 ? margen + (posiciones?.[i] ?? i) * paso : ancho / 2,
    y: maximo === minimo ? alto / 2 : margen + util - ((valor - minimo) / (maximo - minimo)) * util,
  }));
}

export function Linea({
  series,
  etiquetas,
  descripcion,
  textoMaximo,
  textoMinimo,
  alto = 140,
  total,
  etiquetasEnExtremos = false,
}: {
  series: SerieDeLinea[];
  /** Texto bajo cada punto: «nov». */
  etiquetas: string[];
  descripcion: string;
  /** Valor más alto y más bajo de la escala, ya formateados. */
  textoMaximo: string;
  textoMinimo: string;
  alto?: number;
  /** Posiciones del eje horizontal, si las series traen `posiciones`. */
  total?: number;
  /** Reparte las etiquetas de extremo a extremo en lugar de una por punto. */
  etiquetasEnExtremos?: boolean;
}) {
  const c = useColores();
  const entrada = useEntrada(etiquetas.join());
  const [ancho, setAncho] = useState(0);
  const todos = series.flatMap((s) => s.valores);
  const minimo = Math.min(...todos);
  const maximo = Math.max(...todos);
  // Con muchas etiquetas se muestra una de cada dos para que no se pisen.
  const salto = etiquetas.length > 7 ? 2 : 1;
  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={descripcion}
      testID="grafico-linea"
      style={{ opacity: entrada }}>
      <View style={estilos.escala}>
        <Text style={[estilos.textoDeEscala, cifrasTabulares, { color: c.textoSecundario }]}>
          {textoMaximo}
        </Text>
      </View>
      <View
        onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
        style={{ height: alto }}
        testID="lienzo-de-linea">
        {ancho > 0 ? (
          <Svg width={ancho} height={alto}>
            <Rect x={0} y={alto - 1} width={ancho} height={1} fill={c.borde} />
            <Rect x={0} y={0} width={ancho} height={1} fill={c.borde} />
            {series.map((serie) => {
              const puntos = puntosDeLinea(
                serie.valores,
                minimo,
                maximo,
                ancho,
                alto,
                6,
                serie.posiciones,
                total,
              );
              if (puntos.length === 0) return null;
              const trazo = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
              const ultimo = puntos[puntos.length - 1];
              return (
                <G key={serie.clave}>
                  {serie.relleno && puntos.length > 1 ? (
                    <Path
                      d={`${trazo} L${ultimo.x} ${alto} L${puntos[0].x} ${alto} Z`}
                      fill={serie.color}
                      opacity={0.12}
                    />
                  ) : null}
                  {puntos.length > 1 ? (
                    <Path
                      d={trazo}
                      stroke={serie.color}
                      strokeWidth={3}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeDasharray={serie.discontinua ? '2 7' : undefined}
                      fill="none"
                    />
                  ) : null}
                  <Circle
                    cx={ultimo.x}
                    cy={ultimo.y}
                    r={5}
                    fill={serie.color}
                    stroke={c.superficie}
                    strokeWidth={2}
                  />
                </G>
              );
            })}
          </Svg>
        ) : null}
      </View>
      <View style={estilos.escala}>
        <Text style={[estilos.textoDeEscala, cifrasTabulares, { color: c.textoSecundario }]}>
          {textoMinimo}
        </Text>
      </View>
      <View style={estilos.etiquetasDeLinea}>
        {etiquetas.map((etiqueta, i) => (
          <Text
            key={`${etiqueta}-${i}`}
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
            style={[
              estilos.etiquetaDeLinea,
              etiquetasEnExtremos && estilos.etiquetaDeExtremo,
              { color: c.textoSecundario },
            ]}>
            {etiquetasEnExtremos || (etiquetas.length - 1 - i) % salto === 0 ? etiqueta : ''}
          </Text>
        ))}
      </View>
    </Animated.View>
  );
}

// -------------------------------------------------------------- calendario

const DIAS_DE_LA_SEMANA = [1, 2, 3, 4, 5, 6, 0];

/**
 * Calendario de un mes con el gasto de cada día. La intensidad se ve en la
 * barra inferior de cada casilla, pero nunca es el único dato: cada día
 * lleva su cifra y su texto para el lector de pantalla.
 */
export function Calendario({
  mes,
  dias,
  hoy,
  elegido,
  alElegir,
  cifra,
  descripcion,
}: {
  mes: string;
  dias: DiaDelMes[];
  hoy: string;
  /** Día resaltado, "AAAA-MM-DD". */
  elegido: string | null;
  alElegir: (fecha: string) => void;
  /** Texto corto del gasto de un día, sin símbolo: «124». */
  cifra: (centimos: number) => string;
  /** Texto completo de un día para el lector de pantalla. */
  descripcion: (dia: DiaDelMes) => string;
}) {
  const c = useColores();
  const mayor = Math.max(0, ...dias.map((d) => d.gasto));
  return (
    <View testID="calendario">
      <View style={estilos.semana}>
        {DIAS_DE_LA_SEMANA.map((dia) => (
          <Text
            key={dia}
            maxFontSizeMultiplier={1.2}
            style={[estilos.cabeceraDeDia, { color: c.textoSecundario }]}>
            {t(`fechas.diaCorto${dia}` as ClaveTexto)}
          </Text>
        ))}
      </View>
      {semanasDelMes(mes).map((semana, i) => (
        <View key={i} style={estilos.semana}>
          {semana.map((numero, j) => {
            const dia = numero === null ? null : dias[numero - 1];
            if (!dia) return <View key={j} style={estilos.casilla} />;
            const nivel = intensidad(dia.gasto, mayor);
            const esHoy = dia.fecha === hoy;
            const esElegido = dia.fecha === elegido;
            return (
              <Pressable
                key={j}
                onPress={() => alElegir(dia.fecha)}
                accessibilityRole="button"
                accessibilityLabel={descripcion(dia)}
                accessibilityState={{ selected: esElegido }}
                testID={`dia-${dia.fecha}`}
                style={[
                  estilos.casilla,
                  estilos.casillaDeDia,
                  {
                    backgroundColor: esElegido
                      ? c.acentoSuave
                      : nivel > 0
                        ? c.superficieSuave
                        : c.transparente,
                    borderColor: esElegido || esHoy ? c.acento : c.transparente,
                  },
                ]}>
                <Text
                  maxFontSizeMultiplier={1.2}
                  style={{
                    color: esHoy ? c.acento : c.texto,
                    fontSize: Letra.pequeno,
                    fontWeight: esHoy ? '800' : '600',
                  }}>
                  {dia.dia}
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                  maxFontSizeMultiplier={1.2}
                  style={[estilos.cifraDeDia, cifrasTabulares, { color: c.textoSecundario }]}>
                  {dia.gasto > 0 ? cifra(dia.gasto) : ' '}
                </Text>
                <View style={[estilos.pistaDeDia, { backgroundColor: c.transparente }]}>
                  {nivel > 0 ? (
                    <View
                      style={{
                        width: `${nivel * 25}%`,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: c.acento,
                      }}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Cuadro de color con su nombre, para explicar qué es cada barra. */
export function Leyenda({ elementos }: { elementos: { color: string; texto: string }[] }) {
  const c = useColores();
  return (
    <View style={estilos.leyenda}>
      {elementos.map((e) => (
        <View key={e.texto} style={estilos.elementoDeLeyenda}>
          <View style={[estilos.muestra, { backgroundColor: e.color }]} />
          <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>{e.texto}</Text>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { alignItems: 'center', justifyContent: 'center' },
  barras: { flexDirection: 'row', alignItems: 'flex-end' },
  grupo: {
    flex: 1,
    minWidth: TactilMinimo,
    minHeight: TactilMinimo,
    alignItems: 'center',
    gap: Espacio.xs,
    paddingTop: Espacio.s,
    paddingBottom: Espacio.xs,
    borderRadius: Radio.s,
  },
  grupoFijo: { minWidth: 0 },
  escala: { flexDirection: 'row', justifyContent: 'flex-start' },
  textoDeEscala: { fontSize: 11, paddingVertical: 2 },
  etiquetasDeLinea: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2 },
  etiquetaDeLinea: { flex: 1, textAlign: 'center', fontSize: 11 },
  etiquetaDeExtremo: { flex: 0 },
  semana: { flexDirection: 'row', gap: 3, marginBottom: 3 },
  cabeceraDeDia: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600' },
  casilla: { flex: 1, minHeight: TactilMinimo + 6 },
  casillaDeDia: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.s,
    borderWidth: 1.5,
    paddingHorizontal: 1,
    paddingTop: 3,
  },
  cifraDeDia: { fontSize: 10, alignSelf: 'stretch', textAlign: 'center' },
  pistaDeDia: { alignSelf: 'stretch', height: 4, marginHorizontal: 5, marginBottom: 4 },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: Espacio.m },
  elementoDeLeyenda: { flexDirection: 'row', alignItems: 'center', gap: Espacio.xs },
  muestra: { width: 10, height: 10, borderRadius: 3 },
});
