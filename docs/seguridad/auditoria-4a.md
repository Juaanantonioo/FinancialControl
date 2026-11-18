# Auditoría de seguridad · bloque 4a

Fecha: 18/11/2026. Código auditado: rama `b3c-apariencia`, commit `781b0c7` (antes de
cualquier cambio de este bloque). Los cambios que corrigen hallazgos se anotan en el
apartado 7.

## 1. Estándar y alcance

- **Estándar:** OWASP MASVS **v2.1.0** (publicada el 18/01/2024; es la última versión
  publicada a 18/11/2026 según `github.com/OWASP/masvs/releases/latest` y `mas.owasp.org/MASVS`).
  Tiene 24 controles en 8 grupos: STORAGE, CRYPTO, AUTH, NETWORK, PLATFORM, CODE,
  RESILIENCE y PRIVACY. Los enunciados de este documento están resumidos en español; el
  texto oficial está en la web citada.
- **Alcance:** la app de iPhone tal como está en el repositorio. No hay cuentas ni
  sincronización: los controles de red y de autenticación remota se evalúan solo en lo que
  existe hoy.
- **Fuera de alcance:** el proyecto remoto de Supabase (no se ha tocado ni consultado),
  Android y web.
- **Dónde se comprobó:** lectura del código, órdenes de `git` y `npm`, la carpeta `ios/`
  generada por `expo prebuild` y el contenedor de la app en el simulador (iPhone 17,
  datos de ejemplo). **Nada se ha comprobado en un iPhone físico.**

Cada afirmación va marcada como **HECHO** (observado, con su evidencia), **HIPÓTESIS**
(razonado pero no observado) o **NO DEMOSTRADO** (no se pudo comprobar; se dice qué haría
falta).

## 2. Resumen

No hay hallazgos críticos ni altos. Hay 5 medios, 7 bajos y 8 informativos.

| Id | Hallazgo | Control | Gravedad | Destino |
|---|---|---|---|---|
| A-01 | La base de datos local no está cifrada por la app | STORAGE-1 | Media | Va a 4b |
| A-02 | La base de datos y las preferencias entran en las copias de seguridad de iOS | STORAGE-2 | Media | Va a 4b |
| A-03 | No hay bloqueo de la app | AUTH-2, AUTH-3 | Media | Se corrige en 4a |
| A-04 | El widget y los avisos muestran importes y comercios con el iPhone bloqueado | STORAGE-2, PLATFORM-3 | Media | Se corrige en 4a (modo privado) |
| A-05 | La vista del selector de apps muestra datos y queda guardada en disco | STORAGE-2, PLATFORM-3 | Media | Se corrige en 4a |
| A-06 | Los parámetros de ruta no pasan una validación común | CODE-4, PLATFORM-1 | Baja | Se corrige en 4a |
| A-07 | Un enlace puede rellenar el formulario de un fijo con textos de fuera | CODE-4, PLATFORM-1 | Baja | Se corrige en 4a |
| A-08 | Las acciones de Atajos no quitan los caracteres de control | CODE-4 | Baja | Se corrige en 4a |
| A-09 | La ruta que trae un aviso tocado se abre sin lista de rutas permitidas | CODE-4, PLATFORM-1 | Baja | Se corrige en 4a |
| A-10 | La cola de Atajos guarda importe, comercio y tarjeta en claro hasta abrir la app | STORAGE-1 | Baja | Riesgo aceptado hasta 4b |
| A-11 | El dato del widget queda en claro en el contenedor compartido | STORAGE-1 | Baja | Se reduce en 4a (modo privado); el resto, aceptado |
| A-12 | Diagnóstico muestra el mensaje de error interno tal cual | STORAGE-2 | Baja | Va a 4b |
| A-13 | 20 avisos moderados de `npm audit`, todos en herramientas de compilación | CODE-3 | Informativa | Riesgo aceptado |
| A-14 | Cuatro paquetes de Expo van una revisión por detrás | CODE-3 | Informativa | Fuera de 4a; actualizar aparte |
| A-15 | `PRAGMA user_version` se escribe con interpolación | CODE-4 | Informativa | Riesgo aceptado |
| A-16 | Más consultas montan SQL con plantillas, siempre con fragmentos fijos | CODE-4 | Informativa | Riesgo aceptado |
| A-17 | La clave pública de Supabase viaja en la app | NETWORK-1, AUTH-1 | Informativa | Va a 4b (RLS) |
| A-18 | Sin detección de dispositivo modificado ni de manipulación | RESILIENCE-1 a 4 | Informativa | Riesgo aceptado |
| A-19 | No hay mecanismo para obligar a actualizar | CODE-2 | Informativa | Va a 4c (publicación) |
| A-20 | Sin exportación ni borrado de datos, ni política de privacidad | PRIVACY-3, PRIVACY-4 | Informativa | Va a 4b y 4c |

