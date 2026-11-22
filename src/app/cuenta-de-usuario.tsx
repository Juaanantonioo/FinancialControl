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
import { exportacion } from '@/estado/exportacionDeLaApp';
import { describirFecha, diaLocalDe, horaLocalDe } from '@/estado/fechas';
import { sincronizacion, useSincronizacion } from '@/estado/sincronizacionDeLaApp';
import type { ResultadoDeExportar } from '@/exportacion/exportador';
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
 * Con sesión enseña además el estado de la sincronización cifrada (última
 * vez, cambios pendientes, apuntes que no se han podido aplicar y, si algo
 * falla, un mensaje sin detalles internos), el botón «Sincronizar ahora» y, al
 * entrar en una cuenta con datos desde un dispositivo con datos, la pregunta
 * de qué datos usar. Queda detrás del bloqueo de la app como todas.
 */
export default function CuentaDeUsuario() {
  const c = useColores();
  const margen = useSafeAreaInsets();
  const estado = useCuenta();
  const sinc = useSincronizacion();
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
  // Cambio de contraseña: la actual, la nueva y la nueva repetida.
  const [cambiando, setCambiando] = useState(false);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [nuevaRepetida, setNuevaRepetida] = useState('');

  const pendiente = estado.fase === 'pendiente_de_codigo';

  function olvidarFormulario() {
    setContrasena('');
    setRepetida('');
    setEscritos(['', '']);
    setConfirmando(false);
    setBorrando(false);
    setPalabra('');
    setCambiando(false);
    setActual('');
    setNueva('');
    setNuevaRepetida('');
  }

  const cambiarContrasena = () => {
    if (nueva !== nuevaRepetida) {
      setError(textoDelError('no_coinciden'));
      return;
    }
    void ejecutar(
      () => cuenta().cambiarContrasena(actual, nueva),
      () => {
        // Las contraseñas se quitan de la pantalla en cuanto han servido.
        olvidarFormulario();
        mostrarAviso({ texto: t('usuario.contrasenaCambiada') });
      },
    );
  };

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

  /** «Subir los datos»: respuesta afirmativa a la pregunta de subida. */
  async function subirLoLocal() {
    setError(null);
    const resultado = await sincronizacion().confirmarSubida();
    if (resultado === 'hay_nube') setError(t('sinc.hayNube'));
    else if (resultado === 'sin_conexion') setError(t('sinc.sinConexion'));
    else if (resultado === 'sesion_caducada') setError(t('sinc.sesionCaducada'));
    else if (resultado === 'error') setError(t('sinc.error'));
  }

  /** «Usar los datos de la nube»: primero la copia de lo local; sin copia no se toca nada. */
  async function usarLaNube() {
    setError(null);
    // En un objeto, porque se rellena desde dentro de la función que se pasa al motor.
    const copiaHecha: { resultado: ResultadoDeExportar } = { resultado: 'error' };
    const resultado = await sincronizacion().usarLaNube(async () => {
      copiaHecha.resultado = await exportacion().todo('-copia-local');
      return copiaHecha.resultado === 'compartido';
    });
    const copia = copiaHecha.resultado;
    if (resultado.estado === 'hecho') {
      mostrarAviso({ texto: t('sinc.nubeUsada') });
    } else if (resultado.estado === 'sin_copia') {
      if (copia === 'descartado') setError(t('sinc.sinCopia'));
      else if (copia === 'no_autenticado') setError(t('exportar.noAutenticado'));
      else setError(t('sinc.sinCopiaPosible'));
    } else if (resultado.estado === 'sin_conexion') {
      setError(t('sinc.sinConexion'));
    } else if (resultado.estado === 'sesion_caducada') {
      setError(t('sinc.sesionCaducada'));
    } else {
      setError(t('sinc.error'));
    }
  }

  const textoDeFase: Record<typeof sinc.fase, ClaveTexto> = {
    inactiva: 'sinc.inactiva',
    preguntar: 'sinc.inactiva',
    en_pausa: 'sinc.enPausa',
    al_dia: 'sinc.alDia',
    parcial: 'sinc.parcial',
    sin_conexion: 'sinc.sinConexion',
    sesion_caducada: 'sinc.sesionCaducada',
    error: 'sinc.error',
  };
  const hayProblema = ['en_pausa', 'parcial', 'sin_conexion', 'sesion_caducada', 'error'].includes(
    sinc.fase,
  );

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
  } else if (
    estado.fase === 'con_sesion' &&
    sinc.fase === 'preguntar' &&
    sinc.pregunta === 'subir'
  ) {
    // Este dispositivo tiene datos y la cuenta está vacía: no suben sin que la persona lo diga.
    cuerpo = (
      <Tarjeta titulo={t('sinc.subirTitulo')} testID="cuenta-pregunta-subir">
        <Text maxFontSizeMultiplier={1.6} style={[estilos.texto, { color: c.texto }]}>
          {t('sinc.subirTexto')}
        </Text>
        <Text maxFontSizeMultiplier={1.6} style={nota}>
          {`⚠ ${t('sinc.subirAviso')}`}
        </Text>
        <TextoDeError texto={error} />
        {sinc.trabajando ? (
          <View style={estilos.trabajando} testID="sincronizando">
            <ActivityIndicator color={c.acento} />
            <Text maxFontSizeMultiplier={1.6} style={nota}>
              {t('sinc.trabajando')}
            </Text>
          </View>
        ) : null}
        <Boton
          texto={t('sinc.subir')}
          variante="primario"
          desactivado={sinc.trabajando || estado.ocupado}
          alPulsar={() => void subirLoLocal()}
          testID="subir-lo-local"
        />
        <Boton
          texto={t('sinc.subirCancelar')}
          desactivado={sinc.trabajando || estado.ocupado}
          alPulsar={() => {
            setError(null);
            sincronizacion().posponerSubida();
            mostrarAviso({ texto: t('sinc.subirCancelado') });
          }}
          testID="cancelar-subida"
        />
      </Tarjeta>
    );
  } else if (estado.fase === 'con_sesion' && sinc.fase === 'preguntar') {
    // La nube y el dispositivo tienen datos: no se sincroniza nada hasta que la persona decida.
    cuerpo = (
      <Tarjeta titulo={t('sinc.preguntaTitulo')} testID="cuenta-pregunta">
        <Text maxFontSizeMultiplier={1.6} style={[estilos.texto, { color: c.texto }]}>
          {t('sinc.preguntaTexto')}
        </Text>
        <Text maxFontSizeMultiplier={1.6} style={nota}>
          {`⚠ ${t('sinc.preguntaCopia')}`}
        </Text>
        <TextoDeError texto={error} />
        {sinc.trabajando ? (
          <View style={estilos.trabajando} testID="sincronizando">
            <ActivityIndicator color={c.acento} />
            <Text maxFontSizeMultiplier={1.6} style={nota}>
              {t('sinc.trabajando')}
            </Text>
          </View>
        ) : null}
        <Boton
          texto={t('sinc.usarLaNube')}
          variante="primario"
          desactivado={sinc.trabajando || estado.ocupado}
          alPulsar={() => void usarLaNube()}
          testID="usar-la-nube"
        />
        <Boton
          texto={t('sinc.cancelar')}
          desactivado={sinc.trabajando || estado.ocupado}
          alPulsar={() =>
            void ejecutar(
              () => cuenta().cerrarSesion(),
              () => {
                olvidarFormulario();
                mostrarAviso({ texto: t('sinc.entradaCancelada') });
              },
            )
          }
          testID="cancelar-entrada"
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
          <TextoDeError texto={borrando || cambiando ? null : error} />
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
        <Tarjeta titulo={t('sinc.titulo')} testID="cuenta-sincronizacion">
          {sinc.trabajando ? (
            <View style={estilos.trabajando} testID="sincronizando">
              <ActivityIndicator color={c.acento} />
              <Text maxFontSizeMultiplier={1.6} style={nota}>
                {t('sinc.trabajando')}
              </Text>
            </View>
          ) : null}
          <Text
            maxFontSizeMultiplier={1.6}
            style={[estilos.texto, { color: hayProblema ? c.negativo : c.texto }]}
            testID="estado-de-sincronizacion">
            {`${hayProblema ? '⚠ ' : ''}${t(textoDeFase[sinc.fase])}`}
          </Text>
          <Text maxFontSizeMultiplier={1.6} style={nota} testID="ultima-sincronizacion">
            {sinc.ultima
              ? t('sinc.ultima', {
                  cuando: `${describirFecha(diaLocalDe(sinc.ultima))}, ${horaLocalDe(sinc.ultima)}`,
                })
              : t('sinc.nunca')}
          </Text>
          <Text maxFontSizeMultiplier={1.6} style={nota} testID="cambios-pendientes">
            {sinc.pendientes === 0
              ? t('sinc.sinPendientes')
              : sinc.pendientes === 1
                ? t('sinc.unPendiente')
                : t('sinc.pendientes', { numero: sinc.pendientes })}
          </Text>
          {sinc.ilegibles > 0 ? (
            <Text
              maxFontSizeMultiplier={1.6}
              style={[estilos.nota, { color: c.negativo }]}
              testID="filas-ilegibles">
              {`⚠ ${t('sinc.ilegibles', { numero: sinc.ilegibles })}`}
            </Text>
          ) : null}
          {sinc.noAplicables > 0 ? (
            <Text maxFontSizeMultiplier={1.6} style={nota} testID="filas-no-aplicables">
              {t('sinc.noAplicables', { numero: sinc.noAplicables })}
            </Text>
          ) : null}
          <Boton
            texto={t('sinc.ahora')}
            desactivado={sinc.trabajando}
            alPulsar={() => void sincronizacion().pedir('manual')}
            testID="sincronizar-ahora"
          />
        </Tarjeta>
        <Tarjeta titulo={t('usuario.cambiarTitulo')} testID="cuenta-cambiar-contrasena">
          <Text maxFontSizeMultiplier={1.6} style={nota}>
            {t('usuario.cambiarTexto')}
          </Text>
          {cambiando ? (
            <>
              <Text maxFontSizeMultiplier={1.6} style={nota}>
                {t('usuario.cambiarSesiones')}
              </Text>
              <TextoDeError texto={error} />
              {(
                [
                  ['contrasenaActual', actual, setActual, 'contrasena-actual', false],
                  ['contrasenaNueva', nueva, setNueva, 'contrasena-nueva', true],
                  ['repetirNueva', nuevaRepetida, setNuevaRepetida, 'repetir-nueva', true],
                ] as const
              ).map(([clave, valor, fijarValor, id, esNueva]) => (
                <View key={id} style={estilos.bloque}>
                  <Text maxFontSizeMultiplier={1.6} style={[estilos.etiqueta, { color: c.texto }]}>
                    {t(`usuario.${clave}`)}
                  </Text>
                  <TextInput
                    value={valor}
                    onChangeText={fijarValor}
                    secureTextEntry
                    textContentType={esNueva ? 'newPassword' : 'password'}
                    autoComplete={esNueva ? 'new-password' : 'current-password'}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={LONGITUD_MAXIMA_DE_CONTRASENA}
                    accessibilityLabel={t(`usuario.${clave}`)}
                    testID={id}
                    style={campo}
                  />
                </View>
              ))}
              <Text maxFontSizeMultiplier={1.6} style={nota}>
                {t('usuario.contrasenaAyuda')}
              </Text>
              {estado.ocupado ? (
                <View style={estilos.trabajando} testID="cuenta-trabajando">
                  <ActivityIndicator color={c.acento} />
                  <Text maxFontSizeMultiplier={1.6} style={nota}>
                    {t('usuario.trabajando')}
                  </Text>
                </View>
              ) : null}
              <Boton
                texto={t('usuario.cambiarConfirmar')}
                variante="primario"
                desactivado={
                  estado.ocupado || actual === '' || nueva === '' || nuevaRepetida === ''
                }
                alPulsar={cambiarContrasena}
                testID="confirmar-cambio"
              />
              <Boton
                texto={t('comun.cancelar')}
                desactivado={estado.ocupado}
                alPulsar={() => {
                  olvidarFormulario();
                  setError(null);
                }}
                testID="cancelar-cambio"
              />
            </>
          ) : (
            <Boton
              texto={t('usuario.cambiar')}
              alPulsar={() => {
                setError(null);
                setBorrando(false);
                setCambiando(true);
              }}
              testID="cambiar-contrasena"
            />
          )}
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
                setCambiando(false);
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
            {t('usuario.conCuenta')}
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
