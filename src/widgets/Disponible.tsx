/**
 * Widget de pantalla de inicio «Disponible este mes» (T-039).
 *
 * El widget no calcula nada ni lee la base de datos: pinta los textos y los
 * colores que la app le envía cada vez que cambia el disponible (ver
 * `src/estado/widget.ts`). Los textos llegan ya escritos, desde el catálogo.
 *
 * Importante: la función marcada con 'widget' se compila aparte y se ejecuta
 * dentro de la extensión del widget, no dentro de la app. Por eso no puede
 * usar nada declarado fuera de ella, ni hooks, ni otros módulos: todo lo que
 * necesita le llega por sus propiedades.
 */
import { HStack, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  clipShape,
  containerBackground,
  font,
  foregroundStyle,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

/** Colores del widget en un modo. Salen de la paleta de la app. */
export type ColoresDelWidget = {
  fondo: string;
  texto: string;
  textoSecundario: string;
  acento: string;
  sobreAcento: string;
  negativo: string;
};

export type DatosDelWidget = {
  /** «Disponible este mes». */
  titulo: string;
  /** La cifra, ya con su formato: «368,00 €». Vacía si no hay presupuesto. */
  cifra: string;
  /** «26,28 € al día», «Te has pasado 12,50 €» o «Crea tu presupuesto». */
  detalle: string;
  /** Fecha del dato: «17 de noviembre». */
  fecha: string;
  /** Texto del botón del tamaño mediano: «Añadir gasto». */
  boton: string;
  /** `true` si se ha gastado más de lo presupuestado. */
  excedido: boolean;
  /** Dirección que abre el alta de un gasto y la que abre Inicio. */
  urlDeAlta: string;
  urlDeInicio: string;
  claro: ColoresDelWidget;
  oscuro: ColoresDelWidget;
};

const Disponible = (datos: DatosDelWidget, entorno: WidgetEnvironment) => {
  'widget';
  const c = entorno.colorScheme === 'dark' ? datos.oscuro : datos.claro;
  const mediano = entorno.widgetFamily === 'systemMedium';
  const textos = (
    <VStack alignment="leading" spacing={2}>
      <Text
        modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(c.textoSecundario)]}>
        {datos.titulo}
      </Text>
      {datos.cifra !== '' ? (
        <Text
          modifiers={[
            font({ size: mediano ? 30 : 26, weight: 'heavy' }),
            monospacedDigit(),
            lineLimit(1),
            minimumScaleFactor(0.5),
            foregroundStyle(datos.excedido ? c.negativo : c.texto),
          ]}>
          {datos.cifra}
        </Text>
      ) : null}
      <Text
        modifiers={[
          font({
            size: datos.cifra !== '' ? 13 : 17,
            weight: datos.cifra !== '' ? 'regular' : 'bold',
          }),
          lineLimit(2),
          minimumScaleFactor(0.7),
          foregroundStyle(datos.excedido ? c.negativo : c.texto),
        ]}>
        {datos.detalle}
      </Text>
      <Spacer />
      <Text modifiers={[font({ size: 11 }), foregroundStyle(c.textoSecundario)]}>
        {datos.fecha}
      </Text>
    </VStack>
  );

  if (!mediano) {
    // Pequeño: tocarlo abre el alta de un gasto.
    return (
      <HStack modifiers={[containerBackground(c.fondo, 'widget'), widgetURL(datos.urlDeAlta)]}>
        {textos}
        <Spacer />
      </HStack>
    );
  }
  // Mediano: el botón abre el alta y el resto abre Inicio.
  return (
    <HStack
      alignment="center"
      spacing={12}
      modifiers={[containerBackground(c.fondo, 'widget'), widgetURL(datos.urlDeInicio)]}>
      {textos}
      <Spacer />
      <Link destination={datos.urlDeAlta}>
        <Text
          modifiers={[
            font({ size: 15, weight: 'bold' }),
            foregroundStyle(c.sobreAcento),
            padding({ horizontal: 14, vertical: 10 }),
            background(c.acento),
            clipShape('capsule'),
          ]}>
          {datos.boton}
        </Text>
      </Link>
    </HStack>
  );
};

/** El nombre debe coincidir con el de `app.json` (plugin expo-widgets). */
export default createWidget<DatosDelWidget>('Disponible', Disponible);
