import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CabeceraConVuelta, Segmentos, TextoDeError } from '@/componentes/basicos';
import { Tarjeta } from '@/componentes/Tarjeta';
import { ESPERAS, type Capacidad } from '@/dominio/bloqueo';
import {
  cambiarBloqueo,
  cambiarModoPrivado,
  capacidadDelDispositivo,
  elegirEspera,
  useSeguridad,
} from '@/estado/seguridad';
import { t } from '@/i18n';
import { Espacio, Letra, TactilMinimo, useColores } from '@/theme';

/**
 * Ajustes › Seguridad: el bloqueo de la app y el modo privado. Los dos
 * vienen desactivados.
 */
export default function Seguridad() {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const s = useSeguridad();
  const [capacidad, setCapacidad] = useState<Capacidad | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    capacidadDelDispositivo().then((leida) => {
      if (vigente) setCapacidad(leida);
    });
    return () => {
      vigente = false;
    };
  }, [s.bloqueo.activo]);

  // Sin código ni biometría no se puede activar. Sí desactivar, si estaba puesto.
  const sinMedios = capacidad === 'ninguna';
  const interruptorDesactivado =
    capacidad === null || s.autenticando || (sinMedios && !s.bloqueo.activo);

  async function alCambiarBloqueo(activo: boolean) {
    setAviso(null);
    const resultado = await cambiarBloqueo(activo);
    if (resultado === 'no_disponible') setCapacidad(await capacidadDelDispositivo());
    else if (resultado === 'fallido') setAviso(t('seguridad.bloqueoNoCambiado'));
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraConVuelta titulo={t('seguridad.titulo')} />
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingBottom: margen.bottom + Espacio.xl }]}>
        <Tarjeta titulo={t('seguridad.bloqueo')} testID="seguridad-bloqueo">
          <View style={estilos.fila}>
            <Text maxFontSizeMultiplier={1.6} style={[estilos.nombre, { color: c.texto }]}>
              {t('seguridad.bloqueoInterruptor')}
            </Text>
            <Switch
              value={s.bloqueo.activo}
              disabled={interruptorDesactivado}
              onValueChange={(activo) => {
                alCambiarBloqueo(activo).catch(() => undefined);
              }}
              accessibilityLabel={t('seguridad.bloqueoInterruptor')}
              accessibilityState={{ disabled: interruptorDesactivado, checked: s.bloqueo.activo }}
              testID="interruptor-bloqueo"
              trackColor={{ true: c.acento, false: c.borde }}
            />
          </View>
          <Text maxFontSizeMultiplier={1.6} style={[estilos.nota, { color: c.textoSecundario }]}>
            {t('seguridad.bloqueoAyuda')}
          </Text>
          {sinMedios ? (
            <Text
              maxFontSizeMultiplier={1.6}
              style={[estilos.nota, { color: c.texto }]}
              testID="bloqueo-no-disponible">
              {s.bloqueo.activo
                ? t('seguridad.bloqueoSinProteccion')
                : t('seguridad.bloqueoNoDisponible')}
            </Text>
          ) : null}
          <TextoDeError texto={aviso} />
          {s.bloqueo.activo ? (
            <View style={estilos.espera} testID="seguridad-espera">
              <Text maxFontSizeMultiplier={1.6} style={[estilos.nombre, { color: c.texto }]}>
                {t('seguridad.espera')}
              </Text>
              <Segmentos
                opciones={ESPERAS.map((valor) => ({
                  valor,
                  texto: t(`seguridad.espera_${valor}`),
                }))}
                valor={s.bloqueo.espera}
                alCambiar={(espera) => {
                  elegirEspera(espera).catch(() => undefined);
                }}
              />
              <Text
                maxFontSizeMultiplier={1.6}
                style={[estilos.nota, { color: c.textoSecundario }]}
                testID="ayuda-de-espera">
                {t(`seguridad.esperaAyuda_${s.bloqueo.espera}`)} {t('seguridad.esperaNota')}
              </Text>
            </View>
          ) : null}
        </Tarjeta>

        <Tarjeta titulo={t('seguridad.privado')} testID="seguridad-privado">
          <View style={estilos.fila}>
            <Text maxFontSizeMultiplier={1.6} style={[estilos.nombre, { color: c.texto }]}>
              {t('seguridad.privadoInterruptor')}
            </Text>
            <Switch
              value={s.privado}
              onValueChange={(activo) => {
                cambiarModoPrivado(activo).catch(() => undefined);
              }}
              accessibilityLabel={t('seguridad.privadoInterruptor')}
              accessibilityState={{ checked: s.privado }}
              testID="interruptor-privado"
              trackColor={{ true: c.acento, false: c.borde }}
            />
          </View>
          <Text maxFontSizeMultiplier={1.6} style={[estilos.nota, { color: c.textoSecundario }]}>
            {t('seguridad.privadoAyuda')}
          </Text>
          <Text maxFontSizeMultiplier={1.6} style={[estilos.nota, { color: c.textoSecundario }]}>
            {t('seguridad.privadoNota')}
          </Text>
        </Tarjeta>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Espacio.m, gap: Espacio.m },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo,
    gap: Espacio.s,
  },
  nombre: { flex: 1, fontSize: Letra.cuerpo, fontWeight: '600' },
  nota: { fontSize: Letra.pequeno, lineHeight: 18 },
  espera: { gap: Espacio.s, marginTop: Espacio.s },
});
