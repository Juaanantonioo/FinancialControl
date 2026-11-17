import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Boton,
  Fila,
  Segmentos,
  Selector,
  TextoDeError,
  type OpcionDeSelector,
} from '@/componentes/basicos';
import { CabeceraDeFormulario, useOperacion } from '@/componentes/Formulario';
import { Campo, PasoDeNumero } from '@/componentes/plan/Piezas';
import { EstadoVacio, SelectorDeMes } from '@/componentes/Tarjeta';
import { analizarImporte, formatearNumero, simboloDeDivisa } from '@/dominio/dinero';
import { fechaLocal } from '@/dominio/modelo';
import { finDeMes } from '@/dominio/patrimonio';
import {
  tipoDeLaClase,
  type ClaseDeRegla,
  type Periodicidad,
  type ReglaRecurrente,
} from '@/dominio/recurrentes';
import { mesDe, moverMes } from '@/dominio/resumen';
import { useAviso } from '@/estado/Aviso';
import { useConsulta, useDatos } from '@/estado/Datos';
import { formatoRegional } from '@/estado/formato';
import { t } from '@/i18n';
import { cifrasTabulares, Espacio, Letra, TactilMinimo, useColores } from '@/theme';

const CLASES: ClaseDeRegla[] = ['fijo', 'suscripcion', 'ingreso', 'aportacion'];

/**
 * P14 · Alta y edición de un gasto fijo, suscripción, ingreso periódico o
 * aportación mensual. Sin `id` crea; con él, edita y permite borrar.
 * `clase` y `objetivoId` llegan puestos desde «Crear aportación mensual».
 */
