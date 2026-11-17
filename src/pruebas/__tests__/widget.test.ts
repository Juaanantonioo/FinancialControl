/**
 * Prueba de los datos que la app envía al widget «Disponible este mes». El
 * widget solo pinta lo que recibe, así que lo que hay que comprobar es que
 * recibe las mismas cifras que el bloque de Inicio.
 */
import { prepararBaseDeDatos, type Repositorios } from '@/datos';
import { datosParaElWidget } from '@/estado/widget';
import { importe } from '@/estado/formato';
import { COLORES } from '@/theme';
import { crearBdDePrueba, crearEntornoDePrueba } from '@/pruebas/bdDePrueba';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ decimalSeparator: ',', digitGroupingSeparator: '.', languageCode: 'es' }],
}));
// El módulo importa el acceso a datos de la app, que abre SQLite nativo: aquí no se usa.
jest.mock('@/datos/bdExpo', () => ({ abrirBdExpo: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
// La extensión del widget no existe en las pruebas: se sustituye por un registro.
jest.mock('@/widgets/Disponible', () => ({
  __esModule: true,
  default: { updateSnapshot: jest.fn() },
}));

const HOY = '2026-11-17';
const euros = (centimos: number) => importe(centimos, 'EUR');
let repos: Repositorios;
let bancoId: string;
let casaId: string;

beforeAll(async () => {
  repos = await prepararBaseDeDatos(crearBdDePrueba(), crearEntornoDePrueba(), [
    { nombre: 'Casa', tipo: 'gasto' },
  ]);
  casaId = (await repos.categorias.listar())[0].id;
  const banco = await repos.cuentas.crear({
    nombre: 'Banco',
    tipo: 'banco',
    saldoInicial: 300000,
    fechaSaldoInicial: '2026-11-01',
  });
  bancoId = banco.id;
});

describe('datos del widget', () => {
  it('sin presupuesto invita a crearlo y no enseña ninguna cifra', async () => {
    const datos = await datosParaElWidget(repos, HOY);
    expect(datos).toMatchObject({
      titulo: 'Disponible este mes',
      cifra: '',
      detalle: 'Crea tu presupuesto',
      excedido: false,
      fecha: '17 de noviembre',
      boton: 'Añadir gasto',
      urlDeAlta: 'financialcontrol://movimiento',
      urlDeInicio: 'financialcontrol://',
    });
  });

  it('con presupuesto envía el disponible y el importe por día del caso de comprobación', async () => {
    // Presupuesto 1 100 €, gastado 687 € y un fijo pendiente de 45 €: 368 € y 26,28 € al día.
    await repos.presupuestos.guardar('2026-11', [{ categoriaId: casaId, importe: 110000 }]);
    await repos.movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-10',
      importe: 68700,
      cuentaId: bancoId,
      categoriaId: casaId,
    });
    await repos.reglas.crear({
      nombre: 'Gimnasio',
      clase: 'fijo',
      importe: 4500,
      cuentaId: bancoId,
      categoriaId: casaId,
      periodicidad: 'mensual',
      diaDelMes: 18,
      fechaInicio: '2026-11-01',
    });
    const datos = await datosParaElWidget(repos, HOY);
    expect(datos.cifra).toBe(euros(36800));
    expect(datos.detalle).toBe(`${euros(2628)} al día`);
    expect(datos.excedido).toBe(false);
  });

  it('si se ha pasado lo dice y marca el exceso', async () => {
    await repos.movimientos.crear({
      tipo: 'gasto',
      fecha: '2026-11-11',
      importe: 50000,
      cuentaId: bancoId,
      categoriaId: casaId,
    });
    const datos = await datosParaElWidget(repos, HOY);
    expect(datos).toMatchObject({
      cifra: euros(0),
      detalle: `Te has pasado ${euros(13200)}`,
      excedido: true,
    });
  });

  it('lleva los colores de la paleta de la app para claro y oscuro', async () => {
    const datos = await datosParaElWidget(repos, HOY);
    expect(datos.claro).toMatchObject({
      fondo: COLORES.claro.superficie,
      texto: COLORES.claro.texto,
      acento: COLORES.claro.acento,
    });
    expect(datos.oscuro.fondo).toBe(COLORES.oscuro.superficie);
    expect(datos.oscuro.texto).not.toBe(datos.claro.texto);
  });
});
