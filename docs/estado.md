# Estado de los hitos H0, H1 y H2

Última actualización: 16/11/2026.

Leyenda: **HECHA** (con evidencia), **PENDIENTE DEL USUARIO**, **BLOQUEADA** (con motivo),
**PARCIAL** (parte hecha y parte pendiente). Lo que no se ha podido demostrar se marca
**NO DEMOSTRADO**.

## 1. Baseline (antes de modificar nada, 15/11/2026)

| Dato | Valor |
|---|---|
| Rama | `main` |
| `git status` | `M README.md` y `?? docs/` (planificación sin confirmar) |
| Commit | `6c2fad7 Initial commit` |
| macOS | 27.2 (26B123) |
| Xcode | 27.2 (27B52) en `/Applications/Xcode.app`. `xcode-select -p` apunta a `/Library/Developer/CommandLineTools`, no a Xcode |
| Node | 22.20.0 |
| Gestor de paquetes | npm 11.6.4. Sin pnpm, yarn ni bun |
| CocoaPods | No instalado |
| Espacio libre | 31 GB |
| Remoto | `origin` en GitHub. No se ha hecho ningún push |

Con el permiso del usuario, la planificación se confirmó en `main` antes de empezar:
`acd3b38 Add planning docs and update README`.

### Versiones estables consultadas en el registro de npm el 15/11/2026

Fuente: `npm view <paquete> dist-tags.latest`, que lee https://registry.npmjs.org.

| Biblioteca | Versión estable | Versión instalada | Nota |
|---|---|---|---|
| expo (SDK) | 58.0.25 | ~58.0.25 | SDK 58 |
| react-native | 0.88.1 | 0.88.1 | |
| react | 19.3.1 | 19.3.0 | La que fija la plantilla de Expo SDK 58 |
| expo-router | 58.0.31 | ~58.0.31 | |
| expo-sqlite | 58.0.17 | ~58.0.17 | Base de datos local |
| expo-crypto | 58.0.8 | ~58.0.8 | Genera los UUID |
| expo-localization | 58.0.5 | ~58.0.5 | Separador decimal de la región |
| expo-notifications | 58.1.9 | ~58.1.9 | Permiso de avisos. Sin su plugin de configuración (ver 3.2) |
| expo-app-intents | 0.5.17 | **0.5.17 exacta** | En alfa. Solo en la rama de H1 |
| @supabase/supabase-js | 2.119.0 | ^2.119.0 | |
| typescript | 7.0.2 | ~6.0.3 | La que fija la plantilla de Expo SDK 58 |
| jest / jest-expo | 30.5.2 / 58.0.14 | ^30.5.2 / ^58.0.14 | |
| eslint / eslint-config-expo | 10.15.0 / 58.0.4 | ^9.39.5 / ^58.0.4 | `expo install` elige ESLint 9, la compatible con el SDK |
| prettier | 3.10.1 | ^3.10.1 | |
| @testing-library/react-native | 14.1.0 | ^14.1.0 | Solo en la rama de H2 |
| CocoaPods | 1.17.0 (Homebrew) | 1.17.0 | Instalado en esta sesión |

`npx expo-doctor` (15/11/2026): 20 de 20 comprobaciones correctas.

`expo-widgets` no se ha instalado: el widget es de H3.

## 2. H0 · Preparación — rama `h0-preparacion`

| Tarea | Estado | Evidencia o motivo |
|---|---|---|
| T-001 Decisiones D1 a D5 | HECHA | `docs/09-decisiones.md` |
| T-002 Xcode activo | PENDIENTE DEL USUARIO | Xcode 27.2 está instalado y compila, pero el directorio activo es Command Line Tools y no hay cuenta en Xcode. Cambiarlo pide tu contraseña. Mientras tanto se ha compilado con la variable `DEVELOPER_DIR`. Pasos en el apartado 5 |
| T-003 Lista de medios | PENDIENTE DEL USUARIO | `docs/notas/h0-medios.md`: 1 de 6 preguntas respondida |
| T-004 Proyecto de Expo e identificador | PARCIAL | Hecho: proyecto con identificador `es.juanantonio.financialcontrol`, iOS 17.0 mínimo. La app se compila sin errores (`** BUILD SUCCEEDED **`) y se abre en el simulador iPhone 17 con iOS 27.2. **Pendiente del usuario**: instalarla en el iPhone, que es lo que pide el criterio. Commit `695700e` |
| T-005 Capacidades con cuenta gratuita | PENDIENTE DEL USUARIO | NO DEMOSTRADO para las cuatro. No hay ninguna cuenta de Apple en Xcode, así que no se puede firmar para un iPhone. Ver la tabla de 2.1 |
| T-006 Formato, análisis y comprobación | PARCIAL | Hecho: `npm run check` (Prettier, ESLint, TypeScript y Jest) y el flujo de GitHub `.github/workflows/comprobacion.yml`, más la plantilla de incidencias. Evidencia: un fichero con error de formato hace que `npm run check` termine con código 1, y con código 0 al quitarlo. **Pendiente**: proteger `main` y ver el flujo ejecutarse en GitHub. Ambas cosas exigen un push y cambiar la configuración del remoto, que necesitan tu permiso. Commit `ded944f` |
| T-007 Atajos actuales | PENDIENTE DEL USUARIO | `docs/notas/atajos-actuales.md` indica qué necesito |
| T-008 Supabase de desarrollo | PARCIAL | Hecho: cliente con la clave pública leída de `.env`, pantalla de diagnóstico que lee la tabla `prueba`, `.env` excluido de git **antes** de existir y `.env.example` sin valores. Búsqueda de claves en el repositorio: 0 coincidencias. **Pendiente del usuario**: crear el proyecto en una región de la UE. Hasta entonces la lectura de la tabla es NO DEMOSTRADO. Commit `ba76cbb` |

### 2.1 T-005: qué comprobar con la cuenta gratuita

| Capacidad | Resultado | Cómo se comprueba |
|---|---|---|
| App Intents | NO DEMOSTRADO | Instalar la rama de H1 en el iPhone y buscar "Registrar pago" en Atajos |
| App Groups | NO DEMOSTRADO | Añadir la capacidad en Xcode › Signing & Capabilities y ver si firma |
| Widgets | NO DEMOSTRADO | Se comprueba en H3, al crear la extensión |
| Inicio de sesión con Apple | NO DEMOSTRADO | Añadir la capacidad "Sign in with Apple" y ver si firma |

La vía elegida para H1 no necesita App Groups (apartado 3.2), así que un "no" en esa
capacidad no bloquea el spike.

## 3. H1 · Spike de captura con Apple Pay — rama `h1-spike-apple-pay`

| Tarea | Estado | Evidencia o motivo |
|---|---|---|
| T-010 Acción "Registrar pago" | PARCIAL | Ver 3.1 |
| T-011 Almacén compartido mínimo | PARCIAL | Ver 3.1 |
| T-012 Aviso local desde la acción | PARCIAL | Ver 3.1 |
| T-013 Automatización "Transacción" | PENDIENTE DEL USUARIO | `docs/spike-a/instrucciones.md`, apartado 2 |
| T-014 Medición de 20 pagos en 7 días | PENDIENTE DEL USUARIO | `docs/spike-a/hoja-de-control.csv` preparada, con 0 filas |
| T-015 Vía por notificación (iOS 27) | PENDIENTE DEL USUARIO | Instrucciones, apartado 3 |
| T-016 Atajo compartido con automatización | PENDIENTE DEL USUARIO | NO DEMOSTRADO. Un atajo solo se crea y se comparte desde un iPhone con tu cuenta de iCloud. Instrucciones, apartado 5 |
| T-017 Informe del spike | BLOQUEADA | No hay datos reales. No se redacta ni se estima |

> **Actualización del 17/11/2026 (rama `b3-entrada-rapida`).** El spike queda integrado en
> la app: la carpeta `app-intents/` con la acción «Registrar pago», la biblioteca
> `expo-app-intents` (ahora 0.5.18), la cola persistente y el aviso local lanzado desde
> Swift. La pantalla «Capturas del spike» desaparece: la cola se vuelca en la tabla
> `captura` y se ve en la bandeja. Lo que este apartado marcaba como NO DEMOSTRADO sigue
> igual: nada de ello se ha visto en un iPhone. La medición del spike A (T-013 a T-017)
> sigue pendiente del usuario. Detalle en el apartado 10.

### 3.1 Qué está hecho y qué no en T-010, T-011 y T-012

Compilación de la rama el 16/11/2026: `Build Succeeded`, 0 errores, para el simulador
iPhone 17 con iOS 27.2. Pruebas automáticas de la rama: 11 correctas en 2 ficheros.

| Tarea | Demostrado | NO DEMOSTRADO (necesita un iPhone o tocar la pantalla) |
|---|---|---|
| T-010 | El Swift compila. iOS extrae la acción al compilar: el fichero `Metadata.appintents/extract.actionsdata` de la app contiene `RegistrarPagoIntent` con el título "Registrar pago", los parámetros Importe, Comercio, Tarjeta y Origen (los cuatro opcionales) y `openAppWhenRun = false`. Ese fichero es el que lee la app Atajos | Que la acción **aparezca en Atajos** al buscar el nombre de la app, que es el criterio. Probable, pero no visto |
| T-011 | La acción guarda la captura en la cola persistente de la biblioteca. La lectura en TypeScript está probada: parámetros vacíos, emojis y acentos, datos que no son texto, origen desconocido y la misma captura dos veces | Que la captura **aparezca al abrir la app** tras ejecutar la acción con la app cerrada |
| T-012 | El código del aviso compila. La pantalla Capturas pide el permiso de avisos y muestra su estado | Que el aviso **se muestre** con la app cerrada. `docs/04` A.1 ya lo marcaba como NO DEMOSTRADO: es una de las preguntas del spike |

La app de la rama arranca en el simulador y muestra el acceso a "Capturas del spike de
Apple Pay". En este entorno no hay forma de ejecutar una acción de Atajos ni de pulsar
en el simulador desde la línea de comandos, así que los tres criterios quedan para la
comprobación sin pagar de `docs/spike-a/instrucciones.md`, apartado 1. Se puede hacer en
el simulador (la app Atajos existe en él) o en el iPhone.

Casos límite de la acción, por código y por pruebas, sin ejecutar en dispositivo:

| Caso | Tratamiento |
|---|---|
| App cerrada | La acción no abre la app. Guarda en la cola y lanza el aviso desde Swift |
| Sin conexión | Nada de la acción usa la red |
| Parámetros vacíos | Captura incompleta. El aviso dice "Falta el importe". La acción no falla |
| Comercio con emojis o acentos | Se conserva tal cual. Cada texto se recorta a 200 caracteres |
| La misma captura dos veces | Dos capturas. El spike las cuenta como falsos positivos; los duplicados se tratan en H3 |
| Sin permiso de avisos | La captura se guarda igual, sin aviso |
| Más de 100 capturas sin leer | La cola de la biblioteca descarta la más antigua. Límite conocido del almacén del spike |

### 3.2 Vía elegida para los intents

**Biblioteca `expo-app-intents` 0.5.17 (alfa, versión fijada) con el intent escrito en
Swift dentro del proyecto.** Es la vía recomendada en `docs/05`, apartado 2.3.

- La biblioteca exige que el intent se declare en Swift en la carpeta `app-intents/`:
  iOS lee esas declaraciones al compilar y no las ve dentro de una biblioteca.
- La biblioteca aporta la cola persistente donde la acción deja la captura y el puente
  que la entrega a TypeScript. Esa cola es el "almacén compartido mínimo" de T-011.
- El aviso local (T-012) se lanza desde Swift, dentro de la propia acción. La biblioteca
  no puede hacerlo: solo encola el trabajo para cuando se abra la app.
- **No se usa App Group.** La acción se ejecuta dentro del proceso de la app, así que
  comparte su almacén sin él. El App Group hará falta cuando exista el widget (H3).
- **No se usa el plugin de configuración de `expo-notifications`.** Ese plugin añade el
  permiso de notificaciones remotas (push), que una cuenta gratuita no puede firmar. Los
  avisos locales no lo necesitan.
- La salida prevista (escribir también la cola en Swift, sin la biblioteca) no ha hecho
  falta. Se aplicaría si la medición en el iPhone muestra que la captura no llega con la
  app cerrada.

Diferencias respecto a `docs/04`, apartado A.3:

- `importe` es opcional en Swift, aunque la tabla lo marca como obligatorio. Motivo: con
  un parámetro obligatorio vacío, Atajos se detiene a preguntar y la automatización
  falla. Manda la decisión "la acción nunca falla hacia fuera". Una captura sin importe
  se guarda como incompleta.
- La acción no descarta duplicados ni aplica reglas de cuenta o categoría. Son tareas de
  H3 (T-032 a T-034). El spike necesita ver los duplicados para contarlos.
- Los títulos de la acción están escritos en Swift, no en `src/i18n/es.json`. iOS exige
  que sean literales en el código. Los demás textos nativos están reunidos en
  `app-intents/CapturaEnBruto.swift`.

## 4. H2 · Núcleo de movimientos — rama `h2-nucleo-movimientos`

Resultado de `npm run check` en la rama: formato, análisis estático y tipos sin errores;
**134 pruebas correctas en 8 ficheros**.

| Tarea | Estado | Evidencia |
|---|---|---|
| T-020 Base de datos y migraciones | HECHA | `src/datos/__tests__/`: crean, leen, modifican y borran Cuenta, Categoria y Movimiento sobre SQLite real. Migraciones con versión, que se deshacen enteras si fallan. En el simulador, la base de datos queda en versión 1 con las 9 categorías iniciales |
| T-021 Dinero en céntimos | HECHA | `src/dominio/__tests__/dinero.test.ts`: 0,10 + 0,20 = 0,30 exactos; importes con miles; formato de España y de región con punto decimal |
| T-022 Pantalla de cuentas (P09) | HECHA | Prueba "crea una cuenta con saldo inicial y aparece en la lista con ese saldo" |
| T-023 Alta de movimiento (P07) | PARCIAL | Prueba "guarda un gasto en cuatro toques más los dígitos": cuenta 3 toques ([+], categoría, Guardar). **Falta la grabación** que pide el criterio: NO DEMOSTRADO en dispositivo |
| T-024 Transferencia | HECHA | Pruebas en datos y en pantalla: 50 € bajan el origen, suben el destino y el gasto del mes no cambia |
| T-025 Lista de movimientos (P06) | HECHA | Pruebas: buscar un nombre devuelve solo los que lo contienen, sin distinguir mayúsculas ni acentos; filtros por cuenta, categoría y mes; agrupación por día |
| T-026 Saldo por cuenta | HECHA | `src/dominio/__tests__/saldo.test.ts`: ingresos, gastos, transferencias y ajustes |
| T-027 Categorías | HECHA | Pruebas: crear, renombrar, ordenar y archivar. Archivar oculta la categoría en el alta y conserva sus movimientos |
| T-028 Borrado con deshacer | HECHA | Pruebas: tras borrar, "Deshacer" recupera el movimiento con los mismos datos |

Comprobado a la vista en el simulador (iPhone 17, iOS 27.2, compilación Release): la app
arranca, crea la base de datos y pinta la lista de movimientos con datos de ejemplo,
agrupada por día. **No se ha manejado la app tocando la pantalla**: este entorno no tiene
una herramienta para pulsar en el simulador. La interacción está cubierta por las
pruebas de pantalla, que manejan los mismos componentes contra una base de datos real en
memoria. Las pantallas P07, P09 y categorías no se han visto pintadas en el simulador.

### 4.1 Casos límite probados

| Caso | Resultado |
|---|---|
| Importe 0 | Rechazado con "Escribe un importe mayor que cero" |
| Importe negativo en gasto, ingreso o transferencia | Rechazado. Solo el ajuste lleva signo |
| 0,10 + 0,20 | 0,30 exactos |
| Miles | "1.234,56", "1,234.56" y "1.234.567,89" se leen bien |
| Texto vacío | No es un importe (`null`). En el saldo inicial de una cuenta vale 0 |
| Coma y punto como separador | Los dos se aceptan. "1,234" y "1.234" se leen como mil doscientos treinta y cuatro |
| Tres decimales ("0,123") | Rechazado. No se redondea nunca |
| Transferencia a la misma cuenta | Rechazada en la app y, como segunda barrera, en la base de datos |
| Transferencia con una cuenta archivada | Rechazada en origen y en destino. Una transferencia antigua se puede seguir editando |
| Transferencia entre divisas distintas | Rechazada. No hay conversión en V1 |
| Deshacer dos veces | La segunda no cambia nada. El botón desaparece al usarlo |
| Borrar dos veces | La segunda no cambia nada |
| Borrar una cuenta con movimientos | Rechazado con explicación. Se puede archivar |
| Archivar una categoría en uso | Se oculta en el alta y sus movimientos la conservan y se pueden editar |
| Nombres duplicados | Rechazados sin distinguir mayúsculas, acentos ni espacios, también contra archivadas |
| Guardar dos veces seguidas | Un solo movimiento. **Fallo encontrado y corregido**: dos toques podían crear dos movimientos |
| Búsqueda con `%` o con texto de SQL | No devuelve nada: el texto nunca se inserta en la consulta |
| Emojis y acentos en nombres | Se guardan y se buscan bien |
| Fecha imposible (30 de febrero) | Rechazada |

### 4.2 Limitaciones conocidas de H2

- Dos decimales para toda divisa. Vale para el euro. Divisas sin decimales, fuera.
- El patrimonio de P09 suma el saldo de las cuentas activas. El valor de las inversiones
  y la gráfica de doce meses llegan en H6.
- La fecha se elige día a día con dos flechas. No hay calendario.
- Los ajustes se pueden crear desde el código y cuentan en el saldo, pero no tienen
  pantalla: el cuadre de saldo es de un hito posterior.
- Los nombres de las categorías iniciales se crean en español una sola vez.
- Los mensajes de error inesperado del arranque muestran el texto técnico en inglés.
- Accesibilidad: etiquetas, áreas de 44 puntos y colores semánticos puestos. No se ha
  probado con VoiceOver ni se ha medido el contraste.

