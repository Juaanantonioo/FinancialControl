/**
 * El catálogo de tablas sincronizadas tiene que coincidir con el esquema
 * local de verdad y con lo que admite el servidor. Si una migración cambia el
 * esquema y el catálogo no, estas pruebas fallan.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { prepararPrueba } from '@/pruebas/bdDePrueba';
import { ordenDeTabla, TABLAS, TABLAS_SOLO_LOCALES } from '@/sincronizacion/tablas';

const RAIZ = join(__dirname, '..', '..', '..');

describe('catálogo de tablas sincronizadas', () => {
  it('cubre todas las tablas de datos del esquema local, y ninguna más', async () => {
    const { bd } = await prepararPrueba();
    const tablas = await bd.consultar<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );
    const deDatos = tablas.map((t) => t.name).filter((nombre) => !nombre.startsWith('sinc_'));
    expect(deDatos.sort()).toEqual([...TABLAS.map((t) => t.nombre), ...TABLAS_SOLO_LOCALES].sort());
  });

  it('lista las mismas columnas que tiene cada tabla, en su orden', async () => {
    const { bd } = await prepararPrueba();
    for (const tabla of TABLAS) {
      const columnas = await bd.consultar<{ name: string }>(`PRAGMA table_info(${tabla.nombre})`);
      expect(columnas.map((c) => c.name)).toEqual(tabla.columnas);
    }
  });

  it('conoce todos los índices únicos, y todos valen solo entre filas no borradas', async () => {
    const { bd } = await prepararPrueba();
    for (const tabla of TABLAS) {
      const indices = await bd.consultar<{ name: string; unique: number; origin: string }>(
        `PRAGMA index_list(${tabla.nombre})`,
      );
      const unicos: string[][] = [];
      for (const indice of indices.filter((i) => i.unique === 1 && i.origin === 'c')) {
        const columnas = await bd.consultar<{ name: string }>(`PRAGMA index_info(${indice.name})`);
        unicos.push(columnas.map((c) => c.name));
        const [{ sql }] = await bd.consultar<{ sql: string }>(
          'SELECT sql FROM sqlite_master WHERE name = ?',
          [indice.name],
        );
        // La regla «se borra la de id mayor» solo libera el índice si este ignora las borradas.
        expect(sql).toMatch(/borrado_en IS NULL/);
      }
      expect(unicos.sort()).toEqual([...tabla.unicos].map((u) => [...u]).sort());
    }
  });

  it('pone cada tabla después de aquellas a las que apunta', async () => {
    const { bd } = await prepararPrueba();
    for (const tabla of TABLAS) {
      const ajenas = await bd.consultar<{ table: string }>(
        `PRAGMA foreign_key_list(${tabla.nombre})`,
      );
      for (const ajena of ajenas) {
        expect(ordenDeTabla(ajena.table)).toBeLessThanOrEqual(ordenDeTabla(tabla.nombre));
      }
    }
  });

  it('coincide con las tablas que admite el servidor en fila_cifrada', () => {
    const carpeta = join(RAIZ, 'supabase', 'migrations');
    const sql = readdirSync(carpeta)
      .map((fichero) => readFileSync(join(carpeta, fichero), 'utf8'))
      .join('\n');
    const lista = /tabla text not null check \(tabla in \(([^)]+)\)\)/.exec(sql)?.[1] ?? '';
    const admitidas = [...lista.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(admitidas.sort()).toEqual(TABLAS.map((t) => t.nombre).sort());
  });

  it('todas tienen id y las tres columnas comunes', () => {
    for (const tabla of TABLAS) {
      expect(tabla.columnas[0]).toBe('id');
      expect(tabla.columnas.slice(-3)).toEqual(['creado_en', 'modificado_en', 'borrado_en']);
    }
  });
});

describe('los repositorios no borran filas', () => {
  it('ningún fichero de src/datos usa DELETE: los borrados son lógicos', () => {
    const carpeta = join(RAIZ, 'src', 'datos');
    for (const fichero of readdirSync(carpeta).filter((f) => f.endsWith('.ts'))) {
      if (fichero === 'migraciones.ts') continue;
      expect(readFileSync(join(carpeta, fichero), 'utf8')).not.toMatch(/DELETE\s+FROM/i);
    }
  });
});
