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
4. Qué funciones quedarán detrás de la suscripción y qué pasa con quienes ya la usaban.

## 6. Documentos modificados por estas decisiones

`00` (fuente S70), `01` (J4, J5 y J6), `02` (alcance validado), `03` (pantallas P22 y P23 y
flujo F10), `04` (spike C retirado), `05` (apartados 2.3 y 3.2), `06` (privacidad, RGPD y
modelo de negocio), `07` (hoja de ruta recalculada), `08` (riesgos R-11 a R-13, R-16,
R-19, R-25 y R-26, y gate G-05) e `INFORME-FINAL.md`.
