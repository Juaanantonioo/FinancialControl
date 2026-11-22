# Modelo de amenazas y requisitos de seguridad para el bloque 4b

Fecha: 18/11/2026. Documento de diseño, sin código. Acompaña a `auditoria-4a.md`.

Cada afirmación lleva una marca:

- **[HECHO]**: es así en el código de la rama `b4a-seguridad-local`.
- **[DISEÑO]**: es una propuesta para el bloque 4b. No existe todavía.

Decisión del dueño (18/11/2026): la sincronización será con **cifrado de extremo a
extremo y código de recuperación**. Está registrada en `docs/09-decisiones.md` (D11).

## 1. Activos

| Id | Activo | Dónde está hoy | Sensibilidad |
|---|---|---|---|
| AC-1 | Movimientos: importe, fecha, nombre, cuenta y categoría | [HECHO] `Documents/SQLite/financialcontrol.db` | Alta. Describen hábitos, lugares y horarios |
| AC-2 | Cuentas y saldos, valores de inversión, patrimonio | [HECHO] misma base | Alta |
| AC-3 | Fijos, presupuestos y objetivos | [HECHO] misma base | Media |
| AC-4 | Capturas de pagos: importe, comercio y nombre de tarjeta | [HECHO] misma base y, antes de abrir la app, la cola de Atajos en `UserDefaults` | Alta |
| AC-5 | Dato del widget: una cifra agregada | [HECHO] contenedor compartido del grupo de apps | Media. Con modo privado, ninguna |
| AC-6 | Texto de los avisos | [HECHO] centro de notificaciones de iOS | Media. Con modo privado, baja |
| AC-7 | Preferencias: apariencia, avisos, bloqueo, modo privado | [HECHO] almacén de clave y valor y `UserDefaults` | Baja. No son secretos |
| AC-8 | Contraseña de la cuenta | [DISEÑO] solo en la memoria del dispositivo mientras se escribe | Crítica |
| AC-9 | Claves de cifrado de la cuenta y del dispositivo | [DISEÑO] llavero de iOS | Crítica |
| AC-10 | Código de recuperación | [DISEÑO] lo guarda la persona, fuera de la app | Crítica |
| AC-11 | Correo de la cuenta y metadatos de sincronización | [DISEÑO] servidor | Media. Identifica a la persona |
| AC-12 | Clave pública de Supabase | [HECHO] dentro de la app, si existe `.env` al compilar | Ninguna: es pública por diseño |
| AC-13 | Clave de servicio de Supabase | [HECHO] no está en la app ni en el repositorio | Crítica. Nunca debe estar |

No hay datos de tarjeta completos, contraseñas bancarias ni credenciales de bancos: la app
no se conecta a ningún banco [HECHO].

## 2. Adversarios

| Id | Adversario | Qué puede hacer |
|---|---|---|
| AD-1 | Quien coge el iPhone **desbloqueado** (un conocido, un compañero) | Abrir cualquier app, ver la pantalla de inicio y los avisos, abrir el selector de apps. No conoce el código del iPhone |
| AD-2 | Quien roba el iPhone **bloqueado** | Ver la pantalla de bloqueo: widgets y avisos que iOS permita. No puede abrir apps. Con medios forenses, intentar leer el almacenamiento |
| AD-3 | Quien obtiene una **copia de seguridad** (Finder sin cifrar, un Mac compartido, o la cuenta de iCloud) | Leer todos los ficheros que la copia incluya |
| AD-4 | **Otra app** instalada en el iPhone | Abrir direcciones `financialcontrol://…`. No puede leer los ficheros de la app ni publicar avisos en su nombre (aislamiento de iOS) |
| AD-5 | Quien **intercepta la red** (wifi pública, proxy) | Leer o alterar el tráfico que no esté protegido |
| AD-6 | Quien **compromete la base de datos remota** (fuga, copia robada, fallo de configuración) | Leer todo lo que el servidor almacena |
| AD-7 | **Otro usuario autenticado** de la app | Hacer peticiones válidas con su sesión e intentar leer o escribir filas ajenas |
| AD-8 | El **operador del servicio** (el dueño del proyecto, o Supabase como proveedor) | Leer la base remota, sus copias y sus registros; cambiar la configuración |

