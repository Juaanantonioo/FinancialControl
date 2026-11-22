# Informe final · bloque 5: verificación en simulador y versión web

Fecha: 22/11/2026. Rama `b5-web`, desde `b4b2-sincronizacion` (`f680e9f`).

**Estado final: `PARTIALLY_COMPLETED`.**

La parte B (la web) está hecha y probada en un navegador real. La parte A no: la prueba
del 4b-2 entre dos simuladores **no se hizo**. El encargo admitía esa salida («parada
documentada con su diagnóstico»), y bajo esa lectura el estado sería
`COMPLETED_WITH_EXTERNAL_GATES`. Pongo el más bajo porque el hecho importante sigue en
pie: **la sincronización del 4b-2 no se ha visto funcionar en ningún dispositivo**, y este
bloque añade encima más código de iOS sin ver.

## 1. Baseline

| | Encargo | Encontrado |
|---|---|---|
| Rama y commit | `b4b2-sincronizacion`, `f680e9f` | Igual |
| Pruebas | 1.236 en 49 suites | Igual, en verde |
| Remotas | 81 | Igual, en verde |
| Docker | Disponible | 29.0.1 |

## 2. Parte A · Simulador

### Diagnóstico

**Hecho observado.** `simctl install` no terminaba (más de 240 s) donde la app ya estaba
instalada. El simulador, mientras, arrancaba y respondía.

| Hipótesis | Comprobación | Resultado |
|---|---|---|
| Falta de memoria (Mac de 8 GiB; intercambio a 6 de 7 GiB; Docker con 12 contenedores) | Supabase reducido a 4 contenedores; instalación con el 54 % de memoria libre | No basta: siguió colgada |
| El instalador está ocupado | Muestreo del proceso | Descartada: parado, esperando |
| Se atasca la **sustitución** de una app ya instalada | Registro del simulador: «Install (Parallel Placeholder)» sin «Success», y «Error resuming app replacement». Desinstalar e instalar en un simulador nuevo | **Confirmada una vez:** tras desinstalar, instala en 4 s |

**Causa más probable:** en Xcode 27.2 instalar encima de una instalación existente se
queda esperando. Desinstalar antes lo evita. Vista una sola vez.

### Por qué se paró

Al arrancar el segundo simulador, con Docker en marcha, **el Mac se reinició**. No sé si
lo causó esa carga; con 8 GiB es verosímil. Me indicaste seguir sin simuladores. Los dos
que creé (`FC-A`, `FC-B`) están borrados; no toqué ningún otro.

### Resultado de la prueba con dos dispositivos

**No hecha.** Sin capturas en `docs/capturas/b4b2/`. Siguen sin verse en un dispositivo:
la migración local 5 sobre una base real, la sincronización entre dos dispositivos, las
preguntas de entrada, el cambio de contraseña, la exportación y qué devuelve la hoja de
compartir de iOS.

### Lo que sí se cerró de la parte A (fase 3)

- **D-b.** Con datos en el dispositivo y la nube vacía, Cuenta pregunta «¿Subir los datos
  de este dispositivo a tu cuenta?». Cancelar no sube ni borra nada.
- **D-c.** Límite de textos: 200 caracteres en nombres y comercio, 2.000 en notas. Lo ya
  guardado no se trunca y la pantalla avisa al editarlo. Una prueba cifra la fila más
  grande posible de cada tabla y comprueba que ocupa menos de la mitad del máximo del
  servidor.

## 3. Hecho por fase

| Fase | Qué | Commit |
|---|---|---|
| 0 | Baseline | `9be468f` |
| 1 | Diagnóstico del simulador | `6e74244` |
| 2 | Prueba con dos simuladores | **No hecha** |
| 3 | D-b y D-c | `7c29185` |
| 4 | Diseño: `docs/seguridad/diseno-web.md` | `4f56ea3` |
| 5 | La app arranca en web | `0ce2620` |
| 6 | Cuenta obligatoria, entrada, carga, diseño adaptable | `8b9208e` |
| 7 | Sustituciones por plataforma | `e197ccf` |
| 8 | Cabeceras del sitio | `eda7727` |
| 9 | Pruebas en navegador y capturas | `bd773ea` |
| 10 | Documentación, pasos e informe | el último de la rama |

