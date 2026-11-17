import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BotonAnadir, Cabecera, Segmentos, useMargenDeLista } from '@/componentes/basicos';
import { SeccionFijos } from '@/componentes/plan/SeccionFijos';
import { SeccionObjetivos } from '@/componentes/plan/SeccionObjetivos';
import { SeccionPresupuesto } from '@/componentes/plan/SeccionPresupuesto';
import { esMesValido, mesDe } from '@/dominio/resumen';
import { usePanel } from '@/estado/panel';
import { t } from '@/i18n';
import { Espacio, useColores } from '@/theme';

type Seccion = 'presupuesto' | 'fijos' | 'objetivos';

/**
 * Plan: lo que se puede gastar y lo que viene. Tres secciones con un
 * selector: Presupuesto (P11), Fijos (P13) y Objetivos (P15).
 *
 * Un enlace puede abrir una sección y un mes concretos:
 * financialcontrol://plan?seccion=fijos&mes=2026-11
 */
export default function Plan() {
  const c = useColores();
  const margenDeLista = useMargenDeLista();
  const panel = usePanel();
  const [seccion, setSeccion] = useState<Seccion>('presupuesto');
  const [mes, setMes] = useState(mesDe());

  // La pestaña sigue montada entre visitas: lo pedido se aplica una vez por petición.
  const pedido = useLocalSearchParams<{ seccion?: string; mes?: string }>();
  const firma = `${pedido.seccion ?? ''}|${pedido.mes ?? ''}`;
  const [aplicada, setAplicada] = useState('|');
  if (firma !== aplicada) {
    setAplicada(firma);
    if (
      pedido.seccion === 'presupuesto' ||
      pedido.seccion === 'fijos' ||
      pedido.seccion === 'objetivos'
    ) {
      setSeccion(pedido.seccion);
    }
    if (pedido.mes && esMesValido(pedido.mes)) setMes(pedido.mes);
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      <Cabecera titulo={t('plan.titulo')}>
        {seccion === 'fijos' ? (
          <BotonAnadir etiqueta={t('fijos.nuevo')} alPulsar={() => router.push('/regla')} />
        ) : null}
        {seccion === 'objetivos' ? (
          <BotonAnadir
            etiqueta={t('objetivos.nuevo')}
            alPulsar={() => router.push('/objetivo-editar')}
          />
        ) : null}
      </Cabecera>
      <ScrollView
        contentContainerStyle={[estilos.contenido, { paddingBottom: margenDeLista }]}
        keyboardShouldPersistTaps="handled">
        <Segmentos
          opciones={[
            { valor: 'presupuesto', texto: t('plan.presupuesto') },
            { valor: 'fijos', texto: t('plan.fijos') },
            { valor: 'objetivos', texto: t('plan.objetivos') },
          ]}
          valor={seccion}
          alCambiar={setSeccion}
        />
        {seccion === 'presupuesto' ? (
          <SeccionPresupuesto panel={panel} mes={mes} alCambiarMes={setMes} />
        ) : null}
        {seccion === 'fijos' ? (
          <SeccionFijos panel={panel} mes={mes} alCambiarMes={setMes} />
        ) : null}
        {seccion === 'objetivos' ? <SeccionObjetivos panel={panel} /> : null}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { paddingHorizontal: Espacio.m, gap: Espacio.m },
});