Fuera del modelo: un iPhone con el sistema modificado y controlado por el adversario, y
quien conoce el código del iPhone. Contra ellos no hay defensa razonable desde una app.

## 3. Defensas por activo y adversario

«Hoy» es la rama de partida (`b3c-apariencia`). «4a» es lo que añade este bloque [HECHO].
«4b» es lo que deberá añadir el siguiente [DISEÑO].

### AD-1 · iPhone desbloqueado en otras manos

| Activo | Hoy | 4a | 4b |
|---|---|---|---|
| AC-1 a AC-4 (dentro de la app) | Ninguna: la app abre directamente | Bloqueo opcional con Face ID, Touch ID o código. Barrera de interfaz; no cifra | Sin cambios |
| AC-5 widget | La cifra se ve | Modo privado: «•••» | Sin cambios |
| AC-6 avisos | Importes y nombres visibles | Modo privado: textos sin importes ni nombres | Sin cambios |
| Vista del selector de apps | Muestra la última pantalla | Cubierta con bloqueo o modo privado | Sin cambios |
| Ficheros (vía un Mac de confianza) | Legibles en claro | Sin cambios | Base cifrada con SQLCipher |

Límite conocido de 4a: el bloqueo viene desactivado. Quien no lo active no tiene esta
defensa. Con esperas de 1 o 5 minutos, quien coja el iPhone dentro de ese tiempo entra.

### AD-2 · iPhone robado y bloqueado

| Activo | Hoy | 4a | 4b |
|---|---|---|---|
| AC-1 a AC-4 en disco | Protección de datos de iOS, clase por defecto (no demostrado en un iPhone) | Sin cambios | Base cifrada; la clave local en el llavero, accesible solo con el iPhone desbloqueado |
| AC-5, AC-6 en la pantalla de bloqueo | Visibles según los ajustes de iOS | Modo privado | Sin cambios |
| AC-4 en la cola de Atajos | En claro en `UserDefaults` | Sin cambios | Pregunta abierta P-7 |

### AD-3 · Copia de seguridad

| Activo | Hoy | 4a | 4b |
|---|---|---|---|
| AC-1 a AC-4 | En claro dentro de la copia | Sin cambios (decisión D-b: hoy la copia de iOS es la única copia de los datos) | La base entra cifrada; la clave local no sale del llavero del dispositivo, así que la copia sola no basta para leerla |
| AC-7 | En claro. No son secretos | Sin cambios | Sin cambios |

### AD-4 · Otra app instalada

| Activo | Hoy | 4a | 4b |
|---|---|---|---|
| Todos | Aislamiento de iOS. Los enlaces abren pantallas sin validar del todo sus parámetros | Validación única de parámetros; un enlace solo abre una pantalla; con bloqueo, el destino no se ve sin autenticarse | Si el inicio de sesión usa enlaces de vuelta, deben ser enlaces universales y no el esquema propio (P-5) |

### AD-5 · Red

| Activo | Hoy | 4a | 4b |
|---|---|---|---|
| Todos | No viaja ningún dato. Una sola llamada HTTPS de prueba | Sin cambios | Todo por TLS; y aunque TLS falle, lo que viaja ya va cifrado en el dispositivo |

### AD-6, AD-7 y AD-8 · Servidor, otros usuarios y operador

| Activo | Hoy | 4a | 4b |
|---|---|---|---|
| AC-1 a AC-4 | No están en el servidor | Sin cambios | Cifrado de extremo a extremo: el servidor solo guarda contenido cifrado. RLS en todas las tablas |
| AC-8 contraseña | No existe | No existe | Nunca sale del dispositivo |
| AC-11 correo y metadatos | No existen | No existen | Visibles para el operador: es el coste mínimo de tener cuenta. Se minimizan (P-3) |

## 4. Requisitos que el bloque 4b debe cumplir

Todo este apartado es **[DISEÑO]**. Cada requisito está redactado como una condición que
se puede comprobar, con la forma de comprobarla.

### 4.1 Cifrado de extremo a extremo

