# Spike A · Instrucciones de medición (T-013, T-014, T-015 y T-016)

Fecha: 15/11/2026. Estas tareas son tuyas: necesitan tu iPhone, tu Apple Account y pagos
reales. El criterio completo está en `docs/04-spikes-viabilidad.md`, apartado A.8.

**No uses esta hoja para guardar datos que no quieras en el repositorio.** Si vas a
subirla a GitHub, sustituye los nombres de comercio por letras (A, B, C…) y redondea
los importes. Para el spike solo importa si el importe capturado coincide con el real.

## 0. Antes de empezar

1. Completa H0: Xcode activo (T-002) y la app instalada en tu iPhone (T-004). Los pasos
   están en `docs/estado.md`, apartado "Acciones pendientes del usuario".
2. En la app, entra en **Capturas del spike de Apple Pay** y toca **Activar los avisos**.
   Sin ese permiso las capturas se guardan, pero no verás el aviso.

## 1. Comprobar la acción sin pagar (T-010, T-011 y T-012)

1. Abre la app **Atajos**. Toca **+** para crear un atajo.
2. En el buscador de acciones escribe **FinancialControl**. Debe aparecer **Registrar
   pago**. Si no aparece, anótalo y para: es el criterio de T-010.
3. Añade la acción. Escribe `12,34 €` en Importe, `Prueba` en Comercio y `Tarjeta de
   prueba` en Tarjeta.
4. **Cierra FinancialControl del todo** (desliza hacia arriba en el selector de apps).
5. Ejecuta el atajo. Debe aparecer un aviso con "Prueba" y "12,34 € · Tarjeta de prueba".
6. Abre FinancialControl › Capturas. La captura debe estar en la lista.
7. Repite el paso 5 con todos los campos vacíos, con el modo avión activado y dos veces
   seguidas. En los tres casos debe guardarse la captura y la acción no debe dar error.

Anota el resultado de cada paso en `docs/estado.md` o dímelo y lo anoto yo.

## 2. Crear la automatización "Transacción" (T-013)

1. Atajos › pestaña **Automatización** › **+** › **Transacción**.
2. Elige las tarjetas de Wallet con las que vas a pagar. Deja todas las categorías.
3. Marca **Ejecutar inmediatamente** y desactiva "Notificar al ejecutar".
4. Toca **Siguiente** › **Nueva automatización en blanco**.
5. Añade la acción **Registrar pago** de FinancialControl.
6. Mantén pulsado cada campo y elige **Entrada del atajo**. Después toca la variable y
   elige la propiedad que corresponde: **Importe** en Importe, **Comercio** en Comercio y
   **Tarjeta** (o "Tarjeta o pase") en Tarjeta. En Origen elige **Transacción de Wallet**.
7. Toca **OK**.

Los nombres exactos de los botones cambian entre versiones de iOS. Si alguno no coincide,
anota cómo se llama en tu iPhone: ese dato alimenta la guía de la pantalla P04.

## 3. Segunda automatización, solo con iOS 27 o posterior (T-015)

1. Automatización › **+** › **Notificación** (puede llamarse "App" › "Al recibir una
   notificación").
2. Elige **Wallet**, o la app de tu banco si es la que avisa de los pagos.
3. **Ejecutar inmediatamente**. Añade **Registrar pago**.
4. En Importe pon el **cuerpo** de la notificación y en Comercio el **título**. En Origen
   elige **Notificación**.

Si tu iPhone no tiene iOS 27, escribe en la hoja "sin iOS 27" en la columna
`captura_via_notificacion` y sigue. Es un resultado válido de T-015.

## 4. Medir durante 7 días (T-014)

Objetivo mínimo: **20 pagos reales en tienda, con 2 tarjetas y 5 comercios distintos, a
lo largo de 7 días o más.**

En cada pago, en el momento de pagar:

1. Mira la hora del reloj al acercar el iPhone al datáfono (`hora_pago`, con segundos).
2. Mira la hora a la que aparece el aviso (`hora_aviso`). Si no aparece en 60 segundos,
   escribe `no`.
3. Por la noche abre FinancialControl › Capturas y completa la fila con lo que guardó la
   app. La pantalla muestra la hora de cada captura con segundos.

### Columnas de `hoja-de-control.csv`

| Columna | Qué escribir |
|---|---|
| `n` | Número de fila, empezando por 1 |
| `fecha` | Día del pago, AAAA-MM-DD |
| `hora_pago` | HH:MM:SS al acercar el iPhone |
| `comercio_real` | Dónde pagaste (o una letra) |
| `importe_real` | Lo que marcaba el datáfono, por ejemplo 23,40 |
| `tarjeta_usada` | Nombre de la tarjeta en Wallet |
| `tipo_pago` | `tienda`, `online`, `watch` o `transporte` |
| `pago_aceptado` | `si` o `no` (un pago rechazado también puede disparar la captura) |
| `captura_creada` | `si` o `no` |
| `hora_aviso` | HH:MM:SS del aviso, o `no` |
| `latencia_s` | Segundos entre `hora_pago` y `hora_aviso`. Vacío si no hubo aviso |
| `importe_capturado` | Texto del importe tal como lo muestra Capturas |
| `importe_exacto` | `si` si coincide con `importe_real`, `no` en otro caso |
| `tarjeta_capturada` | Texto de la tarjeta tal como lo muestra Capturas |
| `tarjeta_correcta` | `si` si identifica sin duda la tarjeta usada |
| `comercio_capturado` | Texto del comercio tal como lo muestra Capturas |
| `captura_sin_pago_real` | `si` solo en filas de capturas que no corresponden a un pago real: rechazados, duplicados o pruebas |
| `captura_via_notificacion` | `si`, `no` o `sin iOS 27` |
| `notas` | Cualquier cosa rara: sin cobertura, iPhone bloqueado, pago con reloj… |

Una captura que no corresponde a ningún pago (falso positivo) va en una fila propia, con
`captura_sin_pago_real` = `si` y las columnas del pago vacías.

**Nota sobre "cuenta correcta".** El criterio A.8 habla de "cuenta correcta". La regla que
convierte la tarjeta en cuenta se construye en H3 (T-032). En este spike se mide lo que
esa regla necesita: que el texto de la tarjeta llegue y distinga una tarjeta de otra. Por
eso la columna se llama `tarjeta_correcta`.

### Casos que conviene incluir

- Un pago con el iPhone bloqueado y otro desbloqueado.
- Un pago sin cobertura o en modo avión, si se da la ocasión.
- Un pago con el Apple Watch, si tienes (no demostrado si dispara la automatización).
- Una compra en línea con Apple Pay.
- Dos pagos seguidos en menos de un minuto.

## 5. Atajo compartido con la automatización incluida (T-016, iOS 27)

1. Crea un atajo llamado **FinancialControl · Pagos** con la acción Registrar pago.
2. Si tu iOS lo permite, añade la automatización Transacción dentro del propio atajo.
3. Toca Compartir › **Copiar enlace de iCloud**.
4. Abre el enlace en otro iPhone, o en el tuyo tras borrar el atajo. Anota: ¿se abre
   Atajos con el atajo listo para añadir? ¿Llega la automatización? ¿Llega activada?

Envíame el enlace y las tres respuestas. Con eso queda documentado el "sí o no" de T-016.

## 6. Al terminar

Entrégame `hoja-de-control.csv` rellena. Con ella calculo las cinco medidas de A.8 y
redacto `docs/spike-a/informe.md` (T-017). Sin la hoja no se redacta el informe ni se
estima ningún resultado.
