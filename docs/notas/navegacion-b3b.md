# Navegación · bloque B3b

Mapa de la app antes y después de reorganizarla. El mapa actual se escribió
el 17/11/2026 sobre la rama `b3-entrada-rapida` @ `4012009`, leyendo cada
fichero de `src/app/`, antes de cambiar código.

Los toques se cuentan desde Inicio, con la app ya abierta. Cambiar de
pestaña cuenta como un toque. Desplazar la pantalla no cuenta como toque,
pero se anota.

## 1. Mapa actual

### 1.1 Pantallas

| Ruta | Qué responde | Cómo se llega | Toques |
|---|---|---|---|
| `/` (Inicio) | Cuánto tengo, cómo va el mes y qué viene | Pestaña | 0 |
| `/movimientos` | Qué he anotado | Pestaña. También desde una categoría de Inicio, de Análisis o del presupuesto | 1 |
| `/analisis` | Cómo gasto por día, mes y año | Pestaña | 1 |
| `/plan` | Presupuesto, gastos fijos y objetivos | Pestaña. También «Ver» del aviso de presupuesto y «Ver todos» de objetivos en Inicio | 1 |
| `/cuentas` | Cuánto hay en cada cuenta | Pestaña | 1 |
| `/movimiento` (hoja) | Anotar o editar un movimiento | «+» de Inicio y de Movimientos; una fila de movimiento; una captura de la bandeja; el widget | 1 |
| `/cuenta` (hoja) | Crear o editar una cuenta | «+» de Cuentas; «Crear una cuenta» en estados vacíos; «Editar» en el detalle | 2 |
| `/detalle-de-cuenta` | Saldo y movimientos de una cuenta | Fila de cuenta en Inicio, Cuentas, Patrimonio o Inversiones | 1 |
| `/patrimonio` | Evolución de lo que tengo | Cabecera de Inicio; tarjeta «Patrimonio neto» de Cuentas | 1 |
| `/inversiones` | Lo aportado, lo que vale y la ganancia | Solo desde el bloque «Inversiones» de Inicio, que está a media pantalla y solo sale si hay cuentas de inversión | 1 y desplazar |
| `/valor-de-inversion` (hoja) | Anotar cuánto vale una inversión | «Actualizar valor» en el detalle de una cuenta de inversión | 2 y desplazar |
| `/capturas` | Pagos de Apple Pay por revisar | Tarjeta de Inicio (solo si hay alguno); botón «Bandeja» de Movimientos; «Ver» de la guía; aviso del sistema | 1 o 2 |
| `/apple-pay` | Cómo montar la automatización y qué tarjetas se recuerdan | Pie de Cuentas; «Cómo» de la bandeja | 2 y desplazar |
| `/avisos` | Qué avisos quiero recibir | Pie de Cuentas | 2 y desplazar |
| `/categorias` | Gestionar categorías | Pie de Cuentas; «Gestionar» en el alta de movimiento | 2 y desplazar |
| `/diagnostico` | Prueba de conexión con Supabase | Enlace al pie de Cuentas, solo en desarrollo. En la app instalada en Release no se alcanza | 2 y desplazar |
| `/presupuesto` (hoja) | Crear o editar el presupuesto de un mes | «Crear presupuesto» de Inicio o de Plan; «Editar presupuesto» | 2 |
| `/regla` (hoja) | Crear o editar un gasto fijo | «+» de Plan › Fijos; fila de regla; estado vacío de Inicio; objetivo | 3 |
| `/cobro` (hoja) | Confirmar un cobro con otro importe o fecha | Fila de cobro en Inicio o Plan › Fijos | 1 |
| `/objetivo` | Avance de un objetivo | Fila de objetivo en Inicio o Plan › Objetivos | 1 |
| `/objetivo-editar` (hoja) | Crear o editar un objetivo | «+» de Plan › Objetivos; estado vacío; «Editar» del objetivo | 3 |
| `/aportacion` (hoja) | Aportar a un objetivo | «Aportar» en el objetivo | 2 |