## 5. Acciones pendientes del usuario

Por orden. Las tres primeras desbloquean casi todo lo demás.

1. **Activar Xcode (T-002).** En Terminal:
   ```sh
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   xcodebuild -version
   ```
   Debe responder `Xcode 27.2`. Después abre Xcode › Settings › Accounts › **+** e inicia
   sesión con tu Apple Account. Debe aparecer un equipo "(Personal Team)".
2. **Responder la lista de medios (T-003)**: `docs/notas/h0-medios.md`.
3. **Instalar la app en tu iPhone (T-004).** Conéctalo por cable, acepta "Confiar" y
   ejecuta `npx expo run:ios --device` en la rama `h1-spike-apple-pay`. La primera vez,
   en el iPhone: Ajustes › General › VPN y gestión de dispositivos › confiar en tu
   certificado. Con cuenta gratuita la app caduca a los 7 días y hay que reinstalarla.
4. **Comprobar las capacidades (T-005)** con la tabla del apartado 2.1.
5. **Describir tus atajos (T-007)**: `docs/notas/atajos-actuales.md`.
6. **Crear el proyecto de Supabase (T-008)** en https://supabase.com con tu cuenta, en
   una región de la UE. En el editor de SQL:
   ```sql
   create table prueba (id bigint generated always as identity primary key, texto text);
   insert into prueba (texto) values ('hola');
   alter table prueba enable row level security;
   create policy "lectura de prueba" on prueba for select to anon using (true);
   ```
   Copia `.env.example` como `.env` y rellénalo con la dirección y la clave **pública**.
   Abre la app en desarrollo › Diagnóstico: debe decir "Filas leídas: 1".
7. **Ejecutar el spike A (T-013 a T-016)**: `docs/spike-a/instrucciones.md`.
8. **Grabar el alta de un gasto (T-023)** en la rama de H2 para contar los toques.
9. **Decidir** si subo las ramas a GitHub y si protejo `main` (T-006).

## 6. Bloqueos externos y riesgos tocados

| Riesgo | Situación |
|---|---|
| R-01 Captura que pierde pagos | Sin medir. Depende del spike A |
| R-04 Bibliotecas de Expo en alfa | `expo-app-intents` 0.5.17 fijada. Compila e iOS extrae la acción. Falta la prueba en dispositivo |
| R-21 Cuenta gratuita sin capacidades | Sin comprobar (T-005). La vía de H1 evita App Groups y push para reducir el riesgo |
| R-22 Poco espacio en disco | De 31 GB a 18 GB libres tras compilar. La compilación ocupa unos 5 GB en `~/Library/Developer/Xcode/DerivedData`, que se pueden borrar. Vigilar |

Otros hechos del entorno:

- La caché de npm del usuario (`~/.npm`) tiene ficheros propiedad de `root` y `npm
  install` falla con `EACCES`. En esta sesión se usó una caché temporal. Arreglo
  definitivo, que pide tu contraseña: `sudo chown -R $(whoami) ~/.npm`.
- La primera compilación tardó unos 23 minutos en este Mac. Las siguientes, unos 3.
- Con la app recién arrancada y el Mac muy cargado, la pantalla "Preparando tus datos…"
  llegó a verse más de 10 segundos en el simulador. En arranques posteriores, menos de
  8. No se ha medido en un iPhone.

## 7. H2b · Rediseño e Inicio — rama `h2b-rediseno-inicio` (16/11/2026)

Encargo: `docs/prompt-claude-code-rediseno-dashboards.md`. Adelanta parte de H7.

### 7.1 Baseline (antes de modificar nada)

| Dato | Valor |
|---|---|
| Rama y commit de partida | `h2-nucleo-movimientos` @ `be01716` |
| `npm run check` | pasa: 134 pruebas en 8 suites; formato, lint y tipos limpios |
| `git status` | limpio, salvo el fichero del encargo sin seguimiento |
| Carpeta `ios/` | **ignorada por git** (`.gitignore`, línea `/ios`). `git ls-files ios` no devuelve nada: no está versionada. El encargo decía que no figuraba en `.gitignore`; sí figura |
| Ajustes manuales en `ios/` | `DEVELOPMENT_TEAM` fijado, `ENABLE_USER_SCRIPT_SANDBOXING = NO`, entitlements vacíos (sin push) y referencia a `../app-intents` de la rama H1 |
| Versiones | expo 58.0.25 (`~58.0.25`), react-native 0.88.1, react 19.3.0 |
| Capturas de partida | `docs/capturas/antes/`: Movimientos, Cuentas y alta, en claro y oscuro. Inicio y detalle de cuenta no existían |

### 7.2 Hecho

| Parte | Estado | Evidencia |
|---|---|---|
| Cálculo del mes en `src/dominio/resumen.ts` | HECHA | 33 pruebas en `resumen.test.ts`, incluida la de coherencia entre balance global y variaciones por cuenta |
| Sistema visual en `src/theme/` | HECHA | Prueba de contraste (77 casos): paleta de 12 colores ≥ 3:1 y textos ≥ 4,5:1, en claro y oscuro. Búsqueda de hexadecimales en `src/app` y `src/componentes`: 0 resultados |
| Gráficos (T-080) | HECHA | `react-native-svg` 15.16.0, licencia MIT, versión que fija `npx expo install` para SDK 58. `expo-doctor`: 20 de 20. Anillo y barras vistos en claro y oscuro |
| Inicio (P05, parte) | HECHA | Pruebas de pantalla en `inicio.test.tsx` y capturas `inicio-*.png` |
| Detalle de cuenta (P10, parte) | HECHA | Pruebas de pantalla y capturas `detalle-de-cuenta-*.png` |
| Navegación Inicio · Movimientos · Cuentas | HECHA | La app abre en Inicio. Enlace `financialcontrol://movimientos?categoriaId=…&mes=…` comprobado en el simulador |
| Tema en el resto de pantallas | HECHA | Capturas de Movimientos, Cuentas y alta. Categorías y edición de cuenta usan los mismos componentes; **no se han capturado** |
| Botón «+» y última fila | HECHA | El margen inferior sale de las medidas del botón (prueba `margen.test.tsx`). Captura `movimientos-fin-de-lista-*.png` |
| Tasa de ahorro (T-083) | HECHA | 2 000 € y 1 600 € dan 20 %: prueba de dominio y captura de Inicio con esos datos |

`npm run check` al cierre: **284 pruebas en 13 suites, todas pasan**. Ninguna prueba
anterior se ha borrado ni desactivado. En `pantallas.test.tsx` solo cambian dos líneas: la
ruta de importación de Movimientos (el fichero pasó de `index.tsx` a `movimientos.tsx`) y
`navigate` en la navegación simulada.

### 7.3 Casos límite

| Caso | Resultado | Cómo |
|---|---|---|
| Mes sin movimientos, mes futuro | Estado vacío con texto, sin gráfico a cero | Prueba y captura `inicio-sin-datos-*` |
| Gastos sin ingresos | No muestra tasa de ahorro ni divide entre cero | Prueba |
| Ingresos sin gastos, balance negativo | 100 % y cifra negativa con signo | Prueba y captura de límites |
| Solo transferencias | Balance 0 y variaciones que suman 0 | Prueba |
| Ajustes positivos y negativos | No cuentan como ingreso ni gasto; sí en la cuenta | Prueba |
| Movimiento anterior al saldo inicial | No cuenta en la cuenta y la pantalla lo explica | Prueba |
| Movimientos borrados | No cuentan | Prueba |
| Una categoría al 100 %, más de cinco | Anillo cerrado; cinco y «Otras» | Prueba y captura |
| Color e icono nulos, subcategorías | Valor derivado estable; suman en la principal | Prueba |
| Sin cuentas, una, ocho | Estado vacío con acción; lista completa | Prueba y captura de límites |
| Cuenta archivada con movimientos | Aparece solo en ese mes | Prueba |
| 1.234.567,89 € y nombres largos | Caben sin cortar | Captura de límites |
| Texto del sistema al máximo | Se corrigieron cortes a media palabra. Visto en Inicio y detalle | Capturas `limite-texto-maximo-*` |
| Enero a diciembre, primer y último día | Correcto | Prueba |
| Modo oscuro | Legible en las seis pantallas capturadas | Capturas |
| «Reducir movimiento» | La decisión de animar tiene prueba. **NO DEMOSTRADO** en pantalla: no se pudo activar el ajuste en el simulador |

### 7.4 Limitaciones

- No se ha probado en un iPhone real: solo en el simulador iPhone 17 con iOS 27.2.
- El simulador no admite toques desde aquí. La interacción está cubierta por pruebas; las
  capturas de la parte baja de Inicio y del final de Movimientos se tomaron desplazando la
  lista con un código temporal que no está en la rama.
- El botón «+» flota sobre la lista: a mitad de desplazamiento puede quedar encima de una
  fila. Lo garantizado es que la última fila se puede dejar entera por encima.
- Tocar en Inicio una categoría principal no incluye los movimientos de sus subcategorías
  (hoy ninguna pantalla crea subcategorías). «Otras» y «Sin categoría» abren el mes sin
  filtro de categoría.
- El icono de categoría se deduce del nombre y el color del orden: al reordenar categorías
  cambian los colores. No hay todavía pantalla para elegirlos.
- VoiceOver no se ha probado. Las etiquetas existen y se comprueban en las pruebas.

### 7.5 Acciones del usuario

1. Abrir `ios/FinancialControl.xcworkspace` en Xcode y compilar de nuevo en el iPhone: hay
   una biblioteca nativa nueva (`react-native-svg`) y ya se ejecutó `pod install`.
2. Revisar en el iPhone: Inicio, detalle de cuenta, final de la lista de Movimientos,
   «Reducir movimiento» y VoiceOver.

## 8. H3 · Visión completa — rama `h3-vision-completa` (17/11/2026)

Encargo: `docs/prompt-claude-code-h3-vision-completa.md`. Es el bloque 1 de la decisión D7.

### 8.1 Baseline (antes de modificar nada)

| Dato | Valor |
|---|---|
| Rama y commit de partida | `h2b-rediseno-inicio` @ `d0d1fe5` |
| `npm run check` | pasa: 284 pruebas en 13 suites; formato, lint y tipos limpios |
| `git status` | limpio, salvo el fichero del encargo sin seguimiento. Durante el trabajo aparecieron cambios del usuario en `docs/07` y `docs/09` (decisiones D7 a D9): se han conservado |
| Esquema de la base de datos | versión 1. Una sola migración: crea `cuenta`, `categoria` y `movimiento` con sus índices |

### 8.2 Hecho

| Parte | Estado | Evidencia |
|---|---|---|
| Cálculo de inversión (`src/dominio/inversion.ts`) | HECHA | `inversion.test.ts`. El ejemplo del encargo da 150 € y 7,5 %, y tras aportar 200 € da 2 350 €, 2 200 € y 150 € |
| Patrimonio (`src/dominio/patrimonio.ts`) | HECHA | `patrimonio.test.ts`, con las dos pruebas de coherencia: banco y efectivo más valor estimado, y sin valores igual a la suma de saldos que mostraba Cuentas |
| Día, comparativa y año (`src/dominio/tiempo.ts`) | HECHA | `tiempo.test.ts`: la suma del gasto diario es el gasto del mes y la suma de los doce meses es el total del año |
| Migración 2 y repositorio de valores | HECHA | `valores.test.ts`: una base de datos en versión 1 con datos migra a la 2 sin alterar cuentas, categorías ni movimientos. Comprobado además en el simulador: la base de ejemplo pasó de versión 1 a 2 con sus 44 movimientos |
| Inicio con patrimonio, Hoy e Inversiones | HECHA | Pruebas en `h3.test.tsx` y capturas `inicio-*` |
| Pantallas Patrimonio, Inversiones y valor de inversión (P21) | HECHA | Pruebas y capturas |
| Cuenta de inversión en el detalle de cuenta | HECHA | Pruebas y capturas con y sin valores |
| Pestaña Análisis: Día, Mes y Año | HECHA | Pruebas y capturas de las tres vistas |
| Remate 1 · enlace de diagnóstico | YA ESTABA | El enlace solo se pinta si `__DEV__` es verdadero. Se veía en las capturas porque el simulador ejecuta una compilación de desarrollo |
| Remate 2 · subcategorías en el filtro | HECHA | Prueba de repositorio con dos niveles |
| Remate 3 · icono y color de categoría | HECHA | Prueba de pantalla. **Sin captura**: la hoja se abre con un toque |
| Remate 4 · botón «+» | HECHA | El botón pasa a la cabecera, arriba a la derecha, en Inicio, Movimientos y Cuentas. Ya no flota sobre el contenido |

`npm run check` al cierre: **388 pruebas en 18 suites, todas pasan**. Ninguna prueba se ha
borrado ni desactivado. Pruebas anteriores modificadas: solo `migraciones.test.ts`, que
enumeraba las tablas y ahora incluye `valor_de_inversion`. Las pruebas de pantalla
anteriores (`pantallas.test.tsx` e `inicio.test.tsx`) no se han tocado. `package.json` no
cambia: no hay dependencias nuevas.

### 8.3 Casos límite

| Caso | Resultado | Cómo |
|---|---|---|
| Sin cuentas de inversión | No aparece el bloque ni la cifra «Invertido». La pantalla de inversiones explica qué hacer | Prueba |
| Cuenta de inversión sin valores, con uno y con muchos | Estado vacío explicado; ganancia y porcentaje; historial | Prueba y capturas |
| Valor menor que lo aportado y valor cero | «Pierdes», con palabra y signo; −100 % | Prueba |
| Aportado cero o negativo | No se muestra porcentaje | Prueba |
| Dos valores el mismo día | El segundo sustituye al primero | Prueba |
| Valor con fecha futura o anterior a la cuenta | Se rechaza con su texto | Prueba |
| Valor anterior a la primera aportación | Se respeta y las aportaciones se suman | Prueba |
| Aportación el mismo día y al día siguiente del valor | La del mismo día ya está incluida; la del siguiente se suma | Prueba |
| Retirada parcial después de un valor | Bajan igual el valor y lo aportado | Prueba |
| Valor borrado y deshacer | Los cálculos vuelven al estado anterior | Prueba |
| Cuenta de inversión archivada con saldo | Cuenta en el patrimonio y aparece en el resumen | Prueba |
| Patrimonio negativo | Cifra en negativo y sin reparto en porcentajes, con explicación | Prueba |
| Dos meses de historia | La línea tiene dos puntos | Prueba |
| Cambio de año en los doce meses | Correcto | Prueba |
| Año sin movimientos, con un solo mes y futuro | Estado vacío; con un mes hay «más gasto» pero no «menos gasto» | Prueba |
| Febrero bisiesto, 30 y 31 días, mes que empieza en domingo | Correcto. Noviembre de 2026 empieza en domingo | Prueba y captura |
| Hoy es día 1 | La media divide entre 1 | Prueba |
| Día con veinte movimientos y día sin ninguno | Correcto | Prueba |
| 1.234.567,89 € en calendario y tablas | El cálculo tiene prueba. **NO DEMOSTRADO** en pantalla: no se capturó con importes así |
| Dos divisas | El cálculo no las mezcla (prueba). **NO DEMOSTRADO** en pantalla: hoy no se puede crear una cuenta en otra divisa |
| Categoría con subcategorías en el filtro | Correcto | Prueba |
| Modo oscuro | Legible en las 18 pantallas capturadas | Capturas |
| Texto del sistema al máximo | El calendario pasa a lista de días. Se corrigieron un título y una cifra que se partían | Prueba y capturas `calendario-texto-maximo-*` |

### 8.4 Limitaciones

- Solo se ha visto en el simulador iPhone 17, no en un iPhone real.
- El simulador no admite toques desde aquí. Para capturar las partes bajas de las pantallas
  se usó un código temporal de desplazamiento que **no está en la rama**. Las capturas son
  posteriores al último cambio visual.
- El valor de una inversión es el que anota la persona. Entre un valor y el siguiente la app
  solo suma y resta lo que entra y sale: no es un valor de mercado.
- Todo lo que entra en una cuenta de inversión cuenta como aportación, también un ingreso
  anotado directamente en ella (por ejemplo, un dividendo). La pantalla lo explica.
- Antes de la fecha del saldo inicial de una cuenta, esa cuenta no cuenta en el patrimonio.
  Al añadir una cuenta con saldo, la línea de evolución da un salto en esa fecha.
- La variación del patrimonio en el año parte del cierre del año anterior o, si no hay
  datos tan antiguos, de la primera fecha con datos. La pantalla dice de qué fecha parte.
- El botón «+» está ahora arriba: no tapa nada, pero queda más lejos del pulgar. La barra
  con botón central de `docs/03` sigue pendiente.
- En la vista Año las barras no se pueden tocar (doce barras no dan para áreas de 44
  puntos). Se toca la fila del mes en la tabla.
- El aviso de valor antiguo solo se ve al abrir la cuenta. No hay notificación (T-077).
- VoiceOver y «Reducir movimiento» siguen sin probarse en un dispositivo.
- La hoja de icono y color y la edición de un valor no tienen captura.

### 8.5 Acciones del usuario

1. Abrir la app en el iPhone. Este bloque no añade bibliotecas nativas: si la app instalada
   es una compilación de desarrollo, basta con arrancar `npx expo start` en el Mac y abrirla.
   Si no carga, compilar de nuevo desde Xcode como en H2b.
2. La primera vez, la base de datos pasa sola de la versión 1 a la 2. Los datos se conservan.
3. Probar con datos reales: anotar el valor de una inversión, mirar Inicio y las tres vistas
   de Análisis, y revisar VoiceOver y «Reducir movimiento».

## 9. H5 · Planificación — rama `h5-planificacion` (17/11/2026)

Encargo: `docs/prompt-claude-code-h5-planificacion.md`. Es el bloque 2 de la decisión D7.

