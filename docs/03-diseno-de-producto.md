# 03 · Diseño de producto

Alcance: la V1 propuesta en `02-alcance-por-versiones.md`. Todos los importes de los
esquemas son **datos de ejemplo**.

## 1. Principios

1. **Anotar cuesta menos que no anotar.** El alta de un gasto se resuelve en un aviso o
   en tres toques.
2. **Una cifra por pantalla.** Cada vista responde a una pregunta y la respuesta va
   arriba, en grande.
3. **Nada se pierde.** Lo que no se confirma queda en una bandeja.
4. **La app no opina.** Muestra datos y previsiones. No recomienda productos ni decisiones.
5. **Honestidad sobre los límites.** La captura automática puede fallar y la app lo dice.

## 2. Arquitectura de información

```
FinancialControl
├── Inicio            Mes en curso: disponible, gasto, próximos cobros, objetivos
│   └── Análisis      Categorías, tendencia, comparativa
├── Movimientos       Lista, búsqueda, filtros
│   └── Bandeja       Capturas pendientes de confirmar
├── [ + ]             Alta de gasto, ingreso o transferencia
├── Plan
│   ├── Presupuesto   Por categoría, previsto frente a real
│   ├── Gastos fijos  Lista y calendario
│   └── Objetivos     Meta, aportado, ritmo
├── Cuentas           Saldos, patrimonio, inversión
└── Ajustes (icono)   Categorías, reglas de tarjeta, Apple Pay, datos, seguridad
```

## 3. Navegación principal

Barra inferior con cinco posiciones: **Inicio · Movimientos · [+] · Plan · Cuentas**.

- El botón central **[+]** abre el alta como hoja modal desde cualquier pestaña.
- **Ajustes** se abre con el icono de engranaje de la cabecera de Inicio.
- **Plan** agrupa sus tres secciones con un selector segmentado en la cabecera.
- Los avisos del sistema y el widget abren la pantalla exacta (enlace profundo): un aviso
  de captura abre la captura, un aviso de cobro abre el gasto fijo.

### 3.1 Estado tras el rediseño del 16/11/2026 (rama `h2b-rediseno-inicio`)

Barra inferior real: **Inicio · Movimientos · Cuentas**. La app abre en Inicio.

- **Plan** y el botón central **[+]** siguen pendientes: no se añaden pestañas de funciones
  que aún no existen (presupuesto, gastos fijos, objetivos). Mientras tanto, el alta se abre
  con un botón flotante «+» en Inicio y en Movimientos, en la misma posición.
- **Ajustes** (engranaje de Inicio) sigue pendiente por el mismo motivo.
- Tocar una cuenta, en Inicio o en Cuentas, abre su detalle (P10). La edición se abre
  desde ahí.
- Tocar una categoría en Inicio abre Movimientos filtrado por esa categoría y ese mes.

### 3.2 Estado tras el bloque del 17/11/2026 (rama `h3-vision-completa`)

Barra inferior real: **Inicio · Movimientos · Análisis · Cuentas**.

- **Análisis** (P17) pasa a ser una pestaña, no una pantalla dentro de Inicio, con tres
  vistas: Día, Mes y Año.
- El botón **«+»** deja de flotar sobre el contenido y va en la cabecera, arriba a la
  derecha, en Inicio, Movimientos y Cuentas. El botón central de la barra sigue pendiente.
- **Plan** y **Ajustes** siguen pendientes.
- Pantallas nuevas fuera de la barra: **Patrimonio** (desde la cifra de Inicio o de
  Cuentas), **Inversiones** (desde el bloque de Inicio) y **Valor de inversión** (P21,
  desde el detalle de una cuenta de inversión).
- Enlaces: `financialcontrol://analisis?vista=anio&anio=2026`, `…/analisis?dia=2026-11-14`,
  `…/movimientos?dia=2026-11-14` y `…/?mes=2026-10`.

### 3.3 Estado tras el bloque de planificación (rama `h5-planificacion`, 17/11/2026)

Barra inferior real: **Inicio · Movimientos · Análisis · Plan · Cuentas**.

