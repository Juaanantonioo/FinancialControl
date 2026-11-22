# Diseño de la sincronización cifrada · bloque 4b-2

Fecha: 22/11/2026. Describe lo que hace `src/sincronizacion/` y los cambios de
`src/estado/cuenta.ts` para el cambio de contraseña. Se apoya en
`diseno-criptografico.md` (jerarquía de claves y formato del sobre), que no cambia.

**Estado:** construido y probado contra una instancia local de Supabase. Nadie ajeno al
proyecto lo ha revisado. No se ha probado con dos teléfonos reales.

## 1. Qué se quiere conseguir

1. La app funciona sin conexión igual que antes. La red nunca bloquea una pantalla.
2. Dos dispositivos con la misma cuenta acaban con los mismos datos: altas, cambios y
   borrados.
3. El servidor solo recibe contenido cifrado en el dispositivo.
4. Un sobre alterado o cambiado de sitio (de fila, de tabla o de usuario) no se aplica.
5. Ningún fallo de una fila detiene a las demás, y ninguna fila se pierde por el orden en
   que el servidor confirma las escrituras.

## 2. Qué se sincroniza

Las doce tablas que admite `fila_cifrada.tabla`: `cuenta`, `categoria`, `movimiento`,
`valor_de_inversion`, `objetivo`, `aportacion_a_objetivo`, `regla_recurrente`,
`presupuesto`, `linea_de_presupuesto`, `captura`, `alias_de_tarjeta` y
`regla_de_comercio`. `aviso_emitido` no viaja: es memoria de cada dispositivo.

El catálogo (`src/sincronizacion/tablas.ts`) lista, por tabla, sus columnas, sus índices
únicos y el orden en que hay que aplicarlas para respetar las claves ajenas. Una prueba
compara el catálogo con el esquema real de SQLite: si una migración futura añade una
columna, una tabla o un índice único y no se actualiza el catálogo, la prueba falla.

## 3. Qué se cifra

### 3.1 La fila en claro

Cada fila local se convierte en un texto JSON, en UTF-8:

```
{"v":1,"f":{"id":"…","nombre":"…", … ,"creado_en":"…","modificado_en":"…","borrado_en":null}}
```

- `v` es la versión de este formato de fila (hoy 1). No es la versión del sobre.
- `f` lleva **todas** las columnas de la fila, con el nombre que tienen en SQLite y su
  valor tal cual (texto, número entero o `null`). No se omite ninguna.
- El texto se rellena con espacios al final hasta un múltiplo de **256 bytes**. Así el
  tamaño del sobre no delata la longitud exacta de una nota o de un nombre, solo su tramo.
  El relleno no es criptografía: JSON ignora los espacios finales.

Al leer se exige: `v` conocida, `f.id` igual al id de la fila, exactamente las columnas
del catálogo y valores de tipo texto, número o `null`. Si falta o sobra una columna (por
ejemplo, una fila escrita por una versión más nueva de la app), la fila **se retiene**
(apartado 7.3) en lugar de aplicarse a medias.

### 3.2 El sobre y sus datos autenticados

El texto se cifra con la **clave de datos** de la cuenta y la función `cifrar` del 4b-1
(XChaCha20-Poly1305, nonce aleatorio de 24 bytes por cifrado, formato de sobre 1). Los
datos autenticados son el texto ASCII:

```
FC1|fila/<user_id>/<tabla>/<id>
```

| Parte | Qué impide |
|---|---|
| `FC1` (versión del formato del sobre) | Que se cambie el byte de versión |
| `<user_id>` | Que un sobre de una persona se presente como de otra |
| `<tabla>` | Que un sobre de una tabla se presente en otra |
| `<id>` | Que un sobre de una fila se presente como otra fila |

Los datos autenticados son texto, como exige el paquete nativo. El `user_id` no lo dice
el servidor en cada fila: es el de la cuenta a la que está ligada la base local (apartado
8), fijado al entrar.