Las fases 6 a 8 no quedaron separadas del todo en sus commits: las páginas legales y los
avisos de sin conexión entraron con la puerta de la web, que los usa.

## 4. Qué es la web

Un sitio estático (`npm run web:exportar` → `dist/`). Una persona entra o crea su cuenta y
usa Inicio, Movimientos, Análisis, Plan y Cuentas con los mismos datos cifrados que la app
del iPhone.

- **Cuenta obligatoria.** Sin sesión solo se ve la entrada.
- **Nada sensible en el navegador.** Clave de datos, sesión y datos, solo en memoria.
  Recargar pide la contraseña. Se guardan el correo y la apariencia.
- **Sin duplicar código.** Dominio, repositorios, cifrado y motor son los mismos ficheros.
  Lo propio de la web son 19 ficheros `.web.*` pequeños.

### Base en memoria: `expo-sqlite` para web, abierto como `:memory:`

Ya era dependencia. Mismo SQL, mismas migraciones y mismos disparadores que en iOS, sin
tocar `src/datos/`. Confirmado en una compilación real antes de escribir el diseño.
Exige aislamiento entre orígenes (COOP y COEP) y permitir WebAssembly.

Un detalle que no se puede evitar: al arrancar crea en OPFS seis ficheros vacíos de 4 KiB
(la reserva de su almacén persistente, que no usamos). Una prueba los lee byte a byte y
comprueba que no contienen nada.

### Alojamiento: Cloudflare Pages

Gratuito, HTTPS, y respeta el fichero de cabeceras del repositorio (`public/_headers`).
Sirve la app para cualquier ruta si no hay `404.html`. Se sube la carpeta a mano, sin
conectar el repositorio. GitHub Pages se descartó: no admite cabeceras propias. Vercel,
por su condición de uso no comercial en el plan gratuito. Netlify vale como alternativa
con el mismo fichero. **No he desplegado nada.**

## 5. Dependencias

| Paquete | Versión | Tipo |
|---|---|---|
| `react-native-web` | ^0.21.4 | Nueva. La eligió `npx expo install` |
| `@expo/metro-runtime` | ~58.0.17 | Nueva. La eligió `npx expo install` |
| `libsodium-wrappers-sumo` | 0.8.4 exacta | Pasa de desarrollo a producción |
| `@playwright/test` | la vigente | Nueva, de desarrollo |

Ninguna otra. `react-dom` ya estaba.

## 6. Pruebas

| | Antes | Después |
|---|---|---|
| `npm test` | 1.236 en 49 suites | **1.270 en 51 suites**, en verde |
| `npm run test:remoto` | 81 | **81**, en verde |
| `npm run test:web` | — | **22**, en verde, dos veces seguidas |

Las de navegador corren en Chromium sobre el sitio **exportado**, servido por
`scripts/servir-web.cjs` con las cabeceras de `dist/_headers`, contra la instancia local
de Supabase. No sobre el servidor de desarrollo.

| Prueba del apartado 6 del encargo | Resultado |
|---|---|
| Alta, código, uso, cierre y nueva entrada | Pasa |
| Interoperabilidad con el código nativo, en los dos sentidos, doce tablas idénticas | Pasa. «Nativo» es el código del iPhone ejecutado en Node, no un iPhone |
| Almacenes del navegador sin contraseña, claves ni datos | Pasa. Vuelca los seis almacenes y busca más de 40 valores conocidos |
| Recargar pide la contraseña y recupera los datos | Pasa |
| Ninguna petición a otro origen ni con datos en claro | Pasa |
| CSP activa, sin violaciones en un recorrido completo; un script inyectado no se ejecuta | Pasa. También bloquea `onerror`, enlaces `javascript:`, texto evaluado y una conexión a otro sitio |
| HTML o script en un nombre se muestra como texto | Pasa |
| Sin conexión: mensaje claro; al volver sigue | Pasa |
| Aviso al cerrar con cambios sin subir | Pasa |
| 360, 768 y 1280 px, claro y oscuro | Pasa. 54 capturas en `docs/capturas/b5/`; miré tres |
| Navegación solo con teclado | Pasa: entrar, las cinco secciones, anotar un gasto y llegar a cerrar sesión, con foco visible en cada paso |
| Argon2id en escritorio y móvil emulado, y memoria | Tiempos medidos. **Memoria no medida** |
| Tamaño y tiempo de carga | Medidos |

