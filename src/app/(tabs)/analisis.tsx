import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Boton, BotonAnadir, Cabecera, Segmentos, useMargenDeLista } from '@/componentes/basicos';
import { FilaDeMovimiento } from '@/componentes/FilaDeMovimiento';
import { Anillo, Barras, Calendario, Leyenda } from '@/componentes/Graficos';
import {
  Dato,
  DistintivoDeCategoria,
  EstadoVacio,
  SelectorDeMes,
  Tarjeta,
} from '@/componentes/Tarjeta';
import { variacionDelAnio } from '@/dominio/patrimonio';
import { esFechaValida } from '@/dominio/modelo';
import { esMesValido, evolucion, mesDe, moverMes, OTRAS, SIN_CATEGORIA } from '@/dominio/resumen';
import {
  comparativaConMesAnterior,
  resumenDelAnio,
  resumenDiario,
  type DiaDelMes,
  type LineaDeComparativa,
} from '@/dominio/tiempo';
import { aspectoDeMovimiento, aspectoDeParte } from '@/estado/aspecto';
import { useConsulta } from '@/estado/Datos';
import { describirMes, diaYMes, fechaLarga, mesCorto } from '@/estado/fechas';
import { conSigno, importe, porcentaje, sinCentimos } from '@/estado/formato';
import { usePanel } from '@/estado/panel';
import { t } from '@/i18n';
import { cifrasTabulares, Espacio, Letra, TactilMinimo, useColores, usePaleta } from '@/theme';

type Vista = 'dia' | 'mes' | 'anio';
type Panel = ReturnType<typeof usePanel>;

/** A partir de este tamaño de letra el calendario no cabe y se muestra una lista de días. */
export const ESCALA_MAXIMA_DEL_CALENDARIO = 1.35;

/**
 * P17 · Análisis: qué se hace con el dinero cada día, cada mes y cada año.
 * Tres vistas con un selector. Todas las cifras salen de `src/dominio`.
 */
export default function Analisis() {
  const c = useColores();
  const margenDeLista = useMargenDeLista();
  const panel = usePanel();
  // Un enlace puede abrir la pestaña en una vista, un mes, un año o un día concretos:
  // financialcontrol://analisis?vista=anio&anio=2026
  const pedido = useLocalSearchParams<{
    vista?: string;
    mes?: string;
    anio?: string;
    dia?: string;
  }>();
  const [vista, setVista] = useState<Vista>('dia');
  const [mes, setMes] = useState(mesDe());
  const [anio, setAnio] = useState(Number(panel.hoy.slice(0, 4)));
  const [diaPedido, setDiaPedido] = useState<string | null>(null);
  // La pestaña sigue montada entre visitas: lo pedido se aplica una vez por petición.
  const firma = [pedido.vista, pedido.mes, pedido.anio, pedido.dia].join('|');
  const [aplicada, setAplicada] = useState('|||');
  if (firma !== aplicada) {
    setAplicada(firma);
    if (pedido.vista === 'dia' || pedido.vista === 'mes' || pedido.vista === 'anio') {
      setVista(pedido.vista);
    }
    if (pedido.anio && /^\d{4}$/.test(pedido.anio)) setAnio(Number(pedido.anio));
    if (pedido.dia && esFechaValida(pedido.dia)) {
      setVista('dia');
      setMes(pedido.dia.slice(0, 7));
      setDiaPedido(pedido.dia);
    } else if (pedido.mes && esMesValido(pedido.mes)) {
      setMes(pedido.mes);
    }
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <Cabecera titulo={t('analisis.titulo')} />
      <ScrollView contentContainerStyle={[estilos.contenido, { paddingBottom: margenDeLista }]}>
        <Segmentos
          opciones={[
            { valor: 'dia', texto: t('analisis.dia') },
            { valor: 'mes', texto: t('analisis.mes') },
            { valor: 'anio', texto: t('analisis.anio') },
          ]}
          valor={vista}
          alCambiar={setVista}
        />
        {panel.divisas.length > 1 ? (
          <Segmentos
            opciones={panel.divisas.map((d) => ({ valor: d, texto: d }))}
            valor={panel.divisa}
            alCambiar={panel.elegirDivisa}
          />
        ) : null}
        {vista === 'anio' ? (
          <SelectorDeAnio anio={anio} alCambiar={(salto) => setAnio(anio + salto)} />
        ) : (
          <SelectorDeMes mes={mes} alCambiar={(salto) => setMes(moverMes(mes, salto))} />
        )}
        {vista === 'dia' ? (
          <VistaDeDia
            key={`${mes}-${diaPedido ?? ''}`}
            panel={panel}
            mes={mes}
            diaInicial={diaPedido?.slice(0, 7) === mes ? diaPedido : null}
          />
        ) : null}
        {vista === 'mes' ? <VistaDeMes panel={panel} mes={mes} alElegirMes={setMes} /> : null}
        {vista === 'anio' ? <VistaDeAnio panel={panel} anio={anio} /> : null}
      </ScrollView>
      <BotonAnadir />
    </View>
  );
}

