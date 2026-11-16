/**
 * Piezas de interfaz que comparten varias pantallas. Todas respetan el área
 * táctil mínima de 44 puntos, llevan etiqueta para el lector de pantalla y
 * usan colores semánticos (docs/03, apartados 8 y 9).
 */
import { useState, type ReactNode } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fechaLocal } from '@/dominio/modelo';
import { describirFecha, moverDias } from '@/estado/fechas';
import { t } from '@/i18n';
import {
  Espacio,
  Flotante,
  Letra,
  Radio,
  sombraDeTarjeta,
  sombraFlotante,
  TactilMinimo,
  useColores,
} from '@/theme';

/** Cabecera de una pestaña: título grande y, a la derecha, acciones. */
export function Cabecera({ titulo, children }: { titulo: string; children?: ReactNode }) {
  const c = useColores();
  const margen = useSafeAreaInsets();
  return (
    <View style={[estilos.cabecera, { paddingTop: margen.top + Espacio.s }]}>
      <Text style={[estilos.titulo, { color: c.texto }]} accessibilityRole="header">
        {titulo}
      </Text>
      <View style={estilos.acciones}>{children}</View>
    </View>
  );
}

type PropsDeBoton = {
  texto: string;
  alPulsar: () => void;
  /** `primario` relleno, `plano` solo texto, `peligro` para borrar. */
  variante?: 'primario' | 'plano' | 'peligro';
  desactivado?: boolean;
  etiqueta?: string;
  testID?: string;
  estilo?: StyleProp<ViewStyle>;
};

export function Boton({
  texto,
  alPulsar,
  variante = 'plano',
  desactivado = false,
  etiqueta,
  testID,
  estilo,
}: PropsDeBoton) {
  const c = useColores();
  const fondo = variante === 'primario' ? c.acento : c.transparente;
  const color =
    variante === 'primario' ? c.sobreAcento : variante === 'peligro' ? c.negativo : c.acento;
  return (
    <Pressable
      onPress={alPulsar}
      disabled={desactivado}
      accessibilityRole="button"
      accessibilityLabel={etiqueta ?? texto}
      accessibilityState={{ disabled: desactivado }}
      testID={testID}
      style={({ pressed }) => [
        estilos.boton,
        { backgroundColor: fondo, opacity: desactivado ? 0.4 : pressed ? 0.6 : 1 },
        estilo,
      ]}>
      <Text style={[estilos.textoBoton, { color }]}>{texto}</Text>
    </Pressable>
  );
}

/**
 * Espacio que una lista deja libre al final para que el botón flotante y la
 * barra de pestañas no tapen su última fila. Sale de las mismas medidas con
 * las que se coloca el botón, así no pueden desajustarse.
 */
export function margenBajoElFlotante(margenInferior: number): number {
  return margenInferior + Flotante.separacion + Flotante.lado + Espacio.l;
}

export function useMargenDeLista(): number {
  return margenBajoElFlotante(useSafeAreaInsets().bottom);
}

