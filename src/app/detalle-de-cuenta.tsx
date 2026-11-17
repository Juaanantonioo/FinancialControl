import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton, CabeceraConVuelta } from '@/componentes/basicos';
import { FilaDeMovimiento } from '@/componentes/FilaDeMovimiento';
import { Leyenda, Linea } from '@/componentes/Graficos';
import { Dato, EstadoVacio, SelectorDeMes, Tarjeta } from '@/componentes/Tarjeta';
import {
  diasEntre,
  evolucionDeInversion,
  resumenDeInversion,
  valorDesactualizado,
  type ValorDeInversion,
} from '@/dominio/inversion';
import { fechaLocal, type Cuenta } from '@/dominio/modelo';
import { finDeMes } from '@/dominio/patrimonio';
import {
  esMesValido,
  mesDe,
  moverMes,
  resumenDeCuenta,
  ultimosMeses,
  type MovimientoParaResumen,
} from '@/dominio/resumen';
import { aspectoDeMovimiento } from '@/estado/aspecto';
import { useConsulta } from '@/estado/Datos';
import { describirMes, fechaLarga, mesCorto } from '@/estado/fechas';
import { conSigno, importe } from '@/estado/formato';
import { textoDeGanancia } from '@/estado/inversion';
import { t } from '@/i18n';
import {
  cifrasTabulares,
  Espacio,
  Letra,
  Radio,
  TactilMinimo,
  useColores,
  usePaleta,
} from '@/theme';