- **Plan** tiene tres secciones con un selector: Presupuesto (P11), Fijos (P13) y
  Objetivos (P15). El botón «+» de su cabecera crea un fijo o un objetivo según la sección.
- Pantallas que se abren desde Plan o desde Inicio: edición de presupuesto (P12), alta y
  edición de fijo (P14), confirmación de un cobro, detalle de objetivo (P16), edición de
  objetivo y «Aportar».
- Enlaces: `financialcontrol://plan?seccion=fijos&mes=2026-11`, `…/presupuesto?mes=2026-11`,
  `…/regla`, `…/objetivo?id=…`.
- El botón central «+» y **Ajustes** siguen pendientes.

### 3.4 Estado tras el bloque de entrada rápida (rama `b3-entrada-rapida`, 17/11/2026)

- **Bandeja de capturas** (P08): se abre desde el botón «Bandeja» de Movimientos, que
  lleva el número de pagos por revisar, y desde una tarjeta de Inicio que solo aparece si
  hay alguno. Cada captura tiene Guardar (o Completar, si le falta algo), Editar y
  Descartar. Duplicadas y descartadas van en un apartado plegado.
- **Guía de Apple Pay** (P04): pasos de la automatización con los dos nombres del
  disparador, captura de prueba, última captura recibida y tarjetas recordadas.
- **Avisos**: un interruptor por tipo de aviso.
- Al pie de **Cuentas** hay un bloque «Ajustes» con Categorías, Apple Pay y Avisos. Hace
  de pantalla de Ajustes (P18) mientras no exista.
- Lo que hay en banco y efectivo se llama «En cuentas». «Disponible» queda solo para
  «Disponible este mes».
- Enlaces: `financialcontrol://capturas`, `…/apple-pay`, `…/avisos`.

Diferencias con este documento: el aviso de una captura no lleva botones (T-035 parcial):
tocarlo abre la bandeja. P04 no ramifica por versión de iOS detectada: muestra los dos
nombres del disparador.

## 4. Lista de pantallas de V1

| Id | Pantalla | Contenido principal | Flujos |
|---|---|---|---|
| P01 | Bienvenida | Qué hace la app, qué no hace, aviso de privacidad | F1 |
| P02 | Cuentas iniciales | Alta de una o más cuentas con saldo y fecha | F1 |
| P03 | Categorías iniciales | Lista sugerida, marcar y renombrar | F1 |
| P04 | Guía de Apple Pay | Pasos por versión de iOS, prueba y estado | F1, F3, F9 |
| P05 | Inicio | Disponible del mes, gasto por categoría, próximos cobros, objetivos | F1, F2, F4, F8 |
| P06 | Movimientos | Lista por día, búsqueda, filtros, acceso a la bandeja | F3, F8 |
| P07 | Alta y edición de movimiento | Teclado de importe, tipo, cuenta, categoría, fecha, nombre | F2, F3, F7 |
| P08 | Bandeja de capturas | Capturas pendientes con Guardar, Editar y Descartar | F3 |
| P09 | Cuentas | Patrimonio neto, lista de cuentas con saldo | F7 |
| P10 | Detalle de cuenta | Saldo, evolución, movimientos de la cuenta, cuadre | F7 |
| P11 | Presupuesto del mes | Barra por categoría, previsto frente a real, disponible | F4 |
| P12 | Edición de presupuesto | Importe por categoría, copiar el mes anterior | F4 |
| P13 | Gastos fijos | Total mensual, lista y calendario de cobros | F6 |
| P14 | Alta y edición de gasto fijo | Nombre, importe, día, cuenta, categoría, tipo, aviso | F6 |
| P15 | Objetivos | Tarjetas con avance y ritmo necesario | F5 |
| P16 | Alta y detalle de objetivo | Meta, fecha, tipo, aportaciones, plan mensual | F5 |
| P17 | Análisis | Categorías, tendencia y comparativa de meses | F8 |
| P18 | Ajustes | Índice de configuración | F9, F10 |
| P19 | Categorías y reglas | Categorías, regla tarjeta a cuenta, regla comercio a categoría | F9 |
| P20 | Datos | Exportar CSV, copia de seguridad, restaurar, borrar todo | F9 |
| P21 | Valor de inversión | Valor actual y fecha de una cuenta de inversión | F7 |
| P22 | Acceso | Registro e inicio de sesión | F10 |
| P23 | Cuenta | Estado de la sincronización, cerrar sesión, eliminar cuenta | F10 |

