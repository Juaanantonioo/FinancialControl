# 07 · Hoja de ruta por hitos y backlog

**Estado: RECALCULADA el 15/11/2026** con las decisiones del usuario (`09-decisiones.md`):
React Native con Expo, base de datos local sincronizada con Supabase, alcance V1 validado,
lanzamiento gratuito con suscripción posterior y sin integración con Notion.

## 1. Convenciones

- **Duración**: cada hito dura una o dos semanas. Ninguno supera las dos.
- **Entrega**: cada hito termina con algo que se puede probar en un iPhone.
- **Estimación relativa** en puntos: 1 (horas), 2 (un día), 3 (dos o tres días),
  5 (una semana), 8 (más de una semana: hay que partirla si se puede).
- **Criterio de aceptación**: binario. Se cumple o no se cumple.
- **Dedicación supuesta**: una persona a tiempo parcial. Las semanas son de calendario
  orientativo, no un compromiso.
- Las pantallas `Pxx`, los flujos `Fxx` y los dashboards `Dxx` remiten a
  `03-diseno-de-producto.md`.

## 2. Resumen de hitos

| Hito | Semanas | Entrega probable en el iPhone | Marca |
|---|---|---|---|
| H0 · Preparación | 1 | App vacía instalada en el iPhone del usuario y proyecto de Supabase creado | Entorno listo |
| H1 · Spike de captura con Apple Pay | 2 | Un pago real produce un aviso con el importe | Spike A medido |
| H2 · Núcleo de movimientos | 2 | Cuentas, categorías, alta y lista de movimientos | |
| H3 · Captura integrada y entrada rápida | 2 | Aviso con Guardar, bandeja, reglas, guía y widget | |
| H4 · Cuentas de usuario y sincronización | 2 | Registro, inicio de sesión y los mismos datos en dos instalaciones | **Primer uso real**, en paralelo con Notion |
| H5 · Presupuesto y gastos fijos | 2 | Presupuesto del mes, fijos, calendario y avisos | |
| H6 · Objetivos, cuentas e inversión manual | 2 | Objetivos con aportaciones, patrimonio y valor de inversión | Gastos fijos y objetivos ya se gestionan en la app |
| H7 · Análisis e Inicio completo | 1 | Dashboards y decisión sobre precios de mercado | Spike B cerrado |
| H8 · Datos, cuenta, primera configuración y calidad | 2 | Bienvenida, eliminación de cuenta, copia de seguridad, accesibilidad, modo oscuro | Candidata a beta |
| H9 · Beta y envío a revisión | 2 | Versión en TestFlight y envío al App Store | **Envío a revisión** |

Total: 18 semanas de trabajo, más el tiempo de revisión de Apple. La suscripción se añade
después del lanzamiento gratuito (apartado 4) y queda fuera de esas 18 semanas.

## 3. Backlog

### H0 · Preparación (1 semana)

| Id | Descripción | Dep. | Criterio de aceptación | Pts |
|---|---|---|---|---|
| T-001 | Registrar las decisiones D1 a D5 del usuario | — | Las cinco decisiones figuran en `09-decisiones.md` (hecho el 15/11/2026) | 1 |
| T-002 | Activar Xcode como directorio de desarrollo, aceptar la licencia e iniciar sesión con el Apple Account | — | `xcodebuild -version` devuelve 27.2 y Xcode muestra un equipo en Cuentas | 1 |
| T-003 | Completar la lista de comprobación de medios (programa de desarrolladores, tipo de inscripción, iPhone, versión de iOS, tarjeta en Wallet) | — | Las seis preguntas del apartado 1.2 de `06-publicacion.md` tienen respuesta escrita | 1 |
| T-004 | Crear el proyecto con el framework elegido y un identificador de app | T-001, T-002 | La app vacía se instala y se abre en el iPhone del usuario | 2 |
| T-005 | Comprobar si App Intents, App Groups, widgets e inicio de sesión con Apple funcionan con cuenta gratuita | T-004 | Existe una nota con el resultado (sí o no) para cada una de las cuatro capacidades | 2 |
| T-006 | Configurar repositorio: rama principal protegida, formato y análisis estático, plantilla de incidencias | T-004 | Un cambio con error de formato hace fallar la comprobación automática | 2 |
| T-007 | Revisar los Atajos actuales del usuario y anotar su lógica, sin modificarlos | — | Existe un documento con los pasos de cada atajo, o la mención expresa de que no contienen lógica propia | 1 |
| T-008 | Crear el proyecto de Supabase de desarrollo en una región de la UE y guardar sus claves fuera del repositorio | T-004 | La app vacía lee una tabla de prueba del proyecto, y una búsqueda en el repositorio no encuentra ninguna clave | 2 |

