import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton, Segmentos, TextoDeError } from '@/componentes/basicos';
import { DistintivoDeCategoria } from '@/componentes/Tarjeta';
import type { Categoria, TipoDeCategoria } from '@/dominio/modelo';
import { aspectoDeCategoria, ICONOS_DISPONIBLES } from '@/estado/aspecto';
import { textoDeError, useConsulta, useDatos } from '@/estado/Datos';
import { t } from '@/i18n';
import {
  Espacio,
  Letra,
  Radio,
  sombraDeTarjeta,
  TactilMinimo,
  useColores,
  PALETA_DE_CATEGORIAS,
  usePaleta,
} from '@/theme';

/**
 * Gestión de categorías, parte de P19 (T-027): crear, renombrar, ordenar y
 * archivar. Se llega desde el alta de movimiento.
 */
export default function PantallaDeCategorias() {
  const c = useColores();
  const paleta = usePaleta();
  const { repos, notificarCambio } = useDatos();
  const [tipo, setTipo] = useState<TipoDeCategoria>('gasto');
  const [nueva, setNueva] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verArchivadas, setVerArchivadas] = useState(false);
  // Categoría cuyo nombre se está editando y el texto en curso.
  const [edicion, setEdicion] = useState<{ id: string; texto: string } | null>(null);
  // Categoría cuyo icono y color se están eligiendo.
  const [aspectoDe, setAspectoDe] = useState<string | null>(null);
  const margen = useSafeAreaInsets();

  const todas = useConsulta((r) => r.categorias.listar({ tipo, incluirArchivadas: true }), [tipo]);
  const activas = (todas ?? []).filter((x) => !x.archivada);
  const archivadas = (todas ?? []).filter((x) => x.archivada);

  /** Ejecuta un cambio, refresca la lista y muestra el error si lo hay. */
  async function aplicar(cambio: () => Promise<unknown>): Promise<boolean> {
    setError(null);
    try {
      await cambio();
      notificarCambio();
      return true;
    } catch (e) {
      setError(textoDeError(e));
      return false;
    }
  }

  async function crear() {
    if (await aplicar(() => repos.categorias.crear({ nombre: nueva, tipo }))) setNueva('');
  }

  async function terminarEdicion() {
    if (!edicion) return;
    const { id, texto } = edicion;
    const actual = (todas ?? []).find((x) => x.id === id);
    setEdicion(null);
    if (!actual || actual.nombre === texto.trim()) return;
    await aplicar(() => repos.categorias.renombrar(id, texto));
  }

  const enAspecto = (todas ?? []).find((x) => x.id === aspectoDe);

  /** Guarda el icono o el color elegido; lo que no se indica se conserva. */
  function guardarAspecto(
    cat: Categoria,
    cambio: { icono?: string | null; color?: string | null },
  ) {
    aplicar(() =>
      repos.categorias.cambiarAspecto(cat.id, {
        icono: cambio.icono === undefined ? cat.icono : cambio.icono,
        color: cambio.color === undefined ? cat.color : cambio.color,
      }),
    );
  }

  /** Intercambia una categoría con su vecina de arriba (-1) o de abajo (+1). */
  function mover(indice: number, salto: -1 | 1) {
    const destino = indice + salto;
    if (destino < 0 || destino >= activas.length) return;
    const ids = activas.map((x) => x.id);
    [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
    // Las archivadas van detrás para que el orden de las activas sea 0, 1, 2…
    aplicar(() => repos.categorias.ordenar([...ids, ...archivadas.map((x) => x.id)]));
  }

  const fila = (cat: Categoria, indice: number) => {
    const editando = edicion?.id === cat.id;
    return (
      <View
        key={cat.id}
        style={[estilos.fila, sombraDeTarjeta(c), { backgroundColor: c.superficie }]}>
        <Pressable
          onPress={() => setAspectoDe(cat.id)}
          accessibilityRole="button"
          accessibilityLabel={t('categorias.aspecto', { nombre: cat.nombre })}
          testID={`aspecto-${cat.nombre}`}
          style={estilos.botonDeAspecto}>
          <DistintivoDeCategoria aspecto={aspectoDeCategoria(cat, paleta)} lado={32} />
        </Pressable>
        <TextInput
          value={editando ? edicion.texto : cat.nombre}
          onFocus={() => setEdicion({ id: cat.id, texto: cat.nombre })}
          onChangeText={(texto) => setEdicion({ id: cat.id, texto })}
          onEndEditing={terminarEdicion}
          accessibilityLabel={t('categorias.renombrar', { nombre: cat.nombre })}
          testID={`nombre-${cat.nombre}`}
          maxLength={40}
          returnKeyType="done"
          style={[estilos.nombre, { color: cat.archivada ? c.textoSecundario : c.texto }]}
        />
        {cat.archivada ? null : (
          <>
            <BotonDeIcono
              simbolo="▲"
              etiqueta={`${t('comun.subir')} ${cat.nombre}`}
              desactivado={indice === 0}
              alPulsar={() => mover(indice, -1)}
              testID={`subir-${cat.nombre}`}
            />
            <BotonDeIcono
              simbolo="▼"
              etiqueta={`${t('comun.bajar')} ${cat.nombre}`}
              desactivado={indice === activas.length - 1}
              alPulsar={() => mover(indice, 1)}
              testID={`bajar-${cat.nombre}`}
            />
          </>
        )}
        <Boton
          texto={cat.archivada ? t('comun.desarchivar') : t('comun.archivar')}
          etiqueta={`${cat.archivada ? t('comun.desarchivar') : t('comun.archivar')} ${cat.nombre}`}
          alPulsar={() => aplicar(() => repos.categorias.archivar(cat.id, !cat.archivada))}
          testID={`archivar-${cat.nombre}`}
          estilo={estilos.botonArchivar}
        />
      </View>
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: c.fondo }}
      contentContainerStyle={estilos.contenido}
      keyboardShouldPersistTaps="handled">
      <Segmentos
        opciones={[
          { valor: 'gasto', texto: t('tipoDeCategoria.gasto') },
          { valor: 'ingreso', texto: t('tipoDeCategoria.ingreso') },
        ]}
        valor={tipo}
        alCambiar={(nuevo) => {
          setTipo(nuevo);
          setError(null);
          setEdicion(null);
        }}
      />
      <TextoDeError texto={error} />

      <View style={estilos.lista}>
        {todas !== undefined && activas.length === 0 ? (
          <Text style={[estilos.ayuda, { color: c.textoSecundario }]}>{t('categorias.vacio')}</Text>
        ) : null}
        {activas.map(fila)}
      </View>

      <View style={[estilos.fila, sombraDeTarjeta(c), { backgroundColor: c.superficie }]}>
        <TextInput
          value={nueva}
          onChangeText={setNueva}
          onSubmitEditing={crear}
          placeholder={t('categorias.nueva')}
          placeholderTextColor={c.textoSecundario}
          accessibilityLabel={t('categorias.nombreNueva')}
          testID="categoria-nueva"
          maxLength={40}
          returnKeyType="done"
          style={[estilos.nombre, { color: c.texto }]}
        />
        <Boton texto={t('comun.anadir')} alPulsar={crear} testID="anadir-categoria" />
      </View>

      <Text style={[estilos.ayuda, { color: c.textoSecundario }]}>
        {t('categorias.archivarAyuda')}
      </Text>

      {archivadas.length > 0 ? (
        <View style={estilos.lista}>
          <Boton
            texto={
              verArchivadas ? t('categorias.ocultarArchivadas') : t('categorias.mostrarArchivadas')
            }
            alPulsar={() => setVerArchivadas(!verArchivadas)}
            testID="ver-archivadas"
            estilo={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
          />
          {verArchivadas ? archivadas.map(fila) : null}
        </View>
      ) : null}

      <Modal
        visible={enAspecto !== undefined}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAspectoDe(null)}>
        {enAspecto ? (
          <View style={[estilos.hoja, { backgroundColor: c.fondo, paddingBottom: margen.bottom }]}>
            <View style={estilos.cabeceraDeHoja}>
              <DistintivoDeCategoria aspecto={aspectoDeCategoria(enAspecto, paleta)} lado={40} />
              <Text
                style={[estilos.tituloDeHoja, { color: c.texto }]}
                accessibilityRole="header"
                numberOfLines={2}>
                {enAspecto.nombre}
              </Text>
              <Boton
                texto={t('comun.hecho')}
                alPulsar={() => setAspectoDe(null)}
                testID="aspecto-hecho"
              />
            </View>
            <ScrollView contentContainerStyle={estilos.contenidoDeHoja}>
              <Text style={[estilos.rotulo, { color: c.textoSecundario }]}>
                {t('categorias.icono')}
              </Text>
              <View style={estilos.rejilla}>
                <Opcion
                  elegida={!enAspecto.icono}
                  etiqueta={`${t('categorias.icono')}: ${t('comun.automatico')}`}
                  testID="icono-automatico"
                  alPulsar={() => guardarAspecto(enAspecto, { icono: null })}>
                  <Text style={{ color: c.texto, fontSize: Letra.pequeno, fontWeight: '700' }}>
                    {t('comun.automatico')}
                  </Text>
                </Opcion>
                {ICONOS_DISPONIBLES.map((icono) => (
                  <Opcion
                    key={icono}
                    elegida={enAspecto.icono === icono}
                    etiqueta={t('categorias.iconoLeido', { icono })}
                    testID={`icono-${icono}`}
                    alPulsar={() => guardarAspecto(enAspecto, { icono })}>
                    <Text allowFontScaling={false} style={estilos.emoji}>
                      {icono}
                    </Text>
                  </Opcion>
                ))}
              </View>
              <Text style={[estilos.rotulo, { color: c.textoSecundario }]}>
                {t('categorias.color')}
              </Text>
              <View style={estilos.rejilla}>
                <Opcion
                  elegida={!enAspecto.color}
                  etiqueta={`${t('categorias.color')}: ${t('comun.automatico')}`}
                  testID="color-automatico"
                  alPulsar={() => guardarAspecto(enAspecto, { color: null })}>
                  <Text style={{ color: c.texto, fontSize: Letra.pequeno, fontWeight: '700' }}>
                    {t('comun.automatico')}
                  </Text>
                </Opcion>
                {PALETA_DE_CATEGORIAS.claro.map((color, i) => (
                  <Opcion
                    key={color}
                    elegida={enAspecto.color?.toUpperCase() === color}
                    etiqueta={t('categorias.colorNumero', { numero: i + 1 })}
                    testID={`color-${i + 1}`}
                    alPulsar={() => guardarAspecto(enAspecto, { color })}>
                    {/* Se guarda el color del modo claro y se pinta su pareja del modo en uso. */}
                    <View style={[estilos.muestra, { backgroundColor: paleta[i] }]} />
                  </Opcion>
                ))}
              </View>
              <Text style={[estilos.ayuda, { color: c.textoSecundario }]}>
                {t('categorias.automaticoAyuda')}
              </Text>
              <TextoDeError texto={error} />
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </ScrollView>
  );
}

/** Casilla elegible de la hoja de icono y color. La elegida lleva borde y marca. */
function Opcion({
  elegida,
  etiqueta,
  testID,
  alPulsar,
  children,
}: {
  elegida: boolean;
  etiqueta: string;
  testID: string;
  alPulsar: () => void;
  children: ReactNode;
}) {
  const c = useColores();
  return (
    <Pressable
      onPress={alPulsar}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ selected: elegida }}
      testID={testID}
      style={[
        estilos.opcion,
        {
          borderColor: elegida ? c.acento : c.borde,
          backgroundColor: elegida ? c.acentoSuave : c.superficie,
        },
      ]}>
      {children}
      {elegida ? (
        <Text allowFontScaling={false} style={[estilos.marca, { color: c.acento }]}>
          ✓
        </Text>
      ) : null}
    </Pressable>
  );
}