Las 23 pantallas aparecen en al menos un flujo.

## 5. Flujos clave

### F1 · Primera configuración

`P01 → P02 → P03 → P04 (se puede saltar) → P05`

1. P01: tres frases y el aviso "Tus datos se guardan en este iPhone". Botón Empezar.
   Enlace secundario "Ver con datos de ejemplo".
2. P02: una cuenta ya sugerida ("Cuenta principal", tipo Banco). El usuario escribe el
   saldo de hoy. Puede añadir efectivo y una cuenta de inversión.
3. P03: categorías sugeridas ya marcadas. Continuar sin tocar nada es válido.
4. P04: "¿Pagas con Apple Pay?". Sí abre la guía. Ahora no la deja para Ajustes.
5. P05: Inicio con una tarjeta "Anota tu primer gasto".

Meta: menos de dos minutos y un solo dato obligatorio (el saldo).

### F2 · Alta manual de un gasto en el menor número de pasos

`cualquier pestaña → [+] → P07 → Guardar`

1. Toque en **[+]**: se abre P07 con el teclado numérico ya visible, tipo Gasto, la
   última cuenta usada y la fecha de hoy.
2. El usuario escribe el importe.
3. Toque en una categoría de la fila de frecuentes.
4. Toque en **Guardar**.

Cuatro toques más los dígitos. El nombre es opcional: si queda vacío se usa el de la
categoría. Si el usuario escribe un nombre ya conocido, la categoría se sugiere sola y
el paso 3 desaparece.

### F3 · Captura de un pago con Apple Pay

`pago → aviso → Guardar` o `pago → aviso → P07` o `P06 → P08 → P07`

1. El usuario paga. Atajos entrega tarjeta, comercio e importe a la acción de la app.
2. La app crea una **captura**, deduce la cuenta (regla de tarjeta) y la categoría
   (regla de comercio) y muestra un aviso:
   `Mercado Central · 23,40 € · Cuenta principal · Comida`
   con las acciones **Guardar**, **Editar** y **Descartar**.
3. Guardar la convierte en movimiento sin abrir la app. Editar abre P07 con los datos
   puestos. Si no se atiende, queda en P08.
4. Si la tarjeta no tiene regla, el aviso dice "¿De qué cuenta es esta tarjeta?" y abre
   P07. La respuesta se guarda como regla.

El detalle técnico, los fallos previstos y el plan B están en `04-spikes-viabilidad.md`.

### F4 · Creación de un presupuesto mensual

`P05 → Plan → P11 → P12 → P11`

1. P11 sin presupuesto: "Crea tu presupuesto de noviembre".
2. P12 propone, para cada categoría, **la media de gasto de los tres últimos meses**. Si
   no hay histórico, los campos van vacíos. Si existe presupuesto del mes anterior,
   ofrece "Copiar octubre".
3. El usuario ajusta los importes. La cabecera muestra el total presupuestado y la
   diferencia con los ingresos previstos.
4. Guardar vuelve a P11 con las barras.

### F5 · Creación de un plan de ahorro

`Plan → P15 → P16`

1. P15, botón Nuevo objetivo.
2. P16: nombre, meta, fecha límite (opcional), tipo (Ahorro o Inversión) y cuenta asociada
   (opcional).
3. La app calcula y muestra "Necesitas 125 € al mes durante 8 meses".
4. Opción "Crear aportación mensual": genera un movimiento recurrente (transferencia a la
   cuenta asociada) el día elegido.
5. Cada aportación confirmada suma al objetivo.

### F6 · Alta de un gasto fijo

`Plan → P13 → P14`

