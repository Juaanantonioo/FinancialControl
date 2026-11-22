/** El fichero en claro se escribe en la carpeta temporal y se borra al cerrar la hoja, pase lo que pase. */
import { Platform, Share } from 'react-native';

import { compartirFichero } from '@/lib/compartirFichero';

const mockFicheros = new Map<string, string>();
const mockPasos: string[] = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///temporal' },
  File: class {
    uri: string;
    constructor(carpeta: string, nombre: string) {
      this.uri = `${carpeta}/${nombre}`;
    }
    get exists() {
      return mockFicheros.has(this.uri);
    }
    create(opciones: { overwrite?: boolean }) {
      mockPasos.push(`crear overwrite=${opciones.overwrite}`);
      mockFicheros.set(this.uri, '');
    }
    write(contenido: string) {
      mockPasos.push('escribir');
      mockFicheros.set(this.uri, contenido);
    }
    delete() {
      mockPasos.push('borrar');
      mockFicheros.delete(this.uri);
    }
  },
}));

const compartir = jest.spyOn(Share, 'share');

beforeEach(() => {
  mockFicheros.clear();
  mockPasos.length = 0;
  compartir.mockReset();
  Platform.OS = 'ios';
});

describe('compartir un fichero', () => {
  it('lo escribe en la carpeta temporal, abre la hoja con él y lo borra al terminar', async () => {
    let alCompartir: string | undefined;
    compartir.mockImplementation(async (contenido) => {
      alCompartir = mockFicheros.get((contenido as { url: string }).url);
      return { action: Share.sharedAction, activityType: undefined };
    });
    expect(await compartirFichero('datos.json', '{"a":1}')).toBe('compartido');
    expect(compartir).toHaveBeenCalledWith({ url: 'file:///temporal/datos.json' });
    // Cuando la hoja se abre, el fichero tiene el contenido; después ya no existe.
    expect(alCompartir).toBe('{"a":1}');
    expect(mockPasos).toEqual(['crear overwrite=true', 'escribir', 'borrar']);
    expect(mockFicheros.size).toBe(0);
  });

  it('si la persona cierra la hoja sin elegir nada, lo dice y borra el fichero igual', async () => {
    compartir.mockResolvedValue({ action: Share.dismissedAction, activityType: undefined });
    expect(await compartirFichero('datos.json', 'x')).toBe('descartado');
    expect(mockFicheros.size).toBe(0);
  });

  it('si la hoja falla, no lanza el error y no deja el fichero', async () => {
    compartir.mockRejectedValue(new Error('detalle interno'));
    expect(await compartirFichero('datos.json', 'x')).toBe('no_disponible');
    expect(mockFicheros.size).toBe(0);
  });

  it('fuera de iOS no escribe nada', async () => {
    Platform.OS = 'android';
    expect(await compartirFichero('datos.json', 'x')).toBe('no_disponible');
    expect(mockPasos).toEqual([]);
    expect(compartir).not.toHaveBeenCalled();
  });
});
