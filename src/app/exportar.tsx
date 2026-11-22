import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton, CabeceraConVuelta, TextoDeError } from '@/componentes/basicos';
import { Tarjeta } from '@/componentes/Tarjeta';
import { useAviso } from '@/estado/Aviso';
import { exportacion } from '@/estado/exportacionDeLaApp';
import type { ResultadoDeExportar } from '@/exportacion/exportador';
import { t, type ClaveTexto } from '@/i18n';
import { Espacio, Letra, Radio, useColores } from '@/theme';

const TEXTO_DE: Record<Exclude<ResultadoDeExportar, 'compartido'>, ClaveTexto> = {
  descartado: 'exportar.descartado',
  no_autenticado: 'exportar.noAutenticado',
  no_disponible: 'exportar.noDisponible',
  error: 'exportar.error',
};

/**
 * Ajustes › Exportar mis datos (RGPD). Un JSON con todo y un CSV de
 * movimientos, entregados con la hoja de compartir. Funciona con cuenta y sin
 * ella: lee solo la base de este dispositivo. Avisa de que el fichero no va
 * cifrado, y pide autenticación antes si el bloqueo de la app está activo.
 */
export default function Exportar() {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const mostrarAviso = useAviso();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportar(que: 'todo' | 'movimientos') {
    setError(null);
    setOcupado(true);
    let resultado: ResultadoDeExportar = 'error';
    try {
      resultado = que === 'todo' ? await exportacion().todo() : await exportacion().movimientos();
    } catch {
      // Se queda en «error»: nunca se enseña el motivo interno.
    }
    setOcupado(false);
    if (resultado === 'compartido') mostrarAviso({ texto: t('exportar.hecho') });
    else if (resultado === 'descartado') mostrarAviso({ texto: t('exportar.descartado') });
    else setError(t(TEXTO_DE[resultado]));
  }

  const nota = [estilos.nota, { color: c.textoSecundario }];
  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraConVuelta titulo={t('exportar.titulo')} />
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingBottom: margen.bottom + Espacio.xl }]}>
        <Tarjeta testID="exportar-explicacion">
          <Text maxFontSizeMultiplier={1.6} style={[estilos.texto, { color: c.texto }]}>
            {t('exportar.texto')}
          </Text>
          <View
            style={[estilos.aviso, { backgroundColor: c.fondo, borderColor: c.borde }]}
            testID="aviso-sin-cifrar">
            <Text maxFontSizeMultiplier={1.6} style={[estilos.etiqueta, { color: c.texto }]}>
              {`⚠ ${t('exportar.avisoTitulo')}`}
            </Text>
            <Text maxFontSizeMultiplier={1.6} style={nota}>
              {t('exportar.avisoTexto')}
            </Text>
          </View>
        </Tarjeta>
        <Tarjeta testID="exportar-acciones">
          <TextoDeError texto={error} />
          {ocupado ? (
            <View style={estilos.trabajando} testID="exportando">
              <ActivityIndicator color={c.acento} />
            </View>
          ) : null}
          <Boton
            texto={t('exportar.todo')}
            variante="primario"
            desactivado={ocupado}
            alPulsar={() => void exportar('todo')}
            testID="exportar-todo"
          />
          <Text maxFontSizeMultiplier={1.6} style={nota}>
            {t('exportar.todoAyuda')}
          </Text>
          <Boton
            texto={t('exportar.movimientos')}
            desactivado={ocupado}
            alPulsar={() => void exportar('movimientos')}
            testID="exportar-movimientos"
          />
          <Text maxFontSizeMultiplier={1.6} style={nota}>
            {t('exportar.movimientosAyuda')}
          </Text>
        </Tarjeta>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Espacio.m, gap: Espacio.m },
  texto: { fontSize: Letra.secundario, lineHeight: 22 },
  nota: { fontSize: Letra.pequeno, lineHeight: 18 },
  etiqueta: { fontSize: Letra.secundario, fontWeight: '600' },
  aviso: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radio.s,
    padding: Espacio.s,
    gap: Espacio.xs,
  },
  trabajando: { flexDirection: 'row', alignItems: 'center', gap: Espacio.s },
});
