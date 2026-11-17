import { router } from 'expo-router';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/componentes/basicos';
import { BarraDePresupuesto, textoDeEstado } from '@/componentes/plan/Piezas';
import {
  Dato,
  DistintivoDeCategoria,
  EstadoVacio,
  SelectorDeMes,
  Tarjeta,
} from '@/componentes/Tarjeta';
import { disponibleDelMes, estadoDeLinea, estadoDelPresupuesto } from '@/dominio/presupuesto';
import { fijosPendientes, pendientesDelMes } from '@/dominio/recurrentes';
import { moverMes } from '@/dominio/resumen';
import { aspectoDeCategoria } from '@/estado/aspecto';
import { describirMes } from '@/estado/fechas';
import { importe } from '@/estado/formato';
import type { usePanel } from '@/estado/panel';
import { usePlan, usePresupuesto } from '@/estado/plan';
import { t } from '@/i18n';
import { cifrasTabulares, Espacio, Letra, TactilMinimo, useColores, usePaleta } from '@/theme';

/**
 * P11 · Presupuesto del mes: presupuestado y gastado, una barra por
 * categoría con previsto frente a real, lo que queda o el exceso y la raya
 * del día de hoy. Las cifras salen de `src/dominio/presupuesto.ts`.
 */
export function SeccionPresupuesto({
  panel,
  mes,
  alCambiarMes,
}: {
  panel: ReturnType<typeof usePanel>;
  mes: string;
  alCambiarMes: (mes: string) => void;
}) {
  const c = useColores();
  const paleta = usePaleta();
  const { hoy, divisa, movimientos, categorias } = panel;
  const presupuesto = usePresupuesto(mes);
  const plan = usePlan();
  const peticiones = useRef(0);
  const editar = () => router.push({ pathname: '/presupuesto', params: { mes } });

  const selector = (
    <SelectorDeMes mes={mes} alCambiar={(salto) => alCambiarMes(moverMes(mes, salto))} />
  );
  if (presupuesto === undefined) return selector;
  if (presupuesto === null) {
    return (
      <>
        {selector}
        <Tarjeta
          titulo={t('presupuesto.vacio', { mes: describirMes(mes) })}
          testID="presupuesto-vacio">
          <EstadoVacio
            texto={t('presupuesto.vacioAyuda')}
            accion={{
              texto: t('presupuesto.crear'),
              alPulsar: editar,
              testID: 'crear-presupuesto',
            }}
          />
        </Tarjeta>
      </>
    );
  }

  const estado = estadoDelPresupuesto(presupuesto.lineas, movimientos, categorias, mes, hoy);
  const pendientes = fijosPendientes(
    pendientesDelMes(
      plan.reglas.filter((r) => r.divisa === divisa),
      movimientos,
      mes,
      hoy,
    ),
  );
  const d1 = disponibleDelMes(estado.presupuestado, estado.gastado, pendientes, mes, hoy);
  const queda = estado.presupuestado - estado.gastado;
  const resultado =
    queda > 0
      ? t('presupuesto.quedaDe', { importe: importe(queda, divisa) })
      : queda < 0
        ? t('presupuesto.excesoDe', { importe: importe(-queda, divisa) })
        : t('presupuesto.justo');

  function abrirMovimientos(categoriaId: string) {
    peticiones.current += 1;
    router.navigate({
      pathname: '/movimientos',
      params: { mes, categoriaId, peticion: `presupuesto-${peticiones.current}` },
    });
  }

  return (
    <>
      {selector}
      <Tarjeta testID="resumen-de-presupuesto">
        <View
          accessible
          accessibilityLabel={t('presupuesto.resumenLeido', {
            mes: describirMes(mes),
            presupuestado: importe(estado.presupuestado, divisa),
            gastado: importe(estado.gastado, divisa),
            resultado,
          })}>
          <Text style={{ color: c.textoSecundario, fontSize: Letra.secundario }}>
            {queda < 0 ? t('presupuesto.exceso') : t('presupuesto.queda')}
          </Text>
          <Text
            style={[estilos.cifra, cifrasTabulares, { color: queda < 0 ? c.negativo : c.texto }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            maxFontSizeMultiplier={1.6}
            testID="presupuesto-queda">
            {importe(Math.abs(queda), divisa)}
          </Text>
        </View>
        <BarraDePresupuesto
          real={estado.gastado}
          previsto={estado.presupuestado}
          estado={estadoDeLinea(estado.presupuestado, estado.gastado)}
          marca={estado.marcaDelDia}
        />
        <View style={estilos.datos}>
          <Dato
            etiqueta={t('presupuesto.presupuestado')}
            valor={importe(estado.presupuestado, divisa)}
            testID="presupuesto-presupuestado"
          />
          <Dato
            etiqueta={t('presupuesto.gastado')}
            valor={importe(estado.gastado, divisa)}
            testID="presupuesto-gastado"
          />
        </View>
        {pendientes > 0 ? (
          <Text
            style={[estilos.nota, { color: c.textoSecundario }]}
            testID="presupuesto-disponible">
            {`${t('inicio.disponibleDelMes')}: ${importe(d1.disponible, divisa)}. ${t(
              'inicio.comprometido',
              {
                porcentaje: d1.avance,
              },
            )}.`}
          </Text>
        ) : null}
      </Tarjeta>

      <Tarjeta testID="lineas-de-presupuesto">
        {estado.lineas.length === 0 ? (
          <Text style={[estilos.nota, { color: c.textoSecundario }]}>
            {t('presupuesto.sinLineas')}
          </Text>
        ) : null}
        {estado.lineas.map((linea, i) => {
          const categoria = categorias.find((x) => x.id === linea.categoriaId);
          const nombre = categoria?.nombre ?? t('inicio.sinCategoria');
          const detalle =
            linea.queda >= 0
              ? t('presupuesto.quedaDe', { importe: importe(linea.queda, divisa) })
              : t('presupuesto.excesoDe', { importe: importe(-linea.queda, divisa) });
          return (
            <Pressable
              key={linea.categoriaId}
              onPress={() => abrirMovimientos(linea.categoriaId)}
              accessibilityRole="button"
              accessibilityLabel={t('presupuesto.lineaLeida', {
                nombre,
                real: importe(linea.real, divisa),
                previsto: importe(linea.previsto, divisa),
                estado: textoDeEstado(linea.estado),
                resultado: detalle,
              })}
              testID={`linea-${nombre}`}
              style={({ pressed }) => [
                estilos.linea,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borde },
                { opacity: pressed ? 0.6 : 1 },
              ]}>
              <View style={estilos.cabeceraDeLinea}>
                {categoria ? (
                  <DistintivoDeCategoria
                    aspecto={aspectoDeCategoria(categoria, paleta)}
                    lado={32}
                  />
                ) : null}
                <Text style={[estilos.nombre, { color: c.texto }]}>{nombre}</Text>
                <Text style={[estilos.cifras, cifrasTabulares, { color: c.texto }]}>
                  {t('presupuesto.realDePrevisto', {
                    real: importe(linea.real, divisa),
                    previsto: importe(linea.previsto, divisa),
                  })}
                </Text>
              </View>
              <BarraDePresupuesto
                real={linea.real}
                previsto={linea.previsto}
                estado={linea.estado}
                marca={estado.marcaDelDia}
              />
              <View style={estilos.pie}>
                <Text
                  style={{
                    color:
                      linea.estado === 'excedida'
                        ? c.negativo
                        : linea.estado === 'cerca'
                          ? c.aviso
                          : c.textoSecundario,
                    fontSize: Letra.pequeno,
                    fontWeight: '700',
                  }}
                  testID={`estado-${nombre}`}>
                  {textoDeEstado(linea.estado)}
                </Text>
                <Text
                  style={[cifrasTabulares, { color: c.textoSecundario, fontSize: Letra.pequeno }]}
                  testID={`resultado-${nombre}`}>
                  {detalle}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {estado.sinPresupuestar > 0 ? (
          <View
            accessible
            accessibilityLabel={`${t('presupuesto.sinPresupuestar')}: ${importe(
              estado.sinPresupuestar,
              divisa,
            )}. ${t('presupuesto.sinPresupuestarAyuda')}`}
            style={[
              estilos.linea,
              { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borde },
            ]}>
            <View style={estilos.cabeceraDeLinea}>
              <Text style={[estilos.nombre, { color: c.texto }]}>
                {t('presupuesto.sinPresupuestar')}
              </Text>
              <Text
                style={[estilos.cifras, cifrasTabulares, { color: c.texto }]}
                testID="sin-presupuestar">
                {importe(estado.sinPresupuestar, divisa)}
              </Text>
            </View>
            <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>
              {t('presupuesto.sinPresupuestarAyuda')}
            </Text>
          </View>
        ) : null}
        {estado.marcaDelDia !== null && estado.lineas.length > 0 ? (
          <Text style={[estilos.nota, { color: c.textoSecundario }]}>
            {t('presupuesto.marcaDelDia')}
          </Text>
        ) : null}
      </Tarjeta>
      <Boton
        texto={t('presupuesto.editar')}
        alPulsar={editar}
        testID="editar-presupuesto"
        estilo={estilos.editar}
      />
    </>
  );
}

const estilos = StyleSheet.create({
  cifra: { fontSize: Letra.cifraGrande, fontWeight: '800', letterSpacing: -1 },
  datos: { flexDirection: 'row', gap: Espacio.s },
  nota: { fontSize: Letra.pequeno, lineHeight: 18 },
  linea: { minHeight: TactilMinimo, paddingVertical: Espacio.s + 2, gap: Espacio.xs },
  cabeceraDeLinea: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: Espacio.s,
    rowGap: 2,
  },
  nombre: { flexGrow: 1, flexShrink: 1, fontSize: Letra.cuerpo, fontWeight: '600' },
  cifras: { fontSize: Letra.secundario, fontWeight: '700', marginLeft: 'auto' },
  pie: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    columnGap: Espacio.s,
  },
  editar: { alignSelf: 'flex-start', paddingHorizontal: Espacio.xs },
});
