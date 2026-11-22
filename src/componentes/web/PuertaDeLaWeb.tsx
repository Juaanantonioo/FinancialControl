import type { ReactNode } from 'react';

/**
 * En iOS no hay puerta: la app se usa con cuenta o sin ella. La versión web
 * (`PuertaDeLaWeb.web.tsx`) sí la tiene: allí la cuenta es obligatoria.
 */
export function PuertaDeLaWeb({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