### H1 · Spike de captura con Apple Pay (2 semanas)

| Id | Descripción | Dep. | Criterio de aceptación | Pts |
|---|---|---|---|---|
| T-010 | Acción "Registrar pago" (App Intent) con parámetros importe, comercio, tarjeta y origen | T-004 | La acción aparece en Atajos al buscar el nombre de la app | 3 |
| T-011 | Almacén compartido mínimo donde la acción guarda la captura en bruto | T-010 | Tras ejecutar la acción con la app cerrada, la captura aparece al abrir la app | 3 |
| T-012 | Aviso local con el contenido de la captura lanzado desde la acción | T-011 | Ejecutar la acción desde Atajos con la app cerrada muestra un aviso con el importe | 3 |
| T-013 | Automatización "Transacción" configurada en el iPhone del usuario | T-010 | Un pago real en tienda ejecuta la acción | 1 |
| T-014 | Medición sobre la muestra del spike A (20 pagos o más, 2 tarjetas, 5 comercios, 7 días) | T-012, T-013 | La hoja de control tiene 20 filas o más y las cinco medidas calculadas | 5 |
| T-015 | Medición de la vía por notificación en iOS 27 sobre la misma muestra | T-013 | Existe la tasa de captura de la vía por notificación, o la nota de que el iPhone no tiene iOS 27 | 3 |
| T-016 | Comprobar el atajo compartido con automatización incluida (iOS 27) | T-010 | Un enlace abre Atajos con el atajo listo para añadir: sí o no, documentado | 2 |
| T-017 | Informe del spike A con decisión según los umbrales | T-014, T-015 | El informe indica en cuál de los tres tramos cae la tasa de captura correcta y la decisión resultante | 1 |

### H2 · Núcleo de movimientos (2 semanas)

| Id | Descripción | Dep. | Criterio de aceptación | Pts |
|---|---|---|---|---|
| T-020 | Base de datos local con las entidades Cuenta, Categoria y Movimiento, y sistema de migraciones | T-004 | Las pruebas automáticas crean, leen, modifican y borran las tres entidades | 5 |
| T-021 | Dinero en céntimos con divisa y funciones de formato según la región | T-020 | Las pruebas de suma y formato pasan para 0,10 + 0,20 y para importes con miles | 2 |
| T-022 | Pantalla de cuentas (P09) con alta y edición de cuenta | T-020 | Se puede crear una cuenta con saldo inicial y aparece en la lista con ese saldo | 3 |
| T-023 | Alta y edición de movimiento (P07) con teclado de importe | T-020, T-021 | Un gasto se guarda en cuatro toques más los dígitos, contados en una grabación | 5 |
| T-024 | Transferencia entre cuentas | T-023 | Una transferencia de 50 € reduce el saldo de origen en 50 €, aumenta el de destino en 50 € y no altera el gasto del mes | 3 |
| T-025 | Lista de movimientos (P06) agrupada por día, con búsqueda y filtros por cuenta, categoría y mes | T-023 | Buscar un nombre devuelve solo los movimientos que lo contienen | 3 |
| T-026 | Cálculo de saldo por cuenta | T-024 | Las pruebas del cálculo pasan con ingresos, gastos, transferencias y ajustes | 2 |
| T-027 | Gestión de categorías (parte de P19): crear, renombrar, ordenar y archivar | T-020 | Archivar una categoría la oculta en el alta y conserva sus movimientos | 2 |
| T-028 | Borrado con deshacer | T-025 | Tras borrar un movimiento, "Deshacer" lo recupera con los mismos datos | 2 |

### H3 · Captura integrada y entrada rápida (2 semanas)

