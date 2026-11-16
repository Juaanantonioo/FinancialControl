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
