# Diseño criptográfico · bloque 4b-1

Fecha: 18/11/2026. Describe lo que hace `src/cripto/`. Está escrito para que una persona
experta pueda revisarlo sin leer el código, y para que cualquiera pueda repetir los vectores
de prueba con libsodium.

**Estado:** el diseño está construido y probado. **Los parámetros de Argon2id son
provisionales** (apartado 3.2). Nadie ajeno al proyecto ha revisado este diseño.

**Regla del proyecto:** la app no implementa ninguna primitiva criptográfica. Todo son
llamadas a libsodium. Lo único propio es el orden de las llamadas, los formatos y la
escritura del código de recuperación en base32, que no es criptografía.

## 1. Qué se quiere conseguir

1. El servidor nunca ve datos financieros en claro, ni puede descifrarlos.
2. La contraseña no sale del dispositivo. Al servidor llega una clave derivada de ella que
   no sirve para descifrar nada.
3. Quien pierde la contraseña pero conserva el código de recuperación no pierde sus datos.
4. Un contenido cifrado alterado, truncado o presentado en otro sitio se rechaza.
5. Todo lleva versión, para poder cambiar de algoritmo o de parámetros sin romper lo guardado.

Lo que **no** se consigue está en el apartado 9.

## 2. Biblioteca

| | |
|---|---|
| Biblioteca | libsodium 1.0.22 |
| En iOS y Android | `react-native-libsodium` **1.7.0** (versión exacta), que lleva libsodium compilada |
| En navegador y en las pruebas | `libsodium-wrappers-sumo` **0.8.4** (versión exacta), la misma libsodium en WebAssembly. Hace falta la variante «sumo»: es la que incluye Argon2id |
| Único punto de carga | `src/cripto/sodio.ts`. Una prueba falla si otro fichero importa la biblioteca |

### 2.1 Parche del paquete nativo

