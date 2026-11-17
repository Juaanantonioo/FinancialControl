import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Boton } from '@/componentes/basicos';
import { Calendario } from '@/componentes/Graficos';
import { FilaDeCobro, importeDeRegla } from '@/componentes/plan/Piezas';
import { EstadoVacio, SelectorDeMes, Tarjeta } from '@/componentes/Tarjeta';
import {
  CLASES_DE_REGLA,
  estaVigente,
  ocurrenciasDelMes,
  porConfirmar,
  proximosCobros,
  totalMensualDeFijos,
  type Ocurrencia,
  type ReglaRecurrente,
} from '@/dominio/recurrentes';
import { moverMes } from '@/dominio/resumen';
import { diasDelMes, type DiaDelMes } from '@/dominio/tiempo';
import { describirMes, fechaLarga } from '@/estado/fechas';
import { importe, importeExactoCorto } from '@/estado/formato';
import type { usePanel } from '@/estado/panel';
import { useConfirmarCobro, usePlan } from '@/estado/plan';
import { t, type ClaveTexto } from '@/i18n';
import { cifrasTabulares, Espacio, Letra, TactilMinimo, useColores } from '@/theme';

/** A partir de este tamaño de letra el calendario no cabe y se muestra la lista del mes. */
const ESCALA_MAXIMA_DEL_CALENDARIO = 1.35;

export function abrirCobro(o: Ocurrencia<ReglaRecurrente>) {
  router.push({ pathname: '/cobro', params: { reglaId: o.regla.id, mes: o.mes } });
}

/** Cuándo ocurre una regla, en palabras. */
export function cuandoOcurre(regla: ReglaRecurrente, hoy: string): string {
  if (!regla.activa) return t('fijos.inactiva');
  if (regla.fechaFin !== null && regla.fechaFin < hoy) {
    return t('fijos.terminada', { fecha: fechaLarga(regla.fechaFin) });
  }
  const base =
    regla.periodicidad === 'mensual'
      ? t('fijos.cadaMes', { dia: regla.diaDelMes })
      : t('fijos.cadaAnio', {
          dia: regla.diaDelMes,
          mes: t(`fechas.mes${Number(regla.fechaInicio.slice(5, 7))}` as ClaveTexto),
        });
  return regla.fechaFin === null
    ? base
    : `${base} · ${t('fijos.hasta', { fecha: fechaLarga(regla.fechaFin) })}`;
}

/**
 * P13 · Gastos fijos: total mensual, cobros por confirmar, calendario del
 * mes con los días de cobro, próximos 14 días y lista de reglas por clase.
 */
