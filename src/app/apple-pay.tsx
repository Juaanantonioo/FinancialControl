import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';

import { Boton, CabeceraConVuelta, Selector, TextoDeError } from '@/componentes/basicos';
import { Tarjeta } from '@/componentes/Tarjeta';
import { useAviso } from '@/estado/Aviso';
import { importarInvocaciones, invocacionDePrueba } from '@/estado/cola';
import { textoDeError, useConsulta, useDatos } from '@/estado/Datos';
import { describirFecha, diaLocalDe, horaLocalDe } from '@/estado/fechas';
import { t, type ClaveTexto } from '@/i18n';
import { Espacio, Letra, Radio, TactilMinimo, useColores } from '@/theme';

const PASOS = [1, 2, 3, 4, 5, 6, 7];
const CONSEJOS = [1, 2, 3];

/**
 * P04 · Guía de Apple Pay: cómo crear la automatización de Atajos, una
 * captura de prueba para ver cómo llega, la fecha de la última captura
 * recibida y las tarjetas que la app recuerda.
 */
export default function GuiaDeApplePay() {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const { repos, notificarCambio } = useDatos();
  const mostrarAviso = useAviso();
  const [nuevoAlias, setNuevoAlias] = useState('');
  const [cuentaDelAlias, setCuentaDelAlias] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ultima = useConsulta((r) => r.capturas.ultimaRecibida());
  const alias = useConsulta((r) => r.capturas.listarAlias());
  const cuentas = useConsulta((r) => r.cuentas.listar({ incluirArchivadas: true }));
  const activas = (cuentas ?? []).filter((x) => !x.archivada);

  async function enviarPrueba() {
    try {
      // La captura de prueba entra por el mismo camino que una real: como una
      // entrada de la cola de la acción «Registrar pago».
      const ahora = new Date();
      await importarInvocaciones(
        repos,
        [invocacionDePrueba(Crypto.randomUUID(), t('guia.pruebaComercio'), ahora.getTime())],
        ahora.toISOString(),
      );
      notificarCambio();
      mostrarAviso({
        texto: t('guia.pruebaEnviada'),
        accion: { texto: t('comun.ver'), alPulsar: () => router.push('/capturas') },
      });
    } catch (e) {
      mostrarAviso({ texto: textoDeError(e) });
    }
  }

  async function anadirAlias() {
    setError(null);
    if (!cuentaDelAlias) {
      setError(t('errores.cuenta_no_encontrada'));
      return;
    }
    try {
      await repos.capturas.fijarAlias(nuevoAlias, cuentaDelAlias);
      setNuevoAlias('');
      notificarCambio();
    } catch (e) {
      setError(textoDeError(e));
    }
  }

  async function olvidar(id: string) {
    try {
      await repos.capturas.borrarAlias(id);
      notificarCambio();
      mostrarAviso({
        texto: t('guia.aliasBorrado'),
        accion: {
          texto: t('comun.deshacer'),
          alPulsar: () => {
            repos.capturas.restaurarAlias(id).then(notificarCambio, () => undefined);
          },
        },
      });
    } catch (e) {
      mostrarAviso({ texto: textoDeError(e) });
    }
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraConVuelta titulo={t('guia.titulo')} />
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingBottom: margen.bottom + Espacio.xl }]}
        keyboardShouldPersistTaps="handled">
        <Text style={[estilos.texto, { color: c.texto }]}>{t('guia.intro')}</Text>
        <Text style={[estilos.nota, { color: c.textoSecundario }]} testID="aviso-de-limites">
          {t('guia.aviso')}
        </Text>

        <Tarjeta titulo={t('guia.pasos')} testID="pasos">
          {PASOS.map((numero) => {
            const texto = t(`guia.paso${numero}` as ClaveTexto);
            return (
              <View
                key={numero}
                accessible
                accessibilityLabel={t('guia.pasoLeido', { numero, texto })}
                style={estilos.paso}>
                <View style={[estilos.numero, { backgroundColor: c.acentoSuave }]}>
                  <Text
                    allowFontScaling={false}
                    style={{ color: c.acento, fontSize: Letra.secundario, fontWeight: '800' }}>
                    {numero}
                  </Text>
                </View>
                <Text style={[estilos.texto, estilos.textoDePaso, { color: c.texto }]}>
                  {texto}
                </Text>
              </View>
            );
          })}
        </Tarjeta>

        <Tarjeta titulo={t('guia.siNoSalta')} testID="consejos">
          {CONSEJOS.map((numero) => (
            <Text key={numero} style={[estilos.texto, { color: c.texto }]}>
              {`• ${t(`guia.consejo${numero}` as ClaveTexto)}`}
            </Text>
          ))}
        </Tarjeta>

        <Tarjeta titulo={t('guia.prueba')} testID="prueba">
          <Text style={[estilos.nota, { color: c.textoSecundario }]}>{t('guia.pruebaAyuda')}</Text>
          <Boton
            texto={t('guia.enviarPrueba')}
            variante="primario"
            alPulsar={enviarPrueba}
            testID="enviar-prueba"
          />
          <Boton
            texto={t('guia.verBandeja')}
            alPulsar={() => router.push('/capturas')}
            testID="ver-bandeja"
          />
          <View accessible style={estilos.ultima}>
            <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>
              {t('guia.ultima')}
            </Text>
            <Text style={[estilos.texto, { color: c.texto }]} testID="ultima-captura">
              {ultima
                ? t('guia.ultimaEl', {
                    fecha: describirFecha(diaLocalDe(ultima)),
                    hora: horaLocalDe(ultima),
                  })
                : t('guia.ninguna')}
            </Text>
          </View>
        </Tarjeta>

        <Tarjeta titulo={t('guia.alias')} testID="alias">
          <Text style={[estilos.nota, { color: c.textoSecundario }]}>{t('guia.aliasAyuda')}</Text>
          {alias !== undefined && alias.length === 0 ? (
            <Text style={[estilos.nota, { color: c.textoSecundario }]} testID="sin-alias">
              {t('guia.sinAlias')}
            </Text>
          ) : null}
          {(alias ?? []).map((a, i) => {
            const cuenta =
              (cuentas ?? []).find((x) => x.id === a.cuentaId)?.nombre ??
              t('guia.cuentaDesconocida');
            return (
              <Pressable
                key={a.id}
                onPress={() => olvidar(a.id)}
                accessibilityRole="button"
                accessibilityLabel={t('guia.aliasLeido', { texto: a.texto, cuenta })}
                testID={`alias-${a.texto}`}
                style={({ pressed }) => [
                  estilos.alias,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borde },
                  { opacity: pressed ? 0.6 : 1 },
                ]}>
                <View style={estilos.textosDeAlias}>
                  <Text style={[estilos.texto, { color: c.texto, fontWeight: '600' }]}>
                    {a.texto}
                  </Text>
                  <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>
                    {cuenta}
                  </Text>
                </View>
                <Text allowFontScaling={false} style={{ color: c.textoSecundario, fontSize: 18 }}>
                  ✕
                </Text>
              </Pressable>
            );
          })}
          <TextInput
            value={nuevoAlias}
            onChangeText={setNuevoAlias}
            placeholder={t('guia.nuevoAlias')}
            placeholderTextColor={c.textoSecundario}
            accessibilityLabel={t('guia.nuevoAlias')}
            testID="nuevo-alias"
            maxLength={80}
            autoCorrect={false}
            style={[estilos.campo, { color: c.texto, borderColor: c.borde }]}
          />
          <View style={estilos.fila}>
            <Selector
              compacto
              titulo={t('guia.aliasCuenta')}
              opciones={activas.map((x) => ({ valor: x.id, texto: x.nombre }))}
              valor={cuentaDelAlias}
              alElegir={setCuentaDelAlias}
              textoVacio={t('guia.elegirCuenta')}
              testID="cuenta-del-alias"
            />
            <Boton texto={t('guia.anadirAlias')} alPulsar={anadirAlias} testID="anadir-alias" />
          </View>
          <TextoDeError texto={error} />
        </Tarjeta>

        <Text style={[estilos.nota, { color: c.textoSecundario }]}>{t('guia.anadirGasto')}</Text>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Espacio.m, gap: Espacio.m },
  texto: { fontSize: Letra.secundario, lineHeight: 22 },
  nota: { fontSize: Letra.pequeno, lineHeight: 18 },
  paso: { flexDirection: 'row', gap: Espacio.s, alignItems: 'flex-start' },
  numero: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoDePaso: { flex: 1 },
  ultima: { paddingTop: Espacio.xs, gap: 2 },
  alias: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.xs,
    gap: Espacio.s,
  },
  textosDeAlias: { flex: 1, gap: 2 },
  campo: {
    minHeight: TactilMinimo,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radio.m,
    paddingHorizontal: Espacio.m,
    fontSize: Letra.cuerpo,
  },
  fila: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Espacio.s },
});
