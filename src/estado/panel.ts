/**
 * Datos que comparten Inicio, Patrimonio, Inversiones y Análisis: todas las
 * cuentas, movimientos, valores de inversión y categorías. Las pantallas se
 * los pasan a las funciones de `src/dominio`, que son las que calculan.
 */
import { useState } from 'react';

import { fechaLocal } from '@/dominio/modelo';
import { deDivisa, divisasDe } from '@/dominio/resumen';
import { useConsulta } from '@/estado/Datos';

export function usePanel() {
  const todasLasCuentas = useConsulta((r) => r.cuentas.listar({ incluirArchivadas: true }));
  const todosLosMovimientos = useConsulta((r) => r.movimientos.listar());
  const valores = useConsulta((r) => r.valores.listar());
  const categorias = useConsulta((r) => r.categorias.listar({ incluirArchivadas: true }));
  const [divisaElegida, setDivisaElegida] = useState<string | null>(null);

  const cargado =
    todasLasCuentas !== undefined &&
    todosLosMovimientos !== undefined &&
    valores !== undefined &&
    categorias !== undefined;

  // No se suman importes de divisas distintas: se ve una divisa cada vez.
  const divisas = divisasDe(todasLasCuentas ?? []);
  const divisa =
    divisaElegida && divisas.includes(divisaElegida) ? divisaElegida : (divisas[0] ?? 'EUR');

  return {
    cargado,
    hoy: fechaLocal(),
    divisa,
    divisas,
    elegirDivisa: setDivisaElegida,
    sinCuentas: cargado && todasLasCuentas.length === 0,
    cuentas: (todasLasCuentas ?? []).filter((x) => x.divisa === divisa),
    movimientos: deDivisa(todosLosMovimientos ?? [], divisa),
    valores: valores ?? [],
    categorias: categorias ?? [],
  };
}