| Id | Descripción | Dep. | Criterio de aceptación | Pts |
|---|---|---|---|---|
| T-030 | Entidad Captura y conversión de captura en movimiento | T-011, T-020 | Guardar una captura crea un movimiento con origen `apple_pay` y enlaza los dos registros | 3 |
| T-031 | Extracción de importe y divisa a partir del texto recibido | T-030 | Las pruebas pasan con "23,40 €", "€23.40", "23.40", "1.234,56 €" y texto vacío | 2 |
| T-032 | Regla tarjeta a cuenta (AliasDeTarjeta) según el apartado A.4 del spike | T-030 | Con un alias creado, una captura con esa tarjeta lleva la cuenta; con una tarjeta desconocida y dos cuentas de banco, queda sin cuenta | 3 |
| T-033 | Regla comercio a categoría, actualizada al guardar | T-030 | El segundo movimiento del mismo comercio propone la categoría del primero | 2 |
| T-034 | Detección de duplicados | T-030 | Dos capturas del mismo importe y cuenta con menos de 10 minutos de diferencia dejan una sola pendiente | 2 |
| T-035 | Aviso con las acciones Guardar, Editar y Descartar | T-012, T-030 | Guardar desde el aviso crea el movimiento sin abrir la app | 5 |
| T-036 | Bandeja de capturas (P08) | T-030 | Una captura no atendida aparece en la bandeja con sus tres acciones | 3 |
| T-037 | Guía de Apple Pay (P04) con rama por versión de iOS, captura de prueba y estado | T-016, T-035 | "Enviar una captura de prueba" produce el aviso, y la pantalla muestra la fecha de la última captura | 5 |
| T-038 | Acción de Atajos "Añadir gasto" con parámetros completos | T-010, T-023 | Ejecutar la acción con importe y categoría crea un movimiento | 2 |
| T-039 | Widget de pantalla de inicio con disponible del mes y botón de alta | T-026 | El widget muestra una cifra y su botón abre el alta (P07) | 5 |
| T-040 | Recordatorio de capturas sin revisar | T-036 | Con una captura pendiente de más de 24 horas, llega un aviso; sin pendientes, no llega | 1 |

### H4 · Cuentas de usuario y sincronización (2 semanas) — **primer uso real**

| Id | Descripción | Dep. | Criterio de aceptación | Pts |
|---|---|---|---|---|
| T-130 | Esquema en Supabase para las entidades de H2 y H3, con el identificador de usuario en cada fila y migraciones versionadas en el repositorio | T-008, T-020 | Aplicar las migraciones sobre un proyecto vacío crea todas las tablas sin pasos manuales | 3 |
| T-131 | Reglas de acceso por fila (Row Level Security) en todas las tablas | T-130 | Una prueba automática con dos usuarios demuestra que ninguno lee ni modifica filas del otro, y ninguna tabla queda sin reglas | 3 |
| T-132 | Registro, inicio y cierre de sesión con correo y contraseña (P22), con la sesión guardada en el llavero | T-008 | Tras cerrar y reabrir la app la sesión sigue activa, y tras cerrar sesión no queda visible ningún dato del usuario | 5 |
| T-133 | Inicio de sesión con Apple, si la cuenta de desarrollador lo permite | T-132, T-005 | Se entra con el Apple Account, o la tarea se marca "aplazada" con el motivo anotado | 2 |
| T-134 | Subida de los cambios locales al servidor por marca de modificación, incluido el borrado lógico | T-130, T-132 | Crear 30, editar 10 y borrar 10 movimientos deja los 50 cambios reflejados en el servidor en menos de 1 minuto con conexión | 5 |
| T-135 | Bajada de cambios y resolución de conflictos (gana la modificación más reciente) | T-134 | Con dos instalaciones de la misma cuenta, un cambio hecho en una aparece en la otra, y una edición simultánea deja el mismo valor en las dos | 5 |
| T-136 | Cola sin conexión | T-134 | 10 movimientos creados sin red llegan al servidor al recuperar la conexión, sin duplicados | 3 |
| T-137 | Las capturas guardadas por la acción de Atajos con la app cerrada se sincronizan al abrirla | T-030, T-134 | Una captura hecha con la app cerrada aparece en el servidor tras abrir la app | 2 |
| T-138 | Pantalla de cuenta (P23) con el estado de la sincronización | T-134 | Con cambios sin enviar muestra cuántos son, y sin cambios muestra "Al día" | 2 |
| T-139 | **Cambio de uso**: el usuario anota gastos e ingresos en la app durante 7 días y sigue llevando su Notion a mano | T-035, T-135 | Al cabo de 7 días, la suma de gastos de la semana en la app coincide al céntimo con la que el usuario tiene anotada | 2 |