## 3. Confirmación de los hechos de partida (H1 a H8)

| | Hecho del encargo | Resultado |
|---|---|---|
| H1 | Sin secretos en el repositorio ni en el historial; `.env` excluido; solo clave pública | **Confirmado** (apartado 6.1) |
| H2 | La app no envía datos financieros; la única llamada de red es la de Diagnóstico | **Confirmado** (apartado 5) |
| H3 | La base de datos local no está cifrada por la app | **Confirmado** (A-01) |
| H4 | No hay bloqueo de la app | **Confirmado** (A-03) |
| H5 | Widget y aviso de captura muestran importes y comercios | **Confirmado**, y también los avisos que programa la app (A-04) |
| H6 | Catorce pantallas leen parámetros de ruta; el esquema es invocable por otra app | **Confirmado**: catorce ficheros (apartado 4.2) |
| H7 | La única sentencia SQL con interpolación es el `PRAGMA user_version` | **Confirmado con matiz**: es la única que interpola un *valor*. Hay otras siete que interpolan *fragmentos fijos* de SQL (A-16) |
| H8 | Sin `console.log` ni portapapeles en `src/` | **Confirmado**; tampoco `print`, `NSLog` ni `os_log` en `app-intents/` |

## 4. Hallazgos

### 4.1 Almacenamiento (MASVS-STORAGE)

**Ficheros que crea la app.** HECHO, observado en el contenedor de la app del simulador con
`xcrun simctl get_app_container … data` y `find`:

| Fichero | Contenido | ¿Entra en la copia de seguridad de iOS? |
|---|---|---|
| `Documents/SQLite/financialcontrol.db` | Toda la base de datos financiera | Sí |
| `Documents/SQLite/ExpoSQLiteStorage` | Almacén de clave y valor: preferencias | Sí |
| `Library/Preferences/es.juanantonio.financialcontrol.plist` | Preferencias del sistema y la cola de Atajos | Sí |
| Contenedor de grupo `group.es.juanantonio.financialcontrol`, `Library/Preferences/….plist` | El dato que pinta el widget | Sí |
| `Library/SplashBoard/Snapshots/…ktx` | Imagen de la app para el selector de apps | No |
| `Library/Caches/…/Cache.db`, `Library/HTTPStorages/…` | Caché de red del sistema | No (Caches); HTTPStorages sí |
| `Library/Saved Application State/…` | Estado de escenas de iOS | No |

Que `Documents/` y `Library/Preferences/` entran en las copias de iCloud y de Finder, y que
`Library/Caches/` no, es el comportamiento documentado por Apple. **NO DEMOSTRADO** con una
copia real: haría falta hacer una copia del iPhone y abrirla. Ningún fichero está marcado
como excluido de la copia (HECHO: no hay ninguna llamada a `isExcludedFromBackup` en el
código ni en las bibliotecas usadas para estos ficheros).

**A-01 · La base de datos local no está cifrada por la app.** Media.
- HECHO: `src/datos/bdExpo.ts:11` abre la base con `SQLite.openDatabaseAsync(nombre)` sin
  clave. El fichero del simulador se abre con `sqlite3` sin pedir nada.
- HIPÓTESIS: en un iPhone con código, iOS cifra el fichero con la protección de datos del
  sistema en su clase por defecto, que lo deja legible desde el primer desbloqueo tras
  encender. NO DEMOSTRADO: haría falta leer el atributo de protección del fichero en el
  iPhone.
