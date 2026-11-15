# 06 · Requisitos de publicación y lista de comprobación de medios

Fuentes `[Sxx]` en `00-fuentes-y-revalidacion.md`. Fecha de consulta: 15/11/2026.

Las referencias legales son orientativas. **No constituyen asesoramiento jurídico.**
Antes de publicar conviene que un profesional revise la política de privacidad.

## 1. Lista de comprobación de medios

### 1.1 Ya comprobado en este equipo (15/11/2026)

| Medio | Estado | Acción |
|---|---|---|
| Mac | ✅ Apple M2, macOS 27.2 | Ninguna |
| Xcode | ✅ 27.2 instalado en `/Applications/Xcode.app` | Activarlo como directorio de desarrollo: `sudo xcode-select -s /Applications/Xcode.app`. Abrirlo una vez para aceptar la licencia e instalar componentes |
| Espacio en disco | ⚠️ 32 GB libres | Liberar espacio. Los simuladores y las compilaciones ocupan decenas de GB |
| Sesión de desarrollador en Xcode | ❌ Sin identidades de firma | Xcode › Ajustes › Cuentas › añadir el Apple Account |
| Node.js | ✅ 22.20.0 | Ninguna |
| Flutter, CocoaPods, EAS CLI | ❌ No instalados | Instalar los que correspondan según la decisión D1 |

### 1.2 Por comprobar por el usuario

| # | Pregunta | Cómo comprobarlo | Si la respuesta es no |
|---|---|---|---|
| 1 | ¿Tengo un Apple Account con autenticación de doble factor? | Ajustes del iPhone › [nombre] › Inicio de sesión y seguridad | Activarla. Es requisito para inscribirse [S20] |
| 2 | ¿Estoy inscrito en el Apple Developer Program? | Entrar en https://developer.apple.com/account. Si aparece "Membership details" con fecha de caducidad, sí | Ver 1.3 |
| 3 | ¿Con qué tipo de inscripción? | En la misma página: "Entity type" indica Individual u Organization | Ver 1.3 |
| 4 | ¿Tengo un iPhone para pruebas y qué versión de iOS lleva? | Ajustes › General › Información | Hace falta iOS 17 o posterior para la captura. iOS 27 para la vía por notificación |
| 5 | ¿Tengo al menos una tarjeta en Wallet con la que pago en tiendas? | App Wallet | Sin ella no se puede ejecutar el spike A |
| 6 | ¿Soy mayor de edad? | — | La inscripción exige mayoría de edad legal [S20] |

Respuesta del usuario (15/11/2026): **no está inscrito** en el Apple Developer Program.
Tiene instaladas Xcode y la app Apple Developer.

### 1.3 Tipo de inscripción

| | Cuenta gratuita (Personal Team) | Programa como particular | Programa como organización |
|---|---|---|---|
| Coste | 0 | 99 USD al año [S20] | 99 USD al año [S20] |
| Requisitos | Apple Account | Apple Account con doble factor y nombre legal | Entidad jurídica, número D-U-N-S, web pública y persona con capacidad de obligar a la entidad (FUENTE SECUNDARIA [S26] para el detalle) |
| Probar en mi iPhone | Sí, hasta 3 dispositivos. La app caduca a los 7 días y hay que reinstalarla [S21] | Sí | Sí |
| TestFlight y App Store | No | Sí | Sí |
| Nombre de vendedor en el App Store | — | **Nombre legal de la persona** [S20] | Nombre de la entidad |
| FinanceKit | No | No | Requisito necesario, no suficiente [S09] |
| Sirve para | Empezar a desarrollar y, quizá, el spike A (ver nota) | Publicar V1 | Publicar con marca propia |

Nota: que App Intents, App Groups y widgets funcionen con Personal Team está NO
DEMOSTRADO. Se comprueba en el hito H0. Si no funcionan, la inscripción de pago pasa a
ser necesaria desde H1.

**Recomendación**: empezar con la cuenta gratuita en H0 e inscribirse como particular
cuando H0 confirme que hace falta, o como muy tarde antes de H9 (TestFlight). La
conversión posterior de particular a organización es posible contactando con Apple [S20].

## 2. Requisitos de revisión del App Store aplicables