Tres defectos reales que encontraron estas pruebas, corregidos:

1. Sin conexión, una pantalla aún no visitada no abría: su código se descargaba al
   entrar. Ahora todo el código llega en la primera carga.
2. El contenedor de pestañas crecía con su contenido: el botón de añadir quedaba fuera de
   la pantalla y las listas no se desplazaban.
3. A 360 px, «Movimientos» no cabía en la barra inferior.

Y uno que no era de la web, encontrado al hacer D-c:

4. **Editar un movimiento borraba su comercio y su nota.** El formulario no los enseña y
   al guardar los enviaba vacíos. Es anterior a este bloque y afectaba a iOS. Chocaba con
   D-c («los textos existentes no se truncan»): editar los destruía enteros, y la
   sincronización propagaba la pérdida. Corregido: al editar se conservan. Con prueba.

Cinco pruebas anteriores cambiaron porque cambió a propósito lo que comprobaban (lista en
`docs/estado.md`, 16.5). Ninguna se debilitó.

## 7. Funciones por plataforma

| | iOS | Web |
|---|---|---|
| Las cinco secciones y todas las altas y ediciones | Sí | Sí, iguales |
| Usar sin cuenta | Sí | **No** |
| Datos locales | SQLite en disco | SQLite en memoria |
| Clave de datos | Llavero | Memoria |
| Barra de pestañas | Nativa | Enlaces: abajo, o lateral desde 900 px |
| Preguntas de entrada (subir / usar la nube) | Sí | No aplican: el navegador nunca tiene datos propios |
| Código de recuperación y exportación | Hoja de compartir | Descarga |
| Apariencia | Sí | Sí |
| Bloqueo con Face ID y modo privado | Sí | Oculto |
| Apple Pay y Atajos, avisos, bandeja de capturas | Sí | Ocultos; su dirección explica que son del iPhone |
| Widget | Sí | No existe |
| Diagnóstico | Sí | Sí |
| Privacidad y condiciones | — | Sí |
| Sin conexión | Funciona | No funciona; avisa |

## 8. Política de seguridad de contenido final

```
default-src 'none';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=';
img-src 'self'; font-src 'self';
connect-src 'self' https://<proyecto>.supabase.co;
worker-src 'self' blob:;
manifest-src 'self';
frame-ancestors 'none'; base-uri 'none'; form-action 'none'
```

Tres excepciones, cada una medida quitándola y viendo qué decía el navegador:

| Excepción | Motivo | Qué no permite |
|---|---|---|
| `'wasm-unsafe-eval'` | libsodium y SQLite son WebAssembly | `eval`, `new Function`, scripts en línea |
| `blob:` en `worker-src` | El empaquetador de Expo crea así el worker de SQLite cuando la página está aislada | El worker hereda la misma política |
| Un resumen en `style-src` | `react-native-web` crea una etiqueta `<style>` **vacía**; es el resumen de la cadena vacía | Cualquier estilo en línea con contenido |

Sin `'unsafe-inline'`, sin `'unsafe-eval'`, sin comodines. Además: HSTS, `nosniff`,
`Referrer-Policy: no-referrer`, `Permissions-Policy` con todo a cero, `X-Frame-Options`,
COOP, COEP (`require-corp`) y CORP. Ningún recurso de terceros.

## 9. Compilación de iOS

- `npx expo prebuild --clean --platform ios`: correcto. Sin `aps-environment`.
  Identificador y esquema sin cambios.
