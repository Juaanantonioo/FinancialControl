# 01 · Catálogo de capacidades y análisis de apps existentes

Las fuentes `[Sxx]` están en `00-fuentes-y-revalidacion.md`. Fecha de consulta: 15/11/2026.

Esfuerzo relativo: **S** (días), **M** (una o dos semanas), **L** (varias semanas),
**XL** (meses o depende de terceros).
La columna "Versión" adelanta la clasificación que se razona en `02-alcance-por-versiones.md`:
**V1**, **V1.x** (poco después), **V2**, **Más adelante**, **Descartado**.

## 1. Catálogo de capacidades

### A. Registro de movimientos

| Id | Capacidad | Problema que resuelve | Datos que necesita | Esf. | Dependencias externas | Versión |
|---|---|---|---|---|---|---|
| A1 | Alta manual de gasto | Anotar un pago en segundos | Importe, cuenta, categoría, fecha, nombre | S | Ninguna | V1 |
| A2 | Alta manual de ingreso | Saber cuánto entra y de dónde | Igual que A1, con categoría de ingreso | S | Ninguna | V1 |
| A3 | Transferencia entre cuentas | Mover dinero sin contarlo como gasto ni ingreso | Cuenta de origen, cuenta de destino, importe, fecha | S | Ninguna | V1 |
| A4 | Movimientos recurrentes | No teclear cada mes lo que se repite | Regla (importe, periodicidad, día, cuenta, categoría) | M | Ninguna | V1 |
| A5 | División de un gasto en varias categorías | Un tique de supermercado con comida y hogar | Líneas con importe y categoría | M | Ninguna | V2 |
| A6 | Gasto compartido con otra persona | Saber qué parte es mía y qué me deben | Participantes, reparto, estado de la deuda | L | Ninguna | Más adelante |
| A7 | Reembolsos y devoluciones | Que una devolución reduzca el gasto de su categoría | Vínculo con el gasto original | S | Ninguna | V1.x |
| A8 | Notas, etiquetas y adjuntos (foto del tique) | Recuperar el contexto de un gasto | Texto, etiquetas, imagen | M | Permiso de cámara o fotos | V2 |
| A9 | Búsqueda y filtros | Encontrar un movimiento concreto | Índice sobre los movimientos | S | Ninguna | V1 |
| A10 | Categorización sugerida por comercio | Menos pasos al guardar | Historial comercio a categoría | S | Ninguna | V1 |
| A11 | Edición y borrado con deshacer | Corregir errores sin miedo | Borrado lógico | S | Ninguna | V1 |
| A12 | Lectura de tique por foto (OCR) | Evitar teclear importe y comercio | Imagen, texto reconocido | L | Framework Vision en iOS, equivalente en Android | Más adelante |

### B. Cuentas y patrimonio

| Id | Capacidad | Problema que resuelve | Datos que necesita | Esf. | Dependencias externas | Versión |
|---|---|---|---|---|---|---|
| B1 | Cuentas con saldo (banco, efectivo, inversión) | Saber cuánto hay en cada sitio | Saldo inicial con fecha y movimientos | S | Ninguna | V1 |
| B2 | Ajuste de saldo (cuadre) | Corregir la deriva frente al saldo real | Saldo real en una fecha | S | Ninguna | V1 |
| B3 | Tarjetas de crédito con ciclo y liquidación | Distinguir lo gastado de lo ya pagado al banco | Día de corte, día de cargo, cuenta de liquidación | M | Ninguna | V2 |
| B4 | Deudas y préstamos (lo que debo y lo que me deben) | Ver el pasivo y su calendario | Principal, tipo, cuotas, contraparte | L | Ninguna | V2 |
| B5 | Patrimonio neto y su evolución | Saber si en conjunto se avanza | Saldos de todas las cuentas por fecha | M | Ninguna | V1 (básico) |
| B6 | Bienes no financieros (coche, vivienda) | Patrimonio completo | Valor estimado manual | S | Ninguna | Más adelante |
| B7 | Archivo de cuentas cerradas | Conservar el histórico sin ruido | Marca de archivada | S | Ninguna | V1.x |