1. P13, botón Nuevo.
2. P14: nombre, importe, día de cobro, cuenta, categoría, tipo (Fijo o Suscripción),
   periodicidad (mensual por defecto) y aviso previo (un día antes por defecto).
3. El día del cobro, la app muestra un aviso "Cuota del gimnasio · 35,00 € · ¿Cobrado?".
   Confirmar crea el movimiento.

### F7 · Transferencia e inversión

`[+] → P07 (tipo Transferencia)` y `P09 → P10 → P21`

1. P07 con el tipo Transferencia: cuenta de origen, cuenta de destino e importe. Una
   transferencia a una cuenta de inversión es una aportación.
2. P09 muestra el patrimonio. Al tocar una cuenta de inversión se abre P10.
3. P10, botón Actualizar valor: abre P21, donde se escribe el valor de hoy.
4. P10 muestra aportado, valor actual y rentabilidad simple.

### F8 · Revisión del mes

`P05 → P17 → P06 (filtrado)`

1. P05: toque en el gráfico de categorías.
2. P17: categorías del mes, tendencia y comparativa con el mes anterior.
3. Toque en una categoría: P06 filtrado por esa categoría y ese mes.

### F9 · Ajustes, reglas y datos

`P05 → P18 → P19 | P20 | P04`

- P19: crear, renombrar y ordenar categorías. Ver y corregir las reglas tarjeta a cuenta y
  comercio a categoría.
- P20: exportar CSV, crear y restaurar copia de seguridad, borrar todos los datos.
- P04: volver a la guía de Apple Pay y ver el estado ("Última captura: hoy, 13:42").

### F10 · Cuenta de usuario y sincronización

`P22 → P01 | P18 → P23`

1. P22: al abrir la app por primera vez, registro o inicio de sesión.
2. Tras entrar, la app descarga los datos de la cuenta. Si no hay ninguno, sigue la
   primera configuración (F1).
3. Los cambios se guardan primero en el dispositivo y se envían al servidor cuando hay
   conexión. Sin conexión, la app sigue funcionando.
4. P23: estado de la sincronización ("Al día" o "3 cambios pendientes"), cerrar sesión y
   eliminar la cuenta con todos sus datos, previa confirmación.

Los esquemas de P22 y P23 están pendientes. Se dibujan en el hito H4.

## 6. Especificación de dashboards

| Id | Dónde | Pregunta que responde | Datos que usa | Periodo | Forma |
|---|---|---|---|---|---|
| D1 | P05 | ¿Cuánto puedo gastar lo que queda de mes? | Presupuesto total, gastado, fijos pendientes, días restantes | Mes en curso | Cifra grande, importe por día y barra de avance |
| D2 | P05, P17 | ¿En qué se me va el dinero? | Gastos por categoría, sin transferencias | Mes en curso, con selector | Barras horizontales ordenadas. No se usa gráfico circular con más de cinco categorías |
| D3 | P11 | ¿Qué categorías se están pasando? | Presupuesto por categoría y gasto real | Mes en curso | Barra por categoría con marca del día de hoy |
| D4 | P05 | ¿Llegaré a fin de mes con saldo? | Saldo actual, fijos pendientes, ingresos recurrentes pendientes, ritmo de gasto | Hoy a fin de mes | Línea con saldo real y saldo previsto en trazo discontinuo |
| D5 | P09 | ¿Cuánto tengo en total y cómo evoluciona? | Saldo de todas las cuentas a fin de cada mes | Doce meses | Cifra y línea. Desglose por tipo de cuenta |
| D6 | P17 | ¿Gasto más o menos que antes? | Gasto e ingreso mensual | Seis o doce meses | Barras agrupadas por mes |
| D7 | P17 | ¿Qué ha cambiado respecto al mes pasado? | Gasto por categoría de dos meses | Dos meses a elegir | Tabla con diferencia en euros y en porcentaje |
| D8 | P05, P15 | ¿Voy al ritmo de mis objetivos? | Meta, aportado, fecha límite | Vida del objetivo | Anillo de avance y texto "necesitas X al mes" |
| D9 | P05, P13 | ¿Qué se me cobra pronto? | Gastos fijos activos y su día | Próximos catorce días | Lista con fecha, y calendario en P13 |
| D10 | P05 | ¿Qué parte de lo que ingreso ahorro? | Ingresos, gastos y aportaciones a ahorro e inversión | Mes en curso y media de seis meses | Porcentaje |
| D11 | P10 | ¿Cuánto llevo ganado o perdido en esta inversión? | Aportado, valor actual manual y su fecha | Desde la primera aportación | Dos cifras y diferencia. Muestra siempre la fecha del valor |

