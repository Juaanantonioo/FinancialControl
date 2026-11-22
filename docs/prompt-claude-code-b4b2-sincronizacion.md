# Prompt para Claude Code · Bloque 4b-2: Sincronización cifrada

Abre Claude Code en `~/Desktop/FinancialControl` (con Docker en marcha) y escribe:

    Lee docs/prompt-claude-code-b4b2-sincronizacion.md y ejecútalo entero.

Para que el Mac no se duerma durante el trabajo, lánzalo así:

    caffeinate -dimsu claude "Lee docs/prompt-claude-code-b4b2-sincronizacion.md y ejecútalo entero."

```
======================================================================
1. CONTEXTO
======================================================================
FinancialControl es una app de finanzas personales hecha con Expo SDK
58, React Native 0.88, TypeScript y Expo Router. Los datos viven en
SQLite en el dispositivo. El objetivo inmediato del dueño es lanzar una
beta gratuita en la web. Este bloque construye lo que la web necesita:
que los datos de una cuenta viajen cifrados entre dispositivos.

Estado de partida, comprobado el 22/11/2026:

- Rama b4b1-cuenta-y-claves, último commit 2650f9c, subida a GitHub.
  1.092 pruebas en 38 suites y 41 pruebas remotas, en verde.
- Respaldo antiguo: stash@{0} (27c3df3). El dueño lo da por superado:
  puedes borrarlo al empezar, después de comprobar que su contenido ya
  está en los commits de la rama.
- Proyecto remoto de Supabase (btkpyvfwdbnuralhvwhg, eu-west-1, plan
  gratuito). El dueño aplicó el 22/11 la migración
  20261118120000_cuenta_y_filas_cifradas.sql. Comprobado en el panel:
  las dos tablas tienen RLS activado y forzado, cuatro políticas cada
  una solo para `authenticated`, y un anónimo con la clave pública
  recibe «permission denied».
- El asesor de seguridad del panel muestra 0 errores y 3 avisos: dos
  sobre public.rls_auto_enable() (función creada por Supabase al
  activar «RLS en tablas nuevas»; SECURITY DEFINER, devuelve
  event_trigger, EXECUTE concedido a anon y authenticated) y uno sobre
  public.borrar_mi_cuenta(), que es esperado.
- .env existe con la URL y la clave pública. Git lo ignora.
- «Confirm email» está desactivado en el proyecto remoto.
- Probado por el dueño en su iPhone el 22/11: alta, cierre e inicio de
  sesión funcionan; Diagnóstico da conexión y biblioteca correctas.
  Argon2id (64 MiB, 8 pasadas) tarda 218, 219 y 221 ms en su iPhone.
  En el servidor, la clave de datos llegó como sobre ilegible de 98
  caracteres.
- Documentos de referencia: docs/seguridad/diseno-criptografico.md,
  modelo-de-amenazas.md (requisitos R-01 a R-28 y su estado),
  riesgo-de-dependencia-libsodium.md, y docs/informes/
  b4b1-informe-final.md.

Este bloque es el 4b-2. Lo que queda después:
- 4b-3: recuperación con el código (necesita una función en el
  servidor) y cifrado de la base local con SQLCipher.
- 4c: auditoría ofensiva.
- 5: versión web.

======================================================================
2. OBJETIVO
======================================================================
Al terminar, una persona con cuenta puede:

1. Usar la app sin conexión como hasta ahora. Nada se bloquea esperando
   a la red.
2. Ver sus datos sincronizados entre dos dispositivos con la misma
   cuenta: altas, cambios y borrados.
3. Cambiar su contraseña sin perder datos.
4. Exportar todos sus datos a un fichero (RGPD, R-24).
5. Ver en Cuenta cuándo se sincronizó por última vez, si hay cambios
   pendientes y, si algo falla, un mensaje comprensible.

Y el servidor solo habrá recibido contenido cifrado en el dispositivo.

======================================================================
3. DECISIONES YA TOMADAS (no las reabras)
======================================================================
D-a. Rama nueva `b4b2-sincronizacion`, desde b4b1-cuenta-y-claves.

D-b. Se sincronizan las doce tablas que admite fila_cifrada.tabla.
     aviso_emitido no se sincroniza (decisión del 4b-1).

D-c. Cada fila local se cifra entera como un sobre, con la clave de
     datos y el formato de sobre ya existente. Los datos autenticados
     del sobre incluyen, como mínimo, el user_id, el nombre de la tabla,
     el id de la fila y la versión del formato. Así el servidor no
     puede mover un sobre de una fila a otra, de una tabla a otra ni de
     un usuario a otro sin que el descifrado falle. Respeta los límites
     del paquete nativo documentados en el diseño (datos autenticados
     como texto).

D-e. Conflictos: gana la última escritura que llega al servidor, por
     fila (P-4). La marca de tiempo la pone el servidor. Documenta el
     efecto: si dos dispositivos cambian la misma fila sin conexión, se
     conserva la que se suba después y la otra se pierde.

D-f. Borrados: borrado lógico. Una fila borrada se sube con
     borrada = true y su contenido cifrado, y se borra en los demás
     dispositivos. No se usa DELETE para filas de datos.

D-g. Lectura de cambios: por cursor de actualizada_en del servidor. Las
     marcas de tiempo de transacciones concurrentes pueden confirmarse
     fuera de orden, así que un cursor ingenuo puede saltarse filas.
     Usa una ventana de solapamiento y aplicación idempotente, o una
     alternativa equivalente que tú justifiques. Debe demostrarse con
     prueba que no se pierde ninguna fila.

D-h. Entrada en una cuenta desde un dispositivo:
     - Si la nube está vacía (primer dispositivo), se suben los datos
       locales.
     - Si el dispositivo no tiene datos del usuario, se bajan los de la
       nube. Las categorías iniciales que crea la app y no ha tocado
       nadie no cuentan como datos del usuario. Define y prueba cómo se
       distinguen.
     - Si la nube y el dispositivo tienen datos los dos, NO se fusiona.
       La app pregunta: «Usar los datos de la nube» (antes se exporta
       una copia de lo local a un fichero que la persona guarda) o
       «Cancelar» (no se inicia sesión). Nunca se sube lo local encima
       de la nube en este caso.

D-i. Cuándo se sincroniza: al abrir la app, al volver de segundo plano,
     poco después de un cambio local (agrupando cambios seguidos) y con
     un botón «Sincronizar ahora» en Cuenta. Nunca en segundo plano con
     la app cerrada.

D-j. Sin conexión o con error: los cambios quedan pendientes y se
     reintentan con espera creciente. Un error en una fila no detiene
     las demás. Una fila remota que no se puede descifrar no se aplica,
     no se borra en el servidor, se cuenta y se informa en Cuenta.

D-k. Cambio de contraseña: se deriva la clave maestra nueva, se vuelve
     a envolver la misma clave de datos y se cambia la contraseña de
     Supabase Auth por la nueva subclave de autenticación. La clave de
     datos no cambia, así que no hay que volver a cifrar ninguna fila.
     Ninguna interrupción entre pasos puede dejar la cuenta inservible:
     diseña el orden y cómo se reanuda, y pruébalo cortando en cada
     paso. Pide la contraseña actual antes de cambiarla.

D-l. Actualización de parámetros al iniciar sesión: si la cuenta tiene
     una versión de derivación anterior a la actual, tras un inicio de
     sesión correcto se rehace la envoltura con los parámetros nuevos,
     con el mismo mecanismo que D-k. Los parámetros actuales (64 MiB, 8
     pasadas) se mantienen en este bloque; lo que se construye es la
     capacidad de cambiarlos después sin que nadie rehaga su cuenta.
     Pruébalo con una versión de derivación 2 de prueba que solo exista
     en las pruebas.

D-m. Exportación: un fichero JSON con todas las filas de todas las
     tablas locales, en claro, legible y con su versión de formato, y
     un CSV de movimientos. Se entrega con la hoja de compartir del
     sistema. Antes de exportar se pide autenticación si el bloqueo de
     la app está activo, y la pantalla avisa de que el fichero no va
     cifrado. Funciona con y sin cuenta.

D-n. Migración remota nueva, la segunda: retira EXECUTE sobre
     public.rls_auto_enable() a public, anon y authenticated. Escríbela
     para que no falle si la función no existe (en la instancia local
     puede no existir) y para que no cambie nada más. Comprueba en la
     instancia local, creando la función y su disparador de eventos
     como los tiene el proyecto remoto, que después de retirar el
     permiso una tabla nueva en public sigue quedando con RLS. Si no
     puedes demostrarlo, no incluyas la migración y explica por qué.
     No toques borrar_mi_cuenta().

D-o. Ningún cambio de esquema en fila_cifrada ni en claves_de_usuario
     salvo que sea imprescindible. Si lo fuera, PARA y pregunta.

D-p. Dependencias nuevas: ninguna. Si alguna fuera imprescindible, PARA
     y pregunta.

D-q. Sin cifrado de la base local (es del 4b-3), sin recuperación con
     el código (4b-3), sin versión web ni Android.

D-r. Puedes subir la rama nueva a GitHub. No toques main ni fusiones
     nada. No apliques nada al proyecto remoto: la migración nueva la
     aplica el dueño con la orden que le dejes escrita (recuerda que la
     CLI de Supabase actual necesita `--remote` para apuntar al
     proyecto).

======================================================================
4. SECRETOS
======================================================================
Igual que en el 4b-1: no pidas, leas ni escribas la contraseña de la
base de datos, la clave secreta ni un token. No ejecutes `supabase
login`, `link` ni `db push`. No muestres nunca en registros, errores ni
capturas una clave, un sobre descifrado o el contenido de una fila de
datos real. Repite la búsqueda de secretos antes de cada commit y antes
de subir la rama.

======================================================================
5. LECTURA OBLIGATORIA
======================================================================
- docs/informes/b4b1-informe-final.md y docs/estado.md, apartado 14
- docs/seguridad/ entero
- src/cripto/, src/estado/cuenta.ts, src/lib/supabase.ts,
  src/lib/almacenSeguro*.ts y src/app/cuenta-de-usuario.tsx
- src/datos/ entero: repositorios, migraciones y cómo se marca
  modificadoEn y borradoEn
- supabase/migrations/ y supabase/pruebas/
- La documentación vigente de Supabase sobre filtros por fecha,
  paginación y actualización de la contraseña del usuario, y la de
  expo-sharing o la hoja de compartir que ya use la app

======================================================================
6. BASELINE
======================================================================
Apartado 15 nuevo en docs/estado.md: rama, commit, `npm run check`,
pruebas remotas, versión del esquema local y `git status`. PARA si no
coincide con el apartado 1 o si Docker no está disponible.

======================================================================
7. FASES
======================================================================
Un commit por fase, con el prefijo «B4b2:».

Fase 0. Baseline, lectura y limpieza del stash antiguo.
Fase 1. Diseño de la sincronización por escrito, antes de programar:
        docs/seguridad/diseno-sincronizacion.md. Qué se cifra y con qué
        datos autenticados, formato de la fila en claro, algoritmo de
        subida y bajada, cursor, conflictos, borrados, entrada en una
        cuenta (D-h), qué ve el servidor y qué puede hacer un servidor
        malicioso (ver apartado 9).
Fase 2. Motor de sincronización en src/sincronizacion/, sin pantallas:
        cifrar y descifrar filas, subir, bajar, aplicar, cursor y
        reintentos. Funciones puras donde se pueda, con la red y el
        reloj inyectados.
Fase 3. Migración remota de D-n y pruebas contra la instancia local.
Fase 4. Integración en la app: cuándo se sincroniza (D-i), estado en
        Cuenta, «Sincronizar ahora», entrada en una cuenta (D-h).
Fase 5. Cambio de contraseña (D-k) y actualización de parámetros
        (D-l).
Fase 6. Exportación (D-m).
Fase 7. Casos límite, capturas y regresión.
Fase 8. Documentación, pasos del propietario e informe.

======================================================================
8. PRUEBAS OBLIGATORIAS
======================================================================
Contra la instancia local de Supabase, con el cliente real:

Sincronización
- Dos dispositivos simulados A y B con la misma cuenta: un alta, un
  cambio y un borrado en A aparecen en B, y al revés.
- Las doce tablas viajan y vuelven idénticas, campo a campo.
- Un conflicto: A y B cambian la misma fila sin conexión; gana la que
  se sube después y la otra no deja restos.
- Dos escrituras confirmadas fuera de orden: B recibe las dos.
- Mil movimientos se suben y se bajan sin perder ninguno.
- Sin conexión: los cambios esperan y salen al volver la conexión.
- Un sobre remoto manipulado (un bit cambiado), movido a otro id, a
  otra tabla o copiado a otro usuario: no se aplica, no rompe la
  sincronización del resto y se cuenta como error.
- El usuario C no ve nada de A aunque conozca sus ids.
- Lo que llega al servidor: ningún campo de ninguna fila en claro.
  Compruébalo espiando las peticiones y leyendo la tabla remota.

Entrada en una cuenta (D-h)
- Nube vacía y dispositivo con datos: sube.
- Dispositivo recién instalado y nube con datos: baja, sin duplicar
  categorías iniciales.
- Ambos con datos: pregunta; «Cancelar» no cambia nada; «Usar la nube»
  exporta antes y luego reemplaza.

Contraseña y parámetros
- Cambio de contraseña: la vieja deja de valer, la nueva entra, las
  filas se siguen descifrando en otro dispositivo tras volver a entrar.
- Corte en cada paso del cambio: la cuenta sigue accesible con una de
  las dos contraseñas, y la app sabe terminar el cambio.
- Cuenta con versión de derivación 1 y la app en versión 2 de prueba:
  al entrar se actualiza sola y sigue descifrando.

Exportación
- El JSON contiene todas las filas de todas las tablas y se puede
  volver a leer. El CSV abre los importes con su signo y su divisa.

Regresión
- Sin cuenta, la app se comporta exactamente igual que antes.
- Las 1.092 pruebas de partida y las 41 remotas siguen en verde.

======================================================================
9. SERVIDOR MALICIOSO: QUÉ SE ACEPTA
======================================================================
Documenta, sin resolverlo en este bloque, lo que un servidor
comprometido aún podría hacer con este diseño: ver cuántas filas hay
por tabla y cuándo cambian, ocultar filas, devolver una versión antigua
de una fila (reversión) o negarse a guardar. Indica cuáles detectaría la
app y cuáles no. Esto alimenta la auditoría del 4c.

======================================================================
10. LO QUE NO PUEDE CAMBIAR
======================================================================
- Ningún cálculo, cifra ni pantalla existente, salvo Cuenta y Ajustes.
- La base local y sus migraciones. Si el motor necesita guardar estado
  (cursor, cola de pendientes), justifica dónde y por qué; si necesita
  una migración local nueva, que no toque los datos existentes y se
  pruebe sobre una base en versión 4 con datos.
- El formato del sobre y la jerarquía de claves del 4b-1.
- El bloqueo, el modo privado, las acciones de Atajos y el widget.
- El identificador de paquete y el esquema de URL.

======================================================================
11. CRITERIOS DE ÉXITO
======================================================================
[ ] `npm run check` y las pruebas remotas pasan enteros.
[ ] Todas las pruebas del apartado 8 existen y pasan.
[ ] docs/seguridad/diseno-sincronizacion.md existe y coincide con el
    código.
[ ] Ninguna petición lleva datos de filas en claro, demostrado.
[ ] La migración de D-n está probada, o descartada con su motivo.
[ ] Compila para el simulador tras `expo prebuild --clean`.
[ ] Sin secretos en el repositorio ni en el historial de la rama.
[ ] docs/seguridad/pasos-del-propietario-4b2.md con lo que el dueño
    debe hacer, incluida la prueba con dos dispositivos.
[ ] docs/informes/b4b2-informe-final.md con el informe.

======================================================================
12. NO HACER
======================================================================
- No escribas criptografía a mano ni reutilices nonces.
- No subas una fila sin cifrar, ni siquiera de prueba, al proyecto
  remoto.
- No uses DELETE para filas de datos remotas.
- No fusiones datos de nube y dispositivo cuando los dos tienen datos.
- No bloquees la interfaz esperando a la red.
- No muestres errores internos al usuario.
- No apliques nada al proyecto remoto ni uses la clave secreta.
- No debilites pruebas.
- No borres datos locales sin una exportación previa.

======================================================================
13. CUÁNDO PARAR
======================================================================
PARA Y PREGUNTA si:
- el baseline no coincide o no hay Docker
- hace falta cambiar el esquema remoto existente o añadir dependencias
- el cambio de contraseña no puede hacerse sin una ventana en la que la
  cuenta quede inaccesible
- encuentras un defecto de seguridad en el 4b-1 que exija cambiar la
  jerarquía de claves o el formato del sobre
- encuentras un secreto real

NO pares por pruebas que fallan mientras desarrollas ni por defectos
dentro del alcance: corrígelos, pruébalos y anótalos.

El dueño no estará delante. Si necesitas una decisión suya que no esté
aquí, termina todo lo que no dependa de ella, déjala planteada con sus
opciones y tu recomendación, y cierra el informe.

======================================================================
14. DOCUMENTACIÓN E INFORME
======================================================================
- docs/seguridad/diseno-sincronizacion.md
- docs/seguridad/modelo-de-amenazas.md: estado de cada requisito
- docs/seguridad/pasos-del-propietario-4b2.md
- docs/estado.md, apartado 15; docs/05; docs/07; docs/09
- docs/informes/b4b2-informe-final.md, con: baseline, hecho por fase
  con su commit, pruebas antes y después, resultado de las remotas,
  casos límite, lo que un servidor malicioso aún puede hacer,
  decisiones propias, riesgos residuales sin suavizar, NO DEMOSTRADO,
  pasos del propietario y estado final (COMPLETED,
  COMPLETED_WITH_EXTERNAL_GATES, PARTIALLY_COMPLETED,
  BLOCKED_BY_EVIDENCE, BLOCKED_BY_EXTERNAL_DEPENDENCY o
  FAILED_VALIDATION).

Haz commit del informe y sube la rama. Mientras el dueño no aplique la
migración remota y no pruebe con dos dispositivos, el estado máximo es
COMPLETED_WITH_EXTERNAL_GATES.
```
