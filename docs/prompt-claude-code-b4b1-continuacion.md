# Prompt para Claude Code · Bloque 4b-1, continuación

Abre Claude Code en `~/Desktop/FinancialControl` y escribe:

    Lee docs/prompt-claude-code-b4b1-continuacion.md y ejecútalo entero.

```
======================================================================
1. SITUACIÓN
======================================================================
El bloque 4b-1 (cuenta de usuario, claves y esquema remoto) quedó a
medias el 18/11/2026. El encargo original está en
docs/prompt-claude-code-b4b1-cuenta-y-claves.md y sigue en vigor
entero: léelo antes de nada. Este documento lo completa, no lo
sustituye.

Estado comprobado el 21/11/2026:

- Rama b4b1-cuenta-y-claves, último commit 4db59ce (fase 3).
- Commits hechos: fase 0 (d8fbd96), fase 2 en JavaScript (a089605) y
  fase 3 (4db59ce). La fase 1 y las fases 4 a 6 no tienen commit.
- Hay trabajo SIN CONFIRMAR de una sesión que se interrumpió hacia las
  20:00 del 18/11, en mitad de la fase 4. No se sabe en qué punto
  exacto se cortó ni si lo último escrito está completo.

  Modificados: app.json, package.json, package-lock.json,
  scripts/vectores-de-cripto.cjs, src/app/_layout.tsx,
  src/app/ajustes.tsx, src/app/diagnostico.tsx, src/cripto/index.ts,
  src/cripto/parametros.ts, src/cripto/__tests__/cripto.test.ts,
  src/i18n/es.json, src/lib/supabase.ts,
  src/pruebas/__tests__/plugin.test.ts, y vectores.json movido a
  src/cripto/.

  Nuevos: docs/seguridad/diseno-criptografico.md,
  docs/seguridad/riesgo-de-dependencia-libsodium.md,
  plugins/parche-libsodium.js, src/cripto/autocomprobacion.ts,
  src/app/cuenta-de-usuario.tsx, src/estado/cuenta.ts,
  src/estado/cuentaDeLaApp.ts, src/lib/almacenSeguro.ts,
  src/lib/almacenSeguroNativo.ts, src/lib/contrasena.ts,
  src/pruebas/__tests__/cuenta.test.ts y src/pruebas/cuentaDePrueba.ts.

- En el proyecto remoto de Supabase no se ha aplicado nada.
- No existe el fichero .env.

======================================================================
2. DECISIONES DEL DUEÑO TRAS EL BLOQUEO (ya comunicadas, van aquí por
   si se perdió el contexto)
======================================================================
DECISIÓN 1. react-native-libsodium 1.7.0 no compila con React Native
0.88. Se aplica el arreglo del PR #109 con un parche propio, con estas
condiciones obligatorias:
- Versiones exactas, sin ^ ni ~, de react-native-libsodium y de
  libsodium-wrappers-sumo.
- El parche calcula la huella SHA-256 del fichero original antes de
  tocarlo. Si no coincide con la esperada, falla con un mensaje claro.
  Comprueba también la huella del resultado. Aplicarlo dos veces no
  cambia nada.
- El parche es texto legible en el repositorio, con un comentario que
  dice de dónde sale, qué cambia, que no toca criptografía y cuándo
  debe retirarse.
- Autocomprobación en ejecución: antes de permitir cualquier operación
  de cuenta, la app calcula con la biblioteca nativa un subconjunto de
  los vectores y lo compara. Si algo no coincide, las funciones de
  cuenta se desactivan con un mensaje y el resto de la app sigue
  funcionando en local. Con prueba.
- Los dos límites del paquete en nativo (datos autenticados solo como
  texto, y BLAKE2b) quedan en el diseño criptográfico, con una prueba
  que falle si el módulo los incumple.
- El riesgo de mantenimiento del paquete queda anotado como punto a
  revisar en el 4c.

DECISIÓN 2. Argon2id con 64 MiB y 8 pasadas. Provisionales hasta
medirlos en un iPhone real y en un navegador de móvil. Diagnóstico
muestra el tiempo de derivación en el dispositivo, sin mostrar ninguna
clave.

DECISIÓN 3. Código de recuperación de 256 bits, 14 grupos de 4, con
detección de errores de transcripción y pantalla para guardarlo o
imprimirlo.

También: aviso_emitido queda fuera de la sincronización, documentando
la consecuencia. La prueba antigua de la lista de dependencias que se
tocó está aceptada. No desinstales la app del simulador ni borres sus
datos sin necesidad.

======================================================================
3. PRIMERO: REVISAR EL TRABAJO A MEDIAS (no lo des por bueno)
======================================================================
Trata el trabajo sin confirmar como código de otra persona que hay que
revisar antes de aceptarlo.

1. No descartes nada. Antes de tocar, guarda una copia de seguridad del
   estado actual con `git stash push --include-untracked` seguido de
   `git stash apply`, de modo que el stash quede como respaldo y el
   árbol de trabajo siga igual. Anota el identificador del stash.
2. Ejecuta `npm run check` y anota el resultado tal cual.
3. Lee cada fichero modificado y cada fichero nuevo, entero. Para cada
   uno, decide y anota en docs/estado.md, apartado 14:
   - completo y correcto
   - incompleto (qué falta)
   - incorrecto (qué está mal)
   Presta atención a ficheros que terminen a mitad de una función, a
   importaciones de cosas que no existen y a textos de es.json sin uso
   o sin definir.
4. Comprueba una a una las condiciones de las tres decisiones del
   apartado 2 contra el código real. Para cada condición: cumplida, con
   fichero y línea, o pendiente.
5. Comprueba que el diseño criptográfico escrito coincide con el código
   y con los vectores. Si difieren, manda el encargo original y sus
   decisiones: corrige lo que esté mal y anota la diferencia.
6. package.json tiene ahora un `postinstall` que ejecuta el parche.
   Verifica que ese mecanismo cumple la decisión 1, que también actúa
   tras `expo prebuild --clean` y antes de compilar, y que un
   `npm ci` desde cero deja el paquete parcheado y verificado. Si hay
   una forma más robusta, úsala y explícalo.

No sigas con el punto 4 del apartado siguiente hasta que este esté
cerrado y anotado.

======================================================================
4. DESPUÉS: TERMINAR EL BLOQUE
======================================================================
1. Corrige lo incompleto y lo incorrecto del apartado 3.
2. Cierra la fase 1 (diseño criptográfico) y haz su commit.
3. Cierra la fase 2 de verdad: compila para el simulador tras
   `expo prebuild --clean` y comprueba que la autocomprobación pasa con
   la biblioteca nativa. Commit.
4. Completa las fases 4, 5 y 6 del encargo original, con sus pruebas
   obligatorias, sus capturas y su documentación.
5. Repite las 33 pruebas de aislamiento contra la instancia local.
6. Cumple todos los criterios de éxito del encargo original.

Un commit por fase, con el prefijo «B4b1:». No mezcles en un solo
commit el trabajo recuperado y el nuevo si pertenecen a fases
distintas.

======================================================================
5. LO QUE SIGUE PROHIBIDO
======================================================================
Todo lo del encargo original. En especial:
- No pidas, leas ni escribas la contraseña de la base de datos, la
  clave de servicio ni un token de acceso.
- No ejecutes `supabase login`, `supabase link` ni `supabase db push`.
- No apliques nada al proyecto remoto.
- No escribas criptografía a mano.
- No sincronices datos financieros ni cifres la base local.
- No toques main ni fusiones ramas.
- No instales nada en el iPhone físico.
- No borres el stash de respaldo.

======================================================================
6. CUÁNDO PARAR
======================================================================
PARA Y PREGUNTA si:
- el estado del repositorio no coincide con el apartado 1
- el trabajo a medias contradice una decisión del apartado 2 de forma
  que no puedas corregir sin rehacer el diseño
- la compilación nativa con el parche falla tras tres intentos
  razonados
- Docker no está disponible
- encuentras un secreto real en el repositorio

NO pares por pruebas que fallan mientras desarrollas ni por ficheros a
medias: complétalos.

El dueño no está delante. Si necesitas una decisión suya que no esté en
este documento ni en el encargo original, termina todo lo que no
dependa de ella, déjala planteada con sus opciones y tu recomendación,
y cierra el informe.

======================================================================
7. INFORME FINAL
======================================================================
El del encargo original, más:
- resultado de la revisión del trabajo a medias, fichero a fichero
- tabla de condiciones de las tres decisiones: cumplida o no, con
  fichero y línea
- identificador del stash de respaldo
- docs/seguridad/pasos-del-propietario-4b1.md completo, porque es lo
  siguiente que hará el dueño

Guarda además el informe en docs/informes/b4b1-informe-final.md y haz
commit, para que pueda leerse sin esta sesión.

Estado final: COMPLETED, COMPLETED_WITH_EXTERNAL_GATES,
PARTIALLY_COMPLETED, BLOCKED_BY_EVIDENCE,
BLOCKED_BY_EXTERNAL_DEPENDENCY o FAILED_VALIDATION.
```
