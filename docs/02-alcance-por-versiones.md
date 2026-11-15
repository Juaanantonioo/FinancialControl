# 02 · Propuesta de alcance por versiones

**Estado: VALIDADA por el usuario el 15/11/2026**, con dos cambios derivados de sus
decisiones: entra la sincronización (J4, decisión D2) y sale Notion (J5 y J6, decisión D5).
Ver `09-decisiones.md`.

Los identificadores remiten al catálogo de `01-catalogo-y-competencia.md`.

## 1. Criterio de corte

La primera versión debe cumplir tres condiciones a la vez:

1. **Útil para un usuario nuevo** que no usa Notion ni sabe qué es Atajos: puede anotar,
   ver su mes y planificarlo sin configurar nada externo.
2. **Cubre el uso actual del primer usuario**: gastos, ingresos, cuentas, gastos fijos y
   objetivos, con alimentación desde Apple Pay.
3. **Depende de un solo tercero**, Supabase, para las cuentas de usuario y la
   sincronización (decisión D2). Sin fuente de precios y sin banco.

Todo lo que exige licencia de datos o regulación sale de V1.

## 2. Versión 1 (V1)

| Bloque | Capacidades | Motivo |
|---|---|---|
| Registro | A1, A2, A3, A4, A9, A10, A11 | Núcleo. Sin transferencias (A3) las inversiones y el efectivo contarían como gasto, que es el defecto del Notion actual |
| Cuentas | B1, B2, B5 (básico) | Saldo por cuenta y patrimonio neto como suma de saldos. El cuadre (B2) evita que el usuario pierda la confianza en la cifra |
| Planificación | C1, C2, C3, C4 (hasta fin de mes), C5 | El usuario pide planificar el gasto del mes. C3 es la cifra que más se consulta en las apps analizadas |
| Ahorro | D1, D2, D3, D5 | Sustituye la tabla de Objetivos de Notion y corrige el campo "Aportado" a mano |
| Gastos fijos | E1, E2, E3, E4 | Sustituye la tabla de Gastos fijos y alimenta C3 y C4 |
| Inversiones | F1, F2, F3 | Modo manual: aportado, valor actual y rentabilidad simple. Cubre el uso actual sin depender del spike B |
| Análisis | G1, G2, G3 | Los tres gráficos que responden a "en qué gasto" y "voy mejor o peor" |
| Avisos | H1, H2, H6 | Los que tienen dato fiable desde el primer mes |
| Entrada rápida | I1, I3, I4, I5, I6, I8 | Requisito destacado y su red de seguridad. I2 entra si el spike A lo valida |
| Datos | J1, J2, J4, J7, J8, J9 | Exportar, copiar y borrar: confianza y RGPD. Sincronización con cuenta de usuario en Supabase (decisión D2) |
| Transversal | K1, K2, K3, K4 (español) | Primera configuración, accesibilidad y modo oscuro son requisitos de calidad, no extras |

Total: 48 capacidades de 94.

### Lo que V1 no hace, dicho con claridad

- No se conecta a ningún banco.
- No muestra cotizaciones: el valor de las inversiones lo escribe el usuario.
- No funciona sin cuenta de usuario: los datos se guardan también en el servidor.
- No tiene todavía versión de Android.
- No promete capturar todos los pagos de Apple Pay. La app lo explica en la guía.
- No da consejos financieros.

## 3. Versión 1.x (mejoras tras publicar)

| Capacidades | Motivo de aplazarlas |
|---|---|
| A7 reembolsos, B7 archivo de cuentas | Útiles pero no bloquean el primer mes de uso |
| C8 mes financiero a medida | Necesita validar con usuarios reales cuántos lo piden |
| D4 fondo de emergencia, H3 objetivo en riesgo, H4 saldo previsto bajo | Necesitan dos o tres meses de datos para dar cifras con sentido |
| E5 subidas de precio, E7 coste anual | Requieren histórico de las reglas |
| G4, G5, G6 | Análisis secundarios |
| I7 controles de pantalla de bloqueo | Exige iOS 18. El widget (I6) ya cubre la necesidad en V1 |
| I2 captura por notificación | Solo si no entra en V1 |
| K4 inglés | Tras estabilizar los textos en español |

## 4. Versión 2

| Capacidades | Condición |
|---|---|
| Versión de Android (I12) | La sincronización (J4) ya está en V1, de modo que Android parte con los datos disponibles |
| F4, F6, F7 posiciones, distribución y TIR | Independientes de la fuente de precios |
| F5, F9 valor de mercado automático | EXTERNAL_GATE: licencia de exhibición de datos (spike B) |
| B3 tarjetas de crédito con ciclo, B4 deudas y préstamos | Modelo contable más complejo. Conviene tener base de usuarios antes |
| A5 división de gastos, A8 adjuntos | Demanda por confirmar |
| C4 previsión a varios meses, C6 traspaso de sobrante | Amplían la planificación |
| E6 detección de suscripciones, H5 gasto inusual, G7 informe anual | Necesitan histórico largo |
| I9 importación de ficheros del banco | Esfuerzo alto por la variedad de formatos |
| J3 varias divisas | El modelo de datos lo prevé desde V1 para no migrar |

## 5. Más adelante (sin compromiso)

A6 gasto compartido, A12 OCR de tiques, B6 bienes no financieros, C7 método de sobres,
D6 ahorro por regla, F8 dividendos y comisiones, I13 voz, J10 finanzas compartidas,
K7 Apple Watch, K8 retos.

## 6. Descartado

| Capacidad | Motivo |
|---|---|
| I10 conexión bancaria | Exige agregador con licencia, coste por usuario y regulación. Decisión por defecto adoptada: sin bancos en V1. Se revisará si el producto tiene ingresos que lo paguen |
| I11 FinanceKit | No disponible en España [S08]. Se reabre si Apple lo extiende a la UE |
| G8 preguntas en lenguaje natural | Coste por uso y envío de datos financieros a un tercero. Choca con el argumento de privacidad |
| K5 informe fiscal | Riesgo de presentarse como asesoramiento y normativa cambiante |
| K6 recomendación de productos financieros | Conflicto de interés con el usuario y posible actividad regulada |
| J5, J6 importación y sincronización con Notion | Decisión D5 del usuario: la app no se integra con Notion. El usuario lo mantiene por su cuenta mientras valida la app |

## 7. Cobertura del uso actual del primer usuario

| Uso actual en Notion | Cubierto en V1 por |
|---|---|
| Tracker de gastos | A1, A9, A10, A11 |
| Tracker de ingresos | A2 |
| Cuentas con saldo inicial y agregados | B1, B2, B5 |
| Gastos fijos con día de cobro y estado activo | E1 a E4 |
| Objetivos con meta, aportado y fecha límite | D1 a D3 |
| Inversión anotada como categoría de gasto | F1 a F3 (pasa a ser transferencia a una cuenta de inversión) |
| Fórmulas mensuales | G1 a G3, C2, D5 (se calculan, no se guardan) |
| Alimentación por Atajos | I1, I3, I4, I5, I8 |
| Notion en paralelo | Fuera de la app. El usuario lo mantiene a mano mientras valida |

## 8. Validación

El usuario validó el alcance el 15/11/2026. Las inversiones de V1 son manuales. La
sincronización entra en V1 por la decisión D2 y Notion sale por la decisión D5.
