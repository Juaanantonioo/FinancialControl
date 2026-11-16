# Prompt para Claude Code · Rediseño visual e Inicio con dashboards

Fecha: 16/11/2026. Sustituye a cualquier instrucción anterior sobre el aspecto de la app.
Se ejecuta en el repositorio `~/Desktop/FinancialControl`.

```
======================================================================
1. CONTEXTO
======================================================================
FinancialControl es una app de finanzas personales hecha con React Native y Expo
(TypeScript), primero para iOS. Los hitos H0, H1 y H2 están hechos en tres ramas
locales sin fusionar: `h0-preparacion`, `h1-spike-apple-pay` y
`h2-nucleo-movimientos`. La rama de trabajo actual es `h2-nucleo-movimientos`.

El usuario ha probado H2 en su iPhone el 16/11/2026. Su valoración literal:
"funciona pero de forma muy básica", "tiene un diseño sobrio" y "no disponemos de
ningún dashboard". Pide mejorar la vista y la organización, que la app sea más
vistosa y más fácil de entender, y que tenga dashboards con el balance del mes,
por cuenta y global, sobre un fondo claro y vistoso.

Estado del código comprobado por inspección el 16/11/2026 (verifícalo, no lo des
por bueno):
- Pestañas actuales: Movimientos (`src/app/(tabs)/index.tsx`) y Cuentas
  (`src/app/(tabs)/cuentas.tsx`), con `NativeTabs` de `expo-router/native-tabs`.
- Otras pantallas: `movimiento.tsx`, `cuenta.tsx`, `categorias.tsx`,
  `diagnostico.tsx`.
- Tema en `src/theme/index.ts`: colores semánticos claro y oscuro, `Espacio` y
  `TactilMinimo`. El fondo claro es gris plano `#F2F2F7`.
- Componentes en `src/componentes/` (`basicos.tsx`, `FilaDeMovimiento.tsx`,
  `TecladoDeImporte.tsx`).
- Cálculo en `src/dominio/saldo.ts`: `efectoEnCuenta`, `calcularSaldo` y
  `gastoDelMes`. Los saldos se calculan, no se guardan.
- `Categoria` ya tiene los campos `icono` y `color`, los dos opcionales.
- No hay ninguna biblioteca de gráficos instalada. `react-native-svg`,
  `react-native-reanimated` y `expo-linear-gradient` NO están en `package.json`.
- Dependencias: `expo ~58.0.25`, `react-native 0.88.1`, `react 19.3.0`.
- `AGENTS.md` obliga a consultar la documentación de Expo de la versión instalada
  antes de usar cualquier API de Expo o React Native. Cúmplelo.

Estado de la carpeta `ios/` (importante):
- El usuario la abrió en Xcode y cambió a mano tres cosas para instalar en su
  iPhone con cuenta gratuita: eligió su Personal Team, quitó la capacidad Push
  Notifications y, posiblemente, puso User Script Sandboxing en No.
- En Xcode aparece una referencia rota a `../app-intents`, que pertenece a la
  rama H1. Indica que `ios/` se generó desde otra rama.
- `ios/` no figura en `.gitignore`. Comprueba con `git status` y `git ls-files
  ios | head` si está versionada o sin seguimiento, y anótalo en el baseline.

======================================================================
2. OBJETIVO DE CIERRE
======================================================================
Abierto hoy: la app no tiene pantalla de Inicio ni gráficos, y su aspecto es
plano.

Debe quedar cerrado:
A. Un sistema visual nuevo, claro y con color, aplicado a todas las pantallas
   existentes sin cambiar su comportamiento.
B. Una pestaña Inicio con el dashboard del mes: balance global, balance por
   cuenta, gasto por categoría y evolución de los últimos meses.
C. Un detalle de cuenta con el resumen del mes de esa cuenta.
D. Una navegación más clara, con Inicio como primera pestaña.

Evidencia del cierre: pruebas automáticas en verde, capturas de pantalla en modo
claro y oscuro guardadas en el repositorio, y documentación actualizada.

