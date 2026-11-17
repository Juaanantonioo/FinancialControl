# Prompt para Claude Code · Visión completa del dinero (patrimonio, tiempo e inversiones)

Fecha: 17/11/2026. Se ejecuta en el repositorio `~/Desktop/FinancialControl`.
Es el primero de cuatro bloques para igualar a las apps de referencia. Los otros
tres (planificación, captura con Apple Pay, cuentas de usuario y publicación)
tendrán su propio prompt y NO entran aquí.

```
======================================================================
1. CONTEXTO
======================================================================
FinancialControl es una app de finanzas personales con React Native y Expo
(TypeScript), primero para iOS, de registro manual y sin conexión a bancos.

Estado comprobado por inspección el 17/11/2026 (verifícalo antes de fiarte):
- Rama actual `h2b-rediseno-inicio`, último commit `d0d1fe5`, subida a GitHub.
  `main` no tiene nada fusionado. `h1-spike-apple-pay` sigue aparte.
- `npm run check` pasaba con 284 pruebas en 13 suites.
- Pestañas: Inicio, Movimientos y Cuentas (`src/app/(tabs)/`).
- Inicio muestra el balance del mes, las cuentas con su variación, el gasto por
  categoría en anillo y las barras de los últimos seis meses.
- Cálculo en `src/dominio/saldo.ts` y `src/dominio/resumen.ts`. Tema en
  `src/theme/`. Gráficos propios en `src/componentes/Graficos.tsx` sobre
  `react-native-svg` 15.16.0.
- El tipo de cuenta `inversion` existe, pero una cuenta de inversión solo
  muestra lo aportado. No hay valor actual ni rentabilidad.
- El patrimonio neto solo aparece en la pestaña Cuentas, como suma de saldos.
- La carpeta `ios/` está en `.gitignore` y contiene ajustes manuales de firma
  del usuario.
- Limitaciones anotadas en `docs/estado.md`, apartado 7.4.

Valoración del usuario tras ver el rediseño (17/11/2026): una app de finanzas
debe dejar claro el dinero que se posee, qué se hace con él cada mes del año y
cada día, y las inversiones que se tienen. Quiere ponerse al nivel de las apps
del mercado.

Qué ofrecen las apps de referencia y aquí falta (investigación del 17/11/2026,
solo como criterio, sin copiar diseños):
- Monarch Money: su panel abre con el patrimonio neto, y añade comparación con
  el mes anterior, resumen de inversiones y un repaso del mes.
- Copilot Money: patrimonio, tendencias de gasto, inversiones y resumen del mes
  y del año.
- Finary, getquin y Parqet: patrimonio agregado, distribución por tipo de
  activo y evolución del valor.
- Apps de registro manual para iPhone: vista de calendario por días, vista
  mensual y anual, e informes exportables.

======================================================================
2. OBJETIVO DE CIERRE
======================================================================
Abierto hoy: la app responde a «cómo va este mes», pero no a «cuánto tengo»,
«qué hice cada día», «cómo va el año» ni «cuánto valen mis inversiones».

Debe quedar cerrado:
A. PATRIMONIO. Inicio abre con lo que el usuario posee, repartido entre dinero
   disponible e invertido, y con su evolución en doce meses.
B. INVERSIONES. Cada cuenta de inversión tiene valor actual introducido a mano,
   con aportado, ganancia o pérdida y evolución. Hay un resumen de todas.
C. TIEMPO. Una pestaña Análisis con tres vistas: Día, Mes y Año.
D. REMATES de H2b que afectan a la claridad (apartado 9).

Evidencia: pruebas en verde, capturas revisadas en claro y oscuro, y
documentación al día.

Sigue abierto después: presupuesto, gastos fijos, objetivos, captura con Apple
Pay, widgets, cuentas de usuario, sincronización y publicación.

======================================================================
3. DECISIONES Y LÍMITES YA FIJADOS
======================================================================
Del usuario:
- Fondo claro y vistoso. El modo claro es la prioridad de diseño.
- Sin conexión bancaria y sin integración con Notion.
- Inversiones manuales en V1: el valor lo escribe el usuario. Sin cotizaciones.

De `docs/02` y `docs/09`, que siguen vigentes:
- Sin fuente de precios, sin consejos financieros y sin recomendaciones de
  productos.
- Todo registro lleva UUID generado en el dispositivo, marca de modificación y
  borrado lógico, para la sincronización futura.
- Dinero en céntimos enteros. Los saldos y totales se calculan, no se guardan.

Cambio de orden respecto a `docs/07`: este bloque adelanta T-070 (solo
ValorDeInversion), T-075, T-076, T-082 y parte de G7 antes de H3 y H4. Anótalo
en `docs/09-decisiones.md` como decisión del 17/11/2026.

======================================================================
4. LECTURA OBLIGATORIA
======================================================================
1. `AGENTS.md`. Consulta la documentación de Expo de la versión instalada antes
   de usar cualquier API de Expo o React Native.
2. `docs/03-diseno-de-producto.md`: P05, P09, P10, P17, P21, dashboards D5, D6,
   D7, D10 y D11, accesibilidad y modo oscuro.
3. `docs/05-arquitectura-y-modelo-de-datos.md`: convenciones, entidad
   ValorDeInversion y reglas de cálculo.
4. `docs/estado.md`, apartado 7 completo.
5. Todo `src/`, en especial `dominio/`, `datos/migraciones.ts`, `theme/` y
   `componentes/Graficos.tsx`. No supongas el contenido por el nombre.

======================================================================
5. BASELINE
======================================================================
Antes de modificar nada, añade un apartado 8 a `docs/estado.md` con:
- rama y commit de partida
- resultado de `npm run check`
- `git status` resumido
- versión del esquema de la base de datos y lista de migraciones

Crea la rama `h3-vision-completa` desde `h2b-rediseno-inicio`. No trabajes en
otra rama, no fusiones y no toques `main`. Haz commits locales. NO subas nada a
GitHub salvo que el usuario te lo pida en esta sesión.

Si `npm run check` falla antes de empezar, PARA e informa.

======================================================================
6. ALCANCE
======================================================================
DENTRO: lo descrito en los apartados 7, 8 y 9.

FUERA:
- Presupuesto, disponible del mes, gastos fijos, calendario de cobros, objetivos.
- Posiciones, activos, cotizaciones, TIR, dividendos y comisiones (V2).
- Tarjetas de crédito, deudas y préstamos.
- Supabase, sincronización, App Intents, notificaciones y widgets.
- Exportación a CSV y bloqueo con Face ID.
- Dependencias nativas nuevas. Todo se resuelve con lo instalado, para que el
  usuario vea los cambios sin recompilar en Xcode. Si crees imprescindible una,
  PARA y pregunta.

======================================================================
7. REGLAS DE CÁLCULO
======================================================================
Toda cifra sale de funciones puras en `src/dominio/` con test. Reutiliza
`efectoEnCuenta`, `calcularSaldo` y las funciones de `resumen.ts`. Las
pantallas no suman importes. Las divisas distintas no se suman: aplica la
misma solución que ya usa Inicio.

VALOR DE UNA CUENTA DE INVERSIÓN
- Aportado neto en una fecha F: `calcularSaldo` con los movimientos hasta F
  incluida. Es decir, saldo inicial más entradas menos salidas.
- Valor registrado: lo que el usuario escribe con una fecha. Se entiende que
  incluye los movimientos de ese día.
- Valor estimado en F: el último valor registrado con fecha igual o anterior a
  F, más el efecto de los movimientos posteriores a esa fecha y hasta F. Si no
  hay ningún valor registrado, el valor estimado es el aportado neto.
- Ganancia o pérdida en F: valor estimado menos aportado neto.
- Rentabilidad simple: ganancia dividida entre aportado neto, solo si el
  aportado neto es mayor que cero. En otro caso no se muestra porcentaje.
- Un valor por cuenta y día. Registrar otro el mismo día lo sustituye.
- Ejemplo que debe tener test: aportaciones de 1 000, 500 y 500 €, valor
  registrado de 2 150 € después de la tercera. Aportado 2 000 €, ganancia
  150 €, rentabilidad 7,5 %. Una aportación posterior de 200 € deja valor
  estimado 2 350 €, aportado 2 200 € y ganancia 150 €.
- Limitación que se documenta y se explica en pantalla: un ingreso anotado
  directamente en la cuenta de inversión cuenta como aportación.

PATRIMONIO
- Patrimonio en F: suma del saldo de las cuentas de banco y efectivo en F y
  del valor estimado de las cuentas de inversión en F. Las cuentas archivadas
  cuentan si su saldo no es cero.
- Dinero disponible: banco y efectivo. Invertido: cuentas de inversión.
- Evolución: patrimonio al último día de cada uno de los últimos doce meses.
  El mes en curso usa la fecha de hoy.
- Variación del mes: patrimonio hoy menos patrimonio al cierre del mes
  anterior, en euros y en porcentaje si el anterior es mayor que cero.
- Los meses anteriores a la fecha de saldo inicial más antigua no se dibujan.
  No se inventa un cero.

DÍA
- Gasto e ingreso de cada día del mes. Transferencias y ajustes no cuentan.
- Gasto de hoy.
- Media diaria de gasto: gasto del mes entre los días transcurridos si es el
  mes en curso, o entre los días del mes si es un mes pasado. En un mes futuro
  no se muestra.
- Día de mayor gasto del mes.

MES
- Lo que ya calcula `resumen.ts`, más la comparativa con el mes anterior:
  diferencia de cada categoría en euros y en porcentaje. Si el mes anterior
  fue cero, no hay porcentaje y se indica «nuevo».

AÑO (año natural, con selector)
- Ingresos, gastos, balance y tasa de ahorro del año.
- Los doce meses con ingresos, gastos y balance.
- Mes de mayor y de menor gasto, entre los meses con datos.
- Gasto por categoría del año, con la misma regla de cinco más «Otras».
- Media mensual de gasto: gasto del año entre los meses con algún movimiento.
- Variación del patrimonio en el año.

======================================================================
8. PANTALLAS
======================================================================
Sigue el sistema visual de `src/theme/`. Ningún color fijo en pantallas. Todo
texto visible en `src/i18n/es.json`. Sin jerga: «lo que has puesto», «lo que
vale hoy», «ganas» o «pierdes».

INICIO
- La cabecera pasa a mostrar primero el patrimonio: cifra grande, variación
  del mes y reparto entre disponible e invertido.
- Debajo, el balance del mes con ingresos, gastos y tasa de ahorro, y el resto
  de bloques actuales.
- Bloque nuevo «Hoy»: gasto de hoy y media diaria del mes.
- Bloque nuevo «Inversiones», solo si hay cuentas de inversión: aportado,
  valor y ganancia o pérdida del conjunto. Tocarlo abre el resumen de
  inversiones.
- Tocar el patrimonio abre su evolución.
- Decide con capturas si el selector de mes afecta al patrimonio. Por defecto:
  el patrimonio muestra siempre la fecha de hoy y el selector de mes solo
  cambia los bloques del mes.

PATRIMONIO (pantalla nueva)
- Línea de doce meses, cifra actual, desglose por tipo de cuenta y lista de
  cuentas con su peso en porcentaje.

CUENTA DE INVERSIÓN (en el detalle de cuenta existente)
- Aportado, valor actual con su fecha, ganancia o pérdida en euros y en
  porcentaje, y línea de evolución con aportado y valor.
- Botón «Actualizar valor»: importe y fecha, con el teclado de importe que ya
  existe. Historial de valores con edición y borrado con deshacer.
- Si el último valor tiene más de 30 días, un aviso discreto en pantalla
  invita a actualizarlo. Sin notificaciones.
- Sin ningún valor registrado: estado vacío que explica para qué sirve.

INVERSIONES (pantalla de resumen)
- Total aportado, valor total, ganancia o pérdida, y reparto entre cuentas de
  inversión en anillo con lista. Tocar una abre su detalle.
- Texto fijo y breve: los valores los introduce el usuario y la app no da
  consejos de inversión.

ANÁLISIS (pestaña nueva, entre Movimientos y Cuentas)
Selector de tres vistas.
- Día: calendario del mes con el gasto de cada día marcado por intensidad y
  con la cifra, además de gasto de hoy, media diaria y día de mayor gasto.
  Tocar un día muestra sus movimientos. Si el filtro por día no existe en
  Movimientos, añádelo como parámetro de ruta igual que el de categoría y mes.
- Mes: comparativa con el mes anterior por categoría y evolución de seis
  meses. Tocar una categoría abre Movimientos filtrado.
- Año: totales del año, barras de los doce meses, tabla mes a mes, gasto por
  categoría y variación del patrimonio. Tocar un mes abre Inicio en ese mes.

ACCESIBILIDAD
- La intensidad de color del calendario nunca es el único dato: cada día lleva
  su cifra o su etiqueta para lector de pantalla.
- Cada gráfico tiene descripción textual. Áreas táctiles de 44 puntos.
- El texto respeta el tamaño del sistema. Revisa el calendario con el texto
  al máximo: si no cabe, cambia a lista de días.
- Las animaciones respetan «Reducir movimiento» con lo que ya hay en
  `src/estado/animacion.ts`.

======================================================================
9. REMATES DE H2b
======================================================================
1. El enlace «Diagnóstico de desarrollo» de la pestaña Cuentas solo se muestra
   en compilaciones de desarrollo.
2. Tocar una categoría principal incluye los movimientos de sus subcategorías.
3. Elegir icono y color al crear o editar una categoría, guardados en los
   campos `icono` y `color` que ya existen. Si son nulos sigue valiendo el
   valor derivado. Los colores se eligen de la paleta del tema.
4. El botón flotante no debe tapar cifras en reposo: en la captura de Inicio
   tapa parte del anillo. Revisa su posición o el margen de los bloques.

======================================================================
10. DATOS Y MIGRACIÓN
======================================================================
- Tabla nueva para ValorDeInversion, según `docs/05`: cuenta, fecha y valor en
  céntimos, con los campos comunes (id, creado, modificado, borrado).
- Sigue el sistema de migraciones existente. Una migración nueva y numerada.
  No edites migraciones anteriores.
- Test de migración: una base de datos con el esquema actual y datos de
  ejemplo migra sin perder ni alterar cuentas, categorías ni movimientos.
- Repositorio con sus pruebas: crear, sustituir el del mismo día, editar,
  borrar con deshacer y listar por cuenta.
- Reglas: solo en cuentas de tipo `inversion`, valor mayor o igual que cero,
  fecha válida y no futura. Cada regla con su código de error y su texto.
- No cambies ninguna otra tabla.

======================================================================
11. FASES
======================================================================
1. Baseline y rama.
2. Lectura. Resume en diez líneas como máximo lo que dice `docs/03` de P09,
   P10, P17 y P21.
3. Dominio: inversión, patrimonio, día, comparativa y año, con tests. Sin
   interfaz todavía.
4. Migración y repositorio de valores de inversión.
5. Gráficos que falten: línea y calendario, con datos de ejemplo.
6. Cuenta de inversión y resumen de inversiones.
7. Patrimonio e Inicio.
8. Pestaña Análisis: Día, Mes y Año.
9. Remates del apartado 9.
10. Casos límite, capturas, `npm run check`, documentación e informe.

Bucle en cada fase: implementar, test dirigido, intentar romperlo, corregir.
La suite completa se ejecuta al cerrar cada fase. Un commit por fase como
mínimo, con mensaje en español.

======================================================================
12. VERIFICACIÓN VISUAL
======================================================================
Usa el simulador como en H2b: `xcrun simctl io booted screenshot`,
`xcrun simctl openurl booted financialcontrol://<ruta>` y
`xcrun simctl ui booted appearance dark|light`.

