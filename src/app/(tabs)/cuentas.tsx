import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Boton, BotonAnadir, Cabecera, useMargenDeLista } from '@/componentes/basicos';
import { Dato, EstadoVacio, Tarjeta } from '@/componentes/Tarjeta';
import type { CuentaConSaldo } from '@/datos/cuentas';
import { dinero, formatearDinero } from '@/dominio/dinero';
import { resumenDeInversion, resumenDeInversiones, valorEstimado } from '@/dominio/inversion';
import { fechaLocal, TIPOS_DE_CUENTA } from '@/dominio/modelo';
import { deDivisa } from '@/dominio/resumen';
import { useConsulta } from '@/estado/Datos';
import { formatoRegional, importe } from '@/estado/formato';
import { textoDeGanancia } from '@/estado/inversion';
import { t } from '@/i18n';
import { cifrasTabulares, Espacio, Letra, TactilMinimo, useColores } from '@/theme';

/**
 * Suma los saldos por divisa. Sumar euros con dólares no tiene sentido, así
 * que el patrimonio se muestra con una cifra por divisa.
 */
export function patrimonioPorDivisa(
  cuentas: CuentaConSaldo[],
): { divisa: string; total: number }[] {
  const totales = new Map<string, number>();
  for (const cuenta of cuentas) {
    totales.set(cuenta.divisa, (totales.get(cuenta.divisa) ?? 0) + cuenta.saldo);
  }
  return [...totales].map(([divisa, total]) => ({ divisa, total }));
}

/**
 * P09 · Cuentas: todo lo que se tiene y dónde está. Arriba, el total con
 * acceso a su evolución; debajo, las cuentas de banco y efectivo; y las
 * inversiones en una sección propia, con lo aportado, lo que valen y la
 * ganancia (T-022).
 */
