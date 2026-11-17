import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/componentes/basicos';
import { Leyenda, Linea } from '@/componentes/Graficos';
import { BarraDePresupuesto, FilaDeCobro, FilaDeObjetivo } from '@/componentes/plan/Piezas';
import { abrirCobro } from '@/componentes/plan/SeccionFijos';
import { EstadoVacio, Tarjeta } from '@/componentes/Tarjeta';
import { estadoDeObjetivo } from '@/dominio/objetivos';
import { disponibleDelMes, estadoDeLinea, estadoDelPresupuesto } from '@/dominio/presupuesto';
import { lineaDePrevision, previsionDeFinDeMes } from '@/dominio/prevision';
import {
  fijosPendientes,
  pendientesDelMes,
  porConfirmar,
  proximosCobros,
} from '@/dominio/recurrentes';
import { diasDelMes } from '@/dominio/tiempo';
import { describirMes } from '@/estado/fechas';
import { importe } from '@/estado/formato';
import type { usePanel } from '@/estado/panel';
import { useConfirmarCobro, usePlan, usePresupuesto } from '@/estado/plan';
import { t } from '@/i18n';
import { cifrasTabulares, Espacio, Letra, useColores } from '@/theme';

/** Objetivos que caben en Inicio. El resto se ve en la pestaña Plan. */
const OBJETIVOS_EN_INICIO = 3;

/**
 * Bloques de planificación de Inicio (T-084): disponible del mes (D1), aviso
 * de presupuesto (T-067, en pantalla), cobros por confirmar, próximos cobros
 * (D9), fin de mes previsto (D4) y objetivos (D8). Hablan siempre de hoy y
 * del mes en curso. Cada uno, sin datos, explica qué falta y cómo crearlo.
 */
