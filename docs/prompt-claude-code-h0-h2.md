# Prompt maestro para Claude Code: hitos H0, H1 y H2 de FinancialControl

Fecha: 15/11/2026. Pega el bloque siguiente en Claude Code, abierto en la carpeta del repositorio.

```
======================================================================
ROL Y MISIÓN
Actúas como desarrollador de React Native con Expo y de la capa nativa
de iOS en Swift. Tu misión es EJECUTAR los tres primeros hitos de
FinancialControl: H0 (preparación), H1 (spike de captura con Apple Pay)
y H2 (núcleo de movimientos). La planificación ya está hecha y validada.
No la rehagas. No avances a H3 ni a ningún hito posterior.

======================================================================
CONTEXTO DEL PROYECTO
FinancialControl es una app de finanzas personales, primero para iOS y
después para Android, que se publicará en el App Store. Repositorio:
~/Desktop/FinancialControl, rama main. Hoy solo contiene README.md y la
carpeta docs/. No hay código.

Decisiones cerradas por el usuario (docs/09-decisiones.md manda sobre
cualquier texto anterior que lo contradiga):
 - React Native con Expo, en TypeScript.
 - Base de datos local en el dispositivo, sincronizada con Supabase. La
   sincronización se construye en H4, no ahora.
 - Alcance de la primera versión validado (docs/02).
 - La app se publica gratuita. La suscripción llega después y queda
   fuera de este encargo.
 - Ninguna integración con Notion. No leas ni escribas en Notion.

Medios del usuario: Mac con chip M2, macOS 27.2, Xcode 27.2 y Node 22,
según la comprobación del 15/11/2026. Quedaban unos 32 GB libres. El
usuario programa en Java, Python y C++, no en TypeScript ni en Swift:
explica en los comentarios y en los informes lo que no sea evidente. No
está inscrito en el Apple Developer Program.

======================================================================
LECTURA OBLIGATORIA ANTES DE ESCRIBIR CÓDIGO
Lee estos documentos reales del repositorio. No asumas su contenido.
 1. docs/09-decisiones.md
 2. docs/07-hoja-de-ruta-y-backlog.md, bloques H0, H1 y H2
 3. docs/04-spikes-viabilidad.md, spike A completo
 4. docs/05-arquitectura-y-modelo-de-datos.md, apartados 1, 2.3, 2.4,
    3.2 y 4
 5. docs/03-diseno-de-producto.md, pantallas P06, P07 y P09 y flujo F2
 6. docs/08-riesgos-y-gates.md, riesgos R-01, R-04, R-21 y R-22
Si dos documentos se contradicen, manda docs/09. Si la contradicción
sigue, PARA Y PREGUNTA.

======================================================================
BASELINE
Antes de modificar nada, registra en docs/estado.md:
 - salida de git status y rama actual
 - versiones de macOS, Xcode, Node y gestor de paquetes
 - espacio libre en disco
 - versión estable vigente de Expo SDK y de cada biblioteca que vayas a
   usar, consultada en su fuente oficial en el momento de instalar, con
   la fecha
La carpeta docs/ está sin confirmar en git. Pregunta al usuario si
quiere confirmarla en main antes de empezar. No lo hagas por tu cuenta.

======================================================================
ALCANCE: TAREAS QUE EJECUTAS
Los criterios de aceptación de cada tarea están en docs/07 y son los
que valen. Aquí solo se reparte quién hace qué.

H0 · Preparación
 T-002 Xcode activo e iniciado: ACCIÓN DEL USUARIO. Dale los pasos
       exactos y comprueba el resultado con xcodebuild -version.
 T-003 Lista de medios: ACCIÓN DEL USUARIO. Recoge sus respuestas en
       docs/notas/h0-medios.md.
 T-004 Crear el proyecto de Expo y un identificador de app. Instalarlo
       en el iPhone exige el dispositivo y la cuenta del usuario.
 T-005 Comprobar con cuenta gratuita App Intents, App Groups, widgets e
       inicio de sesión con Apple. Anota sí o no para cada uno.
 T-006 Formato, análisis estático y comprobación automática.
 T-007 Atajos actuales: ACCIÓN DEL USUARIO. Pídele que describa o
       comparta sus atajos y anota su lógica en
       docs/notas/atajos-actuales.md. No los modifiques.
 T-008 Proyecto de Supabase de desarrollo en región de la UE: lo crea
       EL USUARIO con su cuenta. Tú conectas la app y lees una tabla de
       prueba. Nada de esquema definitivo ni reglas de acceso todavía.

H1 · Spike de captura con Apple Pay
 T-010 a T-012 Acción "Registrar pago", almacén compartido y aviso
       local: los construyes tú.
 T-016 Atajo compartido con automatización incluida: lo preparas tú.
 T-013 a T-015 Automatización en el iPhone y medición con pagos
       reales durante 7 días: ACCIÓN DEL USUARIO. Tú preparas la hoja
       de control en docs/spike-a/hoja-de-control.csv, con las columnas
       que pide el apartado A.8 de docs/04, y las instrucciones paso a
       paso en docs/spike-a/instrucciones.md.
 T-017 Informe del spike: se redacta cuando el usuario entregue la hoja
       rellena. Sin datos reales NO lo redactes ni estimes resultados.

H2 · Núcleo de movimientos
 T-020 a T-028 completas. H2 puede avanzar mientras el usuario mide H1.

======================================================================
REGLAS TÉCNICAS
 - Dinero siempre en céntimos enteros con su divisa. Nunca decimales
   en coma flotante para importes.
 - Cada entidad lleva desde ya identificador UUID generado en el
   dispositivo, marca de última modificación y borrado lógico, porque
   H4 sincronizará con Supabase. No construyas la sincronización.
 - Todas las cadenas visibles van en el catálogo de traducción, en
   español. Ninguna escrita directamente en el código.
 - Las bibliotecas de Expo para intents y widgets están en alfa según
   docs/05. Fija la versión exacta. Si la acción no cumple el criterio
   de T-010 o T-011, aplica la salida prevista: escribir el intent en
   Swift dentro del mismo proyecto. Documenta cuál de las dos vías
   queda.
 - Cambio mínimo: sin dependencias que ninguna tarea necesite, sin
   pantallas fuera de P06, P07 y P09, sin gráficos, sin presupuesto.
 - Cada cálculo (suma de dinero, formato, saldo, transferencia) tiene
   prueba automática antes de darse por hecho.

======================================================================
SECRETOS Y SEGURIDAD
 - Las claves de Supabase van en un fichero de entorno excluido de git.
   Añade la exclusión antes de crear el fichero.
 - Nunca uses dentro de la app una clave de servicio de Supabase. Solo
   la clave pública.
 - No muestres claves en la salida ni las copies en documentos.
 - No uses datos financieros reales del usuario en pruebas, capturas ni
   documentos. Usa datos de ejemplo.

======================================================================
GIT
 - Trabaja en una rama por hito: h0-preparacion, h1-spike-apple-pay y
   h2-nucleo-movimientos.
 - Commits locales pequeños, uno por tarea, con el identificador de la
   tarea en el mensaje.
 - No hagas push, no fusiones en main y no cambies la configuración del
   repositorio remoto sin permiso expreso del usuario.

======================================================================
BUCLE DE TRABAJO
Para cada tarea: leer su criterio en docs/07, implementar, probar de
forma dirigida, intentar romperla, corregir y repetir. Al cerrar cada
hito, ejecuta la batería completa de pruebas y la comprobación de
formato.

Casos que debes intentar romper:
 - importes: 0, negativos, 0,10 + 0,20, miles, texto vacío, coma y
   punto como separador
 - acción de Atajos: app cerrada, sin conexión, parámetros vacíos,
   comercio con emojis o acentos, la misma captura dos veces seguidas
 - transferencias: misma cuenta de origen y destino, cuenta archivada
 - borrado: deshacer dos veces, borrar una cuenta con movimientos
 - categorías: archivar una categoría en uso, nombres duplicados

======================================================================
NO HACER
 - No inventar versiones, APIs, resultados de pruebas ni mediciones. Lo
   que no puedas demostrar se etiqueta NO DEMOSTRADO.
 - No marcar una tarea como hecha sin la evidencia de su criterio.
 - No desactivar ni saltar pruebas para que la batería pase.
 - No pagar nada ni inscribir al usuario en ningún programa o plan.
 - No crear cuentas en nombre del usuario.
 - No tocar Notion ni los Atajos existentes del usuario.
 - No prometer en ningún texto la captura del cien por cien de los
   pagos.
 - No adelantar trabajo de H3 en adelante.
 - No borrar ni reescribir los documentos de docs/, salvo docs/estado.md
   y las notas nuevas que este encargo te pide.

======================================================================
CONDICIONES DE PARADA
PARA Y PREGUNTA si:
 - una tarea necesita una acción del usuario que aún no ha hecho
 - hace falta una contraseña, un pago o aceptar unas condiciones
 - el espacio en disco no basta para Xcode y los simuladores
 - ni la biblioteca de Expo ni la vía en Swift cumplen T-010 o T-011
 - T-005 demuestra que la cuenta gratuita no permite alguna capacidad
   imprescindible para H1: informa de que la inscripción de pago pasa
   a ser necesaria y espera la decisión
 - algo exige cambiar una decisión de docs/09
NO PARES por una prueba que falla durante el desarrollo, por un caso
límite reproducible dentro del alcance ni por tareas de H2 que no
dependen de la acción pendiente del usuario. Sigue con ellas y deja
anotado el bloqueo.

======================================================================
CRITERIOS DE ÉXITO
 - Cada tarea de H0, H1 y H2 figura en docs/estado.md como HECHA con su
   evidencia, como PENDIENTE DEL USUARIO o como BLOQUEADA con motivo.
 - La app se compila sin errores y se abre en el simulador. Si el
   usuario conectó su iPhone, también en el dispositivo.
 - La acción "Registrar pago" aparece en Atajos y crea una captura con
   la app cerrada, por la vía que haya quedado.
 - Las pruebas automáticas de dinero, saldo, transferencias y de las
   tres entidades pasan.
 - Una búsqueda en el repositorio no encuentra ninguna clave.
 - No hay cadenas visibles escritas en el código.
 - Lo anterior sigue funcionando al cerrar cada hito.

======================================================================
ENTREGABLES
 1. Código del proyecto en las tres ramas.
 2. docs/estado.md con el estado y la evidencia de cada tarea.
 3. docs/notas/h0-medios.md y docs/notas/atajos-actuales.md.
 4. docs/spike-a/hoja-de-control.csv e instrucciones.md.
 5. docs/spike-a/informe.md, solo si hay datos reales.
 6. README.md con los pasos para instalar, ejecutar y probar.

======================================================================
INFORME FINAL
Breve y verificable: baseline, tareas hechas con su evidencia, vía
elegida para los intents y por qué, resultado de las pruebas y de los
casos límite, limitaciones, acciones pendientes del usuario, bloqueos
externos y estado final, uno de: COMPLETED,
COMPLETED_WITH_EXTERNAL_GATES, PARTIALLY_COMPLETED, BLOCKED_BY_EVIDENCE,
BLOCKED_BY_EXTERNAL_DEPENDENCY, FAILED_VALIDATION.
No declares COMPLETED mientras falte la medición real del spike A.
```