- Gravedad media y no alta: leer el fichero exige acceso físico al iPhone desbloqueado, un
  iPhone sin código, o una copia de seguridad (A-02). No hay vía remota.
- Destino: **va a 4b** (decisión D-b). Diseño en `modelo-de-amenazas.md`, apartado 4.

**A-02 · Los datos entran en las copias de seguridad de iOS.** Media.
- HECHO: los cuatro primeros ficheros de la tabla están en rutas que iOS copia.
- Consecuencia: una copia de Finder sin cifrar contiene toda la base de datos en claro. La
  copia de iCloud la cifra Apple, que conserva la clave salvo que la persona active la
  protección avanzada de datos.
- No se excluye la base de la copia a propósito: hoy la copia de iOS es la **única** copia
  de los datos que existe. Excluirla cambiaría una fuga posible por una pérdida segura.
- Destino: **va a 4b**. Con la base cifrada con SQLCipher, lo que entra en la copia es
  contenido cifrado.

**A-10 · La cola de Atajos guarda la captura en claro.** Baja.
- HECHO: `node_modules/expo-app-intents/ios/AppIntentInvocationStore.swift:24` usa
  `UserDefaults.standard`. Cada ejecución de «Registrar pago» o «Añadir gasto» deja ahí
  importe, comercio, tarjeta u origen como texto, hasta que la app se abre y la vuelca
  (`src/estado/colaNativa.ts:34`). El máximo es de 100 entradas (línea 15 del mismo fichero).
- Gravedad baja: mismos requisitos de acceso que A-01, menos datos y durante menos tiempo.
- Destino: **riesgo aceptado hasta 4b**, porque el almacén es de la biblioteca y cifrarlo
  exigiría criptografía que este bloque no implementa. 4b debe decidir si la cola se cifra.

**A-11 · El dato del widget queda en claro en el contenedor compartido.** Baja.
- HECHO: el fichero de preferencias del grupo contiene la clave
  `__expo_widgets_Disponible_timeline` con la cifra ya escrita («83,01 €» en los datos de
  ejemplo), el detalle y la fecha. Lo escribe `Disponible.updateSnapshot` desde
  `src/estado/widget.ts:95`.
- Es una sola cifra agregada, no hay movimientos ni comercios.
- Destino: **se reduce en 4a**: con el modo privado la app deja de enviar la cifra. Sin
  modo privado, **riesgo aceptado**: un widget que enseña un número necesita tenerlo.

**A-05 · La vista del selector de apps muestra datos.** Media.
- HECHO: la app no cubre su contenido al pasar a segundo plano (no hay ningún uso de
  `AppState` para eso en `src/`). iOS guarda la imagen en
  `Library/SplashBoard/Snapshots/` (dos ficheros `.ktx` en el simulador).
- Consecuencia: quien abra el selector de apps ve la última pantalla, con sus cifras.
- Destino: **se corrige en 4a** (cubierta con el modo privado o el bloqueo activos).

**A-12 · Diagnóstico muestra el mensaje de error interno.** Baja.
- HECHO: `src/lib/supabase.ts:49` y `:52` devuelven `error.message`, y
  `src/estado/Datos.tsx:76` guarda `e.message` del arranque de la base; la pantalla
  Diagnóstico los pinta. Pueden contener nombres de tabla o de fichero.
- Solo se ven en una pantalla técnica de Ajustes y no se envían a ningún sitio.
- Destino: **va a 4b**, que rehace esa pantalla al introducir las cuentas.

**Registros y caché.** HECHO: no hay `console.*`, `print`, `NSLog` ni `os_log` en `src/`,
`app-intents/` ni `plugins/` (`grep -rnE "console\.|print\(|NSLog|os_log"`). La tabla
`cfurl_cache_response` de `Cache.db` está vacía en el simulador. No se usa el portapapeles.
Los campos de texto no guardan contraseñas ni datos de tarjeta; el teclado puede aprender
nombres de comercio (HIPÓTESIS, comportamiento normal de iOS; solo dos campos desactivan la
autocorrección).

