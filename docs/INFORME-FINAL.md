# Informe final · Diseño y planificación de FinancialControl

Fecha: 15/11/2026. No se ha escrito código de producción ni de spikes. No se ha leído
ni escrito nada en Notion ni en los Atajos del usuario.

**Revisión 2 (15/11/2026)**: incorpora las cinco decisiones del usuario, retira la
integración con Notion y recalcula la hoja de ruta. Ver `09-decisiones.md`.

## Estado final

**PARTIALLY_COMPLETED**

Los ocho entregables están redactados y las cinco decisiones del usuario están
respondidas. No se declara COMPLETED porque los **dos spikes están diseñados pero no
ejecutados**: tienen criterio medible y alternativa, pero no hay mediciones. Su ejecución
necesita un iPhone con tarjeta real y está planificada en los hitos H1 y H7.

## 1. Decisiones adoptadas por defecto

| Decisión | Valor |
|---|---|
| Divisa inicial | Euro. El modelo guarda el código de divisa en cada cuenta |
| Idioma inicial | Español, con todas las cadenas en catálogo de traducción |
| Conexión con bancos | Ninguna en la primera versión |
| Cuenta de usuario | Obligatoria para usar la app. Inferencia a partir de la decisión D2, pendiente de confirmar |
| Versión mínima de iOS (propuesta) | iOS 17.0 |
| Modo de captura por defecto | Preguntar antes de guardar |

## 2. Decisiones del usuario (cerradas el 15/11/2026)

| Id | Decisión | Respuesta | Documento |
|---|---|---|---|
| D1 | Framework multiplataforma | React Native con Expo. El usuario programa en Java, Python y C++ y deja la elección al criterio técnico | `05`, apartado 2 |
| D2 | Almacenamiento y sincronización | Supabase desde V1, con base de datos local y sincronización | `05`, apartado 3 |
| D3 | Alcance de la primera versión | Validado: 48 capacidades | `02` |
| D4 | Modelo de negocio | Gratuita al lanzar y suscripción después, con una prueba gratuita de unos 6 meses | `06`, apartado 5 |
| D5 | Notion | Sin integración. El usuario lo mantiene por su cuenta mientras valida la app | `09` |

Datos que siguen pendientes, sin bloquear el inicio:

- Modelo de iPhone, versión de iOS y si hay tarjetas en Wallet.
- El usuario no está inscrito en el Apple Developer Program. Hará falta antes de TestFlight.
- Plan de Supabase para producción y tope de gasto mensual durante la fase gratuita.
- Qué queda detrás de la suscripción y cómo se trata a quienes ya usaban la app.

## 3. Hallazgos de viabilidad

### Revalidación de las restricciones de partida

| Restricción | Resultado |
|---|---|
| R1 Apple Pay solo por la automatización "Transacción" | Confirmada. Los campos que entrega solo constan en fuentes secundarias |
| R2 El disparador falla y lo configura el usuario | Confirmada. Novedad: también salta con pagos rechazados. En iOS 27 la app puede ofrecer el atajo ya montado |
| R3 FinanceKit no viable en España | Confirmada. Reino Unido exige iOS 18.4, no 17.4 |
| R4 Disparador por notificación en iOS 27 | **Pasa de NO DEMOSTRADO a confirmado** con las notas oficiales de Apple del 26/10/2026 |
| R5 Capa nativa en Swift y puentes | Confirmada. `expo-app-intents` está en alfa. `flutter_app_intents` lleva trece meses sin actividad |
| R6 Captura en Android | **Pasa a parcialmente demostrada**: existe `NotificationListenerService` y una app publicada lo usa. Sin paridad con iOS |
| R7 Apple Developer Program, 99 USD al año | Confirmada |
| R8 Compilar sin Mac | **Confirmado para Expo.** Poco relevante: el usuario tiene Mac |

Ninguna restricción verificada ha resultado falsa.

### Medios del usuario

Comprobado en este equipo: **Mac con chip M2, macOS 27.2 y Xcode 27.2 instalado.** Falta
activar Xcode como directorio de desarrollo e iniciar sesión. Solo hay 32 GB libres.
La inscripción en el programa de desarrolladores no se puede comprobar desde aquí.

### Spikes

| Spike | Hallazgo | Criterio | Alternativa |
|---|---|---|---|
| A · Apple Pay | Viable sobre el papel con dos vías: "Transacción" (iOS 17+) y notificación (iOS 27+). La fiabilidad es el riesgo principal | Tasa de captura correcta sobre 20 pagos o más: 90 % función principal, 70-90 % con plan B visible, menos de 70 % experimental | La acción abre la app en el alta con los datos puestos |
| B · Inversiones | **Ninguna fuente analizada permite mostrar precios a usuarios de una app por menos de unos 500 USD al mes.** Las gratuitas lo prohíben | Cobertura de 18 de 20 instrumentos, licencia por escrito, coste asumible y precio de un día hábil como máximo | Modo manual (recomendado para V1) |

## 4. Alcance propuesto para la primera versión

Registro de gastos, ingresos y transferencias; cuentas con saldo y cuadre; patrimonio
neto; presupuesto mensual por categoría con disponible por día; gastos fijos con
calendario y avisos; objetivos con aportaciones y ritmo necesario; inversiones en modo
manual; tres análisis (categorías, tendencia, comparativa); captura de Apple Pay con
aviso, bandeja, reglas y guía; widget; exportación, copia de seguridad, bloqueo y
borrado; cuenta de usuario y sincronización con Supabase.

Fuera de V1: bancos, cotizaciones automáticas, Android, la suscripción y cualquier
integración con Notion.

## 5. Resumen de hitos

