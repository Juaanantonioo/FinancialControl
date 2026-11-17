/**
 * Piezas comunes de las pantallas de formulario que se abren como hoja:
 * la cabecera con Cancelar y Guardar y el control de una operación que no
 * debe ejecutarse dos veces.
 */
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/componentes/basicos';
import { textoDeError, useDatos } from '@/estado/Datos';
import { t } from '@/i18n';
import { Espacio, Letra, useColores } from '@/theme';

export function CabeceraDeFormulario({
  titulo,
  alGuardar,
  desactivado = false,
  textoDeGuardar,
}: {
  titulo: string;
  /** Sin esta función no se muestra el botón de guardar. */
  alGuardar?: () => void;
  desactivado?: boolean;
  textoDeGuardar?: string;
}) {
  const c = useColores();
  return (
    <View style={[estilos.cabecera, { borderBottomColor: c.borde }]}>
      <Boton texto={t('comun.cancelar')} alPulsar={() => router.back()} testID="cancelar" />
      <Text
        style={[estilos.titulo, { color: c.texto }]}
        accessibilityRole="header"
        numberOfLines={2}
        maxFontSizeMultiplier={1.4}>
        {titulo}
      </Text>
      {alGuardar ? (
        <Boton
          texto={textoDeGuardar ?? t('comun.guardar')}
          alPulsar={alGuardar}
          desactivado={desactivado}
          testID="guardar"
        />
      ) : (
        <View style={estilos.hueco} />
      )}
    </View>
  );
}

/**
 * Ejecuta operaciones de escritura evitando dobles pulsaciones. Si la
 * operación termina bien, refresca los datos y cierra la pantalla; si
 * falla, deja el texto del error en `error`.
 */
export function useOperacion() {
  const { notificarCambio } = useDatos();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Una referencia cambia al instante, sin esperar a que la pantalla se repinte.
  const cerrojo = useRef(false);

  async function ejecutar(operacion: () => Promise<unknown>, alTerminar?: () => void) {
    if (cerrojo.current) return;
    cerrojo.current = true;
    setOcupado(true);
    setError(null);
    try {
      await operacion();
      notificarCambio();
      if (alTerminar) alTerminar();
      else router.back();
    } catch (e) {
      setError(textoDeError(e));
      cerrojo.current = false;
      setOcupado(false);
    }
  }

  return { error, setError, ocupado, ejecutar };
}

const estilos = StyleSheet.create({
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Espacio.s,
    paddingBottom: Espacio.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titulo: { fontSize: Letra.cuerpo, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  hueco: { minWidth: 72 },
});