export function SeccionFijos({
  panel,
  mes,
  alCambiarMes,
}: {
  panel: ReturnType<typeof usePanel>;
  mes: string;
  alCambiarMes: (mes: string) => void;
}) {
  const c = useColores();
  const { fontScale } = useWindowDimensions();
  const { hoy, divisa, movimientos } = panel;
  const plan = usePlan();
  const confirmar = useConfirmarCobro();
  const reglas = plan.reglas.filter((r) => r.divisa === divisa);
  const nueva = () => router.push('/regla');

  if (plan.cargado && reglas.length === 0) {
    return (
      <Tarjeta testID="fijos-vacio">
        <EstadoVacio
          texto={t('fijos.vacio')}
          accion={{ texto: t('fijos.nuevo'), alPulsar: nueva, testID: 'crear-fijo' }}
        />
      </Tarjeta>
    );
  }

  const vencidos = porConfirmar(reglas, movimientos, hoy);
  const proximos = proximosCobros(reglas, movimientos, hoy);
  const delMes = ocurrenciasDelMes(reglas, movimientos, mes, hoy);
  // El calendario marca los cobros de gasto de cada día.
  const dias: DiaDelMes[] = Array.from({ length: diasDelMes(mes) }, (_, i) => ({
    fecha: `${mes}-${String(i + 1).padStart(2, '0')}`,
    dia: i + 1,
    gasto: 0,
    ingreso: 0,
    movimientos: 0,
  }));
  for (const o of delMes) {
    const casilla = dias[Number(o.fecha.slice(8, 10)) - 1];
    casilla.movimientos++;
    if (o.regla.tipoMovimiento === 'ingreso') casilla.ingreso += o.regla.importe;
    else casilla.gasto += o.regla.importe;
  }
  const describirDia = (dia: DiaDelMes) => {
    const cobros = delMes.filter((o) => o.fecha === dia.fecha);
    if (cobros.length === 0) return t('fijos.diaSinCobros', { fecha: fechaLarga(dia.fecha) });
    return t('fijos.diaLeido', {
      fecha: fechaLarga(dia.fecha),
      cobros: cobros
        .map((o) =>
          t('fijos.cobroCorto', { nombre: o.regla.nombre, importe: importeDeRegla(o.regla) }),
        )
        .join('; '),
    });
  };

  const filaDeRegla = (regla: ReglaRecurrente, i: number) => (
    <Pressable
      key={regla.id}
      onPress={() => router.push({ pathname: '/regla', params: { id: regla.id } })}
      accessibilityRole="button"
      accessibilityLabel={t('fijos.reglaLeida', {
        nombre: regla.nombre,
        importe: importeDeRegla(regla),
        cuando: cuandoOcurre(regla, hoy),
      })}
      testID={`regla-${regla.nombre}`}
      style={({ pressed }) => [
        estilos.regla,
        i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borde },
        { opacity: pressed ? 0.6 : estaVigente(regla, hoy) ? 1 : 0.55 },
      ]}>
      <View style={estilos.textos}>
        <Text style={[estilos.nombre, { color: c.texto }]}>{regla.nombre}</Text>
        <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>
          {cuandoOcurre(regla, hoy)}
        </Text>
      </View>
      <Text
        style={[
          estilos.importe,
          cifrasTabulares,
          { color: regla.tipoMovimiento === 'ingreso' ? c.positivo : c.texto },
        ]}>
        {importeDeRegla(regla)}
      </Text>
    </Pressable>
  );

  const mensuales = reglas.filter((r) => r.periodicidad === 'mensual');
  const anuales = reglas.filter((r) => r.periodicidad === 'anual');

  return (
    <>
      <Boton
        texto={t('fijos.nuevo')}
        variante="primario"
        alPulsar={nueva}
        testID="nuevo-fijo"
        estilo={estilos.nuevo}
      />
      <Tarjeta testID="total-de-fijos">
        <View
          accessible
          accessibilityLabel={`${t('fijos.totalMensual')}: ${importe(
            totalMensualDeFijos(reglas, hoy),
            divisa,
          )}. ${t('fijos.totalMensualAyuda')}`}>
          <Text style={{ color: c.textoSecundario, fontSize: Letra.secundario }}>
            {t('fijos.totalMensual')}
          </Text>
          <Text
            style={[estilos.cifra, cifrasTabulares, { color: c.texto }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            maxFontSizeMultiplier={1.6}
            testID="total-mensual">
            {importe(totalMensualDeFijos(reglas, hoy), divisa)}
          </Text>
          <Text style={[estilos.nota, { color: c.textoSecundario }]}>
            {t('fijos.totalMensualAyuda')}
          </Text>
        </View>
      </Tarjeta>

      {vencidos.length > 0 ? (
        <Tarjeta titulo={t('fijos.porConfirmar')} testID="fijos-por-confirmar">
          <Text style={[estilos.nota, { color: c.textoSecundario }]}>
            {t('fijos.porConfirmarAyuda')}
          </Text>
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

      <Tarjeta titulo={t('fijos.proximos')} testID="fijos-proximos">
        {proximos.length === 0 ? (
          <Text style={[estilos.nota, { color: c.textoSecundario }]} testID="proximos-vacio">
            {t('fijos.proximosVacio')}
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

      <SelectorDeMes mes={mes} alCambiar={(salto) => alCambiarMes(moverMes(mes, salto))} />
      <Tarjeta
        titulo={
          fontScale > ESCALA_MAXIMA_DEL_CALENDARIO
            ? t('fijos.listaDelMes', { mes: describirMes(mes) })
            : t('fijos.calendario', { mes: describirMes(mes) })
        }
        testID="fijos-calendario">
        {delMes.length === 0 ? (
          <Text style={[estilos.nota, { color: c.textoSecundario }]} testID="calendario-vacio">
            {t('fijos.calendarioVacio')}
          </Text>
        ) : fontScale > ESCALA_MAXIMA_DEL_CALENDARIO ? null : (
          <Calendario
            mes={mes}
            dias={dias}
            hoy={hoy}
            elegido={null}
            alElegir={() => undefined}
            cifra={importeExactoCorto}
            descripcion={describirDia}
          />
        )}
        {delMes.map((o, i) => (
          <View
            key={o.regla.id}
            accessible
            accessibilityLabel={`${describirDia(dias[Number(o.fecha.slice(8, 10)) - 1])}${
              o.estado === 'confirmada' ? `. ${t('fijos.confirmadaMarca')}` : ''
            }`}
            testID={`del-mes-${o.regla.nombre}`}
            style={[
              estilos.delMes,
              (i > 0 || fontScale <= ESCALA_MAXIMA_DEL_CALENDARIO) && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: c.borde,
              },
            ]}>
            <Text style={[estilos.diaDelMes, cifrasTabulares, { color: c.acento }]}>
              {Number(o.fecha.slice(8, 10))}
            </Text>
            <View style={estilos.textos}>
              <Text style={{ color: c.texto, fontSize: Letra.secundario }}>{o.regla.nombre}</Text>
              {o.estado === 'confirmada' ? (
                <Text style={{ color: c.positivo, fontSize: Letra.pequeno, fontWeight: '700' }}>
                  {t('fijos.confirmadaMarca')}
                </Text>
              ) : null}
            </View>
            <Text style={[cifrasTabulares, { color: c.texto, fontSize: Letra.secundario }]}>
              {importeDeRegla(o.regla)}
            </Text>
          </View>
        ))}
      </Tarjeta>

      {CLASES_DE_REGLA.map((clase) => {
        const deLaClase = mensuales.filter((r) => r.clase === clase);
        if (deLaClase.length === 0) return null;
        return (
          <Tarjeta key={clase} titulo={t(`fijos.clase_${clase}`)} testID={`grupo-${clase}`}>
            {deLaClase.map(filaDeRegla)}
          </Tarjeta>
        );
      })}
      {anuales.length > 0 ? (
        <Tarjeta titulo={t('fijos.anuales')} testID="grupo-anuales">
          {anuales.map(filaDeRegla)}
        </Tarjeta>
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  cifra: { fontSize: Letra.cifraGrande, fontWeight: '800', letterSpacing: -1 },
  nota: { fontSize: Letra.pequeno, lineHeight: 18 },
  nuevo: { alignSelf: 'flex-start' },
  regla: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    minHeight: TactilMinimo + Espacio.s,
    paddingVertical: Espacio.s,
    columnGap: Espacio.s,
  },
  textos: { flexGrow: 1, flexShrink: 1, flexBasis: 120, gap: 2 },
  nombre: { fontSize: Letra.cuerpo, fontWeight: '600' },
  importe: { fontSize: Letra.cuerpo, fontWeight: '700', marginLeft: 'auto' },
  delMes: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo,
    paddingVertical: Espacio.xs,
    gap: Espacio.s,
  },
  diaDelMes: { width: 32, fontSize: Letra.cuerpo, fontWeight: '800', textAlign: 'center' },
});
