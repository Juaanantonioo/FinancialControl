# Informe final · B4b-1 Cuenta y claves

Fecha: 22/11/2026. Rama `b4b1-cuenta-y-claves`. `main` sin tocar. Nada aplicado al proyecto
remoto de Supabase.

**Estado: `COMPLETED_WITH_EXTERNAL_GATES`.** Los once criterios de éxito se cumplen en
pruebas, contra una instancia local de Supabase y en el simulador. Quedan fuera, por ser del
dueño: aplicar las migraciones al proyecto remoto, probar en el iPhone y fijar los
parámetros de Argon2id con medidas reales.

## 1. Baseline

- 18/11: `b4a-seguridad-local` @ `3785b0a`, 954 pruebas en 35 suites, esquema local 4,
  Docker disponible. Coincidía.
- 21/11 (reanudación): `b4b1-cuenta-y-claves` @ `4db59ce`, con trabajo sin confirmar.
  Coincidía con el encargo de continuación.
- Docker: el 21/11 el motor estaba parado. Docker Desktop está instalado; se arrancó con
  `open -a Docker` y respondió. No se paró el trabajo por eso.

## 2. Revisión del trabajo sin confirmar

- **Stash de respaldo: `stash@{0}`, `27c3df33d795a758d75662b173ae2363a08b09b6`**,
  «respaldo B4b1 antes de revisar (21/11/2026)». Sigue ahí; no borrarlo hasta dar el bloque
  por bueno.
- **`npm run check` tal como estaba: fallaba.** 2 pruebas de 1.054, las dos por errores de
  las propias pruebas.
- Todos los ficheros estaban enteros. La tabla fichero a fichero está en `docs/estado.md`,
  apartado 14.4. Resumen:

| Veredicto | Ficheros |
|---|---|
| Completo y correcto (16) | `plugins/parche-libsodium.js`, `package.json`, `package-lock.json`, `app.json`, `src/cripto/parametros.ts`, `scripts/vectores-de-cripto.cjs`, `src/cripto/vectores.json`, `src/cripto/autocomprobacion.ts`, `src/cripto/index.ts`, `docs/seguridad/riesgo-de-dependencia-libsodium.md`, `src/lib/contrasena.ts`, `src/lib/almacenSeguro.ts`, `src/lib/almacenSeguroNativo.ts`, `src/estado/cuentaDeLaApp.ts`, `src/i18n/es.json`, `src/pruebas/cuentaDePrueba.ts`, y `src/app/ajustes.tsx` y `_layout.tsx` |
| Incompleto (5) | `diseno-criptografico.md` (faltaban dos datos), `plugin.test.ts` (faltaba una comprobación), `cuenta-de-usuario.tsx` y `diagnostico.tsx` (sin pruebas de pantalla), `src/lib/supabase.ts` (Diagnóstico leía una tabla que ya no existe) |
| Incorrecto (3) | `cripto.test.ts` y `cuenta.test.ts` (una prueba mal cada uno) y **`src/estado/cuenta.ts` (un defecto real)** |

**El defecto de `cuenta.ts`:** al arrancar preguntaba la sesión a Supabase y, si no la
obtenía, borraba la clave del llavero. Con la sesión caducada (dura una hora) y sin
conexión, eso pasa: abrir la app sin cobertura habría borrado la clave de datos. Corregido:
lo que dice si hay cuenta abierta es la clave del llavero. Con prueba.

## 3. Condiciones de las tres decisiones