- **R-01.** El servidor solo almacena contenido cifrado en el dispositivo. *Comprobación:*
  con dos movimientos de ejemplo sincronizados, una consulta directa a cada tabla remota
  con la clave de servicio (desde fuera de la app) no devuelve ningún importe, nombre,
  comercio, categoría ni cuenta en claro.
- **R-02.** Las columnas remotas en claro se limitan a lo imprescindible para sincronizar:
  identificador de fila, identificador de usuario, marca de versión o de tiempo y marca de
  borrado. *Comprobación:* la lista de columnas en claro está escrita en la documentación y
  coincide con el esquema remoto.
- **R-03.** El cifrado es autenticado: un contenido alterado en el servidor se detecta y se
  rechaza, no se importa. *Comprobación:* prueba que modifica un byte de una fila remota y
  espera el rechazo.
- **R-04.** Toda la criptografía viene de una biblioteca auditada y mantenida. No hay
  ninguna primitiva, modo ni protocolo escritos a mano. *Comprobación:* revisión de código;
  la biblioteca y su versión figuran en `docs/09-decisiones.md` con el motivo de la elección.

### 4.2 Contraseña y claves

- **R-05.** La contraseña no sale del dispositivo. De ella se derivan, con una función de
  derivación resistente a fuerza bruta (de las recomendadas por OWASP en la fecha del
  bloque) y una sal por usuario, dos claves distintas: una de autenticación, que es lo que
  se envía al servidor, y una de cifrado, que no se envía nunca. *Comprobación:* captura del
  tráfico del alta y del inicio de sesión: la contraseña escrita no aparece en ninguna
  petición; prueba de que las dos claves son distintas y de que una no se obtiene de la otra.
- **R-06.** Los parámetros de la derivación (algoritmo, coste, sal) se guardan con la
  cuenta y tienen versión, para poder endurecerlos sin dejar a nadie fuera.
- **R-07.** Los datos no se cifran directamente con la clave derivada de la contraseña,
  sino con una clave de datos aleatoria que esa clave envuelve. Así cambiar la contraseña
  no obliga a volver a cifrar todo. *Comprobación:* prueba de cambio de contraseña que
  conserva los datos sin volver a subirlos.
- **R-08.** Las claves se guardan en el llavero de iOS, con acceso solo con el iPhone
  desbloqueado y sin migrar a otros dispositivos. **Ninguna clave queda vinculada a la
  biometría**: un cambio de cara o de huella no puede dejar a nadie sin sus datos.
  *Comprobación:* revisión de los atributos del llavero; prueba manual cambiando Face ID.
- **R-09.** Ninguna clave ni contraseña se escribe en registros, en mensajes de error ni en
  `UserDefaults`.

### 4.3 Recuperación

- **R-10.** En el alta se genera un código de recuperación con al menos 128 bits de
  aleatoriedad del sistema, se muestra una sola vez y la app exige confirmar que se ha
  guardado antes de seguir. El servidor no lo recibe.
- **R-11.** El código de recuperación permite recuperar la clave de datos sin la
  contraseña. *Comprobación:* prueba de extremo a extremo: alta, sincronización, olvido de
  la contraseña, recuperación con el código en un dispositivo limpio, y los datos aparecen.
- **R-12.** Sin contraseña y sin código de recuperación los datos del servidor son
  irrecuperables, y la app lo dice con claridad en el alta. No hay puerta trasera.
- **R-13.** Un dispositivo que conserva sus datos locales puede volver a subirlos después
  de restablecer la contraseña sin código: se crea una clave de datos nueva, se descarta lo
  remoto y se sube lo local. *Comprobación:* prueba de extremo a extremo de ese camino, sin
  pérdida de ningún movimiento local.

### 4.4 Servidor

- **R-14.** RLS activo en **todas** las tablas del esquema expuesto, con política de
  denegar por defecto. *Comprobación:* consulta al catálogo que lista las tablas sin RLS y
  devuelve cero; forma parte de las pruebas.
- **R-15.** Aislamiento por usuario probado con dos usuarios: el usuario B no puede leer,
  insertar, modificar ni borrar filas del usuario A, ni con su sesión ni sin sesión.
  *Comprobación:* pruebas automáticas contra un proyecto de pruebas, una por operación y
  por tabla.
