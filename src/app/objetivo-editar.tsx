import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton, Fila, Segmentos, Selector, TextoDeError } from '@/componentes/basicos';
import { CabeceraDeFormulario, useOperacion } from '@/componentes/Formulario';
import { Campo } from '@/componentes/plan/Piezas';
import { EstadoVacio, SelectorDeMes } from '@/componentes/Tarjeta';
import { analizarImporte, formatearNumero, simboloDeDivisa } from '@/dominio/dinero';
import type { Objetivo, TipoDeObjetivo } from '@/dominio/objetivos';
import { finDeMes } from '@/dominio/patrimonio';
import { mesDe, moverMes } from '@/dominio/resumen';
import { useAviso } from '@/estado/Aviso';
import { useConsulta, useDatos } from '@/estado/Datos';
import { fechaLarga } from '@/estado/fechas';
import { formatoRegional } from '@/estado/formato';
import { t } from '@/i18n';
import { cifrasTabulares, Espacio, Letra, TactilMinimo, useColores } from '@/theme';

/**
 * Alta y edición de un objetivo (parte de P16): nombre, meta, tipo, fecha
 * límite opcional y cuenta asociada opcional. La fecha límite se elige por
 * meses y vale hasta el último día del mes elegido.
 */
export default function PantallaDeObjetivoEditar() {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const formato = formatoRegional();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { repos, notificarCambio } = useDatos();
  const mostrarAviso = useAviso();
  const { error, setError, ocupado, ejecutar } = useOperacion();

  const [original, setOriginal] = useState<Objetivo | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [nombre, setNombre] = useState('');
  const [meta, setMeta] = useState('');
  const [tipo, setTipo] = useState<TipoDeObjetivo>('ahorro');
  const [mesLimite, setMesLimite] = useState<string | null>(null);
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const cuentas = useConsulta((r) => r.cuentas.listar());

  useEffect(() => {
    if (!id) return;
    let vigente = true;
    repos.objetivos.obtener(id).then((objetivo) => {
      if (!vigente) return;
      if (!objetivo || objetivo.borradoEn !== null) {
        setNoExiste(true);
        return;
      }
      setOriginal(objetivo);
      setNombre(objetivo.nombre);
      setMeta(formatearNumero(objetivo.meta, formato));
      setTipo(objetivo.tipo);
      setMesLimite(objetivo.fechaLimite ? objetivo.fechaLimite.slice(0, 7) : null);
      setCuentaId(objetivo.cuentaId);
    });
    return () => {
      vigente = false;
    };
  }, [id, repos, formato]);

  const cuenta = (cuentas ?? []).find((x) => x.id === cuentaId);

  function guardar() {
    const centimos = analizarImporte(meta);
    if (centimos === null) {
      setError(t('errores.meta_no_valida'));
      return;
    }
    const datos = {
      nombre,
      tipo,
      meta: centimos,
      fechaLimite: mesLimite ? finDeMes(mesLimite) : null,
      cuentaId,
    };
    ejecutar(() =>
      original ? repos.objetivos.modificar(original.id, datos) : repos.objetivos.crear(datos),
    );
  }

  function borrar() {
    if (!original) return;
    const idBorrado = original.id;
    ejecutar(
      async () => {
        await repos.objetivos.borrar(idBorrado);
        mostrarAviso({
          texto: t('objetivos.borrado'),
          accion: {
            texto: t('comun.deshacer'),
            alPulsar: () => {
              repos.objetivos.restaurar(idBorrado).then(notificarCambio, () => undefined);
            },
          },
        });
      },
      // El objetivo ya no existe: se cierra esta hoja y también su detalle.
      () => {
        router.back();
        router.back();
      },
    );
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraDeFormulario
        titulo={id ? t('objetivos.tituloEditar') : t('objetivos.tituloNuevo')}
        alGuardar={guardar}
        desactivado={ocupado || noExiste || (!!id && !original)}
      />
      {noExiste ? (
        <EstadoVacio texto={t('objetivos.noEncontrado')} testID="objetivo-no-encontrado" />
      ) : (
        <ScrollView
          contentContainerStyle={[estilos.contenido, { paddingBottom: margen.bottom + Espacio.xl }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <TextoDeError texto={error} />
          <Fila etiqueta={t('objetivos.nombre')}>
            <TextInput
              value={nombre}
              onChangeText={setNombre}
              placeholder={t('objetivos.nombreEjemplo')}
              placeholderTextColor={c.textoSecundario}
              accessibilityLabel={t('objetivos.nombre')}
              testID="nombre"
              maxLength={60}
              autoFocus={!id}
              style={[estilos.campo, { color: c.texto }]}
            />
          </Fila>
          <Fila etiqueta={t('objetivos.meta')}>
            <View style={estilos.importe}>
              <TextInput
                value={meta}
                onChangeText={setMeta}
                placeholder={formatearNumero(0, formato)}
                placeholderTextColor={c.textoSecundario}
                accessibilityLabel={t('objetivos.meta')}
                testID="meta"
                keyboardType="numbers-and-punctuation"
                maxLength={16}
                style={[estilos.campo, cifrasTabulares, { color: c.texto, flex: 1 }]}
              />
              <Text style={{ color: c.textoSecundario, fontSize: Letra.cuerpo }}>
                {simboloDeDivisa(cuenta?.divisa ?? original?.divisa ?? 'EUR')}
              </Text>
            </View>
          </Fila>
          <Campo rotulo={t('objetivos.tipo')}>
            <Segmentos
              opciones={[
                { valor: 'ahorro', texto: t('objetivos.tipoAhorro') },
                { valor: 'inversion', texto: t('objetivos.tipoInversion') },
              ]}
              valor={tipo}
              alCambiar={setTipo}
            />
          </Campo>

          <Campo rotulo={t('objetivos.fechaLimite')}>
            {mesLimite === null ? (
              <View style={estilos.linea}>
                <Text style={[estilos.valor, { color: c.texto }]}>{t('objetivos.sinFecha')}</Text>
                <Boton
                  texto={t('objetivos.ponerFecha')}
                  alPulsar={() => setMesLimite(moverMes(mesDe(), 6))}
                  testID="poner-fecha"
                />
              </View>
            ) : (
              <>
                <SelectorDeMes
                  mes={mesLimite}
                  alCambiar={(salto) => setMesLimite(moverMes(mesLimite, salto))}
                />
                <Text style={[estilos.ayuda, { color: c.textoSecundario }]} testID="fecha-limite">
                  {t('objetivos.limiteEl', { fecha: fechaLarga(finDeMes(mesLimite)) })}
                </Text>
                <Boton
                  texto={t('objetivos.quitarFecha')}
                  alPulsar={() => setMesLimite(null)}
                  testID="quitar-fecha"
                  estilo={estilos.enlace}
                />
              </>
            )}
          </Campo>

          <Fila etiqueta={t('objetivos.cuenta')}>
            <Selector
              titulo={t('objetivos.cuenta')}
              opciones={[
                { valor: null, texto: t('objetivos.sinCuenta') },
                ...(cuentas ?? []).map((x) => ({
                  valor: x.id,
                  texto: x.nombre,
                  detalle: t(`tipoDeCuenta.${x.tipo}`),
                })),
              ]}
              valor={cuentaId}
              alElegir={setCuentaId}
              textoVacio={t('objetivos.sinCuenta')}
              testID="selector-cuenta"
            />
          </Fila>
          <Text style={[estilos.ayuda, { color: c.textoSecundario }]}>
            {t('objetivos.cuentaAyuda')}
          </Text>

          {original ? (
            <View style={estilos.acciones}>
              <Boton
                texto={original.archivado ? t('comun.desarchivar') : t('comun.archivar')}
                alPulsar={() =>
                  ejecutar(() => repos.objetivos.archivar(original.id, !original.archivado))
                }
                desactivado={ocupado}
                testID="archivar"
                estilo={estilos.enlace}
              />
              <Text style={[estilos.ayuda, { color: c.textoSecundario }]}>
                {t('objetivos.archivarAyuda')}
              </Text>
              <Boton
                texto={t('comun.borrar')}
                variante="peligro"
                alPulsar={borrar}
                desactivado={ocupado}
                testID="borrar"
                estilo={estilos.enlace}
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
  contenido: { padding: Espacio.m, gap: Espacio.xs },
  campo: {
    fontSize: Letra.cuerpo,
    minHeight: TactilMinimo,
    alignSelf: 'stretch',
    textAlign: 'right',
  },
  importe: { flexDirection: 'row', alignItems: 'center', gap: Espacio.s, alignSelf: 'stretch' },
  linea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espacio.s,
    minHeight: TactilMinimo,
  },
  valor: { fontSize: Letra.cuerpo },
  ayuda: { fontSize: Letra.pequeno, lineHeight: 18, paddingTop: Espacio.xs },
  enlace: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  acciones: { marginTop: Espacio.l },
});