Seguirá abierto después: presupuesto, gastos fijos, objetivos, captura con Apple
Pay integrada, cuentas de usuario y sincronización. Nada de eso entra aquí.

======================================================================
3. DECISIONES DEL USUARIO (16/11/2026)
======================================================================
- Quiere fondo claro y vistoso. El modo claro es la prioridad de diseño.
- Quiere dashboards con el balance del mes, por cuenta y global.
- Quiere que la app se entienda mejor al usarla y esté mejor organizada.
- Acepta inspirarse en otras apps de finanzas. No ha pedido copiar ninguna.

Todo lo demás de este prompt es propuesta de diseño razonada. Si algo de lo
propuesto choca con `docs/03-diseno-de-producto.md`, manda el documento salvo en
los puntos de esta sección, y la diferencia se anota en el informe.

======================================================================
4. LECTURA OBLIGATORIA ANTES DE TOCAR NADA
======================================================================
1. `AGENTS.md`.
2. `docs/03-diseno-de-producto.md` completo. Atiende a los apartados de
   arquitectura de información, navegación principal, pantallas P05, P09, P10 y
   P17, accesibilidad (apartado 8) y modo oscuro (apartado 9).
3. `docs/05-arquitectura-y-modelo-de-datos.md`, reglas de cálculo.
4. `docs/07-hoja-de-ruta-y-backlog.md`, hito H7 (T-080 a T-084).
5. `docs/09-decisiones.md` y `docs/estado.md`.
6. Todo `src/`. No supongas el contenido de un archivo por su nombre.

======================================================================
5. BASELINE
======================================================================
Antes de modificar nada, registra en un apartado nuevo de `docs/estado.md`:
- rama y último commit de partida
- resultado de `npm run check` (número de pruebas y si pasan)
- salida de `git status` resumida, con el estado de `ios/`
- versiones instaladas de expo, react-native y react
- capturas del aspecto actual (ver apartado 11) en `docs/capturas/antes/`

Crea la rama `h2b-rediseno-inicio` a partir de `h2-nucleo-movimientos`. No
trabajes sobre `h2-nucleo-movimientos` ni sobre `main`. No fusiones ramas. No
subas nada a GitHub.

Si `npm run check` falla antes de empezar, PARA e informa. No arregles el
baseline dentro de esta tarea.

======================================================================
6. ALCANCE
======================================================================
DENTRO
- Tema visual nuevo y componentes reutilizables.
- Pestaña Inicio con el dashboard del mes.
- Detalle de cuenta con resumen del mes y movimientos de esa cuenta.
- Aplicar el tema a Movimientos, Cuentas, alta y edición de movimiento, edición
  de cuenta y categorías.
- Corregir un defecto visto en el iPhone del usuario: el botón flotante «+» tapa
  el importe de la última fila de la lista de movimientos.
- Adelantar de H7 solo lo necesario: T-080 (gráficos), la parte de T-081 que
  dibuja el gasto por categoría en Inicio, T-083 (tasa de ahorro) y la parte de
  T-084 que no depende de presupuesto, gastos fijos ni objetivos.

FUERA
- Presupuesto, «disponible del mes» frente a un presupuesto, gastos fijos,
  objetivos, pantalla de Análisis (P17) completa, comparativa de dos meses.
- Cambios en el esquema de la base de datos, migraciones o reglas de negocio.
- Supabase, cuentas de usuario, sincronización, App Intents, notificaciones.
- Pestañas o botones que lleven a funciones que aún no existen.
- Renombrar archivos, mover carpetas o reescribir pantallas que solo necesitan
  el tema nuevo.

======================================================================
7. DIRECCIÓN VISUAL
======================================================================
Referencias de inspiración, solo como criterio (no copies diseños, iconos,
logotipos ni textos de ninguna app):
- Copilot Money: aspecto nativo de iOS, panel limpio que muestra lo importante,
  anillos de progreso, gráficos fáciles de leer.