function SelectorDeAnio({ anio, alCambiar }: { anio: number; alCambiar: (salto: -1 | 1) => void }) {
  const c = useColores();
  const flecha = (salto: -1 | 1) => (
    <Pressable
      onPress={() => alCambiar(salto)}
      accessibilityRole="button"
      accessibilityLabel={salto === -1 ? t('comun.anioAnterior') : t('comun.anioSiguiente')}
      testID={salto === -1 ? 'anio-anterior' : 'anio-siguiente'}
      style={({ pressed }) => [
        estilos.flecha,
        { backgroundColor: c.superficieSuave, opacity: pressed ? 0.6 : 1 },
      ]}>
      <Text
        allowFontScaling={false}
        style={{ color: c.texto, fontSize: 24, lineHeight: 28, fontWeight: '600' }}>
        {salto === -1 ? '‹' : '›'}
      </Text>
    </Pressable>
  );
  return (
    <View style={estilos.selector}>
      {flecha(-1)}
      <Text
        style={[estilos.anio, cifrasTabulares, { color: c.texto }]}
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
        maxFontSizeMultiplier={1.8}
        testID="anio-elegido">
        {anio}
      </Text>
      {flecha(1)}
    </View>
  );
}

// -------------------------------------------------------------------- día

function VistaDeDia({
  panel,
  mes,
  diaInicial,
}: {
  panel: Panel;
  mes: string;
  diaInicial: string | null;
}) {
  const c = useColores();
  const paleta = usePaleta();
  const { fontScale } = useWindowDimensions();
  const { hoy, divisa, movimientos, categorias } = panel;
  const [elegido, setElegido] = useState<string | null>(diaInicial);
  const r = resumenDiario(movimientos, mes, hoy);
  const hayDatos = r.dias.some((d) => d.movimientos > 0);
  const delDia = useConsulta(
    (repos) => (elegido ? repos.movimientos.listar({ dia: elegido }) : Promise.resolve([])),
    [elegido],
  );
  const visibles = (delDia ?? []).filter((m) => m.divisa === divisa);
  const diaElegido = elegido ? r.dias.find((d) => d.fecha === elegido) : undefined;

  const describir = (dia: DiaDelMes) =>
    dia.movimientos === 0
      ? t('analisis.diaSinMovimientos', { fecha: fechaLarga(dia.fecha) })
      : t('analisis.diaLeido', {
          fecha: fechaLarga(dia.fecha),
          gasto: importe(dia.gasto, divisa),
          ingreso: importe(dia.ingreso, divisa),
        });

  return (
    <>
      <Tarjeta testID="resumen-diario">
        <View style={estilos.datos}>
          <Dato
            etiqueta={t('analisis.gastoDeHoy')}
            valor={importe(r.gastoDeHoy, divisa)}
            testID="analisis-gasto-de-hoy"
          />
          <Dato
            etiqueta={t('analisis.mediaDiaria')}
            valor={r.mediaDiaria === null ? t('analisis.sinDato') : importe(r.mediaDiaria, divisa)}
            testID="analisis-media-diaria"
          />
        </View>
        <Dato
          etiqueta={t('analisis.mayorGasto')}
          valor={
            r.diaDeMayorGasto
              ? t('analisis.mayorGastoValor', {
                  importe: importe(r.diaDeMayorGasto.gasto, divisa),
                  dia: r.diaDeMayorGasto.dia,
                })
              : t('analisis.sinDato')
          }
          testID="analisis-mayor-gasto"
        />
      </Tarjeta>

      <Tarjeta titulo={t('analisis.calendario')}>
        {!hayDatos ? (
          <EstadoVacio texto={t('analisis.mesVacioDia')} testID="dia-vacio" />
        ) : fontScale > ESCALA_MAXIMA_DEL_CALENDARIO ? (
          // Con la letra muy grande las casillas no caben: lista de días con algo anotado.
          <View testID="lista-de-dias">
            {r.dias
              .filter((d) => d.movimientos > 0)
              .map((dia) => (
                <Pressable
                  key={dia.fecha}
                  onPress={() => setElegido(dia.fecha)}
                  accessibilityRole="button"
                  accessibilityLabel={describir(dia)}
                  accessibilityState={{ selected: dia.fecha === elegido }}
                  testID={`dia-${dia.fecha}`}
                  style={[
                    estilos.filaDeDia,
                    {
                      borderTopColor: c.borde,
                      backgroundColor: dia.fecha === elegido ? c.acentoSuave : c.transparente,
                    },
                  ]}>
                  <Text style={[estilos.nombre, { color: c.texto }]}>{diaYMes(dia.fecha)}</Text>
                  <Text style={[estilos.valor, cifrasTabulares, { color: c.texto }]}>
                    {conSigno(-dia.gasto, divisa)}
                  </Text>
                </Pressable>
              ))}
          </View>
        ) : (
          <Calendario
            mes={mes}
            dias={r.dias}
            hoy={hoy}
            elegido={elegido}
            alElegir={setElegido}
            cifra={sinCentimos}
            descripcion={describir}
          />
        )}
        {hayDatos && !elegido ? (
          <Text style={[estilos.nota, { color: c.textoSecundario }]}>
            {t('analisis.tocaUnDia')}
          </Text>
        ) : null}
      </Tarjeta>

      {elegido && diaElegido ? (
        <View testID="movimientos-del-dia">
          <Text style={[estilos.seccion, { color: c.textoSecundario }]} accessibilityRole="header">
            {t('analisis.movimientosDelDia', { fecha: diaYMes(elegido) })}
          </Text>
          <Text style={[estilos.nota, { color: c.textoSecundario }]} testID="totales-del-dia">
            {`${t('analisis.gastadoEnElDia', { gasto: importe(diaElegido.gasto, divisa) })} · ${t(
              'analisis.ingresadoEnElDia',
              { ingreso: importe(diaElegido.ingreso, divisa) },
            )}`}
          </Text>
          {delDia !== undefined && visibles.length === 0 ? (
            <EstadoVacio texto={t('analisis.diaVacio')} testID="dia-sin-movimientos" />
          ) : (
            <View style={estilos.lista}>
              {visibles.map((mov) => (
                <FilaDeMovimiento
                  key={mov.id}
                  mov={mov}
                  aspecto={aspectoDeMovimiento(mov, categorias, paleta)}
                  alPulsar={() => router.push({ pathname: '/movimiento', params: { id: mov.id } })}
                />
              ))}
            </View>
          )}
          <Boton
            texto={t('analisis.abrirEnMovimientos')}
            alPulsar={() =>
              router.navigate({
                pathname: '/movimientos',
                params: { dia: elegido, peticion: `dia-${elegido}` },
              })
            }
            testID="abrir-dia-en-movimientos"
            estilo={estilos.enlace}
          />
        </View>
      ) : null}
    </>
  );
}

