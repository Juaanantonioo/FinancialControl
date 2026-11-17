import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { probarConexion, type ResultadoPrueba } from '@/lib/supabase';
import { Espacio, Letra, Radio, TactilMinimo, useColores } from '@/theme';

/**
 * Diagnóstico: comprueba que la app lee la tabla de prueba de Supabase
 * (criterio de T-008). Se abre desde Ajustes.
 */
export default function Diagnostico() {
  const c = useColores();
  const [resultado, setResultado] = useState<ResultadoPrueba | null>(null);

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
    texto = t('diagnostico.supabaseCorrecto', { filas: resultado.filas });
    color = c.positivo;
  } else if (resultado?.estado === 'error') {
    texto = t('diagnostico.supabaseError', { mensaje: resultado.mensaje });
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
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { flex: 1, padding: Espacio.m, gap: Espacio.s },
  etiqueta: { fontSize: Letra.cuerpo, fontWeight: '600' },
  boton: {
    minHeight: TactilMinimo,
    borderRadius: Radio.m,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Espacio.m,
  },
});