### 9.1 Baseline (antes de modificar nada)

| Dato | Valor |
|---|---|
| Rama y commit de partida | `h3-vision-completa` @ `b055bf5` |
| `npm run check` | pasa: 388 pruebas en 18 suites; formato, lint y tipos limpios |
| Esquema de la base de datos | versión 2 (migración 1: cuentas, categorías y movimientos; migración 2: valores de inversión) |
| `git status` | limpio, salvo el fichero del encargo en `docs/`, sin seguimiento |

### 9.2 Hecho

| Fase | Commit | Estado | Evidencia |
|---|---|---|---|
| 0 y 1 · Baseline y dominio | `d1f00df` | HECHA | `src/dominio/__tests__/plan.test.ts` (45 pruebas), con los tres casos de comprobación |
| 2 · Migración 3 y repositorios | `5c1d15c` | HECHA | `src/datos/__tests__/plan.test.ts` (33 pruebas). Una base en versión 2 con datos pasa a la 3 con cuentas, categorías, movimientos y valores idénticos. Comprobado además en el simulador: la base de ejemplo pasó de la versión 2 a la 3 con sus 47 movimientos y 6 valores |
| 3, 4 y 5 · Pestaña Plan | `fdc8f53` | HECHA | Pruebas de pantalla en `h5.test.tsx`. Las tres secciones van en un commit porque la pestaña las reúne |
| 6 · Inicio | `f156e7f` | HECHA | Pruebas de pantalla en `h5.test.tsx` |
| 7 y 8 · Casos límite, capturas y documentación | commit final | Ver 9.4 y 9.5 | — |

Casos de comprobación del encargo, con prueba que exige la cifra exacta:

| Caso | Resultado |
|---|---|
| Disponible: presupuesto 1.100,00 €, gastado 687,00 €, fijo pendiente de 45,00 €, hoy 17/11/2026 | 368,00 € y 26,28 € al día. Con el fijo confirmado, gastado 732,00 € y disponible 368,00 € |
| Previsión: saldo 2.000,00 €, fijos de 300,00 € y 50,00 €, ingreso de 1.500,00 €, variable de 340,00 € | 2.890,00 € |
| Objetivo: meta 1.500,00 €, aportado 500,00 €, límite 31/07/2027 | 8 meses y 125,00 € al mes |

Estado de las tareas: T-060 a T-065, T-069 a T-072 y la parte de T-084 pendiente, hechas.
**T-066 y T-067 quedan parciales** por la decisión D-c del encargo: el aviso de cobro y el
de presupuesto son tarjetas en pantalla, no notificaciones del sistema.

`npm run check` al cierre: **502 pruebas en 21 suites, todas pasan** (388 al empezar, 114
nuevas). `package.json`, `package-lock.json`, `app.json` e `ios/` no cambian.

Pruebas anteriores tocadas, tres, todas por el mismo motivo: daban por hecho que la
versión 2 era la última del esquema.

- `migraciones.test.ts`: la lista de tablas de una base recién creada incluye las cinco
  nuevas.
- `valores.test.ts`: la prueba del paso de la versión 1 a la 2 migra ahora solo hasta la
  2, que es lo que comprueba; y la lista de versiones se compara por sus dos primeras.

Ninguna prueba se ha borrado ni desactivado, y ninguna de pantalla anterior se ha tocado.

### 9.3 Decisiones tomadas sin consultar

| Decisión | Motivo |
|---|---|
| Propuesta con menos de tres meses de datos: la media se reparte entre los meses, de los tres anteriores, que tienen algún gasto | F4 solo dice «si no hay histórico, los campos van vacíos». Dividir siempre entre tres daría un tercio de lo real a quien lleva un mes |
| «Por confirmar» incluye los cobros vencidos del mes en curso y del mes anterior | Un fijo del día 30 no debe desaparecer el día 1. Más atrás no se mira para no acumular |
| El presupuesto se entiende en la divisa principal | La tabla no lleva divisa. Reglas y objetivos sí llevan la de su cuenta y no se mezclan |
| La fecha de fin de un fijo y la fecha límite de un objetivo se eligen por meses | No hay selector de fecha futura sin dependencias nuevas. Valen hasta el último día del mes. El cálculo admite cualquier día |
| En una regla anual, el mes se elige en el formulario y fija su fecha de inicio | El encargo define el mes de una regla anual como el de su fecha de inicio |
| «Aportar» anota un apunte sin movimiento | El caso «aportación sin movimiento enlazado» lo pide. La aportación con movimiento es la mensual |
| Un fijo o un ingreso periódico exige categoría | Sin ella el gasto no entraría en ninguna línea del presupuesto |
| El cobro confirmado debe quedar dentro de su mes | Fuera de él no confirmaría esa ocurrencia |
| En P12 se muestran además los ingresos periódicos previstos del mes | F4 pide la diferencia con los ingresos previstos |
| Una aportación que viene de un movimiento no se borra sola: se borra el movimiento | Así no quedan transferencias sin su aportación |

### 9.4 Casos límite

| Caso | Resultado | Cómo |
|---|---|---|
| Regla del día 31 en febrero, abril y febrero bisiesto | Cae el 28, el 30 y el 29 | Prueba |
| Regla anual fuera y dentro de su mes | Solo ocurre en su mes | Prueba de dominio y de pantalla |
| Fecha de fin a mitad de mes, antes y después de su día | Ocurre si su día es anterior o igual | Prueba |
| Regla inactiva o borrada | No ocurre ni se puede confirmar | Prueba |
| Regla cuya cuenta o categoría se archiva | Sigue ocurriendo; confirmarla lo explica y no crea nada | Prueba |
| Confirmar dos veces seguidas | Un solo movimiento | Prueba de repositorio y de pantalla |
| Movimiento confirmado que se borra y se recupera | Pendiente y de nuevo confirmada | Prueba |
| Movimiento confirmado movido a otro mes | La ocurrencia vuelve a pendiente | Prueba |
| Presupuesto sin líneas, con una línea a 0 y con gasto solo sin línea | Correcto; una línea a 0 con gasto está excedida | Prueba |
| Gasto en subcategoría con línea en la categoría principal | Suma en la principal | Prueba |
| Disponible negativo | «Te has pasado X» y 0 al día | Prueba de dominio y de pantalla |
| Último día del mes | Queda 1 día | Prueba |
| Primer día del mes en la previsión | Divide entre 1 | Prueba |
| Mes pasado y mes futuro en P11 | Sin raya del día | Prueba de dominio y de pantalla |
| Objetivo sin fecha, con fecha este mes, vencido, pasado de meta y de más de un millón | Correcto | Prueba de dominio y de pantalla |
| Aportación sin movimiento enlazado | Suma al objetivo y se borra con deshacer | Prueba |
| Nombres duplicados que solo cambian en mayúsculas o acentos | Rechazados en fijos y en objetivos | Prueba |
| 0,01 € y más de 1.000.000 € | El cálculo y las tarjetas tienen prueba. **NO DEMOSTRADO** a la vista en barras y anillos |
| Texto grande del sistema | El calendario de fijos pasa a lista (prueba). Ver capturas en 9.5 |
| Base de datos vacía | Inicio y Plan muestran sus estados vacíos | Prueba |

### 9.5 Capturas

34 capturas en `docs/capturas/h5/`, tomadas en el simulador iPhone 17 con datos de ejemplo
y revisadas una a una. Son posteriores al último cambio visual.

- En claro y en oscuro: Inicio (arriba, medio y abajo), presupuesto vacío, presupuesto,
  presupuesto con una línea excedida, edición de presupuesto, fijos, fijos con calendario,
  lista de fijos, alta de regla, regla de aportación, confirmar cobro, objetivos y detalle
  de objetivo.
- Solo en claro, con el texto del sistema al máximo: presupuesto, fijos, objetivos e Inicio.

Defectos vistos en las capturas y corregidos antes de repetirlas: el porcentaje del anillo
de objetivos se partía en dos líneas, y con el texto al máximo el selector de tres
secciones se cortaba («Pr… Fijos Ob…»).

Para capturar las partes bajas se usó un código temporal de desplazamiento que **no está
en la rama**. No se compiló nada nativo: la app de desarrollo ya instalada en el simulador
cargó el código nuevo desde el servidor de desarrollo.

Faltan: la edición de objetivo, «Aportar» y los formularios en oscuro con el texto al
máximo. Tienen prueba de pantalla, no captura.

### 9.6 Limitaciones

- Sin notificaciones del sistema (decisión D-c). El aviso de cobro y el de presupuesto solo
  se ven al abrir la app. `aviso_dias_antes` se guarda en cada regla y aún no se usa.
- No hay «saltar un cobro este mes» (decisión D-h). Quien no quiera un cobro desactiva la
  regla o le pone fecha de fin. Un cobro vencido que no se confirma sigue en «Por
  confirmar» durante ese mes y el siguiente.
- Solo periodicidad mensual y anual (decisión D-g).
- La fecha de fin de un fijo y la fecha límite de un objetivo se eligen por meses.
- Un cobro pendiente resta del disponible aunque su categoría no tenga línea en el
  presupuesto: así lo define la fórmula de D1.
- El presupuesto se entiende en la divisa principal. Hoy la app solo crea cuentas en euros,
  así que el caso de dos divisas está **NO DEMOSTRADO** en pantalla.
- La previsión de fin de mes supone que se seguirá gastando al ritmo de lo que va de mes.
  Los primeros días del mes un solo gasto grande la mueve mucho. Va rotulada como «Previsto».
- «Ya lo anoté» ofrece todos los movimientos del mes de la misma cuenta y tipo sin regla;
  en una cuenta con muchos gastos la lista es larga.
- El calendario de fijos marca los días de cobro, pero tocar un día no hace nada: la lista
  del mes está debajo.
- Borrar un objetivo no borra las reglas de aportación mensual que apuntaban a él.
- Importes de 0,01 € y de más de 1.000.000 € en barras y anillos: con prueba, **NO
  DEMOSTRADO** a la vista.
- Solo se ha visto en el simulador. VoiceOver y «Reducir movimiento» siguen sin probarse en
  un dispositivo.
- Durante las capturas el Mac iba muy cargado por el antivirus y el simulador tardó varios
  minutos en arrancar la app. No es un defecto de la app.

### 9.7 Acciones del usuario

1. Para ver este bloque en el iPhone hay que volver a instalar la app. La que está
   instalada en modo Release lleva el código dentro y no cambia sola. Con el iPhone
   conectado, desde la carpeta del proyecto:
   `npx expo run:ios --device --configuration Release`
   No hay bibliotecas nativas nuevas ni cambios en `ios/`.
2. La primera vez que se abra, la base de datos pasa sola de la versión 2 a la 3. Los datos
   se conservan.
3. Probar con datos reales: crear el presupuesto del mes, dar de alta los fijos, confirmar
   un cobro, crear un objetivo con su aportación mensual y mirar Inicio.
4. Decidir si se sube la rama `h5-planificacion` a GitHub. Está solo en local.

## 10. B3 · Entrada rápida — rama `b3-entrada-rapida` (17/11/2026)

Encargo: `docs/prompt-claude-code-b3-entrada-rapida.md`. Es el bloque 3 de la decisión D7.

### 10.1 Baseline (antes de modificar nada)

| Dato | Valor |
|---|---|
| Rama y commit de partida | `h5-planificacion` @ `d86fa9b` |
| `npm run check` | pasa: 502 pruebas en 21 suites; formato, lint y tipos limpios |
| Esquema de la base de datos | versión 3 |
| `git status` | limpio, salvo el fichero del encargo en `docs/`, sin seguimiento |
| Copia de la configuración nativa | `docs/notas/ios-antes-de-b3/`: `project.pbxproj`, `FinancialControl.entitlements` e `Info.plist` |

Ajustes manuales encontrados en esos ficheros (la carpeta `ios/` no está en git):

- `DEVELOPMENT_TEAM = 8Z856TA59Z` en las dos configuraciones del target de la app.
- `ENABLE_USER_SCRIPT_SANDBOXING = NO` en las cuatro configuraciones (target y proyecto).
- Entitlements vacíos (`<dict/>`): sin `aps-environment`.
- Referencia a `../app-intents`, resto de haber generado `ios/` desde la rama del spike.
- `PRODUCT_BUNDLE_IDENTIFIER = es.juanantonio.financialcontrol`.

### 10.2 Hecho

| Fase | Commit | Estado | Evidencia |
|---|---|---|---|
| 0 y 1 · Baseline y cuatro correcciones | `072c2b9` | HECHA | Cinco pruebas nuevas en `h5.test.tsx` |
| 2 · Reglas y datos de la captura | `d9f7c86` | HECHA | `captura.test.ts` (65 pruebas) y `capturas.test.ts` (34). Una base en versión 3 con datos pasa a la 4 con sus nueve tablas idénticas |
| 3 · Bandeja y guía | `23917f1` | HECHA | `b3.test.tsx` (17 pruebas) |
| 4 · Base nativa reproducible | `bce2a0b` | HECHA | Ver 10.3 |
| 6 · Notificaciones locales | `61c485a` | HECHA en JavaScript | `avisos.test.ts` (22) y `avisos.test.tsx` (19), contra un sistema de notificaciones simulado. Que el aviso llegue en un iPhone: NO DEMOSTRADO |
| 5 · Acciones de Atajos | `6176d86` | HECHA hasta donde se puede sin iPhone | El binario del simulador contiene las dos acciones. Ejecutarlas desde Atajos: NO DEMOSTRADO |
| 7 · Widget | `d942da9` | Compila y su target está bien firmado | Ver 10.3. Verlo en la pantalla de inicio: NO DEMOSTRADO |
| 8 y 9 · Capturas y documentación | commit final | Ver 10.6 | — |

La fase 6 se hizo antes que la 5 porque es solo JavaScript y no dependía de la compilación.

`npm run check` al cierre: **672 pruebas en 28 suites, todas pasan** (502 al empezar, 170
nuevas).

Pruebas anteriores tocadas, todas dentro de lo que permitía el encargo:

| Prueba | Motivo |
|---|---|
| `migraciones.test.ts`, lista de tablas | Daba por hecho que la versión 3 era la última: incluye ahora las cuatro tablas nuevas |
| `plan.test.ts`, paso de la versión 2 a la 3 | Migra solo hasta la 3, que es lo que comprueba |
| `plan.test.ts`, «la migración 3 solo crea tablas» | Compara las tres primeras versiones y lista las tablas hasta la versión 3 |
| `h5.test.tsx`, «Aportar anota una aportación sin movimiento» | «Aportar» tiene ahora dos caminos (corrección 1.2): la prueba elige «Solo anotar» y comprueba lo mismo |

Ninguna prueba se ha borrado ni desactivado.

### 10.3 Base nativa: qué se comprobó y con qué órdenes

Dependencias añadidas: `expo-app-intents` 0.5.18 (MIT; es la versión que fija
`npx expo install` para SDK 58, un parche por encima de la 0.5.17 del spike; se deja fija
porque la biblioteca está en alfa), `expo-widgets` ~58.0.29 (MIT) y `@expo/ui` ~58.0.29,
que `expo-widgets` exige de forma directa. Ninguna otra.

Ajustes manuales que ahora están en el repositorio:

| Ajuste | Dónde |
|---|---|
| Equipo de firma `8Z856TA59Z` | `app.json`, `ios.appleTeamId` (vía oficial de Expo) |
| `ENABLE_USER_SCRIPT_SANDBOXING = NO` en todos los targets | `plugins/sin-sandbox-de-scripts.js` |
| Sin `aps-environment` | `plugins/sin-push.js` |

El segundo plugin no estaba previsto. El primer `prebuild --clean` generó los entitlements
**con** `aps-environment`: Expo lo añade por su cuenta en cuanto `expo-notifications` está
instalada, aunque no se use su plugin. El plugin local lo quita.

Órdenes ejecutadas y resultado:

```sh
npx expo prebuild --clean --platform ios
cd ios && xcodebuild -workspace FinancialControl.xcworkspace -scheme FinancialControl \
  -configuration Debug -sdk iphonesimulator -destination 'id=<iPhone 17>' build
```

| Comprobación | Resultado |
|---|---|
| `prebuild --clean` | Termina sin errores. Ejecutado siete veces a lo largo del bloque |
| Compilación para simulador tras el prebuild, sin abrir Xcode | `BUILD SUCCEEDED` al cerrar las fases 4, 5 y 7. La fase 6 no cambió nada nativo y no se compiló aparte |
| Equipo | `DEVELOPMENT_TEAM = 8Z856TA59Z` en las cuatro configuraciones de los dos targets |
| Sandboxing | `ENABLE_USER_SCRIPT_SANDBOXING = NO` en las seis configuraciones; ninguna en `YES` |
| Push | Ningún `aps-environment` en los entitlements de la app ni del widget |
| Identificador | `es.juanantonio.financialcontrol`, sin cambios. El widget usa `…​.ExpoWidgetsTarget` |
| App Group | `group.es.juanantonio.financialcontrol` en los entitlements de la app y del widget |
| Acciones de Atajos | `Metadata.appintents/extract.actionsdata` del binario contiene `RegistrarPagoIntent` («Registrar pago»: importe, comercio, tarjeta, origen) y `AnadirGastoIntent` («Añadir gasto»: importe, categoría, cuenta), todos los parámetros opcionales y `openAppWhenRun` en falso |
| Widget | El binario lleva `PlugIns/ExpoWidgetsTarget.appex` |
| Dos prebuild seguidos | `Podfile`, `Info.plist` y entitlements, idénticos byte a byte. `project.pbxproj` difiere solo en los identificadores internos de 24 caracteres que Expo genera al azar: sustituidos estos, 0 líneas distintas |

Todo esto es para el **simulador**. La compilación para un iPhone, que es la que firma de
verdad con la cuenta gratuita, no se ha hecho (decisión D-g): **NO DEMOSTRADO**. En
particular, que la cuenta gratuita firme el App Group del widget es lo que dice el
encargo, no algo comprobado aquí.

