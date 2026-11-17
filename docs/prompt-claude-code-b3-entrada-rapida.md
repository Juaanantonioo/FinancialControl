# Prompt para Claude Code · Bloque 3: Entrada rápida

Pega todo lo que sigue en Claude Code, abierto en `~/Desktop/FinancialControl`.

```
======================================================================
1. CONTEXTO
======================================================================
FinancialControl es una app de finanzas personales para iPhone hecha con
Expo SDK 58, React Native 0.88, TypeScript y Expo Router. El registro es
manual y los datos viven en SQLite dentro del dispositivo.

Estado de partida, comprobado el 17/11/2026:

- Rama actual: h5-planificacion. Último commit: d86fa9b.
- 502 pruebas en 21 suites, en verde con `npm run check`.
- Esquema de la base de datos en la versión 3.
- Pestañas: Inicio, Movimientos, Análisis, Plan y Cuentas.
- El dueño la ha probado en su iPhone real y la da por buena.

Lo que falta: cada gasto se anota a mano y los avisos solo se ven al
abrir la app. Este bloque acerca la app al momento del pago.

Hay tres hechos del entorno que condicionan todo el bloque:

a) Cuenta de Apple gratuita (Personal Team, identificador 8Z856TA59Z).
   No admite notificaciones remotas (push). Sí admite notificaciones
   locales y App Groups. Las apps instaladas caducan a los 7 días.
b) La carpeta ios/ está en .gitignore y lleva tres ajustes hechos a
   mano en Xcode: equipo de firma, ENABLE_USER_SCRIPT_SANDBOXING = NO en
   todos los targets y ningún permiso de push en los entitlements. Un
   `expo prebuild --clean` los borra. Este bloque es el primero que
   necesita regenerar ios/.
c) Existe un spike sin integrar en la rama h1-spike-apple-pay: la acción
   de Atajos «Registrar pago» en Swift (carpeta app-intents/), con
   expo-app-intents 0.5.17, una cola persistente y un aviso local
   lanzado desde Swift. Compiló para el simulador. Nunca se midió en un
   iPhone. Su descripción está en docs/estado.md, apartado 3.

======================================================================
2. OBJETIVO
======================================================================
Al terminar:

1. El proyecto se puede regenerar con `expo prebuild --clean` y compila
   sin retocar nada a mano en Xcode.
2. Un pago con Apple Pay, a través de una automatización de Atajos,
   deja una captura en la app con importe y comercio. La persona la
   guarda como movimiento con un toque o la corrige.
3. La app avisa con notificaciones locales de los cobros próximos, del
   presupuesto a punto de agotarse, de las capturas sin revisar y de los
   valores de inversión antiguos.
4. Hay un widget de pantalla de inicio con el disponible del mes y
   acceso directo al alta de un gasto.
5. Quedan corregidos cuatro defectos del bloque anterior.

Tareas del backlog (docs/07): T-030, T-031, T-032, T-033, T-034, T-036,
T-037, T-038, T-039, T-040, T-077, lo pendiente de T-066 y T-067, y la
integración de T-010 a T-012. T-035 entra con alcance reducido (ver
D-e).

======================================================================
3. DECISIONES YA TOMADAS (no las reabras)
======================================================================
D-a. Rama nueva `b3-entrada-rapida`, creada desde `h5-planificacion`.
D-b. La captura se construye sin esperar a la medición del spike A. La
     medirá el dueño con uso real. El alta manual sigue siendo el camino
     seguro y nada depende de que la automatización funcione.
D-c. Dependencias permitidas, solo estas: expo-app-intents (la versión
     que ya compiló en h1-spike-apple-pay, salvo que `npx expo install
     --check` exija otra para SDK 58), expo-widgets y lo que este exija
     de forma directa (por ejemplo @expo/ui). expo-notifications ya está
     en package.json. Cualquier otra dependencia: PARA y pregunta.
D-d. Solo notificaciones locales. No se añade el plugin de configuración
     de expo-notifications, porque mete el permiso de push que la cuenta
     gratuita no puede firmar. Tras cada prebuild, los entitlements de
     la app no deben contener `aps-environment`.
D-e. El aviso de una captura no lleva botones Guardar, Editar y
     Descartar que actúen con la app cerrada. Al tocarlo se abre la app
     en esa captura. T-035 queda parcial.
D-f. El widget es la última fase y es separable. Si no compila para el
     simulador, o exige algo que la cuenta gratuita no firma, se revierte
     esa fase entera, se deja la evidencia y el resto del bloque sigue
     siendo válido.
D-g. No instales nada en el iPhone físico ni toques la firma desde
     Xcode. La compilación para dispositivo la hace el dueño.
D-h. Sin versión web, sin Android, sin sincronización, sin cuentas de
     usuario. No instales react-native-web.
D-i. No subas nada a GitHub ni toques main.

======================================================================
4. LECTURA OBLIGATORIA ANTES DE DISEÑAR
======================================================================
Lee los archivos reales, no supongas su contenido.

- AGENTS.md
- docs/estado.md: apartados 3 (spike) y 9 (bloque anterior)
- docs/04-spikes-viabilidad.md: spike A entero, sobre todo A.3 (diseño
  de la acción), A.4 (tarjeta a cuenta), A.5 (casos límite) y A.7 (guía)
- docs/03-diseno-de-producto.md: flujo F3 y pantallas P04, P07 y P08
- docs/05-arquitectura-y-modelo-de-datos.md: apartados 2.3 y 4
- docs/07-hoja-de-ruta-y-backlog.md: tareas T-030 a T-040
- La rama h1-spike-apple-pay: `git diff h0-preparacion h1-spike-apple-pay`
- app.json, .gitignore y, antes de regenerar nada,
  ios/FinancialControl.xcodeproj/project.pbxproj y los entitlements
- src/dominio/recurrentes.ts, presupuesto y objetivos, src/datos/
  migraciones.ts, src/estado/plan.ts, src/app/(tabs)/index.tsx y plan.tsx
- La documentación de la versión 58 de expo-widgets, expo-app-intents y
  expo-notifications en docs.expo.dev. Son bibliotecas en movimiento:
  no programes de memoria, comprueba la API real de la versión instalada.

Si un documento contradice este prompt en una regla de cálculo o de
datos, PARA y pregunta. Si es de presentación, sigue este prompt y
anótalo.

======================================================================
5. BASELINE
======================================================================
Antes de cambiar nada, registra en docs/estado.md, apartado 10 nuevo:

- rama, commit, resultado de `npm run check` y versión del esquema
- `git status`
- copia de seguridad de la configuración nativa actual en
  docs/notas/ios-antes-de-b3/: project.pbxproj, los .entitlements y el
  Info.plist de la app. Solo esos archivos, no Pods ni build.
- lista de los ajustes manuales que encuentres en ellos

PARA si la rama no es h5-planificacion, si `npm run check` falla antes
de empezar o si hay cambios sin confirmar fuera de docs/.

======================================================================
6. FASES
======================================================================
Un commit por fase, con el prefijo «B3:». Las fases 1 a 3 son solo
JavaScript y deben quedar verdes antes de tocar nada nativo.

Fase 0. Baseline y lectura.

Fase 1. Cuatro correcciones del bloque anterior
  1.1 En Inicio y en la pantalla de patrimonio, la cifra de banco más
      efectivo deja de llamarse «Disponible» y pasa a «En cuentas».
      «Disponible este mes» se queda como está.
  1.2 «Aportar» a un objetivo ofrece dos caminos: «Mover dinero» (crea
      una transferencia entre dos cuentas con objetivoId y su aportación
      enlazada, con la cuenta del objetivo como destino por defecto) y
      «Solo anotar» (lo que hay hoy).
  1.3 Borrar un objetivo borra también sus reglas de aportación mensual.
      Deshacer recupera el objetivo y las reglas.
  1.4 El calendario de fijos no redondea importes. Muestra el importe
      exacto si cabe y, si no cabe, solo la marca del día. 9,99 € nunca
      aparece como 10.

Fase 2. Dominio y datos de la captura (migración 4)
  Tablas nuevas con los campos comunes y el estilo de las existentes:

  captura
    recibida_en, origen ('transaccion', 'notificacion', 'manual',
    'prueba'), importe_texto, comercio_texto, tarjeta_texto (lo que
    llegó, sin tocar), importe y divisa (lo extraído, opcional),
    cuenta_id y categoria_id propuestas (opcionales), estado
    ('pendiente', 'guardada', 'descartada', 'duplicada'), movimiento_id
    (opcional), id_de_cola (único entre las no borradas, para no
    importar dos veces la misma entrada de la cola nativa).
  alias_de_tarjeta
    texto normalizado (único) y cuenta_id.
  regla_de_comercio
    comercio normalizado (único) y categoria_id.
  aviso_emitido
    clave (única) y emitido_en. Sirve para no repetir un aviso.

  Reglas, como funciones puras en src/dominio/ con pruebas:
  - Extracción de importe y divisa (T-031). Debe acertar con "23,40 €",
    "€23.40", "23.40", "1.234,56 €", "1,234.56", "EUR 5" y devolver
    «sin importe» con texto vacío o sin números. Nunca inventa un
    importe: ante la duda entre dos lecturas, sin importe.
  - Tarjeta a cuenta (T-032): la regla de docs/04, apartado A.4, tal
    cual.
  - Comercio a categoría (T-033): al guardar una captura con categoría,
    se recuerda para ese comercio. La siguiente del mismo comercio la
    propone. El último guardado manda.
  - Duplicados (T-034): dos capturas con el mismo importe y la misma
    cuenta separadas menos de 10 minutos dejan una sola pendiente. La
    otra queda como 'duplicada', visible y recuperable.
  - Guardar una captura (T-030) crea un movimiento de gasto con origen
    'apple_pay' (o 'notificacion' según su origen), capturaId enlazado
    y el estado 'guardada'. Solo se puede guardar con un toque si tiene
    importe, cuenta y categoría. Si falta algo, se abre el alta (P07)
    con lo que haya ya puesto.
  - Descartar no borra: cambia el estado. Se puede deshacer.
  - Borrar el movimiento de una captura guardada la devuelve a
    pendiente.

Fase 3. Bandeja y guía, todavía sin parte nativa
  - Bandeja de capturas (P08): pendientes con Guardar, Editar y
    Descartar, y un apartado plegado con duplicadas y descartadas.
    Acceso desde Movimientos, con el número de pendientes, y tarjeta en
    Inicio solo cuando haya alguna.
  - Guía de Apple Pay (P04): pasos para crear la automatización en
    Atajos, botón «Enviar una captura de prueba» (crea una captura de
    origen 'prueba' por el mismo camino que una real), fecha de la
    última captura recibida y gestión de los alias de tarjeta.
    La guía cubre los dos nombres del disparador: «Transacción» en iOS
    17 a 25 y «Wallet» desde iOS 26. Incluye el consejo de comprobar
    que la app Wallet tiene activados los datos móviles en Ajustes, que
    es la causa de fallo más citada. Marca en docs/estado.md estos dos
    datos como tomados de documentación de terceros, sin comprobar en
    el iPhone.

Fase 4. Base nativa reproducible
  - Fija los ajustes manuales en la configuración del proyecto: el
    equipo en app.json (`ios.appleTeamId`) y un plugin de configuración
    local, dentro del repositorio y sin dependencias, que ponga
    ENABLE_USER_SCRIPT_SANDBOXING = NO en todos los targets. Si la
    documentación de Expo 58 ofrece una vía oficial mejor, úsala y
    explícalo.
  - Ejecuta `npx expo prebuild --clean` y `pod install`, y comprueba en
    el proyecto generado: equipo puesto, sandboxing en NO en todos los
    targets, sin `aps-environment`, mismo identificador de paquete.
  - Compila para el simulador. Debe terminar sin errores.
  - Añade a README.md cómo regenerar y compilar desde cero.

Fase 5. Acción de Atajos integrada
  - Trae de h1-spike-apple-pay la carpeta app-intents/, la dependencia y
    la configuración. Adapta el código: la pantalla «Capturas del spike»
    desaparece y la cola nativa se vuelca en la tabla captura al abrir
    la app y al volver a primer plano, usando id_de_cola para no
    duplicar.
  - La acción sigue sin fallar nunca hacia fuera y sin abrir la app.
  - El aviso que lanza la acción muestra importe y comercio. Tocarlo
    abre la app en esa captura.
  - Acción «Añadir gasto» (T-038): importe, categoría y cuenta. Con
    importe y categoría válidos crea el movimiento. Si falta algo, deja
    una captura pendiente en lugar de fallar.
  - Comprueba tras compilar que el fichero Metadata.appintents de la
    app contiene las dos acciones con sus parámetros.

Fase 6. Notificaciones locales
  - Pantalla «Avisos», enlazada desde donde hoy se llega a Categorías,
    con un interruptor por tipo. El permiso del sistema se pide al
    activar el primero, nunca al arrancar la app. Si está denegado, la
    pantalla lo explica y enlaza con Ajustes.
  - Cobros próximos: para cada regla activa con aviso_dias_antes, un
    aviso a las 9:00 del día que toque, solo si la ocurrencia sigue
    pendiente.
  - Presupuesto: cuando una línea pasa del 80 % o se excede, un único
    aviso por categoría, mes y nivel, registrado en aviso_emitido.
  - Capturas sin revisar (T-040): un aviso cuando la pendiente más
    antigua cumple 24 horas. Sin pendientes no hay aviso.
  - Valor de inversión (T-077): un aviso cuando el último valor de una
    cuenta de inversión cumple 30 días.
  - Los avisos programados se recalculan al abrir la app y cuando
    cambian los datos de los que dependen: se cancelan los propios y se
    vuelven a programar. Nunca más de 40 pendientes a la vez (iOS
    limita a 64); tienen prioridad los más cercanos.
  - El cálculo de qué avisos tocan y cuándo es una función pura en
    src/dominio/, con «ahora» como parámetro y con pruebas. La capa que
    habla con expo-notifications es fina y se sustituye en las pruebas.
  - Tocar un aviso abre la pantalla que le corresponde.

Fase 7. Widget (separable, ver D-f)
  - Con expo-widgets. Tamaños pequeño y mediano.
  - Contenido: «Disponible este mes», la cifra, el importe por día y la
    fecha del dato. Sin presupuesto: «Crea tu presupuesto».
  - Tocar el pequeño abre el alta de un gasto. El mediano añade un botón
    «Añadir gasto» y, al tocar el resto, abre Inicio.
  - La app envía el dato al widget cada vez que cambia el disponible. El
    widget nunca calcula por su cuenta ni lee la base de datos.
  - Claro y oscuro, con la paleta de la app.
  - Tras el prebuild, comprueba que el target del widget lleva el mismo
    equipo y el sandboxing en NO, y que el App Group aparece en los
    entitlements de la app y del widget.

Fase 8. Casos límite, capturas y regresión.
Fase 9. Documentación e informe.

======================================================================
7. CASOS LÍMITE QUE DEBES PROBAR
======================================================================
Captura:
- Importe vacío, con solo símbolo, con dos números, con separador de
  miles y con divisa distinta del euro.
- Comercio vacío, con emojis, con acentos y de 300 caracteres.
- Tarjeta desconocida con una sola cuenta de banco y con dos.
- Alias cuya cuenta se archiva después.
- La misma entrada de la cola leída dos veces.
- Dos capturas iguales a 9 y a 11 minutos.
- Captura y movimiento manual del mismo pago: no se fusionan solos.
- Guardar, borrar el movimiento y deshacer el borrado.
- 150 capturas pendientes: la bandeja sigue respondiendo.
- Categoría recordada de un comercio que luego se archiva.

Avisos:
- Permiso denegado, y concedido después desde Ajustes.
- Regla del día 31 en un mes de 30, con aviso tres días antes.
- Aviso cuyo día ya ha pasado al programar: no se programa.
- Cobro confirmado antes de la hora del aviso: el aviso se cancela.
- Línea que pasa del 80 % dos veces en el mes: un solo aviso.
- Cambio de hora de verano e invierno entre la programación y el aviso.
- Más de 40 avisos candidatos.

Nativo:
- `expo prebuild --clean` dos veces seguidas da el mismo resultado.
- Base de datos en versión 3 con datos reales: pasa a la 4 sin perder
  nada.

Correcciones:
- Objetivo con dos reglas de aportación, borrado y deshecho.
- «Mover dinero» con la misma cuenta de origen y destino: se rechaza.
- Calendario con 9,99 €, 620,00 € y 1.234.567,89 €, también con el
  texto del sistema al máximo.

======================================================================
8. LO QUE NO PUEDE CAMBIAR
======================================================================
- Las 502 pruebas de partida siguen pasando. Solo pueden tocarse las
  que den por hecho que la versión 3 es la última del esquema o que
  comprueben los cuatro comportamientos corregidos en la fase 1. Lista
  cada una y su motivo.
- Saldos, patrimonio, inversión, Análisis, presupuesto, disponible,
  previsión y objetivos dan las mismas cifras con los mismos datos.
- Las migraciones 1, 2 y 3, intactas.
- El identificador de paquete es.juanantonio.financialcontrol. Si
  cambiara, el iPhone instalaría una app distinta y el dueño perdería
  sus datos.
- El alta manual de movimientos funciona igual con o sin capturas.
- La app arranca y es usable con todos los avisos desactivados y sin
  ninguna automatización configurada.

======================================================================
9. VERIFICACIÓN
======================================================================
- `npm run check` al cerrar cada fase.
- Compilación para el simulador al cerrar las fases 4, 5, 6 y 7.
- Capturas de pantalla en docs/capturas/b3/, en claro y en oscuro, con
  el método de bloques anteriores: bandeja vacía y con capturas, guía de
  Apple Pay, pantalla Avisos, alta abierta desde una captura, «Aportar»
  con sus dos caminos, calendario corregido e Inicio con el rótulo
  nuevo. Del widget, si el simulador permite verlo.
- Mira cada captura antes de darla por buena.

Lo que no puedas ver en el simulador (la acción ejecutada desde Atajos,
un aviso con la app cerrada, el widget en la pantalla de inicio) se
marca NO DEMOSTRADO. No lo des por bueno por deducción. Deja en
docs/estado.md una lista de comprobación para el iPhone, paso a paso,
con el resultado esperado de cada paso.

El Mac del dueño va lento con el simulador. Si una compilación tarda,
espera. No la sustituyas por una suposición.

======================================================================
10. CRITERIOS DE ÉXITO
======================================================================
[ ] `npm run check` pasa entero.
[ ] Las 502 pruebas de partida siguen en verde, con las excepciones
    listadas, y hay pruebas nuevas para cada regla de la fase 2, el
    cálculo de avisos y los casos del apartado 7 que no son nativos.
[ ] `expo prebuild --clean` seguido de la compilación para simulador
    termina sin errores y sin ningún paso manual en Xcode.
[ ] El proyecto generado lleva el equipo 8Z856TA59Z, el sandboxing en NO
    en todos los targets y ningún `aps-environment`.
[ ] El fichero Metadata.appintents contiene «Registrar pago» y «Añadir
    gasto».
[ ] «Enviar una captura de prueba» deja una captura en la bandeja, y
    guardarla crea un movimiento enlazado.
[ ] Las pruebas de extracción pasan con los textos de la fase 2.
[ ] Una base en versión 3 con datos pasa a la 4 sin perder ninguno.
[ ] Las cuatro correcciones de la fase 1 tienen prueba.
[ ] El identificador de paquete no ha cambiado.
[ ] Widget: compila y su target está bien firmado, o la fase está
    revertida con la evidencia del motivo.

======================================================================
11. NO HACER
======================================================================
- No inventes datos, capturas, mediciones ni resultados.
- No declares que algo funciona en el iPhone. No lo has visto.
- No añadas el plugin de expo-notifications ni ningún permiso de push.
- No edites ios/ a mano para que compile: lo que haga falta va en la
  configuración o en el plugin local, para que sobreviva al prebuild.
- No cambies el identificador de paquete, el esquema de URL ni el
  nombre de la app.
- No desactives ni debilites pruebas.
- No hagas que la acción de Atajos abra la app o pregunte algo.
- No guardes totales calculados en la base de datos.
- No pongas textos visibles fuera de es.json, salvo los que iOS exige
  literales en Swift.
- No leas el reloj dentro de src/dominio/.
- No refactorices lo que no haga falta.
- No subas nada a GitHub.

======================================================================
12. CUÁNDO PARAR Y CUÁNDO NO
======================================================================
PARA Y PREGUNTA si:
- el baseline no coincide con el apartado 1
- hace falta una dependencia fuera de D-c
- el prebuild o la compilación exigen una capacidad de pago o cambiar
  el identificador de paquete
- tras tres intentos razonados, las fases 4 o 5 no compilan. Deja el
  diagnóstico: hecho observado, hipótesis y lo que has descartado
- la migración 4 no puede aplicarse sin alterar datos

NO pares por:
- una prueba que falla mientras desarrollas
- un error de compilación con causa identificable dentro del alcance
- que el widget no salga: aplica D-f y sigue
- no poder ver algo en el simulador: márcalo NO DEMOSTRADO y sigue

======================================================================
13. DOCUMENTACIÓN
======================================================================
Describe el estado real.

- docs/estado.md, apartado 10: baseline, hecho por fase, decisiones
  tomadas sin consultar, casos límite, capturas, limitaciones, lo NO
  DEMOSTRADO y la lista de comprobación para el iPhone. Actualiza el
  apartado 3 para decir qué partes del spike quedan integradas.
- docs/07: estado de cada tarea tocada y el bloque 3 de la tabla 2.1.
- docs/05: tablas nuevas y reglas de la captura.
- docs/04: solo si la integración se aparta de A.3 o A.4, y por qué.
- README.md: regenerar, compilar e instalar en el iPhone con
  `npx expo run:ios --device --configuration Release`, y el aviso de que
  con la cuenta gratuita la app instalada caduca a los 7 días y hay que
  volver a instalarla. Los datos se conservan al reinstalar encima.

======================================================================
14. INFORME FINAL
======================================================================
Breve y verificable:

- Baseline
- Hecho por fase, con su commit
- Archivos creados y modificados, y dependencias añadidas con versión
- Pruebas: cuántas había, cuántas hay y cuáles antiguas se tocaron
- Resultado de prebuild y compilación, con el comando usado
- Casos límite y su resultado
- Regresión
- Capturas hechas y cuáles faltan
- Decisiones tomadas por tu cuenta
- Limitaciones y lo NO DEMOSTRADO
- Lista de comprobación para el iPhone
- Estado final, uno de: COMPLETED, COMPLETED_WITH_EXTERNAL_GATES,
  PARTIALLY_COMPLETED, BLOCKED_BY_EVIDENCE,
  BLOCKED_BY_EXTERNAL_DEPENDENCY, FAILED_VALIDATION

No declares COMPLETED si queda algún criterio del apartado 10 sin
cumplir. Con el widget revertido por D-f, el estado máximo es
PARTIALLY_COMPLETED.
```
