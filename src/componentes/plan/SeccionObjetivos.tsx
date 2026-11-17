import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Boton } from '@/componentes/basicos';
import { FilaDeObjetivo } from '@/componentes/plan/Piezas';
import { EstadoVacio, Tarjeta } from '@/componentes/Tarjeta';
import { estadoDeObjetivo } from '@/dominio/objetivos';
import type { usePanel } from '@/estado/panel';
import { usePlan } from '@/estado/plan';
import { t } from '@/i18n';
import { Espacio } from '@/theme';

/** P15 · Objetivos: una tarjeta por objetivo con su avance y el ritmo necesario. */
export function SeccionObjetivos({ panel }: { panel: ReturnType<typeof usePanel> }) {
  const plan = usePlan();
  const [verArchivados, setVerArchivados] = useState(false);
  const delaDivisa = plan.objetivos.filter((o) => o.divisa === panel.divisa);
  const activos = delaDivisa.filter((o) => !o.archivado);
  const archivados = delaDivisa.filter((o) => o.archivado);
  const fila = (objetivo: (typeof delaDivisa)[number], i: number) => (
    <FilaDeObjetivo
      key={objetivo.id}
      objetivo={objetivo}
      estado={estadoDeObjetivo(objetivo, plan.aportaciones, panel.hoy)}
      separador={i > 0}
      alPulsar={() => router.push({ pathname: '/objetivo', params: { id: objetivo.id } })}
    />
  );

  return (
    <>
      {plan.cargado && activos.length === 0 ? (
        <Tarjeta testID="objetivos-vacio">
          <EstadoVacio
            texto={t('objetivos.vacio')}
            accion={{
              texto: t('objetivos.nuevo'),
              alPulsar: () => router.push('/objetivo-editar'),
              testID: 'crear-objetivo',
            }}
          />
        </Tarjeta>
      ) : null}
      {activos.length > 0 ? (
        <Tarjeta testID="lista-de-objetivos">{activos.map(fila)}</Tarjeta>
      ) : null}
      {archivados.length > 0 ? (
        <>
          <Boton
            texto={verArchivados ? t('objetivos.ocultarArchivados') : t('objetivos.verArchivados')}
            alPulsar={() => setVerArchivados(!verArchivados)}
            testID="ver-objetivos-archivados"
            estilo={estilos.enlace}
          />
          {verArchivados ? <Tarjeta>{archivados.map(fila)}</Tarjeta> : null}
        </>
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  enlace: { alignSelf: 'flex-start', paddingHorizontal: Espacio.xs },
});
