# 09 · Decisiones del usuario (15/11/2026)

Este documento registra las respuestas del usuario a las decisiones elevadas en la
planificación y sus consecuencias. Manda sobre cualquier texto anterior que lo contradiga.

## 1. Decisiones

| Id | Decisión | Respuesta del usuario | Consecuencia |
|---|---|---|---|
| D1 | Framework multiplataforma | Programa en Java, Python y C++ y deja la elección a lo que mejor convenga al proyecto | Se adopta **React Native con Expo, en TypeScript**, que es la recomendación de `05`. Se valida en el hito H1. Si las bibliotecas en alfa fallan, los intents y el widget se escriben en Swift dentro del mismo proyecto |
| D2 | Almacenamiento | No acepta guardar los datos solo en el iPhone. Quiere una base de datos en la nube gratuita, como Supabase | **Supabase desde V1**: cuentas de usuario, base de datos local en el dispositivo y sincronización. Entra el hito H4 |
| D3 | Alcance de la primera versión | Validado | 48 capacidades: las 49 propuestas, más la sincronización (J4), menos las dos de Notion (J5 y J6) |
| D4 | Modelo de negocio | Gratuita al principio para que la gente la pruebe y para promocionarla. Después, suscripción con un periodo de prueba de unos 6 meses | V1 se publica **gratuita y sin compras**. La suscripción se añade después (tareas T-123 a T-127) |
| D5 | Notion | La app no debe sincronizarse ni integrarse con Notion | Se retiran el spike C, el antiguo hito H4, la entidad de mapeo y el gate de la API de Notion. El usuario sigue con su Notion a mano mientras valida la app |

### Decisión del 16/11/2026

| Id | Decisión | Respuesta del usuario | Consecuencia |
|---|---|---|---|
| D6 | Aspecto y panel de inicio | Tras probar H2 en su iPhone: «funciona pero de forma muy básica», «diseño sobrio», «no disponemos de ningún dashboard». Quiere fondo claro y vistoso, y dashboards con el balance del mes, por cuenta y global | Rediseño visual y pestaña **Inicio** en la rama `h2b-rediseno-inicio`. Se **adelantan de H7** T-080, T-083 y parte de T-081, T-082 y T-084. Presupuesto, gastos fijos y objetivos no se adelantan. El modo claro es la prioridad de diseño |

Inferencias adoptadas en D6, reversibles y no decididas por el usuario: no se suman
divisas distintas (se ve una cada vez); los movimientos de cuentas archivadas cuentan en
el balance global y la cuenta solo se lista si tiene movimientos ese mes; el patrimonio
sigue en Cuentas; anillo en lugar de barras horizontales para el gasto por categoría.

### Decisiones del 17/11/2026

| Id | Asunto | Lo que dijo el usuario | Decisión |
|---|---|---|---|
| D7 | Orden de trabajo | Una app de finanzas debe dejar claro el dinero que se posee, qué se hace con él cada mes y cada día, y las inversiones. Aceptó el plan por bloques | Se trabaja en seis bloques, en este orden: 1) patrimonio, inversiones y vistas por día, mes y año; 2) presupuesto, gastos fijos y objetivos; 3) captura con Apple Pay y widgets; 4) cuentas de usuario y sincronización; 5) versión web; 6) publicación y suscripción. Adelanta T-070 (solo ValorDeInversion), T-075, T-076 y T-082 por delante de H3 y H4. Ver `07`, apartado 2.1 |
| D8 | Versión web | Quiere una versión web para distribuirla y que sea accesible para todo el mundo | **Sí, después de la sincronización.** Se exporta el mismo proyecto de Expo a web y lee y escribe contra Supabase. La base de datos local en web no se usa como única copia: la documentación de Expo declara en alfa el soporte web de `expo-sqlite`. Sin captura de Apple Pay, widgets ni Atajos en web |
| D9 | Monetización | Preguntó por anuncios o visitas. Aceptó la propuesta de suscripción | **Suscripción, sin anuncios y sin afiliación.** Plan gratuito permanente: registro manual, cuentas, Inicio y análisis del mes. Premium: sincronización entre dispositivos y web, inversiones, vista anual e informes, presupuestos y objetivos sin límite, y exportación. Prueba de Premium de **1 mes**. Sustituye la prueba de 6 meses de D4. Se mantiene la fase de lanzamiento gratuita de D4, avisando desde el principio de qué será de pago |

### Decisiones del 18/11/2026

| Id | Asunto | Lo que dijo el usuario | Decisión |
|---|---|---|---|
| D10 | Cifrado de la base de datos local | El cifrado con SQLCipher no entra en el bloque 4a; va en el 4b, junto con la jerarquía de claves de la cuenta | **Aplazado a 4b.** Motivo: una clave que solo viva en el llavero del dispositivo deja los datos ilegibles al cambiar de teléfono o restaurar una copia, y hoy no existe otra copia de los datos. En 4b la clave local quedará envuelta por la clave de la cuenta y será recuperable. Mientras tanto la base queda sin cifrar por la app (hallazgo A-01 de `docs/seguridad/auditoria-4a.md`) y el bloqueo de 4a es solo una barrera de interfaz |
| D11 | Modelo de sincronización | Cifrado de extremo a extremo con código de recuperación | **El servidor solo almacenará contenido cifrado en el dispositivo.** La contraseña no saldrá del dispositivo; habrá un código de recuperación generado en el alta; sin contraseña y sin código, los datos del servidor no se podrán recuperar. Consecuencias: el operador no puede leer los datos ni ayudar a recuperarlos, y la versión web (D8) tendrá que descifrar en el navegador. Requisitos comprobables en `docs/seguridad/modelo-de-amenazas.md`, apartado 4 |