### H5 · Presupuesto y gastos fijos (2 semanas)

| Id | Descripción | Dep. | Criterio de aceptación | Pts |
|---|---|---|---|---|
| T-060 | Entidades Presupuesto, LineaDePresupuesto y ReglaRecurrente | T-020 | Las pruebas de creación y consulta por mes pasan | 3 |
| T-061 | Edición de presupuesto (P12) con propuesta por media de tres meses y copia del mes anterior | T-060 | Con tres meses de datos, cada categoría muestra la media; "Copiar" reproduce los importes del mes anterior | 3 |
| T-062 | Presupuesto del mes (P11) con previsto frente a real y marca del día | T-061 | Una categoría con gasto superior al previsto muestra icono y texto de exceso, no solo color | 3 |
| T-063 | Cálculo del disponible del mes y del importe por día (D1) | T-060, T-026 | Las pruebas del cálculo pasan, incluido el caso de un gasto fijo ya cobrado | 2 |
| T-064 | Gastos fijos (P13, P14): lista, total mensual, alta y edición | T-060 | El total mensual es la suma de los gastos fijos activos | 3 |
| T-065 | Calendario de cobros y lista de próximos 14 días (D9) | T-064 | Un gasto fijo del día 18 aparece el 18 en el calendario | 2 |
| T-066 | Aviso previo y confirmación de cobro en un toque | T-064, T-035 | Confirmar el aviso crea un movimiento con origen `recurrente` enlazado a la regla | 3 |
| T-067 | Aviso de presupuesto a punto de agotarse | T-062 | Al pasar del 80 % de una categoría llega un único aviso para esa categoría y mes | 2 |
| T-069 | Previsión de saldo a fin de mes (D4) | T-063, T-064 | Con un saldo, dos fijos pendientes y un ingreso recurrente de ejemplo, la cifra coincide con el cálculo hecho a mano | 3 |

### H6 · Objetivos, cuentas e inversión manual (2 semanas)

| Id | Descripción | Dep. | Criterio de aceptación | Pts |
|---|---|---|---|---|
| T-070 | Entidades Objetivo, AportacionAObjetivo y ValorDeInversion | T-020 | Las pruebas de creación y suma de aportaciones pasan | 2 |
| T-071 | Objetivos (P15, P16) con avance y cálculo del ritmo necesario | T-070 | Un objetivo de 1 500 € con 500 € aportados y 8 meses de plazo muestra "125 € al mes" | 3 |
| T-072 | Aportación mensual automática como regla recurrente | T-071, T-066 | Confirmar la aportación crea la transferencia y suma al objetivo | 3 |
| T-074 | Detalle de cuenta (P10) con evolución y cuadre de saldo | T-026 | Introducir un saldo real distinto crea un movimiento de ajuste por la diferencia | 3 |
| T-075 | Valor de inversión (P21) y rentabilidad simple (D11) | T-070, T-024 | Con tres aportaciones y un valor de ejemplo, la app muestra aportado, valor, diferencia en euros y en porcentaje, y la fecha del valor | 3 |
| T-076 | Patrimonio neto y su evolución (D5) | T-074, T-075 | El patrimonio es la suma de saldos de banco y efectivo más el último valor de cada inversión | 3 |
| T-077 | Recordatorio mensual para actualizar el valor de las inversiones | T-075 | Con un valor de más de 30 días llega un aviso; con uno reciente, no | 1 |
| T-078 | **Cambio de uso**: gastos fijos y objetivos pasan a gestionarse en la app | T-064, T-071 | El usuario confirma por escrito que sus gastos fijos y objetivos vigentes están dados de alta en la app | 1 |

### H7 · Análisis e Inicio completo (1 semana)