- **R-16.** La clave de servicio nunca está en la app, en el repositorio ni en su
  historial. *Comprobación:* la búsqueda de secretos de `auditoria-4a.md` (apartado 6.1),
  repetida antes de cada subida; el paquete compilado no contiene la cadena.
- **R-17.** La app solo usa la clave pública, y con ella sola no se puede leer ninguna
  fila. *Comprobación:* petición sin sesión a cada tabla: cero filas.
- **R-18.** Todo el tráfico va por TLS. No se añade ninguna excepción de seguridad de
  transporte en `Info.plist`. *Comprobación:* `NSAllowsArbitraryLoads` sigue en `false`.
- **R-19.** El servidor limita los intentos de inicio de sesión.

### 4.5 Base de datos local

- **R-20.** La base local se cifra con SQLCipher. *Comprobación:* el fichero no se abre con
  `sqlite3` sin clave y sus primeros bytes no son la cabecera de SQLite.
- **R-21.** La clave local es aleatoria, vive en el llavero y queda además envuelta por la
  clave de la cuenta, de modo que es recuperable al cambiar de teléfono o restaurar una
  copia. *Comprobación:* prueba de restauración en un dispositivo limpio.
- **R-22.** La migración de la base existente, sin cifrar, a la cifrada no pierde datos:
  se hace sobre una copia, se verifica (número de filas por tabla y suma de importes) antes
  de sustituir la original, y si falla se conserva la original intacta. *Comprobación:*
  prueba con una base de ejemplo de cada versión de esquema publicada, y prueba de
  interrupción a mitad.
- **R-23.** Las preferencias de `kv-store` y la cola de Atajos se revisan: lo que sea dato
  financiero se cifra o deja de persistirse en claro (P-7).

### 4.6 Derechos de la persona (RGPD)

- **R-24.** Exportación: la persona obtiene todos sus datos en un formato abierto, desde la
  app y sin pedirlo a nadie. *Comprobación:* la exportación de una base de ejemplo contiene
  todas las filas de todas las tablas.
- **R-25.** Borrado de cuenta: desde la app, borra del servidor todas las filas de la
  persona y la propia cuenta. *Comprobación:* tras borrar, una consulta con clave de
  servicio no encuentra ninguna fila con su identificador.
- **R-26.** La app explica antes del alta qué se guarda en el servidor, qué puede ver el
  operador (correo y metadatos) y qué no (el contenido).

### 4.7 Lo que 4b no debe romper de 4a

- **R-27.** El bloqueo sigue siendo independiente de las claves: activarlo, desactivarlo o
  cambiar la biometría no toca ninguna clave.
- **R-28.** Con el bloqueo activo, la sincronización en segundo plano puede continuar, pero
  ninguna pantalla enseña datos sin autenticación.
- **R-29.** El modo privado sigue aplicándose a todo aviso nuevo que 4b añada (por ejemplo,
  avisos de sincronización).
- **R-30.** Todo parámetro de ruta nuevo pasa por `leerParametros`
  (`src/dominio/entradas.ts`).

## 5. Preguntas abiertas para 4b

No se resuelven aquí. Cada una con sus opciones.

**P-1. Biblioteca criptográfica.**
- a) libsodium mediante un módulo nativo. Muy auditada; añade una dependencia nativa.
- b) Las API del sistema (CryptoKit) mediante un módulo propio en Swift. Sin dependencia
  externa, pero habría que escribir y mantener el puente, y no sirve para Android.
- c) Una implementación en JavaScript auditada. Sin código nativo; más lenta, y la
  derivación de claves puede tardar demasiado.

**P-2. Función de derivación y dónde se ejecuta.**
- a) Argon2id, con los parámetros que OWASP recomiende en la fecha.
- b) scrypt.
- c) PBKDF2 con muchas iteraciones, si es lo único disponible en la biblioteca elegida.
Hay que medir el tiempo en el iPhone más antiguo admitido.

**P-3. Granularidad de lo que se cifra.**
- a) Fila a fila: cada fila remota es un contenido cifrado. Sincroniza poco cada vez;
  el servidor ve cuántas filas hay y cuándo cambian.
- b) Por lotes o por mes. Oculta más; los conflictos son más difíciles.
- c) La base entera como un solo contenido. Lo más opaco; cada cambio sube todo.

