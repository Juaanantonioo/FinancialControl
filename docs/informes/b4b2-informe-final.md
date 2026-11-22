# Informe final · bloque 4b-2: sincronización cifrada

Fecha: 22/11/2026. Rama `b4b2-sincronizacion`, desde `b4b1-cuenta-y-claves` (`2650f9c`).

**Estado final: `COMPLETED_WITH_EXTERNAL_GATES`.**

Los nueve criterios de éxito del encargo se cumplen. Quedan dos puertas que solo puedes
abrir tú: aplicar la migración remota y probar con dos dispositivos. Y una cosa del
encargo **no está hecha**: las capturas (apartado 6). Si para ti las capturas eran
condición, el estado es `PARTIALLY_COMPLETED`.

## 1. Baseline

| | Encargo | Encontrado |
|---|---|---|
| Rama y commit | `b4b1-cuenta-y-claves`, `2650f9c` | Igual |
| Pruebas | 1.092 en 38 suites | Igual, en verde |
| Pruebas remotas | 41 | Igual, en verde |
| Esquema local | — | Versión 4 |
| Docker | Disponible | 29.0.1 |

Una diferencia, sin efecto: `npm run check` fallaba en `prettier` por un fichero que dejó
la CLI de Supabase al enlazar el proyecto (`supabase/.temp/`, ignorado por git). Añadido a
`.prettierignore`. No lo consideré motivo para parar.

Stash `27c3df3`: comprobado que todo su contenido está en la rama. Borrado.

## 2. Hecho por fase

| Fase | Qué | Commit |
|---|---|---|
| 0 | Baseline, lectura y stash | `485cc2c` |
| 1 | Diseño: `docs/seguridad/diseno-sincronizacion.md` | `ac21756` |
| 2 | Motor en `src/sincronizacion/` y migración local 5 | `8662010` |
| 3 | Migración remota de `rls_auto_enable()` y pruebas contra la instancia local | `3287c00` |
| 4 | Integración: cuándo se sincroniza, estado en Cuenta, entrada en una cuenta | `469ae8d` |
| 5 | Cambio de contraseña y actualización de parámetros | `2171cb3` |
| 6 | Exportación | `33371f3` |
| 7 | Casos límite y regresión | `3b0c974` |
| 8 | Documentación, pasos del propietario y este informe | el último de la rama |

Qué puede hacer ahora una persona con cuenta:

1. Usar la app sin conexión como antes. La sincronización va por detrás.
2. Ver sus datos en dos dispositivos: altas, cambios y borrados.
3. Cambiar la contraseña sin perder datos ni recifrar nada.
4. Exportar todo a un JSON y los movimientos a un CSV. También sin cuenta.
5. Ver en Cuenta la última sincronización, los cambios pendientes, los apuntes que no se
   han podido aplicar y, si algo falla, un mensaje sin detalles internos.

## 3. Pruebas

| | Antes | Después |
|---|---|---|
| `npm test` | 1.092 en 38 suites | **1.236 en 49 suites**, en verde |
| `npm run test:remoto` | 41 en 2 suites | **81 en 5 suites**, en verde |
| Formato, lint y tipos | sin avisos | sin avisos |

Todas las pruebas del apartado 8 del encargo existen y pasan. La tabla de cuál está en qué
fichero está en `docs/estado.md`, apartado 15.6.

Las remotas se ejecutan contra la instancia local de Supabase con el cliente real. Nada
se ha ejecutado contra el proyecto remoto.

**Cuatro pruebas que ya existían han cambiado**, porque lo que comprobaban cambió a
propósito (detalle en `docs/estado.md`, 15.4). La más visible: dos comprobaciones exigían
que la pantalla dijera «todavía no sincroniza nada». Ninguna se ha debilitado.

### Las dos demostraciones que pedía el encargo

- **Ninguna petición lleva datos en claro.** Una prueba espía todas las peticiones de un
  dispositivo que sube las doce tablas, borra una fila y hace un repaso completo, y busca
  en ellas cada valor de cada fila. Después lee la tabla remota como administrador y
  repite la búsqueda. No aparece ninguno. Lo único que viaja en claro: usuario, tabla, id,
  versión, marca de borrado y marca de tiempo.
