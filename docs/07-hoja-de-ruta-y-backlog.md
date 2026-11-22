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

### 2.1 Orden de trabajo vigente desde el 17/11/2026 (decisiones D7 a D9)

Los hitos y las tareas conservan su identificador. Cambia el orden en que se abordan:

| Bloque | Contenido | Tareas de este documento | Estado |
|---|---|---|---|
| Hecho | Preparación, spike de Apple Pay sin medir, núcleo de movimientos, rediseño e Inicio | H0, H1 (parcial), H2, y parte de T-080, T-081, T-083 y T-084 | Ramas `h0` a `h2b` |
| 1 · Visión completa | Patrimonio, inversión manual, vistas por día, mes y año | T-070 (solo ValorDeInversion), T-075, T-076, T-082, resto de T-081 | Encargo en `docs/prompt-claude-code-h3-vision-completa.md` |
| 2 · Planificación | Presupuesto, disponible del mes, gastos fijos y objetivos | H5 completo, y T-070 a T-072 de H6 | Hecho en la rama `h5-planificacion`, sin notificaciones (T-066 y T-067 parciales). Ver apartado 2.3 |
| 3 · Entrada rápida | Captura con Apple Pay integrada, widget y recordatorios | H3, y cierre de H1 con la medición del spike A | Hecho en la rama `b3-entrada-rapida`, sin medir en un iPhone. T-035 parcial. Ver apartado 2.4 |
| 3b · Navegación | Inicio en siete bloques, botón de añadir en las cinco pestañas, Ajustes y Cuentas con inversiones | Sin tareas nuevas: reorganiza lo construido | Hecho en la rama `b3b-navegacion`. Solo JavaScript. Ver `docs/notas/navegacion-b3b.md` |
| 3c · Apariencia | Apariencia automática, clara u oscura desde Ajustes | Sin tareas nuevas | Hecho en la rama `b3c-apariencia`. Solo JavaScript. Ver `estado.md`, apartado 12 |
| 4a · Seguridad local | Auditoría con OWASP MASVS, bloqueo de la app, modo privado, validación de entradas externas y modelo de amenazas | Sin tareas nuevas: prepara H4 | Hecho en la rama `b4a-seguridad-local`, sin probar en un iPhone. Ver apartado 2.5 |
| 4b-1 · Cuenta y claves | Alta, inicio y cierre de sesión, borrado de cuenta, claves, código de recuperación y esquema remoto con RLS. No sincroniza | H4 en parte; requisitos R-01 a R-30 según `docs/seguridad/modelo-de-amenazas.md`, apartado 6 | Hecho en la rama `b4b1-cuenta-y-claves`, sin probar en un iPhone y sin aplicar al proyecto remoto. Ver apartado 2.6 |
| 4b-2 · Sincronización cifrada | Sincronización fila a fila con cifrado en el dispositivo, entrada en una cuenta, cambio de contraseña y exportación | H4 en parte; R-01, R-03, R-07, R-13 y R-24 | Hecho en la rama `b4b2-sincronizacion`, sin probar con dos dispositivos reales y con una migración remota por aplicar. Ver apartado 2.7 |
| 4b-3 · Recuperación y base local cifrada | Recuperación con el código (necesita una función en el servidor) y cifrado de la base local con SQLCipher | R-11 y R-20 a R-23 | Pendiente |
| 4c · Privacidad y cierre de seguridad | Política de privacidad, exportación y borrado visibles, aviso de actualización obligatoria y repetición de la auditoría con la red ya en uso | T-102 y T-103 de H9, y parte de H8 | Pendiente |
| 5 · Versión web | Exportación a web contra Supabase, alojamiento y pruebas en navegador | Sin tareas todavía: se definen al cerrar el bloque 4 | Pendiente (D8) |
| 6 · Publicación y suscripción | Calidad, beta, envío a revisión y suscripción | H8, H9 y T-120 a T-127 | Pendiente (D9) |

El total de 18 semanas del apartado 2 ya no es válido: el rediseño y la versión web no
estaban contados. NO RECALCULADO. Se recalculará al cerrar el bloque 1.

T-125 y T-127 hablan de una prueba gratuita de 6 meses. Por D9 pasa a ser de 1 mes.

### 2.2 Estado del bloque 1 a 17/11/2026 (rama `h3-vision-completa`)

| Tarea | Hecho | Sigue pendiente |
|---|---|---|
| T-070 | Entidad ValorDeInversion: migración 2 y repositorio con pruebas | Objetivo y AportacionAObjetivo (bloque 2) |
| T-075 | HECHA. Valor de inversión (P21) y rentabilidad simple (D11). Tres aportaciones y un valor dan aportado, valor, diferencia y porcentaje | — |
| T-076 | HECHA. Patrimonio y su evolución de doce meses (D5). No dependió de T-074 | — |
| T-077 | Aviso en pantalla si el último valor tiene más de 30 días | El recordatorio como notificación |
| T-081 | Gasto por categoría en Inicio y en la vista Año; Análisis como pestaña | — |
| T-082 | HECHA. Barras de seis y de doce meses (D6) y comparativa con el mes anterior en euros y porcentaje (D7) | Elegir dos meses cualesquiera: hoy se compara siempre con el anterior |
| T-083 | HECHA el 16/11/2026. Además, parte guardada del año | — |
| T-084 | Inicio con patrimonio, balance, Hoy, cuentas, inversiones y D2 | D1, D8, D9 y D4, que dependen de presupuesto, gastos fijos y objetivos |

