import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton, CabeceraConVuelta } from '@/componentes/basicos';
import { AnilloDeObjetivo, ritmoDeObjetivo } from '@/componentes/plan/Piezas';
import { Dato, EstadoVacio, Tarjeta } from '@/componentes/Tarjeta';
import { leerParametros } from '@/dominio/entradas';
import { formatearNumero } from '@/dominio/dinero';
import { fechaLocal } from '@/dominio/modelo';
import { estadoDeObjetivo } from '@/dominio/objetivos';
import { useAviso } from '@/estado/Aviso';
import { useConsulta, useDatos } from '@/estado/Datos';
import { fechaLarga } from '@/estado/fechas';
import { formatoRegional, importe } from '@/estado/formato';
import { t } from '@/i18n';
import { cifrasTabulares, Espacio, Letra, TactilMinimo, useColores } from '@/theme';

/**
 * P16 · Detalle de un objetivo: avance, fecha límite, lo que hace falta al
 * mes, aportaciones, «Aportar» y «Crear aportación mensual». Parámetro de
 * la ruta: `id`.
 */
export default function PantallaDeObjetivo() {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const { id } = leerParametros(useLocalSearchParams(), { id: 'id' });
  const { repos, notificarCambio } = useDatos();
  const mostrarAviso = useAviso();
  const hoy = fechaLocal();

  const objetivo = useConsulta((r) => (id ? r.objetivos.obtener(id) : Promise.resolve(null)), [id]);
  const aportaciones = useConsulta(
    (r) => (id ? r.objetivos.listarAportaciones(id) : Promise.resolve([])),
    [id],
  );
  const reglas = useConsulta((r) => r.reglas.listar());

  if (objetivo === undefined || aportaciones === undefined) {
    return (
      <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
        <CabeceraConVuelta titulo="" />
      </View>
    );
  }
  if (!objetivo || objetivo.borradoEn !== null) {
    return (
      <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
        <CabeceraConVuelta titulo="" />
        <EstadoVacio texto={t('objetivos.noEncontrado')} testID="objetivo-no-encontrado" />
      </View>
    );
  }

  const estado = estadoDeObjetivo(objetivo, aportaciones, hoy);
  const { divisa } = objetivo;
  const mensuales = (reglas ?? []).filter((r) => r.objetivoId === objetivo.id);

  function borrarAportacion(aportacionId: string, enlazada: boolean) {
    // Una aportación que viene de un movimiento se quita borrando ese movimiento.
    if (enlazada) {
      mostrarAviso({ texto: t('objetivos.aportacionEnlazada') });
      return;
    }
    repos.objetivos.borrarAportacion(aportacionId).then(
      () => {
        notificarCambio();
        mostrarAviso({
          texto: t('objetivos.aportacionBorrada'),
          accion: {
            texto: t('comun.deshacer'),
            alPulsar: () => {
              repos.objetivos
                .restaurarAportacion(aportacionId)
                .then(notificarCambio, () => undefined);
            },
          },
        });
      },
      () => undefined,
    );
  }

  function crearAportacionMensual() {
    if (!objetivo) return;
    router.push({
      pathname: '/regla',
      params: {
        clase: 'aportacion',
        objetivoId: objetivo.id,
        nombre: t('objetivos.aportacionNombre', { nombre: objetivo.nombre }),
        // Se propone lo que hace falta al mes y, como destino, la cuenta del objetivo.
        ...(estado.necesarioAlMes
          ? { importe: formatearNumero(estado.necesarioAlMes, formatoRegional()) }
          : {}),
        ...(objetivo.cuentaId ? { cuentaDestinoId: objetivo.cuentaId } : {}),
      },
    });
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraConVuelta titulo={objetivo.nombre} testID="titulo-de-objetivo">
        <Boton
          texto={t('comun.editar')}
          alPulsar={() =>
            router.push({ pathname: '/objetivo-editar', params: { id: objetivo.id } })
          }
          testID="editar-objetivo"
        />
      </CabeceraConVuelta>
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingBottom: margen.bottom + Espacio.xl }]}>
        <Tarjeta testID="avance-del-objetivo">
          <View style={estilos.avance}>
            <AnilloDeObjetivo
              estado={estado}
              lado={96}
              clave={`${objetivo.id}-${estado.aportado}`}
            />
            <View style={estilos.textos}>
              <Text style={{ color: c.textoSecundario, fontSize: Letra.secundario }}>
                {`${t(objetivo.tipo === 'ahorro' ? 'objetivos.tipoAhorro' : 'objetivos.tipoInversion')}${
                  objetivo.archivado ? ` · ${t('objetivos.archivado')}` : ''
                }`}
              </Text>
              <Text
                style={[estilos.cifra, cifrasTabulares, { color: c.texto }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                maxFontSizeMultiplier={1.6}
                testID="aportado">
                {importe(estado.aportado, divisa)}
              </Text>
              <Text
                style={[cifrasTabulares, { color: c.textoSecundario, fontSize: Letra.secundario }]}
                testID="meta">
                {t('objetivos.aportadoDeMeta', {
                  aportado: importe(estado.aportado, divisa),
                  meta: importe(objetivo.meta, divisa),
                })}
              </Text>
            </View>
          </View>
          <Text
            style={{
              color:
                estado.situacion === 'conseguido'
                  ? c.positivo
                  : estado.situacion === 'plazo_vencido'
                    ? c.aviso
                    : c.texto,
              fontSize: Letra.cuerpo,
              fontWeight: '700',
            }}
            testID="ritmo">
            {ritmoDeObjetivo(estado, divisa, true)}
          </Text>
          <View style={estilos.datos}>
            <Dato
              etiqueta={t('objetivos.fechaLimite')}
              valor={objetivo.fechaLimite ? fechaLarga(objetivo.fechaLimite) : t('comun.sinFecha')}
              testID="fecha-limite"
            />
            <Dato
              etiqueta={t('objetivos.teFalta')}
              valor={importe(estado.falta, divisa)}
              testID="falta"
            />
          </View>
          {objetivo.archivado ? null : (
            <View style={estilos.botones}>
              <Boton
                texto={t('objetivos.aportar')}
                variante="primario"
                alPulsar={() =>
                  router.push({ pathname: '/aportacion', params: { objetivoId: objetivo.id } })
                }
                testID="aportar"
                estilo={estilos.boton}
              />
              <Boton
                texto={t('objetivos.crearAportacionMensual')}
                alPulsar={crearAportacionMensual}
                testID="crear-aportacion-mensual"
              />
            </View>
          )}
          {mensuales.map((regla) => (
            <Pressable
              key={regla.id}
              onPress={() => router.push({ pathname: '/regla', params: { id: regla.id } })}
              accessibilityRole="button"
              testID={`aportacion-mensual-${regla.nombre}`}
              style={estilos.mensual}>
              <Text style={{ color: c.acento, fontSize: Letra.secundario, fontWeight: '600' }}>
                {`${t('objetivos.aportacionMensual', {
                  importe: importe(regla.importe, divisa),
                  dia: regla.diaDelMes,
                })}${regla.activa ? '' : ` · ${t('fijos.inactiva')}`}  ›`}
              </Text>
            </Pressable>
          ))}
        </Tarjeta>

        <Tarjeta titulo={t('objetivos.aportaciones')} testID="lista-de-aportaciones">
          {aportaciones.length === 0 ? (
            <Text style={[estilos.nota, { color: c.textoSecundario }]} testID="sin-aportaciones">
              {t('objetivos.sinAportaciones')}
            </Text>
          ) : null}
          {aportaciones.map((a, i) => (
            <Pressable
              key={a.id}
              onPress={() => borrarAportacion(a.id, a.movimientoId !== null)}
              accessibilityRole="button"
              accessibilityLabel={t('objetivos.aportacionLeida', {
                fecha: fechaLarga(a.fecha),
                importe: importe(a.importe, divisa),
              })}
              testID={`aportacion-${a.fecha}-${a.importe}`}
              style={({ pressed }) => [
                estilos.aportacion,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borde },
                { opacity: pressed ? 0.6 : 1 },
              ]}>
              <View style={estilos.textos}>
                <Text style={{ color: c.texto, fontSize: Letra.cuerpo }}>
                  {fechaLarga(a.fecha)}
                </Text>
                <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>
                  {a.nota ??
                    (a.movimientoId ? t('objetivos.conMovimiento') : t('objetivos.apunte'))}
                </Text>
              </View>
              <Text style={[estilos.importe, cifrasTabulares, { color: c.positivo }]}>
                {`+${importe(a.importe, divisa)}`}
              </Text>
            </Pressable>
          ))}
        </Tarjeta>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Espacio.m, gap: Espacio.m },
  avance: { flexDirection: 'row', alignItems: 'center', gap: Espacio.m },
  textos: { flex: 1, gap: 2 },
  cifra: { fontSize: Letra.cifra, fontWeight: '800', letterSpacing: -0.5 },
  datos: { flexDirection: 'row', gap: Espacio.s },
  botones: { gap: Espacio.xs, paddingTop: Espacio.xs },
  boton: { alignSelf: 'stretch' },
  mensual: { minHeight: TactilMinimo, justifyContent: 'center' },
  nota: { fontSize: Letra.pequeno, lineHeight: 18 },
  aportacion: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.xs,
    gap: Espacio.s,
  },
  importe: { fontSize: Letra.cuerpo, fontWeight: '700' },
});