- Compilación para el SDK del simulador con `xcodebuild`, sin arrancar ningún simulador:
  **BUILD SUCCEEDED, 0 errores.** Hecha antes del último cambio del bloque (conservar
  comercio y nota al editar), que es solo JavaScript y no entra en la compilación nativa.
- «Se comporta igual»: **no demostrado**. No se ha arrancado. Lo que lo respalda son las
  1.270 pruebas y que el código de la web va en ficheros `.web.*` que iOS no carga.

## 10. Medidas

| | Valor |
|---|---|
| Argon2id, escritorio | 291, 310 y 320 ms |
| Argon2id, móvil emulado (Pixel 7, procesador ×4 más lento) | 1.306, 1.279 y 1.279 ms |
| Alta completa, escritorio / móvil emulado | 1,3 s / 4,1 s |
| Memoria | No medida |
| Tamaño del sitio | 3,4 MiB en 26 ficheros; 1,1 MiB con gzip |
| Carga en frío hasta el formulario | 0,6 s, con el servidor en la misma máquina |

Tu iPhone tardaba unos 220 ms: el navegador de escritorio está en el mismo orden. 64 MiB
no falló en ningún caso, así que no paré. La emulación no limita la memoria.

## 11. Decisiones propias

1. **«Cancelar» en la pregunta de subida deja la sesión abierta y la sincronización en
   pausa.** Se vuelve a preguntar con «Sincronizar ahora» o al abrir la app.
2. **Un dispositivo recién instalado sube sin preguntar** a una cuenta vacía: solo tiene
   las categorías iniciales.
3. **Si la nube recibe datos mientras se pregunta, el «sí» no sube** y pasa a la otra
   pregunta.
4. **Límites: 200 y 2.000 caracteres**, aplicados en los repositorios.
5. **Cerrar sesión en la web recarga la página.**
6. **Las rutas no se cargan a demanda en la web.** Cuesta una primera carga mayor.
7. **`require-corp` en vez de `credentialless`**, que es lo que propone Expo.
8. **Plantilla HTML propia**, para no llevar nada en línea.
9. **La dirección de Supabase se escribe en la política al exportar**, y la exportación
   falla si no la hay o no es `https`.
10. **La bandeja de capturas no se muestra en la web.**
11. **Los textos «tus datos están solo en este dispositivo» no se muestran en la web**,
    donde no son verdad.
12. **Supabase local con cuatro contenedores** durante las pruebas, por memoria.
13. **Subida a mano a Cloudflare**, sin conectar el repositorio.

## 12. Riesgos que quedan, sin suavizar

1. **En la web el servidor entrega el código.** Quien controle la cuenta del alojamiento o
   el dominio puede servir un programa que robe contraseñas y claves. El cifrado de
   extremo a extremo protege de Supabase, no de quien sirve la web. No hay defensa
   técnica en este bloque. La política de privacidad lo dice.
2. **El 4b-2 sigue sin verse en un dispositivo**, y ahora hay más cambios de iOS encima
   (D-b y D-c).
3. **Sin recuperación de cuenta.** Una contraseña olvidada es una cuenta perdida.
4. **Solo probado en Chromium.** Safari, que es el navegador del iPhone, sin probar.
5. **Argon2id en un móvil real, sin medir.**
6. **Una extensión del navegador puede leerlo todo.**
7. **Sin bloqueo por inactividad:** una pestaña abierta en un ordenador compartido queda
   a la vista.
8. **Lo no subido se pierde al cerrar.** El aviso depende del navegador; en móviles suele
   no salir.
9. **Los textos legales son un borrador sin datos del titular y sin revisar por nadie que
   sepa de protección de datos.**
10. **Nadie ajeno al proyecto ha revisado el diseño.**
11. **Un `blob:` en `worker-src`** es una excepción real, aunque acotada.

## 13. NO DEMOSTRADO

1. Todo el 4b-2 en un dispositivo.
2. La web en un móvil real y en Safari o Firefox.
3. La web desplegada y la web contra el proyecto remoto.
4. Una cuenta creada en un iPhone de verdad abriendo en la web.
5. La app de iOS arrancando con los cambios de este bloque.
6. La memoria que usa la pestaña.
7. Los límites del plan gratuito de Supabase y de Cloudflare para tu caso.
8. De las 54 capturas, solo miré tres. Las demás pasaron la comprobación automática de
   que nada se sale ni se pisa.