function BotonDeIcono({
  simbolo,
  etiqueta,
  desactivado,
  alPulsar,
  testID,
}: {
  simbolo: string;
  etiqueta: string;
  desactivado: boolean;
  alPulsar: () => void;
  testID: string;
}) {
  const c = useColores();
  return (
    <Pressable
      onPress={alPulsar}
      disabled={desactivado}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: desactivado }}
      testID={testID}
      style={[estilos.icono, { opacity: desactivado ? 0.25 : 1 }]}>
      <Text style={{ color: c.acento, fontSize: Letra.secundario }}>{simbolo}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  contenido: { padding: Espacio.m, paddingBottom: Espacio.xl * 2 },
  lista: { marginTop: Espacio.m },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.s,
    paddingLeft: Espacio.s,
    marginBottom: Espacio.s,
    borderRadius: Radio.m,
    gap: Espacio.s,
  },
  nombre: { flex: 1, fontSize: Letra.cuerpo, minHeight: TactilMinimo },
  icono: {
    minWidth: TactilMinimo,
    minHeight: TactilMinimo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonArchivar: { paddingHorizontal: Espacio.s },
  botonDeAspecto: {
    minWidth: TactilMinimo,
    minHeight: TactilMinimo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoja: { flex: 1 },
  cabeceraDeHoja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Espacio.s,
    paddingLeft: Espacio.m,
    paddingTop: Espacio.m,
    paddingBottom: Espacio.s,
  },
  tituloDeHoja: { flex: 1, fontSize: Letra.subtitulo, fontWeight: '700' },
  contenidoDeHoja: { padding: Espacio.m, gap: Espacio.s },
  rotulo: { fontSize: Letra.pequeno, fontWeight: '700', textTransform: 'uppercase' },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: Espacio.s, paddingBottom: Espacio.s },
  opcion: {
    minWidth: TactilMinimo + 8,
    height: TactilMinimo + 8,
    paddingHorizontal: Espacio.s,
    borderRadius: Radio.m,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 24 },
  muestra: { width: 28, height: 28, borderRadius: 14 },
  marca: { position: 'absolute', top: 1, right: 4, fontSize: 11, fontWeight: '800' },
  ayuda: { fontSize: Letra.pequeno, paddingVertical: Espacio.m, lineHeight: 18 },
});