### 10.4 Decisiones tomadas sin consultar

| Decisión | Motivo |
|---|---|
| Segundo plugin local, `sin-push.js` | Sin él, cada prebuild devolvía el permiso que la cuenta gratuita no firma |
| `expo-app-intents` 0.5.18 en lugar de 0.5.17 | Es la que instala `npx expo install` para SDK 58, como preveía D-c |
| «1.234» y «1,234» quedan sin importe | Pueden ser miles o decimales. El encargo pide no inventar ante la duda |
| Un importe negativo o cero queda sin importe | Sería una devolución; no se convierte en gasto a ciegas |
| La divisa que no dice el texto es la de la cuenta propuesta | Atajos puede entregar solo el número |
| Al guardar una captura con nombre de tarjeta y sin alias, se crea el alias | Es el paso 6 de A.4 («la respuesta crea el alias»). Un alias existente no se pisa |
| La duplicada no se fusiona con la primera | A.5 habla de «enriquecer» la primera; el encargo pide que quede «visible y recuperable». Manda el encargo |
| «Añadir gasto» crea el movimiento al abrir la app | La acción no abre la app y la base de datos solo la escribe la app |
| «Añadir gasto» sin cuenta y con una sola cuenta activa usa esa; con varias, deja la captura pendiente | No elegir una cuenta al azar |
| Si la captura de «Añadir gasto» repite otra en 10 minutos, queda como duplicada y no crea el gasto | Misma regla que cualquier captura |
| La bandeja pinta como mucho las 100 pendientes más recientes y lo dice arriba | Para que siga respondiendo con 150 o más |
| «Por revisar» en Inicio y el número en Movimientos | Así la bandeja se encuentra sin buscarla |
| Bloque «Ajustes» al pie de Cuentas con Categorías, Apple Pay y Avisos | El encargo pedía enlazar Avisos «desde donde hoy se llega a Categorías», que era solo el alta de movimiento. No existe aún pantalla de Ajustes |
| Los avisos de cobro miran el mes en curso y los dos siguientes | Con más, el tope de 40 se llenaría de avisos lejanos |
| El aviso de presupuesto se muestra en el momento, no se programa | Depende de un gasto que acaba de anotarse |
| Un aviso que se excede de golpe da solo el de «excedida» | Dos avisos seguidos de la misma categoría no aportan |
| El aviso de capturas no se repite si ya pasaron las 24 horas | La persona lo ve al abrir la app |
| Las preferencias de avisos van en el almacén de clave y valor de expo-sqlite | No son datos financieros y no necesitan migración |
| El alta de un fijo permite elegir de 0 a 7 días de antelación | `aviso_dias_antes` existía desde la migración 3 y no se podía editar |
| El widget usa los colores de la app enviados como datos | Dentro del widget no se puede importar el tema |
| Fase 6 antes que la 5 | Solo JavaScript; no esperaba a la compilación |

### 10.5 Casos límite

| Caso | Resultado | Cómo |
|---|---|---|
| Importe vacío, solo símbolo, dos números, con miles y en otra divisa | Sin importe salvo los dos últimos, que se leen bien | Prueba (40 textos) |
| Comercio vacío, con emojis, con acentos y de 300 caracteres | Se guarda tal cual, recortado a 200 sin partir un emoji | Prueba |
| Tarjeta desconocida con una cuenta de banco y con dos | Se propone la única; con dos, sin cuenta | Prueba |
| Alias cuya cuenta se archiva después | Deja de aplicarse | Prueba |
| La misma entrada de la cola leída dos veces | Una sola captura | Prueba de repositorio y de importación |
| Dos capturas iguales a 9 y a 11 minutos | A 9, una pendiente y una duplicada; a 11, dos pendientes | Prueba |
| Captura y movimiento manual del mismo pago | No se fusionan | Prueba |
| Guardar, borrar el movimiento y deshacer | Guardada, pendiente y guardada de nuevo | Prueba |
| 150 capturas pendientes | La bandeja pinta 100 y dice cuántas hay | Prueba |
| Categoría recordada que luego se archiva | Deja de proponerse | Prueba |
| Permiso denegado, y concedido después | La pantalla lo explica y enlaza con Ajustes; al concederlo vuelve a programar | Prueba con el sistema simulado |
| Regla del día 31 en un mes de 30, con aviso tres días antes | Avisa el 27 | Prueba |
| Aviso cuyo día ya pasó | No se programa | Prueba |
| Cobro confirmado antes de la hora del aviso | El aviso se cancela; si se borra el movimiento, vuelve | Prueba |
| Línea que pasa del 80 % dos veces en el mes | Un solo aviso | Prueba |
| Cambio de hora de verano e invierno | Las 9:00 siguen siendo las 9:00 | Prueba con fechas de cambio de hora. Vale para la zona horaria del equipo donde se ejecuta |
| Más de 40 avisos candidatos | Se quedan los 40 más cercanos | Prueba |
| `prebuild --clean` dos veces seguidas | Mismo resultado, salvo identificadores al azar | Ver 10.3 |
| Base en versión 3 con datos reales | Pasa a la 4 sin perder nada | Prueba. En el simulador: ver 10.6 |
| Objetivo con dos reglas de aportación, borrado y deshecho | Se borran y vuelven las dos; una borrada antes a mano no vuelve | Prueba |
| «Mover dinero» con la misma cuenta de origen y destino | Se rechaza y no guarda nada | Prueba |
| Calendario con 9,99 €, 620,00 € y 1.234.567,89 € | «9,99», «620» y solo la marca | Prueba |

### 10.6 Verificación en el simulador y capturas

En el simulador iPhone 17 se instaló el binario compilado tras el último `prebuild --clean`
encima de la app que ya había, con sus datos de ejemplo:

- La base de datos pasó sola de la versión 3 a la 4. Sus nueve tablas anteriores (47
  movimientos, 7 reglas, 2 presupuestos, 3 objetivos…) quedaron idénticas fila a fila.
- La app arranca y es usable con todos los avisos desactivados y sin automatización.
- El enlace `financialcontrol://movimiento?capturaId=…` abre el alta con los datos de la
  captura.

22 capturas en `docs/capturas/b3/`, revisadas una a una y posteriores al último cambio
visual. En claro y en oscuro: bandeja vacía, bandeja con capturas, guía de Apple Pay,
pantalla Avisos, alta abierta desde una captura, «Aportar» con sus dos caminos, calendario
de fijos corregido (el día 20 muestra «9,99»), Inicio con el rótulo «En cuentas»,
Movimientos con el acceso a la bandeja y Cuentas con el bloque Ajustes. Con el texto al
máximo, solo en claro: bandeja y fijos.

Defectos vistos en las capturas y corregidos antes de repetirlas: el aviso «se muestran
las 100 más recientes» quedaba al final de la bandeja, donde no se ve (lo destapó una
prueba), y con el texto al máximo la fecha de un cobro se partía a media palabra.

Para capturar el calendario se usó un código temporal de desplazamiento que **no está en
la rama**. Las capturas de ejemplo de la bandeja se sembraron directamente en la base de
datos del simulador.

Faltan capturas del **widget**: el simulador no permite colocarlo en la pantalla de inicio
desde aquí. Tampoco hay captura de un aviso del sistema.

### 10.7 Limitaciones

- T-035 parcial (decisión D-e): el aviso de una captura no tiene botones. Tocarlo abre la
  bandeja en esa captura.
- «Añadir gasto» no crea el movimiento en el momento: lo crea la app al abrirse.
- La cola de Atajos guarda como mucho 100 entradas (límite de la biblioteca). Quien pase
  mucho tiempo sin abrir la app y haga más de 100 pagos perdería las más antiguas.
- Una captura duplicada no se fusiona con la primera: queda aparte, recuperable.
- Un importe como «1.234» queda sin importe, por ambiguo. Si Atajos entregara así los
  importes de más de mil euros, habría que completarlos a mano. Se verá con la medición.
- La guía no detecta la versión de iOS: enseña los dos nombres del disparador.
- Dos datos de la guía salen de documentación de terceros y **no se han comprobado en el
  iPhone**: que el disparador se llame «Transacción» en iOS 17 a 25 y «Wallet» desde iOS
  26, y que la causa de fallo más citada sea que Wallet no tenga los datos móviles activados.
- Los avisos de cobro miran el mes en curso y los dos siguientes, con un máximo de 40.
- El aviso de presupuesto solo se dispara con la app abierta, porque depende de anotar un
  gasto. El de capturas no se repite pasadas las 24 horas.
- El widget muestra el dato de la última vez que se abrió la app. Si cambia el día sin
  abrirla, la cifra por día queda atrasada; por eso lleva la fecha del dato.
- El presupuesto y el widget se entienden en la divisa principal.
- `expo-app-intents` y `expo-widgets` son bibliotecas jóvenes; la primera está en alfa.
- Con la cuenta gratuita la app instalada caduca a los 7 días.

### 10.8 NO DEMOSTRADO

Nada de lo siguiente se ha visto funcionar. No se da por bueno por deducción:

1. La compilación para un iPhone real y su firma con la cuenta gratuita, incluidos el App
   Group y la extensión del widget.
2. Que las acciones «Registrar pago» y «Añadir gasto» aparezcan en la app Atajos.
3. Que la automatización de Apple Pay dispare la acción y qué textos entrega.
4. Que la acción guarde la captura con la app cerrada y que la app la importe al abrirse.
5. Que el aviso de la captura se muestre y que al tocarlo se abra la bandeja.
6. Que las notificaciones locales lleguen a su hora con la app cerrada.
7. Que el widget aparezca en la galería, muestre la cifra y abra el alta al tocarlo.
8. VoiceOver y «Reducir movimiento» en las pantallas nuevas.

### 10.9 Lista de comprobación para el iPhone

Antes: `npx expo run:ios --device --configuration Release`, con el iPhone conectado y
desbloqueado. Si la firma falla por el App Group o por la extensión del widget, anotar el
mensaje exacto de Xcode: es el punto 1 de 10.8.

| Paso | Qué hacer | Resultado esperado |
|---|---|---|
| 1 | Abrir la app | Arranca, conserva los datos y muestra Inicio con «En cuentas» |
| 2 | Cuentas › Ajustes › Apple Pay y Atajos › «Enviar una captura de prueba» | Aviso «Captura de prueba enviada»; en la bandeja aparece una de 12,34 € |
| 3 | En la bandeja, «Completar», elegir categoría y Guardar | Se crea el gasto de 12,34 € y la captura desaparece de la bandeja |
| 4 | App Atajos › nueva acción › buscar «FinancialControl» | Aparecen «Registrar pago» y «Añadir gasto» |
| 5 | Crear un atajo con «Registrar pago», importe «5,00 €» y comercio «Prueba», y ejecutarlo con la app cerrada | El atajo termina con «Guardado en la bandeja» sin abrir la app. Si los avisos están permitidos, llega uno con «Prueba» y «5,00 €» |
| 6 | Tocar ese aviso | Se abre la app en la bandeja, con esa captura la primera y resaltada |
| 7 | Crear un atajo con «Añadir gasto», importe «3,00», una categoría que exista y una cuenta, ejecutarlo y abrir la app | Hay un gasto nuevo de 3,00 € en Movimientos |
| 8 | Crear la automatización siguiendo la guía y hacer un pago pequeño con Apple Pay | Llega una captura con el importe y el comercio del pago. Anotar qué texto exacto llega en cada campo |
| 9 | Cuentas › Ajustes › Avisos › activar «Cobros próximos» | El iPhone pide permiso una sola vez; la pantalla dice cuántos avisos quedan programados |
| 10 | Crear un fijo con día de mañana y esperar a las 9:00, con la app cerrada | Llega el aviso del cobro; tocarlo abre la confirmación de ese cobro |
| 11 | Anotar un gasto que lleve una categoría por encima del 80 % de su presupuesto | Llega un aviso de presupuesto, una sola vez |
| 12 | Mantener pulsada la pantalla de inicio › + › buscar FinancialControl | El widget «Disponible este mes» se ofrece en tamaño pequeño y mediano |
| 13 | Añadir el pequeño y tocarlo | Muestra la cifra y la fecha; al tocarlo se abre el alta de un gasto |
| 14 | Añadir el mediano | El botón «Añadir gasto» abre el alta; el resto abre Inicio |
| 15 | Anotar un gasto y volver a la pantalla de inicio | La cifra del widget ha cambiado |
| 16 | Plan › Fijos, con una suscripción de 9,99 € | El calendario muestra «9,99» en su día, no «10» |

Los pasos 8 y siguientes son, además, la medición pendiente del spike A.

### 10.10 Acciones del usuario

1. Instalar en el iPhone con `npx expo run:ios --device --configuration Release` y seguir
   la lista de 10.9.
2. Con la cuenta gratuita, repetir esa orden cada 7 días. Los datos se conservan al
   instalar encima; no borrar la app antes.
3. Hacer la medición del spike A con uso real y anotar los textos que entrega Atajos.

## 11. B3b · Navegación

### 11.1 Baseline (17/11/2026)

- Rama de partida: `b3-entrada-rapida` @ `4012009`. Rama nueva: `b3b-navegacion`.
- `git status`: limpio, salvo `docs/prompt-claude-code-b3b-navegacion.md` sin seguimiento (el encargo, que entra en el primer commit).
- `npm run check`: pasa. 672 pruebas en 28 suites.
- Esquema de la base de datos: versión 4. Este bloque no lo toca.
- Pestañas: Inicio, Movimientos, Análisis, Plan y Cuentas.
- Coincide con el apartado 1 del encargo.

### 11.2 Hecho por fase

| Fase | Commit | Qué |
|---|---|---|
| 0 | `58f247f` | Baseline y encargo |
| 1 | `a0bd3a1` | Mapa actual y mapa propuesto (`docs/notas/navegacion-b3b.md`) |
| 2 y 3 | `b6ee1dc` | Botón flotante de añadir en las cinco pestañas, «+» reservado, pantalla Ajustes y engranaje |
| 4 | `671affe` | Cuentas con el total, «Nueva cuenta» y la sección de inversiones |
| 5 y 6 | `25cba88` | Inicio en siete bloques, reubicación, «Pendiente», «Primeros pasos» y pruebas |
| 7 | `2f6552a` | Coherencia en el resto de pantallas |
| 8 | `a592a29` | Casos límite, capturas y enlace con la app cerrada |
| 9 | (este commit) | Documentación |

Las fases 2 y 3, y 5 y 6, comparten commit porque tocan los mismos ficheros
(Inicio y Cuentas) y no se podían separar sin dejar un estado intermedio roto.

Vía del botón de añadir: flotante. `NativeTabs` no documenta ningún botón de
acción dentro de la barra (ver `docs/notas/navegacion-b3b.md`, 2.1).

### 11.3 Pruebas

- Había 672 en 28 suites. Hay **720 en 29**. `npm run check` pasa entero.
- Nuevas: `src/pruebas/__tests__/navegacion.test.tsx` (48).
- Pruebas de dominio y de datos: sin tocar.
- Antiguas de pantalla que cambiaron, todas porque comprobaban un bloque o
  un acceso en el sitio del que este bloque lo movió. Ninguna se borró:

| Fichero | Prueba | Motivo |
|---|---|---|
| `b3.test.tsx` | Accesos a Categorías y Apple Pay | Pasan del pie de Cuentas a Ajustes |
| `inicio.test.tsx` | Sin cuentas | «Crear cuenta» es ahora el primer paso de «Primeros pasos»; los estados vacíos del gasto y la evolución se miran en Análisis › Mes |
| `inicio.test.tsx` | Saldo y cambio del mes de cada cuenta | Saldo en Cuentas; cambio del mes en el detalle. Mismas cifras |
| `inicio.test.tsx` | Gasto por categoría (3 pruebas), mes anterior, mes futuro, barras | El reparto, el balance de otro mes y la evolución están en Análisis › Mes. Mismas cifras |
| `inicio.test.tsx` | Tocar una cuenta abre su detalle | La fila está en Cuentas y ya no pasa el mes: el detalle empieza en el mes en curso, que es el que Inicio enseña |
| `inicio.test.tsx` | Cuenta archivada | La lista está en Cuentas, donde las archivadas van tras «Mostrar las cuentas archivadas» |
| `h3.test.tsx` | Selector de mes y patrimonio; Inicio en el mes pedido | El selector de mes está en Análisis › Mes |
| `h3.test.tsx` | Bloque Hoy | «Gastado hoy» es una línea de «Este mes»; la media diaria se mira en Análisis › Día |
| `h3.test.tsx` | Bloque de inversiones | Está en Cuentas, con las mismas cifras |
| `h3.test.tsx` | Fila de un mes en la vista Año | Abre Análisis › Mes en ese mes, no Inicio |
| `h5.test.tsx` | Estados vacíos y fin de mes previsto (2 pruebas) | El fin de mes previsto está en Plan › Presupuesto |
| `h5.test.tsx` | «Ver» del aviso y «Ver todos» de objetivos | El salto lleva ahora una marca de petición; en Inicio caben dos objetivos, no tres (D-f) |
| `h5.test.tsx` | Conserva todo lo que Inicio mostraba | Se comprueba cada bloque en Inicio o en su pestaña nueva |

### 11.4 Decisiones tomadas sin consultar

- **Inicio sin selector de mes.** Habla de hoy y del mes en curso. El balance
  con selector de mes se llevó entero a Análisis › Mes para no perder el
  balance de meses pasados, que no existía como cifra en ningún otro sitio.
- **La tabla del año** de Análisis abría Inicio en un mes; ahora abre
  Análisis › Mes en ese mes.
- **Fin de mes previsto** se muestra en Plan › Presupuesto solo cuando se
  mira el mes en curso, porque habla de hoy.
- **«Primeros pasos»: el tercer paso es «tener algún presupuesto»**, no «el
  del mes en curso». Si no, la tarjeta volvería cada día 1. Para saberlo se
  añadió una consulta de lectura, `presupuestos.hayAlguno()`. No toca el
  esquema.
