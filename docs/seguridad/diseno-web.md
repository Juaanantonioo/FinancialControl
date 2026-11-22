# Diseño de la versión web · bloque 5

Fecha: 22/11/2026. Describe cómo funciona FinancialControl en un navegador. Se apoya en
`diseno-criptografico.md` (claves y sobres) y `diseno-sincronizacion.md` (motor), que no
cambian: la web usa el mismo código de dominio, datos, cifrado y sincronización que iOS.

**Estado:** construido y probado en un navegador real automatizado contra una instancia
local de Supabase. No está desplegado. Nadie ajeno al proyecto lo ha revisado.

## 1. Qué es y qué no es

La web es un **sitio estático**: ficheros HTML, JavaScript, CSS y WebAssembly que se
exportan con `npx expo export -p web` y se sirven tal cual. No hay servidor propio. El
navegador habla con dos sitios y solo con dos: el propio origen (para los ficheros) y el
proyecto de Supabase (para la cuenta y los datos cifrados).

En la web **la cuenta es obligatoria**. No hay modo «solo en este navegador»: lo primero
que se ve es entrar o crear cuenta.

## 2. El límite de este modelo, sin suavizar

En la app de iOS, el código que cifra llega una vez, firmado, desde la tienda. En la web,
**el código llega del servidor cada vez que se abre la página**. Quien controle lo que el
servidor entrega (el alojamiento, la cuenta del alojamiento, el dominio o su DNS, o quien
robe esas credenciales) puede entregar un JavaScript distinto que envíe la contraseña o la
clave de datos a donde quiera. El cifrado de extremo a extremo protege los datos **del
servidor de Supabase**; no protege **del servidor que entrega la web**.

Consecuencias:

- En la web, «ni nosotros podemos leer tus datos» es cierto mientras el sitio entregue el
  código publicado. No es una garantía técnica como en iOS: es una promesa de quien opera
  el sitio, más la seguridad de su cuenta de alojamiento.
- La persona no tiene forma práctica de comprobar que el código que recibe es el del
  repositorio.
- Todo lo de este documento (CSP, cabeceras, nada de terceros) reduce las maneras de
  **inyectar** código ajeno. No hace nada contra quien **sustituye** el código propio.

Lo que lo mitigaría y no está hecho: integridad de subrecursos sobre un HTML que no
cambie, una extensión o app que verifique el código, o compilaciones reproducibles
publicadas. Queda para el 4c.

## 3. Qué se guarda en el navegador

| Dato | Dónde | Sobrevive a recargar |
|---|---|---|
| Contraseña | En memoria mientras se escribe y se deriva | No |
| Clave maestra, subclaves | En memoria durante la derivación | No |
| Clave de datos | **En memoria** (`almacenSeguroNativo.web.ts`: un `Map`) | No |
| Sesión de Supabase (tokens) | **En memoria**, en el mismo almacén | No |
| Datos financieros descifrados | **En memoria**: SQLite abierto como `:memory:` | No |
| Correo de la última entrada | `localStorage` (`fc.correo`), para rellenar el formulario | Sí |
| Apariencia (automática, clara, oscura) | `localStorage` (`fc.apariencia`) | Sí |

Nada más. Ni `sessionStorage`, ni IndexedDB, ni cookies, ni Cache Storage, ni service
worker. **Recargar o cerrar la pestaña obliga a escribir la contraseña otra vez**, y los
datos se bajan y se descifran de nuevo.

**Una excepción que no contiene datos:** al arrancar, `expo-sqlite` crea en OPFS (el
sistema de ficheros privado del origen) una carpeta `expo-sqlite/` con seis ficheros de
4.096 bytes. Son la reserva de su almacén persistente, que esta app no usa: la base se
abre con el nombre `:memory:` y va por su almacén en memoria. No se puede evitar sin
modificar la biblioteca. Una prueba lee esos ficheros byte a byte tras usar la app y
comprueba que no contienen ningún dato, clave ni sobre.

Qué significa «en memoria» y qué no: un script que se ejecute en la página puede leer la
memoria de la página. Tener la clave solo en memoria evita que quede en disco, que la lea
otra pestaña más tarde o que sobreviva a cerrar el navegador. No la protege de código
malicioso que corra en la propia página: de eso se ocupan los apartados 2 y 6.

