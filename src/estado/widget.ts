/**
 * Envío de datos al widget «Disponible este mes» (T-039).
 *
 * La app calcula el disponible con las mismas funciones que usa Inicio y le
 * manda al widget los textos ya escritos. El widget nunca calcula ni lee la
 * base de datos.
 */
import { useEffect, useRef } from 'react';

import type { Repositorios } from '@/datos';
import { disponibleDelMes, estadoDelPresupuesto } from '@/dominio/presupuesto';
import { fijosPendientes, pendientesDelMes } from '@/dominio/recurrentes';
import { fechaLocal } from '@/dominio/modelo';
import { useDatos } from '@/estado/Datos';
import { diaYMes } from '@/estado/fechas';
import { importe } from '@/estado/formato';
import { useSeguridad } from '@/estado/seguridad';
import { t } from '@/i18n';
import { COLORES, type Colores } from '@/theme';
import Disponible, { type ColoresDelWidget, type DatosDelWidget } from '@/widgets/Disponible';

function coloresPara(c: Colores): ColoresDelWidget {
  return {
    fondo: c.superficie,
    texto: c.texto,
    textoSecundario: c.textoSecundario,
    acento: c.acento,
    sobreAcento: c.sobreAcento,
    negativo: c.negativo,
  };
}

/**
 * Lo que el widget debe mostrar hoy. En modo privado, sin ninguna cifra. Usa la divisa principal (la de la
 * primera cuenta), igual que el bloque «Disponible este mes» de Inicio.
 */
export async function datosParaElWidget(
  repos: Repositorios,
  hoy: string,
  privado = false,
): Promise<DatosDelWidget> {
  const mes = hoy.slice(0, 7);
  const [cuentas, todos, categorias, reglas, presupuesto] = await Promise.all([
    repos.cuentas.listar({ incluirArchivadas: true }),
    repos.movimientos.listar(),
    repos.categorias.listar({ incluirArchivadas: true }),
    repos.reglas.listar(),
    repos.presupuestos.delMes(mes),
  ]);
  const divisa = cuentas[0]?.divisa ?? 'EUR';
  const movimientos = todos.filter((m) => m.divisa === divisa);
  const comunes = {
    titulo: t('inicio.disponibleDelMes'),
    fecha: diaYMes(hoy),
    boton: t('widget.anadirGasto'),
    urlDeAlta: 'financialcontrol://movimiento',
    urlDeInicio: 'financialcontrol://',
    claro: coloresPara(COLORES.claro),
    oscuro: coloresPara(COLORES.oscuro),
  };
  // Modo privado: la cifra no sale de la app. Al widget solo le llega «•••».
  if (privado) {
    return {
      ...comunes,
      cifra: t('widget.privadoCifra'),
      detalle: t('widget.privadoDetalle'),
      excedido: false,
    };
  }
  if (!presupuesto) {
    return { ...comunes, cifra: '', detalle: t('widget.sinPresupuesto'), excedido: false };
  }
  const estado = estadoDelPresupuesto(presupuesto.lineas, movimientos, categorias, mes, hoy);
  const pendientes = fijosPendientes(
    pendientesDelMes(
      reglas.filter((r) => r.divisa === divisa),
      movimientos,
      mes,
      hoy,
    ),
  );
  const d = disponibleDelMes(estado.presupuestado, estado.gastado, pendientes, mes, hoy);
  return {
    ...comunes,
    cifra: importe(Math.max(0, d.disponible), divisa),
    detalle:
      d.exceso > 0
        ? t('inicio.tePasas', { importe: importe(d.exceso, divisa) })
        : t('widget.alDia', { importe: importe(d.porDia, divisa) }),
    excedido: d.exceso > 0,
  };
}

/**
 * Manda el dato al widget al abrir la app y cada vez que cambian los datos.
 * Solo lo envía si ha cambiado. Se usa una sola vez, en la raíz de la app.
 */
export function useWidgetAlDia(): void {
  const { repos, version } = useDatos();
  const { privado } = useSeguridad();
  const enviado = useRef('');
  useEffect(() => {
    let vigente = true;
    datosParaElWidget(repos, fechaLocal(), privado).then(
      (datos) => {
        const firma = JSON.stringify(datos);
        if (!vigente || firma === enviado.current) return;
        enviado.current = firma;
        try {
          Disponible.updateSnapshot(datos);
        } catch {
          // Sin la extensión del widget (por ejemplo, en una compilación antigua) no pasa nada.
        }
      },
      () => undefined,
    );
    return () => {
      vigente = false;
    };
  }, [repos, version, privado]);
}
