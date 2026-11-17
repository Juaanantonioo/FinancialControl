/**
 * Bloques de planificación de Inicio (T-084): disponible del mes (D1),
 * «Pendiente» (cobros por confirmar, pagos por revisar y avisos de
 * presupuesto), próximos cobros (D9), objetivos (D8) y «Primeros pasos».
 * Hablan siempre de hoy y del mes en curso. Cada uno muestra un número fijo
 * de elementos y un «Ver todos» que lleva a su pestaña y sección.
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Boton } from '@/componentes/basicos';
import { BarraDePresupuesto, FilaDeCobro, FilaDeObjetivo } from '@/componentes/plan/Piezas';
import { abrirCobro } from '@/componentes/plan/SeccionFijos';
import { EstadoVacio, Tarjeta } from '@/componentes/Tarjeta';
import { estadoDeObjetivo } from '@/dominio/objetivos';
import { disponibleDelMes, estadoDeLinea, estadoDelPresupuesto } from '@/dominio/presupuesto';
import {
  fijosPendientes,
  pendientesDelMes,
  porConfirmar,
  proximosCobros,
} from '@/dominio/recurrentes';
import { useConsulta } from '@/estado/Datos';
import { describirMes } from '@/estado/fechas';
import { importe } from '@/estado/formato';
import {
  AVISOS_EN_PENDIENTE,
  COBROS_EN_PENDIENTE,
  OBJETIVOS_EN_INICIO,
  primerosPasos,
  PROXIMOS_EN_INICIO,
  recortar,
  type Paso,
} from '@/estado/inicio';
import { abrirPlan } from '@/estado/navegar';
import type { usePanel } from '@/estado/panel';
import { useConfirmarCobro, usePlan, usePresupuesto } from '@/estado/plan';
import { t } from '@/i18n';
import { cifrasTabulares, Espacio, Letra, TactilMinimo, useColores } from '@/theme';

type Panel = ReturnType<typeof usePanel>;

/** D1 · Disponible este mes. */
export function BloqueDisponible({ panel }: { panel: Panel }) {
  const c = useColores();
  const { hoy, divisa, divisas, movimientos, categorias } = panel;
  const mes = hoy.slice(0, 7);
  const plan = usePlan();
  const presupuesto = usePresupuesto(mes);
  // El presupuesto no lleva divisa: se entiende en la divisa principal.
  const enDivisaPrincipal = divisa === (divisas[0] ?? divisa);
  if (!enDivisaPrincipal || presupuesto === undefined) return null;

  const reglas = plan.reglas.filter((r) => r.divisa === divisa);
  const pendientes = pendientesDelMes(reglas, movimientos, mes, hoy);
  const estado = presupuesto
    ? estadoDelPresupuesto(presupuesto.lineas, movimientos, categorias, mes, hoy)
    : null;
  const d1 = estado
    ? disponibleDelMes(estado.presupuestado, estado.gastado, fijosPendientes(pendientes), mes, hoy)
    : null;

  let detalle = '';
  if (d1) {
    if (d1.exceso > 0) {
      detalle = t('inicio.tePasas', { importe: importe(d1.exceso, divisa) });
    } else if (d1.diasQueQuedan === 1) {
      detalle = t('inicio.porDiaUno', { importe: importe(d1.porDia, divisa) });
    } else {
      detalle = t('inicio.porDia', {
        importe: importe(d1.porDia, divisa),
        dias: d1.diasQueQuedan,
      });
    }
  }

  return (
    <Tarjeta titulo={t('inicio.disponibleDelMes')} testID="bloque-disponible">
      {d1 && estado ? (
        <>
          <View
            accessible
            accessibilityLabel={t('inicio.disponibleLeido', {
              importe: importe(d1.disponible, divisa),
              detalle,
            })}>
            <Text
              style={[
                estilos.cifra,
                cifrasTabulares,
                { color: d1.disponible < 0 ? c.negativo : c.texto },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
              maxFontSizeMultiplier={1.6}
              testID="disponible">
              {importe(Math.max(0, d1.disponible), divisa)}
            </Text>
            <Text
              maxFontSizeMultiplier={1.6}
              style={{
                color: d1.exceso > 0 ? c.negativo : c.textoSecundario,
                fontSize: Letra.secundario,
                fontWeight: d1.exceso > 0 ? '700' : '400',
              }}
              testID="disponible-por-dia">
              {detalle}
            </Text>
          </View>
          <BarraDePresupuesto
            real={estado.gastado + fijosPendientes(pendientes)}
            previsto={estado.presupuestado}
            estado={estadoDeLinea(
              estado.presupuestado,
              estado.gastado + fijosPendientes(pendientes),
            )}
            marca={estado.marcaDelDia}
          />
          <Text maxFontSizeMultiplier={1.6} style={[estilos.nota, { color: c.textoSecundario }]}>
            {t('inicio.comprometido', { porcentaje: d1.avance })}
          </Text>
        </>
      ) : (
        <EstadoVacio
          texto={t('inicio.sinPresupuesto', { mes: describirMes(mes) })}
          testID="disponible-vacio"
          accion={{
            texto: t('inicio.crearPresupuesto'),
            alPulsar: () => router.push({ pathname: '/presupuesto', params: { mes } }),
            testID: 'crear-presupuesto',
          }}
        />
      )}
    </Tarjeta>
  );
}

/**
 * «Pendiente»: lo que espera a que la persona haga algo. Reúne los cobros
 * con el día ya vencido, los pagos capturados por revisar y los avisos de
 * presupuesto. Si no hay nada, no se pinta. Cada parte conserva su acción.
 */
export function BloquePendiente({ panel }: { panel: Panel }) {
  const c = useColores();
  const { hoy, divisa, divisas, movimientos, categorias } = panel;
  const mes = hoy.slice(0, 7);
  const plan = usePlan();
  const confirmar = useConfirmarCobro();
  const presupuesto = usePresupuesto(mes);
  const porRevisar = useConsulta((r) => r.capturas.contarPendientes()) ?? 0;
  const enDivisaPrincipal = divisa === (divisas[0] ?? divisa);

  const reglas = plan.reglas.filter((r) => r.divisa === divisa);
  const cobros = recortar(porConfirmar(reglas, movimientos, hoy), COBROS_EN_PENDIENTE);
  // T-067 · El aviso de presupuesto se deriva del estado, no se guarda.
  const estado =
    presupuesto && enDivisaPrincipal
      ? estadoDelPresupuesto(presupuesto.lineas, movimientos, categorias, mes, hoy)
      : null;
  const avisos = recortar(
    (estado?.lineas ?? []).filter((l) => l.estado !== 'dentro'),
    AVISOS_EN_PENDIENTE,
  );
  const nombreDe = (categoriaId: string) =>
    categorias.find((x) => x.id === categoriaId)?.nombre ?? t('inicio.sinCategoria');

  const hayCobros = cobros.visibles.length > 0;
  const hayAvisos = avisos.visibles.length > 0;
  if (!hayCobros && porRevisar === 0 && !hayAvisos) return null;

  const separador = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borde };
  return (
    <Tarjeta titulo={t('inicio.pendiente')} testID="bloque-pendiente">
      {hayCobros ? (
        <View testID="bloque-por-confirmar">
          <Text
            maxFontSizeMultiplier={1.6}
            style={[estilos.grupo, { color: c.textoSecundario }]}
            accessibilityRole="header">
            {t('inicio.porConfirmar')}
          </Text>
          {cobros.visibles.map((o, i) => (
            <FilaDeCobro
              key={`${o.regla.id}-${o.mes}`}
              ocurrencia={o}
              separador={i > 0}
              alAbrir={() => abrirCobro(o)}
              alConfirmar={() => confirmar(o.regla.id, o.mes, o.regla.nombre)}
            />
          ))}
          {cobros.ocultos > 0 ? (
            <Boton
              texto={t('inicio.verTodosMas', { total: cobros.ocultos })}
              etiqueta={`${t('inicio.verTodosMas', { total: cobros.ocultos })}. ${t('inicio.porConfirmar')}`}
              alPulsar={() => abrirPlan('fijos', mes)}
              testID="ver-por-confirmar"
              estilo={estilos.enlace}
            />
          ) : null}
        </View>
      ) : null}

      {porRevisar > 0 ? (
        <Pressable
          onPress={() => router.push('/capturas')}
          accessibilityRole="button"
          accessibilityLabel={`${t('bandeja.enInicio', { total: porRevisar })}. ${t('bandeja.enInicioAyuda')}`}
          testID="bloque-capturas"
          style={({ pressed }) => [
            estilos.fila,
            hayCobros && separador,
            { opacity: pressed ? 0.6 : 1 },
          ]}>
          <View style={estilos.textos}>
            <Text maxFontSizeMultiplier={1.6} style={[estilos.nombre, { color: c.texto }]}>
              {t('bandeja.enInicio', { total: porRevisar })}
            </Text>
            <Text
              maxFontSizeMultiplier={1.6}
              style={{ color: c.textoSecundario, fontSize: Letra.pequeno, lineHeight: 18 }}>
              {t('bandeja.enInicioAyuda')}
            </Text>
          </View>
          <Text
            allowFontScaling={false}
            style={{ color: c.textoSecundario, fontSize: Letra.subtitulo }}>
            ›
          </Text>
        </Pressable>
      ) : null}

      {hayAvisos ? (
        <View
          testID="aviso-de-presupuesto"
          style={[estilos.avisos, (hayCobros || porRevisar > 0) && separador]}>
          <Text
            maxFontSizeMultiplier={1.6}
            style={[estilos.grupo, { color: c.textoSecundario }]}
            accessibilityRole="header">
            {`⚠ ${t('presupuesto.avisoTitulo')}`}
          </Text>
          {avisos.visibles.map((l) => (
            <Text
              maxFontSizeMultiplier={1.6}
              key={l.categoriaId}
              style={{
                color: l.estado === 'excedida' ? c.negativo : c.aviso,
                fontSize: Letra.secundario,
                fontWeight: '600',
              }}>
              {l.estado === 'excedida'
                ? t('presupuesto.avisoExcedida', {
                    nombre: nombreDe(l.categoriaId),
                    importe: importe(-l.queda, divisa),
                  })
                : t('presupuesto.avisoCerca', {
                    nombre: nombreDe(l.categoriaId),
                    porcentaje: l.porcentaje ?? 100,
                  })}
            </Text>
          ))}
          <Boton
            texto={
              avisos.ocultos > 0
                ? t('inicio.verPresupuestoMas', { total: avisos.ocultos })
                : t('inicio.verPresupuesto')
            }
            alPulsar={() => abrirPlan('presupuesto', mes)}
            testID="ver-presupuesto"
            estilo={estilos.enlace}
          />
        </View>
      ) : null}
    </Tarjeta>
  );
}

/** D9 · Próximos cobros: como mucho tres y «Ver todos». */
export function BloqueProximos({ panel }: { panel: Panel }) {
  const c = useColores();
  const { hoy, divisa, movimientos, sinCuentas } = panel;
  const plan = usePlan();
  if (!plan.cargado) return null;
  const reglas = plan.reglas.filter((r) => r.divisa === divisa);
  const proximos = recortar(proximosCobros(reglas, movimientos, hoy), PROXIMOS_EN_INICIO);

  return (
    <Tarjeta titulo={t('inicio.proximosCobros')} testID="bloque-proximos">
      {reglas.length === 0 ? (
        <EstadoVacio
          texto={t('inicio.sinFijos')}
          testID="proximos-sin-fijos"
          accion={
            sinCuentas
              ? undefined
              : {
                  texto: t('inicio.anadirFijo'),
                  alPulsar: () => router.push('/regla'),
                  testID: 'anadir-fijo',
                }
          }
        />
      ) : (
        <>
          {proximos.visibles.length === 0 ? (
            <Text
              maxFontSizeMultiplier={1.6}
              style={[estilos.nota, { color: c.textoSecundario }]}
              testID="proximos-vacio">
              {t('inicio.proximosVacio')}
            </Text>
          ) : (
            proximos.visibles.map((o, i) => (
              <FilaDeCobro
                key={`${o.regla.id}-${o.mes}`}
                ocurrencia={o}
                separador={i > 0}
                alAbrir={() => abrirCobro(o)}
              />
            ))
          )}
          <Boton
            texto={
              proximos.ocultos > 0
                ? t('inicio.verTodosMas', { total: proximos.ocultos })
                : t('inicio.verTodos')
            }
            etiqueta={`${t('inicio.verTodos')}. ${t('inicio.proximosCobros')}`}
            alPulsar={() => abrirPlan('fijos', hoy.slice(0, 7))}
            testID="ver-proximos"
            estilo={estilos.enlace}
          />
        </>
      )}
    </Tarjeta>
  );
}

/** D8 · Objetivos: como mucho dos y «Ver todos». */
export function BloqueObjetivos({ panel }: { panel: Panel }) {
  const { hoy, divisa } = panel;
  const plan = usePlan();
  if (!plan.cargado) return null;
  const objetivos = recortar(
    plan.objetivos.filter((o) => o.divisa === divisa && !o.archivado),
    OBJETIVOS_EN_INICIO,
  );

  return (
    <Tarjeta titulo={t('inicio.objetivos')} testID="bloque-objetivos">
      {objetivos.visibles.length === 0 ? (
        <EstadoVacio
          texto={t('inicio.sinObjetivos')}
          testID="objetivos-vacio"
          accion={{
            texto: t('inicio.crearObjetivo'),
            alPulsar: () => router.push('/objetivo-editar'),
            testID: 'crear-objetivo',
          }}
        />
      ) : (
        <>
          {objetivos.visibles.map((objetivo, i) => (
            <FilaDeObjetivo
              key={objetivo.id}
              objetivo={objetivo}
              estado={estadoDeObjetivo(objetivo, plan.aportaciones, hoy)}
              separador={i > 0}
              alPulsar={() => router.push({ pathname: '/objetivo', params: { id: objetivo.id } })}
            />
          ))}
          <Boton
            texto={
              objetivos.ocultos > 0
                ? t('inicio.verTodosMas', { total: objetivos.ocultos })
                : t('inicio.verTodos')
            }
            etiqueta={`${t('inicio.verTodos')}. ${t('inicio.objetivos')}`}
            alPulsar={() => abrirPlan('objetivos')}
            testID="ver-objetivos"
            estilo={estilos.enlace}
          />
        </>
      )}
    </Tarjeta>
  );
}

const TEXTO_DE_PASO: Record<Paso, string> = {
  cuenta: t('inicio.pasoCuenta'),
  movimiento: t('inicio.pasoMovimiento'),
  presupuesto: t('inicio.pasoPresupuesto'),
};

/**
 * «Primeros pasos»: crear una cuenta, anotar un movimiento y crear un
 * presupuesto. Cada paso se marca solo cuando existe el dato y la tarjeta
 * desaparece al completar los tres. No se guarda nada.
 */
export function BloquePrimerosPasos({ panel }: { panel: Panel }) {
  const c = useColores();
  const hayMovimiento = useConsulta((r) => r.movimientos.mesesConMovimientos());
  const hayPresupuesto = useConsulta((r) => r.presupuestos.hayAlguno());
  if (!panel.cargado || hayMovimiento === undefined || hayPresupuesto === undefined) return null;

  const estado = primerosPasos({
    hayCuenta: !panel.sinCuentas,
    hayMovimiento: hayMovimiento.length > 0,
    hayPresupuesto,
  });
  if (estado.completos) return null;

  const abrir: Record<Paso, () => void> = {
    cuenta: () => router.push('/cuenta'),
    movimiento: () => router.push('/movimiento'),
    presupuesto: () =>
      router.push({ pathname: '/presupuesto', params: { mes: panel.hoy.slice(0, 7) } }),
  };

  return (
    <Tarjeta titulo={t('inicio.primerosPasos')} testID="bloque-primeros-pasos">
      <Text
        maxFontSizeMultiplier={1.6}
        style={[estilos.nota, { color: c.textoSecundario }]}
        testID="pasos-hechos">
        {t('inicio.pasosHechos', { hechos: estado.hechos, total: estado.pasos.length })}
      </Text>
      {estado.pasos.map(({ paso, hecho }, i) => (
        <Pressable
          key={paso}
          onPress={abrir[paso]}
          disabled={hecho}
          accessibilityRole="button"
          accessibilityLabel={`${TEXTO_DE_PASO[paso]}. ${
            hecho ? t('inicio.pasoHecho') : t('inicio.pasoPendiente')
          }`}
          accessibilityState={{ disabled: hecho, checked: hecho }}
          testID={`paso-${paso}`}
          style={({ pressed }) => [
            estilos.fila,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borde },
            { opacity: pressed ? 0.6 : 1 },
          ]}>
          {/* El estado se lee en el símbolo y en el texto, no solo en el color. */}
          <Text
            allowFontScaling={false}
            style={[estilos.marca, { color: hecho ? c.positivo : c.textoSecundario }]}>
            {hecho ? '✓' : '○'}
          </Text>
          <View style={estilos.textos}>
            <Text
              maxFontSizeMultiplier={1.6}
              style={[
                estilos.nombre,
                { color: hecho ? c.textoSecundario : c.texto },
                hecho && { textDecorationLine: 'line-through' },
              ]}>
              {TEXTO_DE_PASO[paso]}
            </Text>
            <Text
              maxFontSizeMultiplier={1.6}
              style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>
              {hecho ? t('inicio.pasoHecho') : t('inicio.pasoPendiente')}
            </Text>
          </View>
          {hecho ? null : (
            <Text
              allowFontScaling={false}
              style={{ color: c.textoSecundario, fontSize: Letra.subtitulo }}>
              ›
            </Text>
          )}
        </Pressable>
      ))}
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  cifra: { fontSize: Letra.cifra, fontWeight: '800', letterSpacing: -0.5 },
  nota: { fontSize: Letra.pequeno, lineHeight: 18 },
  enlace: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: Espacio.xs },
  grupo: {
    fontSize: Letra.pequeno,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  avisos: { gap: Espacio.xs, paddingTop: Espacio.s },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.s,
    paddingVertical: Espacio.s,
    gap: Espacio.s,
  },
  textos: { flex: 1, gap: 2 },
  nombre: { fontSize: Letra.cuerpo, fontWeight: '600' },
  marca: { width: 28, fontSize: 22, fontWeight: '700', textAlign: 'center' },
});