### C. Planificación mensual

| Id | Capacidad | Problema que resuelve | Datos que necesita | Esf. | Dependencias externas | Versión |
|---|---|---|---|---|---|---|
| C1 | Presupuesto mensual por categoría | Poner un límite a cada tipo de gasto | Importe previsto por categoría y mes | M | Ninguna | V1 |
| C2 | Previsto frente a real | Ver las desviaciones a tiempo | C1 y los movimientos | S | Ninguna | V1 |
| C3 | Disponible hasta fin de mes ("puedo gastar X al día") | Decidir hoy sin hacer cuentas | Presupuesto, gastado, fijos pendientes, días restantes | S | Ninguna | V1 |
| C4 | Previsión de tesorería con cobros y pagos fijos | Anticipar un saldo bajo antes de que ocurra | Saldos, recurrentes, fechas | M | Ninguna | V1 (fin de mes), V2 (varios meses) |
| C5 | Copiar el presupuesto del mes anterior | Crear el presupuesto en un toque | Presupuesto previo | S | Ninguna | V1 |
| C6 | Traspaso del sobrante o del exceso al mes siguiente | Presupuestos que se acumulan | Saldo de cada categoría | M | Ninguna | V2 |
| C7 | Método de sobres ("cada euro tiene un destino") | Disciplina de asignación total | Ingresos asignables y sobres | L | Ninguna | Más adelante |
| C8 | Mes financiero a medida (de nómina a nómina) | El mes real no empieza el día 1 | Día de inicio del periodo | S | Ninguna | V1.x |

### D. Ahorro

| Id | Capacidad | Problema que resuelve | Datos que necesita | Esf. | Dependencias externas | Versión |
|---|---|---|---|---|---|---|
| D1 | Objetivos con meta y fecha | Dar forma a un propósito de ahorro | Meta, fecha límite, tipo | S | Ninguna | V1 |
| D2 | Aportaciones a un objetivo | Que el avance salga de movimientos reales y no de un número a mano | Aportación vinculada a un movimiento o manual | S | Ninguna | V1 |
| D3 | Plan de aportación periódica ("necesitas X al mes") | Saber el ritmo necesario | Meta, fecha, aportado | S | Ninguna | V1 |
| D4 | Fondo de emergencia (meses de gasto cubiertos) | Medir el colchón | Gasto medio mensual y saldo del fondo | S | Ninguna | V1.x |
| D5 | Tasa de ahorro mensual | Un único indicador de salud | Ingresos y gastos del periodo | S | Ninguna | V1 |
| D6 | Redondeo o ahorro automático por regla | Ahorrar sin decidir cada vez | Reglas y movimientos | M | No mueve dinero real: solo anota | Más adelante |

### E. Suscripciones y gastos fijos

| Id | Capacidad | Problema que resuelve | Datos que necesita | Esf. | Dependencias externas | Versión |
|---|---|---|---|---|---|---|
| E1 | Lista de gastos fijos y suscripciones | Ver el compromiso mensual total | Nombre, importe, día, tipo, activo | S | Ninguna | V1 |
| E2 | Calendario de cobros | Saber qué se cobra y cuándo | E1 | S | Ninguna | V1 |
| E3 | Aviso previo a un cobro | Que no pille por sorpresa | E1 y permiso de notificaciones | S | Notificaciones locales | V1 |
| E4 | Confirmación de un cobro fijo en un toque | Convertir el previsto en movimiento real | E1 | S | Ninguna | V1 |
| E5 | Detección de subidas de precio | Enterarse de que una suscripción sube | Histórico de importes por regla | S | Ninguna | V1.x |
| E6 | Detección automática de suscripciones a partir del histórico | Descubrir cobros que no se sabía que se tenían | Movimientos de varios meses | M | Ninguna | V2 |
| E7 | Coste anual y recordatorio de renovación o cancelación | Decidir si compensa | E1 con periodicidad anual | S | Ninguna | V1.x |