Añadido fuera del backlog: vista por día con calendario (parte de G7).

### 2.3 Estado del bloque 2 a 17/11/2026 (rama `h5-planificacion`)

| Tarea | Hecho | Sigue pendiente |
|---|---|---|
| T-060 | HECHA. Presupuesto, LineaDePresupuesto y ReglaRecurrente: migración 3 y repositorios con pruebas | — |
| T-061 | HECHA. P12 propone la media de los tres meses anteriores y copia el mes anterior | — |
| T-062 | HECHA. P11 con previsto frente a real, estados con icono y texto y raya del día | — |
| T-063 | HECHA. Disponible del mes e importe por día (D1). El caso de comprobación da 368,00 € y 26,28 € | — |
| T-064 | HECHA. P13 y P14: lista por clase, total mensual, anuales aparte, alta y edición | «Saltar un cobro este mes» no existe: se desactiva la regla o se le pone fecha de fin |
| T-065 | HECHA. Calendario del mes y próximos 14 días (D9) | — |
| T-066 | **PARCIAL.** Confirmación en un toque, con cambio de importe y día, y «Ya lo anoté». El aviso es una tarjeta «Por confirmar» en Inicio y en Fijos | El aviso previo como notificación del sistema (bloque de entrada rápida). `aviso_dias_antes` se guarda pero no se usa |
| T-067 | **PARCIAL.** Tarjeta en Inicio que nombra las líneas que pasan del 80 % | La notificación del sistema |
| T-069 | HECHA. Previsión de fin de mes (D4) con línea de saldo real y previsto. El caso de comprobación da 2.890,00 € | — |
| T-070 | HECHA entera con este bloque: Objetivo y AportacionAObjetivo se suman a ValorDeInversion | — |
| T-071 | HECHA. P15 y P16 con avance y ritmo necesario. El caso de comprobación da 125,00 € al mes | — |
| T-072 | HECHA. La aportación mensual es una regla recurrente; confirmarla crea la transferencia y suma al objetivo | — |
| T-084 | Inicio muestra ya D1, D2, D4, D8 y D9, además del patrimonio | — |

### 2.4 Estado del bloque 3 a 17/11/2026 (rama `b3-entrada-rapida`)

| Tarea | Hecho | Sigue pendiente |
|---|---|---|
| T-010 a T-012 | Integradas: la acción «Registrar pago», la cola persistente y el aviso local forman parte de la app. Compila y el binario publica la acción | Verla en Atajos, ejecutarla con la app cerrada y ver el aviso en un iPhone: **NO DEMOSTRADO** |
| T-013 a T-017 | — | La medición del spike A sigue pendiente del usuario. La captura se ha construido sin esperarla |
| T-030 | HECHA. Entidad Captura (migración 4) y conversión en movimiento con origen `apple_pay` | — |
| T-031 | HECHA. Extracción de importe y divisa, con los textos del criterio | — |
| T-032 | HECHA. Tarjeta a cuenta según A.4 | — |
| T-033 | HECHA. Comercio a categoría, actualizada al guardar | — |
| T-034 | HECHA. Duplicados a menos de 10 minutos | El «enriquecimiento» de la primera con los datos de la segunda (A.5): hoy la segunda queda como duplicada, sin fusionar |
| T-035 | **PARCIAL.** El aviso muestra importe y comercio y, al tocarlo, abre la bandeja en esa captura | Los botones Guardar, Editar y Descartar en el propio aviso |
| T-036 | HECHA. Bandeja (P08) con sus tres acciones | — |
| T-037 | HECHA con matices. Guía (P04) con captura de prueba, última captura y tarjetas | No ramifica por versión de iOS: muestra los dos nombres del disparador |
| T-038 | HECHA con matices. Acción «Añadir gasto» | El movimiento se crea al abrir la app, no en el momento de ejecutar el atajo |
| T-039 | Ver `estado.md`, apartado 10 | — |
| T-040 | HECHA. Aviso local cuando la pendiente más antigua cumple 24 horas | — |
| T-066 | HECHA lo que faltaba: aviso local a las 9:00, con `aviso_dias_antes` | — |
| T-067 | HECHA lo que faltaba: aviso local al pasar del 80 % o excederse | — |
| T-077 | HECHA. Aviso local cuando el último valor cumple 30 días | — |

Todos los avisos son notificaciones locales. Que lleguen en un iPhone con la app cerrada
está **NO DEMOSTRADO**: solo se ha probado el cálculo y la programación contra un sistema
de notificaciones simulado.

### 2.5 Bloque 4 dividido en 4a, 4b y 4c (18/11/2026)