En `diseno-criptografico.md` el uso de las filas figuraba como `fila/<tabla>/<id>`. Se
amplía con el `user_id` (decisión D-c). Nunca se llegó a cifrar ninguna fila con el uso
antiguo.

### 3.3 Qué va en claro al servidor

Por cada fila: `user_id`, `tabla`, `id`, `version_de_formato` (1), `borrada` y el sobre.
`actualizada_en` la pone el servidor. Nada más.

`borrada` se envía porque el esquema la tiene (D-f), pero **el dispositivo no se fía de
ella al bajar**: si una fila está borrada lo decide su contenido descifrado
(`borrado_en`). Un servidor que cambie esa marca no consigue borrar ni resucitar nada.

## 4. Estado local del motor

El motor guarda su estado en la propia base SQLite, en una **migración local nueva (la
5)** que solo crea tablas y disparadores nuevos; no toca ninguna tabla ni fila existente.

Por qué en SQLite y no en las preferencias o en el llavero: el cursor y las marcas de
«pendiente» tienen que cambiar **en la misma transacción** que los datos. Si se guardaran
aparte, un cierre de la app entre las dos escrituras dejaría un cambio local sin marcar
(no se subiría nunca) o un cursor adelantado sin las filas aplicadas (no se bajarían
nunca).

| Tabla | Para qué |
|---|---|
| `sinc_pendiente (cambio, tabla, id)` | Cola de filas locales por subir. `cambio` es un número que solo crece |
| `sinc_remota (tabla, id, actualizada_en)` | La última marca de tiempo del servidor que este dispositivo conoce de cada fila |
| `sinc_retenida (tabla, id, motivo, contenido, actualizada_en)` | Filas remotas que no se han podido aplicar: ilegibles o no aplicables todavía |
| `sinc_estado (clave, valor)` | Cuenta a la que está ligada la base, cursor, última sincronización, último repaso |

**Cómo se marca un cambio local.** Cada una de las doce tablas tiene dos disparadores
(`AFTER INSERT` y `AFTER UPDATE`) que apuntan la fila en `sinc_pendiente` con un número
de cambio nuevo. Así ningún repositorio cambia y ninguna escritura se escapa, tampoco las
que no tocan `modificado_en`. Los repositorios no usan `DELETE`; una prueba lo vigila.

Los disparadores funcionan también sin cuenta: apuntan cambios que nadie lee. Al entrar
en una cuenta la cola se rehace entera según el caso (apartado 8).

## 5. Subida

1. Se leen las filas de `sinc_pendiente`, con su número de cambio, en orden.
2. Cada fila se lee de su tabla, se cifra (apartado 3) y se agrupa en lotes de 100.
3. Cada lote se envía con un `upsert` sobre `(user_id, tabla, id)`. El servidor devuelve
   la `actualizada_en` que ha puesto a cada fila.
4. Por cada fila confirmada, en una transacción: se apunta su `actualizada_en` en
   `sinc_remota` y se borra su marca de `sinc_pendiente` **solo si el número de cambio
   sigue siendo el que se leyó**. Si la fila volvió a cambiar mientras se subía, la marca
   nueva queda y se sube en el siguiente ciclo.
5. Si un lote falla por un motivo que no es de red, se reintenta fila a fila: la que
   falla se cuenta y se queda pendiente; las demás suben.
6. Si falla la red, se para: todo lo no confirmado sigue pendiente.

Nunca se usa `DELETE` para una fila de datos. Un borrado es una subida más, con
`borrada = true` y el contenido cifrado de la fila borrada.

## 6. Bajada

### 6.1 Cursor con ventana de solape

`actualizada_en` es `now()` de PostgreSQL: el instante en que **empezó** la transacción,
no cuando se confirmó. Una escritura que empezó antes puede confirmarse después que otra
más reciente. Un cursor ingenuo («dame lo posterior a lo último que vi») se la saltaría.

