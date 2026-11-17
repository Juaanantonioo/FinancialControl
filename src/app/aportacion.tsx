import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fila, PasoDeFecha, TextoDeError } from '@/componentes/basicos';
import { CabeceraDeFormulario, useOperacion } from '@/componentes/Formulario';
import { EstadoVacio } from '@/componentes/Tarjeta';
import { TecladoDeImporte } from '@/componentes/TecladoDeImporte';
import {
  centimosDelTeclado,
  dinero,
  formatearDinero,
  mostrarTeclado,
  pulsarTecla,
  simboloDeDivisa,
} from '@/dominio/dinero';
import { fechaLocal } from '@/dominio/modelo';
import { useConsulta, useDatos } from '@/estado/Datos';
import { formatoRegional } from '@/estado/formato';
import { t } from '@/i18n';
import { cifrasTabulares, Espacio, Letra, useColores } from '@/theme';

/**
 * «Aportar» a un objetivo: importe y fecha, con el teclado de importe. Es un
 * apunte: no crea ningún movimiento. Parámetro de la ruta: `objetivoId`.
 */
export default function PantallaDeAportacion() {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const formato = formatoRegional();
  const { objetivoId } = useLocalSearchParams<{ objetivoId?: string }>();
  const { repos } = useDatos();
  const { error, setError, ocupado, ejecutar } = useOperacion();
  const [texto, setTexto] = useState('');
  const [fecha, setFecha] = useState(fechaLocal());
  const objetivo = useConsulta(
    (r) => (objetivoId ? r.objetivos.obtener(objetivoId) : Promise.resolve(null)),
    [objetivoId],
  );
  const centimos = centimosDelTeclado(texto);

  if (objetivo === undefined) {
    return <View style={[estilos.pantalla, { backgroundColor: c.fondo }]} />;
  }
  if (!objetivo || objetivo.borradoEn !== null) {
    return (
      <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
        <CabeceraDeFormulario titulo={t('objetivos.aportar')} />
        <EstadoVacio texto={t('objetivos.noEncontrado')} testID="objetivo-no-encontrado" />
      </View>
    );
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraDeFormulario
        titulo={t('objetivos.tituloAportar', { nombre: objetivo.nombre })}
        alGuardar={() =>
          ejecutar(() =>
            repos.objetivos.aportar({ objetivoId: objetivo.id, fecha, importe: centimos }),
          )
        }
        desactivado={ocupado}
      />
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Text
          style={[estilos.importe, cifrasTabulares, { color: c.texto }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          testID="importe"
          accessibilityLabel={t('movimiento.importeLeido', {
            importe: formatearDinero(dinero(centimos, objetivo.divisa), formato),
          })}>
          {`${mostrarTeclado(texto, formato)} ${simboloDeDivisa(objetivo.divisa)}`}
        </Text>
        <Text style={[estilos.ayuda, { color: c.textoSecundario }]}>
          {t('objetivos.aportarAyuda')}
        </Text>
        <TextoDeError texto={error} />
        <Fila etiqueta={t('inversion.fecha')}>
          <PasoDeFecha fecha={fecha} alCambiar={setFecha} />
        </Fila>
      </ScrollView>
      <View style={{ paddingBottom: margen.bottom }}>
        <TecladoDeImporte
          formato={formato}
          alPulsar={(tecla) => {
            setError(null);
            setTexto((actual) => pulsarTecla(actual, tecla));
          }}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Espacio.m, paddingBottom: Espacio.l },
  importe: {
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: -1,
    textAlign: 'center',
    paddingVertical: Espacio.s,
  },
  ayuda: { fontSize: Letra.pequeno, textAlign: 'center', lineHeight: 18 },
});