export function BloquesDeInicio({ panel }: { panel: ReturnType<typeof usePanel> }) {
  const c = useColores();
  const { hoy, divisa, divisas, cuentas, movimientos, categorias, sinCuentas } = panel;
  const mes = hoy.slice(0, 7);
  const plan = usePlan();
  const confirmar = useConfirmarCobro();
  // El presupuesto no lleva divisa: se entiende en la divisa principal.
  const enDivisaPrincipal = divisa === (divisas[0] ?? divisa);
  const presupuesto = usePresupuesto(mes);

  const reglas = plan.reglas.filter((r) => r.divisa === divisa);
  const pendientes = pendientesDelMes(reglas, movimientos, mes, hoy);
  const vencidos = porConfirmar(reglas, movimientos, hoy);
  const proximos = proximosCobros(reglas, movimientos, hoy);
  const objetivos = plan.objetivos.filter((o) => o.divisa === divisa && !o.archivado);
  const hayLiquidas = cuentas.some((x) => x.tipo !== 'inversion');

  const estado = presupuesto
    ? estadoDelPresupuesto(presupuesto.lineas, movimientos, categorias, mes, hoy)
    : null;
  const d1 = estado
    ? disponibleDelMes(estado.presupuestado, estado.gastado, fijosPendientes(pendientes), mes, hoy)
    : null;
  const lineasConAviso = (estado?.lineas ?? []).filter((l) => l.estado !== 'dentro');
  const nombreDe = (categoriaId: string) =>
    categorias.find((x) => x.id === categoriaId)?.nombre ?? t('inicio.sinCategoria');

  const prevision = previsionDeFinDeMes(cuentas, movimientos, pendientes, hoy);
  const linea = lineaDePrevision(cuentas, movimientos, prevision.previsto, hoy);
  const saldos = [...linea.real, ...linea.estimado].map((p) => p.saldo);
  const dia = Number(hoy.slice(8, 10));

  let detalleDeDisponible = '';
  if (d1) {
    if (d1.exceso > 0) {
      detalleDeDisponible = t('inicio.tePasas', { importe: importe(d1.exceso, divisa) });
    } else if (d1.diasQueQuedan === 1) {
      detalleDeDisponible = t('inicio.porDiaUno', { importe: importe(d1.porDia, divisa) });
    } else {
      detalleDeDisponible = t('inicio.porDia', {
        importe: importe(d1.porDia, divisa),
        dias: d1.diasQueQuedan,
      });
    }
  }

  return (
    <>
      {/* D1 · Disponible este mes. */}
      {enDivisaPrincipal && presupuesto !== undefined ? (
        <Tarjeta titulo={t('inicio.disponible')} testID="bloque-disponible">
          {d1 && estado ? (
            <>
              <View
                accessible
                accessibilityLabel={t('inicio.disponibleLeido', {
                  importe: importe(d1.disponible, divisa),
                  detalle: detalleDeDisponible,
                })}>
                <Text
                  style={[
                    estilos.cifra,
                    cifrasTabulares,
                    { color: d1.disponible < 0 ? c.negativo : c.texto },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                  maxFontSizeMultiplier={1.6}
                  testID="disponible">
                  {importe(Math.max(0, d1.disponible), divisa)}
                </Text>
                <Text
                  style={{
                    color: d1.exceso > 0 ? c.negativo : c.textoSecundario,
                    fontSize: Letra.secundario,
                    fontWeight: d1.exceso > 0 ? '700' : '400',
                  }}
                  testID="disponible-por-dia">
                  {detalleDeDisponible}
                </Text>
              </View>
              <BarraDePresupuesto
                real={estado.gastado + fijosPendientes(pendientes)}
                previsto={estado.presupuestado}
                estado={estadoDeLinea(
                  estado.presupuestado,
                  estado.gastado + fijosPendientes(pendientes),
                )}
                marca={estado.marcaDelDia}
              />
              <Text style={[estilos.nota, { color: c.textoSecundario }]}>
                {t('inicio.comprometido', { porcentaje: d1.avance })}
              </Text>
            </>
          ) : (
            <EstadoVacio
              texto={t('inicio.sinPresupuesto', { mes: describirMes(mes) })}
              testID="disponible-vacio"
              accion={{
                texto: t('inicio.crearPresupuesto'),
                alPulsar: () => router.push({ pathname: '/presupuesto', params: { mes } }),
                testID: 'crear-presupuesto',
              }}
            />
          )}
        </Tarjeta>
      ) : null}

      {/* T-067 · Aviso de presupuesto: se deriva del estado, no se guarda. */}
      {enDivisaPrincipal && lineasConAviso.length > 0 ? (
        <Tarjeta titulo={`⚠ ${t('presupuesto.avisoTitulo')}`} testID="aviso-de-presupuesto">
          {lineasConAviso.map((l) => (
            <Text
              key={l.categoriaId}
              style={{
                color: l.estado === 'excedida' ? c.negativo : c.aviso,
                fontSize: Letra.secundario,
                fontWeight: '600',
              }}>
              {l.estado === 'excedida'
                ? t('presupuesto.avisoExcedida', {
                    nombre: nombreDe(l.categoriaId),
                    importe: importe(-l.queda, divisa),
                  })
                : t('presupuesto.avisoCerca', {
                    nombre: nombreDe(l.categoriaId),
                    porcentaje: l.porcentaje ?? 100,
                  })}
            </Text>
          ))}
          <Boton
            texto={t('comun.ver')}
            etiqueta={`${t('comun.ver')} ${t('plan.presupuesto')}`}
            alPulsar={() =>
              router.navigate({ pathname: '/plan', params: { seccion: 'presupuesto', mes } })
            }
            testID="ver-presupuesto"
            estilo={estilos.enlace}
          />
        </Tarjeta>
      ) : null}

      {/* Cobros con el día ya vencido. Solo aparece si hay alguno. */}
      {vencidos.length > 0 ? (
        <Tarjeta titulo={t('inicio.porConfirmar')} testID="bloque-por-confirmar">
          {vencidos.map((o, i) => (
            <FilaDeCobro
              key={`${o.regla.id}-${o.mes}`}
              ocurrencia={o}
              separador={i > 0}
              alAbrir={() => abrirCobro(o)}
              alConfirmar={() => confirmar(o.regla.id, o.mes, o.regla.nombre)}
            />
          ))}
        </Tarjeta>
      ) : null}

      {/* D9 · Próximos cobros. */}
      {plan.cargado ? (
        <Tarjeta titulo={t('inicio.proximosCobros')} testID="bloque-proximos">
          {reglas.length === 0 ? (
            <EstadoVacio
              texto={t('inicio.sinFijos')}
              testID="proximos-sin-fijos"
              accion={
                sinCuentas
                  ? undefined
                  : {
                      texto: t('inicio.anadirFijo'),
                      alPulsar: () => router.push('/regla'),
                      testID: 'anadir-fijo',
                    }
              }
            />
          ) : proximos.length === 0 ? (
            <Text style={[estilos.nota, { color: c.textoSecundario }]} testID="proximos-vacio">
              {t('inicio.proximosVacio')}
            </Text>
          ) : (
            proximos.map((o, i) => (
              <FilaDeCobro
                key={`${o.regla.id}-${o.mes}`}
                ocurrencia={o}
                separador={i > 0}
                alAbrir={() => abrirCobro(o)}
              />
            ))
          )}
        </Tarjeta>
      ) : null}

      {/* D4 · Fin de mes previsto. */}
      {panel.cargado && plan.cargado ? (
        <Tarjeta titulo={t('inicio.finDeMes')} testID="bloque-fin-de-mes">
          {hayLiquidas ? (
            <>
              <Text
                style={[
                  estilos.cifra,
                  cifrasTabulares,
                  { color: prevision.previsto < 0 ? c.negativo : c.texto },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                maxFontSizeMultiplier={1.6}
                accessibilityLabel={t('inicio.finDeMesLeido', {
                  previsto: importe(prevision.previsto, divisa),
                  saldo: importe(prevision.saldoActual, divisa),
                })}
                testID="fin-de-mes-previsto">
                {importe(prevision.previsto, divisa)}
              </Text>
              <Leyenda
                elementos={[
                  { color: c.acento, texto: t('inicio.saldoReal') },
                  { color: c.textoSecundario, texto: t('inicio.saldoPrevisto') },
                ]}
              />
              <Linea
                alto={110}
                total={diasDelMes(mes)}
                etiquetasEnExtremos
                series={[
                  {
                    clave: 'previsto',
                    color: c.textoSecundario,
                    valores: linea.estimado.map((p) => p.saldo),
                    posiciones: linea.estimado.map((p) => Number(p.fecha.slice(8, 10)) - 1),
                    discontinua: true,
                  },
                  {
                    clave: 'real',
                    color: c.acento,
                    valores: linea.real.map((p) => p.saldo),
                    posiciones: linea.real.map((_, i) => i),
                  },
                ]}
                etiquetas={['1', String(dia), String(diasDelMes(mes))].filter(
                  (x, i, lista) => lista.indexOf(x) === i,
                )}
                textoMaximo={importe(Math.max(...saldos), divisa)}
                textoMinimo={importe(Math.min(...saldos), divisa)}
                descripcion={t('inicio.lineaLeida', {
                  inicio: importe(linea.real[0].saldo, divisa),
                  hoy: importe(prevision.saldoActual, divisa),
                  fin: importe(prevision.previsto, divisa),
                })}
              />
              <Text style={[estilos.nota, { color: c.textoSecundario }]}>
                {t('inicio.finDeMesAyuda')}
              </Text>
            </>
          ) : (
            <EstadoVacio texto={t('inicio.finDeMesSinDatos')} testID="fin-de-mes-vacio" />
          )}
        </Tarjeta>
      ) : null}

      {/* D8 · Objetivos. */}
      {plan.cargado ? (
        <Tarjeta titulo={t('inicio.objetivos')} testID="bloque-objetivos">
          {objetivos.length === 0 ? (
            <EstadoVacio
              texto={t('inicio.sinObjetivos')}
              testID="objetivos-vacio"
              accion={{
                texto: t('inicio.crearObjetivo'),
                alPulsar: () => router.push('/objetivo-editar'),
                testID: 'crear-objetivo',
              }}
            />
          ) : (
            <>
              {objetivos.slice(0, OBJETIVOS_EN_INICIO).map((objetivo, i) => (
                <FilaDeObjetivo
                  key={objetivo.id}
                  objetivo={objetivo}
                  estado={estadoDeObjetivo(objetivo, plan.aportaciones, hoy)}
                  separador={i > 0}
                  alPulsar={() =>
                    router.push({ pathname: '/objetivo', params: { id: objetivo.id } })
                  }
                />
              ))}
              {objetivos.length > OBJETIVOS_EN_INICIO ? (
                <Boton
                  texto={t('inicio.verTodos')}
                  alPulsar={() =>
                    router.navigate({ pathname: '/plan', params: { seccion: 'objetivos' } })
                  }
                  testID="ver-objetivos"
                  estilo={estilos.enlace}
                />
              ) : null}
            </>
          )}
        </Tarjeta>
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  cifra: { fontSize: Letra.cifra, fontWeight: '800', letterSpacing: -0.5 },
  nota: { fontSize: Letra.pequeno, lineHeight: 18 },
  enlace: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: Espacio.xs },
});
