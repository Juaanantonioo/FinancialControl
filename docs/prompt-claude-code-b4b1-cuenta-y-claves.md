# Prompt para Claude Code · Bloque 4b-1: Cuenta de usuario, claves y esquema remoto

Pega todo lo que sigue en Claude Code, abierto en `~/Desktop/FinancialControl`.

```
======================================================================
1. CONTEXTO
======================================================================
FinancialControl es una app de finanzas personales hecha con Expo SDK
58, React Native 0.88, TypeScript y Expo Router. Los datos viven en
SQLite dentro del dispositivo. Hoy no hay cuentas de usuario ni se
envía ningún dato financiero a un servidor.

Estado de partida, comprobado el 18/11/2026:

- Rama actual: b4a-seguridad-local. Último commit: 3785b0a.
- 954 pruebas en 35 suites, en verde con `npm run check`.
- Esquema local en la versión 4.
- Auditoría y modelo de amenazas en docs/seguridad/. El modelo recoge
  30 requisitos para este bloque y 10 preguntas abiertas (P-1 a P-10).
- Proyecto de Supabase ya creado por el dueño: referencia
  btkpyvfwdbnuralhvwhg, región eu-west-1 (Irlanda), plan gratuito, con
  «RLS en tablas nuevas» activado y enlazado al repositorio de GitHub
  Juaanantonioo/FinancialControl. No tiene tablas ni migraciones.
- src/lib/supabase.ts solo hace una lectura de prueba, sin sesión.
- Cuenta de Apple gratuita: sin push, la app instalada caduca a los 7
  días.

Estrategia de lanzamiento decidida por el dueño: coste cero. La primera
versión pública será una beta gratuita en la web. Por eso todo lo que
se construya aquí debe poder funcionar también en un navegador, aunque
este bloque no compila la web.

Este bloque es la primera mitad del 4b. Crea la cuenta, las claves y el
esquema remoto con su aislamiento. NO sincroniza datos financieros: eso
es el 4b-2.

======================================================================
2. OBJETIVO
======================================================================
1. Un módulo criptográfico propio de la app, fino y probado, sobre una
   biblioteca auditada: derivación de claves, jerarquía de claves,
   sobre cifrado con versión y código de recuperación.
2. El esquema remoto en ficheros de migración, con aislamiento por
   usuario demostrado con pruebas entre dos usuarios.
3. Alta, inicio y cierre de sesión, y borrado de cuenta, con la
   contraseña sin salir nunca del dispositivo.
4. El diseño criptográfico por escrito, para que una persona experta
   pueda revisarlo sin leer el código.

Al terminar, una persona puede crear una cuenta, guardar su código de
recuperación, cerrar sesión, volver a entrar y borrar la cuenta. Sus
datos financieros siguen solo en el dispositivo.

======================================================================
3. DECISIONES YA TOMADAS (no las reabras)
======================================================================
Riesgos de la auditoría aceptados por el dueño: A-10, A-11, A-13, A-15,
A-16 y A-18. A-14 (paquetes de Expo una revisión por detrás) se
resuelve aquí en la fase 0 con `npx expo install --check`.

Preguntas del modelo de amenazas, resueltas así:

P-1  Biblioteca: libsodium, mediante un paquete con las mismas
     funciones en iOS, Android y web. Candidato: react-native-libsodium,
     que declara las tres plataformas y expone crypto_pwhash en web con
     su variante «sumo». Comprueba en su documentación y en una
     compilación real que funciona con React Native 0.88 y Expo 58. No
     lo des por hecho.
P-2  Derivación: Argon2id con crypto_pwhash. Parámetros iguales o
     superiores al mínimo que recomiende hoy la guía de almacenamiento
     de contraseñas de OWASP. Consúltala y cítala. Punto de partida:
     los valores INTERACTIVE de libsodium. Mide el tiempo y ajústalo
     para que quede entre medio segundo y dos segundos.
P-3  Se cifra fila a fila.
P-4  Conflictos: gana la última escritura, por fila. Se construye en
     4b-2; aquí solo se deja el esquema preparado.
P-5  Autenticación: de la contraseña se deriva una clave maestra, y de
     ella una clave de autenticación que se envía a Supabase Auth como
     si fuera la contraseña. La contraseña real y la clave maestra no
     salen del dispositivo.
P-6  Código de recuperación: grupos de letras y cifras sin caracteres
     ambiguos, con al menos 160 bits de entropía, más una pantalla para
     guardarlo o imprimirlo.
P-7  Cola de Atajos y widget: se quedan como están.
P-8  La base local sigue dentro de la copia de seguridad de iOS.
P-9  Sin fijación de certificados.
P-10 Sin cuenta, la app funciona solo en local y sin cifrado de base.
     La pantalla de cuenta lo explica.

Decisiones de este bloque:

D-a. Rama nueva `b4b1-cuenta-y-claves`, desde b4a-seguridad-local.

D-b. Jerarquía de claves:
     contraseña + sal  -> Argon2id -> clave maestra
     clave maestra     -> subclave de autenticación (va a Supabase)
     clave maestra     -> subclave de envoltura
     clave de datos    -> aleatoria, de 256 bits, generada en el alta
     La clave de datos se guarda en el servidor envuelta dos veces: una
     con la subclave de envoltura y otra con una clave derivada del
     código de recuperación. Es la clave que cifrará las filas en 4b-2.
     Las subclaves se derivan con la función de derivación de subclaves
     de libsodium, con contextos distintos y documentados.

D-c. La sal de Argon2id se deriva del correo normalizado y de una
     constante de la app, sin consultarla al servidor. Así no hace
     falta una petición antes de iniciar sesión que revele si un correo
     está registrado. Consecuencia aceptada: en esta versión no se puede
     cambiar el correo de una cuenta.

D-d. Cifrado autenticado con XChaCha20-Poly1305 de libsodium, nonce
     aleatorio por operación. Todo contenido cifrado va en un sobre con
     versión de formato, para poder cambiar de algoritmo o de
     parámetros sin romper lo ya guardado.

D-e. En el dispositivo, la clave de datos y la sesión de Supabase se
     guardan solo en el llavero del sistema, con expo-secure-store,
     accesibles tras el primer desbloqueo y sin salir del dispositivo.
     Nunca en SQLite, en el almacén de clave y valor ni en UserDefaults.
     No se vinculan a la biometría. En web no hay llavero: deja la
     interfaz de almacenamiento abstracta y anota la decisión pendiente
     para el bloque de la web, sin resolverla.

D-f. Contraseña: mínimo 12 caracteres y rechazo de una lista corta de
     contraseñas evidentes incluida en la app. Sin dependencias para
     medir la fortaleza. El alta explica que la contraseña cifra los
     datos y que nadie puede restablecerla.

D-g. Código de recuperación: se muestra una sola vez en el alta y no se
     puede continuar sin confirmar que se ha guardado, escribiendo dos
     de sus grupos elegidos al azar. Nunca se guarda en claro en el
     dispositivo ni se envía al servidor.

D-h. Beta sin coste: el proyecto usa el correo integrado de Supabase,
     que solo envía a los miembros del equipo. Por eso la confirmación
     de correo estará desactivada en el proyecto y no hay
     restablecimiento por correo. Quien olvide la contraseña y conserve
     un dispositivo con sus datos podrá crear otra cuenta. El cambio de
     contraseña y la recuperación con el código se construyen en 4b-2.

D-i. Esquema remoto en supabase/migrations/, como ficheros SQL. Dos
     tablas:
     claves_de_usuario
       user_id (clave primaria, referencia a auth.users con borrado en
       cascada), clave de datos envuelta por contraseña, clave de datos
       envuelta por recuperación, versión de la derivación, versión del
       formato, creado y actualizado.
     fila_cifrada
       user_id, tabla (texto restringido a la lista de tablas locales
       que se sincronizarán), id (UUID), contenido (el sobre cifrado,
       con un tamaño máximo), versión del formato, borrada (booleano) y
       actualizada_en. Clave primaria: user_id, tabla, id.
     En las dos: RLS activado y forzado, user_id con valor por defecto
     auth.uid(), actualizada_en puesta por un disparador en el servidor
     y nunca por el cliente, y políticas solo para el rol autenticado
     que exigen user_id = auth.uid() al leer, insertar, modificar y
     borrar. El rol anónimo no tiene ningún permiso sobre ellas.

D-j. Borrado de cuenta: una función en la base de datos que borra las
     filas y el usuario de quien la llama, y de nadie más. Si para ello
     hace falta una función con privilegios elevados, fija su
     search_path, limita quién puede ejecutarla y demuestra con pruebas
     que un usuario no puede borrar a otro.

D-k. Las pruebas del esquema corren contra una instancia local de
     Supabase (CLI y Docker). No apliques nada al proyecto remoto: eso
     lo hace el dueño con una orden que tú le dejas escrita.

D-l. Dependencias permitidas, solo estas: el paquete de libsodium
     elegido y, si hace falta para pruebas o web, libsodium-wrappers o
     su variante sumo; expo-secure-store; y la CLI de Supabase como
     dependencia de desarrollo. Cualquier otra: PARA y pregunta.

D-m. No instales nada en el iPhone físico. Sin versión web ni Android.

D-n. Puedes subir la rama nueva a GitHub. No toques main ni fusiones
     nada: el proyecto de Supabase está enlazado al repositorio y un
     cambio en la rama de producción podría desplegar migraciones.

======================================================================
4. SECRETOS Y CREDENCIALES
======================================================================
- Nunca pidas, leas, escribas ni muestres: la contraseña de la base de
  datos, la clave de servicio o secreta de Supabase, ni un token de
  acceso personal.
- No ejecutes `supabase login`, `supabase link` ni `supabase db push`.
- La app solo usa la URL del proyecto y la clave pública, leídas de
  .env, que git ignora. Si .env no existe, usa la instancia local para
  las pruebas y deja al dueño las instrucciones para crearlo.
- Las claves de la instancia local son de desarrollo y públicas, pero
  tampoco las escribas en ficheros que entren en git.
- Antes de cada commit y antes de subir la rama, repite la búsqueda de
  secretos de la auditoría.

======================================================================
5. LECTURA OBLIGATORIA
======================================================================
- AGENTS.md y docs/estado.md, apartado 13
- docs/seguridad/auditoria-4a.md y modelo-de-amenazas.md, enteros
- docs/05-arquitectura-y-modelo-de-datos.md y docs/09-decisiones.md
- src/lib/, src/estado/seguridad.ts, src/app/ajustes.tsx y
  src/app/seguridad.tsx
- src/datos/migraciones.ts, para la lista de tablas locales
- La documentación vigente de: libsodium (crypto_pwhash, crypto_kdf,
  cifrado autenticado), el paquete de libsodium elegido, Supabase (RLS,
  Auth, CLI y pruebas de base de datos), expo-secure-store y la guía de
  almacenamiento de contraseñas de OWASP

No programes criptografía de memoria. Cada elección de función,
parámetro y tamaño lleva su referencia en el documento de diseño.

======================================================================
6. BASELINE
======================================================================
Registra en docs/estado.md, apartado 14 nuevo: rama, commit, resultado
de `npm run check`, versión del esquema local, `git status`, y si
Docker y la CLI de Supabase están disponibles. Actualiza los paquetes
de Expo atrasados (A-14) y confirma que todo sigue en verde.

PARA si la rama o el commit no coinciden, o si `npm run check` falla
antes de empezar. Si Docker no está disponible, PARA y pregunta: sin
instancia local no se puede demostrar el aislamiento.

======================================================================
7. FASES
======================================================================
Un commit por fase, con el prefijo «B4b1:».

Fase 0. Baseline, lectura y actualización de paquetes.

Fase 1. Diseño criptográfico por escrito, antes de programar
  docs/seguridad/diseno-criptografico.md: jerarquía de claves,
  funciones y parámetros con su referencia, formato del sobre byte a
  byte, formato del código de recuperación, qué se guarda y dónde, qué
  ve el servidor y qué no, y qué pasa en cada pérdida (contraseña,
  código, dispositivo, y sus combinaciones).

Fase 2. Módulo criptográfico (src/cripto/)
  - Una interfaz pequeña y sin estado: derivar claves, envolver y
    desenvolver la clave de datos, cifrar y descifrar un sobre, generar
    y leer un código de recuperación.
  - Ninguna otra parte de la app llama a la biblioteca directamente.
  - Aleatoriedad solo de la biblioteca criptográfica.
  - Los errores no revelan por qué falló un descifrado.
  - Las claves viven en memoria el tiempo mínimo y no pasan por
    registros, mensajes de error ni estado serializable.
  - Compila para el simulador con la biblioteca nativa.

Fase 3. Esquema remoto y aislamiento
  - Migraciones en supabase/migrations/ según D-i y D-j.
  - Pruebas contra la instancia local, con dos usuarios A y B.

Fase 4. Cuenta en la app
  - Ajustes > Cuenta: estado sin sesión con su explicación (P-10),
    crear cuenta, pantalla del código de recuperación con su
    confirmación, iniciar sesión, cerrar sesión y borrar cuenta con
    doble confirmación.
  - Cliente de Supabase con sesión guardada en el llavero.
  - Cerrar sesión borra del dispositivo la clave de datos y la sesión,
    y no toca los datos financieros locales.
  - Borrar la cuenta borra lo remoto y cierra la sesión. Los datos
    locales se conservan y la pantalla lo dice.
  - Sin conexión: mensajes claros, sin esperas infinitas, y la app
    sigue funcionando en local.
  - Con el bloqueo de la app activo, las pantallas de cuenta quedan
    detrás del bloqueo como el resto.

Fase 5. Casos límite, capturas y regresión.
Fase 6. Documentación e informe.

======================================================================
8. PRUEBAS OBLIGATORIAS
======================================================================
Criptografía:
- Vectores conocidos: una contraseña y un correo fijos dan siempre las
  mismas subclaves. Los vectores quedan en el repositorio.
- El mismo correo con mayúsculas o espacios da la misma sal.
- Ida y vuelta de cifrado, y de envoltura con contraseña y con código.
- Contraseña equivocada, código equivocado, sobre truncado, un bit
  cambiado en cada parte del sobre y versión desconocida: fallan sin
  devolver datos y sin distinguir el motivo hacia fuera.
- Dos cifrados del mismo contenido no coinciden.
- El código de recuperación tiene la entropía declarada, no usa
  caracteres ambiguos y detecta un error de transcripción.
- La subclave de autenticación es distinta de la de envoltura y de la
  contraseña.

Lo que nunca debe salir:
- Las llamadas de alta e inicio de sesión reciben la subclave de
  autenticación y nunca la contraseña. Compruébalo espiando el cliente.
- Ninguna petición lleva la clave maestra, la clave de datos en claro
  ni el código de recuperación.
- Tras el alta y el inicio de sesión, ni SQLite, ni el almacén de clave
  y valor, ni UserDefaults contienen material de claves.

Aislamiento, contra la instancia local, en las dos tablas:
- A no puede leer, insertar, modificar ni borrar filas de B.
- Insertar con el user_id de otro se rechaza. Cambiar el user_id de una
  fila propia se rechaza.
- Sin sesión no se puede leer ni escribir nada.
- Un contenido mayor que el máximo y una tabla fuera de la lista se
  rechazan.
- actualizada_en no puede fijarla el cliente.
- La función de borrado solo borra al que la llama. B sigue intacto
  tras el borrado de A.
- Cada tabla del esquema público tiene RLS activado y forzado. Una
  prueba lo comprueba recorriendo el catálogo, para que una tabla
  futura sin RLS haga fallar la suite.

Cuenta:
- Alta, cierre e inicio de sesión recuperan la misma clave de datos.
- Alta con un correo ya registrado: mensaje que no confirma si existe.
- No se puede salir de la pantalla del código sin confirmarlo.
- Alta interrumpida entre la creación del usuario y el guardado de las
  claves: al reintentar no queda una cuenta inservible. Decide cómo,
  justifícalo y pruébalo.
- Sin conexión en cada paso.
- Borrado de cuenta y nueva alta con el mismo correo.

======================================================================
9. LO QUE NO PUEDE CAMBIAR
======================================================================
- Ningún cálculo, ninguna cifra y ninguna pantalla existente, salvo
  Ajustes, que gana la entrada «Cuenta».
- La base local, sus migraciones y sus datos.
- Las 954 pruebas de partida. Solo pueden tocarse las que fijen la
  lista de entradas de Ajustes o las que vigilan que no se use el
  llavero. Lista cada una y su motivo.
- Sin cuenta, la app se comporta exactamente igual que antes.
- El bloqueo, el modo privado, las acciones de Atajos y el widget.
- El identificador de paquete y el esquema de URL.
- Tras el prebuild, los entitlements siguen sin `aps-environment`.

======================================================================
10. VERIFICACIÓN
======================================================================
- `npm run check` al cerrar cada fase.
- Las pruebas de aislamiento, con la orden exacta para repetirlas.
- Prebuild y compilación para el simulador al cerrar las fases 2 y 4.
- Tiempo de Argon2id medido en el simulador, con la advertencia de que
  no es el del iPhone real.
- Capturas en docs/capturas/b4b1/, claro y oscuro: Cuenta sin sesión,
  alta, código de recuperación, confirmación del código, sesión
  iniciada y borrado. La captura del código usa uno de prueba.
- Lo que no puedas ver se marca NO DEMOSTRADO.

======================================================================
11. CRITERIOS DE ÉXITO
======================================================================
[ ] `npm run check` pasa entero, con las excepciones listadas.
[ ] Todas las pruebas del apartado 8 existen y pasan.
[ ] docs/seguridad/diseno-criptografico.md permite reproducir los
    vectores de prueba a mano con libsodium.
[ ] Ninguna función criptográfica de la app está escrita a mano: todas
    son llamadas a la biblioteca.
[ ] La contraseña no aparece en ninguna petición, registro ni
    almacenamiento, demostrado por prueba.
[ ] El aislamiento entre dos usuarios está demostrado en las dos tablas
    y en la función de borrado.
[ ] La prueba del catálogo falla si se añade una tabla sin RLS.
[ ] Compila para el simulador tras `expo prebuild --clean`.
[ ] No hay secretos en el repositorio ni en el historial de la rama.
[ ] Existe docs/seguridad/pasos-del-propietario-4b1.md con lo que el
    dueño debe hacer en el panel y en su terminal.
[ ] `git diff --stat b4a-seguridad-local` no incluye src/dominio/,
    src/datos/migraciones.ts ni las pantallas de finanzas.

======================================================================
12. NO HACER
======================================================================
- No escribas primitivas criptográficas ni combines algoritmos por tu
  cuenta. Si la biblioteca no ofrece algo, PARA.
- No uses Math.random, ni fechas, ni identificadores como fuente de
  aleatoriedad.
- No reutilices un nonce ni derives dos claves con el mismo contexto.
- No envíes la contraseña a ningún sitio.
- No guardes claves fuera del llavero.
- No sincronices datos financieros ni subas ninguna fila real.
- No cifres la base local. Es del 4b-2.
- No apliques migraciones al proyecto remoto.
- No uses la clave de servicio en ningún caso.
- No desactives RLS ni crees políticas con `true` para salir del paso.
- No debilites pruebas.
- No prometas en los textos más de lo que hay: hoy la cuenta no
  sincroniza nada, y la pantalla lo dice.

======================================================================
13. CUÁNDO PARAR Y CUÁNDO NO
======================================================================
PARA Y PREGUNTA si:
- el baseline no coincide o no hay Docker
- el paquete de libsodium no compila con React Native 0.88 tras tres
  intentos razonados, o no ofrece en las tres plataformas alguna
  función necesaria. Deja el diagnóstico y las alternativas evaluadas,
  sin adoptar ninguna
- Argon2id no puede cumplir a la vez el mínimo de OWASP y un tiempo
  razonable
- el borrado de cuenta no puede hacerse sin la clave de servicio
- encuentras un secreto real
- una decisión del apartado 3 resulta insegura a la luz de la
  documentación. Explica por qué y propón la alternativa

NO pares por:
- pruebas que fallan mientras desarrollas
- un defecto de seguridad dentro del alcance que encuentres por el
  camino: corrígelo, pruébalo y anótalo
- no poder ver algo en el simulador

======================================================================
14. DOCUMENTACIÓN
======================================================================
- docs/seguridad/diseno-criptografico.md
- docs/seguridad/modelo-de-amenazas.md: las diez preguntas con su
  respuesta, los riesgos aceptados y qué requisitos quedan cumplidos,
  cuáles van al 4b-2 y cuáles al 4c
- docs/seguridad/pasos-del-propietario-4b1.md, paso a paso y con el
  resultado esperado de cada uno: crear .env con la URL y la clave
  pública, desactivar la confirmación de correo, revisar qué rama
  despliega la integración con GitHub, aplicar las migraciones desde su
  terminal, comprobar en el panel que las dos tablas tienen RLS, y qué
  no debe copiar nunca fuera del panel
- docs/05: el esquema remoto
- docs/09: decisiones de este bloque y la estrategia de beta sin coste
- docs/07: estado del bloque 4
- docs/estado.md, apartado 14
- README.md, apartado Seguridad

======================================================================
15. INFORME FINAL
======================================================================
- Baseline
- Biblioteca elegida, versión y cómo comprobaste las tres plataformas
- Parámetros de Argon2id, su referencia y el tiempo medido
- Hecho por fase, con su commit
- Dependencias añadidas
- Pruebas: antes, después, cuáles antiguas se tocaron y resultado de
  las de aislamiento
- Resultado de prebuild y compilación
- Casos límite
- Decisiones tomadas por tu cuenta, y cualquier desacuerdo con el
  apartado 3
- Riesgos residuales del diseño, dichos sin suavizar
- Limitaciones y lo NO DEMOSTRADO
- Pasos del propietario
- Estado final: COMPLETED, COMPLETED_WITH_EXTERNAL_GATES,
  PARTIALLY_COMPLETED, BLOCKED_BY_EVIDENCE,
  BLOCKED_BY_EXTERNAL_DEPENDENCY o FAILED_VALIDATION

No declares COMPLETED si queda algún criterio del apartado 11 sin
cumplir. Aplicar las migraciones al proyecto remoto es un paso del
dueño: mientras no lo haga, el estado máximo es
COMPLETED_WITH_EXTERNAL_GATES.
```
