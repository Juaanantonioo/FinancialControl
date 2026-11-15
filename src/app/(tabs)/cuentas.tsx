import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Boton, BotonFlotante, Cabecera } from '@/componentes/basicos';
import type { CuentaConSaldo } from '@/datos/cuentas';
import { dinero, formatearDinero } from '@/dominio/dinero';
import { TIPOS_DE_CUENTA } from '@/dominio/modelo';
import { useConsulta } from '@/estado/Datos';
import { formatoRegional } from '@/estado/formato';
import { t } from '@/i18n';
import { Espacio, TactilMinimo, useColores } from '@/theme';

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
  const [verArchivadas, setVerArchivadas] = useState(false);
  const todas = useConsulta((r) => r.cuentas.listarConSaldo({ incluirArchivadas: true }));
  const activas = (todas ?? []).filter((x) => !x.archivada);
  const archivadas = (todas ?? []).filter((x) => x.archivada);
  // El patrimonio suma las cuentas activas. Hasta H6 la inversión cuenta por lo aportado.
  const patrimonio = patrimonioPorDivisa(activas);

  const fila = (cuenta: CuentaConSaldo) => {
    const saldo = formatearDinero(dinero(cuenta.saldo, cuenta.divisa), formatoRegional());
    return (
      <Pressable
        key={cuenta.id}
        onPress={() => router.push({ pathname: '/cuenta', params: { id: cuenta.id } })}
        accessibilityRole="button"
        accessibilityLabel={t('cuentas.saldoDe', { nombre: cuenta.nombre, saldo })}
        testID={`cuenta-${cuenta.nombre}`}
        style={({ pressed }) => [
          estilos.fila,
          { backgroundColor: c.superficie, borderBottomColor: c.borde, opacity: pressed ? 0.6 : 1 },
        ]}>
        <Text style={[estilos.nombre, { color: c.texto }]}>{cuenta.nombre}</Text>
        <Text
          style={[estilos.saldo, { color: cuenta.saldo < 0 ? c.negativo : c.texto }]}
          testID={`saldo-${cuenta.nombre}`}>
          {saldo}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <Cabecera titulo={t('cuentas.titulo')} />
      <ScrollView contentContainerStyle={estilos.contenido}>
        <View style={estilos.patrimonio}>
          <Text style={{ color: c.textoSecundario, fontSize: 15 }}>{t('cuentas.patrimonio')}</Text>
          {(patrimonio.length > 0 ? patrimonio : [{ divisa: 'EUR', total: 0 }]).map((p) => (
            <Text
              key={p.divisa}
              style={[estilos.cifra, { color: p.total < 0 ? c.negativo : c.texto }]}
              testID={`patrimonio-${p.divisa}`}>
              {formatearDinero(dinero(p.total, p.divisa), formatoRegional())}
            </Text>
          ))}
        </View>

        {todas !== undefined && todas.length === 0 ? (
          <Text style={[estilos.vacio, { color: c.textoSecundario }]}>{t('cuentas.vacio')}</Text>
        ) : null}

        {TIPOS_DE_CUENTA.map((tipo) => {
          const delTipo = activas.filter((x) => x.tipo === tipo);
          if (delTipo.length === 0) return null;
          return (
            <View key={tipo}>
              <Text
                style={[estilos.grupo, { color: c.textoSecundario }]}
                accessibilityRole="header">
                {t(`tipoDeCuenta.${tipo}`)}
              </Text>
              {delTipo.map(fila)}
            </View>
          );
        })}

        {archivadas.length > 0 ? (
          <View>
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
                {archivadas.map(fila)}
              </>
            ) : null}
          </View>
        ) : null}

        {__DEV__ ? (
          <Link href="/diagnostico" style={[estilos.enlace, { color: c.textoSecundario }]}>
            {t('diagnostico.abrir')}
          </Link>
        ) : null}
      </ScrollView>
      <BotonFlotante etiqueta={t('cuentas.nueva')} alPulsar={() => router.push('/cuenta')} />
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { paddingBottom: 160 },
  patrimonio: { paddingHorizontal: Espacio.m, paddingBottom: Espacio.m },
  cifra: { fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  grupo: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: Espacio.m,
    paddingTop: Espacio.m,
    paddingBottom: Espacio.xs,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.s,
    paddingHorizontal: Espacio.m,
    paddingVertical: Espacio.s,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Espacio.s,
  },
  nombre: { flex: 1, fontSize: 17 },
  saldo: { fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  vacio: { fontSize: 16, textAlign: 'center', padding: Espacio.xl },
  botonArchivadas: { alignSelf: 'flex-start', marginTop: Espacio.m },
  enlace: { padding: Espacio.m, marginTop: Espacio.l, fontSize: 14, minHeight: TactilMinimo },
});