- Monarch Money: panel limpio y colorido, con gráficos claros.
- Criterios comunes en las reseñas de apps de finanzas bien valoradas: la cifra
  que importa se lee en un segundo, anotar un gasto es rápido, y la paleta es
  tranquila, sin rojos agresivos ni alarmas.

Reglas del sistema visual:
1. FONDO. El modo claro deja el gris plano. Usa un fondo claro con un tinte de
   color suave y una cabecera con degradado en Inicio. Las tarjetas van en
   blanco, con esquinas redondeadas amplias y sombra muy suave.
2. COLOR. Define un color de marca y una paleta de categorías de 10 a 12
   colores. Cada color de la paleta cumple contraste 3:1 sobre la superficie en
   claro y en oscuro. Escribe un test que lo calcule, no lo valides a ojo.
3. GASTOS E INGRESOS. El gasto normal se muestra en el color de texto principal
   con signo menos. El ingreso, en verde con signo más. El rojo queda para
   balances negativos y errores. El color nunca es el único indicador: siempre
   hay signo o etiqueta.
4. CIFRAS. Importes con cifras tabulares, jerarquía clara (una cifra grande por
   tarjeta) y el formato regional que ya existe en `src/estado/formato.ts`.
5. CATEGORÍAS. Cada categoría se ve con un círculo de color y un icono. Si
   `icono` o `color` son nulos, se deriva un valor estable a partir del `id` o
   del orden, en la capa de presentación. No escribas en la base de datos para
   esto.
6. MODO OSCURO. Sigue funcionando y cumple contraste. No hace falta que sea tan
   vistoso como el claro, pero no puede romperse ni quedar ilegible.
7. TOKENS. Todos los colores, radios, sombras y tamaños de texto salen de
   `src/theme/`. Ninguna pantalla lleva un color fijo.
8. ACCESIBILIDAD. Áreas táctiles de 44 puntos, etiquetas para lector de
   pantalla, el texto respeta el tamaño del sistema, cada gráfico tiene una
   descripción textual, y las animaciones se desactivan con «Reducir
   movimiento».
9. ESTADOS VACÍOS. Cada bloque sin datos explica qué falta y ofrece la acción
   que lo resuelve. Nunca un hueco en blanco ni un gráfico a cero sin texto.
10. TEXTOS. Todo texto visible va al catálogo `src/i18n/es.json`. Sin jerga
    financiera.

======================================================================
8. ORGANIZACIÓN Y NAVEGACIÓN
======================================================================
- Pestañas, en este orden: Inicio, Movimientos, Cuentas. Si `docs/03` define
  otra estructura para V1, usa de ella solo las pestañas cuyo contenido exista
  ya y anota el resto como pendiente.
- La app abre en Inicio.
- El botón «+» para añadir un movimiento está disponible en Inicio y en
  Movimientos, con el mismo aspecto y posición.
- Las rutas existentes siguen funcionando. Si mueves Movimientos a otro archivo
  de ruta, actualiza todos los enlaces y las pruebas.
- Las listas dejan margen inferior suficiente para que el botón flotante y la
  barra de pestañas no tapen la última fila.

======================================================================
9. DASHBOARDS: QUÉ SE MUESTRA Y CÓMO SE CALCULA
======================================================================
Toda la lógica de cálculo va en `src/dominio/` como funciones puras con tests.
Las pantallas no suman importes. Reutiliza `efectoEnCuenta` y `calcularSaldo`.
El dinero sigue en céntimos enteros.

Selector de mes: Inicio muestra un mes de calendario local. El usuario puede ir
al mes anterior y al siguiente. Por defecto, el mes actual.

BLOQUE 1 · Balance global del mes
- Ingresos del mes: suma de movimientos de tipo `ingreso`.
- Gastos del mes: suma de movimientos de tipo `gasto`.
- Balance del mes: ingresos menos gastos.
- Tasa de ahorro: balance dividido entre ingresos, solo si los ingresos son
  mayores que cero. Con 2 000 € de ingresos y 1 600 € de gastos da 20 %.