### 4.2 Entradas externas (MASVS-CODE-4, MASVS-PLATFORM-1)

**A-06 · Parámetros de ruta sin validación común.** Baja.

HECHO, leído en cada fichero. «Se usa tal cual» significa que el texto llega como parámetro
de una consulta SQL **parametrizada**: no puede alterar la consulta, solo no encontrar nada.

| Pantalla | Parámetro | Qué acepta hoy | Con un valor malformado |
|---|---|---|---|
| `movimiento` | `id` | Cualquier texto; se usa tal cual | «Este movimiento ya no existe» |
| `movimiento` | `capturaId` | Cualquier texto | Abre el alta vacía |
| `capturas` | `id`, `cola` | Cualquier texto | No destaca ninguna |
| `cuenta` | `id` | Cualquier texto | «Esta cuenta ya no existe» |
| `detalle-de-cuenta` | `id` | Cualquier texto | «Esta cuenta ya no existe» |
| `detalle-de-cuenta` | `mes` | Validado con `esMesValido` | Mes en curso |
| `objetivo`, `objetivo-editar` | `id` | Cualquier texto | «Este objetivo ya no existe» |
| `aportacion` | `objetivoId` | Cualquier texto | «Este objetivo ya no existe» |
| `cobro` | `reglaId` | Cualquier texto | Mensaje de no encontrado |
| `cobro` | `mes` | Validado | Sin mes |
| `presupuesto` | `mes` | Validado | Mes en curso |
| `regla` | `id` | Cualquier texto | «Este fijo ya no existe» |
| `regla` | `clase` | Validado contra su lista | «fijo» |
| `regla` | `objetivoId`, `cuentaDestinoId` | Cualquier texto, **sin validar** | Queda en el formulario |
| `regla` | `nombre`, `importe` | Cualquier texto, **sin límite** | Queda escrito en el formulario |
| `valor-de-inversion` | `id`, `cuentaId` | Cualquier texto | «Este valor ya no existe» |
| `(tabs)/plan` | `seccion` | Validado contra su lista | Sección por defecto |
| `(tabs)/plan` | `mes` | Validado | Mes en curso |
| `(tabs)/analisis` | `vista` | Validado contra su lista | Vista por defecto |
| `(tabs)/analisis` | `mes`, `dia` | Validados | Se ignoran |
| `(tabs)/analisis` | `anio` | Cuatro dígitos (`0000` a `9999`) | Se ignora |
| `(tabs)/movimientos` | `categoriaId`, `cuentaId` | Cualquier texto, **sin validar** | Lista vacía con un filtro sin nombre |
| `(tabs)/movimientos` | `mes`, `dia` | Validados | Se ignoran |

- HECHO: ninguna pantalla guarda, borra ni confirma nada solo por abrirse. Toda escritura
  cuelga de un botón (`onPress`). Comprobado leyendo los `useEffect` de las catorce
  pantallas: solo leen.
- HECHO: el esquema `financialcontrol://` está declarado en `Info.plist`
  (`CFBundleURLSchemes`). Cualquier app instalada puede abrir esas direcciones.
- HIPÓTESIS: un parámetro repetido llega como lista y no como texto; el código lo trata
  como texto. No se ha visto fallar, pero no hay nada que lo impida.
- Gravedad baja: no se ha encontrado forma de leer, alterar o borrar datos con un enlace.
  El riesgo es de robustez (un valor enorme o raro) y de confusión.
- Destino: **se corrige en 4a** con una validación única.

**A-07 · Un enlace rellena el formulario de un fijo.** Baja.
- HECHO: `src/app/regla.tsx:59-60` inicia `nombre` e `importe` con lo que traiga el enlace,
  y las líneas 68 y 73 hacen lo mismo con la cuenta de destino y el objetivo.
  `financialcontrol://regla?nombre=…&importe=…` abre el formulario ya relleno.
- No se guarda nada sin que la persona pulse «Guardar», pero un enlace malicioso podría
  presentar un fijo ya escrito para que se confirme sin leerlo.
