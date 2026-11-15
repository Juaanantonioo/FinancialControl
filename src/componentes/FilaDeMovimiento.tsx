import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MovimientoListado } from '@/datos/movimientos';
import { dinero, formatearDinero } from '@/dominio/dinero';
import { formatoRegional } from '@/estado/formato';
import { t, type ClaveTexto } from '@/i18n';
import { Espacio, TactilMinimo, useColores } from '@/theme';

/** Nombre que se muestra: el propio, o el comercio, o la categoría, o el tipo. */
export function nombreVisible(mov: MovimientoListado): string {
  return (
    mov.nombre ||
    mov.comercio ||
    mov.categoriaNombre ||
    t(`tipoDeMovimiento.${mov.tipo}` as ClaveTexto)
  );
}

/**
 * Importe con signo. El signo y el texto del tipo acompañan siempre al
 * color: el color nunca es el único indicador (docs/03, apartado 8).
 */
export function importeConSigno(mov: MovimientoListado): string {
  const texto = formatearDinero(dinero(Math.abs(mov.importe), mov.divisa), formatoRegional());
  if (mov.tipo === 'gasto') return `-${texto}`;
  if (mov.tipo === 'ingreso') return `+${texto}`;
  if (mov.tipo === 'ajuste') return `${mov.importe < 0 ? '-' : '+'}${texto}`;
  return texto;
}

export function FilaDeMovimiento({
  mov,
  alPulsar,
}: {
  mov: MovimientoListado;
  alPulsar: () => void;
}) {
  const c = useColores();
  const importe = formatearDinero(dinero(Math.abs(mov.importe), mov.divisa), formatoRegional());
  const detalle =
    mov.tipo === 'transferencia'
      ? t('movimientos.transferenciaEntre', {
          origen: mov.cuentaNombre,
          destino: mov.cuentaDestinoNombre ?? '',
        })
      : [
          mov.categoriaNombre ?? t(`tipoDeMovimiento.${mov.tipo}` as ClaveTexto),
          mov.cuentaNombre,
        ].join(' · ');
  const color =
    mov.tipo === 'ingreso' || (mov.tipo === 'ajuste' && mov.importe > 0)
      ? c.positivo
      : mov.tipo === 'transferencia'
        ? c.texto
        : c.negativo;
  return (
    <Pressable
      onPress={alPulsar}
      accessibilityRole="button"
      accessibilityLabel={`${nombreVisible(mov)}. ${t(`movimientos.${mov.tipo}De` as ClaveTexto, { importe })}. ${detalle}`}
      testID={`movimiento-${mov.id}`}
      style={({ pressed }) => [
        estilos.fila,
        { backgroundColor: c.superficie, borderBottomColor: c.borde, opacity: pressed ? 0.6 : 1 },
      ]}>
      <View style={estilos.textos}>
        <Text style={[estilos.nombre, { color: c.texto }]}>{nombreVisible(mov)}</Text>
        <Text style={{ color: c.textoSecundario, fontSize: 14 }}>{detalle}</Text>
      </View>
      <Text style={[estilos.importe, { color }]}>{importeConSigno(mov)}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.m,
    paddingHorizontal: Espacio.m,
    paddingVertical: Espacio.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Espacio.s,
  },
  textos: { flex: 1 },
  nombre: { fontSize: 17 },
  // El importe no se trunca nunca: la fila crece en vertical si hace falta.
  importe: { fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
