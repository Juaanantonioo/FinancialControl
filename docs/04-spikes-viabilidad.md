# 04 · Informes de viabilidad técnica (spikes)

**Estado de los dos spikes: DISEÑADOS, NO EJECUTADOS.** En esta ejecución no se ha
escrito código ni se han hecho mediciones en un iPhone. Cada informe recoge lo que la
documentación permite afirmar, lo que queda por demostrar, el criterio medible y la
alternativa. La ejecución está planificada en los hitos H1 y H7 de la hoja de ruta.

El spike C (sincronización con Notion) se retiró por la decisión D5: la app no se integra
con Notion. Ver `09-decisiones.md`.

Fuentes `[Sxx]` en `00-fuentes-y-revalidacion.md`.

---

## Spike A · Captura con Apple Pay

### A.1 Qué se sabe

| Afirmación | Estado | Fuente |
|---|---|---|
| Existe la automatización "Transacción" que salta al usar una tarjeta de Wallet | CONFIRMADO | [S01] |
| Puede ejecutarse sin pedir confirmación ("Transaction" figura en la lista de automatizaciones que se ejecutan solas) | CONFIRMADO | [S69] |
| Entrega tarjeta, comercio e importe como entrada del atajo | FUENTE SECUNDARIA | [S03], [S04] |
| A veces agota el tiempo de espera y no entrega datos | CONFIRMADO (foro oficial, sin solución de Apple) | [S02] |
| Salta también con pagos rechazados | CONFIRMADO (foro oficial) | [S02] |
| No se puede probar en el simulador: hace falta un iPhone con tarjeta real | CONFIRMADO (foro oficial) | [S06] |
| iOS 27 añade la automatización por notificación de una app | CONFIRMADO | [S05], [S10] |
| En iOS 27 la automatización va dentro del atajo y se comparte con él. Llega desactivada | CONFIRMADO lo primero; lo segundo es FUENTE SECUNDARIA | [S05]; [S07], [S11] |
| Una acción de la app puede ejecutarse en segundo plano sin abrir la app | CONFIRMADO | [S34] |
| Los App Intents se declaran en Swift y se compilan en el destino de la app | CONFIRMADO | [S13], [S34] |
| La acción puede lanzar un aviso local con botones desde segundo plano | NO DEMOSTRADO | Se comprueba en el spike |
| App Intents y App Groups funcionan con cuenta gratuita (Personal Team) | NO DEMOSTRADO | Se comprueba en H0 |

### A.2 Flujo completo

```
Pago con Apple Pay
      │
      ▼
Wallet recibe el aviso del emisor ──(no llega o llega tarde)──► FALLO → plan B
      │
      ▼
Atajos: automatización "Transacción"  (iOS 17+)
      │  entrada: tarjeta, comercio, importe
      ▼
Acción de la app "Registrar pago"  (App Intent, segundo plano)
      │ 1. normaliza los datos
      │ 2. descarta duplicados
      │ 3. regla tarjeta → cuenta
      │ 4. regla comercio → categoría
      │ 5. guarda una CAPTURA (estado: pendiente)
      ▼
Aviso local: "Comercio · importe · cuenta · categoría"
      ├─ Guardar   → la captura pasa a MOVIMIENTO
      ├─ Editar    → abre la app en el alta con los datos puestos
      ├─ Descartar → la captura se marca descartada
      └─ (sin respuesta) → queda en la bandeja de capturas
```

Vía complementaria en iOS 27 o posterior:

```
Notificación de Wallet o de la app del banco
      ▼
Atajos: automatización "Notificación" (app elegida por el usuario)
      │  entrada: título, subtítulo, cuerpo, app de origen
      ▼
Acción de la app "Registrar notificación de pago"
      │  extrae importe y comercio del texto
      ▼
Mismo tratamiento: duplicados → reglas → captura → aviso
```

### A.3 Diseño de la acción de la app

| Parámetro | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `importe` | Texto | Sí | Se recibe como texto porque el formato exacto que entrega Atajos no está documentado. La app extrae número y divisa |
| `comercio` | Texto | No | Puede llegar vacío |
| `tarjeta` | Texto | No | Nombre de la tarjeta tal como lo muestra Wallet |
| `origen` | Enumerado | No | `transaccion`, `notificacion` o `manual` |

Resultado: un texto breve ("Guardado en la bandeja") para que el atajo pueda continuar.

Decisiones de diseño:

- La acción **nunca falla hacia fuera**. Si un dato no se entiende, guarda la captura con
  lo que tenga y la marca como incompleta. Un error en la acción haría que iOS avisara de
  que la automatización ha fallado.
- La acción **no abre la app**.
- La acción vive en el destino principal de la app, con un almacén compartido (App Group)
  al que también acceden el widget y la app [S37].
- Modo de guardado configurable: **Preguntar** (por defecto, crea la captura y avisa) o
  **Guardar directamente** (crea el movimiento y avisa de que se ha guardado, con opción
  de deshacer). El requisito del usuario pide el aviso, así que Preguntar es el valor
  inicial.

### A.4 Regla de detección de tarjeta a cuenta

1. Tabla `AliasDeTarjeta`: texto de la tarjeta normalizado → cuenta.
2. Normalización: sin espacios al principio ni al final, minúsculas y sin acentos.
3. Búsqueda por **coincidencia exacta** del texto normalizado. No se usa coincidencia
   aproximada: un error de cuenta es peor que una pregunta.
4. Si hay coincidencia, la captura lleva esa cuenta.
5. Si no hay coincidencia y el usuario solo tiene una cuenta de tipo Banco, se propone
   esa cuenta y se marca como "sugerida".
6. Si no hay coincidencia y hay varias, la captura queda **sin cuenta**. El aviso pregunta
   "¿De qué cuenta es esta tarjeta?". La respuesta crea el alias.
7. Si `tarjeta` llega vacío, se aplica el paso 5 o el 6 sin crear alias.
8. Los alias se ven y se corrigen en Ajustes (P19).

Regla de comercio a categoría: misma mecánica, con el comercio normalizado. Se alimenta
sola: cada vez que el usuario guarda un movimiento con comercio y categoría, se actualiza
la regla con la última elección.

### A.5 Casos límite previstos

| Caso | Tratamiento |
|---|---|
| Pago rechazado (el disparador salta igual) | La app no puede distinguirlo. Por eso el modo por defecto pregunta antes de guardar |
| Importe vacío o ilegible | Captura incompleta: va a la bandeja con aviso "Falta el importe" |
| Divisa distinta del euro | Se guarda el importe y el código de divisa originales y se marca para revisar. Conversión en V2 |
| Abono al transporte público | La guía recomienda excluir la categoría Transporte en el filtro de la automatización, si el usuario lo desea |
| Devolución | Si llega con importe negativo, se propone como reembolso. Si no, lo corrige el usuario |
| Doble captura (Transacción y notificación del mismo pago) | Regla de duplicados |
| Pago desde el Apple Watch | NO DEMOSTRADO si dispara la automatización en el iPhone. Se mide en el spike |
| Pago en línea con Apple Pay | NO DEMOSTRADO para "Transacción". Es el caso que cubriría la vía por notificación |

**Regla de duplicados**: dos capturas son la misma si tienen igual importe, igual cuenta
(o ambas sin cuenta) y menos de 10 minutos de diferencia. Se conserva la primera y se
enriquece con los datos que aporte la segunda. El umbral de 10 minutos es una hipótesis
que se ajusta con la muestra.

### A.6 Plan B cuando el disparador no salta

| Nivel | Mecanismo | Coste para el usuario |
|---|---|---|
| 1 | Vía por notificación (iOS 27): segunda oportunidad automática | Configurar una automatización más |
| 2 | Widget con botón de alta y acción de Atajos "Añadir gasto" | Tres o cuatro toques |
| 3 | Bandeja con "¿Falta algún pago? Añadir a mano" | Tres o cuatro toques |
| 4 | Recordatorio diario opcional "¿Has anotado todo lo de hoy?" | Un vistazo |
| 5 | Cuadre de saldo (B2): al comparar con el saldo real del banco, la app muestra la diferencia y permite ajustarla | Una vez al mes |
| 6 | Importación del fichero del banco para conciliar (V2) | Fuera de V1 |

El nivel 5 es la garantía final: aunque se pierdan capturas, el saldo se puede cuadrar.

### A.7 Guía de configuración para usuarios nuevos

Contenido de la pantalla P04. La guía detecta la versión de iOS y muestra solo su rama.

**iOS 27 o posterior**

1. Tocar **Añadir atajo**: abre Atajos con el atajo "FinancialControl · Pagos", que ya
   incluye la automatización.
2. Tocar **Probar**: ejecuta el atajo una vez para aceptar el permiso de usar acciones de
   la app.
