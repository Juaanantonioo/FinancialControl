/**
 * Piezas visuales de la planificación que usan Inicio y la pestaña Plan:
 * barra de presupuesto, fila de cobro, tarjeta de objetivo y controles de
 * formulario para elegir un número o un mes.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Anillo } from '@/componentes/Graficos';
import type { EstadoDeObjetivo, Objetivo } from '@/dominio/objetivos';
import type { EstadoDeLinea } from '@/dominio/presupuesto';
import type { Ocurrencia, ReglaRecurrente } from '@/dominio/recurrentes';
import { diaYMes } from '@/estado/fechas';
import { conSigno, importe } from '@/estado/formato';
import { t } from '@/i18n';
import {
  cifrasTabulares,
  Espacio,
  Letra,
  Radio,
  TactilMinimo,
  useColores,
  type Colores,
} from '@/theme';

/** Color de una barra según el estado. El estado va además escrito, con su símbolo. */
export function colorDeEstado(c: Colores, estado: EstadoDeLinea): string {
  if (estado === 'excedida') return c.negativo;
  if (estado === 'cerca') return c.aviso;
  return c.acento;
}

export function textoDeEstado(estado: EstadoDeLinea): string {
  if (estado === 'excedida') return t('presupuesto.estadoExcedida');
  if (estado === 'cerca') return t('presupuesto.estadoCerca');
  return t('presupuesto.estadoDentro');
}

/** Ancho de relleno de una barra, de 0 a 100. Un gasto mayor que cero siempre se ve. */
export function anchoDeBarra(real: number, previsto: number): number {
  if (real <= 0) return 0;
  if (previsto <= 0) return 100;
  return Math.min(100, Math.max(2, Math.round((real * 100) / previsto)));
}

/**
 * Barra de previsto frente a real. `marca` (de 0 a 1) dibuja una raya en el
 * punto del mes en el que se está hoy. Es decorativa: las cifras y el estado
 * van escritos al lado.
 */
export function BarraDePresupuesto({
  real,
  previsto,
  estado,
  marca = null,
  testID,
}: {
  real: number;
  previsto: number;
  estado: EstadoDeLinea;
  marca?: number | null;
  testID?: string;
}) {
  const c = useColores();
  return (
    <View
      style={estilos.contenedorDeBarra}
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View style={[estilos.pista, { backgroundColor: c.superficieSuave }]}>
        <View
          style={[
            estilos.relleno,
            {
              width: `${anchoDeBarra(real, previsto)}%`,
              backgroundColor: colorDeEstado(c, estado),
            },
          ]}
        />
      </View>
      {marca !== null ? (
        <View
          testID="marca-del-dia"
          style={[
            estilos.marca,
            { left: `${Math.min(100, Math.max(0, marca * 100))}%`, backgroundColor: c.texto },
          ]}
        />
      ) : null}
    </View>
  );
}

/** Importe de una regla con su signo: un gasto resta, un ingreso suma, una aportación va sin signo. */
export function importeDeRegla(
  regla: Pick<ReglaRecurrente, 'tipoMovimiento' | 'importe' | 'divisa'>,
) {
  if (regla.tipoMovimiento === 'gasto') return conSigno(-regla.importe, regla.divisa);
  if (regla.tipoMovimiento === 'ingreso') return conSigno(regla.importe, regla.divisa);
  return importe(regla.importe, regla.divisa);
}

/**
 * Fila de un cobro pendiente. Tocar la fila abre la pantalla para cambiar el
 * importe o la fecha; el botón «Confirmar», si se pasa, lo confirma en un toque.
 */