- **El cursor no pierde filas.** La prueba retiene una fila en PostgreSQL con una
  transacción abierta, lanza una escritura lenta, confirma otra rápida entre medias y
  comprueba que la lenta queda con marca **anterior** a la rápida. El dispositivo con
  ventana de solape recibe las dos. Uno con ventana cero pierde la lenta: así se sabe que
  la prueba ejercita el caso.

## 4. Migración remota (D-n)

`20261122120000_retirar_execute_de_rls_auto_enable.sql`. **Probada, incluida.**

En la instancia local se crea la función con la definición que Supabase publica en su
guía de disparadores de eventos, y su disparador. Con eso: `anon` y `authenticated` pueden
ejecutarla (lo que avisa el asesor); se aplica la migración; ya no pueden, ni `public`; y
una tabla nueva de `public` sigue naciendo con RLS, también si la crea un rol que no
puede ejecutar la función. Sin la función, la migración no hace nada y no falla.

Límite de la prueba: no he visto la función de tu proyecto. Uso la publicada. Por eso el
paso 1 de tu lista incluye una comprobación en el panel y cómo deshacerla.

## 5. Prebuild y compilación

- `npx expo prebuild --clean --platform ios`: correcto.
- Compilación para el simulador: **Build Succeeded, 0 errores.**
- Sin `aps-environment`. Identificador y esquema de URL sin cambios.
- Dependencias nuevas: ninguna.

## 6. Capturas: no hechas

Tras compilar, el simulador dejó de responder: instalar, abrir una URL y capturar se
quedaban colgados, también tras reiniciar su servicio y en un segundo simulador. Lo dejé
tras varios intentos.

Consecuencia que importa más que las imágenes: **no he visto ninguna pantalla nueva
pintada, ni la app nueva arrancar.** Las pantallas tienen pruebas con
`@testing-library/react-native`, que no detectan un texto cortado o una tarjeta fuera de
sitio.

## 7. Casos límite

| Caso | Resultado |
|---|---|
| Una fila cambia mientras se está subiendo | Sube dos veces; no se pierde el segundo cambio |
| La persona guarda algo mientras se aplican filas bajadas | Las transacciones van en fila; sin esto SQLite daba error (hay prueba de los dos casos) |
| Una fila llega antes que aquella a la que apunta | Se retiene y se aplica cuando llega la otra |
| Fila escrita por una versión futura de la app | Se retiene sin perderla; se cuenta aparte de las ilegibles |
| Dos presupuestos del mismo mes creados sin conexión | Queda el de id menor en los dos dispositivos; el otro, marcado como borrado |
| Uno borra y el otro cambia la misma fila | Gana el que sube después; si es el cambio, la fila reaparece |
| El servidor rechaza una fila | Las demás suben; esa se cuenta y se reintenta |
| Una nota de 70.000 caracteres | No cabe en el servidor (64 KiB). No sube, el estado queda en «Algunos cambios no se han podido subir» y se reintenta cada 5 minutos para siempre. La app no limita la longitud de una nota |
| Sesión caducada | No se reintenta sola; Cuenta pide cerrar sesión y volver a entrar. Los pendientes se conservan |
| App cerrada con la pregunta de entrada abierta | Al volver, la pregunta sale otra vez. No se ha sincronizado nada |
| «Usar la nube» y la bajada falla | No se ha tocado nada local |
| «Usar la nube» y la persona cierra la hoja sin guardar | No se ha tocado nada local |
| Borrar la cuenta | Se borran sus filas cifradas del servidor; los datos locales siguen y la base se desliga |
| Dos dispositivos sincronizando a la vez | Acaban iguales |
| Marca `borrada` cambiada en el servidor | Sin efecto: decide el contenido |
| Corte en cualquier paso del cambio de contraseña | Una y solo una contraseña abre la cuenta; entrar o repetir el cambio lo termina |
| Contraseña cambiada y otro dispositivo con sesión | Sigue sincronizando con su sesión (ver riesgos) |

## 8. Lo que un servidor malicioso aún puede hacer

