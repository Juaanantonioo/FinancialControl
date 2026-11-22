/**
 * Acceso a los datos desde las pantallas.
 *
 * `ProveedorDeDatos` abre la base de datos una sola vez al arrancar y la
 * comparte con todas las pantallas (un "contexto" de React: algo parecido a
 * una dependencia inyectada).
 *
 * `useConsulta` ejecuta una lectura y la repite sola cada vez que algo
 * cambia. Las pantallas que escriben llaman a `notificarCambio()` y todas
 * las listas visibles se refrescan.
 */
import * as Crypto from 'expo-crypto';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type DependencyList,
  type ReactNode,
} from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { prepararBaseDeDatos, type CategoriaInicial, type Repositorios } from '@/datos';
import type { BaseDeDatos } from '@/datos/bd';
import { abrirBdExpo } from '@/datos/bdExpo';
import { ErrorDeDominio } from '@/dominio/modelo';
import { t, type ClaveTexto } from '@/i18n';
import { Espacio, useColores } from '@/theme';

type ValorDelContexto = {
  repos: Repositorios;
  /** Número que aumenta con cada cambio; las consultas dependen de él. */
  version: number;
  notificarCambio: () => void;
};

const Contexto = createContext<ValorDelContexto | null>(null);

/** Las categorías que la app crea al instalarse. La sincronización las usa para reconocerlas. */
export function categoriasIniciales(): CategoriaInicial[] {
  return [
    { nombre: t('categoriasIniciales.comida'), tipo: 'gasto' },
    { nombre: t('categoriasIniciales.casa'), tipo: 'gasto' },
    { nombre: t('categoriasIniciales.transporte'), tipo: 'gasto' },
    { nombre: t('categoriasIniciales.ocio'), tipo: 'gasto' },
    { nombre: t('categoriasIniciales.salud'), tipo: 'gasto' },
    { nombre: t('categoriasIniciales.compras'), tipo: 'gasto' },
    { nombre: t('categoriasIniciales.otrosGastos'), tipo: 'gasto' },
    { nombre: t('categoriasIniciales.nomina'), tipo: 'ingreso' },
    { nombre: t('categoriasIniciales.otrosIngresos'), tipo: 'ingreso' },
  ];
}

type Apertura = { repos: Repositorios; bd: BaseDeDatos };

// La base de datos se abre una única vez por ejecución de la app.
let apertura: Promise<Apertura> | null = null;

// Avisos entre los datos y la sincronización, sin que ninguno conozca al otro:
// las pantallas avisan de un cambio local, y la sincronización, de uno remoto.
const oyentesDeCambiosLocales = new Set<() => void>();
const oyentesDeCambiosRemotos = new Set<() => void>();

/** Se llama cada vez que una pantalla ha escrito algo. Devuelve cómo dejar de escuchar. */
export function alCambiarDatosLocales(avisar: () => void): () => void {
  oyentesDeCambiosLocales.add(avisar);
  return () => {
    oyentesDeCambiosLocales.delete(avisar);
  };
}

/** La sincronización ha cambiado datos: las pantallas vuelven a leer. No cuenta como cambio local. */
export function refrescarDatos(): void {
  oyentesDeCambiosRemotos.forEach((avisar) => avisar());
}

/** La base de datos de la app, ya abierta y migrada. Para la sincronización y la exportación. */
export async function baseDeDatosDeLaApp(): Promise<BaseDeDatos> {
  return (await abrirRepositorios()).bd;
}

/** Último paso alcanzado al abrir los datos y, si falla, el motivo. Solo para diagnóstico. */
const diagnostico = { paso: 'inicio', error: '' };

function abrirRepositorios(): Promise<Apertura> {
  if (!apertura) {
    apertura = (async () => {
      diagnostico.paso = 'abrir';
      const bd = await abrirBdExpo();
      diagnostico.paso = 'preparar';
      const repos = await prepararBaseDeDatos(
        bd,
        { generarId: () => Crypto.randomUUID(), ahora: () => new Date() },
        categoriasIniciales(),
      );
      diagnostico.paso = 'listo';
      return { repos, bd };
    })();
    // Si falla, se permite reintentar en el siguiente arranque del proveedor.
    apertura.catch((e) => {
      diagnostico.error = e instanceof Error ? e.message : String(e);
      apertura = null;
    });
  }
  return apertura;
}

export function ProveedorDeDatos({ children }: { children: ReactNode }) {
  const c = useColores();
  const [repos, setRepos] = useState<Repositorios | null>(null);
  const [fallo, setFallo] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let vigente = true;
    abrirRepositorios().then(
      (r) => vigente && setRepos(r.repos),
      () => vigente && setFallo(true),
    );
    // Lo que trae la sincronización refresca las pantallas igual que un cambio propio.
    const refrescar = () => setVersion((v) => v + 1);
    oyentesDeCambiosRemotos.add(refrescar);
    return () => {
      vigente = false;
      oyentesDeCambiosRemotos.delete(refrescar);
    };
  }, []);

  const notificarCambio = useCallback(() => {
    setVersion((v) => v + 1);
    oyentesDeCambiosLocales.forEach((avisar) => avisar());
  }, []);
  const valor = useMemo(
    () => (repos ? { repos, version, notificarCambio } : null),
    [repos, version, notificarCambio],
  );

  if (!valor) {
    return (
      <View style={[estilos.centro, { backgroundColor: c.fondo }]}>
        {fallo ? null : <ActivityIndicator />}
        <Text style={{ color: fallo ? c.negativo : c.textoSecundario }}>
          {fallo ? t('app.errorAlAbrir') : t('app.cargando')}
        </Text>
        {fallo ? (
          <Text style={{ color: c.textoSecundario, fontSize: 12 }} testID="diagnostico-apertura">
            {`${diagnostico.paso}: ${diagnostico.error}`}
          </Text>
        ) : null}
      </View>
    );
  }
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDatos(): ValorDelContexto {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useDatos se ha usado fuera de ProveedorDeDatos');
  return valor;
}

/**
 * Ejecuta una lectura y devuelve su resultado (`undefined` mientras carga).
 * Se repite cuando cambian los datos o las dependencias indicadas.
 */
export function useConsulta<T>(
  leer: (repos: Repositorios) => Promise<T>,
  dependencias: DependencyList = [],
): T | undefined {
  const { repos, version } = useDatos();
  const [resultado, setResultado] = useState<T | undefined>(undefined);
  useEffect(() => {
    let vigente = true;
    leer(repos).then(
      (r) => vigente && setResultado(r),
      () => undefined,
    );
    return () => {
      vigente = false;
    };
    // `leer` se crea en cada pintado; lo que decide repetir la lectura son las dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, version, ...dependencias]);
  return resultado;
}

/** Texto del catálogo que corresponde a un error, sea de dominio o inesperado. */
export function textoDeError(error: unknown): string {
  if (error instanceof ErrorDeDominio) return t(`errores.${error.codigo}` as ClaveTexto);
  return t('errores.generico');
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Espacio.m },
});
