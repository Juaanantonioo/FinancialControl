import { useEffect, type ReactNode } from 'react';
import { AppState, Keyboard, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton } from '@/componentes/basicos';
import type { Instante } from '@/dominio/bloqueo';
import {
  alCambiarElEstadoDeLaApp,
  desbloquear,
  pedirSiHaceFalta,
  useSeguridad,
  type EstadoDeLaApp,
} from '@/estado/seguridad';
import { t } from '@/i18n';
import { Espacio, Letra, useColores } from '@/theme';

import { SobreTodo } from './SobreTodo';

/** La hora del iPhone y un reloj que solo avanza (ver `src/dominio/bloqueo.ts`). */
function ahora(): Instante {
  return { reloj: Date.now(), monotono: performance.now() };
}

/**
 * Lo único que se ve con la app bloqueada o tapada: el nombre de la app y,
 * si está bloqueada, cómo entrar. Opaca y sin ningún dato.
 */
export function PantallaDeBloqueo({
  bloqueada,
  autenticando,
  fallo,
}: {
  bloqueada: boolean;
  autenticando: boolean;
  fallo: boolean;
}) {
  const c = useColores();
  const margen = useSafeAreaInsets();
  return (
    <View
      accessibilityViewIsModal
      testID={bloqueada ? 'pantalla-de-bloqueo' : 'cubierta'}
      style={[
        estilos.pantalla,
        {
          backgroundColor: c.fondo,
          paddingTop: margen.top + Espacio.xl,
          paddingBottom: margen.bottom + Espacio.xl,
        },
      ]}>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.6}
        style={[estilos.nombre, { color: c.texto }]}>
        {t('seguridad.nombreDeLaApp')}
      </Text>
      {bloqueada ? (
        <View style={estilos.cuerpo}>
          <Text maxFontSizeMultiplier={1.6} style={[estilos.titulo, { color: c.texto }]}>
            {t('seguridad.bloqueadaTitulo')}
          </Text>
          <Text maxFontSizeMultiplier={1.6} style={[estilos.texto, { color: c.textoSecundario }]}>
            {t('seguridad.bloqueadaTexto')}
          </Text>
          {fallo ? (
            <Text
              accessibilityLiveRegion="polite"
              maxFontSizeMultiplier={1.6}
              style={[estilos.texto, { color: c.negativo }]}
              testID="fallo-al-desbloquear">
              {t('seguridad.falloAlDesbloquear')}
            </Text>
          ) : null}
          <Boton
            texto={autenticando ? t('seguridad.comprobando') : t('seguridad.desbloquear')}
            variante="primario"
            desactivado={autenticando}
            alPulsar={() => {
              void desbloquear();
            }}
            testID="desbloquear"
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Envuelve toda la app. Sigue cuándo pasa a segundo plano y cuándo vuelve, y
 * pone encima la pantalla de bloqueo o la cubierta. El contenido sigue
 * montado debajo: un enlace o un aviso abren su pantalla ahí, y solo se ve
 * tras autenticarse.
 */
export function PuertaDeSeguridad({ children }: { children: ReactNode }) {
  const s = useSeguridad();
  const tapada = s.bloqueada || s.cubierta;

  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', (nuevo) =>
      alCambiarElEstadoDeLaApp(nuevo as EstadoDeLaApp, ahora()),
    );
    // Arranque con bloqueo: se pide autenticación en cuanto la app está delante.
    pedirSiHaceFalta(AppState.currentState as EstadoDeLaApp);
    return () => suscripcion.remove();
  }, []);

  // El teclado es una ventana aparte y quedaría por encima de la pantalla de bloqueo.
  useEffect(() => {
    if (tapada) Keyboard.dismiss();
  }, [tapada]);

  return (
    <>
      <View
        style={estilos.contenido}
        accessibilityElementsHidden={tapada}
        importantForAccessibility={tapada ? 'no-hide-descendants' : 'auto'}
        testID="contenido-de-la-app">
        {children}
      </View>
      {tapada ? (
        <SobreTodo>
          <PantallaDeBloqueo
            bloqueada={s.bloqueada}
            autenticando={s.autenticando}
            fallo={s.fallo}
          />
        </SobreTodo>
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  contenido: { flex: 1 },
  pantalla: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Espacio.l,
    gap: Espacio.l,
  },
  nombre: { fontSize: Letra.titulo, fontWeight: '800', textAlign: 'center' },
  cuerpo: { alignSelf: 'stretch', alignItems: 'center', gap: Espacio.m },
  titulo: { fontSize: Letra.subtitulo, fontWeight: '700', textAlign: 'center' },
  texto: { fontSize: Letra.secundario, lineHeight: 22, textAlign: 'center' },
});
