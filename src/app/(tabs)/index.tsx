import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonAnadir, Segmentos, useMargenDeLista } from '@/componentes/basicos';
import { Anillo, Barras, Leyenda } from '@/componentes/Graficos';
import { BloquesDeInicio } from '@/componentes/plan/BloquesDeInicio';
import {
  Dato,
  DistintivoDeCategoria,
  EstadoVacio,
  SelectorDeMes,
  Tarjeta,
} from '@/componentes/Tarjeta';
import { resumenDeInversiones } from '@/dominio/inversion';
import { patrimonioEn, variacionDelMes } from '@/dominio/patrimonio';
import {
  balanceDelMes,
  cuentasDelMes,
  esMesValido,
  evolucion,
  gastoPorCategoria,
  mesDe,
  moverMes,
  OTRAS,
  SIN_CATEGORIA,
} from '@/dominio/resumen';
import { resumenDiario } from '@/dominio/tiempo';
import { aspectoDeParte } from '@/estado/aspecto';
import { useConsulta } from '@/estado/Datos';
import { describirMes, fechaLarga, mesCorto } from '@/estado/fechas';
import { conSigno, importe, porcentaje } from '@/estado/formato';
import { textoDeGanancia } from '@/estado/inversion';
import { usePanel } from '@/estado/panel';
import { t } from '@/i18n';
import {
  cifrasTabulares,
  degradado,
  Espacio,
  Letra,
  Radio,
  TactilMinimo,
  useColores,
  usePaleta,
} from '@/theme';

/**
 * P05 · Inicio. Arriba, lo que la persona tiene hoy (patrimonio), repartido
 * entre disponible e invertido. Debajo, el mes elegido: balance, el día de
 * hoy, las cuentas, las inversiones, el gasto por categoría y la evolución.
 *
 * El patrimonio es siempre el de hoy; el selector de mes solo cambia los
 * bloques del mes. Esta pantalla no suma nada: pide las cifras a
 * `src/dominio` y las pinta.
 */
