import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton, Fila, PasoDeFecha, TextoDeError } from '@/componentes/basicos';
import { TecladoDeImporte } from '@/componentes/TecladoDeImporte';
import {
  centimosDelTeclado,
  dinero,
  formatearDinero,
  mostrarTeclado,
  pulsarTecla,
  simboloDeDivisa,
  tecladoDesdeCentimos,
} from '@/dominio/dinero';
import type { ValorDeInversion } from '@/dominio/inversion';
import { fechaLocal } from '@/dominio/modelo';
import { useAviso } from '@/estado/Aviso';
import { textoDeError, useConsulta, useDatos } from '@/estado/Datos';
import { formatoRegional } from '@/estado/formato';
import { t } from '@/i18n';
import { cifrasTabulares, Espacio, Letra, useColores } from '@/theme';

/**
 * P21 · Valor de una cuenta de inversión: importe y fecha, con el teclado de
 * importe del alta de movimiento. Con `cuentaId` anota un valor nuevo; con
 * `id` cambia o borra uno existente.
 */
export default function PantallaDeValor() {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const { id, cuentaId: cuentaPedida } = useLocalSearchParams<{ id?: string; cuentaId?: string }>();
  const { repos, notificarCambio } = useDatos();
  const mostrarAviso = useAviso();
  const formato = formatoRegional();

  const [original, setOriginal] = useState<ValorDeInversion | null>(null);
  const [cargado, setCargado] = useState(!id);
  const [noExiste, setNoExiste] = useState(false);
  const [texto, setTexto] = useState('');
  const [fecha, setFecha] = useState(fechaLocal());
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Cerrojo contra dobles pulsaciones: cambia al instante, sin esperar al repintado.
  const cerrojo = useRef(false);

  useEffect(() => {
    if (!id) return;
    let vigente = true;
    repos.valores.obtener(id).then((valor) => {
      if (!vigente) return;
      if (!valor || valor.borradoEn !== null) {
        setNoExiste(true);
      } else {
        setOriginal(valor);
        setTexto(tecladoDesdeCentimos(valor.valor));
        setFecha(valor.fecha);
      }
      setCargado(true);
    });
    return () => {
      vigente = false;
    };
  }, [id, repos]);

  const cuentaId = original?.cuentaId ?? cuentaPedida ?? null;
  const cuenta = useConsulta(
    (r) => (cuentaId ? r.cuentas.obtener(cuentaId) : Promise.resolve(null)),
    [cuentaId],
  );
  const divisa = cuenta?.divisa ?? 'EUR';
  const centimos = centimosDelTeclado(texto);

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
    if (!cuentaId) {
      setError(t('errores.cuenta_no_encontrada'));
      return;
    }
    ejecutar(async () => {
      if (original) await repos.valores.modificar(original.id, { fecha, valor: centimos });
      else await repos.valores.registrar({ cuentaId, fecha, valor: centimos });
    });
  }

  function borrar() {
    if (!original) return;
    const idBorrado = original.id;
    ejecutar(async () => {
      await repos.valores.borrar(idBorrado);
      mostrarAviso({
        texto: t('inversion.borrado'),
        accion: {
          texto: t('comun.deshacer'),
          alPulsar: () => {
            repos.valores.restaurar(idBorrado).then(notificarCambio, () => undefined);
          },
        },
      });
    });
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <View style={[estilos.cabecera, { borderBottomColor: c.borde }]}>
        <Boton texto={t('comun.cancelar')} alPulsar={() => router.back()} testID="cancelar" />
        <Text style={[estilos.titulo, { color: c.texto }]} accessibilityRole="header">
          {id ? t('inversion.tituloEditar') : t('inversion.tituloNuevo')}
        </Text>
        <Boton
          texto={t('comun.guardar')}
          alPulsar={guardar}
          desactivado={ocupado || !cargado || noExiste}
          testID="guardar"
        />
      </View>
      {noExiste ? (
        <Text style={[estilos.ayuda, { color: c.textoSecundario, padding: Espacio.xl }]}>
          {t('inversion.noEncontrado')}
        </Text>
      ) : (
        <>
          <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
            {cuenta ? (
              <Text
                style={[estilos.cuenta, { color: c.textoSecundario }]}
                testID="cuenta-del-valor">
                {cuenta.nombre}
              </Text>
            ) : null}
            <Text
              style={[estilos.importe, cifrasTabulares, { color: c.texto }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              testID="importe"
              accessibilityLabel={t('movimiento.importeLeido', {
                importe: formatearDinero(dinero(centimos, divisa), formato),
              })}>
              {`${mostrarTeclado(texto, formato)} ${simboloDeDivisa(divisa)}`}
            </Text>
            <Text style={[estilos.ayuda, { color: c.textoSecundario }]}>
              {t('inversion.ayuda')}
            </Text>
            <TextoDeError texto={error} />
            <Fila etiqueta={t('inversion.fecha')}>
              <PasoDeFecha fecha={fecha} alCambiar={setFecha} />
            </Fila>
            {original ? (
              <Boton
                texto={t('comun.borrar')}
                variante="peligro"
                alPulsar={borrar}
                desactivado={ocupado}
                testID="borrar"
                estilo={estilos.borrar}
              />
            ) : null}
          </ScrollView>
          <View style={{ paddingBottom: margen.bottom }}>
            <TecladoDeImporte
              formato={formato}
              alPulsar={(tecla) => {
                setError(null);
                setTexto((actual) => pulsarTecla(actual, tecla));
              }}
            />
          </View>
        </>
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
  contenido: { padding: Espacio.m, paddingBottom: Espacio.l },
  cuenta: { fontSize: Letra.secundario, textAlign: 'center', paddingTop: Espacio.s },
  importe: {
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: -1,
    textAlign: 'center',
    paddingVertical: Espacio.s,
  },
  ayuda: { fontSize: Letra.pequeno, textAlign: 'center', lineHeight: 18 },
  borrar: { alignSelf: 'flex-start', marginTop: Espacio.s, paddingHorizontal: 0 },
});