export function FilaDeCobro({
  ocurrencia,
  alAbrir,
  alConfirmar,
  separador = false,
}: {
  ocurrencia: Ocurrencia<ReglaRecurrente>;
  alAbrir: () => void;
  alConfirmar?: () => void;
  separador?: boolean;
}) {
  const c = useColores();
  const { regla, fecha } = ocurrencia;
  const cifra = importeDeRegla(regla);
  return (
    <View
      style={[
        estilos.cobro,
        separador && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borde },
      ]}>
      <Pressable
        onPress={alAbrir}
        accessibilityRole="button"
        accessibilityLabel={t('fijos.cobroLeido', {
          nombre: regla.nombre,
          importe: cifra,
          fecha: diaYMes(fecha),
        })}
        testID={`cobro-${regla.nombre}-${fecha}`}
        style={({ pressed }) => [estilos.textosDeCobro, { opacity: pressed ? 0.6 : 1 }]}>
        <Text style={[estilos.nombre, { color: c.texto }]}>{regla.nombre}</Text>
        <Text style={{ color: c.textoSecundario, fontSize: Letra.pequeno }}>
          {`${diaYMes(fecha)} · `}
          <Text
            style={[
              cifrasTabulares,
              {
                color: regla.tipoMovimiento === 'ingreso' ? c.positivo : c.textoSecundario,
                fontWeight: '700',
              },
            ]}>
            {cifra}
          </Text>
        </Text>
      </Pressable>
      {alConfirmar ? (
        <Pressable
          onPress={alConfirmar}
          accessibilityRole="button"
          accessibilityLabel={t('fijos.confirmarLeido', { nombre: regla.nombre })}
          testID={`confirmar-${regla.nombre}-${fecha}`}
          style={({ pressed }) => [
            estilos.botonConfirmar,
            { backgroundColor: c.acento, opacity: pressed ? 0.7 : 1 },
          ]}>
          <Text
            style={{ color: c.sobreAcento, fontSize: Letra.secundario, fontWeight: '700' }}
            maxFontSizeMultiplier={1.5}>
            {t('comun.confirmar')}
          </Text>
        </Pressable>
      ) : (
        <Text
          style={[estilos.importeDeCobro, cifrasTabulares, { color: c.textoSecundario }]}
          allowFontScaling={false}>
          ›
        </Text>
      )}
    </View>
  );
}

/** Frase del ritmo de un objetivo: lo que hace falta al mes, o su situación. */
export function ritmoDeObjetivo(estado: EstadoDeObjetivo, divisa: string, largo = false): string {
  if (estado.situacion === 'conseguido') return t('objetivos.conseguido');
  if (estado.situacion === 'plazo_vencido') return t('objetivos.plazoVencido');
  if (estado.situacion === 'sin_fecha' || estado.necesarioAlMes === null) {
    return t('objetivos.sinFecha');
  }
  const cifra = importe(estado.necesarioAlMes, divisa);
  if (estado.mesesRestantes === 1) return t('objetivos.necesitasUnMes', { importe: cifra });
  return largo
    ? t('objetivos.necesitasDurante', { importe: cifra, meses: estado.mesesRestantes ?? 0 })
    : t('objetivos.necesitas', { importe: cifra });
}

/** Anillo de avance de un objetivo con el porcentaje en el centro. */
export function AnilloDeObjetivo({
  estado,
  lado = 64,
  clave,
}: {
  estado: EstadoDeObjetivo;
  lado?: number;
  clave: string;
}) {
  const c = useColores();
  const color = estado.situacion === 'conseguido' ? c.positivo : c.acento;
  return (
    <Anillo
      clave={clave}
      lado={lado}
      grosor={Math.round(lado / 8)}
      sectores={[
        { clave: 'aportado', valor: estado.avance, color },
        { clave: 'falta', valor: 100 - estado.avance, color: c.superficieSuave },
      ]}
      descripcion={t('objetivos.avanceLeido', { porcentaje: estado.avance })}>
      <Text
        allowFontScaling={false}
        style={[cifrasTabulares, { color: c.texto, fontSize: lado / 4.2, fontWeight: '800' }]}>
        {`${estado.avance} %`}
      </Text>
    </Anillo>
  );
}

