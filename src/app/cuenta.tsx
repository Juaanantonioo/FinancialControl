import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Boton, Fila, PasoDeFecha, Segmentos, TextoDeError } from '@/componentes/basicos';
import { analizarImporte, formatearNumero, simboloDeDivisa } from '@/dominio/dinero';
import { fechaLocal, type Cuenta, type TipoDeCuenta } from '@/dominio/modelo';
import { useAviso } from '@/estado/Aviso';
import { textoDeError, useDatos } from '@/estado/Datos';
import { formatoRegional } from '@/estado/formato';
import { t } from '@/i18n';
import { Espacio, Letra, TactilMinimo, useColores } from '@/theme';

/**
 * Alta y edición de cuenta, parte de P09 (T-022). Sin parámetro `id` crea
 * una cuenta; con él, la edita y permite archivarla o borrarla.
 */
export default function PantallaDeCuenta() {
  const c = useColores();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { repos, notificarCambio } = useDatos();
  const mostrarAviso = useAviso();
  const formato = formatoRegional();

  const [original, setOriginal] = useState<Cuenta | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoDeCuenta>('banco');
  const [saldo, setSaldo] = useState('');
  const [fecha, setFecha] = useState(fechaLocal());
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Cerrojo contra dobles pulsaciones: una referencia cambia al instante,
  // sin esperar a que la pantalla se repinte.
  const cerrojo = useRef(false);

  useEffect(() => {
    if (!id) return;
    let vigente = true;
    repos.cuentas.obtener(id).then((cuenta) => {
      if (!vigente) return;
      if (!cuenta || cuenta.borradoEn !== null) {
        setNoExiste(true);
        return;
      }
      setOriginal(cuenta);
      setNombre(cuenta.nombre);
      setTipo(cuenta.tipo);
      setSaldo(formatearNumero(cuenta.saldoInicial, formato));
      setFecha(cuenta.fechaSaldoInicial);
    });
    return () => {
      vigente = false;
    };
  }, [id, repos, formato]);

  /** Ejecuta una operación evitando dobles pulsaciones y mostrando su error. */
  async function ejecutar(operacion: () => Promise<void>) {
    if (cerrojo.current) return;
    cerrojo.current = true;
    setOcupado(true);
    setError(null);
    try {
      await operacion();
      notificarCambio();
      router.back();
    } catch (e) {
      setError(textoDeError(e));
      cerrojo.current = false;
      setOcupado(false);
    }
  }

  function guardar() {
    // Un saldo inicial vacío vale 0. Admite negativos (cuenta en descubierto).
    const saldoInicial = saldo.trim() === '' ? 0 : analizarImporte(saldo);
    if (saldoInicial === null) {
      setError(t('errores.importe_no_valido'));
      return;
    }
    const datos = { nombre, tipo, saldoInicial, fechaSaldoInicial: fecha };
    ejecutar(async () => {
      if (original) await repos.cuentas.modificar(original.id, datos);
      else await repos.cuentas.crear(datos);
    });
  }

  function borrar() {
    if (!original) return;
    const idBorrado = original.id;
    ejecutar(async () => {
      await repos.cuentas.borrar(idBorrado);
      mostrarAviso({
        texto: t('cuentas.borrada'),
        accion: {
          texto: t('comun.deshacer'),
          alPulsar: () => {
            repos.cuentas.restaurar(idBorrado).then(notificarCambio, () => undefined);
          },
        },
      });
    });
  }

  function archivar() {
    if (!original) return;
    ejecutar(async () => {
      await repos.cuentas.archivar(original.id, !original.archivada);
    });
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <View style={[estilos.cabecera, { borderBottomColor: c.borde }]}>
        <Boton texto={t('comun.cancelar')} alPulsar={() => router.back()} testID="cancelar" />
        <Text style={[estilos.titulo, { color: c.texto }]} accessibilityRole="header">
          {id ? t('cuenta.tituloEditar') : t('cuenta.tituloNueva')}
        </Text>
        <Boton
          texto={t('comun.guardar')}
          alPulsar={guardar}
          desactivado={ocupado || noExiste}
          testID="guardar"
        />
      </View>
      {noExiste ? (
        <Text style={[estilos.ayuda, { color: c.textoSecundario, padding: Espacio.xl }]}>
          {t('cuenta.noEncontrada')}
        </Text>
      ) : (
        <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
          <TextoDeError texto={error} />
          <Fila etiqueta={t('cuenta.nombre')}>
            <TextInput
              value={nombre}
              onChangeText={setNombre}
              placeholder={t('cuenta.nombreEjemplo')}
              placeholderTextColor={c.textoSecundario}
              accessibilityLabel={t('cuenta.nombre')}
              testID="nombre"
              maxLength={60}
              autoFocus={!id}
              style={[estilos.campo, { color: c.texto }]}
            />
          </Fila>
          <Text style={[estilos.etiqueta, { color: c.textoSecundario }]}>{t('cuenta.tipo')}</Text>
          <Segmentos
            opciones={[
              { valor: 'banco', texto: t('tipoDeCuenta.banco') },
              { valor: 'efectivo', texto: t('tipoDeCuenta.efectivo') },
              { valor: 'inversion', texto: t('tipoDeCuenta.inversion') },
            ]}
            valor={tipo}
            alCambiar={setTipo}
          />
          <Fila etiqueta={t('cuenta.saldoInicial')}>
            <View style={estilos.saldo}>
              <TextInput
                value={saldo}
                onChangeText={setSaldo}
                placeholder={formatearNumero(0, formato)}
                placeholderTextColor={c.textoSecundario}
                accessibilityLabel={t('cuenta.saldoInicial')}
                testID="saldo-inicial"
                keyboardType="numbers-and-punctuation"
                maxLength={20}
                style={[estilos.campo, { color: c.texto, flex: 1 }]}
              />
              <Text style={{ color: c.textoSecundario, fontSize: Letra.cuerpo }}>
                {simboloDeDivisa(original?.divisa ?? 'EUR')}
              </Text>
            </View>
          </Fila>
          <Fila etiqueta={t('cuenta.fechaSaldoInicial')}>
            <PasoDeFecha fecha={fecha} alCambiar={setFecha} />
          </Fila>
          <Text style={[estilos.ayuda, { color: c.textoSecundario }]}>
            {t('cuenta.saldoInicialAyuda')}
          </Text>

          {original ? (
            <View style={estilos.acciones}>
              <Boton
                texto={original.archivada ? t('comun.desarchivar') : t('comun.archivar')}
                alPulsar={archivar}
                desactivado={ocupado}
                testID="archivar"
                estilo={estilos.accion}
              />
              <Text style={[estilos.ayuda, { color: c.textoSecundario }]}>
                {t('cuenta.archivarAyuda')}
              </Text>
              <Boton
                texto={t('comun.borrar')}
                variante="peligro"
                alPulsar={borrar}
                desactivado={ocupado}
                testID="borrar"
                estilo={estilos.accion}
              />
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Espacio.s,
    paddingBottom: Espacio.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titulo: { fontSize: Letra.cuerpo, fontWeight: '700', flexShrink: 1 },
  contenido: { padding: Espacio.m, gap: Espacio.xs },
  etiqueta: { fontSize: Letra.secundario, paddingTop: Espacio.m, paddingBottom: Espacio.xs },
  campo: {
    fontSize: Letra.cuerpo,
    minHeight: TactilMinimo,
    alignSelf: 'stretch',
    textAlign: 'right',
  },
  saldo: { flexDirection: 'row', alignItems: 'center', gap: Espacio.s, alignSelf: 'stretch' },
  ayuda: { fontSize: Letra.pequeno, paddingTop: Espacio.s, lineHeight: 18 },
  acciones: { marginTop: Espacio.l },
  accion: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
