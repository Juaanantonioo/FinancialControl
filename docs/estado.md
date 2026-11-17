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
