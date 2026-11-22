import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { PantallaDeCuenta } from '@/app/cuenta-de-usuario';
import { Boton } from '@/componentes/basicos';
import { Tarjeta } from '@/componentes/Tarjeta';
import { cuenta, useCuenta } from '@/estado/cuentaDeLaApp';
import { alCambiarDatosLocales } from '@/estado/Datos';
import { sincronizacion, useSincronizacion } from '@/estado/sincronizacionDeLaApp';
import { t } from '@/i18n';
import { Espacio, Letra, Radio, useColores } from '@/theme';

/** Páginas que se pueden leer sin haber entrado. */
const PUBLICAS = ['/privacidad', '/condiciones'];
/** Ancho máximo del contenido en pantallas grandes. */
const ANCHO_MAXIMO = 980;

/**
 * `true` mientras haya algo escrito en esta pestaña que aún no ha subido a la
 * cuenta. En la web eso es lo único que se pierde al cerrar.
 */
function useCambiosSinSubir(): boolean {
  const sinc = useSincronizacion();
  const [sucio, setSucio] = useState(false);
  // Cuántos cambios locales ha habido, y cuántos había al empezar el último ciclo.
  const cambios = useRef(0);
  const alEmpezar = useRef(-1);
  useEffect(
    () =>
      alCambiarDatosLocales(() => {
        cambios.current += 1;
        setSucio(true);
      }),
    [],
  );
  useEffect(() => {
    if (sinc.trabajando) {
      alEmpezar.current = cambios.current;
      return;
    }
    // Ciclo terminado bien, sin nada pendiente y sin cambios hechos mientras tanto: todo ha subido.
    const todoSubido =
      sinc.fase === 'al_dia' && sinc.pendientes === 0 && alEmpezar.current === cambios.current;
    if (todoSubido) setSucio(false);
  }, [sinc.trabajando, sinc.fase, sinc.pendientes]);
  return sucio || sinc.pendientes > 0;
}

function useEnLinea(): boolean {
  const [enLinea, setEnLinea] = useState(() => globalThis.navigator?.onLine !== false);
  useEffect(() => {
    const si = () => setEnLinea(true);
    const no = () => setEnLinea(false);
    window.addEventListener('online', si);
    window.addEventListener('offline', no);
    return () => {
      window.removeEventListener('online', si);
      window.removeEventListener('offline', no);
    };
  }, []);
  return enLinea;
}