- Transferencias y ajustes no cuentan como ingreso ni como gasto.
- Los movimientos borrados no cuentan.

BLOQUE 2 · Balance por cuenta
- Para cada cuenta: saldo actual, entradas del mes, salidas del mes y variación
  del mes. La variación es la suma de `efectoEnCuenta` de los movimientos del
  mes, así que incluye transferencias y ajustes.
- Se aplica la misma regla de fecha que `calcularSaldo`: no cuentan los
  movimientos anteriores a `fechaSaldoInicial`.
- Comprobación de coherencia que debe tener test: si ningún movimiento del mes
  es anterior a la fecha de saldo inicial de su cuenta, la suma de las
  variaciones de todas las cuentas es igual al balance global más la suma de
  los ajustes del mes.
- Tocar una cuenta abre su detalle.

BLOQUE 3 · Gasto por categoría
- Gráfico de anillo y lista con importe y porcentaje. Las cinco categorías con
  más gasto y el resto agrupado en «Otras».
- Una subcategoría (`padreId`) suma en su categoría principal.
- Tocar una categoría abre Movimientos filtrado por esa categoría y ese mes.

BLOQUE 4 · Evolución
- Barras de ingresos y gastos de los últimos seis meses, con el mes
  seleccionado resaltado. Es el bloque de menor prioridad: si algo obliga a
  recortar, se recorta este y se anota.

DETALLE DE CUENTA
- Saldo actual, entradas, salidas y variación del mes, con el mismo selector de
  mes, y la lista de movimientos de esa cuenta en ese mes.
- La edición de la cuenta que ya existe sigue accesible desde aquí.

Decisiones adoptadas por defecto (reversibles, anótalas como INFERENCIA en el
informe):
- Divisas: no se suman importes de divisas distintas. Mira cómo lo resuelve hoy
  la pantalla de Cuentas y haz lo mismo. Si hoy no lo resuelve, agrupa por
  divisa.
- Cuentas archivadas: sus movimientos cuentan en el balance global. En la lista
  por cuenta solo aparecen si tienen movimientos en el mes.
- Patrimonio total: se muestra en Cuentas, como hasta ahora, no en Inicio.

======================================================================
10. REGLAS TÉCNICAS
======================================================================
GRÁFICOS (T-080)
- Opción por defecto: `react-native-svg` con componentes propios para el
  anillo y las barras. Son dos gráficos sencillos y así se evita depender de
  Skia y Reanimated.
- Puedes elegir otra biblioteca (por ejemplo `react-native-gifted-charts` o
  `victory-native`) solo si compruebas en su documentación y en el registro de
  npm que admite las versiones instaladas de Expo y React Native, y lo
  justificas en el informe con versión y licencia.
- Instala siempre con `npx expo install`. Tras instalar, ejecuta
  `npx expo-doctor`.
- No afirmes compatibilidad de memoria. Lo que no puedas comprobar se marca
  NO DEMOSTRADO.

DEGRADADOS Y SOMBRAS
- Comprueba en la documentación de la versión instalada qué opción hay para
  degradados (estilos nativos de React Native, `expo-linear-gradient` o SVG) y
  elige la que añada menos dependencias nativas.

CARPETA `ios/`
- NO ejecutes `expo prebuild --clean` ni borres `ios/`. Se perderían los
  ajustes de firma del usuario.
- Si una dependencia nueva lleva código nativo, basta con `pod install` en
  `ios/`. Avisa en el informe de que el usuario debe volver a compilar desde
  Xcode para verla en su iPhone.
- Si algo te obliga a regenerar `ios/`, PARA y pregunta.
- No arregles la referencia rota a `../app-intents` salvo que impida compilar.
- En el informe, propón cómo dejar fijos en `app.json` o en un plugin de
  configuración los tres ajustes manuales del usuario. Solo la propuesta, sin
  aplicarla.

CÓDIGO
- TypeScript estricto, sin `any` nuevos y sin desactivar reglas de lint.
- Nombres en español, como el resto del código.
- No añadas dependencias que no sean imprescindibles para lo descrito aquí.
- Un commit por paso con sentido, mensajes en español.

