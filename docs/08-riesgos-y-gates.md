# 08 · Registro de riesgos y gates

Fuentes `[Sxx]` en `00-fuentes-y-revalidacion.md`. Fecha: 15/11/2026.

Escalas: probabilidad e impacto en **Alta**, **Media** o **Baja**.

## 1. Registro de riesgos

| Id | Riesgo | Prob. | Impacto | Mitigación | Señal de alerta | Dónde se trata |
|---|---|---|---|---|---|---|
| R-01 | La automatización "Transacción" pierde una parte apreciable de los pagos (tiempo de espera de Wallet) | Alta | Alto | Medirlo en el spike A con umbrales de decisión. Bandeja de capturas, vía por notificación, widget y cuadre de saldo. No prometer captura total en ningún texto | Tasa de captura correcta inferior al 70 % | H1, `04` A.6 y A.8 |
| R-02 | El usuario nuevo no consigue configurar la automatización | Alta | Alto | Guía por versión de iOS, atajo ya montado en iOS 27, captura de prueba, indicador de estado y prueba con tres personas ajenas | Menos de 2 de 3 personas completan la guía | T-037, T-107 |
| R-03 | La captura salta con pagos rechazados y crea gastos falsos | Media | Medio | Modo por defecto "Preguntar". Descartar en un toque | Falsos positivos por encima del 10 % | `04` A.5 |
| R-04 | Las bibliotecas de Expo para intents y widgets están en alfa y cambian o fallan | Media | Alto | Validarlas en H1. Fijar versiones. Salida: escribir la capa en Swift dentro del mismo proyecto | T-010 o T-039 no cumplen su criterio | `05` 2.3 |
| R-05 | Apple cambia Atajos en una versión mayor de iOS y la guía o la acción dejan de servir | Media | Alto | Probar con las betas de iOS cada verano. Guía con ramas por versión. Textos de la guía fáciles de actualizar | Aviso de cambios en la sesión de Atajos de la WWDC | EXTERNAL_GATE G-04 |
| R-06 | La revisión rechaza la app por la directriz 3.2.1(viii) al enviarla un particular | Baja | Alto | Dejar claro que no se presta ningún servicio financiero. Aviso de no asesoramiento. Plan alternativo: inscripción como organización | Mensaje de rechazo que cite la directriz | `06` 2, G-01 |
| R-07 | La revisión no puede probar la captura de Apple Pay y la considera incompleta | Media | Medio | Vídeo de demostración, botón de captura de prueba y notas detalladas | Rechazo por 2.1 | T-109 |
| R-08 | No hay fuente de precios de mercado legal y asequible | Alta | Medio | Modo manual en V1. Revisar el mercado en V2. Vincular la función a un ingreso recurrente | Ningún proveedor confirma por escrito el derecho de exhibición por menos del tope fijado | `04` B, G-03 |
| R-09 | Pérdida de datos por cambio o avería del móvil sin copia | Media | Alto | Copia de seguridad en fichero, recordatorio periódico de copia y, en V1.x, copia automática a iCloud Drive | Usuarios que escriben por pérdida de datos | T-092 |
| R-10 | Errores de cálculo de dinero (redondeo, transferencias contadas como gasto) | Media | Alto | Céntimos enteros, pruebas automáticas de cada cálculo | Una prueba de cálculo falla | T-021, T-099 |
| R-11 | La sincronización pierde, duplica o pisa movimientos | Media | Alto | Identificadores generados en el dispositivo, marca de modificación, borrado lógico y pruebas con dos instalaciones y sin conexión | T-135 o T-136 no cumplen su criterio | H4 |
| R-12 | Una regla de acceso mal escrita deja ver o modificar datos de otro usuario | Baja | Alto | Reglas de acceso por fila en todas las tablas, prueba automática con dos usuarios y ninguna clave de servicio dentro de la app | La prueba de T-131 falla o aparece una tabla sin reglas | T-131 |
| R-13 | El proyecto gratuito de Supabase se pausa por inactividad, se queda corto o carece de copias de seguridad cuando ya hay usuarios [S56] | Media | Alto | Proyecto de producción separado, decisión de plan antes de publicar y copias de seguridad definidas | Aviso de pausa o de cuota de Supabase | T-111, G-05 |
| R-14 | El alcance de V1 crece y la publicación se retrasa | Alta | Medio | Alcance validado por escrito (D3). Toda petición nueva va a V1.x salvo que sustituya a otra | Hitos que pasan de dos semanas | `02` |
| R-15 | Una sola persona desarrolla: enfermedad, falta de tiempo o pérdida de interés | Media | Alto | Hitos cortos y probables, documentación en el repositorio y primer uso real pronto (H4) para que el proyecto ya dé valor | Dos hitos seguidos sin entrega | — |
| R-16 | Fuga o acceso indebido a datos financieros guardados en el servidor | Media | Alto | Reglas de acceso por fila, cifrado en tránsito, sesión en el llavero, bloqueo con Face ID, contrato de encargado y plan de brechas | — | `06` 4.2, T-131, T-112 |
| R-17 | Publicar como particular expone el nombre legal y, si hay cobro, la dirección y el teléfono | Alta si hay cobro | Medio | Decidirlo antes de enviar: dirección profesional y teléfono dedicado, o inscripción como organización | — | `06` 3.3 |
| R-18 | La app se percibe como asesoramiento financiero | Baja | Alto | Ningún texto recomienda productos ni decisiones. Las previsiones se rotulan como tales. Aviso en la bienvenida y en Ajustes | Una cadena de la app usa "deberías" o "te recomendamos" | T-098 |
| R-19 | El coste recurrente no se cubre durante la fase gratuita | Media | Medio | Coste fijo conocido: 99 USD al año del programa y, con usuarios reales, el plan de pago de Supabase. Fijar por adelantado la fecha o el número de usuarios que activa la suscripción | El gasto mensual supera el tope que fije el usuario | `06` 5, T-123 |
| R-20 | La versión de Android no alcanza una captura comparable | Media | Medio | No prometer paridad. Estudiar la política de Google Play antes de comprometer fechas | Rechazo de Google Play por el acceso a notificaciones | G-06 |
| R-21 | La cuenta gratuita no permite probar intents, almacén compartido ni widgets | Media | Bajo | Comprobarlo en H0. Si no, inscribirse antes de H1 (99 USD) | T-005 da "no" en alguna capacidad | T-005 |
| R-22 | Poco espacio en disco bloquea Xcode y los simuladores | Media | Bajo | Liberar espacio antes de H0 | Errores de compilación por espacio | T-002 |
| R-23 | Datos de precios o condiciones obtenidos de fuentes secundarias resultan erróneos | Media | Bajo | Están etiquetados. Revalidar en fuente oficial antes de usarlos en una decisión | — | `00` |
| R-24 | La vía por notificación depende del texto de cada banco y extrae mal el importe | Media | Medio | Empezar solo con la notificación de Wallet. Capturas dudosas a la bandeja como incompletas. Ampliar a bancos concretos con pruebas reales | Importes erróneos en T-015 | `04` A.2 |
| R-25 | El paso de gratuita a suscripción provoca rechazo y bajas | Media | Medio | Avisar desde el lanzamiento de que habrá suscripción, prueba gratuita de 6 meses y decisión previa sobre el trato a quienes ya la usaban | Reseñas negativas que citan el cobro | T-123 |
| R-26 | Exigir registro antes de poder probar la app reduce las altas | Media | Medio | Registro en un solo paso e inicio de sesión con Apple. Valorar un modo de prueba sin cuenta en V1.x | Menos de la mitad de quienes abren la app en la beta completan el registro | T-132, T-107 |