Reglas comunes:

- Las transferencias nunca cuentan como gasto ni como ingreso.
- Toda cifra prevista se rotula como "Previsto" y se dibuja en trazo discontinuo.
- Si no hay datos suficientes, se muestra un estado vacío con explicación, no un gráfico a cero.
- Ningún dashboard emite juicios ni recomendaciones.

## 7. Esquemas de pantalla de baja fidelidad

### P05 · Inicio

```
┌──────────────────────────────────────┐
│ Noviembre 2026                   ⚙︎  │
│                                      │
│ Disponible este mes                  │
│   412,60 €                           │
│   27,50 € al día · quedan 15 días    │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░  gastado 62 %   │
│                                      │
│ ┌ 2 capturas por revisar ─────── › ┐ │
│                                      │
│ Gasto por categoría                  │
│ Casa        ▓▓▓▓▓▓▓▓▓▓▓   310,00 €   │
│ Comida      ▓▓▓▓▓▓▓       198,40 €   │
│ Transporte  ▓▓▓            84,00 €   │
│ Ocio        ▓▓             61,00 €   │
│                          Ver todo ›  │
│                                      │
│ Próximos cobros                      │
│ 18 nov  Gimnasio            35,00 €  │
│ 20 nov  Música               9,99 €  │
│                                      │
│ Objetivos                            │
│ Viaje  ◔ 38 %   necesitas 125 €/mes  │
│                                      │
│ Fin de mes previsto: 1.240 €         │
├──────────────────────────────────────┤
│ Inicio  Movim.   ( + )   Plan Cuentas│
└──────────────────────────────────────┘
```

#### Inicio tal como queda el 16/11/2026

Inicio muestra un mes de calendario, con flechas para ir al anterior y al siguiente:

1. **Balance del mes** sobre la cabecera: ingresos menos gastos, las dos cifras y la parte
   de los ingresos que se ha guardado (D10).
2. **Tus cuentas**: saldo actual, lo que entra y sale en el mes y la diferencia.
3. **En qué se ha ido el dinero** (D2): anillo con las cinco categorías de más gasto y
   «Otras», y lista con importe y porcentaje.
4. **Últimos seis meses** (D6, parte): barras de ingresos y gastos.

Diferencias con el esquema de arriba, anotadas a propósito:

- El 16/11/2026 no aparecían «Disponible este mes» (D1), próximos cobros (D9), objetivos
  (D8) ni fin de mes previsto (D4). **Aparecen desde el bloque de planificación del
  17/11/2026** (ver «Inicio con planificación», más abajo).
- D2 pedía barras horizontales y desaconsejaba el gráfico circular con más de cinco
  categorías. Se usa un anillo, por decisión del usuario de tener un panel más vistoso,
  limitado a cinco categorías más «Otras» y acompañado siempre de la lista con cifras.
- El patrimonio sigue en Cuentas, no en Inicio.

#### Inicio tal como queda el 17/11/2026

Inicio abre con **lo que se tiene** (patrimonio de hoy), su cambio desde el cierre del mes
anterior y el reparto entre disponible e invertido. Tocarlo abre Patrimonio. El patrimonio
es siempre el de hoy: el selector de mes solo cambia los bloques de debajo, que son:

1. Balance del mes, con ingresos, gastos y la parte guardada.
2. Hoy: gastado hoy y media al día del mes.
3. Tus cuentas. Una cuenta de inversión aparece por lo que vale.
4. Tus inversiones, solo si hay alguna: lo que se ha puesto, lo que vale y si se gana o se
   pierde. Abre el resumen de inversiones.