## 4. Base de datos en memoria

**Elegida: `expo-sqlite` para web, abierta como `:memory:`** (`src/datos/bdExpo.web.ts`).
Es SQLite compilado a WebAssembly que corre en un *worker*.

| Opción | Valoración |
|---|---|
| `expo-sqlite` web, `:memory:` | **Elegida.** Ya es dependencia del proyecto. Mismo SQL, mismas migraciones y mismos disparadores que en iOS. Cumple el contrato `BaseDeDatos` sin tocar `src/datos/` |
| `expo-sqlite` web con fichero | Descartada: persiste los datos en claro en OPFS |
| Otro SQLite en WebAssembly (sql.js…) | Descartada: dependencia nueva, y no hace falta |
| Reescribir los repositorios sobre objetos en memoria | Descartada: duplicaría `src/datos/`, que el encargo prohíbe |

Comprobado en una compilación real: el sitio exportado arranca, aplica las cinco
migraciones y las pantallas leen y escriben.

Lo que exige:

- **Aislamiento entre orígenes** (`Cross-Origin-Opener-Policy: same-origin` y
  `Cross-Origin-Embedder-Policy`), porque usa `SharedArrayBuffer`. La documentación de
  Expo propone `credentialless`; aquí se usa `require-corp`, más estricto, porque el sitio
  no carga nada de otro origen.
- **WebAssembly** permitido en la CSP (`'wasm-unsafe-eval'`).
- **Un worker creado desde una URL `blob:`**. Lo hace el propio empaquetador de Expo
  cuando la página está aislada: envuelve el worker en un `blob:` que solo hace
  `importScripts` del fichero del propio origen. Ver apartado 6.

La única implementación de repositorios, migraciones y motor es la de siempre. Lo único
propio de la web es el fichero que abre la base.

## 5. Cifrado en la web

`src/cripto/sodio.web.ts` carga `libsodium-wrappers-sumo` **0.8.4** (versión exacta, ahora
dependencia de producción): la misma libsodium en WebAssembly que ya usaban las pruebas.
El resto de `src/cripto/` es el mismo fichero en todas las plataformas: mismos parámetros
de Argon2id (64 MiB, 8 pasadas), mismas subclaves, mismos sobres. **Una cuenta creada en
el iPhone abre en la web y al revés.**

La autocomprobación de vectores (`autocomprobacion.ts`) se ejecuta en el navegador antes
de permitir cualquier operación de cuenta, igual que en iOS. Si la biblioteca del
navegador no da los resultados conocidos, la cuenta queda desactivada.

## 6. Seguridad del sitio

Un script inyectado en la página puede leer la clave de datos. Por eso el sitio no carga
nada que no sea suyo y el navegador lo hace cumplir.

### 6.1 Política de seguridad de contenido

```
default-src 'none';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=';
img-src 'self';
font-src 'self';
connect-src 'self' https://<proyecto>.supabase.co;
worker-src 'self' blob:;
manifest-src 'self';
frame-ancestors 'none';
base-uri 'none';
form-action 'none'
```

Todo lo que no está en la lista está prohibido: scripts en línea, `eval`, scripts,
estilos, imágenes o fuentes de otro origen, marcos, complementos y conexiones a cualquier
sitio que no sea el propio o el proyecto de Supabase.

**Las tres excepciones, exactas:**

| Excepción | Por qué hace falta | Qué permite y qué no |
|---|---|---|
| `'wasm-unsafe-eval'` en `script-src` | libsodium y SQLite son WebAssembly, y compilar WebAssembly cuenta para el navegador como «evaluar» | Permite `WebAssembly.instantiate`. **No** permite `eval`, `new Function` ni scripts en línea |
| `blob:` en `worker-src` | El empaquetador de Expo crea el worker de SQLite desde un `blob:` cuando la página está aislada | Permite crear workers desde un `blob:`. Un worker así **hereda esta misma CSP**: solo puede cargar scripts del propio origen. Quien pudiera crear un `blob:` ya estaría ejecutando código en la página |
| `'sha256-47DEQ…'` en `style-src` | `react-native-web` crea una etiqueta `<style>` **vacía** y la rellena por la interfaz de CSS del navegador. Ese es el resumen de la cadena vacía | Permite exactamente una hoja de estilo en línea vacía. No permite ningún estilo en línea con contenido |

