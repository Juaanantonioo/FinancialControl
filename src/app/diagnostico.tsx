import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  autocomprobarCripto,
  medirDerivacion,
  type ResultadoDeAutocomprobacion,
} from '@/cripto/autocomprobacion';
import { t } from '@/i18n';
import { probarConexion, type ResultadoPrueba } from '@/lib/supabase';
import { Espacio, Letra, Radio, TactilMinimo, useColores } from '@/theme';

/**
 * Diagnóstico: comprueba que la app lee la tabla de prueba de Supabase
 * (criterio de T-008), que la biblioteca de cifrado da los resultados
 * esperados, y cuánto tarda este dispositivo en derivar una clave. No muestra
 * ninguna clave. Se abre desde Ajustes.
 */
export default function Diagnostico() {
  const c = useColores();
  const [resultado, setResultado] = useState<ResultadoPrueba | null>(null);
  const [cripto, setCripto] = useState<ResultadoDeAutocomprobacion | null>(null);
  // `undefined`: sin medir. `'midiendo'`. Un número: milisegundos. `null`: no se pudo.
  const [derivacion, setDerivacion] = useState<number | null | 'midiendo' | undefined>(undefined);

  const medir = () => {
    setDerivacion('midiendo');
    // Se cede un instante para que «Midiendo…» llegue a pintarse: el cálculo ocupa el hilo.
    setTimeout(() => {
      medirDerivacion().then(setDerivacion);
    }, 50);
  };

  const probar = () => {
    setResultado(null);
    probarConexion().then(setResultado);
  };

  // Primera comprobación al abrir la pantalla. El estado solo cambia cuando
  // llega la respuesta, nunca de forma síncrona dentro del efecto.
  useEffect(() => {
    let vigente = true;
    probarConexion().then((r) => {
      if (vigente) setResultado(r);
    });
    autocomprobarCripto().then((r) => {
      if (vigente) setCripto(r);
    });
    return () => {
      vigente = false;
    };
  }, []);

  let texto = t('diagnostico.supabaseProbando');
  let color = c.textoSecundario;
  if (resultado?.estado === 'sin_configurar') {
    texto = t('diagnostico.supabaseSinConfigurar');
    color = c.aviso;
  } else if (resultado?.estado === 'correcto') {
    texto = `✓ ${t('diagnostico.supabaseCorrecto', { filas: resultado.filas })}`;
    color = c.positivo;
  } else if (resultado?.estado === 'conectado') {
    texto = `✓ ${t('diagnostico.supabaseConectado')}`;
    color = c.positivo;
  } else if (resultado?.estado === 'sin_esquema') {
    texto = `⚠ ${t('diagnostico.supabaseSinEsquema')}`;
    color = c.aviso;
  } else if (resultado?.estado === 'sin_conexion') {
    texto = `⚠ ${t('diagnostico.supabaseSinConexion')}`;
    color = c.negativo;
  } else if (resultado?.estado === 'error') {
    texto = `⚠ ${t('diagnostico.supabaseError')}`;
    color = c.negativo;
  }

  return (
    <View style={[estilos.contenedor, { backgroundColor: c.fondo }]}>
      <Text style={[estilos.etiqueta, { color: c.texto }]}>{t('diagnostico.supabase')}</Text>
      <Text style={{ color }} testID="resultado-supabase">
        {texto}
      </Text>
      <Pressable
        onPress={probar}
        accessibilityRole="button"
        style={[estilos.boton, { backgroundColor: c.acento }]}>
        <Text style={{ color: c.sobreAcento, fontWeight: '600' }}>{t('diagnostico.probar')}</Text>
      </Pressable>

      <Text style={[estilos.etiqueta, estilos.seccion, { color: c.texto }]}>
        {t('diagnostico.cripto')}
      </Text>
      <Text
        style={{
          color: cripto === null ? c.textoSecundario : cripto.correcta ? c.positivo : c.negativo,
        }}
        testID="resultado-cripto">
        {cripto === null
          ? t('diagnostico.criptoProbando')
          : cripto.correcta
            ? `✓ ${t('diagnostico.criptoCorrecta')}`
            : `⚠ ${t('diagnostico.criptoIncorrecta')}`}
      </Text>

      <Text style={[estilos.etiqueta, estilos.seccion, { color: c.texto }]}>
        {t('diagnostico.derivacion')}
      </Text>
      <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno, lineHeight: 18 }}>
        {t('diagnostico.derivacionAyuda')}
      </Text>
      <Text style={{ color: c.texto }} testID="resultado-derivacion">
        {derivacion === undefined
          ? t('diagnostico.derivacionSinMedir')
          : derivacion === 'midiendo'
            ? t('diagnostico.derivacionMidiendo')
            : derivacion === null
              ? t('diagnostico.derivacionError')
              : t('diagnostico.derivacionResultado', { milisegundos: derivacion })}
      </Text>
      <Pressable
        onPress={medir}
        disabled={derivacion === 'midiendo'}
        accessibilityRole="button"
        testID="medir-derivacion"
        style={[estilos.boton, { backgroundColor: c.acento }]}>
        <Text style={{ color: c.sobreAcento, fontWeight: '600' }}>{t('diagnostico.medir')}</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, padding: Espacio.m, gap: Espacio.s },
  etiqueta: { fontSize: Letra.cuerpo, fontWeight: '600' },
  seccion: { marginTop: Espacio.l },
  boton: {
    minHeight: TactilMinimo,
    borderRadius: Radio.m,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Espacio.m,
  },
});
