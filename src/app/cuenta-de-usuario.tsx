import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton, Cabecera, CabeceraConVuelta, TextoDeError } from '@/componentes/basicos';
import { Tarjeta } from '@/componentes/Tarjeta';
import { gruposDelCodigo } from '@/cripto';
import { useAviso } from '@/estado/Aviso';
import type { ErrorDeCuenta, Resultado } from '@/estado/cuenta';
import { cuenta, useCuenta } from '@/estado/cuentaDeLaApp';
import { t, type ClaveTexto } from '@/i18n';
import { LONGITUD_MAXIMA_DE_CONTRASENA } from '@/lib/contrasena';
import { Espacio, Letra, Radio, TactilMinimo, useColores } from '@/theme';

type Modo = 'crear' | 'entrar';

const textoDelError = (error: ErrorDeCuenta | 'no_coinciden'): string =>
  t(`usuario.error_${error}` as ClaveTexto);

/**
 * Ajustes › Cuenta. Crear cuenta, guardar y confirmar el código de
 * recuperación, iniciar y cerrar sesión, y borrar la cuenta.
 *
 * Hoy la cuenta no sincroniza nada: solo crea y guarda las claves. La
 * pantalla lo dice. Queda detrás del bloqueo de la app como todas.
 */
export default function CuentaDeUsuario() {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const estado = useCuenta();
  const mostrarAviso = useAviso();
  const [modo, setModo] = useState<Modo>('crear');
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Código de recuperación: primero se enseña, después se piden dos grupos.
  const [confirmando, setConfirmando] = useState(false);
  const [escritos, setEscritos] = useState<string[]>(['', '']);
  // Borrado: primer toque abre la confirmación; hay que escribir la palabra.
  const [borrando, setBorrando] = useState(false);
  const [palabra, setPalabra] = useState('');

  const pendiente = estado.fase === 'pendiente_de_codigo';

  function olvidarFormulario() {
    setContrasena('');
    setRepetida('');
    setEscritos(['', '']);
    setConfirmando(false);
    setBorrando(false);
    setPalabra('');
  }

  async function ejecutar(operacion: () => Promise<Resultado>, alTerminar?: () => void) {
    setError(null);
    const resultado = await operacion();
    if (resultado.ok) alTerminar?.();
    else setError(textoDelError(resultado.error));
  }

  const enviar = () => {
    if (modo === 'crear' && contrasena !== repetida) {
      setError(textoDelError('no_coinciden'));
      return;
    }
    const operacion =
      modo === 'crear'
        ? () => cuenta().crearCuenta(correo, contrasena)
        : () => cuenta().iniciarSesion(correo, contrasena);
    // La contraseña se quita de la pantalla en cuanto ha servido.
    void ejecutar(operacion, olvidarFormulario);
  };

  const campo = [estilos.campo, { color: c.texto, borderColor: c.borde, backgroundColor: c.fondo }];
  const nota = [estilos.nota, { color: c.textoSecundario }];

  let cuerpo;
  if (estado.fase === 'comprobando') {
    cuerpo = (
      <Tarjeta testID="cuenta-comprobando">
        <ActivityIndicator color={c.acento} />
        <Text maxFontSizeMultiplier={1.6} style={nota}>
          {t('usuario.comprobando')}
        </Text>
      </Tarjeta>
    );
  } else if (estado.fase === 'sin_configurar' || estado.fase === 'cripto_no_fiable') {
    cuerpo = (
      <Tarjeta testID="cuenta-no-disponible">
        <Text maxFontSizeMultiplier={1.6} style={[estilos.texto, { color: c.texto }]}>
          {`⚠ ${t(estado.fase === 'sin_configurar' ? 'usuario.sinConfigurar' : 'usuario.criptoNoFiable')}`}
        </Text>
      </Tarjeta>
    );
  } else if (pendiente && estado.codigo && !confirmando) {
    cuerpo = (
      <Tarjeta titulo={t('usuario.codigoTitulo')} testID="cuenta-codigo">
        <Text maxFontSizeMultiplier={1.6} style={[estilos.texto, { color: c.texto }]}>
          {t('usuario.codigoTexto')}
        </Text>
        <View
          style={[estilos.codigo, { backgroundColor: c.fondo, borderColor: c.borde }]}
          accessible
          accessibilityLabel={`${t('usuario.codigoTitulo')}: ${gruposDelCodigo(estado.codigo).join(', ')}`}
          testID="codigo-de-recuperacion">
          {gruposDelCodigo(estado.codigo).map((grupo, i) => (
            <View key={`${i}-${grupo}`} style={estilos.grupo}>
              <Text allowFontScaling={false} style={[estilos.numero, { color: c.textoSecundario }]}>
                {i + 1}
              </Text>
              <Text
                maxFontSizeMultiplier={1.3}
                selectable
                style={[estilos.simbolos, { color: c.texto }]}>
                {grupo}
              </Text>
            </View>
          ))}
        </View>
        <Boton
          texto={t('usuario.codigoGuardar')}
          alPulsar={() => {
            Share.share({
              message: t('usuario.codigoParaCompartir', {
                correo: estado.correo ?? '',
                codigo: estado.codigo ?? '',
              }),
            }).catch(() => undefined);
          }}
          testID="guardar-codigo"
        />
        <Boton
          texto={t('usuario.codigoSiguiente')}
          variante="primario"
          alPulsar={() => {
            setError(null);
            setConfirmando(true);
          }}
          testID="codigo-guardado"
        />
        <Boton
          texto={t('usuario.cancelarAlta')}
          variante="peligro"
          desactivado={estado.ocupado}
          alPulsar={() => void ejecutar(() => cuenta().cancelarAlta(), olvidarFormulario)}
          testID="cancelar-alta"
        />
      </Tarjeta>
    );
  } else if (pendiente) {
    cuerpo = (
      <Tarjeta titulo={t('usuario.confirmarTitulo')} testID="cuenta-confirmar">
        <Text maxFontSizeMultiplier={1.6} style={[estilos.texto, { color: c.texto }]}>
          {t('usuario.confirmarTexto')}
        </Text>
        <TextoDeError texto={error} />
        {estado.gruposPedidos.map((posicion, i) => (
          <View key={posicion} style={estilos.bloque}>
            <Text maxFontSizeMultiplier={1.6} style={[estilos.etiqueta, { color: c.texto }]}>
              {t('usuario.grupoNumero', { numero: posicion + 1 })}
            </Text>
            <TextInput
              value={escritos[i] ?? ''}
              onChangeText={(texto) =>
                setEscritos((antes) => antes.map((valor, j) => (j === i ? texto : valor)))
              }
              autoCapitalize="characters"
              autoCorrect={false}
              spellCheck={false}
              maxLength={8}
              accessibilityLabel={t('usuario.grupoNumero', { numero: posicion + 1 })}
              testID={`grupo-${i}`}
              style={[campo, estilos.simbolos]}
            />
          </View>
        ))}
        <Boton
          texto={t('usuario.confirmar')}
          variante="primario"
          desactivado={estado.ocupado || escritos.some((texto) => texto.trim() === '')}
          alPulsar={() =>
            void ejecutar(
              () => cuenta().confirmarCodigo(escritos),
              () => {
                olvidarFormulario();
                mostrarAviso({ texto: t('usuario.cuentaCreada') });
              },
            )
          }
          testID="confirmar-codigo"
        />
        <Boton
          texto={t('usuario.codigoVolver')}
          alPulsar={() => {
            setError(null);
            setConfirmando(false);
          }}
          testID="volver-al-codigo"
        />
      </Tarjeta>
    );
  } else if (estado.fase === 'con_sesion') {
    cuerpo = (
      <>
        <Tarjeta titulo={t('usuario.conSesionTitulo')} testID="cuenta-con-sesion">
          <Text
            maxFontSizeMultiplier={1.6}
            style={[estilos.texto, { color: c.texto }]}
            testID="correo-de-la-cuenta">
            {t('usuario.conSesionCorreo', { correo: estado.correo ?? '' })}
          </Text>
          <Text maxFontSizeMultiplier={1.6} style={nota}>
            {t('usuario.conSesionTexto')}
          </Text>
          <Text maxFontSizeMultiplier={1.6} style={nota}>
            {t('usuario.hoyNoSincroniza')}
          </Text>
          <TextoDeError texto={borrando ? null : error} />
          <Boton
            texto={t('usuario.cerrar')}
            desactivado={estado.ocupado}
            alPulsar={() =>
              void ejecutar(
                () => cuenta().cerrarSesion(),
                () => {
                  olvidarFormulario();
                  mostrarAviso({ texto: t('usuario.sesionCerrada') });
                },
              )
            }
            testID="cerrar-sesion"
          />
          <Text maxFontSizeMultiplier={1.6} style={nota}>
            {t('usuario.cerrarAyuda')}
          </Text>
        </Tarjeta>
        <Tarjeta titulo={t('usuario.borrarTitulo')} testID="cuenta-borrar">
          <Text maxFontSizeMultiplier={1.6} style={[estilos.texto, { color: c.texto }]}>
            {t('usuario.borrarTexto')}
          </Text>
          {borrando ? (
            <>
              <TextoDeError texto={error} />
              <Text maxFontSizeMultiplier={1.6} style={[estilos.etiqueta, { color: c.texto }]}>
                {t('usuario.borrarEscribe')}
              </Text>
              <TextInput
                value={palabra}
                onChangeText={setPalabra}
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
                maxLength={12}
                accessibilityLabel={t('usuario.borrarEscribe')}
                testID="palabra-de-borrado"
                style={campo}
              />
              <Boton
                texto={t('usuario.borrarDefinitivo')}
                variante="peligro"
                desactivado={
                  estado.ocupado || palabra.trim().toUpperCase() !== t('usuario.borrarPalabra')
                }
                alPulsar={() =>
                  void ejecutar(
                    () => cuenta().borrarCuenta(),
                    () => {
                      olvidarFormulario();
                      mostrarAviso({ texto: t('usuario.cuentaBorrada') });
                    },
                  )
                }
                testID="borrar-definitivamente"
              />
              <Boton
                texto={t('comun.cancelar')}
                alPulsar={() => {
                  setBorrando(false);
                  setPalabra('');
                  setError(null);
                }}
                testID="cancelar-borrado"
              />
            </>
          ) : (
            <Boton
              texto={t('usuario.borrar')}
              variante="peligro"
              alPulsar={() => {
                setError(null);
                setBorrando(true);
              }}
              testID="borrar-cuenta"
            />
          )}
        </Tarjeta>
      </>
    );
  } else {
    const crear = modo === 'crear';
    cuerpo = (
      <>
        <Tarjeta titulo={t('usuario.sinSesionTitulo')} testID="cuenta-sin-sesion">
          <Text maxFontSizeMultiplier={1.6} style={[estilos.texto, { color: c.texto }]}>
            {t('usuario.sinSesionTexto')}
          </Text>
          <Text maxFontSizeMultiplier={1.6} style={nota}>
            {t('usuario.hoyNoSincroniza')}
          </Text>
        </Tarjeta>
        <Tarjeta titulo={t(crear ? 'usuario.crear' : 'usuario.entrar')} testID="cuenta-formulario">
          {crear ? (
            <View
              style={[estilos.aviso, { backgroundColor: c.fondo, borderColor: c.borde }]}
              testID="aviso-de-contrasena">
              <Text maxFontSizeMultiplier={1.6} style={[estilos.etiqueta, { color: c.texto }]}>
                {`⚠ ${t('usuario.avisoContrasenaTitulo')}`}
              </Text>
              <Text maxFontSizeMultiplier={1.6} style={nota}>
                {t('usuario.avisoContrasenaTexto')}
              </Text>
            </View>
          ) : null}
          <TextoDeError texto={error} />
          <Text maxFontSizeMultiplier={1.6} style={[estilos.etiqueta, { color: c.texto }]}>
            {t('usuario.correo')}
          </Text>
          <TextInput
            value={correo}
            onChangeText={setCorreo}
            placeholder={t('usuario.correoEjemplo')}
            placeholderTextColor={c.textoSecundario}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={254}
            accessibilityLabel={t('usuario.correo')}
            testID="correo"
            style={campo}
          />
          <Text maxFontSizeMultiplier={1.6} style={[estilos.etiqueta, { color: c.texto }]}>
            {t('usuario.contrasena')}
          </Text>
          <TextInput
            value={contrasena}
            onChangeText={setContrasena}
            secureTextEntry
            textContentType={crear ? 'newPassword' : 'password'}
            autoComplete={crear ? 'new-password' : 'current-password'}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={LONGITUD_MAXIMA_DE_CONTRASENA}
            accessibilityLabel={t('usuario.contrasena')}
            testID="contrasena"
            style={campo}
          />
          {crear ? (
            <>
              <Text maxFontSizeMultiplier={1.6} style={nota}>
                {t('usuario.contrasenaAyuda')}
              </Text>
              <Text maxFontSizeMultiplier={1.6} style={[estilos.etiqueta, { color: c.texto }]}>
                {t('usuario.repetir')}
              </Text>
              <TextInput
                value={repetida}
                onChangeText={setRepetida}
                secureTextEntry
                textContentType="newPassword"
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={LONGITUD_MAXIMA_DE_CONTRASENA}
                accessibilityLabel={t('usuario.repetir')}
                testID="repetir-contrasena"
                style={campo}
              />
            </>
          ) : null}
          {estado.ocupado ? (
            <View style={estilos.trabajando} testID="cuenta-trabajando">
              <ActivityIndicator color={c.acento} />
              <Text maxFontSizeMultiplier={1.6} style={nota}>
                {t('usuario.trabajando')}
              </Text>
            </View>
          ) : null}
          <Boton
            texto={t(crear ? 'usuario.crear' : 'usuario.entrar')}
            variante="primario"
            desactivado={estado.ocupado || correo.trim() === '' || contrasena === ''}
            alPulsar={enviar}
            testID="enviar"
          />
          <Boton
            texto={t(crear ? 'usuario.yaTengo' : 'usuario.noTengo')}
            desactivado={estado.ocupado}
            alPulsar={() => {
              setError(null);
              setRepetida('');
              setModo(crear ? 'entrar' : 'crear');
            }}
            testID="cambiar-de-modo"
          />
        </Tarjeta>
      </>
    );
  }

  return (
    <View style={[estilos.pantalla, { backgroundColor: c.fondo }]}>
      {/* Con el código a la vista no se sale: ni con el gesto ni con el botón de volver. */}
      <Stack.Screen options={{ gestureEnabled: !pendiente }} />
      {pendiente ? (
        <Cabecera titulo={t('usuario.titulo')} />
      ) : (
        <CabeceraConVuelta titulo={t('usuario.titulo')} />
      )}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[estilos.contenido, { paddingBottom: margen.bottom + Espacio.xl }]}>
        {cuerpo}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1 },
  contenido: { padding: Espacio.m, gap: Espacio.m },
  texto: { fontSize: Letra.secundario, lineHeight: 22 },
  nota: { fontSize: Letra.pequeno, lineHeight: 18 },
  etiqueta: { fontSize: Letra.secundario, fontWeight: '600' },
  bloque: { gap: Espacio.xs },
  campo: {
    minHeight: TactilMinimo,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radio.s,
    paddingHorizontal: Espacio.s,
    fontSize: Letra.cuerpo,
  },
  aviso: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radio.s,
    padding: Espacio.s,
    gap: Espacio.xs,
  },
  codigo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radio.s,
    padding: Espacio.s,
    rowGap: Espacio.s,
  },
  grupo: { width: '33.33%', flexDirection: 'row', alignItems: 'baseline', gap: Espacio.xs },
  numero: { fontSize: 11, width: 16, textAlign: 'right' },
  simbolos: { fontSize: Letra.cuerpo, fontWeight: '700', fontFamily: 'Menlo', letterSpacing: 1 },
  trabajando: { flexDirection: 'row', alignItems: 'center', gap: Espacio.s },
});
