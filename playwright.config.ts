import { defineConfig } from '@playwright/test';

/**
 * Pruebas de la versión web en un navegador real (Chromium), sobre el sitio
 * EXPORTADO y servido con sus cabeceras definitivas, contra la instancia local
 * de Supabase. Se lanzan con `npm run test:web`, que exporta el sitio antes.
 */
export default defineConfig({
  testDir: './web/pruebas',
  // Una a una: comparten la instancia local y miden tiempos.
  workers: 1,
  fullyParallel: false,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    viewport: { width: 400, height: 860 },
    // Las pruebas no deben depender de nada de fuera de esta máquina.
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'node scripts/servir-web.cjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