Medido, no supuesto: con la política sin ninguna de las tres el sitio no arranca, y el
navegador nombra cada una. La plantilla `public/index.html` es propia para no llevar
ningún script ni estilo en línea.

### 6.2 Resto de cabeceras

| Cabecera | Valor | Para qué |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Siempre HTTPS |
| `X-Content-Type-Options` | `nosniff` | El navegador no adivina tipos |
| `Referrer-Policy` | `no-referrer` | No se dice a nadie de dónde se viene |
| `Permissions-Policy` | cámara, micrófono, ubicación, pagos, USB… todo a `()` | La página no puede pedir nada de eso |
| `Cross-Origin-Opener-Policy` | `same-origin` | Aislamiento: ninguna otra ventana tiene referencia a esta |
| `Cross-Origin-Embedder-Policy` | `require-corp` | Aislamiento: no se incrusta nada de otro origen |
| `Cross-Origin-Resource-Policy` | `same-origin` | Otros sitios no pueden incrustar estos ficheros |
| `X-Frame-Options` | `DENY` | Lo mismo que `frame-ancestors 'none'`, para navegadores antiguos |
| `Cache-Control` | `no-store` en el HTML; larga e inmutable en los ficheros con resumen en el nombre | Se recibe siempre el HTML vigente |

Están en `public/_headers`, que la exportación copia a `dist/_headers`. Es el formato que
leen Cloudflare Pages y Netlify. La dirección de Supabase se escribe en la CSP al
exportar (`scripts/cabeceras-web.cjs`), a partir de la misma variable que usa la app.

### 6.3 Nada de terceros

Sin fuentes externas (se usa la del sistema), sin analítica, sin CDN, sin mapas, sin
widgets. Una prueba recorre el sitio entero y falla si sale una sola petición hacia un
origen que no sea el propio o el de Supabase.

### 6.4 Contenido escrito por la persona

Los nombres, comercios y notas se pintan siempre como texto (`<Text>` de React), nunca
como HTML. Una prueba guarda un nombre con `<script>` y con `<img onerror>` y comprueba
que se ve como texto y que no se ejecuta nada.

## 7. Sin conexión y cierre de la pestaña

La web **no funciona sin conexión**: no hay copia local desde la que arrancar. Sin red no
se puede entrar.

Con la sesión ya abierta, si la red cae:

- Una banda fija lo dice: «Sin conexión. Lo que cambies no se está guardando en tu
  cuenta. No cierres esta pestaña.»
- Lo ya escrito no se pierde: sigue en la base en memoria y en la cola de subida.
- Al volver la red, el motor lo sube solo y la banda desaparece.

Si se intenta cerrar o recargar la pestaña **con cambios sin subir**, el navegador
pregunta antes (`beforeunload`). Es la única defensa: en la web lo que no ha subido se
pierde al cerrar.

## 8. Entrada y salida

1. Se abre la página: se cargan las bibliotecas y se ejecuta la autocomprobación.
2. Entrar o crear cuenta. El alta enseña el aviso de beta y que **hoy no se puede
   recuperar la cuenta si se olvida la contraseña**, y enlaza la política de privacidad y
   las condiciones.
3. Con la sesión abierta, la base en memoria (recién creada: solo categorías iniciales
   sin tocar) se liga a la cuenta. Nube con datos: se quitan las iniciales y se baja
   todo. Nube vacía: se suben las iniciales. En la web nunca se hace ninguna de las dos
   preguntas de entrada, porque el navegador nunca tiene datos propios.
4. Mientras baja, se ve «Descargando y descifrando tus datos…».
5. Cerrar sesión **recarga la página**: es la forma segura de vaciar la memoria.

## 9. Pantallas y funciones por plataforma

