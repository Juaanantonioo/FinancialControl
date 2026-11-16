import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotonFlotante, Segmentos, useMargenDeLista } from '@/componentes/basicos';
import { Anillo, Barras, Leyenda } from '@/componentes/Graficos';
import { DistintivoDeCategoria, EstadoVacio, SelectorDeMes, Tarjeta } from '@/componentes/Tarjeta';
import {
  balanceDelMes,
  cuentasDelMes,
  deDivisa,
  divisasDe,
  evolucion,
  gastoPorCategoria,
  mesDe,
  moverMes,
  OTRAS,
  SIN_CATEGORIA,
} from '@/dominio/resumen';
import { aspectoDeParte } from '@/estado/aspecto';
import { useConsulta } from '@/estado/Datos';
import { describirMes, mesCorto } from '@/estado/fechas';
import { conSigno, importe } from '@/estado/formato';
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
 * P05 · Inicio: el mes de un vistazo. Balance global, balance por cuenta,
 * gasto por categoría y evolución de los últimos seis meses.
 *
 * Esta pantalla no suma nada: pide las cifras a `src/dominio/resumen.ts` y
 * las pinta. Presupuesto, gastos fijos y objetivos llegan en hitos
 * posteriores y no aparecen aquí.
 */
export default function Inicio() {
  const c = useColores();
  const paleta = usePaleta();
  const margen = useSafeAreaInsets();
  const margenDeLista = useMargenDeLista();
  const [mes, setMes] = useState(mesDe());
  const [divisaElegida, setDivisaElegida] = useState<string | null>(null);
  // Cuenta las veces que se ha pedido abrir Movimientos con un filtro.
  const peticiones = useRef(0);

  const todasLasCuentas = useConsulta((r) => r.cuentas.listar({ incluirArchivadas: true }));
  const todosLosMovimientos = useConsulta((r) => r.movimientos.listar());
  const categorias = useConsulta((r) => r.categorias.listar({ incluirArchivadas: true }));
  const cargado =
    todasLasCuentas !== undefined && todosLosMovimientos !== undefined && categorias !== undefined;

  // No se suman importes de divisas distintas: se ve una divisa cada vez.
  const divisas = divisasDe(todasLasCuentas ?? []);
  const divisa =
    divisaElegida && divisas.includes(divisaElegida) ? divisaElegida : (divisas[0] ?? 'EUR');
  const movimientos = deDivisa(todosLosMovimientos ?? [], divisa);
  const cuentas = (todasLasCuentas ?? []).filter((x) => x.divisa === divisa);

  const balance = balanceDelMes(movimientos, mes);
  const porCuenta = cuentasDelMes(cuentas, movimientos, mes);
  const gasto = gastoPorCategoria(movimientos, categorias ?? [], mes);
  const meses = evolucion(movimientos, mes);
  const hayEvolucion = meses.some((m) => m.ingresos > 0 || m.gastos > 0);
  const sinCuentas = cargado && todasLasCuentas.length === 0;

  const nombreDeParte = (clave: string): string => {
    if (clave === OTRAS) return t('inicio.otras');
    if (clave === SIN_CATEGORIA) return t('inicio.sinCategoria');
    return (categorias ?? []).find((x) => x.id === clave)?.nombre ?? t('inicio.sinCategoria');
  };

  /** Abre Movimientos con el mes puesto y, si es una categoría real, filtrado por ella. */
  function abrirMovimientosDe(clave: string) {
    const esCategoria = (categorias ?? []).some((x) => x.id === clave);
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

  const partes = gasto.partes.map((parte) => ({
    ...parte,
    nombre: nombreDeParte(parte.clave),
    aspecto: aspectoDeParte(parte.clave, categorias ?? [], paleta),
  }));

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: margenDeLista }}>
        {/* Bloque 1 · Balance global del mes, sobre el degradado de la cabecera. */}
        <View style={[estilos.cabecera, degradado(c), { paddingTop: margen.top + Espacio.s }]}>
          <SelectorDeMes
            mes={mes}
            alCambiar={(salto) => setMes(moverMes(mes, salto))}
            sobreDegradado
          />
          <View
            accessible
            accessibilityLabel={`${t('inicio.balanceLeido', {
              mes: describirMes(mes),
              balance: conSigno(balance.balance, divisa),
              ingresos: importe(balance.ingresos, divisa),
              gastos: importe(balance.gastos, divisa),
            })} ${fraseDelMes}`}
            style={estilos.balance}>
            <Text style={{ color: c.sobreDegradadoSecundario, fontSize: Letra.secundario }}>
              {t('inicio.balanceDelMes')}
            </Text>
            <Text
              style={[estilos.cifraGrande, cifrasTabulares, { color: c.sobreDegradado }]}
              maxFontSizeMultiplier={1.6}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              testID="balance-del-mes">
              {conSigno(balance.balance, divisa)}
            </Text>
            <Text
              style={{ color: c.sobreDegradadoSecundario, fontSize: Letra.secundario }}
              testID="frase-del-mes">
              {fraseDelMes}
            </Text>
            <View style={estilos.pareja}>
              <CifraDeCabecera
                etiqueta={t('inicio.ingresos')}
                valor={conSigno(balance.ingresos, divisa)}
                testID="ingresos-del-mes"
              />
              <CifraDeCabecera
                etiqueta={t('inicio.gastos')}
                valor={conSigno(-balance.gastos, divisa)}
                testID="gastos-del-mes"
              />
            </View>
          </View>
        </View>

        <View style={estilos.contenido}>
          {divisas.length > 1 ? (
            <Segmentos
              opciones={divisas.map((d) => ({ valor: d, texto: d }))}
              valor={divisa}
              alCambiar={setDivisaElegida}
            />
          ) : null}

          {/* Bloque 2 · Balance por cuenta. */}
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
              const saldo = importe(r.saldo, divisa);
              const variacion = conSigno(r.variacion, divisa);
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
                    variacion,
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
                        { color: r.saldo < 0 ? c.negativo : c.texto },
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
                        {variacion}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </Tarjeta>

          {/* Bloque 3 · Gasto por categoría. */}
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

          {/* Bloque 4 · Evolución de los últimos seis meses. */}
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
      <BotonFlotante
        etiqueta={t('movimientos.nuevo')}
        alPulsar={() => router.push('/movimiento')}
      />
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
    <View style={[estilos.cifraDeCabecera, { backgroundColor: c.veloSobreDegradado }]}>
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
    gap: Espacio.m,
  },
  balance: { gap: Espacio.xs },
  cifraGrande: { fontSize: Letra.cifraGrande, fontWeight: '800', letterSpacing: -1 },
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