**P-4. Resolución de conflictos entre dispositivos**, con el servidor ciego al contenido.
- a) Gana la última escritura, por fila.
- b) Fusión en el dispositivo, campo a campo.
- c) Un solo dispositivo activo por cuenta en la primera versión.

**P-5. Autenticación con Supabase si la contraseña no sale del dispositivo.**
- a) Usar Supabase Auth enviando la clave de autenticación derivada como si fuera la
  contraseña.
- b) Un protocolo de conocimiento cero (por ejemplo, OPAQUE o SRP) con una función propia
  en el servidor.
- c) Enlace mágico por correo para autenticar, y la contraseña solo para cifrar.
Cada opción cambia qué puede hacer el operador y cómo es el restablecimiento.

**P-6. Formato y custodia del código de recuperación.**
- a) Palabras de una lista.
- b) Grupos de letras y cifras.
- c) Además, un PDF o una hoja para imprimir.

**P-7. La cola de Atajos y el dato del widget con la base cifrada.**
- a) Aceptar que quedan en claro: son pocos datos y duran poco.
- b) Cifrar la cola con una clave del llavero accesible con el iPhone bloqueado tras el
  primer desbloqueo, porque las acciones se ejecutan en segundo plano.
- c) Que la cola solo guarde lo mínimo y el widget, nada con modo privado (ya es así).

**P-8. Excluir o no la base de la copia de seguridad de iOS** cuando exista sincronización.
- a) Dejarla dentro: ya va cifrada.
- b) Excluirla: la copia de verdad pasa a ser el servidor.

**P-9. Fijación de certificados (MASVS-NETWORK-2).**
- a) No fijar: lo que viaja ya va cifrado de extremo a extremo.
- b) Fijar la clave pública del servidor, con plan de rotación.

**P-10. Qué pasa con quien no quiere cuenta.**
- a) La app sigue funcionando solo en local, sin cifrado de base.
- b) Solo en local, con base cifrada y clave únicamente en el llavero, aceptando que no
  sobrevive a un cambio de teléfono sin copia cifrada de iOS.
- c) La cuenta es obligatoria.

## 6. Estado tras el bloque 4b-1 (22/11/2026)

Todo este apartado es **[HECHO]** en la rama `b4b1-cuenta-y-claves`, salvo donde dice otra
cosa. El bloque 4b se partió en dos: el 4b-1 crea la cuenta, las claves y el esquema
remoto; el 4b-2 sincroniza y cifra la base local.

### 6.1 Las diez preguntas, respondidas por el dueño

| | Respuesta | Estado |
|---|---|---|
| P-1 | libsodium, con `react-native-libsodium` 1.7.0 en iOS y Android y `libsodium-wrappers-sumo` 0.8.4 en web | Hecho en iOS (simulador). El paquete necesita un parche propio para compilar: `riesgo-de-dependencia-libsodium.md`. Android y web, sin compilar |
| P-2 | Argon2id con `crypto_pwhash`: 64 MiB y 8 pasadas | Hecho. **Provisional** hasta medirlo en un iPhone y en un navegador de móvil |
| P-3 | Se cifra fila a fila | Esquema preparado (`fila_cifrada`). El cifrado de filas es del 4b-2 |
| P-4 | Gana la última escritura, por fila | Esquema preparado: `actualizada_en` la pone el servidor. Se construye en 4b-2 |
| P-5 | De la contraseña sale una clave maestra y de ella una subclave de autenticación, que es lo que recibe Supabase Auth | Hecho y probado espiando la red |
| P-6 | Grupos de letras y cifras sin caracteres ambiguos, más pantalla para guardarlo o imprimirlo | Hecho: 256 bits, 14 grupos de 4, con detección de erratas |
| P-7 | La cola de Atajos y el widget se quedan como están | Sin cambios |
| P-8 | La base local sigue dentro de la copia de iOS | Sin cambios |
| P-9 | Sin fijación de certificados | Sin cambios |
| P-10 | Sin cuenta, la app funciona solo en local y sin cifrado de base | Hecho: la pantalla Cuenta lo explica |

### 6.2 Riesgos de la auditoría