## 2. Lista de EXTERNAL_GATE

Un gate es una condición externa al proyecto que puede bloquear o cambiar una función.
Ninguno bloquea el inicio del desarrollo.

| Id | Gate | Qué bloquea | Estado | Quién decide | Cómo se vigila | Alternativa |
|---|---|---|---|---|---|---|
| G-01 | **Revisión del App Store** | La publicación | Abierto. Se resuelve en H9 | Apple | Lista de comprobación de `06` apartado 6 y notas para la revisión | Corregir y reenviar. Inscripción como organización si el motivo es 3.2.1(viii) |
| G-02 | **Autorizaciones de Apple**: entitlement de FinanceKit y su disponibilidad en España | La captura sin Atajos | Cerrado para España [S08]. Exige además cuenta de organización [S09] | Apple | Revisar la página de FinanceKit tras cada WWDC | Atajos (vía actual) |
| G-03 | **Fuentes de precios**: licencia para mostrar datos de mercado a los usuarios | El valor de mercado automático (F5, F9) | Abierto. Sin fuente viable hoy | Proveedores de datos | T-085 y revisión anual de condiciones | Modo manual |
| G-04 | **Cambios de iOS** en Atajos, App Intents, Wallet y avisos | La captura de pagos y la guía | Vigilancia continua. iOS 27 ha mejorado la situación [S05] | Apple | Betas de iOS cada junio, notas de versión y el hilo 765516 [S02] | Entrada rápida manual |
| G-05 | **Supabase**: plan, cuotas, pausa por inactividad y condiciones | Las cuentas de usuario y la sincronización | Abierto. Plan gratuito para el desarrollo y la beta. Plan de producción por decidir en T-111 | Supabase y el usuario | Panel de uso de Supabase y su página de precios [S56] | Llevar la base de datos a otro servicio de PostgreSQL |
| G-06 | **Política de Google Play** sobre el acceso a notificaciones | La captura en Android | NO DEMOSTRADO. Se estudia antes de planificar Android | Google | Consultar la política oficial al empezar la versión de Android | Entrada manual y widget en Android |
| G-07 | **Apple Developer Program**: inscripción y verificación de identidad | TestFlight y la publicación | El usuario no está inscrito (15/11/2026) | Apple y el usuario | T-003, T-100 | Ninguna para publicar |
| G-08 | **Condición de comerciante (DSA)** y verificación de datos de contacto | La distribución en la UE si hay cobro | Se activa al introducir la suscripción (T-124) | Apple y el usuario | T-103 | App gratuita |
| G-09 | **Requisito de versión de Xcode y SDK** vigente en la fecha de envío | El envío | PENDIENTE DE VERIFICAR en la fecha. Xcode 27.2 está instalado | Apple | Noticias para desarrolladores de Apple | Actualizar Xcode |
| G-10 | **Emisor de la tarjeta y red de pago**: que Wallet reciba el aviso de la transacción a tiempo | La fiabilidad de la captura para cada usuario | No controlable. Varía por banco [S02] | Bancos y redes | Datos de la muestra del spike A, por tarjeta | Vía por notificación de la app del banco |

## 3. Supuestos que, si fallan, obligan a replanificar

| Supuesto | Estado |
|---|---|
| El usuario tiene un iPhone con iOS 17 o posterior y una tarjeta en Wallet | Sin confirmar |
| El usuario puede dedicar tiempo de forma regular durante unas 18 semanas | Sin confirmar |
| La automatización entrega importe, comercio y tarjeta como texto utilizable | Fuente secundaria. Se confirma en H1 |
| Una acción de la app puede lanzar un aviso con botones desde segundo plano | No demostrado. Se confirma en H1 |
| El plan gratuito de Supabase basta para el desarrollo y la beta | Razonable con los límites publicados [S56] |
| Los datos de V1 caben sin problemas en una base de datos local | Razonable para uso personal |