El motor guarda como cursor la mayor `actualizada_en` que ha recibido y pide siempre
desde **cursor − 5 minutos**. Lo que vuelve a llegar dentro de la ventana no cuesta casi
nada: si su marca coincide con la de `sinc_remota`, se descarta sin descifrar. Aplicar es
idempotente.

La ventana cubre cualquier escritura que tarde menos de 5 minutos en confirmarse. Las
escrituras de esta app son una sola sentencia y el rol `authenticated` de Supabase tiene
un tiempo máximo por sentencia de segundos, así que el margen es amplio. Para lo que
quede fuera está el repaso completo (6.4).

Demostrado con prueba: dos escrituras confirmadas fuera de orden contra PostgreSQL de
verdad; con la ventana llegan las dos, y con ventana cero la prueba comprueba que una se
pierde (así se sabe que la prueba ejercita el caso).

### 6.2 Paginación

Se pide por páginas de 500 filas ordenadas por `(actualizada_en, tabla, id)` y cada
página empieza justo después de la última fila de la anterior (paginación por clave, no
por posición). Con paginación por posición, una fila que cambia mientras se pagina
desplaza a las demás y una se queda sin leer. Un lote subido de una vez comparte marca de
tiempo; por eso la clave incluye `tabla` e `id`.

Las marcas de tiempo del servidor se guardan y se reenvían como texto, con sus
microsegundos. No se convierten a fecha de JavaScript, que solo tiene milisegundos, salvo
para restar la ventana (redondear ahí solo la agranda).

### 6.3 Aplicación

Todas las filas de una bajada se descifran y luego se aplican en **una transacción**,
junto con el cursor nuevo. Por cada fila:

1. Si su `actualizada_en` es la que ya consta en `sinc_remota`: nada.
2. Si no se puede descifrar o validar: se retiene como ilegible (7.3). No se aplica ni se
   borra del servidor.
3. Si la fila local tiene un cambio pendiente de subir: no se aplica. La versión local se
   subirá y ganará (apartado 7.1).
4. Si es igual a la fila local: solo se apunta la marca.
5. Si no: se escribe en su tabla (alta o cambio de todas las columnas).

Las filas se aplican en el orden de dependencia de las tablas, y las que fallan por una
clave ajena se reintentan en la misma transacción hasta que una vuelta no avanza (así una
categoría hija puede llegar antes que su madre). La que sigue sin poder aplicarse se
retiene y se reintenta en cada ciclo.

Aplicar una fila remota dispara el mismo disparador que un cambio local. El motor quita
esa marca en la misma transacción: una fila recién bajada no se vuelve a subir.

### 6.4 Repaso completo

Además del cursor, el motor hace un repaso completo en «Sincronizar ahora» y, solo, si el
último tiene más de siete días: pide **solo los metadatos** de todas las filas (`tabla`,
`id`, `actualizada_en`; sin contenido) y los compara con `sinc_remota`:

- Fila con marca distinta o desconocida: se baja y se aplica como en 6.3.
- Fila con marca **anterior** a la conocida: no se aplica; se vuelve a subir la local y
  se cuenta como revertida.
- Fila que este dispositivo subió o bajó y el servidor ya no lista: se vuelve a subir y
  se cuenta como desaparecida.

El repaso cierra el hueco de la ventana y permite notar un servidor restaurado desde una
copia antigua. No protege de un servidor que mienta a propósito (apartado 10).

## 7. Conflictos, borrados y filas que no se aplican

### 7.1 Conflictos: gana la última escritura que llega al servidor

Por fila, sin fusionar campos. El ciclo es **subir y luego bajar**. Efecto, sin suavizar:

> Si dos dispositivos cambian la misma fila sin conexión, se conserva la versión del que
> sincroniza **después**; la otra se pierde entera, sin aviso. Vale también si uno la
> borró: si el otro la cambió y sube después, la fila reaparece.

No decide el reloj de ningún dispositivo: decide el orden de llegada al servidor.

### 7.2 Dos filas distintas que no pueden convivir