`react-native-libsodium` 1.7.0 no compila para iOS con React Native 0.88. Se le aplica un
parche de tres sustituciones en un fichero (`ios/Libsodium.mm`), el mismo cambio propuesto
en su repositorio (PR #109). **No toca criptografía**: solo cómo se entrega el motor de
JavaScript al código que llama a libsodium. Está entero, comentado y con sus condiciones de
retirada en `plugins/parche-libsodium.js`. Solo se aplica si la huella SHA-256 del fichero
es la del original; se comprueba también la del resultado.

Como defensa añadida, la app se comprueba a sí misma (apartado 8).

### 2.2 Límites de la versión nativa del paquete

La versión nativa admite menos tipos de dato que la de WebAssembly. El módulo se ciñe a lo
que admiten las dos, y una prueba («límites del paquete en nativo») falla si deja de hacerlo:

| Función | Límite en nativo | Qué hace el módulo |
|---|---|---|
| `crypto_aead_xchacha20poly1305_ietf_encrypt` y `_decrypt` | Los datos autenticados solo pueden ser **texto**; con bytes lanza un error | Los datos autenticados son siempre un texto ASCII (apartado 5) |
| `crypto_aead_xchacha20poly1305_ietf_decrypt` | El contenido cifrado solo puede ser **bytes** | Siempre pasa bytes |
| `crypto_generichash` (BLAKE2b) | La clave solo puede ser **bytes**; no admite texto | Mensaje y clave se pasan siempre como bytes (UTF-8) |

Tampoco existen en nativo `memzero`, `from_hex` ni las constantes `MODERATE` de Argon2id. El
módulo no las usa: borra las claves poniendo sus bytes a cero y escribe los parámetros como
números.

## 3. Jerarquía de claves

```
correo ──normalizar──► BLAKE2b(16 bytes, clave = constante de sal) ──► sal
contraseña (NFKC, UTF-8) + sal ──Argon2id──► CLAVE MAESTRA (32 bytes)   [no sale del dispositivo]
   ├─ crypto_kdf(id 1, "FCautent") ──► subclave de autenticación        [va al servidor]
   └─ crypto_kdf(id 2, "FCenvolt") ──► subclave de envoltura            [no sale del dispositivo]

secreto de recuperación (32 bytes aleatorios)                           [solo en el código, en papel]
   └─ crypto_kdf(id 1, "FCrecupe") ──► clave de recuperación

CLAVE DE DATOS (32 bytes aleatorios, generada en el alta)               [solo en el llavero]
   ├─ cifrada con la subclave de envoltura  ──► sobre «por contraseña»   [servidor]
   └─ cifrada con la clave de recuperación  ──► sobre «por recuperación» [servidor]
```

La clave de datos es la que cifrará las filas en el bloque 4b-2. Como no depende de la
contraseña, cambiar la contraseña solo obliga a rehacer un sobre, no a recifrar los datos.

### 3.1 Sal

- Correo normalizado: forma Unicode NFKC, sin espacios en los extremos, en minúsculas.
- `sal = crypto_generichash(16, UTF-8(correo normalizado), UTF-8("FinancialControl/sal-de-cuenta/v1"))`
- 16 bytes es `crypto_pwhash_SALTBYTES`.

La sal **no es secreta ni aleatoria**: se calcula del correo (decisión D-c del encargo).
Ventaja: no hace falta preguntar al servidor antes de iniciar sesión, así que no hay una
petición que revele si un correo está registrado. Coste: dos personas no pueden compartir
sal (los correos son únicos), pero quien conozca el correo de alguien puede empezar a
precalcular contraseñas para esa persona antes de robar nada. Y el correo de una cuenta no
se puede cambiar.

### 3.2 Clave maestra: Argon2id

`maestra = crypto_pwhash(32, UTF-8(NFKC(contraseña)), sal, opslimit, memlimit, crypto_pwhash_ALG_ARGON2ID13)`

| Parámetro | Valor | |
|---|---|---|
| Algoritmo | Argon2id, versión 1.3 (`ALG_ARGON2ID13` = 2) | |
| `opslimit` (pasadas) | **8** | |
| `memlimit` (memoria) | **67108864 bytes (64 MiB)** | |
| Paralelismo | 1 | libsodium no permite otro |
| Salida | 32 bytes | |
| Versión de derivación | 1 | Se guarda con la cuenta |

Referencia: la guía de almacenamiento de contraseñas de OWASP (consultada el 18/11/2026)
da como mínimos equivalentes para Argon2id, entre otros, **19 MiB con 2 pasadas** y
**46 MiB con 1 pasada**, con paralelismo 1. Los valores elegidos superan los dos: más
memoria que el mayor y cuatro veces las pasadas del otro. Los valores `INTERACTIVE` de
libsodium son 64 MiB y 2 pasadas; aquí se usa la misma memoria y cuatro veces las pasadas.

**PROVISIONALES.** Decididos por el dueño el 18/11/2026: 64 MiB y no más porque la primera
versión pública será web y no está probado que un navegador de móvil conceda más memoria.
No se han medido en un iPhone ni en un navegador de móvil. **Deben medirse y fijarse antes
de crear la primera cuenta real**: cambiarlos después exige una versión de derivación nueva
y que cada persona vuelva a escribir su contraseña.

Tiempo medido, en el procesador de un Mac (no es el de un teléfono): ver
`docs/estado.md`, apartado 14. El objetivo del encargo era entre 0,5 y 2 segundos; en el Mac
queda por debajo de 0,5. En un teléfono será mayor. La pantalla Ajustes › Diagnóstico mide
el tiempo en el dispositivo.

La contraseña se pasa a NFKC para que la misma contraseña dé lo mismo aunque un teclado
escriba «é» como una letra y otro como letra más acento. No se recorta ni se cambia nada más.

### 3.3 Subclaves

`subclave = crypto_kdf_derive_from_key(32, número, contexto, clave)`

| Subclave | Clave de origen | Número | Contexto (8 caracteres) |
|---|---|---|---|
| Autenticación | Clave maestra | 1 | `FCautent` |
| Envoltura | Clave maestra | 2 | `FCenvolt` |
| Recuperación | Secreto del código | 1 | `FCrecupe` |

`crypto_kdf` es la función de libsodium para sacar varias claves de una; por dentro usa
BLAKE2b con el número y el contexto. Conocer una subclave no permite calcular la clave de
origen ni otra subclave. Cada contexto se usa para una sola cosa; una prueba lo vigila.

La subclave de autenticación se envía a Supabase Auth como si fuera la contraseña, escrita
en base64 para URL sin relleno (43 caracteres). Supabase la guarda con su propio hash.

## 4. Cifrado

XChaCha20-Poly1305 en su construcción IETF
(`crypto_aead_xchacha20poly1305_ietf_encrypt` / `_decrypt`): clave de 32 bytes, nonce de 24
bytes y etiqueta de autenticación de 16 bytes.

- **Nonce:** 24 bytes de `randombytes_buf` en cada cifrado. Con 192 bits aleatorios la
  documentación de libsodium considera seguro elegirlo al azar; no hay contador que guardar.
- **Aleatoriedad:** solo `randombytes_buf` de la biblioteca. Una prueba comprueba que no se
  usan `Math.random` ni la fecha.

## 5. Formato del sobre

Todo contenido cifrado es un sobre. Byte a byte:

| Posición | Longitud | Contenido |
|---|---|---|
| 0 | 1 | Versión del formato. Hoy **1** |
| 1 | 24 | Nonce |
| 25 | n | Contenido cifrado |
| 25 + n | 16 | Etiqueta Poly1305 |

Se guarda y se envía en **base64 para URL, sin relleno**. Longitud mínima: 41 bytes (55
caracteres). Una clave de datos envuelta ocupa 73 bytes (98 caracteres).

**Datos autenticados** (no van dentro del sobre; los recalcula quien abre): el texto ASCII

```
FC<versión>|<uso>
```

donde `<uso>` dice para qué es el sobre, en caracteres ASCII visibles sin espacios:

| Uso | Para qué |
|---|---|
| `clave-de-datos/contrasena` | Clave de datos envuelta con la subclave de envoltura |
| `clave-de-datos/recuperacion` | Clave de datos envuelta con la clave de recuperación |
| `fila/<tabla>/<id>` | (4b-2) Una fila. Así el servidor no puede cambiar una fila por otra |

Con la versión dentro de los datos autenticados, cambiar el byte de versión invalida el
sobre. Un sobre con una versión que el código no conoce se rechaza sin intentar abrirlo.

**Al abrir**, cualquier fallo (clave equivocada, un bit cambiado en cualquier parte, sobre
truncado, versión desconocida, base64 inválido, uso distinto) produce el mismo error,
`ErrorDeCripto`, con el mismo mensaje y sin causa. No se devuelve ningún dato parcial.

## 6. Código de recuperación

| | |
|---|---|
| Secreto | 32 bytes (256 bits) de `randombytes_buf` |
| Control | Los 3 primeros bytes de `crypto_generichash(16, secreto, UTF-8("FinancialControl/control-de-codigo/v1"))` |
| Escritura | Secreto + control = 35 bytes = 280 bits = **56 símbolos de base32 de Crockford**, en **14 grupos de 4** separados por guiones |
| Alfabeto | `0123456789ABCDEFGHJKMNPQRSTVWXYZ`: sin I, L, O ni U |

- Al leerlo se admiten minúsculas, espacios y guiones de más o de menos, y se toma la O por
  0 y la I y la L por 1.
- El control (24 bits) detecta erratas: una errata cualquiera pasa inadvertida con
  probabilidad de 1 entre 16 millones. Las pruebas cambian cada uno de los 56 símbolos,
  intercambian dos, y quitan y añaden uno. El control **no es un secreto ni protege de
  nadie**: solo sirve para decir «lo has copiado mal».
- El secreto es directamente la clave de origen de `crypto_kdf` (apartado 3.3). Por eso
  tiene 256 bits y no los 160 mínimos del encargo: así no hace falta ningún paso propio
  para estirarlo.
- Se enseña una vez, en el alta. No se guarda en el dispositivo ni se envía al servidor.

## 7. Qué se guarda y dónde

| Dato | Dispositivo | Servidor |
|---|---|---|
| Contraseña | En memoria mientras se escribe. Nunca en disco | Nunca |
| Clave maestra | En memoria durante la derivación; se borra al acabar | Nunca |
| Subclave de envoltura | En memoria durante el alta o el inicio de sesión | Nunca |
| Subclave de autenticación | En memoria durante la petición | Supabase Auth guarda su hash |
| Clave de datos | **Llavero del sistema** (`expo-secure-store`, accesible tras el primer desbloqueo, solo en este dispositivo, sin biometría) | Solo envuelta, en los dos sobres |
| Sesión de Supabase | Llavero del sistema | — |
| Código de recuperación | En memoria durante el alta. Nunca en disco | Nunca |
| Correo de la cuenta abierta | Llavero del sistema, junto a la clave. No es un secreto; se guarda para saber qué cuenta está abierta sin preguntar al servidor | En claro: identifica la cuenta |
| Datos financieros | Base local SQLite, **sin cifrar** (se cifra en 4b-2) | En este bloque, nada |

En web no hay llavero. La interfaz de almacenamiento es abstracta
(`src/lib/almacenSeguro.ts`) y la decisión de dónde guardar la clave en un navegador queda
**pendiente para el bloque de la web**, sin resolver.

### Qué ve el servidor

Ve: el correo, cuándo se creó la cuenta y cuándo se inicia sesión, la subclave de
autenticación (con su hash), los dos sobres de la clave de datos y, desde 4b-2, por cada
fila: de qué tabla es, su identificador, su tamaño aproximado, si está borrada y cuándo
cambió.

No ve: la contraseña, la clave maestra, la clave de datos, el código de recuperación ni el
contenido de ninguna fila.

## 8. Autocomprobación

Antes de permitir cualquier operación de cuenta, la app calcula con la biblioteca que tiene
delante un subconjunto de los vectores del apartado 10 (clave maestra, las dos subclaves,
apertura de los dos sobres, lectura del código, una ida y vuelta de cifrado y el rechazo de
un sobre presentado para otro uso) y los compara con los valores conocidos
(`src/cripto/autocomprobacion.ts`). Si algo no coincide, las funciones de cuenta quedan
desactivadas con un mensaje y el resto de la app sigue funcionando en local.

La comprobación incluye una derivación completa con Argon2id, así que ocupa la app
durante lo que tarde esa derivación la primera vez que se abre Cuenta o Diagnóstico.

Protege de: un enlace nativo roto, una biblioteca distinta de la esperada, o parámetros que
no son los de los vectores. No protege de una biblioteca maliciosa hecha para pasar la
comprobación.

## 9. Qué pasa en cada pérdida, y riesgos que quedan

| Se pierde | Se conserva | Resultado |
|---|---|---|
| Contraseña | Código | (4b-2) Se abre la clave de datos con el código y se pone una contraseña nueva. **En este bloque no está construido** |
| Contraseña | Un dispositivo con sesión y datos | Los datos locales siguen ahí. Puede crear otra cuenta. La cuenta antigua queda inaccesible |
| Código | Contraseña | Todo funciona. (4b-2) Podrá generarse un código nuevo |
| Dispositivo | Contraseña | Se inicia sesión en otro. En este bloque no hay datos que recuperar; desde 4b-2, se descargan y se descifran |
| Dispositivo | Solo el código | Como «contraseña perdida con código» |
| Contraseña y código | Un dispositivo con datos | Los datos locales siguen ahí; lo del servidor es irrecuperable |
| Contraseña, código y dispositivos | Nada | **Los datos se pierden para siempre.** Nadie puede recuperarlos: ni el dueño del servicio ni Supabase. No hay restablecimiento por correo |

Riesgos del diseño, sin suavizar:

1. **Quien obtenga los sobres del servidor puede probar contraseñas sin límite**, a la
   velocidad que le permita Argon2id. La defensa es la contraseña (mínimo 12 caracteres) y
   el coste de Argon2id, que es **provisional y bajo** (64 MiB). Una contraseña débil caerá.
2. **La subclave de autenticación equivale a la contraseña para entrar**: quien la robe
   (por ejemplo, de un servidor comprometido que la registre) puede iniciar sesión y
   descargar los sobres. No puede abrirlos sin la contraseña.
3. **La sal es predecible** (apartado 3.1).
4. **Sin confirmación de correo** (beta sin coste): cualquiera puede registrar una cuenta
   con el correo de otra persona. No accede a nada ajeno, pero ocupa ese correo.
5. **El servidor ve metadatos**: cuántas filas tiene cada persona, de qué tabla, y cuándo
   cambian. De ahí se deduce actividad, aunque no importes.
6. **El servidor puede servir una versión antigua de una fila** o no entregar una. El
   cifrado garantiza que la fila es auténtica y de ese sitio, no que sea la última.
7. **JavaScript no garantiza el borrado de memoria.** Las claves se ponen a cero al terminar,
   pero la contraseña es un texto y los textos no se pueden borrar; el motor puede haber
   hecho copias.
8. **La base local sigue sin cifrar** hasta 4b-2.
9. **El paquete nativo de libsodium lleva un parche propio** y sus autores no responden a la
   incidencia. Ver `docs/seguridad/riesgo-de-dependencia-libsodium.md`.
10. **En web, el código lo sirve el servidor en cada visita.** Quien controle el alojamiento
    puede servir un código que robe la contraseña. El cifrado de extremo a extremo en un
    navegador no protege del propio servidor de la web. Para el bloque de la web.

## 10. Vectores de prueba

Se generan con `node scripts/vectores-de-cripto.cjs`, que llama a libsodium directamente sin
pasar por `src/cripto/`, y están en `src/cripto/vectores.json`. Todos los datos son de
ejemplo. Para repetirlos a mano con cualquier libsodium:

**Entradas**

| | |
|---|---|
| Correo tal como se escribe | `"  Ana.Ejemplo@Example.COM "` |
| Correo normalizado | `ana.ejemplo@example.com` |
| Contraseña | `correcta batería caballo grapa` |
| Argon2id | 8 pasadas, 67108864 bytes |
| Clave de datos (hex) | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| Nonce del sobre por contraseña (hex) | `404142434445464748494a4b4c4d4e4f5051525354555657` |
| Nonce del sobre por recuperación (hex) | `606162636465666768696a6b6c6d6e6f7071727374757677` |
| Secreto de recuperación (hex) | `a0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebf` |

En la app los nonces y el secreto son aleatorios; aquí son fijos para poder comparar.

**Pasos y resultados**

1. `sal = crypto_generichash(16, "ana.ejemplo@example.com", clave "FinancialControl/sal-de-cuenta/v1")`
   → `6f3440d8b9ac4d5c9b2c46c5fd3751a1`
2. `maestra = crypto_pwhash(32, contraseña, sal, 8, 67108864, ARGON2ID13)`
   → `657607246a7377dd814e4bf6657110d7596a308808c6307aa3236a5f889b96c9`
3. `autenticación = crypto_kdf_derive_from_key(32, 1, "FCautent", maestra)`
   → `eed1a9a3fc4195e06941c9d0365eac168e53913893d726319763352da3ca4df7`
   → en base64 para URL: `7tGpo_xBleBpQcnQNl6sFo5TkTiT1yYxl2M1LaPKTfc`
4. `envoltura = crypto_kdf_derive_from_key(32, 2, "FCenvolt", maestra)`
   → `570542abd45d5de92d8a3d5bfdedfed4cb47b6d7c89778292db2af8c631061bd`
5. Sobre por contraseña: `0x01 ‖ nonce ‖ encrypt(clave de datos, datos autenticados "FC1|clave-de-datos/contrasena", nonce, envoltura)`
   → `AUBBQkNERUZHSElKS0xNTk9QUVJTVFVWV4TCrhQa3YoAiWrC9Q06GD44JtaeiaQ8rjpbyRoB5SaRNntBf_bU3BrSCBiI_2WH5w`
6. `control = crypto_generichash(16, secreto, clave "FinancialControl/control-de-codigo/v1")[0..3]`
   → `f1fd03`
7. Código: base32 de Crockford de `secreto ‖ control`
   → `M2GT-58X4-MPKA-FA59-NANT-SBDE-NYRB-3CNK-PJTV-DDXR-Q6XB-QF5X-QTZZ-3Z83`
8. `clave de recuperación = crypto_kdf_derive_from_key(32, 1, "FCrecupe", secreto)`
   → `d56b16ed216ba4a3b2ec1369b74e9af9405e425c6b44acaf967ac2fdf1de97d8`
9. Sobre por recuperación: `0x01 ‖ nonce ‖ encrypt(clave de datos, "FC1|clave-de-datos/recuperacion", nonce, clave de recuperación)`
   → `AWBhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d6ONvORfCg6j2VdIUH200O_uZDGXJRsVyjcDc3joH8q79qpJ4Z5DFFeULsGYUMAtKA`

Las pruebas (`src/cripto/__tests__/cripto.test.ts`) comprueban que el módulo de la app da
estos mismos valores, y la autocomprobación lo repite en el dispositivo.

## 11. Referencias

Consultadas el 18/11/2026.

- libsodium, `crypto_pwhash`: https://doc.libsodium.org/password_hashing/default_phf
- libsodium, derivación de subclaves (`crypto_kdf`): https://doc.libsodium.org/key_derivation
- libsodium, XChaCha20-Poly1305: https://doc.libsodium.org/secret-key_cryptography/aead/chacha20-poly1305/xchacha20-poly1305_construction
- libsodium, `crypto_generichash` (BLAKE2b): https://doc.libsodium.org/hashing/generic_hashing
- OWASP, Password Storage Cheat Sheet, apartado Argon2id: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- react-native-libsodium: https://github.com/serenity-kit/react-native-libsodium (PR #109, incidencia #110)
- expo-secure-store (SDK 58): https://docs.expo.dev/versions/v58.0.0/sdk/securestore/
- Base32 de Crockford: https://www.crockford.com/base32.html