| Id | Descripción | Dep. | Criterio de aceptación | Pts |
|---|---|---|---|---|
| T-080 | Elegir e integrar la biblioteca de gráficos, verificando versión y licencia | T-004 | Un gráfico de barras de ejemplo se dibuja en modo claro y oscuro | 2 |
| T-081 | Gasto por categoría (D2) y pantalla de Análisis (P17) | T-080, T-025 | Tocar una categoría abre Movimientos filtrado por esa categoría y ese mes | 3 |
| T-082 | Tendencia mensual (D6) y comparativa de dos meses (D7) | T-081 | La comparativa muestra la diferencia en euros y en porcentaje de cada categoría | 3 |
| T-083 | Tasa de ahorro (D10) | T-026 | Con 2 000 € de ingresos y 1 600 € de gastos de ejemplo muestra 20 % | 1 |
| T-084 | Inicio completo (P05) con D1, D2, D8, D9 y D4 | T-063, T-065, T-071, T-081 | Los cinco bloques muestran datos, o un estado vacío con explicación | 3 |
| T-085 | Cierre del spike B: lista de 20 instrumentos, consulta a proveedores y decisión | — | El informe indica si se cumplen las cuatro condiciones del apartado B.5 y la decisión resultante | 3 |

### H8 · Datos, cuenta, primera configuración y calidad (2 semanas)

| Id | Descripción | Dep. | Criterio de aceptación | Pts |
|---|---|---|---|---|
| T-090 | Primera configuración (P01, P02, P03) y datos de ejemplo | T-022, T-027 | Un usuario nuevo, una vez registrado, llega a Inicio en menos de 2 minutos escribiendo solo un saldo | 5 |
| T-091 | Exportación a CSV | T-025 | El fichero tiene una fila por movimiento y se abre en una hoja de cálculo con los importes correctos | 2 |
| T-092 | Copia de seguridad y restauración en fichero | T-020 | Restaurar una copia en una instalación limpia deja el mismo número de registros en cada entidad | 5 |
| T-093 | Eliminación de la cuenta y de todos sus datos, en el servidor y en el dispositivo | T-020, T-132 | Tras confirmar, no queda ninguna fila del usuario en el servidor, el dispositivo queda vacío y se muestra la pantalla de acceso | 3 |
| T-094 | Bloqueo con Face ID o código | T-004 | Con el bloqueo activo, la app pide autenticación al volver de segundo plano | 2 |
| T-095 | Ajustes (P18), reglas (P19) y datos (P20) completos | T-032, T-033, T-091 | Se puede corregir un alias de tarjeta y la siguiente captura usa la cuenta corregida | 3 |
| T-096 | Revisión de accesibilidad: VoiceOver, texto grande, contraste, áreas táctiles | T-084 | Los flujos F1 a F9 se completan con VoiceOver, y ningún texto se trunca con el tamaño de letra máximo | 5 |
| T-097 | Modo oscuro en todas las pantallas, widget y avisos | T-084 | Las 21 pantallas se revisan en ambos modos sin texto ilegible | 3 |
| T-098 | Todas las cadenas en el catálogo de traducción | T-084 | Una búsqueda automática no encuentra cadenas visibles escritas en el código | 2 |
| T-099 | Pruebas automáticas de los cálculos y de los flujos principales | T-084 | El conjunto de pruebas pasa, y cubre saldo, disponible, previsión, duplicados y reglas | 5 |

### H9 · Beta y envío a revisión (2 semanas)

| Id | Descripción | Dep. | Criterio de aceptación | Pts |
|---|---|---|---|---|
| T-100 | Inscripción en el Apple Developer Program, si no existe | T-003 | La página de la cuenta muestra una membresía activa | 1 |
| T-101 | Ficha en App Store Connect: nombre, categoría Finanzas, descripción y palabras clave | T-100 | La ficha no tiene campos obligatorios vacíos | 2 |
| T-102 | Política de privacidad publicada y enlazada | T-001 | La URL responde, y el enlace existe en Ajustes y en App Store Connect | 3 |
| T-103 | Etiquetas de privacidad, manifiestos de dependencias y condición de comerciante | T-102 | Las tres secciones aparecen como completadas en App Store Connect | 2 |
| T-111 | Proyecto de Supabase de producción en región de la UE, separado del de desarrollo, con el plan y las copias de seguridad decididos | T-130 | La versión de TestFlight apunta al proyecto de producción, y existe una nota con el plan elegido y la forma de hacer copias | 3 |
| T-112 | Contrato de encargado del tratamiento con Supabase y registro de actividades de tratamiento | T-111 | Existen los dos documentos, fechados | 2 |
| T-105 | Capturas de pantalla con datos de ejemplo y textos de la ficha | T-097 | Ninguna captura contiene datos reales | 2 |
| T-106 | Primera versión en TestFlight y prueba interna | T-099, T-100 | La versión se instala desde TestFlight en el iPhone del usuario | 2 |
| T-107 | Prueba con al menos 3 personas ajenas al proyecto, incluida la guía de Apple Pay | T-106 | Al menos 2 de 3 completan la guía en menos de 5 minutos sin ayuda | 3 |
| T-108 | Corrección de los fallos graves de la beta | T-107 | No queda ninguna incidencia abierta marcada como bloqueante | 5 |
| T-109 | Notas para la revisión, con vídeo de la captura y cómo probarla sin tarjeta | T-037 | Las notas incluyen el enlace al vídeo y los pasos de la captura de prueba | 1 |
| T-110 | **Envío a revisión del App Store** | T-101 a T-112 | App Store Connect muestra el estado "Waiting for Review" | 1 |