El bloque 4 se parte en tres para no mezclar la seguridad del dispositivo con la de la red.

| Bloque | Qué entrega | Estado |
|---|---|---|
| 4a · Seguridad local | `docs/seguridad/auditoria-4a.md` (20 hallazgos, ninguno crítico ni alto), bloqueo de la app con Face ID, Touch ID o código, modo privado para widget, avisos y selector de apps, validación única de parámetros de ruta, limpieza de los textos de Atajos y `docs/seguridad/modelo-de-amenazas.md` | **Hecho** en `b4a-seguridad-local`. No toca la red ni la base de datos. Lo no demostrado en un iPhone está en `estado.md`, apartado 13 |
| 4b · Cuentas y sincronización cifrada | Cuentas en Supabase, cifrado de extremo a extremo, código de recuperación, RLS probado con dos usuarios, SQLCipher con migración sin pérdida, exportación y borrado de cuenta | **Pendiente.** Debe cumplir los requisitos R-01 a R-30 y resolver las preguntas P-1 a P-10 del modelo de amenazas. Recibe de la auditoría A-01, A-02, A-12, A-17 y parte de A-20 |
| 4c · Privacidad y cierre de seguridad | Política y ficha de privacidad, forzar actualización, y segunda auditoría con la red en uso | **Pendiente.** Recibe A-19 y el resto de A-20 |

### 2.6 Estado del bloque 4b-1 a 22/11/2026 (rama `b4b1-cuenta-y-claves`)

El bloque 4b se partió primero en dos y después en tres. El 4b-1 y el 4b-2 están hechos
(apartado 2.7); el 4b-3 no ha empezado.

| | Qué | Estado |
|---|---|---|
| 4b-1 | Módulo criptográfico sobre libsodium (`src/cripto/`), diseño por escrito, esquema remoto con RLS y pruebas de aislamiento, y la cuenta en la app (Ajustes › Cuenta) | **Hecho.** Compila para el simulador. La cuenta se ha probado contra una instancia local de Supabase |
| 4b-1, pendiente del dueño | Aplicar las migraciones al proyecto remoto, crear `.env`, desactivar la confirmación de correo y fijar Argon2id con sus medidas | `docs/seguridad/pasos-del-propietario-4b1.md` |
| 4b-2 | Sincronización fila a fila, cambio de contraseña y exportación | **Hecho** (apartado 2.7) |
| 4b-3 | Recuperación con el código y cifrado de la base local con SQLCipher | **Pendiente** |
| 4c | Privacidad, forzar actualización, segunda auditoría y revisión del riesgo de `react-native-libsodium` | **Pendiente** |

Al cerrar el 4b-1 la cuenta no sincronizaba nada. Desde el 4b-2 sí (apartado 2.7).

### 2.7 Estado del bloque 4b-2 a 22/11/2026 (rama `b4b2-sincronizacion`)

| Qué | Estado |
|---|---|
| Motor de sincronización (`src/sincronizacion/`): cifrado de cada fila con usuario, tabla e id autenticados, subida por lotes, bajada por cursor con solape, repaso completo, filas retenidas | **Hecho**, probado contra una instancia local de Supabase |
| Migración local 5: cola de pendientes, marcas remotas, filas retenidas y estado | **Hecho.** Solo añade tablas y disparadores |
| Cuándo se sincroniza, estado en Cuenta y «Sincronizar ahora» | **Hecho** |
| Entrada en una cuenta: subir, bajar o preguntar; nunca fusionar | **Hecho** |
| Cambio de contraseña sin ventana de cuenta inaccesible, y actualización de parámetros de derivación | **Hecho**, probado cortando en cada paso |
| Exportación a JSON y CSV (Ajustes › Exportar mis datos) | **Hecho** |
| Migración remota que retira EXECUTE de `rls_auto_enable()` | **Escrita y probada en local. La aplica el dueño** |
| Prueba con dos dispositivos reales | **Pendiente del dueño**: `docs/seguridad/pasos-del-propietario-4b2.md` |
| Recuperación con el código, cifrado de la base local | 4b-3 |
| Qué puede hacer un servidor malicioso y no se detecta | Documentado para el 4c: `docs/seguridad/diseno-sincronizacion.md`, apartado 10 |

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

> **Adelantado el 16/11/2026** en la rama `h2b-rediseno-inicio` (decisión D6 de `09`):
> - **T-080**: HECHA. `react-native-svg` 15.16.0 (MIT), anillo y barras en claro y oscuro.
> - **T-081**: hecha la parte de Inicio (gasto por categoría y salto a Movimientos
>   filtrado). **Sigue en H7** la pantalla de Análisis (P17).
> - **T-082**: hechas solo las barras de seis meses en Inicio. **Sigue en H7** la
>   tendencia en P17 y la comparativa de dos meses (D7).
> - **T-083**: HECHA. 2 000 € y 1 600 € muestran 20 %.
> - **T-084**: hecho el bloque D2 y el armazón de Inicio. **Siguen en H7** D1, D8, D9 y
>   D4, que dependen de presupuesto, gastos fijos y objetivos.

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