### 1.2 Bloques de Inicio

Trece bloques con contenido, más el selector de divisa (si hay más de una) y
el selector de mes.

| # | Bloque | Dónde existe ya el mismo dato |
|---|---|---|
| 1 | Cabecera «Lo que tienes» (total, variación, disponible e invertido) | `/patrimonio`; Cuentas (solo el total) |
| 2 | Pagos por revisar (si hay) | Movimientos, botón «Bandeja» |
| 3 | Disponible este mes | Plan › Presupuesto lo muestra solo como nota y solo si quedan fijos |
| 4 | Aviso de presupuesto (si hay) | Plan › Presupuesto, en el estado de cada línea |
| 5 | Por confirmar (si hay) | Plan › Fijos |
| 6 | Próximos cobros | Plan › Fijos |
| 7 | Fin de mes previsto | **En ningún otro sitio** |
| 8 | Objetivos (hasta 3) | Plan › Objetivos |
| 9 | Balance del mes (con selector de mes) | **En ningún otro sitio como cifra**: Análisis › Mes solo lo dibuja en barras |
| 10 | Hoy (gasto de hoy y media diaria) | Análisis › Día |
| 11 | Tus cuentas (saldo y cambio del mes) | Saldo en Cuentas; el cambio del mes, en el detalle de cada cuenta |
| 12 | Inversiones (si hay) | `/inversiones` |
| 13 | En qué se ha ido el dinero (anillo) | **En ningún otro sitio**: Análisis › Mes tiene la comparativa, no el reparto con porcentajes |
| 14 | Últimos seis meses | Análisis › Mes, idéntico |

### 1.3 Dónde aparece un «+»

| Pantalla | Qué hace |
|---|---|
| Inicio (cabecera) | Añade un movimiento |
| Movimientos (cabecera) | Añade un movimiento |
| Plan › Fijos (cabecera) | Crea un gasto fijo |
| Plan › Objetivos (cabecera) | Crea un objetivo |
| Plan › Presupuesto | No hay «+» |
| Análisis | No hay «+» |
| Cuentas (cabecera) | Crea una cuenta |

El texto de Cuentas sin datos dice «Toca el botón + para crear la primera».
La guía de Apple Pay menciona el «+» de la app Atajos, que es de otra app.

### 1.4 Enlaces de entrada

| Origen | Destino |
|---|---|
| Widget pequeño | `financialcontrol://movimiento` |
| Widget mediano, fondo | `financialcontrol://` |
| Widget mediano, botón | `financialcontrol://movimiento` |
| Aviso de cobro | `/plan` con `seccion=fijos` y `mes` |
| Aviso de presupuesto | `/plan` con `seccion=presupuesto` y `mes` |
| Aviso de pagos sin revisar | `/capturas` |
| Aviso de una captura de Atajos | `/capturas` con `cola` |
| Aviso de valor de inversión | `/detalle-de-cuenta` con `id` |
| Parámetros de Plan | `seccion` (`presupuesto`, `fijos`, `objetivos`) y `mes` |
| Parámetros de Análisis | `vista` (`dia`, `mes`, `anio`), `mes`, `anio`, `dia` |
| Parámetros de Movimientos | `categoriaId`, `cuentaId`, `mes`, `dia`, `peticion` |
| Parámetros de Inicio | `mes`, `peticion` (lo usa la tabla del año de Análisis) |

### 1.5 Problemas del encargo frente a lo observado

| | Resultado |
|---|---|
| P1 | Confirmado. Son catorce bloques contando «Inversiones», que el encargo no lista. Tres no existen en ningún otro sitio (7, 9 y 13) |
| P2 | Confirmado |
| P3 | Confirmado |
| P4 | Confirmado, con un matiz: Diagnóstico no está en ese bloque, es un enlace aparte que solo se ve en desarrollo |
| P5 | Confirmado en Inversiones y la bandeja. Patrimonio sí tiene acceso fijo: la cabecera de Inicio y la tarjeta de Cuentas |
| P6 | Confirmado |