export default function Cuentas() {
  const c = useColores();
  const margenDeLista = useMargenDeLista();
  const [verArchivadas, setVerArchivadas] = useState(false);
  const todas = useConsulta((r) => r.cuentas.listarConSaldo({ incluirArchivadas: true }));
  const movimientos = useConsulta((r) => r.movimientos.listar());
  const valores = useConsulta((r) => r.valores.listar());
  const hoy = fechaLocal();
  // Una cuenta de inversión se muestra por lo que vale (su valor estimado), no por lo aportado.
  const conValor = (todas ?? []).map((x) =>
    x.tipo === 'inversion'
      ? { ...x, saldo: valorEstimado(x, movimientos ?? [], valores ?? [], hoy) ?? x.saldo }
      : x,
  );
  const activas = conValor.filter((x) => !x.archivada);
  // Misma regla que Inicio: una cuenta archivada cuenta si aún tiene saldo.
  const patrimonio = patrimonioPorDivisa(conValor.filter((x) => !x.archivada || x.saldo !== 0));

  // Inversiones: una cifra por divisa, con la misma regla que la pantalla Inversiones
  // (una archivada cuenta mientras conserve algún valor).
  const deInversion = (todas ?? []).filter((x) => x.tipo === 'inversion');
  const inversiones = [...new Set(deInversion.map((x) => x.divisa))].map((divisa) => {
    const delaDivisa = deDivisa(movimientos ?? [], divisa);
    const cuentas = deInversion
      .filter((x) => x.divisa === divisa)
      .map((cuenta) => ({
        cuenta,
        r: resumenDeInversion(cuenta, delaDivisa, valores ?? [], hoy),
      }))
      .filter(({ cuenta, r }) => !cuenta.archivada || r.valor !== 0);
    const total = resumenDeInversiones(
      cuentas.map((x) => x.cuenta),
      delaDivisa,
      valores ?? [],
      hoy,
    );
    return { divisa, cuentas, total };
  });

  // Una inversión archivada que aún vale algo ya sale en su sección.
  const enInversiones = new Set(inversiones.flatMap((x) => x.cuentas.map((y) => y.cuenta.id)));
  const archivadas = conValor.filter((x) => x.archivada && !enInversiones.has(x.id));

  const fila = (cuenta: CuentaConSaldo, indice: number) => {
    const saldo = formatearDinero(dinero(cuenta.saldo, cuenta.divisa), formatoRegional());
    return (
      <Pressable
        key={cuenta.id}
        onPress={() => router.push({ pathname: '/detalle-de-cuenta', params: { id: cuenta.id } })}
        accessibilityRole="button"
        accessibilityLabel={t('cuentas.saldoDe', { nombre: cuenta.nombre, saldo })}
        testID={`cuenta-${cuenta.nombre}`}
        style={({ pressed }) => [
          estilos.fila,
          indice > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borde },
          { opacity: pressed ? 0.6 : 1 },
        ]}>
        <Text style={[estilos.nombre, { color: c.texto }]}>{cuenta.nombre}</Text>
        <Text
          style={[
            estilos.saldo,
            cifrasTabulares,
            { color: cuenta.saldo < 0 ? c.negativo : c.texto },
          ]}
          testID={`saldo-${cuenta.nombre}`}>
          {saldo}
        </Text>
        <Text style={{ color: c.textoSecundario, fontSize: Letra.subtitulo }}>›</Text>
      </Pressable>
    );
  };

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <Cabecera titulo={t('cuentas.titulo')} />
      <ScrollView contentContainerStyle={[estilos.contenido, { paddingBottom: margenDeLista }]}>
        <Pressable
          onPress={() => router.push('/patrimonio')}
          accessibilityRole="button"
          testID="abrir-patrimonio"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Tarjeta>
            <Text style={{ color: c.textoSecundario, fontSize: Letra.secundario }}>
              {t('cuentas.patrimonio')}
            </Text>
            {(patrimonio.length > 0 ? patrimonio : [{ divisa: 'EUR', total: 0 }]).map((p) => (
              <Text
                key={p.divisa}
                style={[
                  estilos.cifra,
                  cifrasTabulares,
                  { color: p.total < 0 ? c.negativo : c.texto },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                testID={`patrimonio-${p.divisa}`}>
                {formatearDinero(dinero(p.total, p.divisa), formatoRegional())}
              </Text>
            ))}
            <Text
              style={{ color: c.acento, fontSize: Letra.secundario, fontWeight: '600' }}
              testID="ver-evolucion">
              {`${t('cuentas.verEvolucion')}  ›`}
            </Text>
          </Tarjeta>
        </Pressable>

        <Boton
          texto={t('cuentas.nueva')}
          variante="primario"
          alPulsar={() => router.push('/cuenta')}
          testID="nueva-cuenta"
          estilo={estilos.nueva}
        />

        {todas !== undefined && todas.length === 0 ? (
          <EstadoVacio texto={t('cuentas.vacio')} />
        ) : null}

        {TIPOS_DE_CUENTA.filter((tipo) => tipo !== 'inversion').map((tipo) => {
          const delTipo = activas.filter((x) => x.tipo === tipo);
          if (delTipo.length === 0) return null;
          return (
            <View key={tipo} style={estilos.bloque}>
              <Text
                style={[estilos.grupo, { color: c.textoSecundario }]}
                accessibilityRole="header">
                {t(`tipoDeCuenta.${tipo}`)}
              </Text>
              <Tarjeta estilo={estilos.tarjetaDeFilas}>{delTipo.map(fila)}</Tarjeta>
            </View>
          );
        })}

        {inversiones.some((x) => x.cuentas.length > 0) ? (
          <View style={estilos.bloque} testID="seccion-inversiones">
            <Text style={[estilos.grupo, { color: c.textoSecundario }]} accessibilityRole="header">
              {t('inversion.titulo')}
            </Text>
            {inversiones.map(({ divisa, cuentas, total }) => {
              const ganancia = textoDeGanancia(total.ganancia, total.rentabilidad, divisa);
              return (
                <Tarjeta key={divisa} estilo={estilos.tarjetaDeInversiones}>
                  <Pressable
                    onPress={() => router.push('/inversiones')}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('inversion.titulo')}. ${t('inversion.aportado')}: ${importe(
                      total.aportado,
                      divisa,
                    )}. ${t('inversion.valor')}: ${importe(total.valor, divisa)}. ${ganancia.texto}. ${t(
                      'inicio.verInversiones',
                    )}`}
                    testID={
                      inversiones.length > 1 ? `abrir-inversiones-${divisa}` : 'abrir-inversiones'
                    }
                    style={({ pressed }) => [estilos.resumen, { opacity: pressed ? 0.6 : 1 }]}>
                    <View style={estilos.datos}>
                      <Dato
                        etiqueta={t('inversion.aportado')}
                        valor={importe(total.aportado, divisa)}
                        testID="inversiones-aportado"
                      />
                      <Dato
                        etiqueta={t('inversion.valor')}
                        valor={importe(total.valor, divisa)}
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
                    <Text
                      style={{ color: c.acento, fontSize: Letra.secundario, fontWeight: '600' }}>
                      {`${t('cuentas.verInversiones')}  ›`}
                    </Text>
                  </Pressable>
                  {cuentas.map(({ cuenta, r }) => {
                    const g = textoDeGanancia(r.ganancia, r.rentabilidad, divisa);
                    const valor = importe(r.valor, divisa);
                    return (
                      <Pressable
                        key={cuenta.id}
                        onPress={() =>
                          router.push({ pathname: '/detalle-de-cuenta', params: { id: cuenta.id } })
                        }
                        accessibilityRole="button"
                        accessibilityLabel={t('inversion.cuentaLeida', {
                          nombre: cuenta.nombre,
                          valor,
                          aportado: importe(r.aportado, divisa),
                          resultado: g.texto,
                        })}
                        testID={`cuenta-${cuenta.nombre}`}
                        style={({ pressed }) => [
                          estilos.fila,
                          estilos.filaDeInversion,
                          { borderTopColor: c.borde, opacity: pressed ? 0.6 : 1 },
                        ]}>
                        <View style={estilos.textos}>
                          <Text style={[estilos.nombre, { color: c.texto }]}>
                            {cuenta.nombre}
                            {cuenta.archivada ? ` · ${t('inicio.archivada')}` : ''}
                          </Text>
                          <Text style={{ color: c[g.color], fontSize: Letra.pequeno }}>
                            {g.texto}
                          </Text>
                        </View>
                        <Text
                          style={[estilos.saldo, cifrasTabulares, { color: c.texto }]}
                          testID={`saldo-${cuenta.nombre}`}>
                          {valor}
                        </Text>
                        <Text style={{ color: c.textoSecundario, fontSize: Letra.subtitulo }}>
                          ›
                        </Text>
                      </Pressable>
                    );
                  })}
                </Tarjeta>
              );
            })}
          </View>
        ) : null}

        {archivadas.length > 0 ? (
          <View style={estilos.bloque}>
            <Boton
              texto={
                verArchivadas ? t('cuentas.ocultarArchivadas') : t('cuentas.mostrarArchivadas')
              }
              alPulsar={() => setVerArchivadas(!verArchivadas)}
              estilo={estilos.botonArchivadas}
            />
            {verArchivadas ? (
              <>
                <Text
                  style={[estilos.grupo, { color: c.textoSecundario }]}
                  accessibilityRole="header">
                  {t('cuentas.archivadas')}
                </Text>
                <Tarjeta estilo={estilos.tarjetaDeFilas}>{archivadas.map(fila)}</Tarjeta>
              </>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <BotonAnadir />
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { paddingHorizontal: Espacio.m, gap: Espacio.s },
  cifra: { fontSize: Letra.cifraGrande, fontWeight: '800', letterSpacing: -1 },
  bloque: { gap: Espacio.xs },
  grupo: {
    fontSize: Letra.pequeno,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: Espacio.xs,
    paddingTop: Espacio.s,
    paddingBottom: Espacio.xs,
  },
  tarjetaDeFilas: { paddingVertical: Espacio.xs, gap: 0 },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.s,
    paddingVertical: Espacio.s,
    gap: Espacio.s,
  },
  nombre: { flex: 1, fontSize: Letra.cuerpo, fontWeight: '500' },
  saldo: { fontSize: Letra.cuerpo, fontWeight: '700' },
  tarjetaDeInversiones: { paddingBottom: Espacio.xs, gap: 0 },
  resumen: { minHeight: TactilMinimo, gap: Espacio.xs, paddingBottom: Espacio.s },
  datos: { flexDirection: 'row', gap: Espacio.s },
  filaDeInversion: { borderTopWidth: StyleSheet.hairlineWidth },
  textos: { flex: 1, gap: 2 },
  nueva: { alignSelf: 'flex-start', marginTop: Espacio.xs },
  botonArchivadas: { alignSelf: 'flex-start', paddingHorizontal: Espacio.xs },
});
