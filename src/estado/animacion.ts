/**
 * Ajuste «Reducir movimiento» del sistema (docs/03, apartado 8).
 *
 * Los gráficos aparecen con una transición breve. Si la persona tiene activado
 * «Reducir movimiento», o mientras no se sabe si lo tiene, aparecen ya
 * colocados y sin transición.
 */
import { ES_WEB } from '@/lib/plataforma';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

/** `null` mientras no se ha consultado el ajuste. */
let reducir: boolean | null = null;
const oyentes = new Set<() => void>();

function fijar(valor: boolean) {
  reducir = valor;
  oyentes.forEach((avisar) => avisar());
}

let iniciado = false;

/** Consulta el ajuste y lo sigue. Se llama una vez al arrancar la app. */
export function seguirReducirMovimiento(): void {
  if (iniciado) return;
  iniciado = true;
  AccessibilityInfo.isReduceMotionEnabled().then(fijar, () => fijar(true));
  AccessibilityInfo.addEventListener('reduceMotionChanged', fijar);
}

/** Decide si se anima: solo cuando se sabe que «Reducir movimiento» está apagado. */
export function debeAnimar(ajuste: boolean | null): boolean {
  return ajuste === false;
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

export function useAnimar(): boolean {
  return debeAnimar(useSyncExternalStore(suscribir, () => reducir));
}

/**
 * Valor de 0 a 1 para la entrada de un gráfico. Con «Reducir movimiento» vale
 * 1 desde el principio. Se repite cuando cambia `clave` (por ejemplo, el mes).
 */
export function useEntrada(clave: string): Animated.Value {
  const animar = useAnimar();
  // Se guarda como estado y no como referencia: el valor se usa al pintar.
  const [valor] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!animar) {
      valor.setValue(1);
      return;
    }
    valor.setValue(0);
    const animacion = Animated.timing(valor, {
      toValue: 1,
      duration: 380,
      // En el navegador no hay motor nativo de animación; allí la mueve JavaScript.
      useNativeDriver: !ES_WEB,
    });
    animacion.start();
    return () => animacion.stop();
  }, [animar, clave, valor]);
  return valor;
}

/** Solo para pruebas: fija el ajuste sin pasar por el sistema. */
export function fijarReducirMovimientoParaPruebas(valor: boolean | null): void {
  reducir = valor;
  oyentes.forEach((avisar) => avisar());
}