| Directriz | Qué exige | Cómo se cumple | Fuente |
|---|---|---|---|
| **3.2.1(viii)** | "Apps used for financial trading, investing, or money management should be submitted by the financial institution performing such services and must have necessary licensing and permissions" | **Riesgo a vigilar.** La app no presta ningún servicio financiero: no mueve dinero, no intermedia, no asesora. Es un registro personal. En el App Store hay apps de presupuesto de desarrolladores individuales, lo que indica que la directriz se aplica a quien presta el servicio. Mitigación: descripción y notas de revisión que lo dejen claro, y ningún texto que sugiera gestión de dinero real | [S27] |
| **5.1.1(i)** | Enlace a la política de privacidad en App Store Connect y dentro de la app. Debe decir qué datos se recogen, cómo, para qué, con quién se comparten, cuánto se conservan y cómo pedir su borrado | Política publicada en una URL estable y enlazada en Ajustes | [S27] |
| **5.1.1(ii)** | Consentimiento para recoger datos y forma sencilla de retirarlo. Textos de permiso claros | Solo se piden notificaciones (y Face ID si se activa el bloqueo). Texto de propósito específico | [S27] |
| **5.1.1(iii)** | Minimización de datos | La app no pide contactos, ubicación ni fotos en V1 | [S27] |
| **5.1.1(v)** | Si no hay funciones basadas en cuenta, dejar usar la app sin registro. Si hay creación de cuenta, ofrecer su eliminación dentro de la app | V1 tiene cuentas de usuario (decisión D2). La eliminación de cuenta dentro de la app es obligatoria desde V1 | [S27], [S28] |
| **5.1.2(i)** | Informar de adónde van los datos personales y obtener permiso expreso para compartirlos con terceros | V1 guarda los datos en Supabase, que actúa como encargado del tratamiento. Se explica en la política y antes del registro | [S27] (redacción citada en fuente secundaria) |
| **3.1.1** | Desbloquear funciones dentro de la app exige compra dentro de la app | Si hay pago único o suscripción, se usa StoreKit. Sin claves de licencia ni pagos externos | [S27] |
| **3.1.2(a)** | La suscripción debe aportar valor continuado, durar al menos siete días y funcionar en todos los dispositivos del usuario | Aplica cuando se active la suscripción, después de la fase gratuita (decisión D4) | [S27] |
| **2.1** | App completa y funcional. La revisión debe poder probarla | La captura de Apple Pay no se puede probar sin tarjeta real: incluir en las notas de revisión un vídeo de demostración y el botón "Enviar una captura de prueba". PENDIENTE DE REVALIDAR el texto exacto de la directriz | [S27] |
| **2.3** | Metadatos y capturas fieles | No prometer captura automática del 100 % ni conexión con bancos. PENDIENTE DE REVALIDAR el texto exacto | [S27] |
| **Sin directriz localizada** (asesoramiento) | No presentar la app como asesoramiento financiero. Es una prohibición del propio proyecto | Aviso visible: "FinancialControl no ofrece asesoramiento financiero". Directriz concreta de Apple sobre este punto: NO DEMOSTRADO | — |

### Categoría y clasificación

- Categoría principal: **Finanzas**.
- Clasificación por edades: la que resulte del cuestionario de App Store Connect.
  PENDIENTE DE VERIFICAR.

## 3. Privacidad en el App Store

### 3.1 Etiquetas de privacidad

Apple define "recoger" como transmitir datos fuera del dispositivo de forma que el
desarrollador o sus socios puedan acceder a ellos más tiempo del necesario para atender
la petición [S29].

| Escenario | Etiqueta resultante |
|---|---|
| Solo local (descartado por D2), sin analítica ni SDK de terceros | **"No se recogen datos"** |
| Con analítica o informes de fallos de terceros | Declarar "Datos de uso" y "Diagnóstico" |
| **Con servidor: escenario de V1 por la decisión D2** | Declarar **"Información financiera › Otra información financiera"** ("salary, income, assets, debts, or any other financial information" [S29]), "Información de contacto › Correo electrónico" e "Identificadores", vinculados al usuario, con finalidad "Funcionalidad de la app" |

### 3.2 Manifiesto de privacidad

Si la app incluye SDK de terceros, debe describir qué datos recogen. Los manifiestos de
privacidad lo hacen en un formato estándar que Xcode combina [S30]. Tarea: revisar las
dependencias del framework elegido antes del envío.

### 3.3 Ley de Servicios Digitales (DSA): condición de comerciante