/** Botón redondo "+" fijo sobre la esquina inferior derecha. */
export function BotonFlotante({ etiqueta, alPulsar }: { etiqueta: string; alPulsar: () => void }) {
  const c = useColores();
  const margen = useSafeAreaInsets();
  return (
    <Pressable
      onPress={alPulsar}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      testID="boton-anadir"
      style={({ pressed }) => [
        estilos.flotante,
        sombraFlotante(c),
        {
          backgroundColor: c.acento,
          bottom: margen.bottom + Flotante.separacion,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <Text style={[estilos.mas, { color: c.sobreAcento }]}>+</Text>
    </Pressable>
  );
}

/** Selector de una opción entre pocas, con todas a la vista (Gasto / Ingreso / Transferencia). */
export function Segmentos<T extends string>({
  opciones,
  valor,
  alCambiar,
}: {
  opciones: { valor: T; texto: string }[];
  valor: T;
  alCambiar: (valor: T) => void;
}) {
  const c = useColores();
  return (
    <View
      style={[estilos.segmentos, { backgroundColor: c.superficieSuave }]}
      accessibilityRole="tablist">
      {opciones.map((o) => {
        const elegido = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => alCambiar(o.valor)}
            accessibilityRole="tab"
            accessibilityState={{ selected: elegido }}
            testID={`segmento-${o.valor}`}
            style={[
              estilos.segmento,
              elegido && [{ backgroundColor: c.superficie }, sombraDeTarjeta(c)],
            ]}>
            <Text
              style={{
                color: elegido ? c.acento : c.textoSecundario,
                fontWeight: elegido ? '700' : '500',
                fontSize: Letra.secundario,
              }}
              numberOfLines={1}>
              {o.texto}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Fila de formulario: etiqueta a la izquierda y contenido a la derecha. */
export function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  const c = useColores();
  return (
    <View style={[estilos.fila, { borderBottomColor: c.borde }]}>
      <Text style={[estilos.etiquetaFila, { color: c.textoSecundario }]}>{etiqueta}</Text>
      <View style={estilos.contenidoFila}>{children}</View>
    </View>
  );
}

export type OpcionDeSelector = { valor: string | null; texto: string; detalle?: string };

/**
 * Campo que muestra el valor elegido y, al tocarlo, abre una lista para
 * elegir otro. Sustituye a un desplegable.
 */
export function Selector({
  titulo,
  opciones,
  valor,
  alElegir,
  textoVacio,
  compacto = false,
  testID,
}: {
  titulo: string;
  opciones: OpcionDeSelector[];
  valor: string | null;
  alElegir: (valor: string | null) => void;
  textoVacio: string;
  /** `true` para dibujarlo como una píldora de filtro. */
  compacto?: boolean;
  testID?: string;
}) {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const [abierto, setAbierto] = useState(false);
  const elegida = opciones.find((o) => o.valor === valor);
  const textoVisible = elegida && elegida.valor !== null ? elegida.texto : textoVacio;
  const activo = compacto && valor !== null;
  return (
    <>
      <Pressable
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel={`${titulo}: ${textoVisible}`}
        testID={testID}
        style={
          compacto
            ? [
                estilos.pildora,
                {
                  borderColor: activo ? c.acento : c.borde,
                  backgroundColor: activo ? c.acentoSuave : c.superficie,
                },
              ]
            : estilos.campoSelector
        }>
        <Text
          numberOfLines={1}
          style={{
            color: compacto ? (activo ? c.acento : c.texto) : c.texto,
            fontSize: compacto ? 15 : 17,
            fontWeight: activo ? '700' : '400',
            flexShrink: 1,
          }}>
          {compacto && valor === null ? titulo : textoVisible}
        </Text>
        <Text style={{ color: c.textoSecundario, fontSize: 17 }}>{compacto ? ' ▾' : '  ›'}</Text>
      </Pressable>
      <Modal
        visible={abierto}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAbierto(false)}>
        <View style={[estilos.hoja, { backgroundColor: c.fondo, paddingBottom: margen.bottom }]}>
          <View style={estilos.cabeceraHoja}>
            <Text style={[estilos.tituloHoja, { color: c.texto }]} accessibilityRole="header">
              {titulo}
            </Text>
            <Boton texto={t('comun.cerrar')} alPulsar={() => setAbierto(false)} />
          </View>
          <FlatList
            data={opciones}
            keyExtractor={(o) => o.valor ?? '__ninguno__'}
            renderItem={({ item }) => {
              const marcada = item.valor === valor;
              return (
                <Pressable
                  onPress={() => {
                    setAbierto(false);
                    alElegir(item.valor);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: marcada }}
                  style={[
                    estilos.opcion,
                    { backgroundColor: c.superficie, borderBottomColor: c.borde },
                  ]}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ color: c.texto, fontSize: 17, fontWeight: marcada ? '700' : '400' }}>
                      {item.texto}
                    </Text>
                    {item.detalle ? (
                      <Text style={{ color: c.textoSecundario, fontSize: 14 }}>{item.detalle}</Text>
                    ) : null}
                  </View>
                  {marcada ? <Text style={{ color: c.acento, fontSize: 17 }}>✓</Text> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

/** Elige un día avanzando o retrocediendo de uno en uno. No permite fechas futuras. */
export function PasoDeFecha({
  fecha,
  alCambiar,
}: {
  fecha: string;
  alCambiar: (f: string) => void;
}) {
  const c = useColores();
  const hoy = fechaLocal();
  const esHoy = fecha >= hoy;
  return (
    <View style={estilos.pasoDeFecha}>
      <Pressable
        onPress={() => alCambiar(moverDias(fecha, -1))}
        accessibilityRole="button"
        accessibilityLabel={t('comun.diaAnterior')}
        testID="fecha-anterior"
        style={estilos.flecha}>
        <Text style={{ color: c.acento, fontSize: 24 }}>‹</Text>
      </Pressable>
      <Text style={{ color: c.texto, fontSize: 17, flexShrink: 1, textAlign: 'center' }}>
        {describirFecha(fecha, hoy)}
      </Text>
      <Pressable
        onPress={() => alCambiar(moverDias(fecha, 1))}
        disabled={esHoy}
        accessibilityRole="button"
        accessibilityLabel={t('comun.diaSiguiente')}
        accessibilityState={{ disabled: esHoy }}
        testID="fecha-siguiente"
        style={[estilos.flecha, { opacity: esHoy ? 0.3 : 1 }]}>
        <Text style={{ color: c.acento, fontSize: 24 }}>›</Text>
      </Pressable>
    </View>
  );
}

/** Mensaje de error de un formulario. Lleva texto y símbolo, no solo color. */
export function TextoDeError({ texto }: { texto: string | null }) {
  const c = useColores();
  if (!texto) return null;
  return (
    <Text
      style={[estilos.error, { color: c.negativo }]}
      accessibilityRole="alert"
      testID="texto-de-error">
      {`⚠ ${texto}`}
    </Text>
  );
}

const estilos = StyleSheet.create({
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Espacio.m,
    paddingBottom: Espacio.s,
  },
  titulo: { fontSize: Letra.titulo, fontWeight: '800', flexShrink: 1, letterSpacing: -0.5 },
  acciones: { flexDirection: 'row', alignItems: 'center' },
  boton: {
    minHeight: TactilMinimo,
    minWidth: TactilMinimo,
    paddingHorizontal: Espacio.m,
    borderRadius: Radio.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoBoton: { fontSize: 17, fontWeight: '600' },
  flotante: {
    position: 'absolute',
    right: Espacio.l,
    width: Flotante.lado,
    height: Flotante.lado,
    borderRadius: Flotante.lado / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mas: { fontSize: 34, lineHeight: 38, fontWeight: '400' },
  segmentos: { flexDirection: 'row', borderRadius: Radio.m, padding: 3 },
  segmento: {
    flex: 1,
    minHeight: TactilMinimo,
    borderRadius: Radio.s,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Espacio.xs,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Espacio.s,
  },
  etiquetaFila: { fontSize: 16, width: 96 },
  contenidoFila: { flex: 1, alignItems: 'flex-end' },
  campoSelector: {
    minHeight: TactilMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
  },
  pildora: {
    minHeight: TactilMinimo,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: Espacio.m,
    maxWidth: 220,
  },
  hoja: { flex: 1 },
  cabeceraHoja: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Espacio.m,
    paddingTop: Espacio.m,
    paddingBottom: Espacio.s,
  },
  tituloHoja: { fontSize: 22, fontWeight: '700' },
  opcion: {
    minHeight: TactilMinimo + Espacio.s,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Espacio.m,
    paddingVertical: Espacio.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pasoDeFecha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  flecha: {
    minWidth: TactilMinimo,
    minHeight: TactilMinimo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { fontSize: 15, paddingVertical: Espacio.s },
});
