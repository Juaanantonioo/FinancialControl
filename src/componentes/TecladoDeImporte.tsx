import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FormatoRegional, TeclaDeImporte } from '@/dominio/dinero';
import { t } from '@/i18n';
import { cifrasTabulares, Radio, useColores } from '@/theme';

const FILAS: TeclaDeImporte[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['decimal', '0', 'borrar'],
];

/**
 * Teclado numérico propio de P07: teclas grandes y separador decimal según
 * la región (docs/03, apartado 8). Al ser propio está siempre visible y no
 * tapa el formulario como haría el teclado del sistema.
 */
export function TecladoDeImporte({
  formato,
  alPulsar,
}: {
  formato: FormatoRegional;
  alPulsar: (tecla: TeclaDeImporte) => void;
}) {
  const c = useColores();
  return (
    <View style={[estilos.teclado, { backgroundColor: c.superficie, borderTopColor: c.borde }]}>
      {FILAS.map((fila, i) => (
        <View key={i} style={estilos.fila}>
          {fila.map((tecla) => {
            const texto =
              tecla === 'decimal' ? formato.separadorDecimal : tecla === 'borrar' ? '⌫' : tecla;
            const etiqueta =
              tecla === 'decimal'
                ? t('movimiento.teclaDecimal')
                : tecla === 'borrar'
                  ? t('movimiento.teclaBorrar')
                  : tecla;
            return (
              <Pressable
                key={tecla}
                onPress={() => alPulsar(tecla)}
                accessibilityRole="button"
                accessibilityLabel={etiqueta}
                testID={`tecla-${tecla}`}
                style={({ pressed }) => [
                  estilos.tecla,
                  { backgroundColor: pressed ? c.superficieSuave : c.transparente },
                ]}>
                <Text style={[estilos.texto, cifrasTabulares, { color: c.texto }]}>{texto}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  teclado: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
  fila: { flexDirection: 'row' },
  tecla: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radio.m,
  },
  texto: { fontSize: 26, fontWeight: '500' },
});
