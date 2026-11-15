import { NativeTabs } from 'expo-router/native-tabs';

import { t } from '@/i18n';

/** Barra de pestañas nativa del sistema: Movimientos (P06) y Cuentas (P09). */
export default function Pestanas() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('pestanas.movimientos')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cuentas">
        <NativeTabs.Trigger.Label>{t('pestanas.cuentas')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="creditcard" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
