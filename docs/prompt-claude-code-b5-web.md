# Prompt para Claude Code · Bloque 5: verificación en simulador y versión web

Con Docker en marcha, desde `~/Desktop/FinancialControl`:

    caffeinate -dimsu claude "Lee docs/prompt-claude-code-b5-web.md y ejecútalo entero."

```
======================================================================
1. CONTEXTO
======================================================================
FinancialControl: app de finanzas personales con Expo SDK 58, React
Native 0.88, TypeScript y Expo Router. Datos en SQLite local, cuenta
opcional con cifrado de extremo a extremo y sincronización cifrada
sobre Supabase.

Objetivo del dueño: lanzar una beta GRATUITA EN LA WEB, sin gastar
dinero, y después Android. Este bloque entrega la web. Android es el
bloque siguiente: no lo empieces, pero no tomes decisiones que lo
dificulten.

Estado de partida, comprobado el 22/11/2026:

- Rama b4b2-sincronizacion, commit f680e9f, subida. 1.236 pruebas en 49
  suites y 81 remotas contra la instancia local, en verde.
- El bloque 4b-2 NO se ha visto funcionar en ningún dispositivo: el
  simulador se colgó al instalar la app. No hay capturas. La migración
  local 5 no se ha visto aplicarse sobre una base con datos fuera de
  las pruebas.
- Proyecto remoto de Supabase: aplicada la migración
  20261118120000. La 20261122120000 (rls_auto_enable) puede estar o no
  aplicada: la aplica el dueño. No dependas de ella.
- En el remoto, «Confirm email» está desactivado y no hay proveedor de
  correo.
- Argon2id (64 MiB, 8 pasadas): 218 a 221 ms en el iPhone del dueño.
  Sin medir en navegador.
- Al abrir la web en desarrollo hoy falla con «Unable to resolve
  react-native-web». react-dom ya está instalado.
- Informes anteriores en docs/informes/. Diseños en docs/seguridad/.

======================================================================
2. OBJETIVO
======================================================================
PARTE A. Demostrar en simuladores que el 4b-2 funciona, y cerrar tres
decisiones pendientes.

PARTE B. Una versión web de la app, exportable como sitio estático,
donde una persona crea su cuenta o inicia sesión y usa presupuesto,
movimientos, análisis, plan y cuentas, con los mismos datos cifrados
que la app del iPhone.

======================================================================
3. DECISIONES YA TOMADAS (no las reabras)
======================================================================
D-a. Rama nueva `b5-web`, desde b4b2-sincronizacion.

Parte A
D-b. Entrar con un dispositivo que tiene datos en una cuenta con la
     nube vacía ya no sube sin preguntar. Siempre pregunta: «¿Subir los
     datos de este dispositivo a tu cuenta?». Cancelar no inicia la
     sincronización y no borra nada.
D-c. La nota de un movimiento y los demás textos libres tienen un
     límite de longitud en la app, elegido para que la fila cifrada
     quepa con margen en el máximo del servidor. Los textos existentes
     más largos no se truncan: se avisa al editarlos.
D-d. Cerrar las demás sesiones al cambiar la contraseña, la
     recuperación con el código y el cifrado de la base local quedan
     para el 4b-3. No los hagas.

Parte B
D-e. En la web la cuenta es OBLIGATORIA. No hay modo «solo en este
     navegador». La primera pantalla es entrar o crear cuenta.
D-f. En la web no se guarda en el navegador nada en claro ni ninguna
     clave: ni localStorage, ni IndexedDB, ni cookies, ni caché con
     datos financieros, la clave de datos o la contraseña. La clave de
     datos vive solo en memoria. Recargar o cerrar la pestaña obliga a
     escribir la contraseña otra vez. Es la respuesta a la decisión
     que el 4b-1 dejó abierta sobre el almacén seguro en web.
     Se permite guardar el correo para rellenar el formulario, y la
     preferencia de apariencia.
D-g. Los datos en la web se bajan cifrados al entrar, se descifran en
     memoria y se trabaja sobre una base en memoria. Cada cambio se
     sube cifrado con el motor de sincronización existente. Elige la
     forma de tener esa base en memoria en el navegador con el menor
     riesgo (expo-sqlite para web, que está en alfa y puede exigir
     cabeceras COOP/COEP, u otra vía ya presente en el proyecto).
     Compruébalo en la documentación de Expo 58 y en una compilación
     real. La capa src/datos/ no debe duplicarse: una sola
     implementación de repositorios para todas las plataformas.
D-h. Sin conexión, la web no funciona: lo dice con claridad y no
     pierde lo ya escrito en pantalla. Antes de cerrar la pestaña con
     cambios sin subir, avisa.
D-i. Cifrado en web con libsodium-wrappers-sumo, la misma biblioteca
     que ya usan las pruebas. La autocomprobación de vectores se
     ejecuta también en el navegador antes de cualquier operación de
     cuenta. Mismos sobres, mismas claves, mismos parámetros: una
     cuenta creada en el iPhone abre en la web y al revés.
D-j. Lo que no existe en un navegador se oculta o se sustituye, sin
     pantallas rotas: acciones de Atajos y guía de Apple Pay, widget,
     bloqueo con Face ID, avisos programados, hoja de compartir (la
     exportación descarga los ficheros). El modo privado no aplica.
     Decide por pantalla, anótalo en una tabla y no cambies el
     comportamiento en iOS.
D-k. Diseño adaptable: usable en un móvil de 360 px de ancho y cómodo
     en escritorio, con el mismo aspecto visual. En escritorio la
     navegación puede pasar a una barra lateral. Navegable con teclado
     y con foco visible.
D-l. Seguridad del sitio. Es una app con cifrado en el navegador: un
     script inyectado roba la clave. Por tanto:
     - Política de seguridad de contenido estricta: sin scripts en
       línea ni de terceros, sin eval salvo lo que WebAssembly exija
       (documenta la excepción exacta), conexiones solo al propio
       origen y al proyecto de Supabase.
     - Ningún recurso de terceros: ni fuentes, ni analítica, ni CDN.
     - Cabeceras: HSTS, X-Content-Type-Options, Referrer-Policy,
       Permissions-Policy, frame-ancestors 'none', y las de aislamiento
       que la base en memoria necesite.
     - Las cabeceras van en un fichero de configuración del alojamiento
       dentro del repositorio.
     - Documenta sin suavizar el límite de este modelo: en la web el
       usuario confía en que el servidor entrega el código correcto.
D-m. Alojamiento gratuito de sitio estático que permita cabeceras
     propias y HTTPS. Evalúa las opciones vigentes, elige una, deja la
     configuración en el repositorio y NO despliegues: el despliegue lo
     hace el dueño con los pasos que le escribas. GitHub Pages no vale
     si no permite las cabeceras necesarias.
D-n. Páginas legales dentro de la web y enlazadas desde el alta:
     política de privacidad y condiciones de uso de la beta, en
     español. Redáctalas a partir de lo que la app hace de verdad
     (qué se guarda, dónde, cifrado, qué ve el servidor, borrado y
     exportación, sin analítica, beta gratuita sin garantías).
     Deja entre corchetes los datos que solo conoce el dueño
     (titular, contacto) y marca arriba «BORRADOR pendiente de revisión
     del titular». No inventes datos del responsable.
D-o. Aviso de beta visible y texto claro en el alta: si olvidas la
     contraseña, hoy no se puede recuperar la cuenta.
D-p. Dependencias permitidas: react-native-web, @expo/metro-runtime y
     lo que `npx expo install` exija para web; mover
     libsodium-wrappers-sumo a dependencias de producción con versión
     exacta; una herramienta de pruebas en navegador como dependencia
     de desarrollo (Playwright). Cualquier otra: PARA y pregunta.
D-q. No toques el esquema remoto, la jerarquía de claves, el formato
     del sobre ni el motor de sincronización, salvo defectos. No
     apliques nada al proyecto remoto ni uses la clave secreta. No
     ejecutes `supabase login`, `link`, `db push` ni `config push`.
D-r. Puedes subir la rama. No toques main.

======================================================================
4. LECTURA OBLIGATORIA
======================================================================
docs/informes/b4b2-informe-final.md, docs/estado.md apartado 15,
docs/seguridad/ entero, src/cripto/, src/sincronizacion/, src/datos/,
src/lib/almacenSeguro*.ts, src/estado/cuenta.ts, src/app/ entero, y la
documentación vigente de Expo 58 sobre web, exportación estática,
expo-sqlite en web y Expo Router en web.

======================================================================
5. FASES
======================================================================
Un commit por fase, prefijo «B5:».

PARTE A
Fase 0. Baseline en docs/estado.md, apartado 16. PARA si no coincide
        con el apartado 1 o si no hay Docker.
Fase 1. Simulador. Diagnostica por qué se colgó la instalación (hecho
        observado, hipótesis, causa confirmada). Reinicia el servicio
        de simuladores, borra y recrea un simulador si hace falta. No
        borres datos del dueño fuera de los simuladores. Si tras un
        diagnóstico razonado ningún simulador instala la app, PARA la
        parte A, anótalo y sigue con la parte B.
Fase 2. Prueba real con dos simuladores y la instancia LOCAL de
        Supabase (no el proyecto remoto): migración 5 sobre una base en
        versión 4 con datos, alta, pregunta de subida (D-b), bajada en
        el segundo, alta, cambio y borrado en los dos sentidos,
        conflicto, sin conexión, «Usar los datos de la nube» con su
        copia previa, cambio de contraseña, exportación. Comprueba que
        la hoja de compartir informa bien de si se guardó el fichero.
        Capturas en docs/capturas/b4b2/. Corrige lo que falle, con
        prueba.
Fase 3. D-b y D-c, con pruebas.

PARTE B
Fase 4. Diseño por escrito: docs/seguridad/diseno-web.md. Base en
        memoria elegida y por qué, qué se guarda en el navegador (nada
        sensible), cabeceras y CSP, tabla de pantallas y funciones por
        plataforma, límites del modelo.
Fase 5. La app arranca en web: dependencias, capas por plataforma
        (almacén seguro en memoria, base en memoria, cripto), sin tocar
        el comportamiento en iOS.
Fase 6. Cuenta obligatoria, entrada, bajada y uso completo de las cinco
        secciones. Diseño adaptable (D-k).
Fase 7. Sustituciones por plataforma (D-j), exportación por descarga,
        avisos de sin conexión y de cambios sin subir.
Fase 8. Seguridad del sitio (D-l), alojamiento (D-m), páginas legales y
        aviso de beta (D-n, D-o).
Fase 9. Pruebas en navegador, casos límite, capturas y regresión.
Fase 10. Documentación, pasos del propietario e informe.

======================================================================
6. PRUEBAS OBLIGATORIAS DE LA WEB
======================================================================
En navegador real automatizado, contra la instancia local de Supabase,
sobre el sitio exportado (`npx expo export -p web`) servido con las
cabeceras definitivas, no sobre el servidor de desarrollo:

- Alta, código de recuperación, uso, cierre y nueva entrada.
- Interoperabilidad: una cuenta creada con el código nativo (o su
  equivalente en las pruebas de Node) abre en la web y al revés, y las
  doce tablas se leen idénticas.
- Tras iniciar sesión y usar la app: localStorage, sessionStorage,
  IndexedDB, cookies, Cache Storage y OPFS no contienen la contraseña,
  ninguna clave, ningún sobre descifrado ni ningún dato financiero.
  La prueba vuelca cada almacén y busca valores conocidos.
- Recargar la página pide la contraseña y recupera los datos.
- Ninguna petición sale hacia un origen distinto del propio y del de
  Supabase. Ninguna lleva datos en claro.
- La CSP está activa y no hay violaciones en consola durante un
  recorrido completo. Un script en línea inyectado no se ejecuta.
- Un texto con HTML o script en un nombre, comercio o nota se muestra
  como texto.
- Sin conexión: mensaje claro; al volver, sigue funcionando.
- Aviso al cerrar con cambios sin subir.
- Anchos de 360, 768 y 1280 px, en claro y en oscuro: nada cortado ni
  solapado. Capturas en docs/capturas/b5/.
- Navegación completa solo con teclado.
- Tiempo de Argon2id en el navegador de escritorio y con emulación de
  móvil, y memoria: si 64 MiB falla en algún caso, PARA y pregunta.
  Marca la medida en un móvil real como NO DEMOSTRADO.
- Tamaño del sitio exportado y tiempo de carga inicial.

Regresión: `npm run check` y las 81 remotas en verde; la app de iOS
compila tras `expo prebuild --clean` y se comporta igual.

======================================================================
7. NO HACER
======================================================================
- No guardes nada sensible en el navegador.
- No cargues nada de terceros.
- No relajes la CSP para que algo funcione sin documentar la excepción
  exacta y su motivo.
- No dupliques la lógica de dominio, datos, cifrado ni sincronización
  por plataforma.
- No cambies el comportamiento de la app de iOS.
- No despliegues el sitio ni toques el proyecto remoto.
- No inventes datos legales del titular.
- No des por visto lo que no has visto: NO DEMOSTRADO.
- No debilites pruebas. No escribas criptografía a mano.

======================================================================
8. CUÁNDO PARAR
======================================================================
PARA Y PREGUNTA si: el baseline no coincide; ninguna vía de base en
memoria funciona en web sin duplicar src/datos/; hace falta otra
dependencia; la CSP estricta es incompatible con algo imprescindible;
64 MiB de Argon2id no funciona en navegador; encuentras un defecto que
exija cambiar claves, sobres o esquema remoto; encuentras un secreto.

NO pares por pruebas que fallan mientras desarrollas ni por defectos
dentro del alcance. El dueño no estará delante: si falta una decisión
suya, termina lo demás, déjala planteada con opciones y recomendación,
y cierra el informe.

======================================================================
9. CRITERIOS DE ÉXITO
======================================================================
[ ] Parte A: sincronización vista entre dos simuladores, con capturas,
    o parada documentada con su diagnóstico.
[ ] D-b y D-c hechas, con prueba.
[ ] `npx expo export -p web` genera el sitio sin errores.
[ ] Todas las pruebas del apartado 6 existen y pasan.
[ ] docs/seguridad/diseno-web.md coincide con el código.
[ ] Configuración de alojamiento y cabeceras en el repositorio.
[ ] Páginas legales en borrador y aviso de beta.
[ ] `npm run check` y remotas en verde; iOS compila.
[ ] Sin secretos en el repositorio.
[ ] docs/seguridad/pasos-del-propietario-b5.md: cómo probar la web en
    su Mac y en su móvil, cómo desplegarla gratis paso a paso, qué
    añadir en Supabase (URL del sitio permitida), y qué revisar en los
    textos legales.
[ ] docs/informes/b5-informe-final.md.

======================================================================
10. INFORME FINAL
======================================================================
En docs/informes/b5-informe-final.md, con commit y rama subida:
baseline; parte A (diagnóstico del simulador y resultado de la prueba
con dos dispositivos); hecho por fase con su commit; base en memoria y
alojamiento elegidos y por qué; dependencias; pruebas antes y después;
tabla de funciones por plataforma; CSP final con sus excepciones;
medidas de Argon2id y de carga; decisiones propias; riesgos residuales
sin suavizar, incluido el modelo de confianza de la web; NO
DEMOSTRADO; qué habrá que tener en cuenta para Android; pasos del
propietario; y estado final (COMPLETED, COMPLETED_WITH_EXTERNAL_GATES,
PARTIALLY_COMPLETED, BLOCKED_BY_EVIDENCE,
BLOCKED_BY_EXTERNAL_DEPENDENCY o FAILED_VALIDATION).
```