- Destino: **se corrige en 4a**: longitudes acotadas, sin caracteres de control,
  identificadores con forma de UUID.

**A-08 · Acciones de Atajos sin limpieza de caracteres de control.** Baja.
- HECHO: `app-intents/CapturaEnBruto.swift:19` recorta a 200 caracteres y quita espacios de
  los extremos; `src/dominio/captura.ts:56` hace lo mismo al importar. Ninguno quita los
  caracteres de control intermedios (saltos de línea, tabuladores, nulos).
- HECHO: el importe se interpreta en `src/dominio/captura.ts` y se rechaza si no da una
  cifra válida y positiva dentro del máximo. El origen es una lista cerrada en Swift.
- Lo que llega a la base: tres textos de hasta 200 caracteres por captura, como parámetros
  de consultas parametrizadas.
- Destino: **se corrige en 4a**, en Swift y en TypeScript.

**A-09 · Ruta de un aviso sin lista de permitidas.** Baja.
- HECHO: `src/estado/avisos.ts:139` (`destinoDelAviso`) acepta cualquier `ruta` que empiece
  por `/` y la pasa a `router.push` (línea 177).
- Los avisos los programa la propia app o su acción de Atajos; otra app no puede publicar
  avisos en su nombre (HIPÓTESIS, es la garantía de iOS). Por eso es baja.
- Destino: **se corrige en 4a**: solo las rutas que la app usa en sus avisos.

**¿Alguna URL o aviso transporta datos sensibles?** HECHO: las URL de la app solo llevan
identificadores, meses y nombres de sección; el widget usa `financialcontrol://movimiento`
y `financialcontrol://`. Los avisos sí llevan importes y nombres en su texto visible
(A-04); en sus datos ocultos llevan una ruta y sus identificadores.

### 4.3 Plataforma (MASVS-PLATFORM, MASVS-AUTH)

**A-03 · No hay bloqueo de la app.** Media.
- HECHO: no hay ninguna dependencia de autenticación local en `package.json` ni código que
  la pida. Con el iPhone desbloqueado, la app abre directamente en Inicio.
- Destino: **se corrige en 4a**.

**A-04 · Importes y comercios visibles con el iPhone bloqueado.** Media.
- HECHO: `app-intents/CapturaEnBruto.swift:46-48` pone el comercio como título y
  «importe · tarjeta» como cuerpo del aviso de captura.
- HECHO: `src/estado/avisos.ts:31` (`textoDeAviso`) pone el nombre del fijo y su importe en
  los avisos de cobro, y el exceso en los de presupuesto.
- HECHO: el widget pinta la cifra del disponible (`src/widgets/Disponible.tsx`).
- Lo que se ve en la pantalla de bloqueo depende además del ajuste «Mostrar
  previsualizaciones» de iOS. NO DEMOSTRADO en un iPhone.
- Destino: **se corrige en 4a** con el modo privado, que viene desactivado.

**Permisos y entitlements.** HECHO, leído de `ios/` tal como lo dejó el último prebuild:
- Entitlements de la app y del widget: solo `com.apple.security.application-groups` con
  `group.es.juanantonio.financialcontrol`. **Sin `aps-environment`.**
- `Info.plist`: ningún texto de permiso (`NS…UsageDescription`), ningún modo de segundo
  plano, `NSAllowsArbitraryLoads = false`, un solo esquema de URL. Los avisos locales piden
  su permiso en tiempo de ejecución y no necesitan clave en `Info.plist`.
- `app.json` no declara permisos. Coincide con lo que el código usa: avisos locales,
  Atajos y widget.
- No hay vistas web (`grep WebView` sin resultados): MASVS-PLATFORM-2 no aplica.

### 4.4 Red y criptografía (MASVS-NETWORK, MASVS-CRYPTO, MASVS-AUTH-1)

- HECHO: la única llamada de red de `src/` es `probarConexion` (`src/lib/supabase.ts:48`),
  que lee hasta cinco filas de una tabla de prueba y solo se ejecuta desde un botón de
  Diagnóstico. No envía ningún dato de la app. No hay `fetch`, `XMLHttpRequest` ni
  `WebSocket` propios. `app-intents/` no usa la red.