/** Tarjeta de un objetivo: anillo, nombre, aportado de meta y ritmo necesario. */
export function FilaDeObjetivo({
  objetivo,
  estado,
  alPulsar,
  separador = false,
}: {
  objetivo: Objetivo;
  estado: EstadoDeObjetivo;
  alPulsar: () => void;
  separador?: boolean;
}) {
  const c = useColores();
  const ritmo = ritmoDeObjetivo(estado, objetivo.divisa);
  const cifras = t('objetivos.aportadoDeMeta', {
    aportado: importe(estado.aportado, objetivo.divisa),
    meta: importe(objetivo.meta, objetivo.divisa),
  });
  return (
    <Pressable
      onPress={alPulsar}
      accessibilityRole="button"
      accessibilityLabel={t('objetivos.tarjetaLeida', {
        nombre: objetivo.nombre,
        aportado: importe(estado.aportado, objetivo.divisa),
        meta: importe(objetivo.meta, objetivo.divisa),
        porcentaje: estado.avance,
        ritmo,
      })}
      testID={`objetivo-${objetivo.nombre}`}
      style={({ pressed }) => [
        estilos.objetivo,
        separador && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borde },
        { opacity: pressed ? 0.6 : 1 },
      ]}>
      <AnilloDeObjetivo estado={estado} clave={`${objetivo.id}-${estado.aportado}`} />
      <View style={estilos.textosDeCobro}>
        <Text style={[estilos.nombre, { color: c.texto }]}>
          {objetivo.nombre}
          {objetivo.archivado ? (
            <Text style={{ color: c.textoSecundario, fontWeight: '400' }}>
              {` · ${t('objetivos.archivado')}`}
            </Text>
          ) : null}
        </Text>
        <Text style={[cifrasTabulares, { color: c.textoSecundario, fontSize: Letra.pequeno }]}>
          {cifras}
        </Text>
        <Text
          style={{
            color:
              estado.situacion === 'conseguido'
                ? c.positivo
                : estado.situacion === 'plazo_vencido'
                  ? c.aviso
                  : c.texto,
            fontSize: Letra.pequeno,
            fontWeight: '700',
          }}>
          {ritmo}
        </Text>
      </View>
    </Pressable>
  );
}

/** «‹ 18 ›»: elige un número entero entre dos límites. */
export function PasoDeNumero({
  valor,
  minimo,
  maximo,
  alCambiar,
  texto,
  etiquetaMenos,
  etiquetaMas,
  testID,
}: {
  valor: number;
  minimo: number;
  maximo: number;
  alCambiar: (valor: number) => void;
  /** Texto del valor. */
  texto: string;
  etiquetaMenos: string;
  etiquetaMas: string;
  testID: string;
}) {
  const c = useColores();
  const boton = (salto: -1 | 1, etiqueta: string) => {
    const desactivado = salto === -1 ? valor <= minimo : valor >= maximo;
    return (
      <Pressable
        onPress={() => alCambiar(valor + salto)}
        disabled={desactivado}
        accessibilityRole="button"
        accessibilityLabel={etiqueta}
        accessibilityState={{ disabled: desactivado }}
        testID={`${testID}-${salto === -1 ? 'menos' : 'mas'}`}
        style={[estilos.flecha, { opacity: desactivado ? 0.3 : 1 }]}>
        <Text allowFontScaling={false} style={{ color: c.acento, fontSize: 24 }}>
          {salto === -1 ? '‹' : '›'}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={estilos.paso}>
      {boton(-1, etiquetaMenos)}
      <Text
        style={[estilos.valorDePaso, cifrasTabulares, { color: c.texto }]}
        testID={testID}
        accessibilityLiveRegion="polite">
        {texto}
      </Text>
      {boton(1, etiquetaMas)}
    </View>
  );
}

/** Bloque de formulario con su rótulo encima. */
export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const c = useColores();
  return (
    <View style={estilos.campo}>
      <Text style={{ color: c.textoSecundario, fontSize: Letra.secundario }}>{rotulo}</Text>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedorDeBarra: { height: 14, justifyContent: 'center' },
  pista: { height: 8, borderRadius: Radio.circulo, overflow: 'hidden' },
  relleno: { height: 8, borderRadius: Radio.circulo },
  marca: { position: 'absolute', top: 0, width: 2, height: 14, marginLeft: -1, borderRadius: 1 },
  cobro: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.s,
    paddingVertical: Espacio.s,
    gap: Espacio.s,
  },
  textosDeCobro: { flex: 1, gap: 2, minHeight: TactilMinimo, justifyContent: 'center' },
  nombre: { fontSize: Letra.cuerpo, fontWeight: '600' },
  importeDeCobro: { fontSize: Letra.subtitulo },
  botonConfirmar: {
    minHeight: TactilMinimo,
    minWidth: TactilMinimo,
    paddingHorizontal: Espacio.m,
    borderRadius: Radio.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  objetivo: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TactilMinimo + Espacio.m,
    paddingVertical: Espacio.s + 2,
    gap: Espacio.m,
  },
  paso: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  flecha: {
    minWidth: TactilMinimo,
    minHeight: TactilMinimo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valorDePaso: { fontSize: Letra.cuerpo, minWidth: 64, textAlign: 'center' },
  campo: { gap: Espacio.xs, paddingTop: Espacio.m },
});