export default function Inicio() {
  const c = useColores();
  const paleta = usePaleta();
  const margen = useSafeAreaInsets();
  const margenDeLista = useMargenDeLista();
  const panel = usePanel();
  const { hoy, divisa, divisas, cuentas, movimientos, valores, categorias, sinCuentas } = panel;
  const [mes, setMes] = useState(mesDe());
  const pendientesDeRevisar = useConsulta((r) => r.capturas.contarPendientes());
  // Cuenta las veces que se ha pedido abrir Movimientos con un filtro.
  const peticiones = useRef(0);

  // Análisis puede abrir Inicio en un mes concreto. Se aplica una vez por petición.
  const pedido = useLocalSearchParams<{ mes?: string; peticion?: string }>();
  const firma = `${pedido.peticion ?? ''}|${pedido.mes ?? ''}`;
  const [aplicada, setAplicada] = useState('|');
  if (firma !== aplicada) {
    setAplicada(firma);
    if (pedido.mes && esMesValido(pedido.mes)) setMes(pedido.mes);
  }

  const patrimonio = patrimonioEn(cuentas, movimientos, valores, hoy);
  const variacion = variacionDelMes(cuentas, movimientos, valores, hoy);
  const deInversion = cuentas.filter((x) => x.tipo === 'inversion');
  const inversiones = resumenDeInversiones(deInversion, movimientos, valores, hoy);

  const balance = balanceDelMes(movimientos, mes);
  const diario = resumenDiario(movimientos, mes, hoy);
  const porCuenta = cuentasDelMes(cuentas, movimientos, mes);
  const gasto = gastoPorCategoria(movimientos, categorias, mes);
  const meses = evolucion(movimientos, mes);
  const hayEvolucion = meses.some((m) => m.ingresos > 0 || m.gastos > 0);

  const nombreDeParte = (clave: string): string => {
    if (clave === OTRAS) return t('inicio.otras');
    if (clave === SIN_CATEGORIA) return t('inicio.sinCategoria');
    return categorias.find((x) => x.id === clave)?.nombre ?? t('inicio.sinCategoria');
  };

  /** Abre Movimientos con el mes puesto y, si es una categoría real, filtrado por ella. */
  function abrirMovimientosDe(clave: string) {
    const esCategoria = categorias.some((x) => x.id === clave);
    peticiones.current += 1;
    router.navigate({
      pathname: '/movimientos',
      params: {
        mes,
        ...(esCategoria ? { categoriaId: clave } : {}),
        // Marca de la petición: permite repetir el mismo filtro tras quitarlo.
        peticion: String(peticiones.current),
      },
    });
  }

  let fraseDelMes = t('inicio.sinMovimientos');
  if (balance.movimientos > 0) {
    if (balance.tasaDeAhorro === null) {
      // Sin ingresos no hay tasa de ahorro que mostrar.
      fraseDelMes = t('inicio.sinIngresos');
    } else if (balance.balance < 0) {
      fraseDelMes = t('inicio.gastoDeMas', { importe: importe(-balance.balance, divisa) });
    } else {
      fraseDelMes = t('inicio.ahorro', { porcentaje: balance.tasaDeAhorro });
    }
  }

  let fraseDelPatrimonio = t('inicio.sinVariacion');
  if (variacion) {
    const datos = {
      diferencia: conSigno(variacion.diferencia, divisa),
      fecha: fechaLarga(variacion.desde),
    };
    fraseDelPatrimonio =
      variacion.porcentaje === null
        ? t('inicio.variacionDelMes', datos)
        : t('inicio.variacionConPorcentaje', {
            ...datos,
            porcentaje: porcentaje(variacion.porcentaje),
          });
  }

  const partes = gasto.partes.map((parte) => ({
    ...parte,
    nombre: nombreDeParte(parte.clave),
    aspecto: aspectoDeParte(parte.clave, categorias, paleta),
  }));

  const ganancia = textoDeGanancia(inversiones.ganancia, inversiones.rentabilidad, divisa);

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: margenDeLista }}>
        {/* Lo que tienes hoy, sobre el degradado de la cabecera. */}
        <View style={[estilos.cabecera, degradado(c), { paddingTop: margen.top + Espacio.s }]}>
          <View style={estilos.lineaSuperior}>
            <Text
              style={[estilos.rotulo, { color: c.sobreDegradadoSecundario }]}
              accessibilityRole="header">
              {t('inicio.patrimonio')}
            </Text>
            <Pressable
              onPress={() => router.push('/ajustes')}
              accessibilityRole="button"
              accessibilityLabel={t('ajustes.abrir')}
              testID="boton-ajustes"
              hitSlop={4}
              style={({ pressed }) => [
                estilos.engranaje,
                { backgroundColor: c.veloSobreDegradado, opacity: pressed ? 0.6 : 1 },
              ]}>
              {/* Es un icono: no crece con el tamaño de letra, su botón ya mide 44 puntos. */}
              <Text allowFontScaling={false} style={{ color: c.sobreDegradado, fontSize: 24 }}>
                {'\u2699\uFE0E'}
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => router.push('/patrimonio')}
            accessibilityRole="button"
            accessibilityLabel={t('inicio.patrimonioLeido', {
              total: importe(patrimonio.total, divisa),
              variacion: fraseDelPatrimonio,
            })}
            testID="patrimonio"
            style={({ pressed }) => [estilos.patrimonio, { opacity: pressed ? 0.7 : 1 }]}>
            <View style={estilos.cifraYFlecha}>
              <Text
                style={[estilos.cifraGrande, cifrasTabulares, { color: c.sobreDegradado }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                maxFontSizeMultiplier={1.6}
                testID="patrimonio-total">
                {importe(patrimonio.total, divisa)}
              </Text>
              <Text
                allowFontScaling={false}
                style={{ color: c.sobreDegradadoSecundario, fontSize: 26 }}>
                ›
              </Text>
            </View>
            <Text
              style={{ color: c.sobreDegradadoSecundario, fontSize: Letra.secundario }}
              testID="patrimonio-variacion">
              {fraseDelPatrimonio}
            </Text>
          </Pressable>
          <View style={estilos.pareja}>
            <CifraDeCabecera
              etiqueta={t('inicio.disponible')}
              valor={importe(patrimonio.disponible, divisa)}
              testID="patrimonio-disponible"
            />
            {deInversion.length > 0 ? (
              <CifraDeCabecera
                etiqueta={t('inicio.invertido')}
                valor={importe(patrimonio.invertido, divisa)}
                testID="patrimonio-invertido"
              />
            ) : null}
          </View>
        </View>

        <View style={estilos.contenido}>
          {divisas.length > 1 ? (
            <Segmentos
              opciones={divisas.map((d) => ({ valor: d, texto: d }))}
              valor={divisa}
              alCambiar={panel.elegirDivisa}
            />
          ) : null}

          {/* Pagos capturados por revisar. Solo aparece si hay alguno. */}
          {pendientesDeRevisar ? (
            <Pressable
              onPress={() => router.push('/capturas')}
              accessibilityRole="button"
              testID="bloque-capturas"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Tarjeta titulo={`${t('bandeja.enInicio', { total: pendientesDeRevisar })}  ›`}>
                <Text style={{ color: c.textoSecundario, fontSize: Letra.secundario }}>
                  {t('bandeja.enInicioAyuda')}
                </Text>
              </Tarjeta>
            </Pressable>
          ) : null}

          {/* Planificación: lo que queda por gastar y lo que viene. Siempre del mes en curso. */}
          <BloquesDeInicio panel={panel} />

          <SelectorDeMes mes={mes} alCambiar={(salto) => setMes(moverMes(mes, salto))} />

          {/* Balance del mes. */}
          <Tarjeta titulo={t('inicio.balanceDelMes')} testID="bloque-balance">
            <View
              accessible
              accessibilityLabel={`${t('inicio.balanceLeido', {
                mes: describirMes(mes),
                balance: conSigno(balance.balance, divisa),
                ingresos: importe(balance.ingresos, divisa),
                gastos: importe(balance.gastos, divisa),
              })} ${fraseDelMes}`}>
              <Text
                style={[
                  estilos.cifra,
                  cifrasTabulares,
                  { color: balance.balance < 0 ? c.negativo : c.texto },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                maxFontSizeMultiplier={1.6}
                testID="balance-del-mes">
                {conSigno(balance.balance, divisa)}
              </Text>
              <Text
                style={{ color: c.textoSecundario, fontSize: Letra.secundario }}
                testID="frase-del-mes">
                {fraseDelMes}
              </Text>
            </View>
            <View style={estilos.datos}>
              <Dato
                etiqueta={t('inicio.ingresos')}
                valor={conSigno(balance.ingresos, divisa)}
                color={balance.ingresos > 0 ? c.positivo : c.texto}
                testID="ingresos-del-mes"
              />
              <Dato
                etiqueta={t('inicio.gastos')}
                valor={conSigno(-balance.gastos, divisa)}
                testID="gastos-del-mes"
              />
            </View>
          </Tarjeta>

          {/* Hoy. */}
          <Tarjeta titulo={t('inicio.hoy')} testID="bloque-hoy">
            <View style={estilos.datos}>
              <Dato
                etiqueta={t('inicio.gastoDeHoy')}
                valor={importe(diario.gastoDeHoy, divisa)}
                testID="gasto-de-hoy"
              />
              <Dato
                etiqueta={
                  mes === hoy.slice(0, 7)
                    ? t('inicio.mediaDiaria')
                    : t('inicio.mediaDiariaDe', { mes: describirMes(mes) })
                }
                valor={
                  diario.mediaDiaria === null
                    ? t('analisis.sinDato')
                    : importe(diario.mediaDiaria, divisa)
                }
                testID="media-diaria"
              />
            </View>
          </Tarjeta>

          {/* Balance por cuenta. */}
          <Tarjeta titulo={t('inicio.cuentas')} testID="bloque-cuentas">
            {sinCuentas ? (
              <EstadoVacio
                texto={t('inicio.cuentasVacio')}
                accion={{
                  texto: t('inicio.crearCuenta'),
                  alPulsar: () => router.push('/cuenta'),
                  testID: 'crear-cuenta',
                }}
              />
            ) : null}
            {porCuenta.map((cuenta, i) => {
              const r = cuenta.resumen;
              // Una cuenta de inversión se muestra por lo que vale, no por lo aportado.
              const valor =
                patrimonio.cuentas.find((x) => x.cuentaId === cuenta.id)?.valor ?? r.saldo;
              const saldo = importe(valor, divisa);
              const cambio = conSigno(r.variacion, divisa);
              return (
                <Pressable
                  key={cuenta.id}
                  onPress={() =>
                    router.push({ pathname: '/detalle-de-cuenta', params: { id: cuenta.id, mes } })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t('inicio.cuentaLeida', {
                    nombre: cuenta.nombre,
                    saldo,
                    entradas: importe(r.entradas, divisa),
                    salidas: importe(r.salidas, divisa),
                    variacion: cambio,
                  })}
                  testID={`inicio-cuenta-${cuenta.nombre}`}
                  style={({ pressed }) => [
                    estilos.cuenta,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borde },
                    { opacity: pressed ? 0.6 : 1 },
                  ]}>
                  <View style={estilos.lineaDeCuenta}>
                    <Text style={[estilos.nombre, { color: c.texto }]}>
                      {cuenta.nombre}
                      {cuenta.archivada ? (
                        <Text style={{ color: c.textoSecundario, fontWeight: '400' }}>
                          {` · ${t('inicio.archivada')}`}
                        </Text>
                      ) : null}
                    </Text>
                    <Text
                      style={[
                        estilos.saldo,
                        cifrasTabulares,
                        { color: valor < 0 ? c.negativo : c.texto },
                      ]}
                      testID={`inicio-saldo-${cuenta.nombre}`}>
                      {saldo}
                    </Text>
                  </View>
                  <View style={estilos.lineaDeCuenta}>
                    <Text style={[estilos.detalle, { color: c.textoSecundario }]}>
                      {r.movimientos === 0
                        ? t('inicio.sinMovimientosEnCuenta')
                        : t('inicio.entranYSalen', {
                            entradas: importe(r.entradas, divisa),
                            salidas: importe(r.salidas, divisa),
                          })}
                    </Text>
                    {r.movimientos > 0 ? (
                      <Text
                        style={[
                          estilos.variacion,
                          cifrasTabulares,
                          {
                            color:
                              r.variacion > 0
                                ? c.positivo
                                : r.variacion < 0
                                  ? c.negativo
                                  : c.textoSecundario,
                            backgroundColor:
                              r.variacion > 0
                                ? c.positivoSuave
                                : r.variacion < 0
                                  ? c.negativoSuave
                                  : c.superficieSuave,
                          },
                        ]}
                        testID={`inicio-variacion-${cuenta.nombre}`}>
                        {cambio}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </Tarjeta>

          {/* Inversiones: solo si hay alguna cuenta de inversión. */}
          {deInversion.length > 0 ? (
            <Pressable
              onPress={() => router.push('/inversiones')}
              accessibilityRole="button"
              accessibilityLabel={`${t('inicio.inversiones')}. ${t('inversion.aportado')}: ${importe(
                inversiones.aportado,
                divisa,
              )}. ${t('inversion.valor')}: ${importe(inversiones.valor, divisa)}. ${ganancia.texto}. ${t(
                'inicio.verInversiones',
              )}`}
              testID="bloque-inversiones"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Tarjeta titulo={`${t('inicio.inversiones')}  ›`}>
                <View style={estilos.datos}>
                  <Dato
                    etiqueta={t('inversion.aportado')}
                    valor={importe(inversiones.aportado, divisa)}
                    testID="inversiones-aportado"
                  />
                  <Dato
                    etiqueta={t('inversion.valor')}
                    valor={importe(inversiones.valor, divisa)}
                    testID="inversiones-valor"
                  />
                </View>
                <Text
                  style={{
                    color: c[ganancia.color],
                    fontSize: Letra.secundario,
                    fontWeight: '700',
                  }}
                  testID="inversiones-ganancia">
                  {ganancia.texto}
                </Text>
              </Tarjeta>
            </Pressable>
          ) : null}

          {/* Gasto por categoría. */}
          <Tarjeta titulo={t('inicio.gastoPorCategoria')} testID="bloque-gasto">
            {gasto.total === 0 ? (
              <EstadoVacio
                texto={t('inicio.gastoVacio')}
                testID="gasto-vacio"
                accion={
                  sinCuentas
                    ? undefined
                    : {
                        texto: t('inicio.anadirMovimiento'),
                        alPulsar: () => router.push('/movimiento'),
                      }
                }
              />
            ) : (
              <>
                <View style={estilos.anillo}>
                  <Anillo
                    clave={`${mes}-${gasto.total}`}
                    sectores={partes.map((p) => ({
                      clave: p.clave,
                      valor: p.importe,
                      color: p.aspecto.color,
                    }))}
                    descripcion={t('inicio.anilloLeido', {
                      mes: describirMes(mes),
                      total: importe(gasto.total, divisa),
                      partes: partes
                        .map((p) =>
                          t('inicio.parteCorta', { nombre: p.nombre, porcentaje: p.porcentaje }),
                        )
                        .join('; '),
                    })}>
                    <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>
                      {t('inicio.gastado')}
                    </Text>
                    <Text
                      style={[estilos.totalDelAnillo, cifrasTabulares, { color: c.texto }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.5}
                      testID="gasto-total">
                      {importe(gasto.total, divisa)}
                    </Text>
                  </Anillo>
                </View>
                {partes.map((parte) => (
                  <Pressable
                    key={parte.clave}
                    onPress={() => abrirMovimientosDe(parte.clave)}
                    accessibilityRole="button"
                    accessibilityLabel={t('inicio.parteLeida', {
                      nombre: parte.nombre,
                      importe: importe(parte.importe, divisa),
                      porcentaje: parte.porcentaje,
                    })}
                    testID={`parte-${parte.nombre}`}
                    style={({ pressed }) => [estilos.parte, { opacity: pressed ? 0.6 : 1 }]}>
                    <DistintivoDeCategoria aspecto={parte.aspecto} lado={36} />
                    <Text style={[estilos.nombre, { color: c.texto }]}>{parte.nombre}</Text>
                    <View style={estilos.cifrasDeParte}>
                      <Text style={[estilos.importeDeParte, cifrasTabulares, { color: c.texto }]}>
                        {importe(parte.importe, divisa)}
                      </Text>
                      <Text
                        style={[
                          cifrasTabulares,
                          { color: c.textoSecundario, fontSize: Letra.pequeno },
                        ]}>
                        {`${parte.porcentaje} %`}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </Tarjeta>

          {/* Evolución de los últimos seis meses. */}
          <Tarjeta titulo={t('inicio.evolucion')} testID="bloque-evolucion">
            {hayEvolucion ? (
              <>
                <Leyenda
                  elementos={[
                    { color: c.positivo, texto: t('inicio.ingresos') },
                    { color: c.acento, texto: t('inicio.gastos') },
                  ]}
                />
                <Barras
                  grupos={meses.map((m) => ({
                    clave: m.mes,
                    etiqueta: mesCorto(m.mes),
                    descripcion: t('inicio.mesLeido', {
                      mes: describirMes(m.mes),
                      ingresos: importe(m.ingresos, divisa),
                      gastos: importe(m.gastos, divisa),
                    }),
                    valores: [m.ingresos, m.gastos],
                  }))}
                  colores={[c.positivo, c.acento]}
                  elegido={mes}
                  alElegir={setMes}
                />
              </>
            ) : (
              <EstadoVacio texto={t('inicio.evolucionVacio')} testID="evolucion-vacia" />
            )}
          </Tarjeta>
        </View>
      </ScrollView>
      <BotonAnadir />
    </View>
  );
}

function CifraDeCabecera({
  etiqueta,
  valor,
  testID,
}: {
  etiqueta: string;
  valor: string;
  testID: string;
}) {
  const c = useColores();
  return (
    <View
      accessible
      accessibilityLabel={`${etiqueta}: ${valor}`}
      style={[estilos.cifraDeCabecera, { backgroundColor: c.veloSobreDegradado }]}>
      <Text
        style={{ color: c.sobreDegradadoSecundario, fontSize: Letra.pequeno }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        maxFontSizeMultiplier={1.8}>
        {etiqueta}
      </Text>
      <Text
        maxFontSizeMultiplier={1.8}
        style={[estilos.valorDeCabecera, cifrasTabulares, { color: c.sobreDegradado }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        testID={testID}>
        {valor}
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  cabecera: {
    paddingHorizontal: Espacio.m,
    paddingBottom: Espacio.l,
    borderBottomLeftRadius: Radio.l + 6,
    borderBottomRightRadius: Radio.l + 6,
    gap: Espacio.s,
  },
  lineaSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espacio.s,
  },
  engranaje: {
    width: TactilMinimo,
    height: TactilMinimo,
    borderRadius: TactilMinimo / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotulo: { flex: 1, fontSize: Letra.cuerpo, fontWeight: '600' },
  patrimonio: { minHeight: TactilMinimo, gap: Espacio.xs },
  cifraYFlecha: { flexDirection: 'row', alignItems: 'center', gap: Espacio.s },
  cifraGrande: {
    flexShrink: 1,
    fontSize: Letra.cifraGrande,
    fontWeight: '800',
    letterSpacing: -1,
  },
  pareja: { flexDirection: 'row', gap: Espacio.s, marginTop: Espacio.s },
  cifraDeCabecera: {
    flex: 1,
    borderRadius: Radio.m,
    paddingHorizontal: Espacio.m,
    paddingVertical: Espacio.s + 2,
    gap: 2,
  },
  valorDeCabecera: { fontSize: Letra.cuerpo, fontWeight: '700' },
  contenido: { padding: Espacio.m, gap: Espacio.m },
  cifra: { fontSize: Letra.cifra, fontWeight: '800', letterSpacing: -0.5 },
  datos: { flexDirection: 'row', gap: Espacio.s, paddingTop: Espacio.xs },
  cuenta: { minHeight: TactilMinimo, paddingVertical: Espacio.s + 2, gap: Espacio.xs },
  lineaDeCuenta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espacio.s,
  },
  nombre: { flex: 1, fontSize: Letra.cuerpo, fontWeight: '600' },
  saldo: { fontSize: Letra.cuerpo, fontWeight: '700' },
  detalle: { flex: 1, fontSize: Letra.pequeno },
  variacion: {
    fontSize: Letra.pequeno,
    fontWeight: '700',
    paddingHorizontal: Espacio.s,
    paddingVertical: 2,
    borderRadius: Radio.s,
    overflow: 'hidden',
  },
  anillo: { alignItems: 'center', paddingVertical: Espacio.s },
  totalDelAnillo: { fontSize: Letra.subtitulo, fontWeight: '800' },
  parte: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.xs,
    gap: Espacio.m,
  },
  cifrasDeParte: { alignItems: 'flex-end' },
  importeDeParte: { fontSize: Letra.cuerpo, fontWeight: '700' },
});