- **«Primeros pasos» va el último**, como fija D-f. Observación: en una app
  recién instalada queda por debajo de tres bloques vacíos y hay que
  desplazar para verla. Subirla mientras falte la cuenta sería mejor; no se
  hizo por respetar el orden acordado.
- **Límites de «Pendiente»**: tres cobros y tres avisos de presupuesto, con
  «Ver todos (N más)»; los pagos por revisar son siempre una fila con el
  total.
- **«Ver todos» aparece siempre** que el bloque tiene elementos, no solo
  cuando sobran, para que el camino a la sección sea fijo.
- **Diagnóstico se ve siempre en Ajustes**, también en Release (D-e lo
  incluye). Antes solo se enlazaba en desarrollo.
- **Marca de petición** en los saltos a Plan y Análisis, para corregir que
  pedir dos veces la misma sección no hiciera nada la segunda vez.
- **Pestañas como base de la pila** (`unstable_settings.anchor`), para el
  enlace con la app cerrada.
- **«Patrimonio neto» pasa a llamarse «Lo que tienes»** en Cuentas, como en
  Inicio y en su pantalla. «Añadir cuenta» y «Añadir gasto fijo» pasan a
  «Nueva cuenta» y «Nuevo gasto fijo».

### 11.5 Casos límite

| Caso | Cómo se comprobó |
|---|---|
| App sin datos | Prueba y captura: «Primeros pasos» con 0 de 3 y cada bloque vacío con su texto |
| Con cuenta sin movimientos; con movimientos sin presupuesto; los tres hechos | Pruebas, sobre la misma base que va creciendo |
| Nada pendiente | Prueba: el bloque no existe |
| Mucho pendiente (más de 5 cobros, 12 pagos, 4 avisos) | Prueba: 3 cobros, 1 fila de pagos, 3 avisos y los «Ver todos» con su número |
| Sin objetivos ni gastos fijos | Prueba y captura: estado vacío con su acción |
| Última fila visible bajo el botón de añadir | Capturas del final de Movimientos, Plan y Cuentas. Con 500 filas: NO DEMOSTRADO (la base de ejemplo tiene unas decenas; el margen final es el mismo sea cual sea el largo) |
| Calendario de Análisis y formularios con teclado | El botón no está en las hojas modales. Calendario: NO DEMOSTRADO en captura |
| Hoja modal abierta | Captura: el botón queda debajo de la hoja |
| `financialcontrol://movimiento` con la app cerrada | Captura. Destapó un defecto, corregido (11.4) |
| El mismo enlace con la app en una pestaña | Captura sobre Cuentas. Las otras cuatro pestañas: NO DEMOSTRADO una a una; el alta es la misma pantalla de la pila raíz |
| Avisos de cobro, presupuesto, pagos y valor de inversión | Prueba: cada destino es una ruta que existe, con sus parámetros. Tocar el aviso real: NO DEMOSTRADO |
| «Ver todos» y volver | Prueba del salto. Volver es tocar la pestaña de origen, que conserva su posición: NO DEMOSTRADO con el dedo |
| Texto al máximo | Capturas de la barra, Ajustes e Inicio. Selector de segmentos al máximo: ya comprobado en H3 y H5, no se repitió |
| Modo oscuro | Capturas de las cinco pestañas, Ajustes e Inicio sin datos |
| Rutas antiguas | Prueba: todas existen. `capturas` se abrió en frío en el simulador |

### 11.6 Regresión

- Ningún cálculo cambió: `git diff --stat b3-entrada-rapida` no incluye
  `src/dominio/`, `app.json`, `plugins/`, `app-intents/`, `src/widgets/`,
  `src/datos/migraciones.ts` ni `package.json`.
- Cada dato que salió de Inicio tiene prueba en su destino con la cifra que
  da `src/dominio`: balance, reparto del gasto, fin de mes previsto e
  inversiones.
- Las cifras de las capturas coinciden entre pantallas: 14.811,00 € en
  Inicio y en Cuentas; +400,00 € en «Este mes» y en Análisis › Mes.

### 11.7 Capturas

26 en `docs/capturas/b3b/`, todas miradas y hechas después del último cambio
visual, con datos de ejemplo:

- Claro y oscuro: Inicio (arriba y abajo), Inicio sin datos, Movimientos al
  final de la lista, Análisis › Mes, Plan › Presupuesto, Cuentas con
  inversiones y Ajustes.
- Solo en claro: Plan al final (fin de mes previsto), Plan › Fijos con
  «Nuevo gasto fijo», Cuentas arriba, el alta sobre una pestaña, el alta y
  la bandeja abiertas con la app cerrada.
- Texto al máximo: barra de pestañas, Ajustes e Inicio.

Las capturas desplazadas se hicieron con un código temporal de
desplazamiento que no está en la rama.

### 11.8 Limitaciones

- El botón flotante tapa lo que haya en su esquina mientras no se desplaza
  la lista, por ejemplo la flecha de una fila. Es inherente a un botón
  flotante; el margen final deja ver y tocar la última fila.
- «Bandeja» y «Pagos por revisar» siguen siendo dos nombres para lo mismo
  (ver `docs/notas/navegacion-b3b.md`, 4).
- Inicio no tiene título «Inicio»: su cabecera es «Lo que tienes», como fija
  D-f.
- Con el texto al máximo, la frase del balance y la cabecera de Inicio
  crecen mucho. Nada se corta. Ya era así antes.

### 11.9 NO DEMOSTRADO

- Nada de esto se ha visto en el iPhone. La app instalada en Release sigue
  siendo la de B3 hasta que se reinstale.
- Los toques se contaron en pruebas, no con el dedo.
- VoiceOver leyendo el botón de añadir, el engranaje y los accesos nuevos:
  las etiquetas están y tienen prueba, pero no se han oído.
- Que el botón flotante quede a la altura correcta sobre la barra en el
  iPhone del dueño. En el simulador (iPhone 17) queda bien.
- Los casos marcados arriba.

### 11.10 Acciones del usuario

1. Reinstalar en el iPhone: `npx expo run:ios --device --configuration Release`.
   Los datos se conservan al instalar encima; no borrar la app antes. Este
   bloque es solo JavaScript: no cambia nada nativo.
2. Comprobar con el dedo: el «+» en las cinco pestañas, el engranaje, la
   fila de «Pendiente», el widget con la app cerrada y que la última fila de
   Movimientos se puede tocar.

## 12. B3c · Apariencia

### 12.1 Baseline (18/11/2026)

- Rama de partida: `b3b-navegacion` @ `5a5b515`, árbol limpio. Rama nueva: `b3c-apariencia`.
- `npm run check`: pasa. 720 pruebas en 29 suites.
- Coincide con el encargo.

### 12.2 Hecho

- Apartado «Apariencia» en Ajustes, el primero, con el selector de segmentos
  de siempre: Automático, Claro y Oscuro. Debajo, una frase que dice qué
  hace la opción elegida.
- La elección se aplica con `Appearance.setColorScheme` de React Native:
  `'light'`, `'dark'` y, para volver a seguir al iPhone, `'auto'`, que es el
  valor que documenta React Native 0.88 («Passing 'auto' removes any
  override, restoring the system preference»). `useColorScheme()` y
  `useColores()` reciben el cambio; ninguna pantalla se ha tocado para leer
  el tema.
- Se guarda en el almacén de clave y valor de expo-sqlite, el mismo de las
  preferencias de avisos, con su propia clave (`apariencia`). No va en la
  base de datos financiera.
- Se lee de forma síncrona al cargar `src/app/_layout.tsx`, antes del primer
  pintado.

Archivos: `src/lib/apariencia.ts` (opciones y lectura de lo guardado),
`src/lib/almacenDeApariencia.ts` (dispositivo), `src/estado/apariencia.ts`
(aplicar, guardar y hook), `src/app/ajustes.tsx`, `src/app/_layout.tsx`,
`src/i18n/es.json` y un comentario en `src/theme/index.ts`.

### 12.3 Decisiones tomadas sin consultar

- **Fichero propio en lugar de ampliar `src/lib/preferencias.ts`.** Varias
  pruebas antiguas sustituyen ese módulo entero; ampliarlo obligaba a
  tocarlas. Usa el mismo almacén.
- **Barra de estado.** En el simulador se vio que, en las pantallas apiladas
  (Ajustes, la bandeja…), la hora y la batería seguían al sistema y no a la
  elección: con «Oscuro» y el iPhone en claro quedaban oscuras sobre fondo
  oscuro. Se fija `statusBarStyle` en la pila raíz según el tema que se ve.
- **Con «Automático» guardado no se llama a la API al arrancar**: es lo que
  iOS hace por defecto.
- **Si guardar falla**, la elección se aplica igual y dura hasta cerrar la app.

### 12.4 Pruebas

- Había 720 en 29 suites; hay **748 en 31**. Ninguna de las 720 se ha tocado.
- `src/lib/__tests__/apariencia.test.ts`: lectura y escritura, y once
  valores no válidos (vacío, desconocido, corrupto, otro tipo) que se leen
  como «Automático»; fallo del almacén al leer.
- `src/pruebas/__tests__/apariencia.test.tsx`: el apartado es el primero,
  las tres opciones, cuál está elegida para el lector de pantalla, cada
  opción llama a la API con su valor y se guarda, «Automático» se recupera
  con `'auto'`, y lo guardado se aplica al arrancar.

### 12.5 Casos probados

| Caso | Cómo |
|---|---|
| Cada opción cambia la app al instante | Simulador: capturas de Ajustes en las tres, sin reiniciar. Prueba |
| Sobrevive a cerrar y abrir | Simulador: «Oscuro» con el sistema en claro y «Claro» con el sistema en oscuro, cerrando la app; al abrir, la primera pantalla de la app ya sale con el tema elegido. Prueba |
| «Automático» sigue al sistema; «Claro» y «Oscuro» no | Simulador, cambiando el modo del sistema en cada caso |
| Volver a «Automático» | Simulador: con el sistema en oscuro pasa de claro a oscuro, y al poner el sistema en claro vuelve a claro |
| Preferencia vacía, corrupta o desconocida | Prueba |
| Hoja modal abierta | Simulador: el alta de movimiento y su teclado numérico (que es de la app) cambian. Se cambió el tema con la hoja abierta y la hoja y la pantalla de debajo cambiaron |
| Gráficos | Simulador: anillo y barras de presupuesto con los colores del tema elegido. Línea y calendario: NO DEMOSTRADO en captura; usan `useColores()` igual que el anillo |
| Barra de pestañas y barra de estado | Simulador |
| Texto al máximo | Captura: las tres opciones caben en una línea |
| VoiceOver | Prueba: cada opción es una pestaña con su estado «seleccionada». No se ha oído |

### 12.6 Capturas

Diez en `docs/capturas/b3c/`, todas miradas y hechas con el código final:
Ajustes en «Automático» (sistema claro y oscuro), en «Oscuro» con el sistema
en claro, en «Claro» con el sistema en oscuro, la vuelta a «Automático» y el
texto al máximo; Inicio, Análisis y el alta en «Oscuro» con el sistema en
claro; Plan en «Claro» con el sistema en oscuro.

Como el simulador no deja tocar, la opción se eligió con un parámetro
temporal de la ruta que llamaba a la misma función que el selector. Ese
código no está en la rama.

### 12.7 Limitaciones

- **El widget y los avisos** los pinta iOS fuera de la app: siguen el modo
  del sistema, no la elección de Ajustes.
- **La pantalla de carga** que iOS muestra antes de que arranque la app
  también sigue al sistema. Con «Oscuro» y el iPhone en claro se ve un
  instante en blanco antes de la primera pantalla. Cambiarlo exige tocar
  `app.json`, vetado en este bloque.
- **El teclado del sistema** (el de buscar o el de escribir un nombre): NO
  DEMOSTRADO. El simulador no lo saca sin tocar un campo. La API lo cubre
  según la documentación.

### 12.8 NO DEMOSTRADO

- Nada se ha visto en el iPhone.
- Tocar el selector con el dedo: en el simulador se eligió por otra vía.
- VoiceOver leyendo la opción elegida.
- El teclado del sistema, y la línea y el calendario, con el tema elegido.

### 12.9 Acciones del usuario

Reinstalar con `npx expo run:ios --device --configuration Release`. Es solo
JavaScript; los datos se conservan al instalar encima.

---

## 13. B4a · Seguridad local — rama `b4a-seguridad-local`

### 13.1 Baseline (18/11/2026)

- Rama de partida: `b3c-apariencia`, commit `781b0c7`. Rama nueva: `b4a-seguridad-local`.
- `npm run check`: pasa entero. **748 pruebas en 31 suites.**
- Esquema de la base de datos: versión 4 (`src/datos/migraciones.ts`).
- `git status`: limpio salvo `docs/prompt-claude-code-b4a-seguridad-local.md` sin seguimiento
  (el encargo de este bloque).
- **Diferencia con el encargo:** el encargo dice 720 pruebas en 29 suites. Esa era la cifra de
  `b3b-navegacion`; el commit `781b0c7` (B3c) añadió 28 pruebas en 2 suites. Rama y commit
  coinciden, así que se sigue. Las «pruebas de partida» de este bloque son las 748.

### 13.2 Hecho por fase

| Fase | Qué | Commit |
|---|---|---|
| 0 | Baseline y lectura | `9ebde7f` |
| 1 | Auditoría con OWASP MASVS v2.1.0: `docs/seguridad/auditoria-4a.md`. 20 hallazgos: 0 críticos, 0 altos, 5 medios, 7 bajos, 8 informativos | `97b1f8c` |
| 2 | Validación única de parámetros de ruta (`src/dominio/entradas.ts`) en las catorce pantallas, lista de rutas permitidas para los avisos y limpieza de los textos de Atajos en TypeScript y en Swift | `6852333` |
| 3 | Bloqueo de la app: reglas puras (`src/dominio/bloqueo.ts`), capa sobre expo-local-authentication (`src/lib/autenticacion.ts`), estado (`src/estado/seguridad.ts`), pantalla de bloqueo por encima de toda la app (`src/componentes/seguridad/`) y Ajustes › Seguridad (`src/app/seguridad.tsx`) | `3374a8b` |
| 4 | Modo privado: un ajuste en las preferencias del sistema que leen la app y Swift; al widget le llega dentro de sus datos. Avisos, widget, aviso de captura y cubierta del selector de apps. Incluye las pruebas de bloqueo y modo privado | `2b2afcf` |
| 5 | `docs/seguridad/modelo-de-amenazas.md`: activos, adversarios, defensas, 30 requisitos para 4b y 10 preguntas abiertas | `89d945f` |
| 6 | Casos límite, capturas y regresión | `ef48154` |
| 7 | Documentación: este apartado, `07` (bloque 4 en 4a, 4b y 4c), `09` (D10 y D11) y README (Seguridad) | el commit «fase 7» |

Dependencia añadida: `expo-local-authentication ~58.0.3`, con su plugin en `app.json` para
el texto de uso de Face ID. Ninguna otra.

### 13.3 Cómo funciona

**Entradas.** Cada pantalla lee sus parámetros con `leerParametros(useLocalSearchParams(),
esquema)`. El esquema dice qué es cada uno: identificador (UUID), mes, día, año, valor de
una lista, marca de petición, cantidad o texto libre acotado. Lo que no valida vale `null` y
la pantalla abre su estado por defecto. Una prueba recorre `src/app/` y falla si alguna
pantalla lee parámetros de otra forma.

**Bloqueo.** Es una barrera de acceso a la interfaz: **no cifra nada** y ninguna clave
depende de la biometría. La preferencia se lee sin esperar al cargar la raíz de la app, así
que con bloqueo lo primero que se pinta es la pantalla de bloqueo. Al pasar a segundo plano
se anotan la hora y un reloj que solo avanza; al volver, `tocaBloquear` decide. La pantalla
de bloqueo se pinta en una ventana por encima de todo (`FullWindowOverlay`), también de las
hojas modales, y el contenido sigue montado debajo: un enlace o un aviso abren su pantalla
ahí y solo se ve tras autenticarse. La cola de Atajos y los avisos quedan fuera de la
puerta y siguen trabajando con la app bloqueada.

**Modo privado.** Se guarda en las preferencias del sistema (`UserDefaults`, clave
`modoPrivado`) porque es el único sitio que también lee el código Swift del aviso de
captura. Al cambiarlo se rehacen todos los avisos programados y se reenvía el dato del
widget, que pasa a ser «•••»: la cifra deja de salir de la app.

### 13.4 Decisiones tomadas sin consultar

1. **Baseline con 748 pruebas y no 720.** Rama y commit coincidían; la diferencia era la
   cifra de B3b en el encargo. Se siguió.
2. **Identificador malformado = «No encontrado», no alta.** El encargo pide que lo que no
   valide abra el estado por defecto. Para el identificador de lo que la pantalla abre
   (`movimiento?id=`, `cuenta?id=`…) el estado elegido es «ya no existe», con su botón de
   volver, y no el formulario de alta. Motivos: una prueba antigua lo exige así
   (`h3.test.tsx`, «un valor que no existe lo dice…») y no se pueden tocar; y es más seguro
   que un enlace de edición estropeado no se convierta en un alta. Vacío (`?id=`) sí abre
   el alta. Los parámetros que solo ajustan la pantalla (mes, sección, vista, filtros) se
   ignoran sin más.
3. **Un parámetro repetido en la URL se ignora**, aunque sus dos valores sean válidos: no
   se sabe cuál se quería.
4. **Preferencia de bloqueo corrupta = bloqueo activo y sin espera.** Si hay algo guardado
   es porque la persona pasó por Seguridad; ante la duda se pide autenticación de más. No
   deja a nadie fuera: se entra con la cara, la huella o el código, como siempre. Si no hay
   nada guardado (instalación nueva) no hay bloqueo.
5. **iPhone que se queda sin código ni biometría con el bloqueo activo: se entra**, y
   Seguridad lo avisa. No hay con qué autenticarse y mantenerlo cerrado dejaría los datos
   inaccesibles para siempre. Quitar el código del iPhone exige escribirlo.
