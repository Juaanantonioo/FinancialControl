import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CabeceraConVuelta, Segmentos } from '@/componentes/basicos';
import { Linea } from '@/componentes/Graficos';
import { EstadoVacio, Tarjeta } from '@/componentes/Tarjeta';
import { TIPOS_DE_CUENTA } from '@/dominio/modelo';
import { evolucionDelPatrimonio, patrimonioEn, variacionDelMes } from '@/dominio/patrimonio';
import { describirMes, fechaLarga, mesCorto } from '@/estado/fechas';
import { conSigno, importe, porcentaje } from '@/estado/formato';
import { usePanel } from '@/estado/panel';
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
 * Patrimonio (dashboard D5): lo que la persona tiene hoy, cómo ha cambiado
 * en los últimos doce meses, dónde está y cuánto pesa cada cuenta.
 */
export default function PantallaDePatrimonio() {
  const c = useColores();
  const paleta = usePaleta();
  const margen = useSafeAreaInsets();
  const panel = usePanel();
  const { hoy, divisa, divisas, cuentas, movimientos, valores, sinCuentas } = panel;

  const patrimonio = patrimonioEn(cuentas, movimientos, valores, hoy);
  const variacion = variacionDelMes(cuentas, movimientos, valores, hoy);
  const puntos = evolucionDelPatrimonio(cuentas, movimientos, valores, hoy);
  const totales = puntos.map((p) => p.total);
  const hayInversion = cuentas.some((x) => x.tipo === 'inversion');
  const hayNegativos = patrimonio.cuentas.some((x) => x.peso === null);
  const colorDeTipo = { banco: paleta[0], efectivo: paleta[1], inversion: paleta[2] };
  const mayorTipo = Math.max(0, ...TIPOS_DE_CUENTA.map((tipo) => patrimonio.porTipo[tipo]));

  let frase = t('inicio.sinVariacion');
  if (variacion) {
    const datos = {
      diferencia: conSigno(variacion.diferencia, divisa),
      fecha: fechaLarga(variacion.desde),
    };
    frase =
      variacion.porcentaje === null
        ? t('inicio.variacionDelMes', datos)
        : t('inicio.variacionConPorcentaje', {
            ...datos,
            porcentaje: porcentaje(variacion.porcentaje),
          });
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraConVuelta titulo={t('patrimonio.titulo')} />
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingBottom: margen.bottom + Espacio.xl }]}>
        {divisas.length > 1 ? (
          <Segmentos
            opciones={divisas.map((d) => ({ valor: d, texto: d }))}
            valor={divisa}
            alCambiar={panel.elegirDivisa}
          />
        ) : null}

        {sinCuentas ? (
          <EstadoVacio
            texto={t('patrimonio.vacio')}
            testID="patrimonio-vacio"
            accion={{ texto: t('inicio.crearCuenta'), alPulsar: () => router.push('/cuenta') }}
          />
        ) : (
          <>
            <Tarjeta>
              <View
                accessible
                accessibilityLabel={`${importe(patrimonio.total, divisa)}. ${frase}`}>
                <Text style={{ color: c.textoSecundario, fontSize: Letra.secundario }}>
                  {t('patrimonio.hoy')}
                </Text>
                <Text
                  style={[
                    estilos.cifra,
                    cifrasTabulares,
                    { color: patrimonio.total < 0 ? c.negativo : c.texto },
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                  maxFontSizeMultiplier={1.6}
                  testID="patrimonio-total">
                  {importe(patrimonio.total, divisa)}
                </Text>
                <Text style={{ color: c.textoSecundario, fontSize: Letra.secundario }}>
                  {frase}
                </Text>
              </View>
            </Tarjeta>

            <Tarjeta titulo={t('patrimonio.evolucion')}>
              {puntos.length > 1 ? (
                <Linea
                  series={[{ clave: 'total', color: c.acento, valores: totales, relleno: true }]}
                  etiquetas={puntos.map((p) => mesCorto(p.mes))}
                  textoMaximo={importe(Math.max(...totales), divisa)}
                  textoMinimo={importe(Math.min(...totales), divisa)}
                  descripcion={t('patrimonio.evolucionLeida', {
                    puntos: puntos
                      .map((p) =>
                        t('patrimonio.puntoLeido', {
                          mes: describirMes(p.mes),
                          total: importe(p.total, divisa),
                        }),
                      )
                      .join('; '),
                  })}
                />
              ) : (
                <EstadoVacio texto={t('patrimonio.evolucionCorta')} testID="evolucion-corta" />
              )}
            </Tarjeta>

            <Tarjeta titulo={t('patrimonio.porTipo')}>
              {TIPOS_DE_CUENTA.map((tipo) => {
                const valor = patrimonio.porTipo[tipo];
                if (!cuentas.some((x) => x.tipo === tipo)) return null;
                return (
                  <View
                    key={tipo}
                    accessible
                    accessibilityLabel={`${t(`tipoDeCuenta.${tipo}`)}: ${importe(valor, divisa)}`}
                    style={estilos.tipo}>
                    <View style={estilos.lineaDeTipo}>
                      <Text style={[estilos.nombre, { color: c.texto }]}>
                        {t(`tipoDeCuenta.${tipo}`)}
                      </Text>
                      <Text
                        style={[
                          estilos.valor,
                          cifrasTabulares,
                          { color: valor < 0 ? c.negativo : c.texto },
                        ]}
                        testID={`tipo-${tipo}`}>
                        {importe(valor, divisa)}
                      </Text>
                    </View>
                    <View style={[estilos.pista, { backgroundColor: c.superficieSuave }]}>
                      {valor > 0 && mayorTipo > 0 ? (
                        <View
                          style={[
                            estilos.barra,
                            {
                              backgroundColor: colorDeTipo[tipo],
                              width: `${Math.max(2, Math.round((valor / mayorTipo) * 100))}%`,
                            },
                          ]}
                        />
                      ) : null}
                    </View>
                  </View>
                );
              })}
              {hayInversion ? (
                <Text style={[estilos.nota, { color: c.textoSecundario }]}>
                  {t('patrimonio.inversionEstimada')}
                </Text>
              ) : null}
            </Tarjeta>

            <Tarjeta titulo={t('patrimonio.cuentas')}>
              {patrimonio.cuentas.map((parte, i) => {
                const cuenta = cuentas.find((x) => x.id === parte.cuentaId);
                if (!cuenta) return null;
                return (
                  <Pressable
                    key={parte.cuentaId}
                    onPress={() =>
                      router.push({ pathname: '/detalle-de-cuenta', params: { id: cuenta.id } })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={t('patrimonio.cuentaLeida', {
                      nombre: cuenta.nombre,
                      valor: importe(parte.valor, divisa),
                    })}
                    testID={`patrimonio-cuenta-${cuenta.nombre}`}
                    style={({ pressed }) => [
                      estilos.cuenta,
                      i > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: c.borde,
                      },
                      { opacity: pressed ? 0.6 : 1 },
                    ]}>
                    <View style={estilos.textos}>
                      <Text style={[estilos.nombre, { color: c.texto }]}>{cuenta.nombre}</Text>
                      <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>
                        {t(`tipoDeCuenta.${cuenta.tipo}`)}
                        {cuenta.archivada ? ` · ${t('inicio.archivada')}` : ''}
                      </Text>
                    </View>
                    <View style={estilos.cifras}>
                      <Text
                        style={[
                          estilos.valor,
                          cifrasTabulares,
                          { color: parte.valor < 0 ? c.negativo : c.texto },
                        ]}>
                        {importe(parte.valor, divisa)}
                      </Text>
                      {parte.peso !== null ? (
                        <Text
                          style={[
                            cifrasTabulares,
                            { color: c.textoSecundario, fontSize: Letra.pequeno },
                          ]}
                          testID={`peso-${cuenta.nombre}`}>
                          {t('patrimonio.peso', { porcentaje: parte.peso })}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
              {hayNegativos ? (
                <Text style={[estilos.nota, { color: c.textoSecundario }]} testID="nota-negativo">
                  {t('patrimonio.negativo')}
                </Text>
              ) : null}
            </Tarjeta>
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
  tipo: { gap: Espacio.xs, paddingVertical: Espacio.xs },
  lineaDeTipo: { flexDirection: 'row', justifyContent: 'space-between', gap: Espacio.s },
  pista: { height: 8, borderRadius: Radio.circulo, overflow: 'hidden' },
  barra: { height: 8, borderRadius: Radio.circulo },
  nombre: { flexShrink: 1, fontSize: Letra.cuerpo, fontWeight: '600' },
  valor: { fontSize: Letra.cuerpo, fontWeight: '700' },
  nota: { fontSize: Letra.pequeno, lineHeight: 18, paddingTop: Espacio.xs },
  cuenta: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.s,
    paddingVertical: Espacio.s,
    gap: Espacio.s,
  },
  textos: { flex: 1, gap: 2 },
  cifras: { alignItems: 'flex-end' },
});