Apple debe verificar y **publicar en la ficha del App Store** los datos de contacto de
los comerciantes que distribuyen en la UE: dirección, teléfono y correo [S31], en
aplicación de los artículos 30 y 31 del Reglamento (UE) 2022/2065 [S68].

- El desarrollador debe autoevaluar si es comerciante. Apple no lo decide [S31].
- Indicios habituales: obtener ingresos con la app y actuar con fines profesionales
  (FUENTE SECUNDARIA).
- **Consecuencia para un particular**: si la app cobra, es probable que haya que
  declararse comerciante y que la **dirección y el teléfono personales queden a la vista**
  en la ficha. Conviene preverlo: dirección profesional o apartado, y teléfono dedicado.
- Si no se es comerciante, los consumidores de la UE son informados de que no se aplican
  los derechos de consumo en sus contratos con el desarrollador [S31].

## 4. Obligaciones del RGPD

Los datos financieros personales **no** son categoría especial del artículo 9 del RGPD,
pero son datos sensibles en la práctica y merecen cuidado reforzado.

### 4.1 Escenario solo local (descartado por D2, se conserva como referencia)

Si los datos nunca salen del dispositivo, el desarrollador no los trata. El usuario los
usa en el ámbito personal o doméstico (art. 2.2.c RGPD). Aun así:

| Obligación | Base | Cómo se cumple |
|---|---|---|
| Informar con transparencia | Arts. 12 y 13 RGPD; directriz 5.1.1(i) | Política de privacidad breve y veraz: qué se guarda, dónde, que no se envía a nadie |
| Protección de datos desde el diseño y por defecto | Art. 25 RGPD | Almacenamiento local, sin analítica por defecto, bloqueo opcional con Face ID |
| Portabilidad y supresión, como buena práctica | Arts. 17 y 20 RGPD | Exportación a CSV y botón "Borrar todos los datos" |
| Información del prestador | Art. 10 LSSI [S67] | Nombre, contacto y, si procede, NIF en la web y en la política |
| Correos de soporte | Art. 6.1.b o 6.1.f RGPD | Los correos que envíen los usuarios sí son datos tratados: mencionarlo en la política |

### 4.2 Escenario con servidor: el de V1 por la decisión D2

El desarrollador pasa a ser **responsable del tratamiento**. Se añaden:

| Obligación | Artículo |
|---|---|
| Base jurídica: ejecución del contrato para el servicio; consentimiento para analítica no esencial | Art. 6.1.b y 6.1.a RGPD |
| Principios: minimización, limitación de la finalidad y del plazo de conservación | Art. 5 RGPD |
| Derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición, con respuesta en un mes | Arts. 15 a 22 y 12.3 RGPD |
| Contrato de encargado del tratamiento con el proveedor de nube | Art. 28 RGPD |
| Registro de actividades de tratamiento (con excepciones para organizaciones pequeñas que no siempre aplican) | Art. 30 RGPD |
| Medidas de seguridad: cifrado en tránsito y en reposo, control de accesos | Art. 32 RGPD |
| Notificación de brechas a la AEPD en 72 horas y, si hay riesgo alto, a los afectados | Arts. 33 y 34 RGPD |
| Evaluación de impacto si el tratamiento entraña alto riesgo | Art. 35 RGPD. Valorar con un profesional |
| Transferencias internacionales: preferir alojamiento en la UE o garantías adecuadas | Arts. 44 a 49 RGPD |
| Derechos digitales y particularidades nacionales | LOPDGDD [S66] |
| Eliminación de cuenta dentro de la app | Directriz 5.1.1(v) [S28] |

## 5. Alternativas de modelo de negocio

**Decisión D4 (15/11/2026)**: lanzamiento gratuito para dar a conocer la app y, más
adelante, suscripción con una prueba gratuita larga, del orden de seis meses. App Store
Connect admite pruebas gratuitas de 3 días, 1 o 2 semanas, 1, 2, 3 o 6 meses y 1 año, y
cada cliente solo puede usar una por grupo de suscripción [S70]. La tabla siguiente se
conserva como justificación.

Datos comunes: comisión del 15 % para desarrolladores con hasta un millón de USD de
ingresos en el año anterior y para los nuevos, a través del App Store Small Business
Program [S32]. Fuera del programa, las suscripciones dejan el 70 % el primer año y el
85 % después [S33]. La inscripción al programa de desarrolladores cuesta 99 USD al año
en todos los casos [S20].

