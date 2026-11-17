import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fila, TextoDeError } from '@/componentes/basicos';
import { CabeceraDeFormulario, useOperacion } from '@/componentes/Formulario';
import { PasoDeNumero } from '@/componentes/plan/Piezas';
import { EstadoVacio, Tarjeta } from '@/componentes/Tarjeta';
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
import { fechaDeOcurrencia } from '@/dominio/recurrentes';
import { esMesValido } from '@/dominio/resumen';
import { diasDelMes } from '@/dominio/tiempo';
import { useConsulta, useDatos } from '@/estado/Datos';
import { describirMes, diaYMes, fechaLarga } from '@/estado/fechas';
import { formatoRegional, importe } from '@/estado/formato';
import { t } from '@/i18n';
import { cifrasTabulares, Espacio, Letra, TactilMinimo, useColores } from '@/theme';

/**
 * Confirmación de un cobro (T-066) cambiando antes el importe o el día, o
 * marcando un movimiento que ya se había anotado («Ya lo anoté»).
 * Parámetros de la ruta: `reglaId` y `mes` ("AAAA-MM").
 */
export default function PantallaDeCobro() {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const formato = formatoRegional();
  const { reglaId, mes } = useLocalSearchParams<{ reglaId?: string; mes?: string }>();
  const { repos } = useDatos();
  const { error, setError, ocupado, ejecutar } = useOperacion();
  const mesValido = mes && esMesValido(mes) ? mes : null;

  const regla = useConsulta(
    (r) => (reglaId ? r.reglas.obtener(reglaId) : Promise.resolve(null)),
    [reglaId],
  );
  const confirmado = useConsulta(
    async (r) => {
      if (!reglaId || !mesValido) return null;
      const delMes = await r.movimientos.listar({ mes: mesValido });
      return delMes.find((m) => m.reglaRecurrenteId === reglaId) ?? null;
    },
    [reglaId, mesValido],
  );
  const candidatos = useConsulta(
    (r) =>
      reglaId && mesValido
        ? r.reglas.candidatos(reglaId, mesValido).catch(() => [])
        : Promise.resolve([]),
    [reglaId, mesValido],
  );

  const prevista = regla && mesValido ? fechaDeOcurrencia(regla, mesValido) : null;
  const [texto, setTexto] = useState<string | null>(null);
  const [dia, setDia] = useState<number | null>(null);
  const centimos = texto === null ? (regla?.importe ?? 0) : centimosDelTeclado(texto);
  const diaElegido = dia ?? (prevista ? Number(prevista.slice(8, 10)) : 1);
  const divisa = regla?.divisa ?? 'EUR';

  if (regla === undefined || confirmado === undefined) {
    return <View style={[estilos.pantalla, { backgroundColor: c.fondo }]} />;
  }
  // Recién confirmado, la hoja se está cerrando: no se cambia de vista a mitad.
  if (!regla || !mesValido || prevista === null || (confirmado && !ocupado)) {
    return (
      <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
        <CabeceraDeFormulario titulo={t('cobro.titulo')} />
        <EstadoVacio
          texto={confirmado ? t('cobro.yaConfirmado') : t('cobro.noDisponible')}
          testID="cobro-no-disponible"
        />
      </View>
    );
  }

  const fecha = `${mesValido}-${String(diaElegido).padStart(2, '0')}`;
  const guardar = () =>
    ejecutar(() => repos.reglas.confirmar(regla.id, mesValido, { importe: centimos, fecha }));

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraDeFormulario
        titulo={t('cobro.titulo')}
        alGuardar={guardar}
        desactivado={ocupado}
        textoDeGuardar={t('comun.confirmar')}
      />
      <ScrollView contentContainerStyle={estilos.contenido} keyboardShouldPersistTaps="handled">
        <Text style={[estilos.nombre, { color: c.textoSecundario }]} testID="nombre-del-cobro">
          {`${regla.nombre} · ${describirMes(mesValido)}`}
        </Text>
        <Text
          style={[estilos.importe, cifrasTabulares, { color: c.texto }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          testID="importe"
          accessibilityLabel={t('movimiento.importeLeido', {
            importe: formatearDinero(dinero(centimos, divisa), formato),
          })}>
          {`${mostrarTeclado(texto ?? tecladoDesdeCentimos(regla.importe), formato)} ${simboloDeDivisa(divisa)}`}
        </Text>
        <Text style={[estilos.ayuda, { color: c.textoSecundario }]}>{t('cobro.ayuda')}</Text>
        <TextoDeError texto={error} />
        <Fila etiqueta={t('regla.dia')}>
          <PasoDeNumero
            valor={diaElegido}
            minimo={1}
            maximo={diasDelMes(mesValido)}
            alCambiar={setDia}
            texto={diaYMes(fecha)}
            etiquetaMenos={t('comun.diaAnterior')}
            etiquetaMas={t('comun.diaSiguiente')}
            testID="dia"
          />
        </Fila>

        <Tarjeta titulo={t('cobro.yaAnotado')} estilo={estilos.tarjeta} testID="ya-lo-anote">
          <Text style={[estilos.nota, { color: c.textoSecundario }]}>
            {(candidatos ?? []).length === 0 ? t('cobro.sinCandidatos') : t('cobro.yaAnotadoAyuda')}
          </Text>
          {(candidatos ?? []).map((mov) => (
            <Pressable
              key={mov.id}
              onPress={() => ejecutar(() => repos.reglas.enlazar(regla.id, mesValido, mov.id))}
              disabled={ocupado}
              accessibilityRole="button"
              accessibilityLabel={t('cobro.enlazar', {
                nombre: mov.nombre || mov.categoriaNombre || regla.nombre,
                importe: importe(mov.importe, mov.divisa),
                fecha: fechaLarga(mov.fecha),
              })}
              testID={`candidato-${mov.id}`}
              style={({ pressed }) => [
                estilos.candidato,
                { borderTopColor: c.borde, opacity: pressed ? 0.6 : 1 },
              ]}>
              <View style={estilos.textos}>
                <Text style={{ color: c.texto, fontSize: Letra.cuerpo }}>
                  {mov.nombre || mov.categoriaNombre || t(`tipoDeMovimiento.${mov.tipo}`)}
                </Text>
                <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>
                  {diaYMes(mov.fecha)}
                </Text>
              </View>
              <Text
                style={[
                  cifrasTabulares,
                  { color: c.texto, fontSize: Letra.cuerpo, fontWeight: '700' },
                ]}>
                {importe(mov.importe, mov.divisa)}
              </Text>
            </Pressable>
          ))}
        </Tarjeta>
      </ScrollView>
      <View style={{ paddingBottom: margen.bottom }}>
        <TecladoDeImporte
          formato={formato}
          alPulsar={(tecla) => {
            setError(null);
            // La primera tecla sustituye el importe previsto; las siguientes lo completan.
            setTexto((actual) => pulsarTecla(actual ?? '', tecla));
          }}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Espacio.m, paddingBottom: Espacio.l },
  nombre: { fontSize: Letra.secundario, textAlign: 'center', paddingTop: Espacio.s },
  importe: {
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: -1,
    textAlign: 'center',
    paddingVertical: Espacio.s,
  },
  ayuda: { fontSize: Letra.pequeno, textAlign: 'center', lineHeight: 18 },
  tarjeta: { marginTop: Espacio.m },
  nota: { fontSize: Letra.pequeno, lineHeight: 18 },
  candidato: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.xs,
    gap: Espacio.s,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  textos: { flex: 1, gap: 2 },
});
