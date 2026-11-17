import { StyleSheet, Text } from 'react-native';

import { Leyenda, Linea } from '@/componentes/Graficos';
import { EstadoVacio, Tarjeta } from '@/componentes/Tarjeta';
import { lineaDePrevision, previsionDeFinDeMes } from '@/dominio/prevision';
import { pendientesDelMes } from '@/dominio/recurrentes';
import { diasDelMes } from '@/dominio/tiempo';
import { importe } from '@/estado/formato';
import type { usePanel } from '@/estado/panel';
import { usePlan } from '@/estado/plan';
import { t } from '@/i18n';
import { cifrasTabulares, Letra, useColores } from '@/theme';

/**
 * D4 · Fin de mes previsto: con cuánto se llegará a fin de mes en banco y
 * efectivo, y la línea del saldo real y el estimado. Habla siempre de hoy y
 * del mes en curso. Se muestra en Plan › Presupuesto.
 */
export function FinDeMes({ panel }: { panel: ReturnType<typeof usePanel> }) {
  const c = useColores();
  const { hoy, divisa, cuentas, movimientos } = panel;
  const mes = hoy.slice(0, 7);
  const plan = usePlan();
  const reglas = plan.reglas.filter((r) => r.divisa === divisa);
  const pendientes = pendientesDelMes(reglas, movimientos, mes, hoy);
  const hayLiquidas = cuentas.some((x) => x.tipo !== 'inversion');

  const prevision = previsionDeFinDeMes(cuentas, movimientos, pendientes, hoy);
  const linea = lineaDePrevision(cuentas, movimientos, prevision.previsto, hoy);
  const saldos = [...linea.real, ...linea.estimado].map((p) => p.saldo);
  const dia = Number(hoy.slice(8, 10));

  if (!panel.cargado || !plan.cargado) return null;
  return (
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
  );
}

const estilos = StyleSheet.create({
  cifra: { fontSize: Letra.cifra, fontWeight: '800', letterSpacing: -0.5 },
  nota: { fontSize: Letra.pequeno, lineHeight: 18 },
});
