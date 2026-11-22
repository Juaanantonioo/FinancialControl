/**
 * Diseño adaptable y teclado. Anchos de 360, 768 y 1280 px, en claro y en
 * oscuro: nada se sale de la pantalla ni se pisa. Deja las capturas en
 * docs/capturas/b5/.
 */
import { expect, test, type Page } from '@playwright/test';

import { sembrarTodo, type Dispositivo } from '@/pruebas/sincronizacionDePrueba';

import {
  altaEnNode,
  CONTRASENA,
  correoDePrueba,
  dispositivoDeNode,
  entrarEnWeb,
  esperarDentro,
} from './apoyo';

const ANCHOS = [360, 768, 1280] as const;
const TEMAS = ['claro', 'oscuro'] as const;
let correo = '';

test.beforeAll(async () => {
  // Una cuenta con datos en todas las secciones, creada fuera del navegador.
  correo = correoDePrueba('diseno');
  const nativo = await dispositivoDeNode();
  await altaEnNode(nativo, correo);
  await sembrarTodo(nativo as unknown as Dispositivo);
  await nativo.motor.subirLoLocal();
  await nativo.motor.ciclo();
});

/** Lo que se sale por los lados o se pisa en la pantalla que se está viendo. */
function problemasDeDiseno(pagina: Page) {
  return pagina.evaluate(() => {
    const ancho = window.innerWidth;
    const problemas: string[] = [];
    const raiz = document.scrollingElement!;
    if (raiz.scrollWidth > ancho + 1) problemas.push(`la página mide ${raiz.scrollWidth} de ancho`);
    const visibles = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-testid], [role="button"], [role="link"], input',
      ),
    ].filter((e) => {
      const caja = e.getBoundingClientRect();
      return caja.width > 0 && caja.height > 0 && e.checkVisibility();
    });
    /** Dentro de una lista que se desplaza de lado (las categorías): salirse es lo normal. */
    const enListaLateral = (e: HTMLElement) => {
      for (let n = e.parentElement; n; n = n.parentElement) {
        if (/auto|scroll/.test(getComputedStyle(n).overflowX)) return true;
      }
      return false;
    };
    for (const elemento of visibles) {
      if (enListaLateral(elemento)) continue;
      const caja = elemento.getBoundingClientRect();
      const nombre =
        elemento.dataset.testid ?? elemento.textContent?.slice(0, 30) ?? elemento.tagName;
      if (caja.left < -1 || caja.right > ancho + 1) {
        problemas.push(`«${nombre}» se sale: ${Math.round(caja.left)}–${Math.round(caja.right)}`);
      }
    }
    // Los enlaces de la navegación no se pisan entre sí ni cortan su texto.
    const enlaces = [...document.querySelectorAll<HTMLElement>('[data-testid^="pestana-"]')];
    for (const [i, a] of enlaces.entries()) {
      const ca = a.getBoundingClientRect();
      const texto = a.querySelector<HTMLElement>('div[dir]');
      if (texto && texto.scrollWidth > texto.clientWidth + 1) {
        problemas.push(`el texto de «${a.dataset.testid}» no cabe`);
      }
      for (const b of enlaces.slice(i + 1)) {
        const cb = b.getBoundingClientRect();
        const pisa =
          ca.left < cb.right - 1 &&
          cb.left < ca.right - 1 &&
          ca.top < cb.bottom - 1 &&
          cb.top < ca.bottom - 1;
        if (pisa) problemas.push(`«${a.dataset.testid}» pisa a «${b.dataset.testid}»`);
      }
    }
    // El botón de añadir no tapa la navegación.
    const boton = [...document.querySelectorAll<HTMLElement>('[data-testid="boton-anadir"]')].find(
      (e) => e.checkVisibility(),
    );
    if (boton) {
      const cb = boton.getBoundingClientRect();
      for (const a of enlaces) {
        const ca = a.getBoundingClientRect();
        if (ca.left < cb.right && cb.left < ca.right && ca.top < cb.bottom && cb.top < ca.bottom) {
          problemas.push(`el botón de añadir tapa «${a.dataset.testid}»`);
        }
      }
    }
    return problemas;
  });
}

