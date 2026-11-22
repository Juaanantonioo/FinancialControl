import { migrar, MIGRACIONES, versionDelEsquema, type Migracion } from '@/datos/migraciones';
import { crearBdDePrueba } from '@/pruebas/bdDePrueba';

describe('migraciones', () => {
  it('lleva una base de datos vacía a la última versión', async () => {
    const bd = crearBdDePrueba();
    expect(await versionDelEsquema(bd)).toBe(0);
    const resultado = await migrar(bd);
    const ultima = Math.max(...MIGRACIONES.map((m) => m.version));
    expect(resultado).toEqual({ desde: 0, hasta: ultima });
    expect(await versionDelEsquema(bd)).toBe(ultima);
    const tablas = await bd.consultar<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tablas.map((t) => t.name)).toEqual([
      'alias_de_tarjeta',
      'aportacion_a_objetivo',
      'aviso_emitido',
      'captura',
      'categoria',
      'cuenta',
      'linea_de_presupuesto',
      'movimiento',
      'objetivo',
      'presupuesto',
      'regla_de_comercio',
      'regla_recurrente',
      // Estado de la sincronización (migración 5).
      'sinc_estado',
      'sinc_pendiente',
      'sinc_remota',
      'sinc_retenida',
      // La crea SQLite para el contador de `sinc_pendiente`.
      'sqlite_sequence',
      'valor_de_inversion',
    ]);
  });

  it('migrar dos veces no repite nada', async () => {
    const bd = crearBdDePrueba();
    await migrar(bd);
    const segunda = await migrar(bd);
    expect(segunda.desde).toBe(segunda.hasta);
  });

  it('aplica solo las migraciones que faltan y en orden', async () => {
    const bd = crearBdDePrueba();
    const lista: Migracion[] = [
      { version: 2, sentencias: ['ALTER TABLE cosa ADD COLUMN extra TEXT'] },
      { version: 1, sentencias: ['CREATE TABLE cosa (id TEXT)'] },
    ];
    await migrar(bd, [lista[1]]);
    expect(await migrar(bd, lista)).toEqual({ desde: 1, hasta: 2 });
    await bd.ejecutar("INSERT INTO cosa (id, extra) VALUES ('a', 'b')");
  });

  it('si una migración falla se deshace entera y la versión no avanza', async () => {
    const bd = crearBdDePrueba();
    const rota: Migracion[] = [
      { version: 1, sentencias: ['CREATE TABLE buena (id TEXT)', 'ESTO NO ES SQL'] },
    ];
    await expect(migrar(bd, rota)).rejects.toThrow();
    expect(await versionDelEsquema(bd)).toBe(0);
    const tablas = await bd.consultar("SELECT name FROM sqlite_master WHERE name = 'buena'");
    expect(tablas).toHaveLength(0);
  });
});
