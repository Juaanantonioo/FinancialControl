/** Límites de los textos libres (B5, D-c): para que toda fila quepa cifrada en el servidor. */
import { randomUUID } from 'node:crypto';

import { generarClaveDeDatos } from '@/cripto';
import { LIMITE_DE_TEXTO, exigirLongitud, superaElLimite } from '@/dominio/textos';
import { esperarError, prepararPrueba } from '@/pruebas/bdDePrueba';
import { cifrarFila } from '@/sincronizacion/filas';
import { TABLAS, type FilaLocal } from '@/sincronizacion/tablas';

/** Lo que admite `fila_cifrada.contenido` en el servidor. */
const MAXIMO_DEL_SERVIDOR = 65_536;
const largo = (n: number) => 'x'.repeat(n);

async function conCuenta() {
  const d = await prepararPrueba([{ nombre: 'Comida', tipo: 'gasto' }]);
  const banco = await d.cuentas.crear({
    nombre: 'Banco',
    tipo: 'banco',
    saldoInicial: 0,
    fechaSaldoInicial: '2026-01-01',
  });
  const [comida] = await d.categorias.listar();
  const gasto = (extra: Record<string, unknown> = {}) => ({
    tipo: 'gasto' as const,
    fecha: '2026-11-21',
    importe: 100,
    cuentaId: banco.id,
    categoriaId: comida.id,
    nombre: 'Compra',
    ...extra,
  });
  return { ...d, banco, comida, gasto };
}

describe('límite de cada texto', () => {
  it('se cuenta en caracteres como los cuenta maxLength, y lo que ya estaba guardado se respeta', () => {
    expect(superaElLimite(largo(200), 'nombre')).toBe(false);
    expect(superaElLimite(largo(201), 'nombre')).toBe(true);
    expect(superaElLimite(null, 'nota')).toBe(false);
    expect(() => exigirLongitud(largo(2000), 'nota')).not.toThrow();
    expect(() => exigirLongitud(largo(2001), 'nota')).toThrow();
    // El mismo texto que ya estaba: se acepta. Otro texto largo: no.
    expect(() => exigirLongitud(largo(2001), 'nota', largo(2001))).not.toThrow();
    expect(() => exigirLongitud(largo(2002), 'nota', largo(2001))).toThrow();
    expect(() => exigirLongitud(largo(2001), 'nota', null)).toThrow();
  });

  it('los límites de las pantallas quedan por debajo: quien usa la app no nota nada', () => {
    // Nombres: 40 a 80 caracteres en los formularios. Capturas: 200.
    expect(LIMITE_DE_TEXTO.nombre).toBeGreaterThanOrEqual(200);
    expect(LIMITE_DE_TEXTO.comercio).toBeGreaterThanOrEqual(200);
  });
});

describe('los repositorios rechazan textos demasiado largos', () => {
  it('movimiento: nombre, comercio y nota', async () => {
    const d = await conCuenta();
    await esperarError(
      d.movimientos.crear(d.gasto({ nombre: largo(201) })),
      'texto_demasiado_largo',
    );
    await esperarError(
      d.movimientos.crear(d.gasto({ comercio: largo(201) })),
      'texto_demasiado_largo',
    );
    await esperarError(
      d.movimientos.crear(d.gasto({ nota: largo(2001) })),
      'texto_demasiado_largo',
    );
    const justo = await d.movimientos.crear(
      d.gasto({ nombre: largo(200), comercio: largo(200), nota: largo(2000) }),
    );
    expect(justo.nota).toHaveLength(2000);
    // La nota de 70.000 caracteres que en el 4b-2 no cabía en el servidor ya no se puede crear.
    await esperarError(
      d.movimientos.crear(d.gasto({ nota: largo(70_000) })),
      'texto_demasiado_largo',
    );
  });

  it('cuenta, categoría, objetivo, regla, aportación, presupuesto, alias y regla de comercio', async () => {
    const d = await conCuenta();
    const cuenta = { tipo: 'banco' as const, saldoInicial: 0, fechaSaldoInicial: '2026-01-01' };
    await esperarError(d.cuentas.crear({ ...cuenta, nombre: largo(201) }), 'texto_demasiado_largo');
    await esperarError(
      d.cuentas.modificar(d.banco.id, { ...cuenta, nombre: largo(201) }),
      'texto_demasiado_largo',
    );
    await esperarError(
      d.categorias.crear({ nombre: largo(201), tipo: 'gasto' }),
      'texto_demasiado_largo',
    );
    await esperarError(d.categorias.renombrar(d.comida.id, largo(201)), 'texto_demasiado_largo');
    await esperarError(
      d.objetivos.crear({ nombre: largo(201), tipo: 'ahorro', meta: 1000 }),
      'texto_demasiado_largo',
    );
    const viaje = await d.objetivos.crear({ nombre: 'Viaje', tipo: 'ahorro', meta: 1000 });
    await esperarError(
      d.objetivos.aportar({
        objetivoId: viaje.id,
        fecha: '2026-11-03',
        importe: 5,
        nota: largo(2001),
      }),
      'texto_demasiado_largo',
    );
    await esperarError(
      d.reglas.crear({
        nombre: largo(201),
        clase: 'fijo',
        importe: 5000,
        cuentaId: d.banco.id,
        categoriaId: d.comida.id,
        periodicidad: 'mensual',
        diaDelMes: 20,
        fechaInicio: '2026-11-01',
      }),
      'texto_demasiado_largo',
    );
    await esperarError(
      d.presupuestos.guardar('2026-11', [{ categoriaId: d.comida.id, importe: 1 }], largo(2001)),
      'texto_demasiado_largo',
    );
    await esperarError(d.capturas.fijarAlias(largo(201), d.banco.id), 'texto_demasiado_largo');
    await esperarError(
      d.capturas.recordarComercio(largo(201), d.comida.id),
      'texto_demasiado_largo',
    );
  });
});

