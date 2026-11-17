import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Boton, BotonAnadir, Cabecera, useMargenDeLista } from '@/componentes/basicos';
import { EstadoVacio, Tarjeta } from '@/componentes/Tarjeta';
import type { CuentaConSaldo } from '@/datos/cuentas';
import { dinero, formatearDinero } from '@/dominio/dinero';
import { valorEstimado } from '@/dominio/inversion';
import { fechaLocal, TIPOS_DE_CUENTA } from '@/dominio/modelo';
import { useConsulta } from '@/estado/Datos';
import { formatoRegional } from '@/estado/formato';
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

/** P09 · Cuentas: patrimonio neto y lista de cuentas con su saldo (T-022). */
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
  const archivadas = conValor.filter((x) => x.archivada);
  // Misma regla que Inicio: una cuenta archivada cuenta si aún tiene saldo.
  const patrimonio = patrimonioPorDivisa(conValor.filter((x) => !x.archivada || x.saldo !== 0));

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
      <Cabecera titulo={t('cuentas.titulo')}>
        <BotonAnadir etiqueta={t('cuentas.nueva')} alPulsar={() => router.push('/cuenta')} />
      </Cabecera>
      <ScrollView contentContainerStyle={[estilos.contenido, { paddingBottom: margenDeLista }]}>
        <Pressable
          onPress={() => router.push('/patrimonio')}
          accessibilityRole="button"
          testID="abrir-patrimonio"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Tarjeta>
            <Text style={{ color: c.textoSecundario, fontSize: Letra.secundario }}>
              {`${t('cuentas.patrimonio')}  ›`}
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
          </Tarjeta>
        </Pressable>

        {todas !== undefined && todas.length === 0 ? (
          <EstadoVacio texto={t('cuentas.vacio')} />
        ) : null}

        {TIPOS_DE_CUENTA.map((tipo) => {
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

        <View style={estilos.bloque}>
          <Text style={[estilos.grupo, { color: c.textoSecundario }]} accessibilityRole="header">
            {t('cuentas.ajustes')}
          </Text>
          <Tarjeta estilo={estilos.tarjetaDeFilas}>
            {(
              [
                ['/categorias', t('cuentas.categorias'), 'ajuste-categorias'],
                ['/apple-pay', t('guia.abrir'), 'ajuste-apple-pay'],
              ] as const
            ).map(([ruta, texto, testID], i) => (
              <Pressable
                key={ruta}
                onPress={() => router.push(ruta)}
                accessibilityRole="button"
                testID={testID}
                style={({ pressed }) => [
                  estilos.fila,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borde },
                  { opacity: pressed ? 0.6 : 1 },
                ]}>
                <Text style={[estilos.nombre, { color: c.texto }]}>{texto}</Text>
                <Text style={{ color: c.textoSecundario, fontSize: Letra.subtitulo }}>›</Text>
              </Pressable>
            ))}
          </Tarjeta>
        </View>

        {__DEV__ ? (
          <Link href="/diagnostico" style={[estilos.enlace, { color: c.textoSecundario }]}>
            {t('diagnostico.abrir')}
          </Link>
        ) : null}
      </ScrollView>
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
  botonArchivadas: { alignSelf: 'flex-start', paddingHorizontal: Espacio.xs },
  enlace: {
    padding: Espacio.xs,
    marginTop: Espacio.l,
    fontSize: Letra.pequeno,
    minHeight: TactilMinimo,
  },
});