Algunas tablas tienen una regla de unicidad entre filas no borradas (un presupuesto por
mes, un valor por cuenta y día, una línea por categoría, un alias por texto, una regla por
comercio). Dos dispositivos sin conexión pueden crear cada uno la suya, con ids distintos.
«Gana la última» no lo resuelve, porque son filas distintas.

Regla, igual en todos los dispositivos para que acaben igual: **se conserva la de id
menor; la otra se marca como borrada** (borrado lógico, que se sube como cualquier otro).
Lo que colgara de la perdedora (las líneas de un presupuesto) queda sin mostrar. Es una
pérdida, rara, y está en los riesgos.

### 7.3 Filas retenidas

Una fila remota que no se puede aplicar se guarda en `sinc_retenida` y se cuenta en
Cuenta. No se borra del servidor y no detiene a las demás.

| Motivo | Cuándo | Qué pasa después |
|---|---|---|
| `ilegible` | El sobre no se abre con la clave y los datos autenticados que tocan, o lo que hay dentro no es una fila válida | Se queda contada. Se resuelve si llega una versión nueva de esa fila o si este dispositivo la sube |
| `no_aplicable` | Se abre, pero la base la rechaza (clave ajena, restricción) o trae columnas que esta versión no conoce | Se guarda el sobre y se reintenta en cada ciclo |

## 8. Entrada en una cuenta

La base local se **liga** a una cuenta (`sinc_estado.usuario`). El motor no sube ni baja
nada mientras la base no esté ligada a la cuenta de la sesión. Ligar es el resultado de
esta decisión, que se toma con conexión justo después de iniciar sesión (y también al
arrancar, si hay una sesión del 4b-1 sin ligar):

| Nube | Dispositivo | Qué se hace |
|---|---|---|
| — | Ya ligado a esta misma cuenta | Se continúa: es la misma copia. Lo cambiado sin sesión se sube como un cambio hecho sin conexión |
| Vacía | Lo que sea | Se liga y se marca **todo** como pendiente: se sube |
| Con datos | Sin datos del usuario | Se quitan las categorías iniciales intactas, se liga y se baja todo |
| Con datos | Con datos del usuario | **No se fusiona.** La app pregunta |

**Qué cuenta como «sin datos del usuario».** Las otras once tablas están vacías y todas
las categorías son *iniciales intactas*: su nombre y tipo coinciden con una de las
categorías iniciales del catálogo de textos, nunca se han modificado
(`modificado_en = creado_en`), no están borradas ni archivadas y no tienen madre, icono
ni color. Una categoría creada a mano con el mismo nombre que una inicial y sin tocar es
indistinguible, y también equivalente: quitarla no pierde nada. Reordenar, renombrar o
personalizar una categoría la convierte en dato del usuario.

**La pregunta.** «Usar los datos de la nube» o «Cancelar».

- *Cancelar:* se cierra la sesión. No cambia ningún dato, ni local ni remoto.
- *Usar los datos de la nube:* (1) se exporta lo local a un fichero y se abre la hoja de
  compartir; si la persona la cierra sin guardar, no se sigue. (2) Se baja y se descifra
  **toda** la nube en memoria. (3) En una sola transacción se vacían las tablas locales,
  se escriben las filas bajadas y se liga la base. Si la bajada falla, no se ha tocado
  nada local.

Nunca se sube lo local encima de la nube en este caso.

Si la app se cierra con la pregunta abierta, al volver sigue habiendo sesión y la base
sigue sin ligar: la pregunta vuelve a salir y no se ha sincronizado nada.

Al cerrar sesión los datos locales se conservan y la base sigue ligada, para poder
continuar al volver a entrar. Al borrar la cuenta se desliga.

## 9. Cambio de contraseña y de parámetros

### 9.1 El problema