| Dec. | Condición | Estado | Dónde |
|---|---|---|---|
| 1 | Versiones exactas | Cumplida | `package.json`: `"react-native-libsodium": "1.7.0"`, `"libsodium-wrappers-sumo": "0.8.4"` |
| 1 | Huella SHA-256 del original; si no coincide, falla | Cumplida | `plugins/parche-libsodium.js`, función `parchear` (`HUELLA_ORIGINAL`) |
| 1 | Huella del resultado | Cumplida | Misma función (`HUELLA_PARCHEADA`) |
| 1 | Aplicarlo dos veces no cambia nada | Cumplida | Misma función; prueba en `plugin.test.ts` |
| 1 | Texto legible con origen, alcance y retirada | Cumplida | Cabecera del plugin y lista `SUSTITUCIONES` |
| 1 | Autocomprobación antes de operar; si falla, cuenta desactivada | Cumplida | `src/cripto/autocomprobacion.ts`; `src/estado/cuenta.ts`, `iniciar` y `operar` |
| 1 | Límites del paquete en nativo, documentados y con prueba | Cumplida | `diseno-criptografico.md` §2.2; prueba «límites del paquete en nativo» |
| 1 | Riesgo de mantenimiento para el 4c | Cumplida | `docs/seguridad/riesgo-de-dependencia-libsodium.md` |
| 2 | 64 MiB y 8 pasadas; vectores regenerados | Cumplida | `src/cripto/parametros.ts`, `src/cripto/vectores.json` |
| 2 | Escrito que son provisionales | Cumplida | Comentario de `ARGON2ID`; diseño §3.2; pasos del propietario, paso 7 |
| 2 | Diagnóstico mide la derivación sin mostrar claves | Cumplida | `src/app/diagnostico.tsx`, botón `medir-derivacion` |
| 3 | 256 bits, 14 grupos de 4 | Cumplida | `src/cripto/parametros.ts` |
| 3 | Detección de erratas | Cumplida | `src/cripto/index.ts`, `secretoDelCodigo` |
| 3 | Guardar o imprimir | Cumplida | `src/app/cuenta-de-usuario.tsx`, botón `guardar-codigo` |

**Una corrección sobre lo que dije el 18/11:** el segundo límite del paquete no es que
BLAKE2b «solo funcione con bytes». Admite texto como mensaje; lo que no admite es texto
como *clave*. El módulo pasa bytes en los dos.

**Mecanismo del parche:** se aplica tras `npm install` o `npm ci` (script `postinstall`) y
en cada `expo prebuild` (plugin). Probado `npm ci` desde cero en una carpeta aparte: deja el
fichero con la huella parcheada. Con el fichero alterado, se niega. Añadido: una prueba de
`npm run check` comprueba la huella del paquete instalado, así que GitHub también lo vigila.

## 4. Biblioteca

- libsodium 1.0.22. En iOS, `react-native-libsodium` 1.7.0; en pruebas y web,
  `libsodium-wrappers-sumo` 0.8.4.
- **iOS:** compilado para el simulador; la biblioteca nativa da los mismos resultados que
  los vectores.
- **Web:** la misma libsodium en WebAssembly es la que corre en las pruebas (Node). **En un
  navegador, NO DEMOSTRADO.**
- **Android:** NO DEMOSTRADO. Sin compilar.

## 5. Argon2id

- 64 MiB (67.108.864 bytes), 8 pasadas, paralelismo 1, Argon2id v1.3.
- Referencia: OWASP Password Storage Cheat Sheet, que da como mínimos 19 MiB con 2 pasadas o
  46 MiB con 1.
- Tiempo medido en el simulador con la biblioteca nativa: **244–298 ms**. En Node con
  WebAssembly: unos 320 ms. **Es el procesador del Mac, no el de un iPhone.**
- **Queda por debajo del medio segundo que pedía el encargo original**, en el Mac. En un
  teléfono tardará más; no se sabe cuánto. Son provisionales por decisión del dueño.

## 6. Hecho por fase

| Fase | Qué | Commit |
|---|---|---|
| 0 | Baseline y paquetes de Expo al día (A-14) | `d8fbd96` |
| 1 | Diseño criptográfico y riesgo de la dependencia | `2fab482` |
| 2 | Módulo criptográfico: en JavaScript (`a089605`) y cerrado en nativo, con parche y autocomprobación | `33b3930` |
| 3 | Esquema remoto con RLS y pruebas de aislamiento | `4db59ce` |
| 4 | Cuenta en la app | `5d96bc6` |
| 5 | Capturas | `e4bf40d` |
| 6 | Documentación e informe | el commit «fase 6» |

