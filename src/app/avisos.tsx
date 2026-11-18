import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton, CabeceraConVuelta } from '@/componentes/basicos';
import { Tarjeta } from '@/componentes/Tarjeta';
import { SIN_AVISOS, TIPOS_DE_AVISO, type Preferencias, type TipoDeAviso } from '@/dominio/avisos';
import { recalcularAvisos } from '@/estado/avisos';
import { useDatos } from '@/estado/Datos';
import { useSeguridad } from '@/estado/seguridad';
import { t, type ClaveTexto } from '@/i18n';
import { notificador, type EstadoDelPermiso } from '@/lib/notificaciones';
import { guardarPreferencias, leerPreferencias } from '@/lib/preferencias';
import { Espacio, Letra, TactilMinimo, useColores } from '@/theme';

/** Instante actual. Fuera del componente: leer el reloj no forma parte del pintado. */
function ahora(): number {
  return Date.now();
}

/**
 * Avisos: un interruptor por tipo. El permiso del sistema se pide al activar
 * el primero, nunca al arrancar la app. Si está denegado, la pantalla lo
 * explica y lleva a los Ajustes del iPhone.
 */
export default function PantallaDeAvisos() {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const { repos } = useDatos();
  const { privado } = useSeguridad();
  const [preferencias, setPreferencias] = useState<Preferencias | null>(null);
  const [permiso, setPermiso] = useState<EstadoDelPermiso | null>(null);
  const [programados, setProgramados] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    Promise.all([leerPreferencias(), notificador.permiso()]).then(
      ([leidas, estado]) => {
        if (!vigente) return;
        setPreferencias(leidas);
        setPermiso(estado);
      },
      () => {
        if (!vigente) return;
        setPreferencias({ ...SIN_AVISOS });
        setPermiso('sin_decidir');
      },
    );
    return () => {
      vigente = false;
    };
  }, []);

  async function cambiar(tipo: TipoDeAviso, activo: boolean) {
    if (!preferencias) return;
    setMensaje(null);
    let estado = permiso;
    if (activo && estado !== 'concedido') {
      // Solo aquí, porque la persona lo ha pedido, se muestra el diálogo del sistema.
      estado = await notificador.pedirPermiso();
      setPermiso(estado);
      if (estado !== 'concedido') {
        setMensaje(t('avisos.permisoRechazado'));
        return;
      }
    }
    const nuevas = { ...preferencias, [tipo]: activo };
    setPreferencias(nuevas);
    await guardarPreferencias(nuevas);
    setProgramados(await recalcularAvisos(repos, notificador, nuevas, ahora(), privado));
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraConVuelta titulo={t('avisos.titulo')} />
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingBottom: margen.bottom + Espacio.xl }]}>
        <Text style={[estilos.texto, { color: c.textoSecundario }]}>{t('avisos.intro')}</Text>

        {permiso === 'denegado' ? (
          <Tarjeta testID="permiso-denegado">
            <Text style={[estilos.texto, { color: c.aviso, fontWeight: '600' }]}>
              {`⚠ ${t('avisos.denegado')}`}
            </Text>
            <Boton
              texto={t('avisos.abrirAjustes')}
              variante="primario"
              alPulsar={() => {
                Linking.openSettings().catch(() => undefined);
              }}
              testID="abrir-ajustes"
            />
          </Tarjeta>
        ) : null}
        {permiso === 'sin_decidir' ? (
          <Text style={[estilos.nota, { color: c.textoSecundario }]} testID="permiso-sin-decidir">
            {t('avisos.sinDecidir')}
          </Text>
        ) : null}
        {mensaje ? (
          <Text
            style={[estilos.nota, { color: c.negativo }]}
            accessibilityRole="alert"
            testID="mensaje-de-avisos">
            {`⚠ ${mensaje}`}
          </Text>
        ) : null}

        <Tarjeta testID="interruptores">
          {TIPOS_DE_AVISO.map((tipo, i) => (
            <View
              key={tipo}
              style={[
                estilos.fila,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borde },
              ]}>
              <View style={estilos.textos}>
                <Text style={[estilos.nombre, { color: c.texto }]}>
                  {t(`avisos.tipo_${tipo}` as ClaveTexto)}
                </Text>
                <Text style={[estilos.nota, { color: c.textoSecundario }]}>
                  {t(`avisos.ayuda_${tipo}` as ClaveTexto)}
                </Text>
              </View>
              <Switch
                value={preferencias?.[tipo] ?? false}
                disabled={preferencias === null}
                onValueChange={(activo) => {
                  cambiar(tipo, activo).catch(() => undefined);
                }}
                accessibilityLabel={t(`avisos.tipo_${tipo}` as ClaveTexto)}
                testID={`aviso-${tipo}`}
                trackColor={{ true: c.acento, false: c.borde }}
              />
            </View>
          ))}
        </Tarjeta>
        {programados !== null ? (
          <Text style={[estilos.nota, { color: c.textoSecundario }]} testID="avisos-programados">
            {t('avisos.programados', { total: programados })}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Espacio.m, gap: Espacio.m },
  texto: { fontSize: Letra.secundario, lineHeight: 22 },
  nota: { fontSize: Letra.pequeno, lineHeight: 18 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.m,
    paddingVertical: Espacio.s,
    gap: Espacio.m,
  },
  textos: { flex: 1, gap: 2 },
  nombre: { fontSize: Letra.cuerpo, fontWeight: '600' },
});