Guarda en `docs/capturas/h3/`, en claro y en oscuro: Inicio arriba y abajo,
Patrimonio, cuenta de inversión con y sin valores, resumen de inversiones,
Análisis en sus tres vistas, y el calendario con el texto al máximo.

Mira cada captura. Texto cortado, solapes, contraste pobre o bloques vacíos
sin explicación se corrigen antes de entregar. Rehaz las capturas tras el
último cambio visual: no entregues capturas anteriores al código final. Si
necesitas código temporal para capturar, no lo dejes en la rama y dilo.

======================================================================
13. CASOS QUE DEBES INTENTAR ROMPER
======================================================================
- Sin cuentas de inversión: no aparecen bloques ni pantallas vacías de
  inversiones.
- Cuenta de inversión sin valores, con uno y con muchos.
- Valor menor que lo aportado (pérdida) y valor cero.
- Aportado neto cero o negativo tras retirar dinero.
- Dos valores el mismo día, valor con fecha anterior a la primera aportación,
  valor con fecha futura.
- Aportación el mismo día que un valor registrado, y al día siguiente.
- Retirada parcial después de un valor registrado.
- Valor registrado y luego borrado: los cálculos vuelven al estado anterior.
- Cuenta de inversión archivada con saldo.
- Patrimonio negativo por una cuenta en descubierto.
- Usuario con solo dos meses de historia: la línea no inventa meses.
- Cambio de año en la evolución de doce meses.
- Año sin movimientos, año con un solo mes y año futuro.
- Febrero en año bisiesto, meses de 30 y 31 días, mes que empieza en domingo.
- Hoy es día 1: la media diaria no divide entre cero.
- Día con veinte movimientos y día sin ninguno.
- Importes grandes (1.234.567,89 €) en calendario y tablas.
- Dos divisas.
- Categoría con subcategorías en el filtro.
- Modo oscuro y texto del sistema al máximo.