// -------------------------------------------------------------------- mes

function VistaDeMes({
  panel,
  mes,
  alElegirMes,
}: {
  panel: Panel;
  mes: string;
  alElegirMes: (mes: string) => void;
}) {
  const c = useColores();
  const paleta = usePaleta();
  const { divisa, movimientos, categorias } = panel;
  const peticiones = useRef(0);
  const comparativa = comparativaConMesAnterior(movimientos, categorias, mes);
  const meses = evolucion(movimientos, mes);
  const hayEvolucion = meses.some((m) => m.ingresos > 0 || m.gastos > 0);

  const cambio = (l: LineaDeComparativa): string => {
    if (l.nuevo) return t('analisis.nuevo');
    if (l.diferencia === 0) return t('analisis.igual');
    const texto =
      l.diferencia > 0
        ? t('analisis.mas', { importe: importe(l.diferencia, divisa) })
        : t('analisis.menos', { importe: importe(-l.diferencia, divisa) });
    return l.porcentaje === null
      ? texto
      : t('analisis.conPorcentaje', { texto, porcentaje: porcentaje(l.porcentaje) });
  };
  const nombreDe = (clave: string) =>
    clave === SIN_CATEGORIA
      ? t('inicio.sinCategoria')
      : (categorias.find((x) => x.id === clave)?.nombre ?? t('inicio.sinCategoria'));

  function abrir(clave: string) {
    peticiones.current += 1;
    router.navigate({
      pathname: '/movimientos',
      params: {
        mes,
        ...(categorias.some((x) => x.id === clave) ? { categoriaId: clave } : {}),
        peticion: `analisis-${peticiones.current}`,
      },
    });
  }

  return (
    <>
      <Tarjeta
        titulo={t('analisis.comparativa', { mes: describirMes(comparativa.mesAnterior) })}
        testID="comparativa">
        {comparativa.lineas.length === 0 ? (
          <EstadoVacio
            texto={t('analisis.comparativaVacia', {
              mes: describirMes(mes),
              anterior: describirMes(comparativa.mesAnterior),
            })}
            testID="comparativa-vacia"
          />
        ) : (
          <>
            <View
              accessible
              accessibilityLabel={t('analisis.totalLeido', {
                actual: importe(comparativa.total.actual, divisa),
                anterior: importe(comparativa.total.anterior, divisa),
                cambio: cambio(comparativa.total),
              })}
              style={[estilos.total, { borderBottomColor: c.borde }]}>
              <View style={estilos.textos}>
                <Text style={[estilos.nombre, { color: c.texto }]}>{t('analisis.total')}</Text>
                <Text
                  style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}
                  testID="comparativa-total-cambio">
                  {cambio(comparativa.total)}
                </Text>
              </View>
              <Text
                style={[estilos.valor, cifrasTabulares, { color: c.texto }]}
                testID="comparativa-total">
                {importe(comparativa.total.actual, divisa)}
              </Text>
            </View>
            {comparativa.lineas.map((l) => (
              <Pressable
                key={l.clave}
                onPress={() => abrir(l.clave)}
                accessibilityRole="button"
                accessibilityLabel={t('analisis.lineaLeida', {
                  nombre: nombreDe(l.clave),
                  actual: importe(l.actual, divisa),
                  anterior: importe(l.anterior, divisa),
                  cambio: cambio(l),
                })}
                testID={`comparativa-${nombreDe(l.clave)}`}
                style={({ pressed }) => [estilos.linea, { opacity: pressed ? 0.6 : 1 }]}>
                <DistintivoDeCategoria
                  aspecto={aspectoDeParte(l.clave, categorias, paleta)}
                  lado={36}
                />
                <View style={estilos.textos}>
                  <Text style={[estilos.nombre, { color: c.texto }]}>{nombreDe(l.clave)}</Text>
                  <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>
                    {`${l.diferencia > 0 ? '▲ ' : l.diferencia < 0 ? '▼ ' : ''}${cambio(l)}`}
                  </Text>
                </View>
                <View style={estilos.cifras}>
                  <Text style={[estilos.valor, cifrasTabulares, { color: c.texto }]}>
                    {importe(l.actual, divisa)}
                  </Text>
                  <Text
                    style={[
                      cifrasTabulares,
                      { color: c.textoSecundario, fontSize: Letra.pequeno },
                    ]}>
                    {t('analisis.antes', { importe: importe(l.anterior, divisa) })}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </Tarjeta>

      <Tarjeta titulo={t('inicio.evolucion')}>
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
              alElegir={alElegirMes}
            />
          </>
        ) : (
          <EstadoVacio texto={t('inicio.evolucionVacio')} testID="evolucion-vacia" />
        )}
      </Tarjeta>
    </>
  );
}

// -------------------------------------------------------------------- año

function VistaDeAnio({ panel, anio }: { panel: Panel; anio: number }) {
  const c = useColores();
  const paleta = usePaleta();
  const { hoy, divisa, cuentas, movimientos, valores, categorias } = panel;
  const peticiones = useRef(0);
  const r = resumenDelAnio(movimientos, categorias, anio);
  const patrimonio = variacionDelAnio(cuentas, movimientos, valores, anio, hoy);

  function abrirInicioEn(mes: string) {
    peticiones.current += 1;
    router.navigate({
      pathname: '/',
      params: { mes, peticion: `anio-${peticiones.current}` },
    });
  }

  const nombreDe = (clave: string) => {
    if (clave === OTRAS) return t('inicio.otras');
    if (clave === SIN_CATEGORIA) return t('inicio.sinCategoria');
    return categorias.find((x) => x.id === clave)?.nombre ?? t('inicio.sinCategoria');
  };
  const partes = r.gastoPorCategoria.partes.map((p) => ({
    ...p,
    nombre: nombreDe(p.clave),
    aspecto: aspectoDeParte(p.clave, categorias, paleta),
  }));

  const bloqueDePatrimonio = (
    <Tarjeta titulo={t('analisis.patrimonioDelAnio')} testID="patrimonio-del-anio">
      {patrimonio ? (
        <>
          <Text
            style={[
              estilos.cifra,
              cifrasTabulares,
              {
                color:
                  patrimonio.diferencia > 0
                    ? c.positivo
                    : patrimonio.diferencia < 0
                      ? c.negativo
                      : c.texto,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            maxFontSizeMultiplier={1.6}
            testID="patrimonio-del-anio-cifra">
            {conSigno(patrimonio.diferencia, divisa)}
          </Text>
          <Text style={[estilos.nota, { color: c.textoSecundario }]}>
            {patrimonio.porcentaje === null
              ? t('analisis.patrimonioCambio', {
                  diferencia: conSigno(patrimonio.diferencia, divisa),
                  desde: fechaLarga(patrimonio.desde),
                  hasta: fechaLarga(patrimonio.hasta),
                })
              : t('analisis.patrimonioCambioConPorcentaje', {
                  diferencia: conSigno(patrimonio.diferencia, divisa),
                  porcentaje: porcentaje(patrimonio.porcentaje),
                  desde: fechaLarga(patrimonio.desde),
                  hasta: fechaLarga(patrimonio.hasta),
                })}
          </Text>
        </>
      ) : (
        <EstadoVacio
          texto={t('analisis.patrimonioSinDatos', { anio })}
          testID="patrimonio-del-anio-vacio"
        />
      )}
    </Tarjeta>
  );

  if (r.mesesConDatos === 0) {
    return (
      <>
        <Tarjeta>
          <EstadoVacio texto={t('analisis.anioVacio', { anio })} testID="anio-vacio" />
        </Tarjeta>
        {bloqueDePatrimonio}
      </>
    );
  }

  return (
    <>
      <Tarjeta titulo={t('analisis.balanceDelAnio')} testID="totales-del-anio">
        <View
          accessible
          accessibilityLabel={t('analisis.anioLeido', {
            anio,
            balance: conSigno(r.balance, divisa),
            ingresos: importe(r.ingresos, divisa),
            gastos: importe(r.gastos, divisa),
          })}>
          <Text
            style={[
              estilos.cifra,
              cifrasTabulares,
              { color: r.balance < 0 ? c.negativo : c.texto },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            maxFontSizeMultiplier={1.6}
            testID="balance-del-anio">
            {conSigno(r.balance, divisa)}
          </Text>
          {r.tasaDeAhorro !== null && r.balance >= 0 ? (
            <Text
              style={{ color: c.textoSecundario, fontSize: Letra.secundario }}
              testID="ahorro-del-anio">
              {t('analisis.ahorro', { porcentaje: r.tasaDeAhorro })}
            </Text>
          ) : null}
        </View>
        <View style={estilos.datos}>
          <Dato
            etiqueta={t('inicio.ingresos')}
            valor={conSigno(r.ingresos, divisa)}
            color={r.ingresos > 0 ? c.positivo : c.texto}
            testID="ingresos-del-anio"
          />
          <Dato
            etiqueta={t('inicio.gastos')}
            valor={conSigno(-r.gastos, divisa)}
            testID="gastos-del-anio"
          />
        </View>
        <Leyenda
          elementos={[
            { color: c.positivo, texto: t('inicio.ingresos') },
            { color: c.acento, texto: t('inicio.gastos') },
          ]}
        />
        <Barras
          grupos={r.meses.map((m) => ({
            clave: m.mes,
            etiqueta: mesCorto(m.mes),
            descripcion: t('analisis.barrasLeidas', {
              mes: describirMes(m.mes),
              ingresos: importe(m.ingresos, divisa),
              gastos: importe(m.gastos, divisa),
            }),
            valores: [m.ingresos, m.gastos],
          }))}
          colores={[c.positivo, c.acento]}
          alto={110}
        />
      </Tarjeta>

      <Tarjeta titulo={t('analisis.destacados')}>
        <Dato
          etiqueta={t('analisis.mesDeMasGasto')}
          valor={
            r.mesDeMayorGasto
              ? t('analisis.mesYImporte', {
                  mes: describirMes(r.mesDeMayorGasto.mes),
                  importe: importe(r.mesDeMayorGasto.gastos, divisa),
                })
              : t('analisis.sinDato')
          }
          testID="mes-de-mas-gasto"
        />
        {r.mesDeMenorGasto ? (
          <Dato
            etiqueta={t('analisis.mesDeMenosGasto')}
            valor={t('analisis.mesYImporte', {
              mes: describirMes(r.mesDeMenorGasto.mes),
              importe: importe(r.mesDeMenorGasto.gastos, divisa),
            })}
            testID="mes-de-menos-gasto"
          />
        ) : null}
        <Dato
          etiqueta={t('analisis.mediaMensual')}
          valor={r.mediaMensual === null ? t('analisis.sinDato') : importe(r.mediaMensual, divisa)}
          testID="media-mensual"
        />
        <Text style={[estilos.nota, { color: c.textoSecundario }]}>
          {r.mesesConDatos === 1
            ? t('analisis.mediaMensualAyudaUno')
            : t('analisis.mediaMensualAyuda', { meses: r.mesesConDatos })}
        </Text>
      </Tarjeta>

      <Tarjeta titulo={t('analisis.mesAMes')} testID="tabla-del-anio">
        <View style={estilos.filaDeTabla}>
          <Text style={[estilos.celdaDeMes, estilos.rotulo, { color: c.textoSecundario }]}>
            {t('analisis.columnaMes')}
          </Text>
          {(['columnaIngresos', 'columnaGastos', 'columnaBalance'] as const).map((columna) => (
            <Text
              key={columna}
              style={[estilos.celda, estilos.rotulo, { color: c.textoSecundario }]}
              numberOfLines={1}>
              {t(`analisis.${columna}`)}
            </Text>
          ))}
        </View>
        {r.meses.map((m) => (
          <Pressable
            key={m.mes}
            onPress={() => abrirInicioEn(m.mes)}
            accessibilityRole="button"
            accessibilityLabel={
              m.movimientos === 0
                ? t('analisis.mesSinDatos', { mes: describirMes(m.mes) })
                : t('analisis.mesLeido', {
                    mes: describirMes(m.mes),
                    ingresos: importe(m.ingresos, divisa),
                    gastos: importe(m.gastos, divisa),
                    balance: conSigno(m.balance, divisa),
                  })
            }
            testID={`fila-${m.mes}`}
            style={({ pressed }) => [
              estilos.filaDeTabla,
              estilos.filaDeMes,
              { borderTopColor: c.borde, opacity: pressed ? 0.6 : 1 },
            ]}>
            <Text style={[estilos.celdaDeMes, { color: c.texto }]} maxFontSizeMultiplier={1.5}>
              {mesCorto(m.mes)}
            </Text>
            {m.movimientos === 0 ? (
              <Text style={[estilos.celdaVacia, { color: c.textoSecundario }]}>
                {t('analisis.sinDato')}
              </Text>
            ) : (
              <>
                <Celda texto={sinCentimos(m.ingresos)} color={c.texto} />
                <Celda texto={sinCentimos(m.gastos)} color={c.texto} />
                <Celda
                  texto={`${m.balance > 0 ? '+' : ''}${sinCentimos(m.balance)}`}
                  color={m.balance < 0 ? c.negativo : m.balance > 0 ? c.positivo : c.texto}
                />
              </>
            )}
          </Pressable>
        ))}
      </Tarjeta>

      <Tarjeta titulo={t('analisis.gastoDelAnio')} testID="gasto-del-anio">
        {partes.length === 0 ? (
          <EstadoVacio texto={t('inicio.gastoVacio')} />
        ) : (
          <>
            <View style={estilos.anillo}>
              <Anillo
                clave={`${anio}-${r.gastos}`}
                sectores={partes.map((p) => ({
                  clave: p.clave,
                  valor: p.importe,
                  color: p.aspecto.color,
                }))}
                descripcion={t('inicio.anilloLeido', {
                  mes: String(anio),
                  total: importe(r.gastos, divisa),
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
                  style={[estilos.centro, cifrasTabulares, { color: c.texto }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}>
                  {importe(r.gastos, divisa)}
                </Text>
              </Anillo>
            </View>
            {partes.map((p) => (
              <View
                key={p.clave}
                accessible
                accessibilityLabel={`${p.nombre}: ${importe(p.importe, divisa)}, ${p.porcentaje} %`}
                style={estilos.linea}>
                <DistintivoDeCategoria aspecto={p.aspecto} lado={36} />
                <Text style={[estilos.nombre, estilos.textos, { color: c.texto }]}>{p.nombre}</Text>
                <View style={estilos.cifras}>
                  <Text style={[estilos.valor, cifrasTabulares, { color: c.texto }]}>
                    {importe(p.importe, divisa)}
                  </Text>
                  <Text
                    style={[
                      cifrasTabulares,
                      { color: c.textoSecundario, fontSize: Letra.pequeno },
                    ]}>
                    {`${p.porcentaje} %`}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </Tarjeta>

      {bloqueDePatrimonio}
    </>
  );
}

function Celda({ texto, color }: { texto: string; color: string }) {
  return (
    <Text
      style={[estilos.celda, cifrasTabulares, { color }]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.5}
      maxFontSizeMultiplier={1.5}>
      {texto}
    </Text>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { paddingHorizontal: Espacio.m, gap: Espacio.m },
  selector: { flexDirection: 'row', alignItems: 'center', gap: Espacio.s },
  flecha: {
    width: TactilMinimo,
    height: TactilMinimo,
    borderRadius: TactilMinimo / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anio: { flex: 1, textAlign: 'center', fontSize: Letra.cuerpo, fontWeight: '700' },
  datos: { flexDirection: 'row', gap: Espacio.s },
  cifra: { fontSize: Letra.cifra, fontWeight: '800', letterSpacing: -0.5 },
  nota: { fontSize: Letra.pequeno, lineHeight: 18 },
  seccion: {
    fontSize: Letra.pequeno,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: Espacio.xs,
  },
  lista: { marginHorizontal: -Espacio.m, paddingTop: Espacio.s },
  enlace: { alignSelf: 'flex-start', paddingHorizontal: Espacio.xs },
  filaDeDia: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Espacio.xs,
    gap: Espacio.s,
    flexWrap: 'wrap',
  },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espacio.s,
    paddingBottom: Espacio.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  linea: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.xs,
    gap: Espacio.m,
  },
  textos: { flex: 1, gap: 2 },
  nombre: { fontSize: Letra.cuerpo, fontWeight: '600', flexShrink: 1 },
  cifras: { alignItems: 'flex-end' },
  valor: { fontSize: Letra.cuerpo, fontWeight: '700' },
  anillo: { alignItems: 'center', paddingVertical: Espacio.s },
  centro: { fontSize: Letra.subtitulo, fontWeight: '800' },
  filaDeTabla: { flexDirection: 'row', alignItems: 'center', gap: Espacio.xs },
  filaDeMes: { minHeight: TactilMinimo, borderTopWidth: StyleSheet.hairlineWidth },
  rotulo: { fontSize: Letra.pequeno, fontWeight: '600', paddingBottom: Espacio.xs },
  celdaDeMes: { width: 44, fontSize: Letra.secundario, fontWeight: '600' },
  celda: { flex: 1, textAlign: 'right', fontSize: Letra.secundario },
  celdaVacia: { flex: 1, textAlign: 'right', fontSize: Letra.secundario },
});