## 14. Para Android

- **La base de datos y el cifrado ya valen:** `expo-sqlite` y `react-native-libsodium` son
  nativos en Android. No hay que hacer nada parecido a la web.
- **El parche de libsodium es solo de iOS** (`ios/Libsodium.mm`). Hay que comprobar si
  Android compila con React Native 0.88 sin parche.
- **Lo que hoy es solo de iOS** y habrá que sustituir u ocultar: las acciones de Atajos
  (`app-intents/`, Swift), el widget (`expo-widgets` con SwiftUI), `NativeTabs` y sus
  iconos SF, y la hoja de compartir con fichero (`compartirFichero.ts` devuelve
  «no disponible» fuera de iOS).
- **`ES_WEB` y los ficheros `.web.*` ya separan «navegador» de «nativo».** Para Android
  hará falta la misma separación con `.android.*` donde iOS use algo propio. No usé
  `.ios.*`/`.native.*` para lo común, así que Android cae hoy en el código de iOS.
- **`almacenDeSeguridad.ts` usa `Settings` de React Native**, que es de iOS.
- **El llavero:** `expo-secure-store` existe en Android con otras garantías. Revisar.
- **La autocomprobación de vectores** correrá sola en Android: dirá si la biblioteca
  nativa da los mismos resultados.

## 15. Pasos del propietario

`docs/seguridad/pasos-del-propietario-b5.md`:

1. Probar la web en tu Mac: `npm run web:exportar` y `npm run web:servir`.
2. Probarla en tu móvil y pasarme los milisegundos de Argon2id.
3. Completar y hacer revisar los textos legales.
4. Mirar cuatro ajustes de Supabase.
5. Desplegar en Cloudflare Pages subiendo `dist/`.
6. Comprobar las cabeceras de lo desplegado.

## 16. Te toca decidir

1. **La prueba del 4b-2 en un dispositivo.** Recomendación: hazla tú en tu iPhone con la
   lista de `pasos-del-propietario-4b2.md` antes de abrir la web a nadie, o déjame
   intentarlo en simulador con Docker parado y un solo simulador (con Supabase remoto de
   pruebas no puedo; con la instancia local necesito Docker).
2. **Abrir la web sin recuperación de cuenta.** Recomendación: beta cerrada, solo para ti
   y pocas personas avisadas, hasta el 4b-3.
3. **El formulario de movimiento no deja ver ni escribir la nota ni el comercio.** Se
   guardan y se sincronizan, pero solo los rellena una captura. Recomendación: decidir si
   la nota debe poder escribirse; es una pantalla existente y no la he tocado.
4. **Bloqueo por inactividad en la web.** Recomendación: añadirlo antes de una beta
   abierta.
5. **Dominio propio.** Cuesta dinero y añade otra cuenta que proteger. Recomendación:
   empezar con la dirección `pages.dev`.
6. **Captcha en el alta.** Chocaría con «nada de terceros». Recomendación: no ponerlo y
   confiar en los límites de Supabase mientras la beta sea pequeña.

## 17. Criterios de éxito

- [ ] Parte A: sincronización vista entre dos simuladores. **No.** Parada con diagnóstico.
- [x] D-b y D-c hechas, con prueba.
- [x] `npx expo export -p web` genera el sitio sin errores.
- [x] Todas las pruebas del apartado 6 existen y pasan. Salvedad: la memoria no se midió.
- [x] `docs/seguridad/diseno-web.md` coincide con el código.
- [x] Configuración de alojamiento y cabeceras en el repositorio.
- [x] Páginas legales en borrador y aviso de beta.
- [x] `npm run check` y remotas en verde; iOS compila tras `expo prebuild --clean`.
- [x] Sin secretos en el repositorio.
- [x] `docs/seguridad/pasos-del-propietario-b5.md`.
- [x] `docs/informes/b5-informe-final.md`.