/** Enlaces a las páginas legales. */
function EnlacesLegales() {
  const c = useColores();
  return (
    <View style={estilos.enlaces}>
      {(
        [
          ['/condiciones', 'web.verCondiciones', 'enlace-condiciones'],
          ['/privacidad', 'web.verPrivacidad', 'enlace-privacidad'],
        ] as const
      ).map(([ruta, texto, testID]) => (
        <Pressable
          key={ruta}
          onPress={() => router.push(ruta)}
          accessibilityRole="link"
          testID={testID}
          style={estilos.enlace}>
          <Text style={[estilos.textoDeEnlace, { color: c.acento }]}>{t(texto)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * La puerta de la web. La cuenta es obligatoria: sin sesión solo se ve entrar
 * o crear cuenta (y las páginas legales). Con sesión, espera a que los datos
 * se hayan bajado y descifrado antes de enseñar la app. Además avisa cuando no
 * hay conexión y antes de cerrar la pestaña con cambios sin subir.
 */
export function PuertaDeLaWeb({ children }: { children: ReactNode }) {
  const c = useColores();
  const estado = useCuenta();
  const sinc = useSincronizacion();
  const ruta = usePathname();
  const enLinea = useEnLinea();
  const sinSubir = useCambiosSinSubir();
  const conSesion = estado.fase === 'con_sesion';
  // Los datos están listos desde la primera sincronización correcta de esta pestaña.
  const [listo, setListo] = useState(false);
  // Se ajusta al pintar, sin efecto: es un estado que solo depende de otros dos.
  if (conSesion && sinc.fase === 'al_dia' && !listo) setListo(true);

  // Cerrar sesión o borrar la cuenta: se recarga la página. Es la forma segura
  // de vaciar la memoria (claves, sesión y base de datos).
  const habiaSesion = useRef(false);
  useEffect(() => {
    if (conSesion) habiaSesion.current = true;
    else if (habiaSesion.current && estado.fase === 'sin_sesion') window.location.replace('/');
  }, [conSesion, estado.fase]);

  // Aviso del navegador al cerrar o recargar con cambios sin subir.
  const avisar = conSesion && (sinSubir || (sinc.trabajando && listo && sinc.pendientes > 0));
  useEffect(() => {
    if (!avisar) return;
    const preguntar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
      // Algunos navegadores solo preguntan si además se asigna un valor.
      evento.returnValue = '';
    };
    window.addEventListener('beforeunload', preguntar);
    return () => window.removeEventListener('beforeunload', preguntar);
  }, [avisar]);

  const publica = PUBLICAS.includes(ruta);
  const dentro = publica || (conSesion && listo);
  const sinConexion = !enLinea || sinc.fase === 'sin_conexion';
  const ancho = { width: '100%' as const, maxWidth: ANCHO_MAXIMO };

  let puerta: ReactNode = null;
  if (!dentro && !conSesion) {
    // Entrar o crear cuenta, con los avisos de la beta.
    puerta = (
      <View style={estilos.columna} testID="puerta-de-entrada">
        <PantallaDeCuenta
          antes={
            <>
              {!enLinea ? (
                <Text
                  accessibilityRole="alert"
                  style={[estilos.banda, estilos.redondeada, { backgroundColor: c.negativo }]}
                  testID="sin-conexion">
                  {t('web.sinConexionAlEntrar')}
                </Text>
              ) : null}
              <Tarjeta titulo={t('web.betaTitulo')} testID="aviso-de-beta">
                <Text style={[estilos.texto, { color: c.texto }]}>{t('web.betaTexto')}</Text>
                <Text style={[estilos.destacado, { color: c.texto }]}>
                  {`⚠ ${t('web.sinRecuperacionTitulo')}`}
                </Text>
                <Text style={[estilos.texto, { color: c.texto }]} testID="aviso-sin-recuperacion">
                  {t('web.sinRecuperacionTexto')}
                </Text>
                <Text style={[estilos.nota, { color: c.textoSecundario }]}>
                  {t('usuario.conCuenta')}
                </Text>
                <Text style={[estilos.nota, { color: c.textoSecundario }]}>
                  {t('web.enEsteNavegador')}
                </Text>
                <Text style={[estilos.nota, { color: c.textoSecundario }]}>
                  {t('web.alCrearAceptas')}
                </Text>
                <EnlacesLegales />
              </Tarjeta>
            </>
          }
        />
      </View>
    );
  } else if (!dentro) {
    const fallo = ['sin_conexion', 'sesion_caducada', 'error', 'parcial'].includes(sinc.fase);
    puerta = (
      <View style={[estilos.columna, estilos.centro]} testID="puerta-cargando">
        {fallo ? null : <ActivityIndicator color={c.acento} />}
        <Text accessibilityRole="header" style={[estilos.destacado, { color: c.texto }]}>
          {fallo ? t('web.cargaFallida') : t('web.cargandoTitulo')}
        </Text>
        <Text style={[estilos.texto, estilos.alCentro, { color: c.textoSecundario }]}>
          {fallo
            ? t(sinc.fase === 'sin_conexion' ? 'web.sinConexionAlEntrar' : 'sinc.error')
            : t('web.cargandoTexto')}
        </Text>
        {fallo ? (
          <>
            <Boton
              texto={t('web.reintentar')}
              variante="primario"
              desactivado={sinc.trabajando}
              alPulsar={() => void sincronizacion().pedir('sesion')}
              testID="reintentar-carga"
            />
            <Boton
              texto={t('usuario.cerrar')}
              alPulsar={() => void cuenta().cerrarSesion()}
              testID="cerrar-sesion-en-carga"
            />
          </>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[estilos.raiz, { backgroundColor: c.fondo }]}>
      {conSesion && listo && sinConexion ? (
        <Text
          accessibilityRole="alert"
          style={[estilos.banda, { backgroundColor: c.negativo }]}
          testID="banda-sin-conexion">
          {t('web.sinConexion')}
        </Text>
      ) : null}
      <View style={estilos.centrado}>
        {/* La app sigue montada, pero oculta y fuera del alcance del teclado, hasta que se entra. */}
        <View
          style={[ancho, dentro ? estilos.visible : estilos.oculto]}
          aria-hidden={!dentro}
          // @ts-expect-error `inert` existe en el navegador y React lo admite; los tipos de React Native no lo conocen.
          inert={dentro ? undefined : true}>
          {children}
        </View>
        {puerta ? <View style={[ancho, estilos.visible]}>{puerta}</View> : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  centrado: { flex: 1, alignItems: 'center' },
  visible: { flex: 1 },
  oculto: { display: 'none' },
  columna: { flex: 1 },
  centro: { alignItems: 'center', justifyContent: 'center', gap: Espacio.m, padding: Espacio.l },
  alCentro: { textAlign: 'center' },
  redondeada: { borderRadius: Radio.s },
  texto: { fontSize: Letra.secundario, lineHeight: 22 },
  destacado: { fontSize: Letra.cuerpo, fontWeight: '700' },
  nota: { fontSize: Letra.pequeno, lineHeight: 18 },
  enlaces: { flexDirection: 'row', flexWrap: 'wrap', gap: Espacio.m },
  enlace: { paddingVertical: Espacio.s, borderRadius: Radio.s },
  textoDeEnlace: { fontSize: Letra.secundario, fontWeight: '600', textDecorationLine: 'underline' },
  banda: {
    color: '#FFFFFF',
    fontSize: Letra.secundario,
    fontWeight: '600',
    textAlign: 'center',
    padding: Espacio.s,
  },
});
