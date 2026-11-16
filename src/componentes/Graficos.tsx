/**
 * Gráficos propios dibujados con react-native-svg (T-080): un anillo para el
 * reparto del gasto y unas barras para la evolución por meses.
 *
 * Cada gráfico recibe ya las cifras calculadas en `src/dominio`, lleva una
 * descripción textual para el lector de pantalla y aparece sin transición si
 * está activado «Reducir movimiento».
 */
import type { ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { useEntrada } from '@/estado/animacion';
import { Espacio, Letra, Radio, TactilMinimo, useColores } from '@/theme';

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
  elegido: string;
  alElegir: (clave: string) => void;
  alto?: number;
}) {
  const c = useColores();
  const entrada = useEntrada(grupos.map((g) => g.clave).join());
  const maximo = Math.max(0, ...grupos.flatMap((g) => g.valores));
  const anchoDeBarra = 12;
  const separacion = 4;
  const anchoDeGrupo = anchoDeBarra * 2 + separacion;
  return (
    <Animated.View style={[estilos.barras, { opacity: entrada }]} testID="grafico-barras">
      {grupos.map((grupo) => {
        const esElegido = grupo.clave === elegido;
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
            <Svg width={anchoDeGrupo} height={alto} opacity={esElegido ? 1 : 0.7}>
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
              maxFontSizeMultiplier={1.6}
              style={{
                color: esElegido ? c.acento : c.textoSecundario,
                fontSize: Letra.pequeno,
                fontWeight: esElegido ? '700' : '500',
              }}>
              {grupo.etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </Animated.View>
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
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: Espacio.m },
  elementoDeLeyenda: { flexDirection: 'row', alignItems: 'center', gap: Espacio.xs },
  muestra: { width: 10, height: 10, borderRadius: 3 },
});