for (const ancho of ANCHOS) {
  for (const tema of TEMAS) {
    test(`${ancho} px, ${tema}: nada cortado ni solapado`, async ({ browser }) => {
      const contexto = await browser.newContext({
        viewport: { width: ancho, height: ancho === 360 ? 740 : 900 },
        colorScheme: tema === 'oscuro' ? 'dark' : 'light',
        locale: 'es-ES',
        timezoneId: 'Europe/Madrid',
      });
      const page = await contexto.newPage();
      const captura = (nombre: string) =>
        page.screenshot({ path: `docs/capturas/b5/${nombre}-${ancho}-${tema}.png` });
      const revisar = async (nombre: string) => {
        await page.waitForTimeout(500);
        expect(await problemasDeDiseno(page), `${nombre} a ${ancho} px`).toEqual([]);
        await captura(nombre);
      };

      await page.goto('/');
      await page.getByTestId('correo').waitFor();
      await revisar('01-entrada');

      await entrarEnWeb(page, correo, CONTRASENA, { yaEnLaPagina: true });
      await esperarDentro(page);
      // El tema se aplica: fondo oscuro en oscuro, claro en claro.
      const fondo = await page.evaluate(() => {
        // El primer fondo opaco bajando desde la raíz.
        const cola: Element[] = [document.querySelector('#root')!];
        while (cola.length > 0) {
          const e = cola.shift()!;
          const color = getComputedStyle(e)
            .backgroundColor.match(/[\d.]+/g)!
            .map(Number);
          if (color.length === 3 || color[3] > 0.9) return (color[0] + color[1] + color[2]) / 3;
          cola.push(...e.children);
        }
        return -1;
      });
      if (tema === 'oscuro') expect(fondo).toBeLessThan(80);
      else expect(fondo).toBeGreaterThan(180);

      // Barra lateral desde 900 px; barra inferior por debajo.
      const inicio = (await page.getByTestId('pestana-index').boundingBox())!;
      const cuentas = (await page.getByTestId('pestana-cuentas').boundingBox())!;
      if (ancho >= 900) {
        expect(inicio.x).toBeLessThan(300);
        expect(cuentas.y).toBeGreaterThan(inicio.y);
      } else {
        expect(cuentas.x).toBeGreaterThan(inicio.x);
        expect(Math.abs(cuentas.y - inicio.y)).toBeLessThan(2);
        expect(inicio.y).toBeGreaterThan(600);
      }

      for (const [pestana, nombre] of [
        ['index', '02-inicio'],
        ['movimientos', '03-movimientos'],
        ['analisis', '04-analisis'],
        ['plan', '05-plan'],
        ['cuentas', '06-cuentas'],
      ] as const) {
        await page.getByTestId(`pestana-${pestana}`).click();
        await revisar(nombre);
      }
      await page.locator('[data-testid="boton-anadir"]:visible').first().click();
      await page.getByTestId('importe').waitFor();
      await revisar('07-movimiento');
      await page.getByTestId('cancelar').click();
      await page.getByTestId('pestana-index').click();
      await page.getByTestId('boton-ajustes').click();
      await page.getByTestId('abrir-cuenta').waitFor();
      await revisar('08-ajustes');
      // Lo que es solo del iPhone no se ofrece en la web.
      for (const oculto of ['abrir-seguridad', 'ajuste-apple-pay', 'ajuste-avisos']) {
        await expect(page.getByTestId(oculto)).toHaveCount(0);
      }
      await page.getByTestId('abrir-cuenta').click();
      await page.getByTestId('cuenta-sincronizacion').waitFor();
      await revisar('09-cuenta');
      await contexto.close();
    });
  }
}

test('lo que es solo del iPhone: sus direcciones explican que no está en la web', async ({
  page,
}) => {
  await entrarEnWeb(page, correo);
  await esperarDentro(page);
  await page.getByTestId('pestana-movimientos').click();
  await expect(page.getByTestId('abrir-bandeja')).toHaveCount(0);
  for (const ruta of ['/apple-pay', '/avisos', '/seguridad', '/capturas']) {
    // Se navega sin recargar, como haría un enlace: recargar cerraría la sesión.
    await page.evaluate((destino) => {
      window.history.pushState({}, '', destino);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, ruta);
    await expect(page.getByTestId('solo-en-el-iphone').last()).toBeVisible();
  }
});

test('navegación completa solo con el teclado, con el foco siempre visible', async ({ page }) => {
  /** El elemento con el foco: su identificador y si se ve el anillo de foco. */
  const foco = () =>
    page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      const cercano = e?.closest<HTMLElement>('[data-testid]');
      const estilo = e ? getComputedStyle(e) : null;
      return {
        id: e?.dataset.testid ?? cercano?.dataset.testid ?? e?.tagName ?? '',
        anillo: !!estilo && estilo.outlineStyle !== 'none' && parseFloat(estilo.outlineWidth) >= 2,
      };
    });
  /** Pulsa Tab hasta llegar a un elemento. Falla si algún foco intermedio no se ve. */
  async function tabHasta(id: string, maximo = 120) {
    for (let i = 0; i < maximo; i += 1) {
      await page.keyboard.press('Tab');
      const actual = await foco();
      // Al dar la vuelta, el foco pasa un instante por la propia página: no es un control.
      if (actual.id === 'BODY' || actual.id === 'HTML') continue;
      expect(actual.anillo, `el foco en «${actual.id}» no se ve`).toBe(true);
      if (actual.id === id) return;
    }
    throw new Error(`No se llega a «${id}» con el tabulador.`);
  }

  await page.goto('/');
  await page.getByTestId('correo').waitFor();
  // Entrar sin tocar el ratón.
  await tabHasta('cambiar-de-modo');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await tabHasta('correo');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(correo);
  await tabHasta('contrasena');
  await page.keyboard.type(CONTRASENA);
  await tabHasta('enviar');
  await page.keyboard.press('Enter');
  await esperarDentro(page);

  // Las cinco secciones, con Tab y Enter.
  for (const pestana of ['movimientos', 'analisis', 'plan', 'cuentas', 'index']) {
    await tabHasta(`pestana-${pestana}`);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId(`pestana-${pestana}`)).toHaveAttribute('aria-current', 'page');
  }
  // Anotar un gasto entero con el teclado: abrir, importe, nombre y guardar.
  await tabHasta('boton-anadir');
  await page.keyboard.press('Enter');
  await page.getByTestId('importe').waitFor();
  await tabHasta('tecla-8');
  await page.keyboard.press('Enter');
  await tabHasta('nombre');
  await page.keyboard.type('Con el teclado');
  await tabHasta('guardar');
  await page.keyboard.press('Enter');
  await page.getByTestId('importe').waitFor({ state: 'detached' });
  await tabHasta('pestana-movimientos');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Con el teclado')).toBeVisible();
  // Y llegar a Ajustes y cerrar sesión.
  await tabHasta('pestana-index');
  await page.keyboard.press('Enter');
  await tabHasta('boton-ajustes');
  await page.keyboard.press('Enter');
  await tabHasta('abrir-cuenta');
  await page.keyboard.press('Enter');
  await tabHasta('cerrar-sesion');
});