describe('un texto largo que ya estaba guardado', () => {
  it('no se trunca, deja guardar otros cambios, y solo se rechaza si se cambia por otro largo', async () => {
    const d = await conCuenta();
    const mov = await d.movimientos.crear(d.gasto());
    // Llegó antes de existir el límite (o desde otra versión de la app).
    await d.bd.ejecutar('UPDATE movimiento SET nota = ?, nombre = ? WHERE id = ?', [
      largo(5000),
      largo(300),
      mov.id,
    ]);
    const guardado = (await d.movimientos.obtener(mov.id))!;
    // Cambiar el importe conservando los textos: se guarda, y los textos siguen enteros.
    const cambiado = await d.movimientos.modificar(
      mov.id,
      d.gasto({ importe: 250, nombre: guardado.nombre, nota: guardado.nota }),
    );
    expect(cambiado).toMatchObject({ importe: 250 });
    expect(cambiado.nota).toHaveLength(5000);
    expect(cambiado.nombre).toHaveLength(300);
    // Cambiarlo por otro texto largo: no.
    await esperarError(
      d.movimientos.modificar(mov.id, d.gasto({ nombre: guardado.nombre, nota: largo(5001) })),
      'texto_demasiado_largo',
    );
    // Acortarlo: sí.
    const corto = await d.movimientos.modificar(
      mov.id,
      d.gasto({ nombre: 'Corto', nota: 'Breve' }),
    );
    expect(corto).toMatchObject({ nombre: 'Corto', nota: 'Breve' });
  });
});

describe('la fila más grande posible de cada tabla cabe cifrada en el servidor, con margen', () => {
  // Peor caso de codificación: un carácter de control ocupa 6 bytes en JSON (\\u0001).
  const peor = (n: number) => '\u0001'.repeat(n);
  const LIMITE_POR_COLUMNA: Record<string, number> = {
    nombre: LIMITE_DE_TEXTO.nombre,
    comercio: LIMITE_DE_TEXTO.comercio,
    nota: LIMITE_DE_TEXTO.nota,
    // Textos de una captura y lo que sale de ellos: 200 caracteres como mucho.
    importe_texto: 200,
    comercio_texto: 200,
    tarjeta_texto: 200,
    texto: 200,
    id_de_cola: 200,
  };

  it.each(TABLAS.map((tabla) => [tabla.nombre, tabla] as const))('%s', async (_nombre, tabla) => {
    const fila: FilaLocal = {};
    for (const columna of tabla.columnas) {
      if (columna === 'id') fila[columna] = randomUUID();
      else if (columna in LIMITE_POR_COLUMNA) fila[columna] = peor(LIMITE_POR_COLUMNA[columna]);
      else if (columna.endsWith('_id')) fila[columna] = randomUUID();
      else if (columna.endsWith('_en')) fila[columna] = '2026-11-22T10:00:00.000Z';
      // El resto son números, fechas, divisas y enumerados: 20 caracteres sobran.
      else fila[columna] = 'x'.repeat(20);
    }
    const sobre = await cifrarFila(await generarClaveDeDatos(), randomUUID(), tabla.nombre, fila);
    // Con margen: menos de la mitad de lo que admite el servidor.
    expect(sobre.length).toBeLessThan(MAXIMO_DEL_SERVIDOR / 2);
  });
});