5. Gasto por categoría y evolución de seis meses, como el 16/11/2026.

#### Inicio con planificación (17/11/2026, rama `h5-planificacion`)

Debajo del patrimonio y antes de los bloques del mes, Inicio muestra, siempre del mes en
curso:

1. **Disponible este mes** (D1): cifra, importe por día y barra de avance. Si se ha
   pasado, «Te has pasado X». Sin presupuesto, la invitación a crearlo.
2. **Ojo con el presupuesto** (T-067, en pantalla): solo si alguna línea pasa del 80 %.
3. **Por confirmar**: cobros con el día vencido, con «Confirmar» en un toque. Solo si hay.
4. **Próximos cobros** (D9): los de los próximos 14 días.
5. **Fin de mes previsto** (D4): la cifra y una línea con el saldo real hasta hoy y el
   previsto en trazo discontinuo. Va rotulado como «Previsto».
6. **Objetivos** (D8): hasta tres, con anillo y ritmo necesario.

Diferencias de presentación con los esquemas de este documento: en P12 la fecha de fin
de un fijo y la fecha límite de un objetivo se eligen por meses y valen hasta el último
día del mes; en P16 «Aportar» anota un apunte sin movimiento; el aviso de cobro y el de
presupuesto son tarjetas en pantalla, no notificaciones.

#### Patrimonio, inversiones y Análisis (17/11/2026)

- **Patrimonio** (D5): cifra de hoy, línea de hasta doce meses, reparto por tipo de cuenta
  y peso de cada cuenta. No dibuja meses anteriores a la primera cuenta.
- **Cuenta de inversión** (P10 y D11): lo que vale hoy y de qué fecha es el valor, lo que
  se ha puesto, «Ganas» o «Pierdes» en euros y en porcentaje, línea con las dos series,
  botón «Actualizar valor» e historial de valores. Aviso en pantalla si el último valor
  tiene más de 30 días. Sin valores, un texto explica para qué sirve anotarlos.
- **Inversiones**: totales, reparto en anillo con lista y un texto fijo que dice que los
  valores los anota la persona y que la app no aconseja.
- **Análisis · Día**: calendario del mes con la cifra de cada día y una barra de
  intensidad, gastado hoy, media al día y día de más gasto. Tocar un día muestra sus
  movimientos. Con la letra del sistema muy grande, el calendario pasa a lista de días.
- **Análisis · Mes** (D7): cada categoría frente al mes anterior, en euros y en
  porcentaje, o «Nuevo». Tocar una abre Movimientos filtrado.
- **Análisis · Año** (D6): balance, ingresos, gastos y parte guardada; barras de los doce
  meses; mes de más y de menos gasto y media mensual; tabla mes a mes (tocar un mes abre
  Inicio en ese mes); gasto por categoría y cambio del patrimonio en el año.

Diferencias con los esquemas de este documento: P17 preveía «Categorías, Tendencia,
Comparar» y queda como «Día, Mes, Año»; D5 situaba la evolución del patrimonio en P09 y
queda en una pantalla propia; D5 pedía «desglose por tipo de cuenta» y además se da el
peso por cuenta.

### P07 · Alta de movimiento

```
┌──────────────────────────────────────┐
│ Cancelar                    Guardar  │
│  [ Gasto ]  Ingreso   Transferencia  │
│                                      │
│              23,40 €                 │
│                                      │
│ Cuenta      Cuenta principal      ›  │
│ Categoría   (Comida) (Casa) (Ocio) ›│
│ Fecha       Hoy                   ›  │
│ Nombre      Mercado Central          │
│                                      │
│   1     2     3                      │
│   4     5     6                      │
│   7     8     9                      │
│   ,     0     ⌫                      │
└──────────────────────────────────────┘
```

### Aviso de captura (fuera de la app)

```
┌──────────────────────────────────────┐
│ FinancialControl                ahora│
│ Mercado Central · 23,40 €            │
│ Cuenta principal · Comida            │
│ [ Guardar ]  [ Editar ]  [ Descartar]│
└──────────────────────────────────────┘
```

