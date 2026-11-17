import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CabeceraConVuelta, Segmentos } from '@/componentes/basicos';
import { Anillo } from '@/componentes/Graficos';
import { Dato, EstadoVacio, Tarjeta } from '@/componentes/Tarjeta';
import { resumenDeInversion, resumenDeInversiones } from '@/dominio/inversion';
import { repartirPorcentajes } from '@/dominio/resumen';
import { textoDeGanancia } from '@/estado/inversion';
import { importe } from '@/estado/formato';
import { usePanel } from '@/estado/panel';
import { t } from '@/i18n';
import {
  cifrasTabulares,
  Espacio,
  INDICE_NEUTRO,
  Letra,
  TactilMinimo,
  useColores,
  usePaleta,
} from '@/theme';

/**
 * Resumen de todas las cuentas de inversión: lo que se ha puesto, lo que
 * valen hoy y lo que se gana o se pierde. Los valores los anota la persona:
 * la app no consulta precios ni aconseja.
 */
export default function PantallaDeInversiones() {
  const c = useColores();
  const paleta = usePaleta();
  const margen = useSafeAreaInsets();
  const panel = usePanel();
  const { hoy, divisa, divisas, movimientos, valores } = panel;
  // Las archivadas aparecen mientras conserven algún valor.
  const cuentas = panel.cuentas
    .filter((x) => x.tipo === 'inversion')
    .map((cuenta) => ({ cuenta, r: resumenDeInversion(cuenta, movimientos, valores, hoy) }))
    .filter(({ cuenta, r }) => !cuenta.archivada || r.valor !== 0);
  const total = resumenDeInversiones(
    cuentas.map((x) => x.cuenta),
    movimientos,
    valores,
    hoy,
  );
  const ganancia = textoDeGanancia(total.ganancia, total.rentabilidad, divisa);
  const repartible = total.valor > 0 && cuentas.every((x) => x.r.valor >= 0);
  const pesos = repartible
    ? repartirPorcentajes(
        cuentas.map((x) => x.r.valor),
        total.valor,
      )
    : [];
  const colorDe = (i: number) => paleta[i % INDICE_NEUTRO];

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraConVuelta titulo={t('inversion.titulo')} />
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingBottom: margen.bottom + Espacio.xl }]}>
        {divisas.length > 1 ? (
          <Segmentos
            opciones={divisas.map((d) => ({ valor: d, texto: d }))}
            valor={divisa}
            alCambiar={panel.elegirDivisa}
          />
        ) : null}

        {panel.cargado && cuentas.length === 0 ? (
          <EstadoVacio
            texto={t('inversion.sinCuentas')}
            testID="inversiones-vacio"
            accion={{ texto: t('inicio.crearCuenta'), alPulsar: () => router.push('/cuenta') }}
          />
        ) : (
          <>
            <Tarjeta>
              <View
                accessible
                accessibilityLabel={`${t('inversion.valor')}: ${importe(total.valor, divisa)}. ${ganancia.texto}`}>
                <Text style={{ color: c.textoSecundario, fontSize: Letra.secundario }}>
                  {t('inversion.valor')}
                </Text>
                <Text
                  style={[estilos.cifra, cifrasTabulares, { color: c.texto }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                  maxFontSizeMultiplier={1.6}
                  testID="inversiones-valor">
                  {importe(total.valor, divisa)}
                </Text>
                <Text
                  style={{
                    color: c[ganancia.color],
                    fontSize: Letra.secundario,
                    fontWeight: '700',
                  }}
                  testID="inversiones-ganancia">
                  {ganancia.texto}
                </Text>
              </View>
              <View style={estilos.datos}>
                <Dato
                  etiqueta={t('inversion.aportado')}
                  valor={importe(total.aportado, divisa)}
                  testID="inversiones-aportado"
                />
              </View>
            </Tarjeta>

            <Tarjeta titulo={t('inversion.reparto')}>
              {repartible ? (
                <View style={estilos.anillo}>
                  <Anillo
                    clave={cuentas.map((x) => x.r.valor).join()}
                    sectores={cuentas.map((x, i) => ({
                      clave: x.cuenta.id,
                      valor: x.r.valor,
                      color: colorDe(i),
                    }))}
                    descripcion={t('inversion.repartoLeido', {
                      partes: cuentas
                        .map((x, i) =>
                          t('inicio.parteCorta', { nombre: x.cuenta.nombre, porcentaje: pesos[i] }),
                        )
                        .join('; '),
                    })}>
                    <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>
                      {t('inversion.valor')}
                    </Text>
                    <Text
                      style={[estilos.centro, cifrasTabulares, { color: c.texto }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.5}>
                      {importe(total.valor, divisa)}
                    </Text>
                  </Anillo>
                </View>
              ) : null}
              {cuentas.map(({ cuenta, r }, i) => {
                const g = textoDeGanancia(r.ganancia, r.rentabilidad, divisa);
                return (
                  <Pressable
                    key={cuenta.id}
                    onPress={() =>
                      router.push({ pathname: '/detalle-de-cuenta', params: { id: cuenta.id } })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t('inversion.cuentaLeida', {
                      nombre: cuenta.nombre,
                      valor: importe(r.valor, divisa),
                      aportado: importe(r.aportado, divisa),
                      resultado: g.texto,
                    })}
                    testID={`inversion-${cuenta.nombre}`}
                    style={({ pressed }) => [
                      estilos.cuenta,
                      { borderTopColor: c.borde, opacity: pressed ? 0.6 : 1 },
                    ]}>
                    <View style={[estilos.muestra, { backgroundColor: colorDe(i) }]} />
                    <View style={estilos.textos}>
                      <Text style={[estilos.nombre, { color: c.texto }]}>
                        {cuenta.nombre}
                        {cuenta.archivada ? ` · ${t('inicio.archivada')}` : ''}
                      </Text>
                      <Text style={{ color: c[g.color], fontSize: Letra.pequeno }}>{g.texto}</Text>
                    </View>
                    <View style={estilos.cifras}>
                      <Text style={[estilos.valor, cifrasTabulares, { color: c.texto }]}>
                        {importe(r.valor, divisa)}
                      </Text>
                      {repartible ? (
                        <Text
                          style={[
                            cifrasTabulares,
                            { color: c.textoSecundario, fontSize: Letra.pequeno },
                          ]}>
                          {t('patrimonio.peso', { porcentaje: pesos[i] })}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </Tarjeta>

            <Text style={[estilos.nota, { color: c.textoSecundario }]} testID="nota-inversiones">
              {t('inversion.nota')}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Espacio.m, gap: Espacio.m },
  cifra: { fontSize: Letra.cifraGrande, fontWeight: '800', letterSpacing: -1 },
  datos: { flexDirection: 'row', gap: Espacio.s, paddingTop: Espacio.xs },
  anillo: { alignItems: 'center', paddingVertical: Espacio.s },
  centro: { fontSize: Letra.subtitulo, fontWeight: '800' },
  cuenta: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.s,
    paddingVertical: Espacio.s,
    gap: Espacio.s,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  muestra: { width: 12, height: 12, borderRadius: 4 },
  textos: { flex: 1, gap: 2 },
  nombre: { fontSize: Letra.cuerpo, fontWeight: '600' },
  cifras: { alignItems: 'flex-end' },
  valor: { fontSize: Letra.cuerpo, fontWeight: '700' },
  nota: { fontSize: Letra.pequeno, lineHeight: 18, textAlign: 'center', padding: Espacio.s },
});