- HECHO: no existe fichero `.env` en la copia de trabajo, así que en esta máquina la app se
  compila sin URL ni clave y Diagnóstico responde «sin configurar».
- HECHO: el cliente se crea sin sesión persistente (`persistSession: false`).
- HECHO: la app no implementa ni usa criptografía propia. MASVS-CRYPTO no tiene nada que
  evaluar hoy; sus requisitos para 4b están en `modelo-de-amenazas.md`.
- **A-17** (informativa): `EXPO_PUBLIC_SUPABASE_ANON_KEY` viaja dentro de la app por diseño.
  Es una clave pública; lo que protege los datos es RLS. NO DEMOSTRADO que el proyecto
  remoto tenga RLS activo: no se ha consultado (decisión D-j). **Va a 4b.**
- Fijación de certificados (NETWORK-2): no hay. No aplica mientras no viajen datos.

### 4.5 Código y dependencias (MASVS-CODE)

- **CODE-1** (versión de plataforma): HECHO, iOS mínimo 17.0 (`app.json:18`).
- **A-19 · CODE-2** (forzar actualización): no hay mecanismo. Informativa; va a 4c.
- **A-13 · CODE-3**: `npm audit --omit=dev` da 20 avisos, todos moderados, ninguno alto ni
  crítico. Las dos vulnerabilidades de origen son de `glob` (GHSA-3g3m-2fjr-6pw4) y
  `minimatch` (GHSA-g3hv-75wg-m249), que llegan a través de la línea de órdenes de Expo y
  de Jest. HECHO: son herramientas que corren en el Mac al compilar y probar; no forman
  parte del código que se empaqueta en la app. El arreglo que propone npm es bajar `expo` a
  la versión 52. **Riesgo aceptado**: no afecta a la app instalada; revisar al subir de SDK.
- **A-14 · CODE-3**: `npx expo install --check` pide una revisión más de `expo` (58.0.26),
  `expo-router` (58.0.32), `expo-sqlite` (58.0.18) y `jest-expo` (58.0.15). Informativa.
  No se actualiza aquí porque este bloque solo admite una dependencia nueva.
- **A-15 · CODE-4**: `src/datos/migraciones.ts:264` escribe
  `PRAGMA user_version = ${Math.trunc(migracion.version)}`. HECHO: el valor es el número de
  versión de una lista escrita en el propio fichero, pasado por `Math.trunc`. SQLite no
  admite parámetros en un `PRAGMA`. Ningún dato de fuera llega ahí. **Riesgo aceptado**;
  además, este bloque no puede tocar las migraciones.
- **A-16 · CODE-4**: otras plantillas con `${…}` en `src/datos/`: `capturas.ts:319` (genera
  tantos `?` como estados), `categorias.ts:72-73`, `cuentas.ts:78`, `objetivos.ts:120` y
  `:339` (añaden o no un fragmento fijo), `movimientos.ts:341` (une condiciones fijas) y
  `migraciones.ts` (columnas comunes). HECHO: en todas, lo interpolado es SQL escrito en el
  código; los valores van siempre en la lista de parámetros. **Riesgo aceptado.**
- Secretos: apartado 6.1.

### 4.6 Resistencia y privacidad (MASVS-RESILIENCE, MASVS-PRIVACY)

- **A-18**: no hay detección de dispositivo modificado, de depuración ni de manipulación,
  ni ofuscación. Informativa y **riesgo aceptado**: MASVS reserva estos controles para apps
  que protegen algo frente a su propio usuario; aquí los datos son de quien usa el iPhone.
- **PRIVACY-1 y 2**: HECHO, la app no pide ningún permiso salvo avisos, no incluye
  analítica, publicidad ni identificadores, y no envía nada (lista de dependencias de
  `package.json`: ninguna de seguimiento).
- **A-20 · PRIVACY-3 y 4**: no hay política de privacidad, exportación ni borrado de datos.
  Informativa hoy, porque no hay cuenta ni datos fuera del iPhone. **Va a 4b** (exportación
  y borrado de cuenta) **y a 4c** (política y ficha de privacidad).