3. Tocar **Abrir Atajos** y activar la automatización "Cuando toco una tarjeta de Wallet".
4. Asignar cada tarjeta a una cuenta (o esperar al primer pago).
5. Opcional: activar la segunda automatización, "Cuando recibo una notificación de
   Wallet", para compras en línea.

**iOS 17 a iOS 26**

1. Abrir Atajos, pestaña Automatización, tocar **+** y elegir **Transacción**.
2. Elegir las tarjetas y **Ejecutar inmediatamente**.
3. Nueva automatización en blanco, añadir la acción **Registrar pago** de FinancialControl.
4. En cada campo, elegir "Entrada del atajo" y la variable que corresponde (importe,
   comercio, tarjeta). La guía lo muestra con capturas.
5. Tocar **Enviar una captura de prueba** en la app para comprobar el aviso.

**Comunes**

- Bloque "Qué debes saber": puede fallar algún pago, no funciona desde Mac ni iPad, hay
  una bandeja para revisar.
- Indicador de estado: fecha y hora de la última captura. Si pasan siete días sin
  capturas y el usuario había activado la función, la app sugiere revisar la guía.
- Los textos de los pasos dependen de la interfaz de Atajos, que cambia entre versiones.
  Se revisan con cada versión mayor de iOS.

Que la app pueda enlazar a un atajo compartido con la automatización incluida es
FUENTE SECUNDARIA [S07]. Se comprueba en el spike.

### A.8 Criterio medible

**Muestra**: al menos 20 pagos reales en tienda, con al menos 2 tarjetas y 5 comercios
distintos, a lo largo de un mínimo de 7 días. Se anota cada pago a mano en una hoja de
control en el momento de pagar.

**Medidas**:

| Medida | Definición |
|---|---|
| Tasa de captura | Pagos con captura creada ÷ pagos reales |
| Tasa de captura correcta | Pagos con captura de importe exacto y cuenta correcta ÷ pagos reales |
| Latencia | Segundos entre el pago y el aviso (mediana) |
| Falsos positivos | Capturas sin pago real (rechazados, duplicados) ÷ capturas |
| Tasa de la vía por notificación | Igual que la tasa de captura, medida sobre la misma muestra con la segunda automatización activa |

**Umbrales de decisión** (propuestos):

| Tasa de captura correcta | Decisión |
|---|---|
| 90 % o más | La captura automática es función principal de V1 |
| Entre 70 % y 90 % | Entra en V1 con el plan B visible y el aviso de que puede fallar. Es el escenario más probable según el foro |
| Menos de 70 % | Se presenta como "experimental". La entrada rápida manual pasa a ser la vía principal |

Criterios adicionales, todos binarios:

- La mediana de la latencia es de 10 segundos o menos.
- El botón Guardar del aviso crea el movimiento sin abrir la app.
- Ninguna captura se pierde: toda captura creada aparece en la bandeja o como movimiento.
- Un usuario que no ha visto la app completa la guía en menos de 5 minutos.

### A.9 Alternativa si el spike fracasa

Si la acción no puede ejecutarse en segundo plano o el aviso con botones no funciona,
la acción abre la app en el alta (P07) con los datos puestos. Es un toque más, pero
cumple el requisito de "aviso que permite añadir el gasto".

---

## Spike B · Inversiones

### B.1 Qué se necesita

Precio actual (cierre del día basta) de acciones, ETF, fondos de inversión y
criptoactivos, para mostrarlo **a usuarios de una app publicada**. Ese último punto es el
decisivo: casi todas las fuentes baratas prohíben mostrar los datos a terceros.

### B.2 Fuentes analizadas

