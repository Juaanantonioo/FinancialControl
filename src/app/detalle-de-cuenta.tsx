import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton } from '@/componentes/basicos';
import { FilaDeMovimiento } from '@/componentes/FilaDeMovimiento';
import { Dato, EstadoVacio, SelectorDeMes, Tarjeta } from '@/componentes/Tarjeta';
import { esMesValido, mesDe, moverMes, resumenDeCuenta } from '@/dominio/resumen';
import { aspectoDeMovimiento } from '@/estado/aspecto';
import { useConsulta } from '@/estado/Datos';
import { describirMes, fechaLarga } from '@/estado/fechas';
import { conSigno, importe } from '@/estado/formato';
import { t } from '@/i18n';
import { cifrasTabulares, Espacio, Letra, TactilMinimo, useColores, usePaleta } from '@/theme';

/**
 * P10 · Detalle de cuenta: saldo actual, resumen del mes y movimientos de
 * esa cuenta en ese mes. La evolución del saldo y el cuadre de docs/03
 * quedan para sus hitos.
 *
 * Parámetros de la ruta: `id` de la cuenta y, opcional, `mes` ("AAAA-MM").
 */
export default function DetalleDeCuenta() {
  const c = useColores();
  const paleta = usePaleta();
  const margen = useSafeAreaInsets();
  const { id, mes: mesPedido } = useLocalSearchParams<{ id?: string; mes?: string }>();
  const [mes, setMes] = useState(mesPedido && esMesValido(mesPedido) ? mesPedido : mesDe());

  const cuenta = useConsulta((r) => (id ? r.cuentas.obtener(id) : Promise.resolve(null)), [id]);
  // Todos los movimientos de la cuenta: el saldo actual depende de todos, no solo del mes.
  const movimientos = useConsulta(
    (r) => (id ? r.movimientos.listar({ cuentaId: id }) : Promise.resolve([])),
    [id],
  );
  const categorias = useConsulta((r) => r.categorias.listar({ incluirArchivadas: true }));

  const noExiste = cuenta === null || (cuenta !== undefined && cuenta.borradoEn !== null);
  const cabecera = (
    <View
      style={[estilos.cabecera, { paddingTop: margen.top + Espacio.xs, backgroundColor: c.fondo }]}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t('comun.volver')}
        testID="volver"
        style={estilos.volver}>
        <Text allowFontScaling={false} style={{ color: c.acento, fontSize: 30, lineHeight: 34 }}>
          ‹
        </Text>
      </Pressable>
      <Text
        style={[estilos.titulo, { color: c.texto }]}
        numberOfLines={2}
        maxFontSizeMultiplier={1.4}
        accessibilityRole="header"
        testID="titulo-de-cuenta">
        {cuenta && !noExiste ? cuenta.nombre : ''}
      </Text>
      {cuenta && !noExiste ? (
        <Boton
          texto={t('detalleDeCuenta.editar')}
          alPulsar={() => router.push({ pathname: '/cuenta', params: { id: cuenta.id } })}
          testID="editar-cuenta"
        />
      ) : (
        <View style={estilos.volver} />
      )}
    </View>
  );

  if (noExiste || !cuenta || !movimientos) {
    return (
      <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
        {cabecera}
        {noExiste ? (
          <EstadoVacio texto={t('detalleDeCuenta.noEncontrada')} testID="cuenta-no-encontrada" />
        ) : null}
      </View>
    );
  }

  const resumen = resumenDeCuenta(cuenta, movimientos, mes);
  const delMes = movimientos.filter((m) => m.fecha.slice(0, 7) === mes);
  const hayAnteriores = delMes.some((m) => m.fecha < cuenta.fechaSaldoInicial);
  const { divisa } = cuenta;

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      {cabecera}
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingBottom: margen.bottom + 96 }]}>
        <Tarjeta>
          <View
            accessible
            accessibilityLabel={t('detalleDeCuenta.resumenLeido', {
              saldo: importe(resumen.saldo, divisa),
              mes: describirMes(mes),
              entradas: importe(resumen.entradas, divisa),
              salidas: importe(resumen.salidas, divisa),
              variacion: conSigno(resumen.variacion, divisa),
            })}>
            <Text style={{ color: c.textoSecundario, fontSize: Letra.secundario }}>
              {`${t('detalleDeCuenta.saldoActual')} · ${t(`tipoDeCuenta.${cuenta.tipo}`)}${
                cuenta.archivada ? ` · ${t('inicio.archivada')}` : ''
              }`}
            </Text>
            <Text
              style={[
                estilos.saldo,
                cifrasTabulares,
                { color: resumen.saldo < 0 ? c.negativo : c.texto },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              maxFontSizeMultiplier={1.6}
              testID="saldo-actual">
              {importe(resumen.saldo, divisa)}
            </Text>
          </View>
          <SelectorDeMes mes={mes} alCambiar={(salto) => setMes(moverMes(mes, salto))} />
          <View style={estilos.datos}>
            <Dato
              etiqueta={t('detalleDeCuenta.entradas')}
              valor={conSigno(resumen.entradas, divisa)}
              color={resumen.entradas > 0 ? c.positivo : c.texto}
              testID="entradas"
            />
            <Dato
              etiqueta={t('detalleDeCuenta.salidas')}
              valor={conSigno(-resumen.salidas, divisa)}
              testID="salidas"
            />
            <Dato
              etiqueta={t('detalleDeCuenta.cambio')}
              valor={conSigno(resumen.variacion, divisa)}
              color={
                resumen.variacion > 0 ? c.positivo : resumen.variacion < 0 ? c.negativo : c.texto
              }
              testID="variacion"
            />
          </View>
        </Tarjeta>

        <Text style={[estilos.seccion, { color: c.textoSecundario }]} accessibilityRole="header">
          {t('detalleDeCuenta.movimientosDelMes')}
        </Text>
        {hayAnteriores ? (
          <Text style={[estilos.nota, { color: c.textoSecundario }]} testID="nota-anteriores">
            {t('detalleDeCuenta.anteriores', { fecha: fechaLarga(cuenta.fechaSaldoInicial) })}
          </Text>
        ) : null}
        {delMes.length === 0 ? (
          <EstadoVacio
            texto={t('detalleDeCuenta.vacio', { mes: describirMes(mes) })}
            testID="cuenta-sin-movimientos"
          />
        ) : (
          <View style={estilos.lista}>
            {delMes.map((mov) => (
              <FilaDeMovimiento
                key={mov.id}
                mov={mov}
                aspecto={aspectoDeMovimiento(mov, categorias ?? [], paleta)}
                alPulsar={() => router.push({ pathname: '/movimiento', params: { id: mov.id } })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Espacio.xs,
    paddingBottom: Espacio.xs,
    gap: Espacio.xs,
  },
  volver: {
    minWidth: TactilMinimo,
    minHeight: TactilMinimo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { flex: 1, fontSize: Letra.subtitulo, fontWeight: '700', textAlign: 'center' },
  contenido: { padding: Espacio.m, gap: Espacio.s },
  saldo: { fontSize: Letra.cifraGrande, fontWeight: '800', letterSpacing: -1 },
  datos: { flexDirection: 'row', gap: Espacio.s, paddingTop: Espacio.xs },
  seccion: {
    fontSize: Letra.pequeno,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingTop: Espacio.m,
    paddingHorizontal: Espacio.xs,
  },
  nota: { fontSize: Letra.pequeno, paddingHorizontal: Espacio.xs, lineHeight: 18 },
  // Las filas ya traen su margen lateral; se compensa el relleno de la pantalla.
  lista: { marginHorizontal: -Espacio.m, paddingTop: Espacio.xs },
});