======================================================================
11. VERIFICACIÓN VISUAL
======================================================================
Comprobado el 16/11/2026 en el Mac del usuario: el simulador «iPhone 17» con
iOS 27.2 arranca y la app se instala con `npm run ios`, pero la ventana de
Simulator.app no se localiza. Aun así funcionan:
- `xcrun simctl io booted screenshot <ruta>.png` para capturar la pantalla.
- `xcrun simctl openurl booted financialcontrol://<ruta>` para abrir una ruta
  (el esquema `financialcontrol` está en `app.json`).
- `xcrun simctl ui booted appearance dark` y `light` para cambiar de modo.

Usa esas órdenes para mirar tú mismo cada pantalla. Guarda las capturas en
`docs/capturas/antes/` y `docs/capturas/despues/`, en claro y en oscuro, de:
Inicio con datos, Inicio sin datos, Movimientos, Cuentas, detalle de cuenta y
alta de movimiento. Revisa cada captura: texto cortado, solapes, contraste
pobre o bloques vacíos son defectos que se corrigen antes de entregar.

Si `npm run ios` se queda colgado al abrir el simulador, prueba a instalar con
el simulador ya arrancado. Si no consigues ninguna captura, no lo des por
verificado: marca la parte visual como PENDIENTE DE EVIDENCIA.

======================================================================
12. FASES
======================================================================
1. Baseline y rama (apartado 5).
2. Lectura e inspección (apartado 4). Escribe en el informe, en diez líneas
   como máximo, qué dice `docs/03` sobre Inicio y navegación.
3. Dominio: funciones de resumen del mes con sus tests. Sin interfaz todavía.
4. Tema y componentes base: tokens, tarjeta, cabecera, distintivo de
   categoría, fila de movimiento nueva.
5. Gráficos: anillo y barras con datos de ejemplo, en claro y en oscuro.
6. Inicio y navegación.
7. Detalle de cuenta.
8. Aplicar el tema al resto de pantallas y corregir el solape del botón «+».
9. Casos límite (apartado 13) y capturas (apartado 11).
10. `npm run check` completo, documentación e informe.

Bucle dentro de cada fase: implementar, test dirigido, intentar romperlo,
corregir. La suite completa se ejecuta al cerrar cada fase, no tras cada
cambio pequeño.

======================================================================
13. CASOS QUE DEBES INTENTAR ROMPER
======================================================================
- Mes sin ningún movimiento.
- Mes con gastos y sin ingresos (la tasa de ahorro no se muestra, no divide
  entre cero).
- Mes con ingresos y sin gastos.
- Balance negativo.
- Solo transferencias en el mes: balance global cero y variaciones por cuenta
  distintas de cero que suman cero.
- Ajustes positivos y negativos.
- Movimiento con fecha anterior a la fecha de saldo inicial de su cuenta.
- Movimientos borrados.
- Una sola categoría con el 100 % del gasto, y más de cinco categorías.
- Categoría con `color` e `icono` nulos, y subcategorías.
- Sin cuentas, con una cuenta y con ocho cuentas.
- Cuenta archivada con movimientos en el mes.
- Importes grandes (1.234.567,89 €) y nombres largos, con el tamaño de texto
  del sistema al máximo.
- Cambio de año al retroceder de enero a diciembre, y mes futuro.
- Primer y último día del mes en la zona horaria local.
- Modo oscuro y «Reducir movimiento» activado.

======================================================================
14. CRITERIOS DE ÉXITO
======================================================================
- `npm run check` pasa completo. Ningún test anterior se ha borrado ni
  desactivado. Si un test de pantalla cambia porque cambia la interfaz, el
  informe lista cuál y por qué.
- Cada cifra de Inicio y del detalle de cuenta sale de una función de
  `src/dominio/` con test.