### P08 · Bandeja de capturas

```
┌──────────────────────────────────────┐
│ ‹ Movimientos     Capturas (2)       │
│                                      │
│ Hoy 13:42 · Apple Pay                │
│ Mercado Central            23,40 €   │
│ Cuenta principal · Comida            │
│ [ Guardar ] [ Editar ] [ Descartar ] │
│ ──────────────────────────────────── │
│ Ayer 20:15 · Apple Pay               │
│ Comercio desconocido        7,80 €   │
│ ⚠ Tarjeta sin cuenta asignada        │
│ [ Elegir cuenta ]       [ Descartar ]│
│                                      │
│ ¿Falta algún pago?  Añadir a mano ›  │
└──────────────────────────────────────┘
```

### P11 · Presupuesto del mes

```
┌──────────────────────────────────────┐
│  [Presupuesto]  Fijos   Objetivos    │
│ Noviembre 2026               Editar  │
│ Presupuestado 1.100 € · Gastado 687 €│
│                                      │
│ Casa         310 / 320 €             │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│░   quedan 10 €   │
│ Comida       198 / 300 €             │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░│░   quedan 102 €  │
│ Ocio          61 /  50 €        ⚠    │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  excedido 11 € │
│ Transporte    84 / 120 €             │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░│░   quedan 36 €   │
│                                      │
│ │ = día de hoy dentro del mes        │
└──────────────────────────────────────┘
```

### P09 · Cuentas

```
┌──────────────────────────────────────┐
│ Cuentas                          +   │
│ Patrimonio neto                      │
│   8.450,00 €        ▁▂▂▃▄▄▅▅▆▆▇      │
│                    últimos 12 meses  │
│ Banco                                │
│  Cuenta principal        2.150,00 €  │
│ Efectivo                             │
│  Cartera                    60,00 €  │
│ Inversión                            │
│  Bróker                  6.240,00 €  │
│  aportado 5.800 € · +440 € (7,6 %)   │
│  valor del 02/11/2026                │
└──────────────────────────────────────┘
```

### P16 · Objetivo

```
┌──────────────────────────────────────┐
│ ‹ Objetivos        Viaje      Editar │
│            ◔  38 %                   │
│      570 € de 1.500 €                │
│ Fecha límite   30/06/2027            │
│ Necesitas      125 € al mes          │
│ Ritmo actual   95 € al mes   ⚠       │
│ [ Crear aportación mensual ]         │
│ Aportaciones                         │
│ 05 nov   Transferencia      100,00 € │
│ 05 oct   Transferencia       90,00 € │
│                 Añadir aportación ›  │
└──────────────────────────────────────┘
```

### P04 · Guía de Apple Pay

```
┌──────────────────────────────────────┐
│ ‹ Ajustes   Captura con Apple Pay    │
│ Estado:  ● Activa                    │
│ Última captura: hoy, 13:42           │
│                                      │
│ Tu iPhone usa iOS 27                 │
│ 1  Añade el atajo        [ Añadir ]✓ │
│ 2  Ejecútalo una vez     [ Probar ]✓ │
│ 3  Activa la automatización          │
│    [ Abrir Atajos ]                  │
│ 4  Asigna tus tarjetas a cuentas     │
│    Tarjeta débito → Cuenta principal │
│                                      │
│ Qué debes saber                      │
│ · Algunos pagos pueden no capturarse │
│ · Los pagos desde Mac o iPad no      │
│   llegan a la app                    │
│ · Revisa la bandeja de capturas      │
│ [ Enviar una captura de prueba ]     │
└──────────────────────────────────────┘
```

### P17 · Análisis

```
┌──────────────────────────────────────┐
│ ‹ Inicio        Análisis             │
│  [Categorías]  Tendencia  Comparar   │
│ ‹  Noviembre 2026  ›                 │
│ Gasto total   687,40 €               │
│ Casa        ▓▓▓▓▓▓▓▓▓▓▓  310 €  45 % │
│ Comida      ▓▓▓▓▓▓▓      198 €  29 % │
│ Transporte  ▓▓▓           84 €  12 % │
│ Ocio        ▓▓            61 €   9 % │
│ Otros       ▓             34 €   5 % │
│ Frente a octubre: −42 € (−5,8 %)     │
│ Tasa de ahorro: 21 %                 │
└──────────────────────────────────────┘
```