Defecto encontrado al leer: Plan aplica los parámetros «una vez por
petición» comparando sección y mes, sin marca de petición. Pedir dos veces
la misma sección (por ejemplo «Ver todos» de objetivos, cambiar a
Presupuesto a mano y volver a pulsar «Ver todos») no hace nada la segunda
vez. Se corrige en este bloque.

## 2. Mapa propuesto

### 2.1 Botón de añadir

La documentación de NativeTabs para SDK 58
(`docs.expo.dev/router/advanced/native-tabs`) y los tipos instalados
(`expo-router` 58.0.31) no ofrecen un botón de acción en la barra: un
`Trigger` siempre es una pestaña, el único `role` es `search` y
`BottomAccessory` es una franja sobre la barra pensada para un reproductor,
solo en iOS 26. Se usa la segunda vía de D-c: botón flotante abajo a la
derecha, el mismo componente en las cinco pestañas.

### 2.2 Pantallas

| Ruta | Antes | Después |
|---|---|---|
| `/movimiento` | «+» de cabecera en dos pestañas | Botón flotante en las cinco |
| `/ajustes` | No existía | Engranaje en la cabecera de Inicio |
| `/categorias`, `/apple-pay`, `/avisos`, `/diagnostico` | Pie de Cuentas | Ajustes |
| `/inversiones` | Bloque de Inicio | Sección «Inversiones» de Cuentas |
| `/patrimonio` | Cabecera de Inicio y tarjeta de Cuentas | Igual; la tarjeta de Cuentas dice «Ver evolución» |
| `/capturas` | Tarjeta de Inicio y botón «Bandeja» | Fila de «Pendiente» en Inicio y botón «Por revisar» de Movimientos |
| `/cuenta` | «+» de Cuentas | Botón «Nueva cuenta» en Cuentas |
| `/regla` | «+» de Plan › Fijos | Botón «Nuevo gasto fijo» en la sección |
| `/objetivo-editar` | «+» de Plan › Objetivos | Botón «Nuevo objetivo» en la sección |
| Resto | — | Sin cambios |

Ninguna ruta cambia de nombre ni desaparece.

### 2.3 Bloques de Inicio

| Bloque de antes | Después |
|---|---|
| Cabecera «Lo que tienes» | Inicio, bloque 1. El «+» deja su sitio al engranaje |
| Disponible este mes | Inicio, bloque 2 |
| Aviso de presupuesto | Inicio, bloque 3 «Pendiente» |
| Por confirmar | Inicio, bloque 3 «Pendiente» |
| Pagos por revisar | Inicio, bloque 3 «Pendiente» |
| Próximos cobros | Inicio, bloque 4, con tres como mucho y «Ver todos» |
| Balance del mes | Inicio, bloque 5 «Este mes» (mes en curso). El bloque con selector de mes pasa a Análisis › Mes |
| Hoy | Una línea de «Este mes». La media diaria sigue en Análisis › Día |
| Objetivos | Inicio, bloque 6, con dos como mucho y «Ver todos» |
| — | Inicio, bloque 7 «Primeros pasos», mientras falte alguno |
| Fin de mes previsto | Plan › Presupuesto, el bloque tal cual |
| En qué se ha ido el dinero | Análisis › Mes, el bloque tal cual |
| Últimos seis meses | Análisis › Mes, que ya lo tenía |
| Tus cuentas | Pestaña Cuentas. El cambio del mes sigue en el detalle de cada cuenta |
| Inversiones | Pestaña Cuentas, sección «Inversiones» |

Inicio deja de tener selector de mes: habla de hoy y del mes en curso. Quien
quiera otro mes lo elige en Análisis › Mes, que ahora tiene el balance y el
reparto. La tabla del año de Análisis, que abría Inicio en un mes, abre
Análisis › Mes en ese mes.

### 2.4 Dónde aparece un «+»

Solo en el botón flotante, que añade un movimiento.

### 2.5 Todas las pantallas se alcanzan