### F. Inversiones

| Id | Capacidad | Problema que resuelve | Datos que necesita | Esf. | Dependencias externas | Versión |
|---|---|---|---|---|---|---|
| F1 | Aportaciones a inversión como transferencia | Que invertir no cuente como gasto | Cuenta de inversión y transferencia | S | Ninguna | V1 |
| F2 | Valor actual manual de la cuenta de inversión | Ver cuánto vale hoy sin depender de nadie | Valor y fecha introducidos por el usuario | S | Ninguna | V1 |
| F3 | Rentabilidad simple (valor frente a aportado) | Saber si se gana o se pierde | F1 y F2 | S | Ninguna | V1 |
| F4 | Posiciones (activo, cantidad, precio de compra) | Detalle por valor | Operaciones de compra y venta | M | Ninguna | V2 |
| F5 | Valor de mercado automático | No actualizar precios a mano | Identificador del activo y precio | XL | Fuente de precios con licencia de exhibición: EXTERNAL_GATE (spike B) | V2, condicionado |
| F6 | Distribución por tipo de activo | Ver la diversificación | Clase de activo por posición | S | Ninguna | V2 |
| F7 | Rentabilidad ponderada por dinero (TIR) | Rentabilidad real con aportaciones irregulares | Flujos fechados y valor final | M | Ninguna | V2 |
| F8 | Dividendos y comisiones | Rentabilidad completa | Movimientos de dividendo y comisión | M | Ninguna | Más adelante |
| F9 | Criptoactivos con precio automático | Cobertura para quien los tiene | Identificador y precio | L | CoinGecko u otra con licencia: EXTERNAL_GATE | V2, condicionado |

### G. Análisis

| Id | Capacidad | Problema que resuelve | Datos que necesita | Esf. | Dependencias externas | Versión |
|---|---|---|---|---|---|---|
| G1 | Gasto por categoría del periodo | En qué se va el dinero | Movimientos | S | Biblioteca de gráficos | V1 |
| G2 | Tendencia de varios meses | Si se gasta más o menos que antes | Movimientos de seis a doce meses | S | Biblioteca de gráficos | V1 |
| G3 | Comparativa entre dos meses | Qué ha cambiado | Movimientos de dos periodos | S | Ninguna | V1 |
| G4 | Categorías que más crecen | Dónde mirar primero | Serie por categoría | S | Ninguna | V1.x |
| G5 | Resumen periódico (semanal o mensual) | Revisar sin entrar a buscar | Agregados del periodo | M | Notificaciones locales | V1.x |
| G6 | Principales comercios | Dónde se compra más | Nombre de comercio normalizado | S | Ninguna | V1.x |
| G7 | Informe anual | Balance del año | Movimientos del año | M | Ninguna | V2 |
| G8 | Preguntas en lenguaje natural sobre los datos | Consultas libres | Modelo de lenguaje | XL | Servicio de IA, coste y privacidad | Descartado por ahora |

### H. Avisos

| Id | Capacidad | Problema que resuelve | Datos que necesita | Esf. | Dependencias externas | Versión |
|---|---|---|---|---|---|---|
| H1 | Presupuesto a punto de agotarse (umbral, por ejemplo 80 %) | Frenar antes de pasarse | C1 y C2 | S | Notificaciones locales | V1 |
| H2 | Cobro próximo | Igual que E3 | E1 | S | Notificaciones locales | V1 |
| H3 | Objetivo en riesgo | Reaccionar si el ritmo no alcanza | D1 a D3 | S | Notificaciones locales | V1.x |
| H4 | Saldo previsto bajo | Evitar un descubierto | C4 | S | Notificaciones locales | V1.x |
| H5 | Gasto inusual | Detectar un cargo raro | Estadística por categoría | M | Ninguna | V2 |
| H6 | Recordatorio de capturas sin revisar | Que la bandeja no se acumule | Bandeja de capturas | S | Notificaciones locales | V1 |