- El test de coherencia entre balance global y variaciones por cuenta pasa.
- 2 000 € de ingresos y 1 600 € de gastos muestran una tasa de ahorro del 20 %.
- Tocar una categoría en Inicio abre Movimientos filtrado por categoría y mes.
- Tocar una cuenta en Inicio abre su detalle.
- Ninguna pantalla contiene un color fijo: una búsqueda de valores
  hexadecimales en `src/app/` y `src/componentes/` no devuelve resultados.
- Todo texto visible nuevo está en `src/i18n/es.json`.
- El test de contraste de la paleta pasa en claro y en oscuro.
- La última fila de Movimientos se ve entera con el botón «+» en pantalla.
- Alta, edición, borrado con deshacer, transferencia, búsqueda y filtros
  funcionan igual que antes.
- Existen las capturas de «antes» y «después» en claro y en oscuro.
- No hay cambios en el esquema de datos ni en las migraciones.

======================================================================
15. NO HACER
======================================================================
- No inventar datos, versiones, compatibilidades ni resultados de pruebas.
- No tocar las reglas de negocio ni las migraciones para que un gráfico cuadre.
- No guardar saldos ni totales en la base de datos.
- No ejecutar `expo prebuild --clean` ni borrar `ios/`.
- No añadir pestañas, botones o tarjetas de funciones que no existen.
- No copiar el diseño, los iconos ni los logotipos de otra app.
- No usar el rojo como color habitual de los gastos.
- No desactivar tests ni reglas de lint para que el control pase.
- No fusionar ramas, no subir nada a GitHub y no modificar `main`.
- No dar por verificado el aspecto sin haber mirado una captura.
- No marcar la tarea como terminada sin evidencia.

======================================================================
16. CONDICIONES DE PARADA
======================================================================
PARA Y PREGUNTA AL USUARIO si:
- el baseline no pasa o la rama de partida no es la esperada
- hace falta regenerar `ios/` o cambiar el esquema de datos
- ninguna opción de gráficos admite las versiones instaladas
- `docs/03` contradice las decisiones del apartado 3 de forma que no puedas
  resolver con el criterio indicado

NO PARES por un test que falla durante el desarrollo, un caso límite que se
puede reproducir o un ajuste de estilo adicional necesario para cumplir los
criterios.

======================================================================
17. DOCUMENTACIÓN
======================================================================
Actualiza solo lo afectado y describe el estado real:
- `docs/estado.md`: apartado nuevo con baseline, lo hecho, casos probados,
  limitaciones y acciones del usuario.
- `docs/03-diseno-de-producto.md`: Inicio y navegación tal como quedan, y el
  sistema visual.
- `docs/07-hoja-de-ruta-y-backlog.md`: marca qué parte de T-080, T-081, T-083 y
  T-084 queda hecha y qué parte sigue en H7.
- `docs/09-decisiones.md`: decisión nueva del 16/11/2026 sobre el rediseño y el
  adelanto del dashboard.

======================================================================
18. ENTREGA E INFORME FINAL
======================================================================
Entrega: rama `h2b-rediseno-inicio` con commits, capturas en `docs/capturas/`
y documentación actualizada.

Informe final, conciso y sin volcados de registro:
- Baseline
- Qué dice `docs/03` y en qué te has apartado
- Biblioteca de gráficos y solución de degradados elegidas, con versión,
  licencia y cómo comprobaste la compatibilidad
- Cambios, por archivo
- Tests nuevos y tests modificados
- Casos límite probados y resultado
- Regresión: resultado de `npm run check`
- Inferencias adoptadas
- Limitaciones y lo NO DEMOSTRADO
- Propuesta para fijar los ajustes manuales de `ios/`
- Qué debe hacer el usuario para verlo en su iPhone, paso a paso
- Estado final

Estado final, uno solo: COMPLETED, COMPLETED_WITH_EXTERNAL_GATES,
PARTIALLY_COMPLETED, BLOCKED_BY_EVIDENCE, BLOCKED_BY_EXTERNAL_DEPENDENCY o
FAILED_VALIDATION. No declares COMPLETED si falta algún criterio del
apartado 14 o si la parte visual no tiene capturas revisadas.
```