| Fuente | Cobertura | Plan gratuito | ¿Permite mostrar datos a usuarios de la app? | Coste del plan que lo permite | Fuente |
|---|---|---|---|---|---|
| Twelve Data | Acciones, ETF, fondos (valor liquidativo), divisas, cripto. Más de 70 mercados en planes altos | 8 peticiones por minuto, 800 al día | No en el gratuito ("internal non-display usage") ni en los planes personales. Sí en los de empresa. Los precios de fuera de EE. UU. requieren aprobación adicional para uso comercial | Venture: **499 USD al mes** según su página. Una fuente secundaria cita 149 USD: discrepancia sin resolver | [S50], [S51] |
| EODHD | Acciones, ETF, fondos, divisas, cripto e índices a escala mundial | 20 peticiones al día | No. Los planes personales no permiten mostrar ni redistribuir. El comercial "Internal use" (399 USD al mes) tampoco permite mostrar fuera de la empresa | Enterprise: 2.499 USD al mes, o a medida | [S52] |
| Financial Modeling Prep | Sobre todo EE. UU. Cobertura mundial solo en el plan superior | 250 peticiones al día | No sin un acuerdo específico de exhibición y licencia | Sin precio público | [S53] |
| Alpha Vantage | Acciones, divisas, cripto | 25 peticiones al día | Licencia personal y no comercial salvo acuerdo por escrito | Sin precio público | [S55] secundaria |
| Finnhub | Acciones de EE. UU., fundamentales | 60 peticiones por minuto | Planes de uso personal. Uso comercial a través de ventas | Sin precio público | [S55] secundaria |
| Yahoo Finance (no oficial) | Amplia | Sin clave | **No.** Las condiciones prohíben el uso comercial y la extracción automática. No existe API oficial | No aplicable | [S55] secundaria |
| CoinGecko | Criptoactivos | Plan Demo: 100 peticiones por minuto, 10 000 al mes | El uso comercial con atribución se describe para los planes de pago. Para el plan Demo: NO DEMOSTRADO | Basic: 35 USD al mes | [S54] |

Cobertura de fondos de inversión españoles y europeos por ISIN: Twelve Data vende los
ISIN como complemento (desde 24 000 USD al año para uso interno) [S50]. Para el resto,
NO DEMOSTRADO.

### B.3 Conclusión de viabilidad

**Hoy no hay una fuente que sea a la vez gratuita o barata, legal para mostrar datos a
usuarios y con cobertura de fondos europeos.** El valor de mercado automático para
acciones, ETF y fondos queda como **EXTERNAL_GATE**: depende de firmar una licencia y
de tener ingresos que la paguen (del orden de 500 USD al mes como mínimo).

Además, cualquier fuente con clave exige un servidor intermedio: la clave no puede ir
dentro de la app. Esto liga F5 a la decisión de almacenamiento (D2).

### B.4 Alternativas

| Opción | Descripción | Coste | Riesgo |
|---|---|---|---|
| **B-1 Modo manual (recomendada para V1)** | El usuario registra aportaciones y escribe el valor actual de cada cuenta de inversión cuando quiere. La app calcula la rentabilidad simple y muestra la fecha del dato | Ninguno | El dato envejece. Se mitiga con un recordatorio mensual "Actualiza el valor de tus inversiones" |
| B-2 Posiciones con precio manual (V2) | Como B-1 pero por posición: cantidad y precio que escribe el usuario | Ninguno | Más trabajo para el usuario |
| B-3 Clave propia del usuario | El usuario contrata un plan personal de un proveedor y pega su clave en la app. La licencia personal es del usuario | Lo paga el usuario | Hay que confirmar por escrito con el proveedor que este uso encaja en sus condiciones: NO DEMOSTRADO. Complica mucho el uso |
| B-4 Solo cripto automático | Precio de criptoactivos con CoinGecko y atribución visible | 0 o 35 USD al mes | Confirmar las condiciones del plan Demo. Necesita servidor intermedio si lleva clave |
| B-5 Licencia comercial | Plan de empresa de Twelve Data o similar, con servidor intermedio y caché diaria | Desde unos 500 USD al mes | Solo tiene sentido con un modelo de suscripción que lo cubra |

### B.5 Criterio medible

El valor de mercado automático se considera viable solo si se cumplen **las cuatro**
condiciones:

1. **Cobertura**: la fuente devuelve precio para al menos 18 de 20 instrumentos de una
   lista de prueba formada por 5 acciones europeas, 5 ETF UCITS, 5 fondos de inversión
   con ISIN español o luxemburgués y 5 criptoactivos.
2. **Licencia**: existe confirmación por escrito del proveedor de que se pueden mostrar
   los datos a los usuarios de una app publicada.
3. **Coste**: el coste mensual es inferior al 30 % de los ingresos mensuales del producto
   (o inferior a un tope que fije el usuario si el producto es gratuito).
4. **Frescura**: el precio mostrado tiene como máximo un día hábil de antigüedad.

Si falla cualquiera, se mantiene el modo manual.

Criterio del modo manual (V1), binario: con tres aportaciones y un valor actual de
ejemplo, la app muestra el total aportado, el valor, la diferencia en euros y en
porcentaje, y la fecha del valor.

