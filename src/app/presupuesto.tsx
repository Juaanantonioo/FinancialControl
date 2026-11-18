import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton, TextoDeError } from '@/componentes/basicos';
import { CabeceraDeFormulario, useOperacion } from '@/componentes/Formulario';
import { DistintivoDeCategoria, Tarjeta } from '@/componentes/Tarjeta';
import { leerParametros } from '@/dominio/entradas';
import { analizarImporte, formatearNumero, simboloDeDivisa } from '@/dominio/dinero';
import { propuestaDePresupuesto } from '@/dominio/presupuesto';
import { ocurrenciasDelMes } from '@/dominio/recurrentes';
import { mesDe, moverMes } from '@/dominio/resumen';
import { aspectoDeCategoria } from '@/estado/aspecto';
import { useAviso } from '@/estado/Aviso';
import { useDatos } from '@/estado/Datos';
import { describirMes } from '@/estado/fechas';
import { formatoRegional, importe } from '@/estado/formato';
import { usePanel } from '@/estado/panel';
import { usePlan, usePresupuesto } from '@/estado/plan';
import { t } from '@/i18n';
import { cifrasTabulares, Espacio, Letra, TactilMinimo, useColores, usePaleta } from '@/theme';

/**
 * P12 · Edición de presupuesto: un importe por categoría de gasto, con la
 * propuesta ya puesta al crear, el total arriba y «Copiar el mes anterior».
 * Un importe vacío deja esa categoría sin presupuestar.
 */