| Ruta | Camino visible |
|---|---|
| Cinco pestañas | Barra |
| `/movimiento` | Botón flotante |
| `/ajustes` | Engranaje de Inicio |
| `/categorias`, `/apple-pay`, `/avisos`, `/diagnostico` | Ajustes |
| `/capturas` | Movimientos › «Por revisar» |
| `/cuenta` | Cuentas › «Nueva cuenta» |
| `/detalle-de-cuenta` | Cuentas › fila |
| `/patrimonio` | Cabecera de Inicio; Cuentas › «Lo que tienes» |
| `/inversiones` | Cuentas › «Inversiones» |
| `/valor-de-inversion` | Detalle de una cuenta de inversión › «Actualizar valor» |
| `/presupuesto` | Plan › Presupuesto › «Crear» o «Editar presupuesto» |
| `/regla` | Plan › Fijos › «Nuevo gasto fijo» o una fila |
| `/cobro` | Plan › Fijos › fila de cobro |
| `/objetivo` | Plan › Objetivos › fila |
| `/objetivo-editar` | Plan › Objetivos › «Nuevo objetivo» |
| `/aportacion` | Objetivo › «Aportar» |

## 3. Tabla de toques

Cómo se midió: el simulador no deja tocar la pantalla desde la línea de
órdenes, así que cada recorrido se hizo en las pruebas de pantalla
(`src/pruebas/__tests__/navegacion.test.tsx`, bloque «toques desde Inicio
hasta cada tarea frecuente»), pulsando los controles reales de cada pantalla
y contando las pulsaciones. Cambiar de pestaña cuenta como un toque. La
columna «antes» se contó igual sobre el código de `b3-entrada-rapida`. Que
cada control está donde el dedo llega se comprobó en las capturas. Nadie lo
ha hecho con el dedo en un iPhone: eso queda como NO DEMOSTRADO.

| Tarea | Antes | Después | Objetivo |
|---|---|---|---|
| Anotar un gasto desde Inicio o Movimientos | 1 | 1 | 1 |
| Anotar un gasto desde Análisis, Plan o Cuentas | 2 (cambiar a una pestaña con «+») | 1 | 1 |
| Abrir la bandeja con pagos por revisar | 1 | 1 (fila de «Pendiente») | 2 o menos |
| Abrir la bandeja sin pagos por revisar | 2 | 2 (Movimientos › Bandeja) | 2 o menos |
| Confirmar un cobro pendiente | 1 | 1 (botón «Confirmar» en «Pendiente») | 2 o menos |
| Abrir Ajustes › Avisos | 2 y desplazar hasta el pie de Cuentas | 2 (engranaje › Avisos) | 2 o menos |
| Actualizar el valor de una inversión | 2 y desplazar (fila de la cuenta en Inicio › Actualizar valor) | 3 (Cuentas › cuenta › Actualizar valor) | 3 o menos |
| Ver el presupuesto del mes | 1 | 1 (pestaña Plan) | 1 |
| Ver la evolución del patrimonio | 1 | 1 desde Inicio, 2 desde Cuentas | 2 o menos |

Todos los objetivos se cumplen. Actualizar una inversión cuesta un toque
más que antes, a cambio de no depender de desplazar Inicio hasta su lista de
cuentas; sigue dentro del objetivo.

## 4. Lo que el mapa propuesto no decía y se hizo

- Las pestañas pasan a ser la base de la pila. Al probar
  `financialcontrol://movimiento` con la app cerrada, el alta se abría como
  única pantalla, sin pestañas debajo y con «Cancelar» y «Guardar» bajo la
  hora del sistema. Ya pasaba en B3 (es lo que abre el widget). Con
  `unstable_settings.anchor` se abre como hoja sobre Inicio.
- «Bandeja» sigue siendo el nombre del acceso en Movimientos y «Pagos por
  revisar» el de la pantalla y el de la fila de Inicio. No se unificaron
  porque tres pruebas de B3 comprueban el texto «Bandeja» y no son pruebas
  de ubicación.
