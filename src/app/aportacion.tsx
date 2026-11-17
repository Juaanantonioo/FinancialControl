import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fila, PasoDeFecha, Segmentos, Selector, TextoDeError } from '@/componentes/basicos';
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
 * «Aportar» a un objetivo: importe y fecha, con el teclado de importe.
 * Hay dos caminos:
 *  - «Mover dinero» crea una transferencia entre dos cuentas, marcada con el
 *    objetivo, y la aportación enlazada a ella.
 *  - «Solo anotar» guarda la aportación como apunte, sin movimiento.
 * Parámetro de la ruta: `objetivoId`.
 */
type Modo = 'mover' | 'anotar';

export default function PantallaDeAportacion() {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const formato = formatoRegional();
  const { objetivoId } = useLocalSearchParams<{ objetivoId?: string }>();
  const { repos } = useDatos();
  const { error, setError, ocupado, ejecutar } = useOperacion();
  const [texto, setTexto] = useState('');
  const [fecha, setFecha] = useState(fechaLocal());
  const [modoElegido, setModoElegido] = useState<Modo | null>(null);
  const [origenElegido, setOrigenElegido] = useState<string | null>(null);
  const [destinoElegido, setDestinoElegido] = useState<string | null>(null);
  const cuentas = useConsulta((r) => r.cuentas.listar());
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

  // Solo se puede mover dinero entre cuentas de la divisa del objetivo.
  const elegibles = (cuentas ?? []).filter((x) => x.divisa === objetivo.divisa);
  const sePuedeMover = elegibles.length >= 2;
  const modo: Modo = sePuedeMover ? (modoElegido ?? 'mover') : 'anotar';
  // Destino por defecto: la cuenta del objetivo. Origen: la primera que no sea el destino.
  const destinoId = destinoElegido ?? elegibles.find((x) => x.id === objetivo.cuentaId)?.id ?? null;
  const origenId = origenElegido ?? elegibles.find((x) => x.id !== destinoId)?.id ?? null;
  const opciones = elegibles.map((x) => ({
    valor: x.id,
    texto: x.nombre,
    detalle: t(`tipoDeCuenta.${x.tipo}`),
  }));

  function guardar() {
    if (modo === 'anotar') {
      ejecutar(() =>
        repos.objetivos.aportar({ objetivoId: objetivo!.id, fecha, importe: centimos }),
      );
      return;
    }
    if (!origenId || !destinoId) {
      setError(t('errores.cuenta_destino_obligatoria'));
      return;
    }
    ejecutar(() =>
      repos.objetivos.moverDinero({
        objetivoId: objetivo!.id,
        fecha,
        importe: centimos,
        cuentaId: origenId,
        cuentaDestinoId: destinoId,
      }),
    );
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraDeFormulario
        titulo={t('objetivos.tituloAportar', { nombre: objetivo.nombre })}
        alGuardar={guardar}
        desactivado={ocupado || cuentas === undefined}
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
        {sePuedeMover ? (
          <Segmentos
            opciones={[
              { valor: 'mover', texto: t('objetivos.moverDinero') },
              { valor: 'anotar', texto: t('objetivos.soloAnotar') },
            ]}
            valor={modo}
            alCambiar={(nuevo: Modo) => {
              setModoElegido(nuevo);
              setError(null);
            }}
          />
        ) : null}
        <Text style={[estilos.ayuda, { color: c.textoSecundario }]} testID="ayuda-de-aportar">
          {modo === 'mover'
            ? t('objetivos.moverAyuda')
            : cuentas !== undefined && !sePuedeMover
              ? t('objetivos.faltaOtraCuenta')
              : t('objetivos.aportarAyuda')}
        </Text>
        <TextoDeError texto={error} />
        {modo === 'mover' ? (
          <>
            <Fila etiqueta={t('objetivos.desde')}>
              <Selector
                titulo={t('objetivos.desde')}
                opciones={opciones}
                valor={origenId}
                alElegir={setOrigenElegido}
                textoVacio={t('objetivos.elegirCuenta')}
                testID="selector-origen"
              />
            </Fila>
            <Fila etiqueta={t('objetivos.hacia')}>
              <Selector
                titulo={t('objetivos.hacia')}
                opciones={opciones}
                valor={destinoId}
                alElegir={setDestinoElegido}
                textoVacio={t('objetivos.elegirCuenta')}
                testID="selector-destino"
              />
            </Fila>
          </>
        ) : null}
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
  ayuda: {
    fontSize: Letra.pequeno,
    textAlign: 'center',
    lineHeight: 18,
    paddingVertical: Espacio.s,
  },
});