export default function PantallaDeRegla() {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const formato = formatoRegional();
  const pedido = useLocalSearchParams<{
    id?: string;
    clase?: string;
    objetivoId?: string;
    importe?: string;
    cuentaDestinoId?: string;
    nombre?: string;
  }>();
  const { repos, notificarCambio } = useDatos();
  const mostrarAviso = useAviso();
  const { error, setError, ocupado, ejecutar } = useOperacion();
  const hoy = fechaLocal();

  const [original, setOriginal] = useState<ReglaRecurrente | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [nombre, setNombre] = useState(pedido.nombre ?? '');
  const [importe, setImporte] = useState(pedido.importe ?? '');
  const [clase, setClase] = useState<ClaseDeRegla>(
    CLASES.includes(pedido.clase as ClaseDeRegla) ? (pedido.clase as ClaseDeRegla) : 'fijo',
  );
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>('mensual');
  const [dia, setDia] = useState(Number(hoy.slice(8, 10)));
  const [mesAnual, setMesAnual] = useState(mesDe());
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [destinoId, setDestinoId] = useState<string | null>(pedido.cuentaDestinoId ?? null);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [mesDeFin, setMesDeFin] = useState<string | null>(null);
  const [activa, setActiva] = useState(true);
  const [objetivoId, setObjetivoId] = useState<string | null>(pedido.objetivoId ?? null);

  const tipo = tipoDeLaClase(clase);
  const cuentas = useConsulta((r) => r.cuentas.listar({ incluirArchivadas: true }));
  const categorias = useConsulta((r) => r.categorias.listar({ incluirArchivadas: true }));
  const objetivo = useConsulta(
    (r) => (objetivoId ? r.objetivos.obtener(objetivoId) : Promise.resolve(null)),
    [objetivoId],
  );

  useEffect(() => {
    if (!pedido.id) return;
    let vigente = true;
    repos.reglas.obtener(pedido.id).then((regla) => {
      if (!vigente) return;
      if (!regla || regla.borradoEn !== null) {
        setNoExiste(true);
        return;
      }
      setOriginal(regla);
      setNombre(regla.nombre);
      setImporte(formatearNumero(regla.importe, formato));
      setClase(regla.clase);
      setPeriodicidad(regla.periodicidad);
      setDia(regla.diaDelMes);
      setMesAnual(regla.fechaInicio.slice(0, 7));
      setCuentaId(regla.cuentaId);
      setDestinoId(regla.cuentaDestinoId);
      setCategoriaId(regla.categoriaId);
      setMesDeFin(regla.fechaFin ? regla.fechaFin.slice(0, 7) : null);
      setActiva(regla.activa);
      setObjetivoId(regla.objetivoId);
    });
    return () => {
      vigente = false;
    };
  }, [pedido.id, repos, formato]);

  // Una cuenta o categoría archivada solo se ofrece si la regla ya la tenía.
  const cuentasElegibles = (cuentas ?? []).filter(
    (x) => !x.archivada || x.id === original?.cuentaId || x.id === original?.cuentaDestinoId,
  );
  const categoriasElegibles = (categorias ?? []).filter(
    (x) => x.tipo === tipo && (!x.archivada || x.id === original?.categoriaId),
  );
  const cuentaElegida = cuentaId ?? cuentasElegibles.find((x) => x.id !== destinoId)?.id ?? null;
  const cuenta = cuentasElegibles.find((x) => x.id === cuentaElegida);
  const opcionesDeCuenta: OpcionDeSelector[] = cuentasElegibles.map((x) => ({
    valor: x.id,
    texto: x.nombre,
    detalle: t(`tipoDeCuenta.${x.tipo}`),
  }));

  function cambiarClase(nueva: ClaseDeRegla) {
    setClase(nueva);
    setError(null);
    // La categoría de un gasto no vale para un ingreso, ni para una aportación.
    if (tipoDeLaClase(nueva) !== tipo) setCategoriaId(null);
  }

  function guardar() {
    const centimos = analizarImporte(importe);
    if (centimos === null) {
      setError(t('errores.importe_no_valido'));
      return;
    }
    if (!cuentaElegida) {
      setError(t('errores.cuenta_no_encontrada'));
      return;
    }
    const datos = {
      nombre,
      clase,
      importe: centimos,
      cuentaId: cuentaElegida,
      cuentaDestinoId: tipo === 'transferencia' ? destinoId : null,
      categoriaId: tipo === 'transferencia' ? null : categoriaId,
      periodicidad,
      diaDelMes: dia,
      // En una regla anual el mes elegido es el mes en que se cobra cada año.
      fechaInicio:
        periodicidad === 'anual' ? `${mesAnual}-01` : (original?.fechaInicio ?? undefined),
      fechaFin: mesDeFin ? finDeMes(mesDeFin) : null,
      activa,
      objetivoId: clase === 'aportacion' ? objetivoId : null,
    };
    ejecutar(() =>
      original ? repos.reglas.modificar(original.id, datos) : repos.reglas.crear(datos),
    );
  }

  function borrar() {
    if (!original) return;
    const idBorrado = original.id;
    ejecutar(async () => {
      await repos.reglas.borrar(idBorrado);
      mostrarAviso({
        texto: t('regla.borrada'),
        accion: {
          texto: t('comun.deshacer'),
          alPulsar: () => {
            repos.reglas.restaurar(idBorrado).then(notificarCambio, () => undefined);
          },
        },
      });
    });
  }

  const sinCuentas = cuentas !== undefined && cuentasElegibles.length === 0;

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraDeFormulario
        titulo={pedido.id ? t('regla.tituloEditar') : t('regla.tituloNueva')}
        alGuardar={guardar}
        desactivado={ocupado || noExiste || sinCuentas || (!!pedido.id && !original)}
      />
      {noExiste || sinCuentas ? (
        <EstadoVacio
          texto={noExiste ? t('regla.noEncontrada') : t('regla.sinCuentas')}
          testID={noExiste ? 'regla-no-encontrada' : 'regla-sin-cuentas'}
          accion={
            noExiste
              ? undefined
              : { texto: t('movimiento.crearCuenta'), alPulsar: () => router.replace('/cuenta') }
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={[estilos.contenido, { paddingBottom: margen.bottom + Espacio.xl }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <TextoDeError texto={error} />
          <Fila etiqueta={t('regla.nombre')}>
            <TextInput
              value={nombre}
              onChangeText={setNombre}
              placeholder={t('regla.nombreEjemplo')}
              placeholderTextColor={c.textoSecundario}
              accessibilityLabel={t('regla.nombre')}
              testID="nombre"
              maxLength={60}
              style={[estilos.campo, { color: c.texto }]}
            />
          </Fila>
          <Fila etiqueta={t('regla.importe')}>
            <View style={estilos.importe}>
              <TextInput
                value={importe}
                onChangeText={setImporte}
                placeholder={formatearNumero(0, formato)}
                placeholderTextColor={c.textoSecundario}
                accessibilityLabel={t('regla.importe')}
                testID="importe"
                keyboardType="numbers-and-punctuation"
                maxLength={16}
                style={[estilos.campo, cifrasTabulares, { color: c.texto, flex: 1 }]}
              />
              <Text style={{ color: c.textoSecundario, fontSize: Letra.cuerpo }}>
                {simboloDeDivisa(cuenta?.divisa ?? 'EUR')}
              </Text>
            </View>
          </Fila>

          <Campo rotulo={t('regla.clase')}>
            <View style={estilos.clases}>
              <Segmentos
                opciones={[
                  { valor: 'fijo', texto: t('regla.claseFijo') },
                  { valor: 'suscripcion', texto: t('regla.claseSuscripcion') },
                ]}
                valor={clase}
                alCambiar={cambiarClase}
              />
              <Segmentos
                opciones={[
                  { valor: 'ingreso', texto: t('regla.claseIngreso') },
                  { valor: 'aportacion', texto: t('regla.claseAportacion') },
                ]}
                valor={clase}
                alCambiar={cambiarClase}
              />
            </View>
          </Campo>
          {clase === 'aportacion' && objetivo ? (
            <Text style={[estilos.ayuda, { color: c.acento }]} testID="objetivo-de-la-regla">
              {t('regla.objetivo', { nombre: objetivo.nombre })}
            </Text>
          ) : null}

          <Campo rotulo={t('regla.periodicidad')}>
            <Segmentos
              opciones={[
                { valor: 'mensual', texto: t('regla.mensual') },
                { valor: 'anual', texto: t('regla.anual') },
              ]}
              valor={periodicidad}
              alCambiar={setPeriodicidad}
            />
          </Campo>
          {periodicidad === 'anual' ? (
            <Campo rotulo={t('regla.mesDelAnio')}>
              <SelectorDeMes
                mes={mesAnual}
                alCambiar={(salto) => setMesAnual(moverMes(mesAnual, salto))}
              />
            </Campo>
          ) : null}
          <Fila etiqueta={t('regla.dia')}>
            <PasoDeNumero
              valor={dia}
              minimo={1}
              maximo={31}
              alCambiar={setDia}
              texto={t('regla.diaLeido', { dia })}
              etiquetaMenos={t('regla.diaAnterior')}
              etiquetaMas={t('regla.diaSiguiente')}
              testID="dia"
            />
          </Fila>
          {dia > 28 ? (
            <Text style={[estilos.ayuda, { color: c.textoSecundario }]}>{t('regla.diaAyuda')}</Text>
          ) : null}

          <Fila etiqueta={tipo === 'transferencia' ? t('regla.cuentaOrigen') : t('regla.cuenta')}>
            <Selector
              titulo={t('regla.cuenta')}
              opciones={opcionesDeCuenta.filter((o) => o.valor !== destinoId)}
              valor={cuentaElegida}
              alElegir={setCuentaId}
              textoVacio={t('regla.elegir')}
              testID="selector-cuenta"
            />
          </Fila>
          {tipo === 'transferencia' ? (
            <Fila etiqueta={t('regla.cuentaDestino')}>
              <Selector
                titulo={t('regla.cuentaDestino')}
                opciones={opcionesDeCuenta.filter((o) => o.valor !== cuentaElegida)}
                valor={destinoId}
                alElegir={setDestinoId}
                textoVacio={t('regla.elegir')}
                testID="selector-destino"
              />
            </Fila>
          ) : (
            <Fila etiqueta={t('regla.categoria')}>
              <Selector
                titulo={t('regla.categoria')}
                opciones={categoriasElegibles.map((x) => ({ valor: x.id, texto: x.nombre }))}
                valor={categoriaId}
                alElegir={setCategoriaId}
                textoVacio={t('regla.elegir')}
                testID="selector-categoria"
              />
            </Fila>
          )}

          <Campo rotulo={t('regla.fin')}>
            {mesDeFin === null ? (
              <View style={estilos.linea}>
                <Text style={[estilos.valor, { color: c.texto }]}>{t('regla.sinFin')}</Text>
                <Boton
                  texto={t('regla.ponerFin')}
                  alPulsar={() => setMesDeFin(periodicidad === 'anual' ? mesAnual : mesDe())}
                  testID="poner-fin"
                />
              </View>
            ) : (
              <>
                <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>
                  {t('regla.conFin')}
                </Text>
                <SelectorDeMes
                  mes={mesDeFin}
                  alCambiar={(salto) => setMesDeFin(moverMes(mesDeFin, salto))}
                />
                <Boton
                  texto={t('regla.quitarFin')}
                  alPulsar={() => setMesDeFin(null)}
                  testID="quitar-fin"
                  estilo={estilos.enlace}
                />
              </>
            )}
          </Campo>

          <View style={[estilos.linea, estilos.activa]}>
            <View style={estilos.textos}>
              <Text style={[estilos.valor, { color: c.texto }]}>{t('regla.activa')}</Text>
              <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>
                {t('regla.activaAyuda')}
              </Text>
            </View>
            <Switch
              value={activa}
              onValueChange={setActiva}
              accessibilityLabel={t('regla.activa')}
              testID="activa"
              trackColor={{ true: c.acento, false: c.borde }}
            />
          </View>

          {original ? (
            <Boton
              texto={t('comun.borrar')}
              variante="peligro"
              alPulsar={borrar}
              desactivado={ocupado}
              testID="borrar"
              estilo={estilos.enlace}
            />
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
  clases: { gap: Espacio.xs },
  ayuda: { fontSize: Letra.pequeno, lineHeight: 18, paddingTop: Espacio.xs },
  linea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Espacio.s,
    minHeight: TactilMinimo,
  },
  activa: { paddingTop: Espacio.m },
  textos: { flex: 1, gap: 2 },
  valor: { fontSize: Letra.cuerpo },
  enlace: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
