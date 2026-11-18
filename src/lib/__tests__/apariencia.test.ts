/**
 * Lectura y escritura de la apariencia elegida, con el almacén de clave y
 * valor sustituido por uno en memoria.
 */
import { almacenDeApariencia } from '@/lib/almacenDeApariencia';
import {
  APARIENCIA_POR_DEFECTO,
  APARIENCIAS,
  CLAVE_DE_APARIENCIA,
  interpretarApariencia,
} from '@/lib/apariencia';

const mockGuardado = new Map<string, string>();
const mockFallo = { alLeer: false };
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (clave: string) => {
      if (mockFallo.alLeer) throw new Error('almacén no disponible');
      return mockGuardado.get(clave) ?? null;
    },
    setItemAsync: async (clave: string, valor: string) => {
      mockGuardado.set(clave, valor);
    },
  },
}));

beforeEach(() => {
  mockGuardado.clear();
  mockFallo.alLeer = false;
});

describe('interpretarApariencia', () => {
  it('acepta las tres opciones tal cual', () => {
    expect(APARIENCIAS).toEqual(['automatico', 'claro', 'oscuro']);
    for (const apariencia of APARIENCIAS)
      expect(interpretarApariencia(apariencia)).toBe(apariencia);
  });

  it.each([
    ['nada guardado', null],
    ['indefinido', undefined],
    ['texto vacío', ''],
    ['un valor desconocido', 'sepia'],
    ['el nombre del sistema en lugar del propio', 'dark'],
    ['mayúsculas', 'Oscuro'],
    ['espacios', ' oscuro '],
    ['JSON de otra preferencia', '{"cobros":true}'],
    ['texto estropeado', '{"apariencia":'],
    ['un número', 2],
    ['un objeto', { apariencia: 'oscuro' }],
  ])('%s se trata como «automático»', (_, guardado) => {
    expect(interpretarApariencia(guardado)).toBe('automatico');
  });

  it('el valor por defecto es «automático»', () => {
    expect(APARIENCIA_POR_DEFECTO).toBe('automatico');
  });
});

describe('almacén de la apariencia', () => {
  it('sin nada guardado devuelve «automático»', () => {
    expect(almacenDeApariencia.leer()).toBe('automatico');
  });

  it('lo guardado se lee igual, opción por opción', async () => {
    for (const apariencia of APARIENCIAS) {
      await almacenDeApariencia.guardar(apariencia);
      expect(mockGuardado.get(CLAVE_DE_APARIENCIA)).toBe(apariencia);
      expect(almacenDeApariencia.leer()).toBe(apariencia);
    }
  });

  it('usa su propia clave y no pisa la de los avisos', async () => {
    mockGuardado.set('avisos', '{"cobros":true}');
    await almacenDeApariencia.guardar('oscuro');
    expect(mockGuardado.get('avisos')).toBe('{"cobros":true}');
    expect(CLAVE_DE_APARIENCIA).not.toBe('avisos');
  });

  it('un valor corrupto o desconocido se lee como «automático» y no falla', () => {
    for (const estropeado of ['', 'sepia', '{"a":', 'null', '0']) {
      mockGuardado.set(CLAVE_DE_APARIENCIA, estropeado);
      expect(almacenDeApariencia.leer()).toBe('automatico');
    }
  });

  it('si el almacén falla al leer, la app sigue al sistema en lugar de romperse', () => {
    mockGuardado.set(CLAVE_DE_APARIENCIA, 'oscuro');
    mockFallo.alLeer = true;
    expect(() => almacenDeApariencia.leer()).not.toThrow();
    expect(almacenDeApariencia.leer()).toBe('automatico');
  });
});