Hay dos cosas en el servidor que dependen de la contraseña y no se pueden cambiar a la
vez: la contraseña de Supabase Auth (la subclave de autenticación) y el sobre
`clave_por_contrasena`. Si se cambia una y la app se corta antes de cambiar la otra,
ninguna contraseña serviría por sí sola.

### 9.2 La solución: dos sobres durante el cambio

`clave_por_contrasena` admite entre 98 y 400 caracteres y un sobre de clave ocupa
exactamente 98. Durante el cambio la columna lleva **dos sobres seguidos** (196
caracteres): primero el nuevo y después el anterior. No cambia el esquema ni el formato
del sobre; cambia cuántos sobres caben en la columna.

| Paso | Supabase Auth | `clave_por_contrasena` | Qué contraseña abre la cuenta |
|---|---|---|---|
| 0 | anterior | [anterior] | La anterior |
| 1. Se escriben los dos sobres | anterior | [nuevo][anterior] | La anterior |
| 2. Se cambia la contraseña de Auth | nueva | [nuevo][anterior] | La nueva |
| 3. Se deja solo el sobre nuevo | nueva | [nuevo] | La nueva |

En cada estado **exactamente una** contraseña abre la cuenta entera, ella sola. No hay
ventana en la que la cuenta quede inaccesible.

Antes del paso 1 se pide la contraseña actual y se comprueba iniciando sesión con ella
(además, así la sesión es reciente). La clave de datos no cambia: no se recifra ninguna
fila.

### 9.3 Cómo se termina un cambio cortado

- **Al iniciar sesión** en cualquier dispositivo: si la columna trae dos sobres, se
  prueba a abrir cada uno con la clave de la contraseña con la que se ha entrado. Si abre
  el primero, el cambio había pasado del paso 2: se completa el paso 3. Si abre el
  segundo, no había llegado al paso 2: se deshace el paso 1 (se deja solo el sobre
  anterior).
- **Al repetir el cambio** en el dispositivo donde se cortó: si la contraseña actual ya
  no entra pero la nueva sí, es que el paso 2 se hizo y se perdió la respuesta: se
  completa el paso 3 y se informa de que el cambio está hecho.

### 9.4 Actualización de parámetros de derivación

La cuenta guarda `version_de_derivacion`. La app conoce los parámetros de cada versión.
Al iniciar sesión se prueba primero la versión actual y, si el servidor la rechaza, las
anteriores. Si se entra con una anterior, justo después se rehace la envoltura con los
parámetros actuales por el mismo mecanismo de tres pasos (misma contraseña, claves
nuevas) y se guarda la versión nueva.

Hoy solo existe la versión 1 (64 MiB, 8 pasadas) y no cambia. La versión 2 existe solo
en las pruebas, para demostrar el mecanismo.

Coste: mientras existan cuentas en una versión anterior, una contraseña mal escrita
gasta un intento de inicio de sesión por versión.

### 9.5 Otras sesiones

Tras cambiar la contraseña, los demás dispositivos conservan la clave de datos en su
llavero y sus datos locales. Su sesión deja de valer cuando el servidor la rechace;
entonces Cuenta pide volver a entrar. Al entrar con la contraseña nueva la base ya está
ligada a esa cuenta y la sincronización continúa.

## 10. Qué ve y qué puede hacer el servidor

### 10.1 Qué ve

- El correo, cuándo se creó la cuenta y cuándo se usa.
- Por cada fila: de qué tabla es, su id, el tramo de tamaño (múltiplos de 256 bytes), si
  está marcada como borrada y cuándo cambió por última vez.
- Por tanto: cuántas cuentas, movimientos, objetivos… tiene cada persona, a qué hora los
  apunta, con qué frecuencia y desde qué dirección IP.

No ve ningún campo de ninguna fila: ni importes, ni nombres, ni fechas de los
movimientos, ni a qué cuenta o categoría pertenecen.

### 10.2 Qué puede hacer un servidor comprometido, y qué nota la app

Esto **no se resuelve en este bloque**. Queda para la auditoría del 4c.