/**
 * P10 · Detalle de cuenta: saldo actual, resumen del mes y movimientos de
 * esa cuenta en ese mes. Si la cuenta es de inversión, arriba aparece lo que
 * vale, lo que se ha puesto, lo que se gana o se pierde y los valores
 * anotados (P21).
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
  const valores = useConsulta(
    (r) => (id ? r.valores.listarPorCuenta(id) : Promise.resolve([])),
    [id],
  );
  const categorias = useConsulta((r) => r.categorias.listar({ incluirArchivadas: true }));

  const noExiste = cuenta === null || (cuenta !== undefined && cuenta.borradoEn !== null);

  if (noExiste || !cuenta || !movimientos || !valores) {
    return (
      <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
        <CabeceraConVuelta titulo="" />
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
  const esInversion = cuenta.tipo === 'inversion';

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraConVuelta titulo={cuenta.nombre} testID="titulo-de-cuenta">
        <Boton
          texto={t('detalleDeCuenta.editar')}
          alPulsar={() => router.push({ pathname: '/cuenta', params: { id: cuenta.id } })}
          testID="editar-cuenta"
        />
      </CabeceraConVuelta>
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingBottom: margen.bottom + 96 }]}>
        {esInversion ? (
          <Inversion cuenta={cuenta} movimientos={movimientos} valores={valores} />
        ) : null}

        <Tarjeta>
          {esInversion ? null : (
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
          )}
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

/** Bloques propios de una cuenta de inversión: valor, evolución e historial. */
function Inversion({
  cuenta,
  movimientos,
  valores,
}: {
  cuenta: Cuenta;
  movimientos: MovimientoParaResumen[];
  valores: ValorDeInversion[];
}) {
  const c = useColores();
  const hoy = fechaLocal();
  const { divisa } = cuenta;
  const r = resumenDeInversion(cuenta, movimientos, valores, hoy);
  const ganancia = textoDeGanancia(r.ganancia, r.rentabilidad, divisa);
  const mesDeHoy = hoy.slice(0, 7);
  const puntos = evolucionDeInversion(
    cuenta,
    movimientos,
    valores,
    ultimosMeses(mesDeHoy, 12).map((m) => (m === mesDeHoy ? hoy : finDeMes(m))),
  );
  const todos = puntos.flatMap((p) => [p.aportado, p.valor]);
  const antiguo = valorDesactualizado(r.ultimo?.fecha ?? null, hoy);
  const actualizar = () =>
    router.push({ pathname: '/valor-de-inversion', params: { cuentaId: cuenta.id } });

  let origen = t('inversion.sinValor');
  if (r.ultimo) {
    origen =
      r.ultimo.valor === r.valor
        ? t('inversion.valorDel', { fecha: fechaLarga(r.ultimo.fecha) })
        : t('inversion.valorMasMovimientos', { fecha: fechaLarga(r.ultimo.fecha) });
  }

  return (
    <>
      <Tarjeta testID="bloque-inversion">
        <View
          accessible
          accessibilityLabel={`${t('inversion.valor')}: ${importe(r.valor, divisa)}. ${origen} ${t(
            'inversion.aportado',
          )}: ${importe(r.aportado, divisa)}. ${ganancia.texto}`}>
          <Text style={{ color: c.textoSecundario, fontSize: Letra.secundario }}>
            {`${t('inversion.valor')}${cuenta.archivada ? ` · ${t('inicio.archivada')}` : ''}`}
          </Text>
          <Text
            style={[estilos.saldo, cifrasTabulares, { color: c.texto }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            maxFontSizeMultiplier={1.6}
            testID="valor-actual">
            {importe(r.valor, divisa)}
          </Text>
          <Text
            style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}
            testID="origen-del-valor">
            {origen}
          </Text>
        </View>
        <View style={estilos.datos}>
          <Dato
            etiqueta={t('inversion.aportado')}
            valor={importe(r.aportado, divisa)}
            testID="aportado"
          />
        </View>
        <Text
          style={{ color: c[ganancia.color], fontSize: Letra.cuerpo, fontWeight: '700' }}
          testID="ganancia">
          {ganancia.texto}
        </Text>
        {antiguo && r.ultimo ? (
          <Text
            style={[estilos.aviso, { color: c.aviso, backgroundColor: c.superficieSuave }]}
            testID="aviso-valor-antiguo">
            {t('inversion.antiguo', { dias: diasEntre(r.ultimo.fecha, hoy) })}
          </Text>
        ) : null}
        <Boton
          texto={t('inversion.actualizar')}
          variante="primario"
          alPulsar={actualizar}
          testID="actualizar-valor"
        />
      </Tarjeta>

      {valores.length === 0 ? (
        <Tarjeta titulo={t('inversion.vacioTitulo')} testID="inversion-sin-valores">
          <Text style={[estilos.nota, { color: c.textoSecundario }]}>{t('inversion.vacio')}</Text>
        </Tarjeta>
      ) : (
        <>
          {puntos.length > 1 ? (
            <Tarjeta titulo={t('inversion.evolucion')}>
              <Leyenda
                elementos={[
                  { color: c.acento, texto: t('inversion.valor') },
                  { color: c.textoSecundario, texto: t('inversion.aportado') },
                ]}
              />
              <Linea
                series={[
                  {
                    clave: 'aportado',
                    color: c.textoSecundario,
                    valores: puntos.map((p) => p.aportado),
                    discontinua: true,
                  },
                  { clave: 'valor', color: c.acento, valores: puntos.map((p) => p.valor) },
                ]}
                etiquetas={puntos.map((p) => mesCorto(p.fecha.slice(0, 7)))}
                textoMaximo={importe(Math.max(...todos), divisa)}
                textoMinimo={importe(Math.min(...todos), divisa)}
                descripcion={t('inversion.evolucionLeida', {
                  puntos: puntos
                    .map((p) =>
                      t('inversion.puntoLeido', {
                        mes: describirMes(p.fecha.slice(0, 7)),
                        aportado: importe(p.aportado, divisa),
                        valor: importe(p.valor, divisa),
                      }),
                    )
                    .join('; '),
                })}
              />
            </Tarjeta>
          ) : null}
          <Tarjeta titulo={t('inversion.historial')} testID="historial-de-valores">
            {valores.map((valor, i) => (
              <Pressable
                key={valor.id}
                onPress={() =>
                  router.push({ pathname: '/valor-de-inversion', params: { id: valor.id } })
                }
                accessibilityRole="button"
                accessibilityLabel={t('inversion.valorLeido', {
                  fecha: fechaLarga(valor.fecha),
                  valor: importe(valor.valor, divisa),
                })}
                testID={`valor-${valor.fecha}`}
                style={({ pressed }) => [
                  estilos.valor,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borde },
                  { opacity: pressed ? 0.6 : 1 },
                ]}>
                <Text style={[estilos.fechaDeValor, { color: c.texto }]}>
                  {fechaLarga(valor.fecha)}
                </Text>
                <Text style={[estilos.importeDeValor, cifrasTabulares, { color: c.texto }]}>
                  {importe(valor.valor, divisa)}
                </Text>
                <Text style={{ color: c.textoSecundario, fontSize: Letra.subtitulo }}>›</Text>
              </Pressable>
            ))}
          </Tarjeta>
        </>
      )}
      <Text style={[estilos.nota, { color: c.textoSecundario }]}>
        {`${t('inversion.ingresoDirecto')} ${t('inversion.nota')}`}
      </Text>
    </>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Espacio.m, gap: Espacio.s },
  saldo: { fontSize: Letra.cifraGrande, fontWeight: '800', letterSpacing: -1 },
  datos: { flexDirection: 'row', gap: Espacio.s, paddingTop: Espacio.xs },
  aviso: {
    fontSize: Letra.pequeno,
    lineHeight: 18,
    padding: Espacio.s + 2,
    borderRadius: Radio.s,
    overflow: 'hidden',
  },
  seccion: {
    fontSize: Letra.pequeno,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingTop: Espacio.m,
    paddingHorizontal: Espacio.xs,
  },
  nota: { fontSize: Letra.pequeno, paddingHorizontal: Espacio.xs, lineHeight: 18 },
  valor: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.xs,
    gap: Espacio.s,
  },
  fechaDeValor: { flex: 1, fontSize: Letra.cuerpo },
  importeDeValor: { fontSize: Letra.cuerpo, fontWeight: '700' },
  // Las filas ya traen su margen lateral; se compensa el relleno de la pantalla.
  lista: { marginHorizontal: -Espacio.m, paddingTop: Espacio.xs },
});