No se resuelve en este bloque. Tabla completa en `diseno-sincronizacion.md`, apartado 10.

| Qué hace | ¿Lo nota la app? |
|---|---|
| Leer el contenido | No puede |
| Alterar un sobre o moverlo de fila, tabla o usuario | Sí |
| Ver cuántas filas hay por tabla, su tramo de tamaño y cuándo cambian | No se puede evitar |
| Negarse a guardar | Sí |
| Decir que guarda y no guardar | Solo en el repaso completo, y solo el dispositivo que la subió |
| Ocultar una fila a un dispositivo que nunca la vio | **No** |
| Devolver una versión antigua con su marca antigua | Solo en el repaso completo |
| Devolver una versión antigua con una marca nueva | **No.** Es la reversión que el diseño no detecta |
| Servir un sobre antiguo de la clave por contraseña | **No.** Vale a quien conozca una contraseña anterior |

## 9. Decisiones propias

1. **La cola de cambios son disparadores de SQLite**, en una migración local nueva (la
   5). Así no cambia ningún repositorio y ninguna escritura se escapa. El estado va en la
   base porque cursor y cola tienen que cambiar en la misma transacción que los datos.
2. **Ventana de solape de 5 minutos, paginación por clave y repaso completo** (semanal y
   en «Sincronizar ahora»). El repaso no lo pedía el encargo; cubre lo que quede fuera de
   la ventana y deja notar un servidor restaurado desde una copia antigua.
3. **Regla de unicidad: gana el id menor.** El encargo no decía qué hacer con dos filas
   distintas que no pueden convivir.
4. **Dos sobres en `clave_por_contrasena` durante el cambio.** Es lo que evita la ventana
   de cuenta inaccesible sin tocar el esquema: la columna ya admitía hasta 400 caracteres.
   No cambia el formato del sobre ni la jerarquía de claves.
5. **Relleno a 256 bytes** del texto de cada fila.
6. **No se cree la marca `borrada` del servidor.**
7. **«Cancelar» cierra la sesión.** El encargo decía «no se inicia sesión»; la sesión ya
   está abierta cuando se sabe que hay que preguntar.
8. **Se envía `current_password`** al cambiar la contraseña, además de comprobarla antes.
9. **Las transacciones de la base van en fila** (`bdExpo.ts`). Toca el adaptador, no el
   esquema ni los datos.
10. **Los datos autenticados añaden el `user_id`** al uso `fila/<tabla>/<id>` que
    anunciaba el diseño del 4b-1. Lo pedía D-c.
11. **Límite de inicios de sesión de la instancia local subido a 600** en
    `supabase/config.toml`. Solo afecta a la instancia local, salvo que alguien ejecute
    `supabase config push`.
12. **Exportación:** las tablas se leen del esquema, así una tabla futura entra sola. Los
    textos que empiezan por `=`, `+`, `-` o `@` llevan un apóstrofo delante en el CSV,
    para que una hoja de cálculo no los ejecute como fórmula.

## 10. Riesgos que quedan, sin suavizar

1. **Nada de esto se ha visto funcionar en un teléfono.** Ni dos dispositivos reales, ni
   la app arrancando con la migración 5 sobre tu base real.
2. **Al instalar esta versión con tu sesión abierta, tus datos reales subirán** a tu
   cuenta. Cifrados, pero es la primera vez que salen del iPhone.
3. **Conflictos: se pierde sin aviso** el cambio que sube antes.
4. **Un servidor comprometido puede revertir filas** sin que se note, y ocultarlas a un
   dispositivo nuevo.
5. **Cambiar la contraseña no echa a nadie.** Las demás sesiones siguen valiendo, y la
   clave de datos no cambia: quien la tuviera, la sigue teniendo.
6. **Un dispositivo con datos de otra persona que entra en una cuenta vacía sube esos
   datos a esa cuenta.** Es lo que dice D-h, sin preguntar.
7. **La copia previa a «Usar los datos de la nube» depende de que iOS diga la verdad**
   sobre si se guardó el fichero. Si dijera «compartido» sin haberse guardado, los datos
   locales se sustituirían sin copia. No comprobado en un iPhone.