## 5. Cobertura por control de MASVS v2.1.0

| Control | Enunciado resumido | Resultado |
|---|---|---|
| STORAGE-1 | Guarda los datos sensibles de forma segura | No cumple del todo: A-01, A-10, A-11 |
| STORAGE-2 | Evita fugas de datos sensibles | No cumple: A-02, A-04, A-05, A-12. Registros y portapapeles, bien |
| CRYPTO-1, CRYPTO-2 | Criptografía y gestión de claves | No aplica hoy; requisitos para 4b |
| AUTH-1 | Autenticación remota segura | No aplica hoy; 4b |
| AUTH-2 | Autenticación local según la plataforma | No había: A-03. 4a la añade como barrera de interfaz |
| AUTH-3 | Autenticación extra en operaciones sensibles | No había: A-03 |
| NETWORK-1 | Tráfico de red seguro | Cumple en lo que existe: una sola llamada HTTPS, sin datos |
| NETWORK-2 | Fijación de identidad del servidor | No aplica hoy; pregunta abierta para 4b |
| PLATFORM-1 | Comunicación entre apps segura | Mejorable: A-06, A-07, A-09 |
| PLATFORM-2 | Vistas web seguras | No aplica: no hay |
| PLATFORM-3 | Interfaz segura | No cumple: A-04, A-05 |
| CODE-1 | Exige una versión de plataforma al día | Cumple: iOS 17 |
| CODE-2 | Puede obligar a actualizar | No: A-19 |
| CODE-3 | Componentes sin vulnerabilidades conocidas | Con avisos fuera de la app: A-13, A-14 |
| CODE-4 | Valida las entradas no fiables | Mejorable: A-06 a A-09. SQL, bien: A-15, A-16 |
| RESILIENCE-1 a 4 | Integridad, antimanipulación, antianálisis | No implementado: A-18 |
| PRIVACY-1 | Mínimo acceso a datos y recursos | Cumple |
| PRIVACY-2 | No identifica a la persona | Cumple |
| PRIVACY-3 | Transparencia | Pendiente: A-20 |
| PRIVACY-4 | Control de la persona sobre sus datos | Pendiente: A-20 |

## 6. Comprobaciones hechas y su alcance

### 6.1 Búsqueda de secretos

- **Herramienta:** `gitleaks` y `trufflehog` no están instalados. Se usaron patrones con
  `git log --all -p` y `git grep`.
- **Alcance:** las líneas añadidas en todos los commits alcanzables desde cualquier rama
  local o remota (`git rev-list --all`), y el árbol actual salvo `package-lock.json`.
- **Patrones:** tokens JWT (`eyJ….…`), claves de Supabase (`sb_secret_`, `sb_publishable_`,
  `service_role`), cabeceras de clave privada, claves de AWS, tokens de GitHub, de Slack y
  de tipo `sk-`, direcciones `….supabase.co` y asignaciones del tipo `password = "…"`,
  `secret`, `api_key` o `token` con un valor entre comillas.
- **Resultado:** HECHO, **cero coincidencias** en el historial y en el árbol. Control
  positivo: el mismo recorrido encuentra las cuatro líneas que nombran
  `EXPO_PUBLIC_SUPABASE` en `.env.example`, luego el recorrido sí lee el historial.
- HECHO: el único fichero de entorno que ha existido en el historial es `.env.example`, con
  valores de relleno. `.env` está excluido (`.gitignore:46`) y no existe en disco.
- **Límite:** una búsqueda por patrones no ve un secreto con una forma que no esté en la
  lista. No sustituye a una herramienta dedicada.
- La búsqueda se repite antes de subir la rama (apartado 7).

### 6.2 Lo que no se ha podido comprobar

- Nada en un iPhone físico.
- La clase de protección de datos real del fichero de la base.
- El contenido de una copia de seguridad real.
- La configuración del proyecto remoto de Supabase (RLS).
- Qué se ve exactamente en la pantalla de bloqueo del iPhone.

## 7. Estado tras el bloque 4a

Se completa al cerrar el bloque. Ver `docs/estado.md`, apartado 13.