6. **Activar y desactivar el bloqueo piden autenticación.** Al activar, comprueba que la
   persona puede desbloquear; al desactivar, evita que lo quite quien encuentre la app
   abierta.
7. **Al abrir la app desde cero se pide siempre**, sea cual sea la espera. La espera solo
   cuenta al volver de segundo plano.
8. **Dos relojes para la espera.** Además de la hora del iPhone se usa un reloj que solo
   avanza. Si la hora retrocede, o avanza menos que el otro reloj, se bloquea.
9. **Sin espera, la app queda bloqueada al salir, no al volver**, para que lo que iOS guarde
   para el selector de apps sea la pantalla de bloqueo.
10. **Los avisos solo llevan a cuatro rutas** (`/cobro`, `/plan`, `/capturas`,
    `/detalle-de-cuenta`), que son las que la app usa.
11. **La limpieza de textos de Atajos en TypeScript se hace en `src/estado/cola.ts`**, antes
    de llegar al dominio, porque `src/dominio/captura.ts` no se podía modificar.
12. **«Seguridad» es una fila propia en Ajustes**, fuera de la lista `ACCESOS_DE_AJUSTES`,
    porque dos pruebas antiguas fijan esa lista en cuatro elementos.
13. **En modo privado el título de todos los avisos es «FinancialControl»** y el cuerpo una
    frase fija por tipo.

### 13.5 Pruebas

- Antes: 748 en 31 suites. Después: **954 en 35 suites**. `npm run check` pasa entero.
- Nuevas (206): `src/dominio/__tests__/entradas.test.ts` (54),
  `src/pruebas/__tests__/entradas.test.tsx` (61), `src/dominio/__tests__/bloqueo.test.ts`
  (32) y `src/pruebas/__tests__/seguridad.test.tsx` (59).
- **Pruebas antiguas tocadas: ninguna.** El encargo permitía cambiar las que comprobaran un
  texto de aviso; no hizo falta, porque el modo privado entra por un parámetro opcional y
  sin él los textos son los de antes.

### 13.6 Prebuild y compilación

- `npx expo prebuild --clean --platform ios`: correcto.
- Entitlements de la app y del widget tras el prebuild: solo
  `com.apple.security.application-groups`. **Sin `aps-environment`.**
- `PRODUCT_BUNDLE_IDENTIFIER = es.juanantonio.financialcontrol`, sin cambios. Esquema
  `financialcontrol`, sin cambios.
- `Info.plist` gana `NSFaceIDUsageDescription` («FinancialControl usa Face ID para
  desbloquear la app.»), que pone el plugin de expo-local-authentication.
- `npx expo run:ios` para el simulador iPhone 17: **Build Succeeded, 0 errores**, dos veces
  (tras la fase 4 y tras el último retoque en Swift). La app se instala y abre.
- No se ha compilado para el iPhone físico ni se ha instalado nada en él.

### 13.7 Casos límite

«Prueba» es una prueba automática. «Simulador» es visto en una captura del iPhone 17
simulado, con datos de ejemplo.

| Caso | Resultado | Cómo |
|---|---|---|
| `movimiento?id=` vacío | Abre el alta | Prueba y simulador |
| `id` con texto, 10.000 caracteres, comillas y punto y coma, saltos de línea, emojis, `../` | «Este movimiento ya no existe», con «Cancelar». El texto no llega a ninguna consulta | Prueba (12 valores) y simulador |
| `id` con un UUID que no existe | «Este movimiento ya no existe» y se puede volver | Prueba |
| Lo mismo en `plan?seccion=&mes=` y `analisis?vista=&anio=` | Sección y vista por defecto | Prueba y simulador |
| Parámetro repetido dos veces | Se ignora | Prueba y simulador |
| Las catorce pantallas con los doce valores hostiles en cada parámetro | Ninguna falla, ninguna escribe en la base, ninguna navega | Prueba (se compara un volcado completo de la base) |
| Diez enlaces hostiles seguidos en el simulador | La app sigue viva y Metro no registra errores | Simulador |
| «Registrar pago» con comercio de 5.000 caracteres y caracteres de control | Se guarda limpio y con 200 caracteres como mucho | Prueba de la parte TypeScript |
| Lo mismo en Swift | El código compila y hace la misma limpieza | **NO DEMOSTRADO** ejecutando la acción: no se puede lanzar un atajo desde la línea de órdenes |
| Dispositivo sin código ni biometría | El interruptor aparece desactivado con su explicación; no se puede activar | Prueba |
| Biometría fallida tres veces | Sigue bloqueada, lo dice y deja reintentar | Prueba. Un fallo, en el simulador |
| Biometría cancelada | Sigue bloqueada, sin mensaje de error | Prueba |
| Biometría desactivada en el sistema, con código | Sigue bloqueada hasta autenticarse | Prueba de la regla. La hoja del código, NO DEMOSTRADO |
| Volver a los 30 segundos con los tres tiempos | Bloquea con «al instante»; no con 1 ni con 5 minutos | Prueba |
| Reloj hacia atrás en segundo plano | Bloquea | Prueba |
| Abrir por enlace con la app bloqueada | Se ve el bloqueo; tras Face ID, el destino (Plan › Fijos) | Prueba y simulador |
| Abrir por aviso o por el widget con la app bloqueada | Mismo camino que el enlace | Prueba de la puerta. Tocar un aviso o el widget, **NO DEMOSTRADO** |
| Acción de Atajos con la app bloqueada | La captura se guarda | Prueba de la importación. En un iPhone, NO DEMOSTRADO |
| Hoja modal abierta al bloquearse | No se ve detrás; vuelve tras autenticar | Simulador |
| Preferencia de bloqueo corrupta o desconocida | Arranca bloqueada y sin espera; se entra autenticándose | Prueba |
| Modo privado con avisos ya programados | Se rehacen los mismos avisos con textos sin importes ni nombres | Prueba |
| Modo privado con el widget colocado | El dato compartido pasa a «•••» / «Importes ocultos» | Prueba, y leído en el contenedor del grupo en el simulador. Ver el widget pintado, **NO DEMOSTRADO** |
| Aviso de captura desde Swift en modo privado | El código usa textos fijos y lee la misma clave | Prueba del código fuente. Ver el aviso, **NO DEMOSTRADO** |
| Selector de apps en claro y en oscuro | La cubierta se pinta al dejar de estar delante | Prueba. Verlo en el selector, **NO DEMOSTRADO** |

### 13.8 Capturas

Trece en `docs/capturas/b4a/`, todas miradas, con el código final y datos de ejemplo:

- Ajustes › Seguridad: `seguridad-desactivado-claro`, `seguridad-bloqueo-activo-oscuro`,
  `seguridad-todo-activo-claro`.
- Pantalla de bloqueo: `bloqueo-comprobando-claro`, `bloqueo-comprobando-oscuro`,
  `bloqueo-fallido-claro`, `bloqueo-cara-no-reconocida-oscuro` (con el diálogo de iOS).
- Bloqueo sobre una hoja modal: `bloqueo-sobre-hoja-modal-claro` y
  `hoja-modal-tras-autenticar-claro`.
- Enlace con la app bloqueada: `bloqueo-face-id-tras-enlace-claro` y
  `destino-del-enlace-tras-autenticar-claro`.
- «No encontrado»: `no-encontrado-claro` y `no-encontrado-oscuro`.

Sin captura del widget en modo privado: el simulador no deja colocar un widget desde la
línea de órdenes.

Cómo se hicieron sin poder tocar la pantalla: el bloqueo y el modo privado se activaron
escribiendo su preferencia en el almacén del simulador (la misma que escribe la app), y
Face ID se simuló con las notificaciones de `BiometricKit_Sim`. No se añadió código
temporal a la app.

### 13.9 Limitaciones

- **El bloqueo no cifra.** Con el iPhone desbloqueado y un ordenador de confianza, o con una
  copia sin cifrar, los ficheros se leen igual. Va a 4b (D10).
- Con esperas de 1 o 5 minutos, quien coja el iPhone dentro de ese tiempo entra.
- La espera se mide con la hora del iPhone y con un reloj que se para mientras el iPhone
  duerme. Quien retrase la hora lo justo, sin pasarse, puede alargar la espera si el iPhone
  ha dormido casi todo el rato. Con «al instante», que es el valor por defecto, no aplica.
- El modo privado no cambia los avisos que ya estén entregados en el centro de
  notificaciones: solo los programados y los nuevos.
- El aviso de captura lee el modo privado al ejecutarse la acción; si la app no se ha
  abierto nunca desde que se instaló, vale desactivado.
- La cola de Atajos sigue guardando la captura en claro hasta que se abre la app (A-10).
- Un filtro de Movimientos con un identificador válido que no existe muestra la lista
  vacía con su filtro, no un «No encontrado»: es una lista, y el filtro se quita con un toque.
- La pantalla de carga de iOS se ve un instante antes de la pantalla de bloqueo. No lleva
  datos.

### 13.10 NO DEMOSTRADO

- Nada en un iPhone físico.
- Face ID, Touch ID y el código reales; la hoja del código cuando la biometría falla.
- Que la vista del selector de apps quede cubierta. iOS toma esa imagen al salir; la app
  pinta la cubierta en cuanto iOS avisa, pero no se ha podido mirar el selector.
- Que no se vea ni un fotograma del contenido al volver de segundo plano. En el simulador
  las capturas tomadas a los tres segundos de volver muestran el bloqueo; no se ha grabado
  fotograma a fotograma.
- El widget pintando «•••» y los avisos en modo privado en la pantalla de bloqueo.
- El aviso de captura de Swift en modo privado y la limpieza de textos en Swift, en ejecución.
- VoiceOver sobre la pantalla de bloqueo.
- El teclado del sistema cerrándose al bloquear.

### 13.11 Lista de comprobación para el iPhone

Instalar con `npx expo run:ios --device --configuration Release`. Hay código nativo nuevo:
no basta con recargar. Los datos se conservan.

| # | Paso | Resultado esperado |
|---|---|---|
| 1 | Abrir la app sin tocar Seguridad | Todo igual que antes; no pide nada |
| 2 | Inicio › engranaje › Seguridad | Los dos interruptores apagados |
| 3 | Encender «Pedir Face ID o código» | iOS pide permiso de Face ID la primera vez y luego la cara; el interruptor queda encendido y aparecen los tres tiempos, con «Al instante» elegido |
| 4 | Ir a la pantalla de inicio del iPhone y volver | Pantalla «App bloqueada»; Face ID abre |
| 5 | Abrir el selector de apps con la app delante | La tarjeta de la app muestra solo «FinancialControl», sin cifras |
| 6 | Bloqueada, taparse la cara para que Face ID falle | iOS ofrece reintentar y después el código del iPhone; con el código, entra |
| 7 | Bloqueada, pulsar «Cancelar» en Face ID | Sigue bloqueada, con el botón «Desbloquear» |
| 8 | Elegir «Tras 1 min», salir 20 segundos y volver | Entra sin pedir nada |
| 9 | Salir más de 1 minuto y volver | Pide Face ID |
| 10 | Cerrar la app del todo y abrirla | Pide Face ID aunque la espera sea de 5 minutos |
| 11 | Abrir «Nuevo movimiento», salir y volver (con «Al instante») | No se ve el formulario detrás del bloqueo; tras Face ID sigue ahí |
| 12 | Con la app bloqueada, tocar un aviso de cobro | Bloqueo primero; tras Face ID, la pantalla del cobro |
| 13 | Con la app bloqueada, tocar el widget | Bloqueo primero; tras Face ID, el alta de movimiento |
| 14 | Con la app cerrada y el bloqueo activo, ejecutar el atajo «Registrar pago» | Llega el aviso; al abrir y autenticarse, el pago está en la bandeja |
| 15 | Encender «Ocultar importes fuera de la app» y mirar el widget | «•••» e «Importes ocultos» |
| 16 | Con el modo privado, ejecutar «Registrar pago» | El aviso dice «Tienes un pago por revisar.», sin importe ni comercio |
| 17 | Con el modo privado y un fijo que avise hoy | El aviso dice «Tienes un cobro pendiente.» |
| 18 | Solo modo privado (bloqueo apagado): abrir el selector de apps | Tarjeta cubierta; al volver no pide nada |
| 19 | En Safari, abrir `financialcontrol://movimiento?id=hola` | «Este movimiento ya no existe», con «Cancelar» |
| 20 | En Safari, abrir `financialcontrol://plan?seccion=nada` | Plan en Presupuesto |
| 21 | Apagar el bloqueo | Pide Face ID antes de apagarlo |
| 22 | Con VoiceOver, bloquear la app | Solo se leen el nombre, el aviso de bloqueo y el botón |

### 13.12 Acciones del usuario

1. Reinstalar en el iPhone y pasar la lista de 13.11.
2. Revisar `docs/seguridad/auditoria-4a.md` y decidir si se aceptan los destinos «riesgo
   aceptado» (A-10, A-11, A-13, A-15, A-16, A-18).
3. Revisar las diez preguntas abiertas de `docs/seguridad/modelo-de-amenazas.md` antes de
   encargar el bloque 4b.

### 13.13 Búsqueda de secretos antes de subir

Repetida el 18/11/2026 con los patrones de `docs/seguridad/auditoria-4a.md`, apartado 6.1,
sobre los 51 commits de todas las ramas y sobre el árbol:

- **Una coincidencia, que no es un secreto:** la palabra `service_role` en
  `docs/seguridad/auditoria-4a.md`, en la línea que enumera los patrones buscados. Entró
  con el commit de la fase 1.
- Ninguna clave, token ni dirección de proyecto. El único fichero de entorno con
  seguimiento es `.env.example`, con valores de relleno.
- Control positivo: el recorrido encuentra las líneas que nombran `EXPO_PUBLIC_SUPABASE`.

---

## 14. B4b-1 · Cuenta y claves — rama `b4b1-cuenta-y-claves`

### 14.1 Baseline (18/11/2026)

- Rama de partida: `b4a-seguridad-local`, commit `3785b0a`. Coincide con el encargo.
- `npm run check`: pasa entero. **954 pruebas en 35 suites.**
- Esquema local: versión 4.
- `git status`: limpio salvo `docs/prompt-claude-code-b4b1-cuenta-y-claves.md` sin seguimiento
  (el encargo de este bloque).
- Docker: disponible (29.4.0, servidor en marcha). CLI de Supabase: no estaba instalada; se
  añade como dependencia de desarrollo del proyecto.
- No existe `.env`: las pruebas usan la instancia local de Supabase.
- **A-14 resuelto:** `expo` 58.0.26, `expo-router` 58.0.32, `expo-sqlite` 58.0.18 y
  `jest-expo` 58.0.15. `npx expo install --check`: «Dependencies are up to date». Tras
  actualizar, `npm run check` sigue en verde con las mismas 954 pruebas.
- `npx expo install --fix` añadió además por su cuenta el plugin `expo-sqlite` a `app.json`.
  Se revirtió: nadie lo pidió y toca la configuración nativa de la base local, que este
  bloque no puede cambiar.

### 14.2 PARADO: `react-native-libsodium` no compila con React Native 0.88

El encargo manda parar aquí (apartado 13) y dejar el diagnóstico y las alternativas, sin
adoptar ninguna. **Estado del bloque: `BLOCKED_BY_EXTERNAL_DEPENDENCY`.**

**Qué pasa.** `react-native-libsodium` 1.7.0 (la última publicada, del 09/02/2026) no
compila para iOS con React Native 0.88.1:

```
node_modules/react-native-libsodium/ios/Libsodium.mm:16:3
  unknown type name 'RCTCxxBridge'
node_modules/react-native-libsodium/ios/Libsodium.mm:17:18
  property 'runtime' not found on object of type 'RCTBridge *'
```

El paquete obtiene el motor de JavaScript a través de la clase `RCTCxxBridge`, del puente
antiguo de React Native. React Native 0.88 la ha eliminado.

**Los tres intentos.**