8. **La base local sigue sin cifrar**, y ahora además existe un fichero de exportación en
   claro que la persona puede dejar en cualquier sitio.
9. **Una fila mayor de 64 KiB no sube nunca** y deja el estado en aviso permanente.
10. **Dos dispositivos nuevos que entran a la vez en una cuenta vacía** duplican las
    categorías iniciales.
11. **El servidor ve metadatos:** cuántos apuntes de cada clase y a qué hora.
12. **Nadie ajeno al proyecto ha revisado el diseño.**

## 11. NO DEMOSTRADO

1. Dos dispositivos reales contra el proyecto remoto.
2. La app nueva arrancando en simulador o iPhone; la sincronización al abrir y al volver
   de segundo plano; la hoja de compartir con un fichero.
3. Qué devuelve iOS al guardar en Archivos y al cerrar la hoja.
4. Que la función `rls_auto_enable()` de tu proyecto sea la publicada.
5. Qué pasa con las otras sesiones cuando tengan que renovarse tras un cambio de
   contraseña.
6. El ajuste «Secure password change» y los límites de intentos del proyecto remoto.
7. Rendimiento con miles de filas en un iPhone.
8. Una transacción del servidor de más de 5 minutos.
9. Ninguna pantalla nueva vista pintada (apartado 6).

## 12. Pasos del propietario

`docs/seguridad/pasos-del-propietario-4b2.md`:

1. Aplicar la migración: `npx supabase db push --remote --dry-run` y, si anuncia solo
   esa, `npx supabase db push --remote`. Comprobar en el panel que una tabla nueva sigue
   naciendo con RLS. **No ejecutar `supabase config push`.**
2. Instalar en el iPhone: `npx expo run:ios --device --configuration Release`.
3. La prueba con dos dispositivos: 19 comprobaciones, con una cuenta de prueba.
4. Mirar dos ajustes del panel.

## 13. Te toca decidir

Nada de esto bloquea el bloque. En cada una, lo que hay hoy y mi recomendación.

1. **¿Subir tus datos reales ya?** Hoy: suben al abrir la versión nueva con sesión.
   Recomendación: cierra sesión antes de instalar y haz primero la lista con una cuenta
   de prueba.
2. **Dispositivo con datos que entra en una cuenta vacía.** Hoy: sube sin preguntar
   (D-h). Recomendación: preguntar también ahí («¿Subir los datos de este dispositivo a tu
   cuenta?») cuando el dispositivo estuvo ligado a otra cuenta. Es un cambio pequeño.
3. **Cerrar las demás sesiones al cambiar la contraseña.** Hoy: no se cierran.
   Recomendación: hacerlo en el 4b-3 o el 4c, y decidir entonces si también se rota la
   clave de datos, que es lo único que de verdad echa a quien la tenga.
4. **Límite de longitud de las notas.** Hoy: ninguno; por encima de unos 45.000
   caracteres la fila no sube. Recomendación: limitar la nota en la app. Toca una pantalla
   existente, así que no lo he hecho.
5. **Regla de unicidad (gana el id menor).** Recomendación: dejarla. La alternativa es
   fusionar, que el encargo prohíbe en el caso general.
6. **Las capturas.** Recomendación: repetirlas cuando el simulador responda, o darlas por
   sustituidas por tu prueba en el iPhone.
7. **Reversión por un servidor malicioso.** Para el 4c: un contador de versión por fila
   dentro del contenido cifrado y memoria local del último visto.

## 14. Criterios de éxito

- [x] `npm run check` y las pruebas remotas pasan enteros.
- [x] Todas las pruebas del apartado 8 existen y pasan.
- [x] `docs/seguridad/diseno-sincronizacion.md` existe y coincide con el código.
- [x] Ninguna petición lleva datos de filas en claro, demostrado.
- [x] La migración de D-n está probada.
- [x] Compila para el simulador tras `expo prebuild --clean`.
- [x] Sin secretos en el repositorio ni en el historial de la rama.
- [x] `docs/seguridad/pasos-del-propietario-4b2.md`.
- [x] `docs/informes/b4b2-informe-final.md`.
- [ ] Capturas (fase 7): **no hechas.**
