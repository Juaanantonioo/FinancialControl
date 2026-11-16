import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MovimientoListado } from '@/datos/movimientos';
import { dinero, formatearDinero } from '@/dominio/dinero';
import { formatoRegional } from '@/estado/formato';
import { t, type ClaveTexto } from '@/i18n';
import { DistintivoDeCategoria } from '@/componentes/Tarjeta';
import type { Aspecto } from '@/estado/aspecto';
import {
  cifrasTabulares,
  Espacio,
  Letra,
  Radio,
  sombraDeTarjeta,
  TactilMinimo,
  useColores,
} from '@/theme';

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
  aspecto,
  alPulsar,
}: {
  mov: MovimientoListado;
  /** Color e icono de la categoría del movimiento. */
  aspecto: Aspecto;
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
  // Un gasto normal va en el color del texto, con su signo menos. El verde
  // queda para lo que entra y el rojo no se usa aquí: se reserva para
  // balances negativos y errores.
  const color =
    mov.tipo === 'ingreso' || (mov.tipo === 'ajuste' && mov.importe > 0)
      ? c.positivo
      : mov.tipo === 'transferencia'
        ? c.textoSecundario
        : c.texto;
  return (
    <Pressable
      onPress={alPulsar}
      accessibilityRole="button"
      accessibilityLabel={`${nombreVisible(mov)}. ${t(`movimientos.${mov.tipo}De` as ClaveTexto, { importe })}. ${detalle}`}
      testID={`movimiento-${mov.id}`}
      style={({ pressed }) => [
        estilos.fila,
        sombraDeTarjeta(c),
        { backgroundColor: c.superficie, opacity: pressed ? 0.6 : 1 },
      ]}>
      <DistintivoDeCategoria aspecto={aspecto} />
      <View style={estilos.textos}>
        <Text style={[estilos.nombre, { color: c.texto }]}>{nombreVisible(mov)}</Text>
        <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>{detalle}</Text>
      </View>
      <Text
        style={[estilos.importe, cifrasTabulares, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}>
        {importeConSigno(mov)}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.m,
    marginHorizontal: Espacio.m,
    marginBottom: Espacio.s,
    paddingHorizontal: Espacio.m,
    paddingVertical: Espacio.s + 2,
    borderRadius: Radio.m,
    columnGap: Espacio.m,
    rowGap: Espacio.xs,
    // Con letra muy grande el importe baja a su propia línea en vez de
    // aplastar el nombre.
    flexWrap: 'wrap',
  },
  textos: { flexGrow: 1, flexShrink: 1, flexBasis: 120, gap: 2 },
  nombre: { fontSize: Letra.cuerpo, fontWeight: '500' },
  // El importe no se trunca nunca: se va a la derecha y, si no cabe entero,
  // reduce su letra antes que cortar cifras.
  importe: { fontSize: Letra.cuerpo, fontWeight: '700', marginLeft: 'auto', maxWidth: '100%' },
});
