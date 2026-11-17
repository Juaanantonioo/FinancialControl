/**
 * Registro de avisos ya emitidos (B3). Sirve para no repetir un aviso que
 * solo debe darse una vez, como «has pasado del 80 % en Comida este mes».
 * Cada aviso se identifica por una clave de texto.
 */
import type { BaseDeDatos, Entorno } from './bd';

export function crearRepositorioDeAvisos(bd: BaseDeDatos, entorno: Entorno) {
  /** Claves de todos los avisos emitidos y no borrados. */
  async function clavesEmitidas(): Promise<string[]> {
    const filas = await bd.consultar<{ clave: string }>(
      'SELECT clave FROM aviso_emitido WHERE borrado_en IS NULL',
    );
    return filas.map((f) => f.clave);
  }

  /**
   * Anota que un aviso se ha emitido. Devuelve `true` si es la primera vez y
   * `false` si ya constaba: quien llama solo avisa cuando recibe `true`.
   */
  async function registrar(clave: string): Promise<boolean> {
    const existentes = await bd.consultar<{ id: string }>(
      'SELECT id FROM aviso_emitido WHERE clave = ? AND borrado_en IS NULL',
      [clave],
    );
    if (existentes.length > 0) return false;
    const ahora = entorno.ahora().toISOString();
    await bd.ejecutar(
      `INSERT INTO aviso_emitido (id, clave, emitido_en, creado_en, modificado_en, borrado_en)
       VALUES (?, ?, ?, ?, ?, NULL)`,
      [entorno.generarId(), clave, ahora, ahora, ahora],
    );
    return true;
  }

  return { clavesEmitidas, registrar };
}

export type RepositorioDeAvisos = ReturnType<typeof crearRepositorioDeAvisos>;