## 4. Después del envío

| Id | Descripción | Dep. | Criterio de aceptación | Pts |
|---|---|---|---|---|
| T-120 | Atender la respuesta de la revisión | T-110 | La app pasa a "Ready for Distribution" o existe una respuesta enviada a cada objeción | 3 |
| T-121 | Decidir si se deja de usar Notion | T-078 | Tras 30 días de uso en paralelo, el usuario decide por escrito si deja de anotar en Notion | 1 |
| T-122 | Planificar V1.x con los comentarios de los primeros usuarios | T-120 | Existe una lista priorizada de mejoras | 2 |
| T-123 | Definir qué queda detrás de la suscripción, su precio y el trato a quienes ya usaban la app gratis | T-120 | Existe la decisión escrita del usuario sobre los tres puntos | 2 |
| T-124 | Trámites de cobro: acuerdo de apps de pago, datos fiscales y bancarios y condición de comerciante | T-123 | App Store Connect muestra el acuerdo activo y la condición de comerciante declarada | 3 |
| T-125 | Suscripción autorrenovable con prueba gratuita de 6 meses creada en App Store Connect | T-124 | El producto figura listo para enviar, con la oferta de introducción de 6 meses | 2 |
| T-126 | Compra, restauración y comprobación del estado de la suscripción dentro de la app | T-125 | Una compra en el entorno de pruebas desbloquea las funciones de pago, y "Restaurar compras" las recupera en una instalación limpia | 5 |
| T-127 | Pantalla de suscripción con el precio, la duración de la prueba y la renovación a la vista | T-126 | Antes de confirmar la compra, la pantalla muestra el precio, la fecha del primer cobro y cómo cancelar | 3 |

## 5. Dependencias entre hitos

```
H0 ─► H1 ─► H3 ─► H4 ─► H5 ─► H6 ─► H7 ─► H8 ─► H9
       └─► H2 ─┘
```

H1 y H2 pueden solaparse: H1 valida la capa nativa y H2 construye el núcleo.

## 6. Efecto de las decisiones del usuario en la hoja de ruta

| Decisión | Efecto |
|---|---|
| D1 · React Native con Expo | H0 y H1 se hacen con Expo. Si las bibliotecas en alfa fallan en H1, los intents y el widget se escriben en Swift dentro del mismo proyecto |
| D2 · Supabase desde V1 | Entra el hito H4 de cuentas y sincronización, y las tareas T-008, T-093, T-111 y T-112. Es el hito de mayor riesgo técnico después de H1 |
| D3 · Alcance validado | Sin cambios, salvo que entra J4 y salen J5 y J6 |
| D4 · Gratuita y después suscripción | T-104 sale de V1. La suscripción pasa al apartado 4 (T-123 a T-127), fuera de las 18 semanas |
| D5 · Sin Notion | Salen las diez tareas del antiguo H4 y las importaciones T-068 y T-073 |

El total se mantiene en 18 semanas porque el trabajo de Notion que sale es parecido al de
sincronización que entra. La cifra no incluye margen.

## 7. Comprobación de los criterios de éxito

- Todas las tareas tienen identificador, descripción, dependencias, criterio binario y
  estimación.
- Ningún hito supera las dos semanas.
- Hito en el que la app sustituye por primera vez una parte real del uso de Notion: **H4**
  (tarea T-139).
- Hito de envío a revisión: **H9** (tarea T-110).