**Dependencias añadidas:** `react-native-libsodium 1.7.0`, `expo-secure-store ~58.0.3`; de
desarrollo, `supabase ^3.2.0` y `libsodium-wrappers-sumo 0.8.4`. Ninguna otra.

## 7. Pruebas

- `npm run check`: pasa entero. Antes 954 en 35 suites; ahora **1.092 en 38**.
- **Antigua tocada: una.** `seguridad.test.tsx`, la que fija la lista completa de
  dependencias: se le añadieron las dos nuevas. Aceptada por el dueño.
- **Remotas, contra la instancia local: 41 de 41.** 33 de aislamiento y 8 de la cuenta con
  el cliente real de Supabase y la red espiada. Se repiten con `npx supabase start`,
  `npx supabase db reset` y `npm run test:remoto`.
- Las del apartado 8 del encargo están todas. Dónde: criptografía, en
  `src/cripto/__tests__/cripto.test.ts`; «lo que nunca debe salir», en
  `src/pruebas/__tests__/cuenta.test.ts` y `supabase/pruebas/cuenta.test.ts`; aislamiento,
  en `supabase/pruebas/aislamiento.test.ts`; cuenta, en los dos ficheros de cuenta y en
  `cuentaPantalla.test.tsx`.

## 8. Prebuild y compilación

- `expo prebuild --clean`: correcto. Entitlements solo con el grupo de apps, **sin
  `aps-environment`**. Identificador y esquema sin cambios.
- Compilación para el simulador: correcta, 0 errores, tres veces (la última con el plugin de
  caché).
- Autocomprobación en el simulador con la biblioteca nativa: **correcta**.

## 9. Casos límite

| Caso | Resultado |
|---|---|
| Alta con correo ya registrado | Mismo mensaje que cualquier rechazo; no confirma si existe |
| Alta interrumpida entre crear el usuario y guardar las claves | Las claves solo se guardan tras confirmar el código. Al reintentar con la misma contraseña, el alta se reanuda con un código nuevo. Quien no sabe la contraseña no puede terminarla |
| Sin conexión en alta, confirmación, inicio y borrado | «Sin conexión» y nada a medias. Cerrar sesión funciona sin red |
| Servidor que no contesta | Corta a los 15 segundos |
| Sin conexión con la sesión caducada, al abrir la app | La cuenta sigue abierta y la clave intacta |
| Autocomprobación fallida | Cuenta desactivada con su explicación; no se pide nada al servidor |
| Sin `.env` | «La cuenta no está disponible…»; el resto de la app igual |
| Borrado y nueva alta con el mismo correo | Funciona, con claves nuevas |
| Con el bloqueo activo | Cuenta queda detrás del bloqueo |
| Código con una errata en cualquiera de sus 56 símbolos | Se detecta |

## 10. Capturas

Trece en `docs/capturas/b4b1/`, todas miradas: Cuenta sin sesión, alta, código de
recuperación, confirmación, sesión iniciada y borrado, en claro y en oscuro, y Diagnóstico.
Los códigos que se ven son de una cuenta de ejemplo de la instancia local, ya borrada.

El simulador no deja tocar: el flujo se accionó con un guion temporal que llamaba a las
mismas funciones que los botones. Ese código no está en la rama. **La captura de
Diagnóstico es anterior al último cambio de esa pantalla**: sigue mostrando el mensaje
antiguo de la conexión. La parte nueva tiene prueba.

## 11. Decisiones tomadas por mi cuenta

1. **Defecto encontrado y corregido: la caché de red de iOS.** iOS guardaba en disco, fuera
   del llavero, las respuestas del inicio de sesión con los tokens. Visto en el simulador.
   Corregido con un plugin propio, `plugins/sin-cache-de-red.js`, que deja esa caché sin
   disco. Verificado: tras alta, cierre e inicio, ninguna coincidencia. Añade dos líneas al
   `AppDelegate` en el prebuild.
2. **Diagnóstico rehecho en su parte de conexión** (hallazgo A-12): ya no muestra el mensaje
   interno del servidor ni lee una tabla de prueba que no existe; dice si conecta y si el
   esquema está aplicado. Te sirve para comprobar el paso 5.