export default function PantallaDePresupuesto() {
  const c = useColores();
  const paleta = usePaleta();
  const margen = useSafeAreaInsets();
  const formato = formatoRegional();
  const mes = leerParametros(useLocalSearchParams(), { mes: 'mes' }).mes ?? mesDe();
  const anterior = moverMes(mes, -1);
  const { repos, notificarCambio } = useDatos();
  const mostrarAviso = useAviso();
  const panel = usePanel();
  const plan = usePlan();
  const existente = usePresupuesto(mes);
  const delAnterior = usePresupuesto(anterior);
  const { error, setError, ocupado, ejecutar } = useOperacion();
  const { divisa, hoy } = panel;

  // Categorías de gasto de primer nivel. Una archivada solo si ya tiene línea.
  const categorias = panel.categorias.filter(
    (x) =>
      x.tipo === 'gasto' &&
      x.padreId === null &&
      (!x.archivada || existente?.lineas.some((l) => l.categoriaId === x.id)),
  );

  const [textos, setTextos] = useState<Record<string, string> | null>(null);
  const [conPropuesta, setConPropuesta] = useState(false);
  // Al llegar los datos se rellenan los campos una sola vez: con el presupuesto
  // que ya existe o, si es nuevo, con la media de los meses anteriores.
  if (textos === null && panel.cargado && existente !== undefined) {
    const inicial: Record<string, string> = {};
    if (existente) {
      for (const linea of existente.lineas) {
        inicial[linea.categoriaId] = formatearNumero(linea.importe, formato);
      }
    } else {
      const propuesta = propuestaDePresupuesto(panel.movimientos, panel.categorias, mes);
      for (const [categoriaId, centimos] of propuesta) {
        if (categorias.some((x) => x.id === categoriaId)) {
          inicial[categoriaId] = formatearNumero(centimos, formato);
        }
      }
      setConPropuesta(Object.keys(inicial).length > 0);
    }
    setTextos(inicial);
  }

  const valores = textos ?? {};
  let total = 0;
  for (const categoria of categorias) {
    const centimos = analizarImporte(valores[categoria.id] ?? '');
    if (centimos !== null && centimos > 0) total += centimos;
  }
  // Ingresos periódicos previstos ese mes, para comparar con lo presupuestado (flujo F4).
  const ingresos = ocurrenciasDelMes(
    plan.reglas.filter((r) => r.divisa === divisa && r.tipoMovimiento === 'ingreso'),
    [],
    mes,
    hoy,
  ).reduce((suma, o) => suma + o.regla.importe, 0);

  function copiar() {
    if (!delAnterior) return;
    const copia: Record<string, string> = {};
    for (const linea of delAnterior.lineas) {
      copia[linea.categoriaId] = formatearNumero(linea.importe, formato);
    }
    setTextos(copia);
    setConPropuesta(false);
    setError(null);
  }

  function guardar() {
    const lineas: { categoriaId: string; importe: number }[] = [];
    for (const categoria of categorias) {
      const texto = (valores[categoria.id] ?? '').trim();
      if (texto === '') continue;
      const centimos = analizarImporte(texto);
      if (centimos === null || centimos < 0) {
        setError(`${categoria.nombre}: ${t('errores.importe_no_valido')}`);
        return;
      }
      lineas.push({ categoriaId: categoria.id, importe: centimos });
    }
    ejecutar(() => repos.presupuestos.guardar(mes, lineas));
  }

  function borrar() {
    ejecutar(async () => {
      const id = await repos.presupuestos.borrar(mes);
      mostrarAviso({
        texto: t('presupuesto.borrado'),
        accion: {
          texto: t('comun.deshacer'),
          alPulsar: () => {
            repos.presupuestos.restaurar(id).then(notificarCambio, () => undefined);
          },
        },
      });
    });
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <CabeceraDeFormulario
        titulo={t('presupuesto.tituloDe', { mes: describirMes(mes) })}
        alGuardar={guardar}
        desactivado={ocupado || textos === null}
      />
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingBottom: margen.bottom + Espacio.xl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <Tarjeta>
          <View
            accessible
            accessibilityLabel={`${t('presupuesto.total')}: ${importe(total, divisa)}`}>
            <Text style={{ color: c.textoSecundario, fontSize: Letra.secundario }}>
              {t('presupuesto.total')}
            </Text>
            <Text
              style={[estilos.cifra, cifrasTabulares, { color: c.texto }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              maxFontSizeMultiplier={1.6}
              testID="total-presupuestado">
              {importe(total, divisa)}
            </Text>
          </View>
          {ingresos > 0 ? (
            <Text style={[estilos.nota, { color: c.textoSecundario }]} testID="ingresos-previstos">
              {`${t('presupuesto.ingresosPrevistos', { ingresos: importe(ingresos, divisa) })} · ${
                ingresos >= total
                  ? t('presupuesto.sinAsignar', { importe: importe(ingresos - total, divisa) })
                  : t('presupuesto.porEncima', { importe: importe(total - ingresos, divisa) })
              }`}
            </Text>
          ) : null}
        </Tarjeta>

        <Boton
          texto={t('presupuesto.copiar', { mes: describirMes(anterior) })}
          alPulsar={copiar}
          desactivado={!delAnterior}
          testID="copiar-mes-anterior"
          estilo={estilos.enlace}
        />
        {delAnterior === null ? (
          <Text style={[estilos.nota, { color: c.textoSecundario }]} testID="sin-mes-anterior">
            {t('presupuesto.copiarSinAnterior', { mes: describirMes(anterior) })}
          </Text>
        ) : null}
        {existente === null ? (
          <Text style={[estilos.nota, { color: c.textoSecundario }]} testID="nota-de-propuesta">
            {conPropuesta ? t('presupuesto.propuesta') : t('presupuesto.sinPropuesta')}
          </Text>
        ) : null}
        <TextoDeError texto={error} />

        <Tarjeta>
          {panel.cargado && categorias.length === 0 ? (
            <Text style={[estilos.nota, { color: c.textoSecundario }]}>
              {t('presupuesto.sinCategorias')}
            </Text>
          ) : null}
          {categorias.map((categoria, i) => (
            <View
              key={categoria.id}
              style={[
                estilos.fila,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borde },
              ]}>
              <DistintivoDeCategoria aspecto={aspectoDeCategoria(categoria, paleta)} lado={32} />
              <Text style={[estilos.nombre, { color: c.texto }]}>{categoria.nombre}</Text>
              <TextInput
                value={valores[categoria.id] ?? ''}
                onChangeText={(texto) => {
                  setError(null);
                  setTextos({ ...valores, [categoria.id]: texto });
                }}
                placeholder={formatearNumero(0, formato)}
                placeholderTextColor={c.textoSecundario}
                accessibilityLabel={t('presupuesto.importeDe', { nombre: categoria.nombre })}
                testID={`importe-${categoria.nombre}`}
                keyboardType="numbers-and-punctuation"
                maxLength={16}
                style={[estilos.campo, cifrasTabulares, { color: c.texto }]}
              />
              <Text style={{ color: c.textoSecundario, fontSize: Letra.cuerpo }}>
                {simboloDeDivisa(divisa)}
              </Text>
            </View>
          ))}
        </Tarjeta>
        <Text style={[estilos.nota, { color: c.textoSecundario }]}>
          {t('presupuesto.vacioEsCero')}
        </Text>
        {existente ? (
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
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Espacio.m, gap: Espacio.s },
  cifra: { fontSize: Letra.cifraGrande, fontWeight: '800', letterSpacing: -1 },
  nota: { fontSize: Letra.pequeno, lineHeight: 18, paddingHorizontal: Espacio.xs },
  enlace: { alignSelf: 'flex-start', paddingHorizontal: Espacio.xs },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.s,
    gap: Espacio.s,
  },
  nombre: { flex: 1, fontSize: Letra.cuerpo, fontWeight: '500' },
  campo: {
    minWidth: 96,
    minHeight: TactilMinimo,
    fontSize: Letra.cuerpo,
    fontWeight: '700',
    textAlign: 'right',
  },
});
