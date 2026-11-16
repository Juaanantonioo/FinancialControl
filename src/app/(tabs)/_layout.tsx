import { NativeTabs } from 'expo-router/native-tabs';

import { t } from '@/i18n';
import { useColores } from '@/theme';

/**
 * Barra de pestañas nativa del sistema: Inicio (P05), Movimientos (P06) y
 * Cuentas (P09). La app abre en Inicio. La pestaña Plan y el botón central
 * de docs/03 llegan con los hitos que les dan contenido.
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
      <NativeTabs.Trigger name="cuentas">
        <NativeTabs.Trigger.Label>{t('pestanas.cuentas')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="creditcard" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