Aceptados por el dueño: **A-10, A-11, A-13, A-15, A-16 y A-18**.

| Id | Estado tras 4b-1 |
|---|---|
| A-12 (Diagnóstico mostraba el error interno) | **Corregido.** Diagnóstico explica el resultado con textos propios |
| A-14 (paquetes de Expo atrasados) | **Corregido** en la fase 0 |
| A-17 (clave pública en la app; RLS sin comprobar) | **Corregido en el esquema**, con 33 pruebas de aislamiento contra la instancia local. En el proyecto remoto, pendiente de que el dueño aplique las migraciones |
| A-01, A-02 (base local sin cifrar y dentro de las copias) | Siguen. Van al 4b-2 |
| A-19, A-20 | Siguen. Borrado de cuenta, hecho; exportación, 4b-2; política y forzar actualización, 4c |

Hallazgo nuevo de este bloque, ya corregido:

- **B-01 · iOS guardaba en su caché de red las respuestas del inicio de sesión.** Media.
  Visto en el simulador: `Library/Caches/<app>/Cache.db` contenía en claro los tokens de la
  sesión y la respuesta con la clave de datos envuelta, fuera del llavero. Esa carpeta no
  entra en las copias de seguridad, pero sí la lee quien acceda a los ficheros de la app.
  Corregido con `plugins/sin-cache-de-red.js`: la caché de red de la app no escribe en
  disco. Comprobado en el simulador tras alta, cierre e inicio de sesión: ninguna
  coincidencia. MASVS-STORAGE-2.

### 6.3 Requisitos del apartado 4

| Requisito | Estado |
|---|---|
| R-01, R-03 (el servidor solo guarda cifrado; cifrado autenticado) | **Cumplido para las claves de la cuenta.** Para las filas, 4b-2 |
| R-02 (columnas en claro mínimas) | Cumplido en el esquema: `docs/05`, apartado 4.8 |
| R-04 (biblioteca auditada, nada a mano) | Cumplido, con prueba |
| R-05 (la contraseña no sale; dos claves distintas) | Cumplido, con prueba contra un Supabase real |
| R-06 (parámetros con versión) | Cumplido: `version_de_derivacion` |
| R-07 (clave de datos aleatoria envuelta) | Cumplido. El cambio de contraseña en sí, 4b-2 |
| R-08 (claves en el llavero, sin biometría) | Cumplido. Leer los atributos reales en un iPhone: NO DEMOSTRADO |
| R-09 (claves fuera de registros y `UserDefaults`) | Cumplido, con prueba y comprobado en el simulador |
| R-10 (código de recuperación en el alta, confirmado) | Cumplido |
| R-11 (recuperar con el código) | **4b-2.** El sobre por recuperación ya se guarda y se prueba que abre |
| R-12 (sin contraseña ni código no hay recuperación, y la app lo dice) | Cumplido |
| R-13 (volver a subir tras restablecer) | 4b-2 |
| R-14, R-15 (RLS en todas las tablas; dos usuarios) | Cumplido en local. En remoto, tras aplicar las migraciones |
| R-16, R-17 (clave de servicio fuera; la pública sola no lee nada) | Cumplido |
| R-18 (TLS, sin excepciones) | Cumplido: `NSAllowsArbitraryLoads` sigue en `false` |
| R-19 (límite de intentos de inicio de sesión) | Lo pone Supabase Auth. Sus valores en el proyecto remoto: NO COMPROBADO |
| R-20 a R-23 (SQLCipher y migración de la base local) | 4b-2 |
| R-24 (exportación) | 4b-2 |
| R-25 (borrado de cuenta) | Cumplido, con prueba de que solo borra a quien lo pide |
| R-26 (explicar qué ve el servidor antes del alta) | Parcial: la pantalla explica la contraseña y que no hay sincronización. El detalle de metadatos, 4c |
| R-27 (el bloqueo no toca claves) | Cumplido |
| R-28 (con bloqueo, ninguna pantalla sin autenticar) | Cumplido para Cuenta, con prueba |
| R-29 (modo privado en avisos nuevos) | No aplica: este bloque no añade avisos |
| R-30 (parámetros de ruta por `leerParametros`) | Cumplido: la pantalla nueva no lee parámetros |
