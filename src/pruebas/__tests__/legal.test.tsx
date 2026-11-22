/**
 * Páginas legales (B5): política de privacidad y condiciones de la beta. Son un
 * borrador hasta que el titular complete sus datos y las revise.
 */
import { render, screen } from '@testing-library/react-native';

import Condiciones from '@/app/condiciones';
import Privacidad from '@/app/privacidad';
import es from '@/i18n/es.json';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => false },
}));
jest.mock('@/lib/almacenDeApariencia', () => ({
  almacenDeApariencia: { leer: () => 'automatico', guardar: jest.fn() },
}));

const legal = es.legal as Record<string, string>;
const textos = Object.entries(legal).filter(([clave]) => /\d+(Titulo|Texto)$/.test(clave));
const todo = textos.map(([, texto]) => texto).join('\n');

describe('páginas legales', () => {
  it('las dos se pintan enteras, con el aviso de borrador arriba', async () => {
    for (const [Pagina, cual] of [
      [Privacidad, 'privacidad'],
      [Condiciones, 'condiciones'],
    ] as const) {
      const pantalla = await render(<Pagina />);
      expect(screen.getByTestId('aviso-de-borrador')).toHaveTextContent(
        /BORRADOR pendiente de revisión del titular/,
      );
      const secciones = Number(legal[`${cual}Secciones`]);
      expect(secciones).toBeGreaterThanOrEqual(10);
      for (let n = 1; n <= secciones; n += 1) {
        expect(screen.getByText(legal[`${cual}${n}Titulo`])).toBeTruthy();
      }
      // No falta ni sobra ninguna sección respecto al catálogo.
      expect(legal[`${cual}${secciones + 1}Titulo`]).toBeUndefined();
      pantalla.unmount();
    }
  });

  it('mientras queden datos del titular por completar, el aviso de borrador no se puede quitar', () => {
    const pendientes = todo.match(/\[[^\]]+\]/g) ?? [];
    if (pendientes.length > 0) {
      expect(legal.borrador).toMatch(/BORRADOR pendiente de revisión del titular/);
    }
    // Hoy quedan: nadie ha inventado los datos del responsable.
    expect(pendientes.length).toBeGreaterThan(8);
    expect(todo).toMatch(/\[NOMBRE Y APELLIDOS O RAZÓN SOCIAL DEL TITULAR\]/);
    expect(todo).toMatch(/\[CORREO DE CONTACTO\]/);
    // Ningún dato de persona o empresa con pinta de real fuera de los corchetes.
    const sinCorchetes = todo.replace(/\[[^\]]+\]/g, '');
    expect(sinCorchetes).not.toMatch(
      /@[a-z0-9-]+\.[a-z]{2,}|\b\d{8}[A-Z]\b|\bS\.?L\.?\b|calle|C\//i,
    );
  });

  it('dicen lo que la app hace de verdad', () => {
    // Cifrado en el dispositivo y lo que el servidor sí ve.
    expect(todo).toMatch(/se cifran en tu dispositivo antes de salir/);
    expect(todo).toMatch(/cuántos apuntes tienes, de qué clase es cada uno/);
    expect(todo).toMatch(/No podemos leer tus datos financieros/);
    // El límite de la web, sin esconderlo.
    expect(todo).toMatch(/Confías en que el sitio entrega el programa correcto/);
    // Qué se guarda en el navegador, y que no hay cookies ni analítica.
    expect(todo).toMatch(/Solo dos cosas: tu correo.*y la apariencia/);
    expect(todo).toMatch(/No usamos cookies\. No hay analítica/);
    // Exportación y borrado, donde están de verdad.
    expect(todo).toMatch(/Ajustes › Exportar mis datos/);
    expect(todo).toMatch(/Ajustes › Cuenta › Borrar cuenta/);
    // Beta gratuita sin garantías, y sin recuperación.
    expect(todo).toMatch(/gratis y tal cual, sin garantías/);
    expect(todo).toMatch(/nadie puede restablecerla/);
    expect(todo).toMatch(/todavía no está disponible/);
    // Nada que la app no haga.
    expect(todo).not.toMatch(/publicidad personalizada|vendemos tus datos|Google Analytics/i);
  });

  it('el aviso de la entrada dice que hoy no hay recuperación y que es una beta', () => {
    expect(es.web.sinRecuperacionTitulo).toMatch(/hoy no se puede recuperar la cuenta/);
    expect(es.web.betaTexto).toMatch(/versión de prueba/);
    expect(es.web.alCrearAceptas).toMatch(
      /condiciones de uso de la beta y la política de privacidad/,
    );
  });
});