| # | Intento | Resultado |
|---|---|---|
| 1 | Compilar el paquete tal cual, tras `expo prebuild --clean` | Falla con los errores de arriba (6 errores) |
| 2 | Buscar una opción de React Native que conserve el puente antiguo (`RCT_REMOVE_LEGACY_ARCH=0`) o una versión del paquete que ya lo arregle | No existe. En el código de React Native 0.88 no queda ninguna declaración de `RCTCxxBridge` (el fichero se eliminó), así que ninguna opción la devuelve. La rama principal del paquete tiene el mismo código que la 1.7.0 |
| 3 | Evaluar, sin adoptarlo, el arreglo propuesto en el repositorio del paquete (PR #109), aplicándolo a mano en `node_modules` | **Compila y funciona.** Detalle abajo. Después se restauró el fichero original |

**Estado aguas arriba** (consultado el 18/11/2026 en GitHub, `serenity-kit/react-native-libsodium`):
incidencia #110 abierta, «iOS build fails with React Native 0.88 (Expo SDK 58): RCTCxxBridge
no longer exists», sin respuesta. PR #109 abierto desde el 17/10/2026, «read the JSI runtime
from the bridge proxy instead of RCTCxxBridge», de una persona ajena al equipo del paquete,
sin revisar y sin fusionar. Cambia un solo fichero (`ios/Libsodium.mm`, +7 −3): deja de usar
`RCTCxxBridge` y pide el motor al objeto que React Native 0.88 pone en su lugar. No toca
libsodium, ni el código C++ que la llama, ni el JavaScript.

**Lo que se vio con ese cambio aplicado a mano** (simulador iPhone 17, código temporal que
no está en la rama):

- Compilación: correcta, 0 errores.
- La biblioteca nativa da **exactamente los mismos resultados** que la de WebAssembly para
  todos los vectores de `src/cripto/__tests__/vectores.json`: sal, clave maestra, subclave
  de autenticación, subclave de envoltura, apertura del sobre por contraseña y del sobre por
  código, ida y vuelta, código nuevo y fallo con clave equivocada.
- Llavero (`expo-secure-store`, accesible tras el primer desbloqueo y solo en este
  dispositivo): guarda y devuelve un texto de 6.000 caracteres, y lo borra.
- Tiempo de Argon2id, tres medidas cada uno. **Es el procesador del Mac, no el de un iPhone.**

| Pasadas | Memoria | Simulador (nativa) | Node (WebAssembly) |
|---|---|---|---|
| 2 | 64 MiB (INTERACTIVE de libsodium) | 64–66 ms | 99 ms |
| 4 | 128 MiB | 277–289 ms | 321–337 ms |
| 6 | 128 MiB | 429–462 ms | 473–506 ms |
| 8 | 128 MiB | no medido | 648–731 ms |
| 3 | 256 MiB (MODERATE de libsodium) | 433–449 ms | 498 ms |

**Alternativas.** Ninguna está adoptada.

| | Alternativa | A favor | En contra |
|---|---|---|---|
| A | Esperar a que el paquete publique el arreglo | No se toca nada ajeno | Sin fecha. La incidencia lleva 8 días sin respuesta y el PR un mes. Mientras, la app no compila para iOS con la biblioteca |
| B | Aplicar ese cambio de 7 líneas con un plugin propio en `plugins/`, que solo actúe si el fichero es exactamente el esperado y que falle con un mensaje claro si no | Evaluado y funciona. Sin dependencias nuevas. El cambio es corto, se lee entero y no toca la criptografía. Sigue el patrón de `plugins/sin-push.js` | Mantenemos un parche sobre código nativo de la dependencia criptográfica. Hay que retirarlo cuando el paquete lo arregle. Es código de un tercero sin revisar por los autores: lo habríamos revisado nosotros |
| C | Instalar el paquete desde la rama del PR (dependencia de git fijada a su commit) | No hay parche propio | Pasamos a depender del repositorio de una persona desconocida para la biblioteca criptográfica. No evaluado en compilación |
| D | Otro paquete que envuelva libsodium | — | Es una dependencia fuera de las permitidas. **No evaluado ninguno**: no se ha comprobado que exista uno con las tres plataformas, Argon2id y soporte de React Native 0.88 |
| E | Un módulo nativo propio, pequeño, sobre libsodium | Control total | Dependencia nueva (libsodium para iOS) y un puente nativo que escribir, probar y mantener, y otro para Android. Mucho más trabajo y más superficie que B |

No es alternativa: usar en el iPhone la libsodium de WebAssembly. El motor de JavaScript de
la app (Hermes) no ejecuta WebAssembly. NO DEMOSTRADO en esta sesión; es lo que dice su
documentación.

**Recomendación** (la decisión es del dueño): **B**, como medida temporal y documentada, y
retirarla en cuanto se publique el arreglo. Es la única evaluada de principio a fin, y la
que menos cosas ajenas mete en el proyecto.

**Otras cosas que el dueño debe decidir, ya que hay que parar:**

1. **Parámetros de Argon2id.** El encargo pide entre 0,5 y 2 segundos. Con 4 pasadas y
   128 MiB, que es lo que hay ahora en `src/cripto/parametros.ts`, el simulador tarda 0,28 s:
   se queda corto. Propuesta: **8 pasadas y 128 MiB** (unos 0,65–0,75 s en este Mac; en un
   teléfono, más). Supera el mínimo de OWASP (19 MiB y 2 pasadas, o 46 MiB y 1). No se
   propone subir a 256 MiB porque la beta será en navegador y un navegador de móvil puede
   no conceder tanta memoria. NO DEMOSTRADO en un teléfono ni en un navegador.
2. **Longitud del código de recuperación.** Hoy son 14 grupos de 4 símbolos: 256 bits de
   secreto y 24 de control. El encargo pedía «al menos 160 bits». Con 256 el secreto sirve
   directamente de clave para la función de subclaves de libsodium, sin ningún paso
   intermedio diseñado por nosotros. Con 160 serían 9 grupos, más cómodos de copiar, a
   cambio de añadir un paso de BLAKE2b para estirarlo a 256.

### 14.3 Lo que sí está hecho y probado

| Fase | Qué | Estado |
|---|---|---|
| 0 | Baseline y paquetes de Expo al día | Hecho, commit `d8fbd96` |
| 1 | Diseño criptográfico por escrito | **Pendiente.** Los parámetros están en `src/cripto/parametros.ts` y los vectores se calculan con `node scripts/vectores-de-cripto.cjs`, pero el documento no está escrito |
| 2 | Módulo criptográfico `src/cripto/` | **Hecho en JavaScript, con 39 pruebas. Sin compilar en nativo** por el bloqueo |
| 3 | Esquema remoto y aislamiento | **Hecho.** Migración en `supabase/migrations/` y 33 pruebas contra la instancia local |
| 4 a 6 | Cuenta en la app, capturas, documentación | Sin empezar |

**Módulo criptográfico.** Capa sin estado sobre libsodium: Argon2id (`crypto_pwhash`),
subclaves (`crypto_kdf_derive_from_key`), XChaCha20-Poly1305, BLAKE2b (`crypto_generichash`)
para la sal y para el control del código, y el generador aleatorio de la biblioteca. No hay
ninguna primitiva escrita a mano; una prueba lo vigila. Solo `src/cripto/sodio.ts` carga la
biblioteca; otra prueba lo vigila.

Dos límites de la versión nativa del paquete, que el módulo ya respeta: los datos
autenticados del cifrado tienen que ser texto (no admite bytes), y `crypto_generichash`
solo funciona bien con bytes (con texto tiene un error).

**Esquema remoto.** Dos tablas, `claves_de_usuario` y `fila_cifrada`, con RLS activado y
forzado, políticas solo para el rol autenticado y sin ningún permiso para el anónimo. La
función `borrar_mi_cuenta()` no admite parámetros. `aviso_emitido` queda fuera de la lista
de tablas que se sincronizarán: dice qué avisos ha dado ya un dispositivo, y eso es de cada
dispositivo. Decisión propia.

**Pruebas.**

- `npm run check`: pasa entero. Antes 954 en 35 suites; ahora **993 en 36**.
- Antigua tocada: una. `src/pruebas/__tests__/seguridad.test.tsx`, «la única dependencia
  nueva del bloque es expo-local-authentication», que fija la lista completa de dependencias
  de la app. Se le añaden `react-native-libsodium` y `expo-secure-store` y se renombra a
  «las dependencias de la app son las autorizadas, y ninguna más». No es de las dos clases
  que el encargo permitía tocar, pero era inevitable: el propio encargo manda añadir esas
  dependencias. Sigue vigilando lo mismo.
- Aislamiento: **33 de 33**, contra la instancia local, solo con la clave pública. Para
  repetirlas:

  ```sh
  npx supabase start      # necesita Docker
  npx supabase db reset   # aplica las migraciones a la instancia local
  npm run test:remoto
  ```

  Comprobado además a mano: al crear una tabla sin RLS en el esquema público, la prueba del
  catálogo falla; al borrarla, vuelve a pasar.
- El analizador de seguridad de Supabase (`npx supabase db advisors`) no encuentra problemas.

**Dependencias añadidas.** `react-native-libsodium ^1.7.0` y `expo-secure-store ~58.0.3`; de
desarrollo, `supabase ^3.2.0` (la CLI) y `libsodium-wrappers-sumo ^0.8.4` (para las pruebas).

**Defecto propio corregido por el camino.** La primera versión de la migración usaba una
expresión regular con una repetición de 98 a 400, y Postgres no admite más de 255. Lo
detectaron las pruebas de aislamiento. Ahora la longitud se comprueba aparte.

**Efecto lateral en el simulador.** Al deshacer la evaluación se desinstaló la app del
simulador, y con ella sus datos de ejemplo. No afecta a ningún dato real ni al iPhone.
Habrá que volver a cargar datos de ejemplo para las capturas.

**Nada se ha aplicado al proyecto remoto de Supabase.** No se ha ejecutado `supabase login`,
`link` ni `db push`.

### 14.4 Reanudación del 21/11/2026: revisión del trabajo sin confirmar

La sesión del 18/11 se cortó en mitad de la fase 4. El dueño había decidido el bloqueo
(opción B, con condiciones; Argon2id con 64 MiB y 8 pasadas; código de 256 bits). El
trabajo que quedó sin confirmar se ha revisado como si fuera de otra persona.

- Estado al reanudar: rama `b4b1-cuenta-y-claves`, commit `4db59ce`, como decía el encargo
  de continuación. Docker disponible. Sin `.env`.
- **Respaldo:** `git stash push --include-untracked` y `git stash apply --index`. El stash
  queda como copia: **`stash@{0}`, identificador `27c3df33d795a758d75662b173ae2363a08b09b6`**,
  «respaldo B4b1 antes de revisar (21/11/2026)». No se borra.
- **`npm run check` tal como estaba: FALLA.** Formato, análisis y tipos pasan; de 1.054
  pruebas fallan 2:
  1. `cripto.test.ts`, «no hay primitivas a mano…»: el módulo llama a `randombytes_uniform`
     (para elegir qué dos grupos del código se piden) y la lista de la prueba no lo incluía.
  2. `cuenta.test.ts`, «ninguna petición lleva la contraseña…»: esperaba 5 peticiones y el
     recorrido hace 4. Error de la prueba.

**Revisión fichero a fichero.** Todos están enteros: ninguno termina a mitad de una función,
ninguna importación apunta a algo que no existe, y `tsc` pasa.

| Fichero | Veredicto | Detalle |
|---|---|---|
| `plugins/parche-libsodium.js` | Completo y correcto | Huella del original y del resultado, idempotente, falla con otra huella |
| `package.json`, `package-lock.json` | Completo y correcto | Versiones exactas `1.7.0` y `0.8.4`; `postinstall` |
| `app.json` | Completo y correcto | Plugin del parche añadido; se quitó el plugin vacío del paquete, que no hace nada |
| `src/cripto/parametros.ts` | Completo y correcto | 8 pasadas, 64 MiB, marcados como provisionales |
| `scripts/vectores-de-cripto.cjs`, `src/cripto/vectores.json` | Completo y correcto | Regenerados con los parámetros nuevos. El JSON se movió fuera de `__tests__` porque ahora lo lee la app |
| `src/cripto/autocomprobacion.ts` | Completo y correcto | Con 11 pruebas |
| `src/cripto/index.ts` | Completo y correcto | Añade `posicionesAlAzar` |
| `src/cripto/__tests__/cripto.test.ts` | **Incorrecto** | La prueba 1 de arriba. Corregida: `randombytes_uniform` entra en la lista permitida |
| `src/pruebas/__tests__/plugin.test.ts` | Incompleto | Faltaba comprobar que el paquete instalado está parcheado. Añadido |
| `docs/seguridad/diseno-criptografico.md` | Incompleto | Coincide con el código y con los vectores (comprobado con un programa: los 18 valores de `vectores.json` y las 7 constantes aparecen iguales). Faltaba el correo guardado en el llavero y lo que tarda la autocomprobación. Añadido |
| `docs/seguridad/riesgo-de-dependencia-libsodium.md` | Completo y correcto | |
| `src/lib/contrasena.ts` | Completo y correcto | |
| `src/lib/almacenSeguro.ts`, `almacenSeguroNativo.ts` | Completo y correcto | Llavero tras el primer desbloqueo, solo este dispositivo, sin biometría |
| `src/lib/supabase.ts` | Completo y correcto | Sesión en el llavero; sin renovación automática |
| `src/estado/cuenta.ts` | **Incorrecto** (un defecto) e incompleto | Ver abajo |
| `src/estado/cuentaDeLaApp.ts` | Completo y correcto | |
| `src/app/cuenta-de-usuario.tsx` | Completo, **sin pruebas** | Faltaban las pruebas de pantalla |
| `src/app/diagnostico.tsx` | Completo, sin pruebas | Ídem |
| `src/app/ajustes.tsx`, `src/app/_layout.tsx` | Completo y correcto | Entrada «Cuenta» y su ruta |
| `src/i18n/es.json` | Completo y correcto | 76 textos nuevos; comprobado con un programa que ninguno queda sin uso, que todo texto usado existe y que cada error de cuenta tiene su texto |
| `src/pruebas/cuentaDePrueba.ts` | Completo y correcto | |
| `src/pruebas/__tests__/cuenta.test.ts` | **Incorrecto** | La prueba 2 de arriba y una variable sobrante. Corregido |

**Defecto encontrado en `src/estado/cuenta.ts`.** Al arrancar, decidía si había cuenta
abierta preguntando la sesión al cliente de Supabase, y si no la obtenía borraba la clave
del llavero. Pero con la sesión caducada (dura una hora) y sin conexión, el cliente no
puede renovarla y responde que no hay sesión: **abrir la app sin cobertura habría borrado
la clave de datos del dispositivo.** En este bloque se recupera volviendo a entrar; en el
4b-2, con datos cifrados con esa clave, habría sido grave. Corregido: lo que dice si hay
cuenta abierta es la clave del llavero, sin consultar al servidor. El correo se guarda
junto a la clave. Con prueba («sin conexión y con la sesión caducada…»).

Otros dos cambios en ese fichero: el cierre local de sesión tiene ahora límite de tiempo, y
antes de derivar las claves se cede un instante a la pantalla para que pinte «Calculando
las claves…», porque la derivación ocupa el hilo de la interfaz.

**Condiciones de las decisiones del dueño, contra el código.**

| Decisión | Condición | Estado | Dónde |
|---|---|---|---|
| 1 | Versiones exactas, sin `^` ni `~` | Cumplida | `package.json`: `"react-native-libsodium": "1.7.0"`, `"libsodium-wrappers-sumo": "0.8.4"`. Prueba en `plugin.test.ts`, «las versiones… están fijadas» |
| 1 | Huella SHA-256 del original antes de parchear; si no coincide, falla con mensaje claro | Cumplida | `plugins/parche-libsodium.js`, función `parchear`: constante `HUELLA_ORIGINAL` y el error «no es el fichero esperado…» |
| 1 | Comprueba la huella del resultado | Cumplida | Misma función: `HUELLA_PARCHEADA` y el error «El resultado del parche no tiene la huella esperada» |
| 1 | Aplicarlo dos veces no cambia nada | Cumplida | Misma función, primera línea: si la huella ya es la parcheada, devuelve el contenido igual. Prueba «aplicarlo dos veces no cambia nada» |
| 1 | Texto legible, con origen, qué cambia, que no toca criptografía y cuándo retirarlo | Cumplida | Cabecera de `plugins/parche-libsodium.js` y lista `SUSTITUCIONES` |
| 1 | Autocomprobación antes de cualquier operación de cuenta; si falla, cuenta desactivada y el resto sigue | Cumplida | `src/cripto/autocomprobacion.ts`; `src/estado/cuenta.ts`, funciones `iniciar` y `operar` (fase `cripto_no_fiable`). Pruebas en `cripto.test.ts` («autocomprobación») y `cuenta.test.ts` («si la autocomprobación falla…») |
| 1 | Los dos límites del paquete en nativo, en el diseño y con prueba | Cumplida, con una corrección | `diseno-criptografico.md`, apartado 2.2; prueba «límites del paquete en nativo». **Corrección de lo dicho el 18/11:** BLAKE2b en nativo sí admite texto como mensaje; lo que no admite es texto como *clave* |
| 1 | Riesgo de mantenimiento anotado para el 4c | Cumplida | `docs/seguridad/riesgo-de-dependencia-libsodium.md` |
| 2 | Argon2id con 64 MiB y 8 pasadas | Cumplida | `src/cripto/parametros.ts`, constante `ARGON2ID` |
| 2 | Vectores regenerados | Cumplida | `src/cripto/vectores.json` |
| 2 | Escrito que son provisionales y se fijan antes de la primera cuenta real | Cumplida | Comentario de `ARGON2ID` y `diseno-criptografico.md`, apartado 3.2 |
| 2 | Diagnóstico mide la derivación sin mostrar claves | Cumplida | `src/app/diagnostico.tsx` (`medir-derivacion`) y `medirDerivacion` en `autocomprobacion.ts` |
| 3 | 256 bits, 14 grupos de 4 | Cumplida | `src/cripto/parametros.ts` |
| 3 | Detección de errores de transcripción | Cumplida | `src/cripto/index.ts`, `secretoDelCodigo`; pruebas «detecta un error de transcripción en cualquier símbolo» |
| 3 | Pantalla para guardarlo o imprimirlo | Cumplida | `src/app/cuenta-de-usuario.tsx`, botón `guardar-codigo`: abre la hoja de compartir de iOS, que incluye Imprimir y Guardar en Archivos |

**El mecanismo del parche (`postinstall`).** Se aplica en dos momentos: tras `npm install`
o `npm ci` (script `postinstall`) y en cada `expo prebuild` (plugin de `app.json`).

- `npm ci` desde cero, probado en una carpeta aparte con solo `package.json`,
  `package-lock.json` y el plugin: termina bien y deja el fichero con la huella parcheada.
- Con el fichero alterado, el parche se niega y sale con error.
- Tras `expo prebuild --clean` partiendo del fichero original: queda parcheado (apartado 14.6).
- Añadido: una prueba de `npm run check` comprueba que el paquete instalado tiene la huella
  parcheada. Así lo vigila también GitHub en cada subida.
- Hueco que queda: quien reinstale el paquete con `--ignore-scripts` y compile sin prebuild.
  En ese caso la compilación falla con «unknown type name 'RCTCxxBridge'»: falla, no pasa
  en silencio. No se ha añadido una tercera comprobación dentro de Xcode porque exigiría
  tocar el proyecto nativo para cubrir un caso que ya falla solo.

### 14.5 Cierre del bloque (22/11/2026)

**Estado: `COMPLETED_WITH_EXTERNAL_GATES`.** El informe completo está en
`docs/informes/b4b1-informe-final.md`.

| Fase | Qué | Commit |
|---|---|---|
| 0 | Baseline y paquetes de Expo al día | `d8fbd96` |
| 1 | Diseño criptográfico y riesgo de la dependencia | `2fab482` |
| 2 | Módulo criptográfico, compilado en nativo con el parche y con autocomprobación | `a089605` y `33b3930` |
| 3 | Esquema remoto con RLS y aislamiento | `4db59ce` |
| 4 | Cuenta en la app | `5d96bc6` |
| 5 | Capturas | `e4bf40d` |
| 6 | Documentación e informe | el commit «fase 6» |

- `npm run check`: **1.092 pruebas en 38 suites**, en verde.
- Remotas contra la instancia local: **41 de 41** (33 de aislamiento, 8 de la cuenta).
- Prebuild limpio y compilación para el simulador: correctos; sin `aps-environment`.
- Autocomprobación con la biblioteca nativa en el simulador: correcta. Argon2id (64 MiB, 8
  pasadas): 244–298 ms en el procesador del Mac.
- 13 capturas en `docs/capturas/b4b1/`.

### 14.6 Defectos encontrados y corregidos al terminar

1. **Arranque sin conexión borraba la clave** (apartado 14.4).
2. **La caché de red de iOS guardaba los tokens de la sesión en disco**, fuera del llavero
   (`Library/Caches/<app>/Cache.db`). Visto en el simulador. Corregido con
   `plugins/sin-cache-de-red.js`. Verificado después: ninguna coincidencia.
3. **Diagnóstico mostraba el mensaje interno del servidor** y leía una tabla que no existe
   en el esquema nuevo (hallazgo A-12). Rehecho.

### 14.7 Pendiente del dueño

`docs/seguridad/pasos-del-propietario-4b1.md`: aplicar las migraciones al proyecto remoto,
crear `.env`, desactivar la confirmación de correo, probar en el iPhone y fijar Argon2id.
No borrar el stash de respaldo (`27c3df3`) hasta dar el bloque por bueno.

## 15. B4b-2 · Sincronización cifrada — rama `b4b2-sincronizacion`

### 15.1 Baseline (22/11/2026)

- Rama de partida: `b4b1-cuenta-y-claves`, commit `2650f9c`, igual que en GitHub. Coincide
  con el encargo. Rama nueva: `b4b2-sincronizacion`.
- `npm test`: **1.092 pruebas en 38 suites**, en verde. `npm run lint` y `npm run typecheck`:
  sin avisos. Coincide con el encargo.
- Pruebas remotas (`npm run test:remoto`, instancia local): **41 pruebas en 2 suites**, en
  verde. Coincide.
- Esquema local: versión 4.
- Docker: disponible (29.0.1). CLI de Supabase 3.2.0. Instancia local arrancada.
- `git status` al empezar: `package-lock.json` modificado (una línea, `"hasInstallScript":
  true`, que npm añade porque el proyecto tiene `postinstall`; se confirma tal cual) y el
  encargo de este bloque sin seguimiento.
- **Una diferencia con el encargo, sin efecto en el código:** `npm run check` fallaba en su
  primer paso (`prettier --check`) por `supabase/.temp/linked-project.json`. Es un fichero
  que la CLI de Supabase dejó el 22/11 al enlazar el proyecto para aplicar la migración; git
  lo ignora y no pertenece a la rama. Se añade `supabase/.temp` a `.prettierignore` y
  `npm run check` pasa entero. No se ha leído ni tocado nada de esa carpeta. No se ha
  considerado motivo para parar: el código, las pruebas y el commit son los del encargo.
- **El proyecto está enlazado** (`supabase/.temp/project-ref`). En este bloque solo se usan
  órdenes que actúan sobre la instancia local (`start`, `status`, `db reset`, `db query`).
  Ninguna con `--linked` ni `--remote`, ni `db push`.
- Stash antiguo (`27c3df3`): comprobado que cada línea que añadía a los ficheros con
  seguimiento está en la rama, y que sus ficheros sin seguimiento están en la rama iguales
  o en una versión posterior (`cuenta.ts`, `cuenta.test.ts`, `almacenSeguro.ts` y el diseño
  criptográfico cambiaron después). Borrado.

### 15.2 Hecho por fase

| Fase | Qué | Commit |
|---|---|---|
| 0 | Baseline, lectura y borrado del stash antiguo | `485cc2c` |
| 1 | Diseño por escrito: `docs/seguridad/diseno-sincronizacion.md` | `ac21756` |
| 2 | Motor de sincronización en `src/sincronizacion/` y migración local 5 | `8662010` |
| 3 | Migración remota de `rls_auto_enable()` y pruebas contra la instancia local | `3287c00` |
| 4 | Integración en la app: cuándo se sincroniza, estado en Cuenta, entrada en una cuenta | `469ae8d` |
| 5 | Cambio de contraseña y actualización de parámetros de derivación | `2171cb3` |
| 6 | Exportación a JSON y CSV | `33371f3` |
| 7 | Casos límite, capturas y regresión | ver `git log` |
| 8 | Documentación, pasos del propietario e informe | ver `git log` |

### 15.3 Cómo funciona, en corto

- **Cola de cambios.** Disparadores de SQLite apuntan en `sinc_pendiente` cada alta y cada
  cambio de las doce tablas. Los repositorios no se han tocado.
- **Subida.** Cada fila pendiente se convierte en JSON, se rellena a múltiplos de 256 bytes
  y se cifra con la clave de datos; los datos autenticados llevan usuario, tabla e id. Va
  en lotes de 100 con `upsert`.
- **Bajada.** Por cursor de `actualizada_en` con 5 minutos de solape y paginación por clave.
  Lo ya conocido se descarta sin descifrar. Todo se aplica en transacciones.
- **Repaso completo.** En «Sincronizar ahora» y cada siete días: compara las marcas de
  todas las filas del servidor con las conocidas.
- **Entrada en una cuenta.** La base local se liga a una cuenta. Nube vacía: sube.
  Dispositivo sin datos: baja. Los dos con datos: pregunta.
- **Cambio de contraseña.** Tres pasos, con dos sobres en `clave_por_contrasena` durante
  el cambio. En cada momento una sola contraseña abre la cuenta entera.
- **Sin cuenta** la app no hace nada nuevo: al arrancar solo mira si el llavero guarda una
  clave.

### 15.4 Cambios en pruebas que ya existían

Ninguna prueba se ha debilitado. Se han cambiado cuatro porque lo que comprobaban ha
cambiado a propósito:

1. `migraciones.test.ts`: la lista de tablas de una base nueva incluye las cuatro `sinc_`.
2. `capturas.test.ts`: la prueba «de la versión 3 a la 4» aplica las migraciones hasta la
   4 (antes, todas, que eran hasta la 4), y la lista de versiones acaba en 5. La migración
   5 tiene su propia prueba sobre una base en versión 4 con datos en todas las tablas.
3. `cuentaPantalla.test.tsx`: dos comprobaciones exigían el texto «todavía no sincroniza
   nada» y que ningún texto dijera que se sincroniza. Ahora exigen que la pantalla diga,
   antes del alta, qué sale y qué ve el servidor, y que ningún texto prometa que los datos
   no se pueden perder.
4. `cuenta.test.ts`: un cliente de mentira de una prueba necesita el método `update` que
   ahora forma parte de la interfaz.

### 15.5 Defectos encontrados y corregidos durante el bloque

1. **Resta de la ventana del cursor.** Al restar la ventana a una marca de tiempo se
   perdían sus milisegundos (se redondeaba al segundo). Solo agrandaba la ventana, pero no
   era lo escrito. Lo encontró la prueba del cursor sin ventana.
2. **Una marca que retrocede se trataba distinto** en la bajada normal (se aplicaba) y en
   el repaso (se rechazaba). Unificado: no se aplica y se vuelve a subir la versión local.
3. **Una fila rechazada se contaba dos veces** cuando el ciclo hacía una segunda pasada de
   subida.
4. **Límite de inicios de sesión de la instancia local** (30 cada 5 minutos): las pruebas
   nuevas lo superan. Subido a 600 solo en `supabase/config.toml`.

### 15.6 Pruebas

| | Antes | Después |
|---|---|---|
| `npm test` | 1.092 en 38 suites | **1.236 en 49 suites** |
| `npm run test:remoto` (instancia local) | 41 en 2 suites | **81 en 5 suites** |
| `npm run lint`, `npm run typecheck`, `prettier --check` | sin avisos | sin avisos |

Las pruebas del apartado 8 del encargo y dónde están:

| Prueba | Fichero |
|---|---|
| A y B: alta, cambio y borrado en los dos sentidos | `supabase/pruebas/sincronizacion.test.ts` y `src/sincronizacion/__tests__/motor.test.ts` |
| Las doce tablas, campo a campo | los dos |
| Conflicto: gana la que sube después | los dos |
| Dos escrituras confirmadas fuera de orden | `supabase/pruebas/sincronizacion.test.ts`, con una transacción retenida en PostgreSQL de verdad; con ventana cero la prueba comprueba que la fila se pierde |
| Mil movimientos | `supabase/pruebas/sincronizacion.test.ts` |
| Sin conexión | los dos, y `sincronizador.test.ts` |
| Sobre manipulado, movido de id, de tabla o de usuario | los dos |
| El usuario C no ve nada de A | `supabase/pruebas/sincronizacion.test.ts` |
| Nada en claro: peticiones espiadas y tabla remota leída | `supabase/pruebas/sincronizacion.test.ts` |
| Entrada en una cuenta, los tres casos | los dos, y `sincronizacionPantalla.test.tsx` |
| Cambio de contraseña y filas que se siguen descifrando | `supabase/pruebas/contrasena.test.ts` |
| Corte en cada paso del cambio | `supabase/pruebas/contrasena.test.ts` (6 cortes) y `src/pruebas/__tests__/contrasena.test.ts` (7 cortes) |
| Versión de derivación 1 → 2 | los dos |
| Exportación JSON y CSV | `src/exportacion/__tests__/exportacion.test.ts` y `exportarPantalla.test.tsx` |
| Sin cuenta, igual que antes | `sincronizacionAutomatica.test.tsx`, y las 1.092 de partida |
| Migración local 5 sobre una base en versión 4 con datos | `src/sincronizacion/__tests__/migracion5.test.ts` |
| Migración remota de `rls_auto_enable()` | `supabase/pruebas/rls_auto_enable.test.ts` |

### 15.7 Prebuild y compilación

- `npx expo prebuild --clean --platform ios`: correcto.
- `npx expo run:ios` para el simulador: **Build Succeeded, 0 errores**, 1 aviso.
- Entitlements tras el prebuild: sin `aps-environment`. Identificador
  (`es.juanantonio.financialcontrol`) y esquema de URL (`financialcontrol`) sin cambios.
- Ninguna dependencia nueva. `expo-file-system`, que usa la exportación, ya venía con
  `expo` y ya estaba enlazada.

### 15.8 Capturas: NO HECHAS

No hay capturas de este bloque. Tras compilar, el simulador dejó de responder: instalar la
app, abrir una URL y hacer una captura se quedaban colgados, también después de reiniciar
el servicio del simulador. Se intentó en dos simuladores. **Ninguna pantalla nueva se ha
visto pintada en un simulador ni en un iPhone**; lo que hay son pruebas de pantalla con
`@testing-library/react-native`.

### 15.9 NO DEMOSTRADO

1. Dos dispositivos reales con la misma cuenta contra el proyecto remoto.
2. La app nueva arrancando en un simulador o en un iPhone: la migración local 5 sobre la
   base real, la sincronización al abrir y al volver de segundo plano (`AppState`), y la
   hoja de compartir con un fichero.
3. Que `Share.share` de iOS diga «compartido» al guardar en Archivos y «descartado» al
   cerrar la hoja, que es de lo que depende la copia previa a «Usar los datos de la nube».
4. Que `public.rls_auto_enable()` del proyecto remoto sea la que publica Supabase en su
   documentación. La prueba local usa esa definición.
5. Qué hace Supabase con las sesiones de otros dispositivos cuando tienen que renovarse
   tras un cambio de contraseña. Comprobado solo que no se cierran al momento.
6. El ajuste «Secure password change» del proyecto remoto.
7. Rendimiento con miles de filas en un iPhone. Mil movimientos se suben y se bajan en
   segundos en un Mac.
8. Una transacción del servidor que tarde más de 5 minutos en confirmarse.

### 15.10 Pendiente del dueño

`docs/seguridad/pasos-del-propietario-4b2.md`: aplicar la migración remota, instalar en el
iPhone y hacer la prueba con dos dispositivos. Informe: `docs/informes/b4b2-informe-final.md`.

## 16. B5 · Verificación en simulador y versión web — rama `b5-web`

### 16.1 Baseline (22/11/2026)

- Rama de partida: `b4b2-sincronizacion`, commit `f680e9f`, igual que en GitHub. Coincide
  con el encargo. Rama nueva: `b5-web`.
- `npm run check`: pasa entero. **1.236 pruebas en 49 suites.** Coincide.
- `npm run test:remoto` (instancia local): **81 pruebas en 5 suites**, en verde. Coincide.
- Esquema local: versión 5.
- Docker: disponible (29.0.1). Instancia local de Supabase arrancada para este bloque.
- `git status` al empezar: limpio salvo el encargo de este bloque, sin seguimiento.
- El proyecto sigue enlazado al remoto. En este bloque solo se usan órdenes contra la
  instancia local. Ninguna con `--remote`, ni `login`, `link`, `db push` o `config push`.

### 16.2 Parte A · Diagnóstico del simulador (fase 1)

**Hecho observado.** `xcrun simctl install` no terminaba (más de 240 s) en los simuladores
donde la app ya estaba instalada. Mientras tanto el simulador respondía: arrancaba en 4 a
10 s y dejaba hacer capturas de la pantalla de inicio.

**Datos del Mac.** 8 GiB de memoria y 8 núcleos. Al empezar el diagnóstico: intercambio a
6,0 de 7,2 GiB, disco de datos al 97 % (13 GiB libres) y un aviso de memoria del sistema
(`JetsamEvent`) a las 18:30, con la máquina virtual de Docker como mayor proceso (4,1 GiB).

| Hipótesis | Comprobación | Resultado |
|---|---|---|
| 1. Falta de memoria: Docker con los doce contenedores de Supabase, Metro, la compilación y el simulador no caben en 8 GiB | Supabase local reducido a cuatro contenedores (base, auth, REST y pasarela: de unos 2,4 GiB a unos 220 MiB). Nueva instalación con el 54 % de memoria libre | **No basta:** la instalación siguió sin terminar |
| 2. El instalador del simulador está ocupado | Muestreo de `installd` durante el cuelgue | Descartada: 0 % de CPU, parado esperando un mensaje |
| 3. Se atasca la **sustitución** de una app ya instalada | Registro del simulador: la instalación entra como «Install (Parallel Placeholder)» y no llega a «Success»; SpringBoard anota «Error resuming app replacement» (`IXErrorDomain` 34). En un simulador recién creado: desinstalar (3 s) e instalar de nuevo | **Confirmada una vez:** tras desinstalar, la instalación termina en **4 s**, con «Success (End) : Install» en el registro |

**Causa.** La más probable, vista una sola vez: en este Xcode (27.2, iOS 27.2) instalar
encima de una instalación existente se queda esperando; desinstalar antes lo evita. La
falta de memoria agrava todo pero no es la causa del cuelgue.

**Por qué se para aquí.** Mientras arrancaba el segundo simulador, con Docker en marcha,
el Mac se reinició. No sé si lo provocó esta carga; con 8 GiB es verosímil. El dueño indicó
seguir sin simuladores. Los dos simuladores creados para la prueba (`FC-A`, `FC-B`) están
borrados; no se ha tocado ningún otro.

**Fase 2 (prueba con dos simuladores): NO HECHA.** Sigue sin verse en ningún dispositivo:
la migración local 5 sobre una base real, la sincronización entre dos dispositivos, la
pregunta de entrada, el cambio de contraseña, la exportación y lo que devuelve la hoja de
compartir. No hay capturas en `docs/capturas/b4b2/`.

**Para quien lo retome**, en un Mac con más memoria o con Docker parado:
`xcrun simctl uninstall <dispositivo> es.juanantonio.financialcontrol` antes de cada
`install`, un solo simulador a la vez, y Supabase local con
`npx supabase start -x studio,logflare,vector,realtime,storage-api,imgproxy,edge-runtime,postgres-meta,mailpit,supavisor`.

### 16.3 Fase 3 · Dos decisiones cerradas

**D-b. Subir pregunta antes.** Un dispositivo con datos que entra en una cuenta con la
nube vacía ya no sube solo: Cuenta pregunta «¿Subir los datos de este dispositivo a tu
cuenta?». «Cancelar» deja la sesión abierta y la sincronización en pausa, sin subir ni
borrar nada; se vuelve a preguntar con «Sincronizar ahora» o al abrir la app. Un
dispositivo recién instalado (solo categorías iniciales sin tocar) sigue subiendo sin
preguntar: no hay datos de nadie. Si la nube recibe datos mientras la pregunta está
abierta, el «sí» ya no sube y pasa a hacerse la otra pregunta.

**D-c. Límite de los textos libres** (`src/dominio/textos.ts`): 200 caracteres en nombres
y comercio, 2.000 en notas. Se aplica en los repositorios, que es por donde entra todo.
Las pantallas ya limitaban lo que se teclea a 40–80 caracteres, así que quien usa la app
no nota nada. Un texto más largo que ya estuviera guardado no se recorta: se conserva
mientras no se cambie, y al editar ese movimiento la pantalla avisa. Una prueba cifra la
fila más grande posible de cada una de las doce tablas, en el peor caso de codificación, y
comprueba que ocupa menos de la mitad de lo que admite el servidor.

**Observado y no cambiado:** editar un movimiento desde su pantalla guarda `comercio` y
`nota` vacíos, porque el formulario no los tiene y no los reenvía. Un movimiento nacido de
una captura pierde su comercio al editarlo. Es anterior a este bloque. Queda planteado en
el informe.

Pruebas tras la fase 3: **1.266 locales en 50 suites** y **81 remotas**, en verde.