3. **Las claves solo se guardan en el servidor al confirmar el código.** Así nunca queda una
   cuenta cuyas claves dependan de un código que nadie vio.
4. **Alta con un correo existente y la contraseña correcta inicia sesión.** Hace falta para
   reanudar un alta interrumpida.
5. **El correo de la cuenta abierta se guarda en el llavero**, junto a la clave.
6. **La sesión no se renueva sola en segundo plano.**
7. **Contraseña y correo se normalizan (NFKC)** antes de derivar, para que den lo mismo en
   cualquier teclado.
8. **Datos autenticados con el uso del sobre:** un sobre no se abre para otra cosa.
9. **`expo install --fix` añadió el plugin `expo-sqlite` a `app.json`; lo revertí.**
10. **Arranqué Docker Desktop** el 21/11, que estaba parado.

Desacuerdos con el apartado 3 del encargo: ninguno que impida nada. Dos avisos:

- **D-c (sal derivada del correo)** es una cesión real: quien conozca un correo puede
  precalcular contraseñas para esa persona antes de robar nada.
- **Los parámetros de Argon2id quedan cortos de tiempo** en el Mac frente al objetivo del
  encargo.

## 12. Riesgos que quedan, sin suavizar

1. Quien obtenga los sobres del servidor puede probar contraseñas sin límite. La defensa es
   la contraseña y un Argon2id provisional y bajo. Una contraseña débil caerá.
2. La subclave de autenticación equivale a la contraseña para entrar.
3. La sal es predecible.
4. Sin confirmación de correo, cualquiera puede ocupar un correo ajeno.
5. La biblioteca nativa de cifrado lleva un parche propio y sus autores no responden.
6. Nadie ajeno al proyecto ha revisado el diseño.
7. La base local sigue sin cifrar. La cuenta no protege hoy ningún dato financiero.
8. **Quien olvide la contraseña no puede hacer nada todavía**: la recuperación con el código
   no está construida. El código se entrega, pero aún no sirve.
9. En web, el cifrado de extremo a extremo no protege de quien controle el alojamiento.
10. JavaScript no garantiza el borrado de la contraseña de la memoria.

## 13. Limitaciones y NO DEMOSTRADO

- Nada en el iPhone. Nada en Android ni en un navegador.
- Nada contra el proyecto remoto: ni las migraciones, ni la cuenta, ni sus límites de
  intentos.
- El tiempo de Argon2id en un teléfono.
- Los atributos reales del llavero en un iPhone.
- La hoja de compartir del código (Imprimir, Guardar en Archivos): probada la llamada, no
  vista.
- Tocar la pantalla: el flujo se accionó por guion.
- Que no se pueda salir de la pantalla del código con el gesto de volver: lo desactiva una
  opción de la pantalla, con prueba de que se pide; el gesto no se ha intentado.
- VoiceOver.
- El hueco del parche: reinstalar con `--ignore-scripts` y compilar sin prebuild. La
  compilación falla, no pasa en silencio.

## 14. Pasos del propietario

Completos en `docs/seguridad/pasos-del-propietario-4b1.md`. En corto:

1. Mirar qué rama despliega la integración con GitHub.
2. Crear `.env` con la URL y la clave pública.
3. Desactivar «Confirm email».
4. `npx supabase login`, `link`, `db push --dry-run` y, si enseña una sola migración,
   `db push`.
5. Comprobar en el panel que las dos tablas tienen RLS.
6. Compilar y pasar la lista de 13 comprobaciones en el simulador o el iPhone.
7. Medir Argon2id y fijar los parámetros antes de la primera cuenta real.

Nunca copiar fuera del panel: la clave de servicio, la contraseña de la base de datos ni un
token de acceso.

## 15. Te toca decidir

1. Aplicar las migraciones a mano o por la integración. Recomiendo a mano.
2. Los parámetros definitivos de Argon2id, con tus medidas.
3. Si aceptas el plugin de la caché de red (decisión 1 del apartado 11). Recomiendo que sí.
4. Cuándo borrar el stash de respaldo.