### I. Entrada rápida

| Id | Capacidad | Problema que resuelve | Datos que necesita | Esf. | Dependencias externas | Versión |
|---|---|---|---|---|---|---|
| I1 | Captura de Apple Pay con la automatización "Transacción" | El requisito destacado: aviso para guardar el gasto al pagar | Tarjeta, comercio e importe que entrega Atajos | L | Atajos (iOS 17 o posterior), configuración por el usuario, fiabilidad de Wallet [S01][S02] | V1 |
| I2 | Captura por notificación (Wallet o app del banco) | Cubrir compras en línea y fallos de I1 | Título y cuerpo de la notificación | L | iOS 27 o posterior [S05], formato del texto de cada emisor | V1 si el spike A lo valida, si no V1.x |
| I3 | Guía de configuración dentro de la app | Sin ella un usuario nuevo no logra activar I1 | Pasos por versión de iOS | M | Cambios de Atajos entre versiones | V1 |
| I4 | Regla tarjeta a cuenta | Detectar la cuenta sin preguntar | Alias de tarjeta y cuenta | S | Texto que entregue Wallet | V1 |
| I5 | Bandeja de capturas pendientes | Nada se pierde si no se atiende el aviso | Capturas sin confirmar | M | Ninguna | V1 |
| I6 | Widget de pantalla de inicio (resumen y botón de alta) | Ver y anotar sin abrir la app | Agregados del mes | M | WidgetKit, capa nativa [S36] | V1 |
| I7 | Control en pantalla de bloqueo, Centro de control y botón de acción | Alta desde el móvil bloqueado | Acción de la app | M | iOS 18 o posterior [S35] | V1.x |
| I8 | Acción de Atajos y Siri "Añadir gasto" | Alta por voz o desde automatizaciones propias | Parámetros del gasto | S | App Intents [S34] | V1 (sale de I1) |
| I9 | Importación de ficheros del banco (CSV, Excel) | Cargar histórico y conciliar | Fichero y mapeo de columnas | L | Formatos de cada banco, sin estándar | V2 |
| I10 | Conexión bancaria (open banking, PSD2) | Movimientos automáticos | Consentimiento, agregador con licencia | XL | Agregador de pago y regulación: EXTERNAL_GATE | Descartado en V1 |
| I11 | FinanceKit | Datos de Wallet sin Atajos | Entitlement de Apple | XL | No disponible en España [S08]: EXTERNAL_GATE | Descartado hasta que cambie |
| I12 | Captura en Android por notificaciones | Equivalente a I1 e I2 en Android | Texto de notificaciones de pago | L | `NotificationListenerService` [S17], política de Google Play | Con la versión de Android |
| I13 | Alta por voz o dictado libre | Manos libres | Texto dictado | M | Reconocimiento de voz | Más adelante |

### J. Datos

| Id | Capacidad | Problema que resuelve | Datos que necesita | Esf. | Dependencias externas | Versión |
|---|---|---|---|---|---|---|
| J1 | Exportación a CSV | Que los datos sean del usuario | Todos los movimientos | S | Ninguna | V1 |
| J2 | Copia de seguridad y restauración en fichero | No perder nada al cambiar de móvil | Base de datos completa | M | Selector de archivos del sistema | V1 |
| J3 | Varias divisas | Viajes y cuentas en otra moneda | Divisa por cuenta y tipo de cambio | L | Fuente de tipos de cambio | V2 (el modelo lo admite desde V1) |
| J4 | Sincronización entre dispositivos | Mismo dato en móvil y tableta, y paso a Android | Cuenta de usuario y servidor | XL | Servidor, coste, RGPD | V1 (decisión D2: Supabase) |
| J5 | Importación inicial desde Notion | Migrar el histórico del primer usuario | Token de Notion y bases de datos | M | API de Notion [S45][S46] | Descartado (decisión D5) |
| J6 | Sincronización temporal hacia Notion | Mantener Notion al día mientras se valida la app | Igual que J5 | L | API de Notion: EXTERNAL_GATE | Descartado (decisión D5) |
| J7 | Bloqueo con Face ID o código | Privacidad ante terceros | Ninguno | S | LocalAuthentication | V1 |
| J8 | Borrado total de datos | Derecho de supresión y confianza | Ninguno | S | Ninguna | V1 |
| J9 | Datos de ejemplo para probar | Que un usuario nuevo vea la app llena | Juego de datos ficticio | S | Ninguna | V1 |
| J10 | Finanzas compartidas (pareja, familia) | Una economía común | Cuentas de usuario y permisos | XL | Servidor | Más adelante |