======================================================================
14. CRITERIOS DE ÉXITO
======================================================================
- `npm run check` pasa. Ningún test anterior borrado ni desactivado. El
  informe lista los tests de pantalla modificados y el motivo.
- El ejemplo de inversión del apartado 7 da 150 € y 7,5 %, y tras la
  aportación de 200 € da 2 350 €, 2 200 € y 150 €.
- Test de coherencia: el patrimonio es igual a la suma de los saldos de banco
  y efectivo más los valores estimados de inversión, y sin valores registrados
  coincide con la cifra que mostraba la pestaña Cuentas antes del cambio.
- Test de coherencia: la suma de los doce meses del año es igual a los totales
  del año, y la suma del gasto diario de un mes es igual al gasto del mes.
- La migración conserva los datos existentes, con test.
- Inicio muestra el patrimonio antes que cualquier otro dato.
- Con una cuenta de inversión y un valor registrado se ven aportado, valor,
  ganancia o pérdida y porcentaje.
- Análisis muestra las tres vistas, cada una con estado vacío explicado.
- Tocar un día, una categoría o un mes lleva al detalle correspondiente.
- Búsqueda de hexadecimales en `src/app/` y `src/componentes/`: 0 resultados.
- Ningún texto visible fuera del catálogo.
- `package.json` no tiene dependencias nativas nuevas.
- Existen las capturas del apartado 12, posteriores al último cambio visual.
- Alta, edición, borrado con deshacer, transferencia, búsqueda y filtros
  funcionan igual que antes.