| Pantalla o función | iOS | Web |
|---|---|---|
| Inicio, Movimientos, Análisis, Plan, Cuentas | Igual | Igual |
| Alta y edición de movimiento, cuenta, categoría, objetivo, regla, presupuesto, valor | Igual | Igual |
| Barra de pestañas | Nativa del sistema | Enlaces: abajo en móvil, barra lateral desde 900 px |
| Cuenta: entrar, crear, código de recuperación, cambiar contraseña, borrar | Igual | Igual; además es la puerta de entrada |
| Usar la app sin cuenta | Sí | **No** |
| Preguntas de entrada (subir / usar la nube) | Sí | No aplican |
| Guardar el código de recuperación | Hoja de compartir | Descarga de un fichero de texto |
| Exportar mis datos | Hoja de compartir | Descarga de los ficheros |
| Ajustes › Apariencia | Sí | Sí (se guarda en `localStorage`) |
| Ajustes › Seguridad (bloqueo con Face ID, modo privado) | Sí | **Oculto.** No hay Face ID; recargar ya pide la contraseña |
| Ajustes › Apple Pay y Atajos | Sí | **Oculto** |
| Ajustes › Avisos | Sí | **Oculto.** No hay avisos programados |
| Bandeja de capturas de pagos | Sí | **Oculta** (las capturas que vengan del iPhone se sincronizan pero no se muestran) |
| Widget | Sí | No existe |
| Ajustes › Diagnóstico | Sí | Sí |
| Ajustes › Privacidad y condiciones | — | Sí (páginas legales) |
| Sincronización | Al abrir, al volver, tras un cambio, a mano | Igual; además avisa sin conexión y al cerrar con cambios sin subir |
| Datos locales | SQLite en disco, sin cifrar | SQLite en memoria |
| Clave de datos | Llavero del sistema | Memoria |

Las rutas ocultas en la web siguen existiendo en el código (son las de iOS). Si alguien
escribe su dirección a mano, ve un aviso de que esa función es de la app del iPhone.

## 10. Diseño adaptable

- Hasta 899 px: una columna a todo el ancho y navegación abajo. Probado a 360 px.
- Desde 900 px: barra lateral a la izquierda y contenido en una columna de 760 px como
  máximo, centrada.
- Mismo tema, mismos componentes, mismos colores en claro y en oscuro.
- Teclado: todo lo que se puede pulsar es alcanzable con el tabulador y tiene foco
  visible.

## 11. Alojamiento

**Elegido: Cloudflare Pages**, plan gratuito, con subida directa de la carpeta `dist/`.

| Opción | Cabeceras propias | Coste | Valoración |
|---|---|---|---|
| Cloudflare Pages | Sí, fichero `_headers` (hasta 100 reglas y 2.000 caracteres por cabecera) | Gratis, sin límite de tráfico para ficheros estáticos | **Elegida.** HTTPS automático. Sin `404.html` sirve la raíz para cualquier ruta, que es lo que necesita esta web. Se puede subir la carpeta sin conectar el repositorio |
| Netlify | Sí, mismo formato `_headers` | Plan gratuito con límites de uso | Alternativa válida: el mismo `public/_headers` sirve |
| GitHub Pages | **No** | Gratis | Descartada: sin cabeceras propias no hay CSP por cabecera, ni HSTS, ni aislamiento. Además sus condiciones desaconsejan usarlo para contraseñas |
| Vercel | Sí (`vercel.json`) | Gratis solo para uso no comercial | Descartada por la condición de uso |
| Expo Hosting | Sí (en `app.json`) | Plan gratuito | No evaluada a fondo: ataría el despliegue a una cuenta de EAS |

No se ha desplegado nada. Los pasos están en `pasos-del-propietario-b5.md`.

## 12. Riesgos que quedan

1. **El servidor entrega el código** (apartado 2). Es el riesgo principal y no se resuelve.
2. **Una extensión del navegador con permiso sobre la página** puede leerlo todo. La CSP no
   limita a las extensiones.
3. **Un ordenador compartido:** mientras la pestaña esté abierta, quien se siente delante
   ve los datos. No hay bloqueo por inactividad.
4. **Lo no subido se pierde al cerrar.** El aviso de `beforeunload` depende del navegador;
   en móvil no siempre aparece.
5. **Argon2id con 64 MiB en un móvil modesto** puede tardar o fallar. Medido en escritorio
   y con emulación de móvil; en un móvil real, no.
6. **`expo-sqlite` en web depende de un worker en `blob:` y de aislamiento entre
   orígenes.** Si un alojamiento no envía esas cabeceras, la web no arranca.
7. **El correo queda en `localStorage`**: en un ordenador compartido, el siguiente ve qué
   correo entró.
8. **Sin recuperación de cuenta** hasta el 4b-3: contraseña olvidada, cuenta perdida.