| Modelo | Cómo funciona | A favor | En contra | Consecuencias |
|---|---|---|---|---|
| **Gratuita** | Todo gratis, sin compras | Máxima adopción. Posible declaración de no comerciante en la DSA (a valorar). Sin gestión fiscal de ventas. Revisión más sencilla | Sin ingresos: el desarrollador paga los 99 USD al año. No financia servidor ni datos de mercado | Coherente con V1 solo local. Cierra el paso al valor de mercado automático y a la sincronización de pago |
| **Pago único por descarga** | La app cuesta un precio fijo | Simple. Sin gestión de suscripciones. Gusta a quien rechaza las suscripciones (el caso de Bluecoins [S61]) | Barrera de entrada: nadie puede probarla. Ingreso único frente a coste de mantenimiento continuo | Comerciante en la DSA. Alta en actividad económica y fiscalidad de las ventas (consultar con un asesor) |
| **Gratuita con desbloqueo único** | Uso básico gratis y una compra dentro de la app que desbloquea funciones avanzadas | Se puede probar. Ingreso sin suscripción. Referencia de mercado: entre 15 y 45 € | Hay que decidir qué queda detrás del pago. Ingreso único | Exige compras dentro de la app (3.1.1) [S27]. Comerciante en la DSA |
| **Suscripción** | Cuota mensual o anual por funciones avanzadas | Ingreso recurrente que puede pagar servidor y licencias de datos. Referencia: entre 20 y 70 € al año en apps con conexión bancaria | Rechazo creciente a las suscripciones en apps sin banco. Obliga a aportar valor continuado (3.1.2) [S27]. Más gestión | Solo se justifica si hay costes recurrentes reales (sincronización, precios de mercado). Comerciante en la DSA |
| **Mixto** | Gratis en local. Desbloqueo único para funciones avanzadas locales. Suscripción solo para lo que tiene coste de servidor | Cada pago se corresponde con un coste real. Explicación honesta al usuario | Tres niveles que explicar. Más trabajo de implementación | Permite publicar V1 gratuita o con desbloqueo único y añadir la suscripción en V2 |

### Qué podría quedar detrás de un pago, si lo hubiera

A título de ejemplo, sin decidir: captura automática sin confirmación, presupuestos y
objetivos ilimitados, análisis avanzado, exportación automática. Nunca: el alta manual,
la exportación de los propios datos ni el borrado.

### Dependencia con otras decisiones

- Con Supabase (D2) hay coste recurrente desde que la app tenga usuarios reales: el plan
  Pro parte de 25 USD al mes [S56], más los 99 USD al año del programa. Durante la fase
  gratuita ese coste lo asume el desarrollador.
- Si se quiere valor de mercado automático (spike B), hace falta un ingreso recurrente
  del orden de 500 USD al mes solo para la licencia.
- Si se cobra, la condición de comerciante de la DSA y la fiscalidad entran en juego.

## 6. Lista de comprobación previa al envío

- [ ] Inscripción en el Apple Developer Program activa.
- [ ] Condición de comerciante declarada en App Store Connect.
- [ ] Acuerdo de apps de pago aceptado y datos bancarios y fiscales completos, si hay cobro.
- [ ] Política de privacidad publicada y enlazada en la app y en App Store Connect.
- [ ] Eliminación de cuenta disponible dentro de la app.
- [ ] Proyecto de Supabase de producción en región de la UE y contrato de encargado aceptado.
- [ ] Etiquetas de privacidad cumplimentadas según el escenario real.
- [ ] Manifiestos de privacidad de las dependencias revisados.
- [ ] Textos de permiso (notificaciones, Face ID) específicos y en español.
- [ ] Aviso "no es asesoramiento financiero" visible en la bienvenida y en Ajustes.
- [ ] Capturas de pantalla con datos de ejemplo, nunca reales.
- [ ] Descripción sin promesas de captura total ni de conexión con bancos.
- [ ] Notas para la revisión: cómo probar la captura sin tarjeta, con vídeo de demostración.
- [ ] Prueba completa en un iPhone limpio: instalar, configurar, anotar, exportar, borrar.
- [ ] Revisión de accesibilidad con VoiceOver y texto grande.
- [ ] Compilación con la versión de Xcode que Apple exija en la fecha de envío
      (requisito vigente: PENDIENTE DE VERIFICAR en la fecha).
