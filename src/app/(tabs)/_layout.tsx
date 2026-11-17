import { NativeTabs } from 'expo-router/native-tabs';

import { t } from '@/i18n';
import { useColores } from '@/theme';

/**
 * Barra de pestañas nativa del sistema, con una pregunta por pestaña:
 * Inicio (cómo voy y qué tengo que hacer hoy), Movimientos (en qué se ha ido
 * el dinero), Análisis (cómo gasto a lo largo del tiempo), Plan (qué puedo
 * gastar y qué viene) y Cuentas (cuánto tengo y dónde está).
 *
 * NativeTabs no admite un botón de acción dentro de la barra, así que añadir
 * un movimiento es un botón flotante (`BotonAnadir`) que cada pestaña pinta
 * en el mismo sitio, justo encima de la barra.
 */
export default function Pestanas() {
  const c = useColores();
  return (
    <NativeTabs tintColor={c.acento}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('pestanas.inicio')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="movimientos">
        <NativeTabs.Trigger.Label>{t('pestanas.movimientos')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="analisis">
        <NativeTabs.Trigger.Label>{t('pestanas.analisis')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Label>{t('pestanas.plan')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cuentas">
        <NativeTabs.Trigger.Label>{t('pestanas.cuentas')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="creditcard" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