Decisiones de diseño del bloque 4a tomadas por el dueño en el encargo (no se reabren): el
bloqueo viene desactivado y no cifra nada; no hay PIN propio de la app; ninguna clave se
vincula a la biometría; el modo privado es independiente del bloqueo y viene desactivado.

Estado de D7 a 17/11/2026: el bloque 1 está hecho en la rama `h3-vision-completa`. El
detalle y lo que queda pendiente de cada tarea están en `07`, apartado 2.2, y en
`estado.md`, apartado 8.

El bloque 2 (planificación) está hecho en la rama `h5-planificacion`, sin notificaciones
del sistema: ver `07`, apartado 2.3, y `estado.md`, apartado 9.

Consecuencias de D9 que hay que resolver antes del bloque 6:

- La exportación de datos figura en Premium, pero el RGPD da derecho a la portabilidad. Una
  exportación básica debe seguir siendo gratuita. Estado: PENDIENTE DE DEFINIR.
- La sincronización es Premium y D2 la daba por incluida en V1. Hay que decidir si la cuenta
  de usuario es obligatoria en el plan gratuito o si este funciona solo en el dispositivo.
  Estado: PENDIENTE DE DEFINIR. Afecta a los supuestos del apartado 3.
- El precio no está decidido.
- Cobrar suscripciones exige alta fiscal y declaración de IVA. Consultar con un gestor.

## 2. Datos confirmados

- El usuario trabaja en un Mac con Xcode y la app Apple Developer instalados.
- **No está inscrito** en el Apple Developer Program. La inscripción cuesta 99 USD al año
  y hace falta para TestFlight y para publicar.
- Existe un repositorio de GitHub clonado en `~/Desktop/FinancialControl`, rama `main`.

## 3. Supuestos adoptados, pendientes de confirmar

Son inferencias razonables a partir de las respuestas. No son decisiones del usuario.

1. **La cuenta de usuario es obligatoria** para usar la app, porque los datos se guardan
   en el servidor. Alternativa: permitir probarla sin cuenta y ofrecer el registro después.
2. **Registro con correo y contraseña**, más inicio de sesión con Apple si la cuenta de
   desarrollador lo permite.
3. **El plan gratuito de Supabase se usa en el desarrollo y en la beta.** El plan de
   producción se decide antes de publicar (tarea T-111).
4. **La fase gratuita no tiene fecha de fin fijada.** Conviene fijar por adelantado la
   fecha o el número de usuarios que activa la suscripción.

## 4. Hechos verificados que sustentan D2 y D4

| Hecho | Fuente | Consulta |
|---|---|---|
| El plan gratuito de Supabase incluye 500 MB de base de datos, 50 000 usuarios activos al mes y dos proyectos activos | https://supabase.com/pricing [S56] | 15/11/2026 |
| Los proyectos gratuitos se pausan tras una semana sin actividad y no incluyen copias de seguridad automáticas | https://supabase.com/pricing [S56] | 15/11/2026 |
| El plan Pro de Supabase parte de 25 USD al mes | https://supabase.com/pricing [S56] | 15/11/2026 |
| Una suscripción autorrenovable admite una prueba gratuita de 3 días, 1 o 2 semanas, 1, 2, 3 o 6 meses, o 1 año | App Store Connect Help [S70] | 15/11/2026 |
| Cada cliente solo puede usar una oferta de introducción por grupo de suscripción | App Store Connect Help [S70] | 15/11/2026 |

Sin verificar todavía:

- Si una app con registro por correo y contraseña debe ofrecer además el inicio de sesión
  con Apple. Estado: NO DEMOSTRADO. Revisar la directriz vigente antes de H4.
- Si el inicio de sesión con Apple funciona con una cuenta de desarrollador gratuita.
  Estado: NO DEMOSTRADO. Se comprueba en T-005.

## 5. Pendiente del usuario

1. Modelo de iPhone, versión de iOS y si tiene tarjetas en Wallet. Sin esto no se puede
   ejecutar el spike de Apple Pay.
2. Confirmar o corregir los cuatro supuestos del apartado 3.
3. Tope de gasto mensual que acepta mientras la app sea gratuita.
4. Resuelto en parte por D9 (17/11/2026). Falta el precio, qué exportación es gratuita, si el
   plan gratuito exige cuenta y qué pasa con quienes ya usaban la app.

## 6. Documentos modificados por estas decisiones

`00` (fuente S70), `01` (J4, J5 y J6), `02` (alcance validado), `03` (pantallas P22 y P23 y
flujo F10), `04` (spike C retirado), `05` (apartados 2.3 y 3.2), `06` (privacidad, RGPD y
modelo de negocio), `07` (hoja de ruta recalculada), `08` (riesgos R-11 a R-13, R-16,
R-19, R-25 y R-26, y gate G-05) e `INFORME-FINAL.md`.