| Hito | Semanas | Entrega |
|---|---|---|
| H0 | 1 | Entorno listo y decisiones cerradas |
| H1 | 2 | Spike de Apple Pay medido |
| H2 | 2 | Núcleo de movimientos |
| H3 | 2 | Captura integrada, guía y widget |
| H4 | 2 | Cuentas de usuario y sincronización. **Primer uso real** |
| H5 | 2 | Presupuesto y gastos fijos |
| H6 | 2 | Objetivos, cuentas e inversión manual |
| H7 | 1 | Análisis y cierre del spike B |
| H8 | 2 | Datos, cuenta, primera configuración y calidad |
| H9 | 2 | Beta y **envío a revisión** |

18 semanas, 91 tareas y 245 puntos hasta el envío a revisión. Después del envío hay
8 tareas más (21 puntos), cinco de ellas para la suscripción. Todas tienen criterio de
aceptación binario.

## 6. Riesgos principales

1. **R-01** La captura de Apple Pay pierde pagos. Se mide en H1 y hay cinco niveles de plan B.
2. **R-02** El usuario nuevo no logra configurar la automatización. Guía por versión y prueba con terceros.
3. **R-04** Bibliotecas de Expo en alfa. Salida: capa en Swift en el mismo proyecto.
4. **R-06** Rechazo por la directriz 3.2.1(viii) al publicar un particular una app de gestión de dinero.
5. **R-08** Sin fuente de precios asequible. Modo manual.
6. **R-14 y R-15** Crecimiento del alcance y dependencia de una sola persona.
7. **R-17** Publicar como particular expone el nombre legal y, si se cobra, dirección y teléfono.
8. **R-11 a R-13** La sincronización, las reglas de acceso y el plan gratuito de Supabase.
9. **R-19 y R-25** Coste fijo durante la fase gratuita y rechazo al pasar a suscripción.

## 7. Pendientes externos

| Gate | Estado |
|---|---|
| G-01 Revisión del App Store | Abierto, se resuelve en H9 |
| G-02 FinanceKit en España | Cerrado por Apple |
| G-03 Licencia de precios de mercado | Abierto, sin fuente viable |
| G-04 Cambios de iOS en Atajos | Vigilancia continua |
| G-05 Supabase: plan, cuotas y condiciones | Abierto |
| G-06 Política de Google Play para notificaciones | No demostrado |
| G-07 Inscripción en el Apple Developer Program | El usuario no está inscrito |
| G-08 Condición de comerciante (DSA) | Se activa con la suscripción |
| G-09 Versión de Xcode exigida en la fecha de envío | Pendiente de verificar |
| G-10 Aviso del emisor de la tarjeta a Wallet | No controlable |

## 8. Entregables

| # | Entregable | Fichero | Estado |
|---|---|---|---|
| — | Fuentes y revalidación | `docs/00-fuentes-y-revalidacion.md` | Completo |
| 1 | Catálogo de capacidades y análisis de apps | `docs/01-catalogo-y-competencia.md` | Completo. Precios de la competencia en parte de fuente secundaria |
| 2 | Alcance por versiones | `docs/02-alcance-por-versiones.md` | Validado |
| 3 | Diseño de producto | `docs/03-diseno-de-producto.md` | Completo para el alcance propuesto |
| 4 | Informes de los dos spikes | `docs/04-spikes-viabilidad.md` | Diseñados, no ejecutados |
| 5 | Comparativa de arquitectura y modelo de datos | `docs/05-arquitectura-y-modelo-de-datos.md` | Completo, con D1 y D2 cerradas |
| 6 | Requisitos de publicación y lista de medios | `docs/06-publicacion.md` | Completo, con D4 cerrada |
| 7 | Hoja de ruta y backlog | `docs/07-hoja-de-ruta-y-backlog.md` | Recalculada con las decisiones del usuario |
| 8 | Registro de riesgos y gates | `docs/08-riesgos-y-gates.md` | Completo |
| — | Decisiones del usuario | `docs/09-decisiones.md` | Completo |

## 9. Comprobación de los criterios de éxito

| Criterio | Resultado |
|---|---|
| El catálogo cubre las diez áreas y cada capacidad está clasificada con motivo | Cumplido: 94 capacidades en 11 áreas. La clasificación figura en `01` y el motivo en `02` |
| El análisis de apps cita fuente y fecha de cada dato | Cumplido, con seis de ocho apps apoyadas en fuentes secundarias fechadas |
| Cada afirmación técnica lleva fuente oficial, versión y fecha | **Cumplido en parte.** Lo que solo tiene fuente secundaria o no se ha revalidado está etiquetado como tal: campos que entrega Atajos, versiones de bibliotecas de gráficos, referencias a WCAG, textos de las directrices 2.1 y 2.3, y normativa citada de memoria |
| Los dos spikes tienen criterio medible y alternativa | Cumplido. Sin ejecutar |
| Todas las pantallas de V1 aparecen en algún flujo | Cumplido para las 21 originales. P22 y P23 se añadieron en la revisión 2 y sus esquemas están pendientes |
| Todo campo del Notion tiene correspondencia o figura como descartado | Cumplido con lo inspeccionado. Cinco evidencias pendientes en `05`, apartado 5.7 |
| Toda tarea tiene criterio binario y ningún hito supera las dos semanas | Cumplido: 99 tareas, recontadas de forma automática en la revisión 2 |
| Las decisiones elevadas están respondidas o listadas como bloqueo | Cumplido: las cinco están respondidas |

## 10. Siguiente paso

Empezar el hito H0 con el prompt de `docs/prompt-claude-code-h0-h2.md`.