## 8. Accesibilidad

| Aspecto | Requisito | Referencia |
|---|---|---|
| Lector de pantalla | Todo control con etiqueta. Los gráficos tienen descripción textual y alternativa en tabla. El importe se lee como "veintitrés euros con cuarenta" | WCAG 2.2, criterios 1.1.1 y 4.1.2 |
| Tamaño de texto | Se respeta el tamaño de texto del sistema hasta los tamaños de accesibilidad. Las filas crecen en vertical y no truncan importes | WCAG 2.2, criterio 1.4.4 |
| Contraste | 4,5:1 en texto y 3:1 en elementos gráficos, en modo claro y oscuro | WCAG 2.2, criterios 1.4.3 y 1.4.11 |
| Color | El color nunca es el único indicador: exceso de presupuesto con icono y texto, ingresos y gastos con signo y etiqueta | WCAG 2.2, criterio 1.4.1 |
| Áreas táctiles | Mínimo 44 × 44 puntos | Apple Human Interface Guidelines |
| Movimiento | Las animaciones de gráficos se desactivan con "Reducir movimiento" | WCAG 2.2, criterio 2.3.3 |
| Lenguaje | Sin jerga financiera. Los términos necesarios llevan explicación de una línea | WCAG 2.2, criterio 3.1.3 |
| Teclado numérico | Teclado propio con teclas grandes y coma decimal según la región | — |

Las referencias a WCAG y a las guías de Apple proceden de conocimiento general de los
estándares. No se han vuelto a consultar en esta sesión: PENDIENTE DE REVALIDAR antes
del hito de pulido.

## 9. Modo oscuro

- La app sigue el ajuste del sistema. No tiene interruptor propio en V1.
- Colores semánticos (fondo, superficie, texto principal, texto secundario, positivo,
  negativo, aviso), nunca valores fijos en las pantallas.
- Paleta de categorías validada en ambos modos y distinguible con daltonismo.
- Los gráficos usan líneas de referencia tenues y evitan el blanco puro sobre negro puro.
- El widget y el aviso de captura se revisan en ambos modos.

## 10. Idioma y formato

- Español como idioma inicial. Todas las cadenas en catálogo, ninguna escrita en el código.
- Importes, fechas y separador decimal según la región del dispositivo.
- Euro como divisa inicial. El modelo guarda el código de divisa en cada cuenta.

## 11. Sistema visual (16/11/2026)

Todo sale de `src/theme/`. Ninguna pantalla lleva un color fijo.

- **Fondo**: claro con un tinte lavanda. Tarjetas blancas de esquinas amplias y sombra muy
  suave. Cabecera de Inicio con degradado del color de marca (añil a violeta).
- **Color de marca**: añil. **Paleta de categorías**: doce colores con una variante por
  modo. Una prueba calcula que cada uno cumple 3:1 sobre la superficie y que los textos
  cumplen 4,5:1, en claro y en oscuro.
- **Gastos e ingresos**: el gasto va en el color del texto con signo menos; el ingreso, en
  verde con signo más. El rojo queda para balances negativos y errores. Siempre hay signo
  o etiqueta además del color.
- **Cifras**: tabulares, una cifra grande por tarjeta, formato de la región.
- **Categorías**: círculo de color con icono. Si la categoría no tiene color o icono
  guardados, se derivan en la presentación (el color, del orden; el icono, del nombre o
  su inicial). No se escribe en la base de datos.
- **Estados vacíos**: cada bloque sin datos dice qué falta y, si se puede, ofrece el botón
  que lo resuelve.
- **Accesibilidad**: áreas táctiles de 44 puntos, descripción textual de cada gráfico, el
  texto sigue el tamaño del sistema y los gráficos aparecen sin transición con «Reducir
  movimiento».
