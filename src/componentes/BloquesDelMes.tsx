/**
 * Bloques que resumen un mes: el balance y el reparto del gasto por
 * categoría. Los usan Inicio (mes en curso) y Análisis › Mes (el mes
 * elegido). No suman nada: piden las cifras a `src/dominio/resumen`.
 */
import { router } from 'expo-router';
import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Anillo } from '@/componentes/Graficos';
import { Dato, DistintivoDeCategoria, EstadoVacio, Tarjeta } from '@/componentes/Tarjeta';
import { balanceDelMes, gastoPorCategoria, OTRAS, SIN_CATEGORIA } from '@/dominio/resumen';
import { aspectoDeParte } from '@/estado/aspecto';
import { describirMes } from '@/estado/fechas';
import { conSigno, importe } from '@/estado/formato';
import type { usePanel } from '@/estado/panel';
import { t } from '@/i18n';
import { cifrasTabulares, Espacio, Letra, TactilMinimo, useColores, usePaleta } from '@/theme';

type Panel = ReturnType<typeof usePanel>;

/** Balance de un mes: lo que queda, la frase que lo explica, ingresos y gastos. */
export function BloqueBalance({
  panel,
  mes,
  titulo,
  children,
}: {
  panel: Panel;
  mes: string;
  titulo: string;
  /** Líneas que una pantalla añade debajo de las cifras. */
  children?: ReactNode;
}) {
  const c = useColores();
  const { divisa, movimientos } = panel;
  const balance = balanceDelMes(movimientos, mes);

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

  return (
    <Tarjeta titulo={titulo} testID="bloque-balance">
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
      {children}
    </Tarjeta>
  );
}

/** Reparto del gasto del mes por categoría: anillo y lista. Cada parte abre sus movimientos. */
export function BloqueGasto({ panel, mes }: { panel: Panel; mes: string }) {
  const c = useColores();
  const paleta = usePaleta();
  const { divisa, movimientos, categorias, sinCuentas } = panel;
  // Cuenta las veces que se ha pedido abrir Movimientos con un filtro.
  const peticiones = useRef(0);
  const gasto = gastoPorCategoria(movimientos, categorias, mes);

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

  const partes = gasto.partes.map((parte) => ({
    ...parte,
    nombre: nombreDeParte(parte.clave),
    aspecto: aspectoDeParte(parte.clave, categorias, paleta),
  }));

  return (
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
                  style={[cifrasTabulares, { color: c.textoSecundario, fontSize: Letra.pequeno }]}>
                  {`${parte.porcentaje} %`}
                </Text>
              </View>
            </Pressable>
          ))}
        </>
      )}
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  cifra: { fontSize: Letra.cifra, fontWeight: '800', letterSpacing: -0.5 },
  datos: { flexDirection: 'row', gap: Espacio.s, paddingTop: Espacio.xs },
  nombre: { flex: 1, fontSize: Letra.cuerpo, fontWeight: '600' },
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