======================================================================
15. NO HACER
======================================================================
- No inventar datos, versiones, compatibilidades ni resultados de pruebas.
- No guardar saldos, patrimonio ni rentabilidades en la base de datos.
- No mostrar cotizaciones, previsiones de rentabilidad ni consejos.
- No presentar el valor estimado como valor de mercado.
- No editar migraciones anteriores ni otras tablas.
- No añadir presupuesto, gastos fijos, objetivos ni nada del apartado FUERA.
- No añadir pestañas o botones de funciones que no existen.
- No ejecutar `expo prebuild --clean` ni borrar `ios/`.
- No subir a GitHub, no fusionar y no tocar `main` sin que el usuario lo pida.
- No copiar el diseño, los iconos ni los logotipos de otra app.
- No desactivar tests ni reglas de lint.
- No dar por verificado el aspecto sin haber mirado la captura final.
- No declarar terminado nada sin evidencia.

======================================================================
16. CONDICIONES DE PARADA
======================================================================
PARA Y PREGUNTA si:
- el baseline no pasa o la rama de partida no es la esperada
- la migración no puede hacerse sin tocar tablas existentes
- hace falta una dependencia nativa o regenerar `ios/`
- `docs/05` define ValorDeInversion de forma incompatible con el apartado 7

NO PARES por un test que falla durante el desarrollo, un caso límite que se
puede reproducir o un ajuste necesario para cumplir los criterios.