| Qué hace el servidor | ¿Lo nota la app? |
|---|---|
| Leer el contenido de una fila | No puede: va cifrado |
| Alterar un sobre, o moverlo a otra fila, tabla o usuario | **Sí.** No se abre; se retiene y se cuenta en Cuenta |
| Contar filas y ver cuándo cambian | No se puede evitar con este diseño |
| Negarse a guardar (responder con error) | **Sí.** Los cambios se quedan pendientes y Cuenta lo dice |
| Decir que ha guardado y no guardar | **Solo en el repaso completo**, como fila desaparecida, y solo en el dispositivo que la subió |
| Ocultar una fila a un dispositivo que nunca la ha visto | **No.** Ese dispositivo no sabe que existe |
| Ocultar una fila a un dispositivo que ya la conoce | **Solo en el repaso completo** (y la vuelve a subir) |
| Devolver una versión antigua de una fila con su marca antigua | **Solo en el repaso completo**, si ese dispositivo conocía una marca posterior |
| Devolver una versión antigua con una marca de tiempo nueva | **No.** El sobre antiguo es auténtico y la marca de tiempo no va autenticada. Es la reversión que el diseño no detecta |
| Cambiar la marca `borrada` | No tiene efecto: decide el contenido |
| Reordenar o retrasar la entrega | No. Puede hacer que gane una escritura distinta de la última |
| Devolver un sobre antiguo de `clave_por_contrasena` | No. Quien conozca una contraseña anterior **y** tenga ese sobre antiguo puede abrir la clave de datos: cambiar la contraseña no cambia la clave de datos |
| Borrar todo | Se nota como filas desaparecidas en el repaso; los datos siguen en los dispositivos |

Lo que haría falta para cerrar la reversión (un contador de versión por fila dentro del
contenido cifrado y memoria local del último visto, o un resumen autenticado del conjunto)
se deja planteado para el 4c.

## 11. Cuándo se sincroniza

Al abrir la app, al volver de segundo plano, tres segundos después del último cambio
local (los cambios seguidos se agrupan) y con «Sincronizar ahora». Nunca con la app
cerrada. Solo hay un ciclo a la vez; si se pide otro mientras tanto, se hace uno más al
terminar.

Si un ciclo falla se reintenta con espera creciente (5 s, 15 s, 1 min, 5 min, y cada 5
min), mientras la app esté abierta. Un ciclo correcto pone la espera a cero.

Cuenta muestra: la última sincronización correcta, cuántos cambios hay pendientes,
cuántas filas remotas no se han podido aplicar y, si algo falla, un mensaje sin detalles
internos: sin conexión, sesión caducada o error del servidor.

## 12. Riesgos que quedan

1. **Se pierde la escritura que llega antes** cuando dos dispositivos cambian la misma
   fila sin conexión (7.1). Sin aviso.
2. **Regla de unicidad** (7.2): una de las dos filas se borra y lo que colgaba de ella
   deja de verse.
3. **Reversión no detectable** por un servidor malicioso (10.2).
4. **Metadatos visibles** (10.1).
5. **La clave de datos no rota.** Quien la haya obtenido una vez descifra todo lo pasado
   y lo futuro. Cambiar la contraseña no lo arregla.
6. **Dos dispositivos nuevos que entran a la vez** en una cuenta vacía suben cada uno sus
   categorías iniciales: quedan duplicadas. No se detecta.
7. **Un dispositivo ajeno que entra en una cuenta vacía sube sus datos locales** a esa
   cuenta (es lo que dice D-h). Si otra persona inicia sesión en un teléfono con datos de
   otra, y su nube está vacía, esos datos acaban en su cuenta.
8. **La base local sigue sin cifrar** (4b-3), y la exportación es un fichero en claro.
9. **Filas de una versión futura de la app** se retienen en las versiones antiguas, que
   no las muestran hasta actualizarse.
10. **Una transacción que tarde más de 5 minutos en confirmarse** solo se recoge en el
    repaso completo.