### K. Áreas añadidas

| Id | Capacidad | Problema que resuelve | Datos que necesita | Esf. | Dependencias externas | Versión |
|---|---|---|---|---|---|---|
| K1 | Primera configuración guiada | Llegar al primer gasto anotado en pocos minutos | Cuentas y categorías iniciales | M | Ninguna | V1 |
| K2 | Accesibilidad (VoiceOver, texto grande, contraste) | Que la use cualquiera | Ninguno | M | Ninguna | V1 |
| K3 | Modo oscuro | Comodidad y coherencia con el sistema | Ninguno | S | Ninguna | V1 |
| K4 | Textos preparados para traducir | Abrir otros mercados después | Catálogo de cadenas | S | Ninguna | V1 (español), inglés en V1.x |
| K5 | Informe fiscal o ayuda para la renta | Preparar la declaración | Reglas fiscales | XL | Normativa cambiante, riesgo de parecer asesoramiento | Descartado |
| K6 | Recomendaciones de productos financieros | Monetización por afiliación | Perfil del usuario | L | Regulación, conflicto con la confianza | Descartado |
| K7 | App para Apple Watch | Alta desde la muñeca | Acción de la app | L | watchOS | Más adelante |
| K8 | Retos y rachas de registro | Crear el hábito de anotar | Días con registro | S | Ninguna | Más adelante |

Total: 94 capacidades en 11 áreas. Las diez áreas mínimas de la FASE 1 están cubiertas
(A a J) y se añade K.

## 2. Análisis de apps disponibles en el App Store de España

Ocho apps. Los precios cambian con frecuencia y según el canal de compra. Cuando el dato
no procede de la web oficial se marca como **secundaria** con su fecha de comprobación.