======================================================================
17. DOCUMENTACIÓN
======================================================================
Solo lo afectado y describiendo el estado real:
- `docs/estado.md`: apartado 8 con baseline, hecho, casos, limitaciones y
  acciones del usuario.
- `docs/03-diseno-de-producto.md`: Inicio, Análisis, Patrimonio, inversiones y
  navegación tal como quedan.
- `docs/05-arquitectura-y-modelo-de-datos.md`: reglas de valor estimado,
  patrimonio y sus limitaciones.
- `docs/07-hoja-de-ruta-y-backlog.md`: qué queda hecho de T-070, T-075, T-076,
  T-081, T-082 y T-084, y qué sigue pendiente.
- `docs/09-decisiones.md`: decisión del 17/11/2026 sobre el cambio de orden.

======================================================================
18. ENTREGA E INFORME FINAL
======================================================================
Entrega: rama `h3-vision-completa` con commits locales, capturas en
`docs/capturas/h3/` y documentación al día.

Informe final, conciso y sin volcados de registro:
- Baseline
- Qué dice `docs/03` y en qué te has apartado
- Cambios por archivo
- Migración: número, qué crea y cómo se probó
- Tests nuevos y modificados
- Casos límite y resultado
- Regresión: resultado de `npm run check`
- Inferencias adoptadas
- Limitaciones y lo NO DEMOSTRADO
- Qué debe hacer el usuario para verlo en su iPhone
- Estado final

Estado final, uno solo: COMPLETED, COMPLETED_WITH_EXTERNAL_GATES,
PARTIALLY_COMPLETED, BLOCKED_BY_EVIDENCE, BLOCKED_BY_EXTERNAL_DEPENDENCY o
FAILED_VALIDATION. No declares COMPLETED si falta algún criterio del
apartado 14 o si alguna captura es anterior al código final.
```
