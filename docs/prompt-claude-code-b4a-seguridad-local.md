# Prompt para Claude Code · Bloque 4a: Auditoría de seguridad y protección local

Pega todo lo que sigue en Claude Code, abierto en `~/Desktop/FinancialControl`.

```
======================================================================
1. CONTEXTO
======================================================================
FinancialControl es una app de finanzas personales para iPhone hecha con
Expo SDK 58, React Native 0.88, TypeScript y Expo Router. Los datos
viven en SQLite dentro del dispositivo (expo-sqlite). Se va a publicar
para terceros, con Android y web después.

Estado de partida, comprobado el 18/11/2026:

- Rama actual: b3c-apariencia. Último commit: 781b0c7.
- 720 pruebas en 29 suites, en verde con `npm run check`.
- Esquema de la base de datos en la versión 4.
- Cuenta de Apple gratuita (Personal Team 8Z856TA59Z): sin push, la app
  instalada caduca a los 7 días.
- ios/ se regenera con `expo prebuild --clean`. Los ajustes de firma
  viven en app.json y en plugins/.
- Dependencias nativas ya presentes: expo-app-intents, expo-widgets,
  @expo/ui, expo-notifications (solo avisos locales).
- Repositorio en GitHub: Juaanantonioo/FinancialControl.

Qué viene después, para que entiendas el encaje. El siguiente bloque
(4b) añadirá cuentas de usuario en Supabase, cifrado de extremo a
extremo y sincronización. Este bloque NO toca la red. Prepara el
terreno: audita lo que hay, protege lo local y deja escritas las bases
que 4b necesitará.

Hechos ya observados en una inspección previa, que debes confirmar:

H1. No hay secretos en el repositorio ni en el historial de las ramas.
    .env está excluido. src/lib/supabase.ts solo usa la clave pública.
H2. La app no envía datos financieros a ningún servidor. La única
    llamada de red es la prueba de conexión de la pantalla Diagnóstico.
H3. La base de datos local no está cifrada por la app.
H4. No hay bloqueo de la app. Con el iPhone desbloqueado, cualquiera la
    abre.
H5. El widget y el aviso de captura (app-intents/CapturaEnBruto.swift)
    muestran importes y comercios en la pantalla de inicio y de
    bloqueo.
H6. Catorce pantallas leen parámetros de ruta con
    useLocalSearchParams. El esquema financialcontrol:// es
    personalizado y otra app podría invocarlo.
H7. La única sentencia SQL con interpolación es
    `PRAGMA user_version = ${Math.trunc(...)}` en migraciones.ts.
H8. No hay llamadas a console.log ni uso del portapapeles en src/.

======================================================================
2. OBJETIVO
======================================================================
1. Una auditoría de seguridad de la app actual, con hallazgos
   demostrados, su gravedad y su destino.
2. Bloqueo de la app con Face ID, Touch ID o el código del dispositivo.
3. Modo privado: importes ocultos en el widget, en los avisos y en el
   selector de apps.
4. Endurecimiento de las entradas externas: enlaces, acciones de Atajos
   y parámetros de ruta.
5. El modelo de amenazas y los requisitos de seguridad que el bloque 4b
   deberá cumplir, escritos y revisables.

Lo que queda cerrado: H4, H5 y H6. Lo que queda documentado y con
destino: todo lo demás.

======================================================================
3. DECISIONES YA TOMADAS (no las reabras)
======================================================================
D-a. Rama nueva `b4a-seguridad-local`, desde b3c-apariencia.

D-b. El cifrado de la base de datos local con SQLCipher NO entra en
     este bloque. Va en el 4b, junto con la jerarquía de claves de la
     cuenta. Motivo: una clave que solo viva en el llavero del
     dispositivo deja los datos ilegibles al cambiar de teléfono o
     restaurar una copia, y hoy no existe otra copia de los datos. En
     4b la clave local quedará envuelta por la clave de la cuenta y
     será recuperable. Aquí solo se deja diseñado (apartado 8).

D-c. Única dependencia nueva permitida: expo-local-authentication, con
     su plugin de configuración para el texto de uso de Face ID.
     Cualquier otra: PARA y pregunta.

D-d. El bloqueo es una barrera de acceso a la interfaz. No cifra nada y
     así debe decirlo la documentación. No vincules ninguna clave a la
     biometría: un cambio de huella o de cara no puede dejar a nadie
     sin sus datos.

D-e. El bloqueo viene desactivado. Se activa en Ajustes > Seguridad. Si
     el dispositivo no tiene código ni biometría, la opción aparece
     desactivada con su explicación.

D-f. Con el bloqueo activo, la app pide autenticación al abrirse y al
     volver de segundo plano tras un tiempo elegido por la persona:
     inmediatamente (por defecto), 1 minuto o 5 minutos. Si falla la
     biometría, se ofrece el código del dispositivo. No hay PIN propio
     de la app.

D-g. Las acciones de Atajos y los avisos programados siguen funcionando
     con la app bloqueada: guardan capturas y avisan. Lo que no pueden
     hacer es mostrar datos sin pasar el bloqueo. Tocar un aviso o un
     enlace lleva a su destino solo después de autenticarse.

D-h. Modo privado, independiente del bloqueo, en Ajustes > Seguridad:
     - el widget muestra «•••» en lugar de la cifra
     - los avisos no llevan importes ni comercios («Tienes un pago por
       revisar», «Tienes un cobro pendiente»)
     - el aviso de captura que lanza Swift respeta el mismo ajuste
     - la vista de la app en el selector de apps queda cubierta
     Viene desactivado. Con el bloqueo activo, la cubierta del selector
     de apps se aplica siempre.

D-i. La auditoría sigue el estándar OWASP MASVS en su versión vigente.
     Consulta la versión actual en mas.owasp.org y cítala. No la
     reconstruyas de memoria.

D-j. No se toca la red: nada de cuentas, sincronización ni Supabase. No
     crees tablas ni migraciones en el proyecto remoto.

D-k. Sin versión web ni Android. No instales nada en el iPhone físico.

D-l. Puedes subir la rama nueva a GitHub. No toques main. Antes de
     subir, repite la búsqueda de secretos.

======================================================================
4. LECTURA OBLIGATORIA
======================================================================
- AGENTS.md y docs/estado.md, apartados 10 a 12
- docs/05-arquitectura-y-modelo-de-datos.md
- docs/09-decisiones.md
- src/lib/, src/datos/bd.ts, bdExpo.ts y migraciones.ts
- src/app/_layout.tsx y las catorce pantallas con parámetros de ruta
- src/estado/widget.ts, src/widgets/, src/estado/avisos.ts,
  src/estado/colaNativa.ts
- app-intents/ completo
- app.json, plugins/ y .gitignore
- La documentación de Expo 58 de expo-local-authentication, y la de
  expo-widgets y expo-app-intents sobre cómo compartir un ajuste entre
  la app, el widget y el código Swift
- OWASP MASVS vigente

======================================================================
5. BASELINE
======================================================================
Registra en docs/estado.md, apartado 13 nuevo: rama, commit, resultado
de `npm run check`, versión del esquema y `git status`. PARA si el
baseline no coincide con el apartado 1.

======================================================================
6. FASES
======================================================================
Un commit por fase, con el prefijo «B4a:».

Fase 0. Baseline y lectura.

Fase 1. Auditoría (solo lectura, no cambies código todavía)
  Escribe docs/seguridad/auditoria-4a.md. Para cada control de MASVS
  aplicable a una app sin red: qué comprobaste, cómo, y el resultado.
  Como mínimo:

  Almacenamiento
  - qué ficheros crea la app en el dispositivo, dónde, y cuáles entran
    en las copias de seguridad de iOS
  - qué guarda el almacén de clave y valor y qué la cola nativa de
    Atajos
  - qué dato sale de la app hacia el widget y dónde queda
  - datos financieros en registros, en la caché o en capturas del
    selector de apps

  Entradas externas
  - cada parámetro de cada pantalla: qué acepta, qué valida y qué pasa
    con un valor malformado
  - cada parámetro de las dos acciones de Atajos: longitudes, tipos y
    qué llega a la base de datos
  - si alguna URL o aviso transporta datos sensibles

  Código y dependencias
  - secretos: búsqueda en el árbol y en todo el historial de todas las
    ramas, con la herramienta que tengas (gitleaks si está instalado,
    o patrones con git grep y git log -p). Di cuál usaste y su alcance
  - `npm audit --omit=dev` y `npx expo install --check`
  - SQL: confirma que toda consulta usa parámetros y revisa H7
  - permisos declarados en app.json e Info.plist frente a los usados

  Plataforma
  - entitlements reales tras el prebuild
  - qué muestra la app en pantalla de bloqueo, widget y selector de
    apps

  Cada hallazgo lleva: identificador, control de MASVS, evidencia
  (fichero y línea, o comando y salida resumida), gravedad (crítica,
  alta, media, baja, informativa) con su justificación, y destino:
  «se corrige en 4a», «va a 4b» o «riesgo aceptado, porque…».

  Distingue siempre HECHO OBSERVADO de HIPÓTESIS. Si no puedes
  comprobar algo, escribe NO DEMOSTRADO y qué haría falta.

  Si aparece un hallazgo crítico o alto que no esté cubierto por las
  fases siguientes, PARA y pregunta antes de continuar.

Fase 2. Endurecimiento de entradas
  - Validación única y reutilizable de parámetros de ruta: un
    identificador debe ser un UUID, un mes "AAAA-MM", una sección o una
    vista un valor de su lista. Lo que no valide se ignora y la
    pantalla abre su estado por defecto, sin error visible ni fallo.
  - Un identificador válido pero inexistente muestra «No encontrado» y
    permite volver.
  - Ninguna acción con efecto (guardar, borrar, confirmar) se ejecuta
    solo por abrir un enlace. Un enlace abre una pantalla, nada más.
  - Acciones de Atajos: límites de longitud y limpieza de caracteres de
    control en todos los textos, también en Swift.

Fase 3. Bloqueo de la app (D-d a D-g)
  - Lógica de cuándo toca bloquear como función pura en src/dominio/,
    con «ahora» como parámetro y con pruebas.
  - Capa fina sobre expo-local-authentication, sustituible en pruebas.
  - La pantalla de bloqueo no deja ver ni un fotograma del contenido
    antes de autenticar, tampoco al volver de segundo plano.
  - Tras `expo prebuild --clean`: compila para el simulador, los
    entitlements siguen sin `aps-environment` y el identificador de
    paquete no cambia.

Fase 4. Modo privado (D-h)
  - Un solo ajuste que leen la app, el widget y el código Swift del
    aviso de captura.
  - Al cambiarlo, el widget y los avisos ya programados se actualizan.

Fase 5. Modelo de amenazas y requisitos para 4b
  Escribe docs/seguridad/modelo-de-amenazas.md (apartado 8).

Fase 6. Casos límite, capturas y regresión.
Fase 7. Documentación e informe.

======================================================================
7. CASOS LÍMITE QUE DEBES PROBAR
======================================================================
Entradas:
- financialcontrol://movimiento?id= con: vacío, texto, un UUID que no
  existe, 10.000 caracteres, comillas y punto y coma, saltos de línea,
  emojis y secuencias `../`.
- Lo mismo en plan?seccion=…&mes=… y analisis?vista=…&anio=….
- Parámetro repetido dos veces en la misma URL.
- Acción «Registrar pago» con un comercio de 5.000 caracteres y con
  caracteres de control.

Bloqueo:
- Dispositivo sin código ni biometría.
- Biometría fallida tres veces, y cancelada por la persona.
- Biometría desactivada en Ajustes del sistema con el bloqueo activo.
- Volver de segundo plano a los 30 segundos con cada uno de los tres
  tiempos.
- Cambio de hora del reloj hacia atrás mientras la app está en segundo
  plano: no debe saltarse el bloqueo.
- Abrir por enlace, por aviso y por el widget con la app bloqueada: se
  llega al destino solo tras autenticarse.
- Acción de Atajos con la app bloqueada: la captura se guarda.
- Una hoja modal abierta al bloquearse: no queda visible detrás.
- Preferencia de bloqueo corrupta o con un valor desconocido. Decide el
  comportamiento seguro, justifícalo y pruébalo.

Modo privado:
- Activarlo con avisos ya programados y con el widget ya colocado.
- Aviso de captura lanzado desde Swift con el modo activo.
- Selector de apps en claro y en oscuro.

======================================================================
8. MODELO DE AMENAZAS Y REQUISITOS PARA 4b
======================================================================
Documento de diseño, sin código. Contenido:

1. Activos: qué datos existen y cuán sensibles son.
2. Adversarios y lo que puede hacer cada uno: quien coge el teléfono
   desbloqueado, quien lo roba bloqueado, quien obtiene una copia de
   seguridad, otra app instalada, quien intercepta la red, quien
   compromete la base de datos remota, otro usuario autenticado de la
   app, y el propio operador del servicio.
3. Para cada pareja activo y adversario: la defensa que existe hoy, la
   que añade 4a y la que deberá añadir 4b.
4. Requisitos que 4b debe cumplir, redactados como condiciones
   comprobables. Como mínimo:
   - cifrado de extremo a extremo: el servidor solo almacena contenido
     cifrado en el dispositivo
   - la contraseña no sale del dispositivo: de ella se derivan una
     clave de autenticación y una clave de cifrado, con una función de
     derivación resistente y una biblioteca auditada, nunca
     criptografía propia
   - código de recuperación generado en el alta
   - un dispositivo con datos puede volver a subirlos tras restablecer
     la contraseña
   - aislamiento por usuario con RLS en todas las tablas, activo por
     defecto y probado con dos usuarios
   - la clave de servicio nunca está en la app ni en el repositorio
   - cifrado de la base de datos local con SQLCipher, con la clave
     local envuelta por la clave de la cuenta, y migración de la base
     existente sin pérdida de datos
   - borrado de cuenta y exportación de datos (RGPD)
5. Preguntas abiertas que 4b deberá resolver, cada una con sus
   opciones. No las resuelvas tú.

Marca qué partes son hechos del código actual y cuáles son diseño
propuesto.

======================================================================
9. LO QUE NO PUEDE CAMBIAR
======================================================================
- Ningún cálculo ni cifra.
- La base de datos, las migraciones y los datos existentes. Este bloque
  no migra ni reescribe la base de datos.
- Las 720 pruebas de partida. Solo pueden tocarse las que comprueben un
  texto de aviso que el modo privado cambia. Lista cada una.
- El identificador de paquete y el esquema de URL.
- Con el bloqueo y el modo privado desactivados, la app se comporta
  exactamente igual que antes.
- Las rutas y URLs válidas siguen funcionando.

======================================================================
10. VERIFICACIÓN
======================================================================
- `npm run check` al cerrar cada fase.
- Prebuild y compilación para el simulador al cerrar las fases 3 y 4.
- Capturas en docs/capturas/b4a/, claro y oscuro: Ajustes > Seguridad,
  pantalla de bloqueo, widget en modo privado si el simulador lo
  permite, y «No encontrado».
- La biometría del simulador se puede simular desde su menú. Si no
  puedes accionarla desde la línea de comandos, marca NO DEMOSTRADO lo
  que no hayas visto y deja una lista de comprobación para el iPhone,
  paso a paso y con el resultado esperado.
- El Mac va lento con el simulador: espera, no supongas.

======================================================================
11. CRITERIOS DE ÉXITO
======================================================================
[ ] `npm run check` pasa entero.
[ ] Las 720 pruebas de partida siguen en verde, con las excepciones
    listadas.
[ ] docs/seguridad/auditoria-4a.md cubre todos los puntos de la fase 1,
    y cada hallazgo tiene evidencia, gravedad y destino.
[ ] Ningún hallazgo crítico o alto queda sin corregir o sin una
    decisión explícita del dueño.
[ ] La búsqueda de secretos cubre el historial completo y su resultado
    está documentado.
[ ] Cada parámetro de ruta pasa por la validación común, con pruebas
    para los casos del apartado 7.
[ ] Hay pruebas para la lógica de bloqueo en sus tres tiempos y para
    los casos límite que no dependen del dispositivo.
[ ] Con el bloqueo activo, ninguna vía de entrada muestra datos sin
    autenticar. Demostrado por prueba o marcado NO DEMOSTRADO.
[ ] El modo privado quita importes y comercios de avisos y widget, con
    prueba del texto de cada tipo de aviso.
[ ] Tras el prebuild: sin `aps-environment`, mismo identificador,
    compilación sin errores.
[ ] docs/seguridad/modelo-de-amenazas.md existe con los cinco puntos.
[ ] `git diff --stat b3c-apariencia` no incluye src/dominio/ salvo los
    ficheros nuevos de bloqueo y validación, ni
    src/datos/migraciones.ts.

======================================================================
12. NO HACER
======================================================================
- No inventes hallazgos ni los rebajes. No declares «seguro» lo que no
  has comprobado.
- No implementes criptografía. Ni cifrado de la base de datos, ni
  derivación de claves, ni nada parecido.
- No guardes ningún secreto en el llavero vinculado a la biometría.
- No toques Supabase ni añadas llamadas de red.
- No escribas en el repositorio ninguna clave, ni de ejemplo con forma
  real.
- No registres datos financieros en la consola ni en ficheros.
- No muestres en los errores detalles internos (rutas, SQL, trazas).
- No debilites pruebas.
- No presentes el bloqueo como cifrado en los textos de la app.
- No edites ios/ a mano: lo necesario va en app.json o en plugins/.

======================================================================
13. CUÁNDO PARAR Y CUÁNDO NO
======================================================================
PARA Y PREGUNTA si:
- el baseline no coincide
- encuentras un secreto real en el repositorio o en el historial. No lo
  copies en ningún documento: indica fichero, commit y tipo
- hay un hallazgo crítico o alto no previsto
- hace falta otra dependencia o una capacidad de pago
- el modo privado no puede llegar al widget o al aviso de Swift sin
  rediseñarlos
- tras tres intentos razonados no compila

NO pares por:
- pruebas que fallan mientras desarrollas
- hallazgos medios, bajos o informativos: documéntalos y sigue
- no poder accionar la biometría o ver el widget en el simulador

======================================================================
14. DOCUMENTACIÓN
======================================================================
- docs/seguridad/auditoria-4a.md y modelo-de-amenazas.md
- docs/estado.md, apartado 13
- docs/07: bloque 4 dividido en 4a, 4b y 4c, con su estado
- docs/09: la decisión D-b y la de cifrado de extremo a extremo con
  código de recuperación, tomada por el dueño el 18/11/2026
- README.md: un apartado «Seguridad» con lo que la app protege hoy y lo
  que no, sin exagerar

======================================================================
15. INFORME FINAL
======================================================================
- Baseline
- Qué confirmaste y qué no de H1 a H8
- Tabla de hallazgos: identificador, gravedad, destino
- Hecho por fase, con su commit
- Dependencias añadidas con versión
- Pruebas: antes, después y cuáles antiguas se tocaron
- Resultado de prebuild y compilación
- Casos límite
- Capturas
- Decisiones tomadas por tu cuenta
- Limitaciones y lo NO DEMOSTRADO
- Lista de comprobación para el iPhone
- Estado final: COMPLETED, COMPLETED_WITH_EXTERNAL_GATES,
  PARTIALLY_COMPLETED, BLOCKED_BY_EVIDENCE,
  BLOCKED_BY_EXTERNAL_DEPENDENCY o FAILED_VALIDATION

No declares COMPLETED si queda algún criterio del apartado 11 sin
cumplir.
```