| App | Qué ofrece | Cómo captura los gastos | Modelo de precio | Fuente y fecha |
|---|---|---|---|---|
| **Wallet by BudgetBakers** | Gastos e ingresos con categorías y subcategorías, plantillas, presupuestos, pagos planificados, varias divisas, cuentas compartidas, seguimiento de acciones y fondos. iOS, Android y web | Manual gratis. Conexión bancaria en Premium (más de 15 000 entidades según su web). En Android, lectura de notificaciones de Google Pay | Gratuita con Premium. App Store de España: 5,99 €/mes o 29,99 €/año, y opciones de varios años | [S61] secundaria, 14/09/2026; [S62] secundaria, 02/10/2026; captura en Android: [S18] oficial, 19/06/2025 |
| **Spendee** | Carteras, presupuestos, carteras compartidas, etiquetas, varias divisas, escáner de tiques, web | Manual gratis. Conexión bancaria solo en Premium (más de 9 000 bancos en 53 países, a través de Salt Edge y Plaid) | Gratis (una cartera de efectivo y un presupuesto). Plus 3,99 €/mes o 29,99 €/año. Premium **8,99 €/mes o 49,99 €/año** según su web. Dos fuentes secundarias dan 6,99 €/mes y 39,99 €/año: hay discrepancia, puede ser un cambio de precio reciente | [S59] oficial, 15/11/2026; [S61], [S62] secundarias |
| **MoneyWiz** | Presupuestos avanzados, informes configurables, varias divisas, acciones, bonos y cripto. Solo iPhone, iPad y Mac | Manual. Conexión bancaria en Premium (40 000 bancos en 55 países según la fuente) | Gratis con límites. Standard 24,99 €/año. Premium 69,99 €/año o 6,99 €/mes | [S61] secundaria, 14/09/2026; [S63] secundaria |
| **Monefy** | Registro manual muy rápido con gráfico por categorías. Sin presupuestos avanzados | Manual. Sin banco. Sincroniza con Google Drive o Dropbox | Gratis. Premium de pago (42,99 € o 69,99 € según el paquete) | [S61] secundaria, 14/09/2026 |
| **Money Manager (Realbyte)** | Contabilidad personal detallada por cuentas y categorías, estilo partida doble | Manual. Sin banco | Gratis con anuncios. 2,49 €/mes o 21,49 €/año | [S62] secundaria, 02/10/2026; [S61] secundaria |
| **Fintonic** | Agregador bancario español. Estima el gasto por categoría. Hoy orientado a préstamos, seguros y su puntuación de crédito FinScore | Conexión bancaria como forma de funcionar (proveedor de información sobre cuentas autorizado por el Banco de España) | Gratuita. Gana dinero intermediando préstamos y seguros | [S62] secundaria, 02/10/2026; [S63] secundaria |
| **YNAB** | Método de presupuesto "cada euro tiene un destino". Objetivos, informes, web | Manual o importación de ficheros. Conexión con bancos seleccionados de EE. UU., Canadá, Reino Unido y UE | Solo suscripción: 14,99 USD/mes o 109 USD/año. Prueba de 34 días | [S60] oficial, 15/11/2026; cobertura bancaria: [S64] secundaria |
| **Bluecoins** | Cuentas ilimitadas, presupuestos por categoría, informes cruzados, proyección de saldo, importación y exportación | Manual, CSV. En Android, notificaciones bancarias | Gratis. Pago único de 17,99 € | [S61] secundaria, 14/09/2026; [S63] secundaria |

### Apps que ya usan la captura por Atajos

Varias apps recientes basan su propuesta en lo mismo que pide el requisito destacado.
Sirve como indicio de que Apple acepta el patrón en revisión. Todas son fuente secundaria
(sus propias guías).

| App | Qué hace | Fuente |
|---|---|---|
| CashJot | Acción "Capture Tap-to-Pay". En iOS 27 ofrece un atajo ya montado con la automatización dentro. El registro automático es de pago y la captura a una bandeja es gratuita | [S07], 20/10/2026 |
| Expensa | Atajo compartido "Wallet Sync" con disparador por notificación de Wallet en iOS 27 y guía de tres pasos | [S12], 29/09/2026 |
| Moneko | Captura por "Transacción" y por notificación en iOS 27. En Android, por notificaciones | [S12], 24/09/2026 |
| Skwad | "Transacción" que envía un correo con comercio e importe | [S04], 19/06/2024 |

### Conclusiones para el producto

1. **Dos familias.** Las apps con banco conectado cobran entre 30 y 70 € al año por ello.
   Las manuales son baratas o de pago único. La conexión bancaria es el principal motivo
   de suscripción y también la principal queja (conexiones que se caen, según [S63]).
2. **La captura por Atajos es el término medio**: automatiza parte del registro sin
   banco, sin agregador y sin coste recurrente. Ya la explotan apps nuevas, así que no
   es una ventaja exclusiva. La diferencia estará en la guía de configuración y en lo
   bien que se resuelvan los fallos.
3. **Pocas apps manuales unen presupuesto, gastos fijos, objetivos e inversión** en un
   solo sitio con poco esfuerzo. Ese conjunto es el hueco del producto.
4. **La privacidad es un argumento comercial**: "tus datos no salen del móvil" aparece
   de forma repetida en las apps sin banco.
5. **Precio de referencia** para una app sin banco: de 0 a 30 € al año, o un pago único
   de 15 a 45 €.
