# 05 · Comparativa de arquitectura y modelo de datos

**Decisiones cerradas el 15/11/2026** (ver `09-decisiones.md`): D1, React Native con
Expo; D2, base de datos local sincronizada con Supabase desde V1. La comparativa se
conserva como justificación.

Fuentes `[Sxx]` en `00-fuentes-y-revalidacion.md`. Fecha de consulta: 15/11/2026.

## 1. Lo que no cambia con el framework

Sea cual sea la opción, la app tendrá:

- Una **capa nativa en Swift** dentro del proyecto de iOS para los App Intents (acciones
  de Atajos), el widget y los controles [S13][S34][S36].
- Un **almacén compartido** (App Group) entre la app, la acción y el widget [S37].
- Una **base de datos local** en el dispositivo.
- En Android, una capa nativa en Kotlin para la captura por notificaciones [S17].

Lo que se comparte entre plataformas es la interfaz, la lógica y el modelo de datos.

## 2. Comparativa de opciones multiplataforma

### 2.1 Versiones vigentes

| Opción | Versión estable | Fuente |
|---|---|---|
| React Native con Expo | Expo SDK 58 [S13]. React Native 0.88, del 19/10/2026 (FUENTE SECUNDARIA [S44]). La Nueva Arquitectura es la única desde React Native 0.82 [S42] | [S13], [S42], [S44] |
| Flutter | 3.50 con Dart 3.14 [S43]. Fecha de publicación: una fuente secundaria da el 11/11/2026 [S44] | [S43], [S44] |
| Kotlin Multiplatform con Compose Multiplatform | Compose Multiplatform 1.12.2, iOS 14 mínimo [S40]. Kotlin 2.4.21 (FUENTE SECUNDARIA [S44]). KMP estable desde noviembre de 2023 y Compose para iOS estable desde mayo de 2025 [S41] | [S40], [S41], [S44] |

### 2.2 Criterios

| Criterio | React Native + Expo | Flutter | Kotlin Multiplatform + Compose |
|---|---|---|---|
| **Acciones de Atajos en iOS** | `expo-app-intents`, mantenido por Expo, con plantillas, cola de invocaciones y generación del proyecto. **En alfa**, con cambios incompatibles frecuentes [S13][S14]. Los tipos se escriben en Swift en una carpeta del proyecto | Dos paquetes de la comunidad: `app_intents` 0.21.1 (iOS 17+, muy activo pero muy joven: 37 versiones en ocho meses y poca adopción) y `flutter_app_intents` 0.7.0 (sin actividad en trece meses) [S15][S16]. Alternativa: escribir el puente a mano con canales de plataforma | No necesita puente: el intent se escribe en Swift y llama a la lógica compartida en Kotlin, que se compila como framework nativo. Es la integración más directa |
| **Widgets en iOS** | `expo-widgets` (alfa): el widget se define como componente y Expo genera la extensión [S39] | `home_widget` 0.10.0, paquete consolidado. El widget se escribe en SwiftUI y el paquete pasa los datos [S38] | Widget en SwiftUI nativo que lee del almacén compartido |
| **Gráficos** | Hay varias bibliotecas de la comunidad. Versiones y estado: PENDIENTE DE VERIFICAR | `fl_chart` y otras, dibujadas por el motor propio de Flutter. Versiones: PENDIENTE DE VERIFICAR | Menos oferta para Compose Multiplatform. PENDIENTE DE VERIFICAR |
| **Madurez del núcleo** | Alta. React Native lo mantiene Meta, con una versión menor cada dos meses y soporte para las tres últimas (FUENTE SECUNDARIA) | Alta. Lo mantiene Google, con versión estable trimestral [S43] | Alta en la lógica compartida. La interfaz compartida en iOS es estable desde 2025 [S41] |
| **Madurez de las piezas que este proyecto necesita en iOS** | Media: las dos piezas clave (intents y widgets) son oficiales de Expo pero están en alfa | Media: los widgets son sólidos, los intents dependen de paquetes jóvenes o de código propio | Alta en iOS (todo es Swift nativo). El coste está en otro sitio |
| **Curva de aprendizaje** | TypeScript y React. En este Mac ya hay Node 22 instalado y ninguna herramienta de Flutter. Si el usuario conoce JavaScript, es la más corta | Dart y el modelo de widgets de Flutter. Lenguaje nuevo para la mayoría, pero documentación muy guiada | Kotlin, Gradle y Swift a la vez. La más exigente para una sola persona |
| **Compilación y distribución** | Compilación en la nube documentada, también sin Mac: 15 compilaciones de iOS al mes gratis, después 19 USD al mes [S23][S24]. Actualizaciones de código sin pasar por revisión para cambios que no toquen la parte nativa | Xcode en local (gratis) o Codemagic [S25] | Xcode en local |
| **Coste** | Framework gratuito. Servicios de Expo opcionales | Gratuito | Gratuito |
| **Android después** | Misma base de código. Captura por notificaciones con un módulo nativo en Kotlin | Misma base de código. Igual | Misma base de lógica, y Android es su terreno natural |
| **Aspecto en iOS** | Usa los controles nativos del sistema: hereda el aspecto de cada versión de iOS | Dibuja sus propios controles: aspecto idéntico en todas partes, pero hay que imitar el de iOS | Compose dibuja sus propios controles, como Flutter. Se puede usar SwiftUI en pantallas concretas |
| **Riesgo principal** | Dependencia de dos bibliotecas en alfa | Mantener a mano el puente con Swift | Carga de trabajo para un desarrollador solo |

### 2.3 Recomendación

**React Native con Expo**, con una condición y una salida:

- **Por qué**: es la única opción en la que las dos piezas que más condicionan este
  producto (acciones de Atajos y widgets) tienen soporte del propio mantenedor del
  framework, con generación automática del proyecto nativo. Además encaja con las
  herramientas que ya hay en el equipo y permite compilar y enviar en la nube.
- **Condición**: ambas bibliotecas están en alfa. El hito H1 (spike A) sirve también
  para validarlas. Criterio: la acción "Registrar pago" recibe los tres parámetros desde
  Atajos y crea una captura con la app cerrada.
- **Salida si falla**: escribir los intents y el widget directamente en Swift dentro del
  mismo proyecto de Expo (módulos nativos), sin la biblioteca. Es más trabajo, pero no
  obliga a cambiar de framework.

**Cuándo elegir Flutter en su lugar**: si el usuario ya conoce Dart o Flutter, o si da
más valor a unos gráficos muy personalizados y a un aspecto idéntico en iOS y Android
que a la integración con el sistema.

**Cuándo elegir Kotlin Multiplatform**: si el usuario ya programa en Kotlin y Swift y
acepta un ritmo más lento a cambio de la integración nativa más limpia.

**Decisión D1 (15/11/2026)**: el usuario programa en Java, Python y C++ y deja la
elección a lo que mejor convenga al proyecto. Ninguno de esos lenguajes es el de las tres
opciones (TypeScript, Dart y Kotlin), así que el lenguaje no decide. Se adopta React
Native con Expo, en TypeScript, con la condición y la salida descritas arriba.

### 2.4 Versión mínima de iOS propuesta

**iOS 17.0.** Es la primera con la automatización "Transacción" [S01] y con widgets
interactivos [S36]. Los controles de pantalla de bloqueo exigen iOS 18 [S35] y la captura
por notificación exige iOS 27 [S05]: se ofrecen solo donde existen.

## 3. Almacenamiento y sincronización

### 3.1 Alternativas

| | A · Solo local | B · Nube del sistema | C · Servidor propio |
|---|---|---|---|
| Descripción | Base de datos SQLite en el dispositivo. Copia de seguridad en fichero que el usuario guarda donde quiera | iCloud (CloudKit) en iOS. En Android habría que usar otra cosa | Base de datos local más un servicio en la nube que sincroniza (Supabase, Firebase o un motor de sincronización como PowerSync) |
| Cuentas de usuario | No | La del sistema (Apple ID) | Sí: registro e inicio de sesión |
| Varios dispositivos | No. Traslado con la copia de seguridad | Sí, entre dispositivos de Apple | Sí, también entre iOS y Android |
| Paso a Android | Con exportar e importar el fichero | **Problema**: los datos están en iCloud. Acceso a CloudKit desde Android: NO DEMOSTRADO | Natural |
| Coste | 0 | 0 dentro de las cuotas de Apple (no verificadas en esta sesión) | Supabase: gratis hasta 500 MB y 50 000 usuarios activos al mes, pero **el proyecto gratuito se pausa tras una semana sin actividad**; plan Pro desde 25 USD al mes [S56]. Firestore: 1 GiB, 50 000 lecturas y 20 000 escrituras al día gratis [S57]. PowerSync: gratis hasta 50 clientes simultáneos, también con desactivación por inactividad; Pro desde 49 USD al mes [S58] |
| Privacidad | Máxima: el desarrollador no ve ni guarda datos | Alta: los datos están en la cuenta de iCloud del usuario | El desarrollador pasa a ser **responsable del tratamiento** de datos financieros |
| Obligaciones | Mínimas. La etiqueta de privacidad puede ser "No se recogen datos" si no hay analítica ni SDK de terceros [S29] | Bajas | Política de privacidad completa, contrato de encargado con el proveedor (art. 28 RGPD), medidas de seguridad (art. 32), gestión de brechas (arts. 33 y 34), eliminación de cuenta dentro de la app [S28], etiqueta de privacidad con "Otra información financiera" vinculada al usuario [S29] |
| Qué más habilita | Nada | Nada | Servidor intermedio para precios de mercado, finanzas compartidas |
| Riesgo | Perder el móvil sin copia es perder los datos | Queda atado a Apple | Coste recurrente, seguridad y soporte desde el primer usuario |

### 3.2 Decisión D2 (15/11/2026): opción C con Supabase desde V1

El usuario descarta el almacenamiento solo local. V1 guarda los datos en Supabase.

- **Base de datos local más sincronización.** La acción de Atajos se ejecuta con la app
  cerrada y a veces sin conexión, así que la captura se escribe primero en el almacén
  local y se envía a Supabase después. El modelo lo prevé: identificadores UUID generados
  en el dispositivo, marca de última modificación en cada registro y borrado lógico.
- **Cuentas de usuario** con el servicio de autenticación de Supabase. Cada fila lleva el
  identificador de su usuario y todas las tablas tienen reglas de acceso por fila
  (Row Level Security).
- **Región de la UE** para el proyecto, por las transferencias internacionales del RGPD.
- **Plan gratuito** [S56]: 500 MB de base de datos, 50 000 usuarios activos al mes y dos
  proyectos activos. El proyecto se pausa tras una semana sin actividad y no incluye
  copias de seguridad automáticas. Sirve para el desarrollo y la beta. Antes de publicar
  hay que decidir si se pasa al plan Pro, desde 25 USD al mes.
- **Obligaciones**: las de la columna C de la tabla anterior, desde V1.
- **Técnica de sincronización**: propia, por marca de modificación, o un motor como
  PowerSync [S58]. Se decide en el hito H4 con una prueba.

La opción B sigue sin recomendarse: resuelve iOS y crea un problema para Android.

## 4. Modelo de datos general

### 4.1 Convenciones

- Identificador `id`: UUID generado en el dispositivo.
- Campos comunes: `creado_en`, `modificado_en`, `borrado_en` (borrado lógico).
- **Dinero**: entero en unidades menores (céntimos) más código de divisa ISO 4217.
  Nunca decimales en coma flotante.
- Fechas de movimiento como fecha de calendario local. Marcas de tiempo técnicas en UTC.
- Los agregados (saldos, totales del mes, avance de objetivos) **se calculan, no se guardan**.

### 4.2 Entidades

| Entidad | Campos principales | Notas |
|---|---|---|
| **Cuenta** | nombre, tipo (`banco`, `efectivo`, `inversion`, y más adelante `credito`, `prestamo`), divisa, saldo_inicial, fecha_saldo_inicial, archivada, orden | El saldo actual es el saldo inicial más los movimientos posteriores a su fecha |
| **AliasDeTarjeta** | texto_original, texto_normalizado, cuenta_id, instrumento (`debito`, `credito`, `desconocido`) | Regla tarjeta a cuenta del spike A |
| **Categoria** | nombre, tipo (`gasto`, `ingreso`), icono, color, padre_id, archivada, orden | Una sola lista, usada por movimientos, presupuestos y gastos fijos |
| **Movimiento** | tipo (`gasto`, `ingreso`, `transferencia`, `ajuste`), fecha, importe, divisa, cuenta_id, cuenta_destino_id, categoria_id, nombre, comercio, nota, origen (`manual`, `apple_pay`, `notificacion`, `recurrente`, `importacion`), regla_recurrente_id, captura_id, objetivo_id | `cuenta_destino_id` solo en transferencias. `categoria_id` vacío en transferencias y ajustes |
| **Captura** | recibida_en, origen, importe_texto, importe, divisa, comercio_texto, tarjeta_texto, cuenta_sugerida_id, categoria_sugerida_id, estado (`pendiente`, `guardada`, `descartada`, `duplicada`), incompleta, movimiento_id | Lo que llega de Atajos antes de confirmarse. Conserva los textos originales |
| **ReglaDeComercio** | comercio_normalizado, categoria_id, usos | Se actualiza al guardar movimientos |
| **ReglaRecurrente** | nombre, tipo_movimiento, importe, cuenta_id, cuenta_destino_id, categoria_id, clase (`fijo`, `suscripcion`, `ingreso`, `aportacion`), periodicidad, dia_del_mes, fecha_inicio, fecha_fin, activa, aviso_dias_antes, objetivo_id | Gastos fijos, suscripciones, nómina y aportaciones periódicas |
| **Presupuesto** | periodo (año y mes), nota | Uno por mes |
| **LineaDePresupuesto** | presupuesto_id, categoria_id, importe | Previsto por categoría |
| **Objetivo** | nombre, tipo (`ahorro`, `inversion`), meta, fecha_limite, cuenta_id, archivado | El aportado es la suma de sus aportaciones |
| **AportacionAObjetivo** | objetivo_id, fecha, importe, movimiento_id, nota | Con o sin movimiento vinculado |
| **ValorDeInversion** | cuenta_id, fecha, valor | Valor manual de una cuenta de inversión (V1) |
| **Posicion** *(V2)* | cuenta_id, activo_id, cantidad, coste | |
| **Activo** *(V2)* | nombre, clase, ISIN, símbolo, divisa | |
| **Precio** *(V2)* | activo_id, fecha, precio, fuente | |
| **Ajuste** | clave, valor | Preferencias: modo de guardado de capturas, día de inicio del mes, bloqueo |

### 4.3 Relaciones

```
Cuenta 1─∞ Movimiento ∞─1 Categoria
Cuenta 1─∞ AliasDeTarjeta
Cuenta 1─∞ ValorDeInversion
Captura 0..1─1 Movimiento
ReglaRecurrente 1─∞ Movimiento
Presupuesto 1─∞ LineaDePresupuesto ∞─1 Categoria
Objetivo 1─∞ AportacionAObjetivo 0..1─1 Movimiento
Objetivo ∞─0..1 Cuenta
```

### 4.4 Reglas de cálculo

| Cifra | Cálculo |
|---|---|
| Saldo de una cuenta | saldo_inicial + ingresos − gastos + transferencias recibidas − transferencias enviadas + ajustes, con fecha igual o posterior a la del saldo inicial |
| Gasto del mes | Suma de movimientos de tipo `gasto` del periodo. Las transferencias no cuentan |
| Disponible del mes | Presupuesto total − gastado − gastos fijos pendientes que no estén ya gastados |
| Patrimonio neto | Suma de saldos de cuentas de banco y efectivo, más el último valor de cada cuenta de inversión |
| Aportado a una inversión | Transferencias recibidas menos transferencias enviadas de la cuenta de inversión |
| Rentabilidad simple | (último valor − aportado) ÷ aportado |
| Tasa de ahorro | (ingresos − gastos) ÷ ingresos del periodo |

### 4.5 Inversión manual y patrimonio (17/11/2026)

Implementado en `src/dominio/inversion.ts` y `src/dominio/patrimonio.ts`. Nada se guarda:
todo se calcula. La tabla `valor_de_inversion` (migración 2) guarda solo lo que la persona
anota: `cuenta_id`, `fecha`, `valor` en céntimos y los campos comunes.

| Cifra | Cálculo |
|---|---|
| Aportado neto en una fecha | Saldo de la cuenta con los movimientos hasta esa fecha: saldo inicial más entradas menos salidas |
| Valor estimado en una fecha | Último valor anotado con fecha igual o anterior, más el efecto de los movimientos posteriores a ese valor y hasta la fecha. Sin valores anotados, el aportado neto |
| Ganancia o pérdida | Valor estimado menos aportado neto |
| Rentabilidad simple | Ganancia ÷ aportado neto, solo si el aportado es mayor que cero |
| Patrimonio en una fecha | Saldo de banco y efectivo más valor estimado de las inversiones. Una cuenta archivada cuenta si su valor no es cero |
| Evolución del patrimonio | Patrimonio al último día de cada uno de los doce últimos meses; el mes en curso usa hoy |

Reglas del valor anotado: solo en cuentas de inversión, mayor o igual que cero, fecha
real, no futura y no anterior a la fecha del saldo inicial de la cuenta. Un valor por
cuenta y día: anotar otro el mismo día lo sustituye. El valor de un día incluye los
movimientos de ese día.

Limitaciones:

- El valor estimado no es un valor de mercado. Entre dos valores anotados la app solo suma
  y resta lo que entra y sale.
- Todo lo que entra en una cuenta de inversión cuenta como aportación, también un ingreso
  anotado directamente en ella.
- Antes de la fecha de su saldo inicial una cuenta no tiene valor conocido y no cuenta en
  el patrimonio. Los meses anteriores a la primera cuenta no se dibujan.
- La regla 4.4 decía «más el último valor de cada cuenta de inversión». Se usa el valor
  estimado, que añade las aportaciones y retiradas posteriores a ese valor.

### 4.6 Planificación: fijos, presupuesto, previsión y objetivos (17/11/2026)

Implementado en `src/dominio/recurrentes.ts`, `presupuesto.ts`, `prevision.ts` y
`objetivos.ts`. La migración 3 añade `regla_recurrente`, `presupuesto`,
`linea_de_presupuesto`, `objetivo` y `aportacion_a_objetivo`. Guardan solo lo que la
persona define; ocurrencias, disponible, previsión y avance se calculan. «Hoy» entra
siempre como parámetro.

**Ocurrencias de una regla**

- Mensual: una vez al mes, el `dia_del_mes`. Si el mes es más corto, el último día.
- Anual: una vez al año, en el mes de su `fecha_inicio`.
- No hay ocurrencia antes de `fecha_inicio`, después de `fecha_fin`, ni con la regla
  inactiva o borrada.
- Confirmada: existe un movimiento no borrado con ese `regla_recurrente_id` y fecha en
  el mismo mes. Si no, pendiente: «por confirmar» si su día es hoy o anterior y
  «próximo» si es posterior.
- «Por confirmar» reúne los vencidos del mes en curso y del mes anterior. Más atrás no
  se mira.
- Confirmar crea un movimiento de origen `recurrente` con los datos de la regla, o con el
  importe y el día que la persona cambie, siempre dentro de ese mes. Confirmar dos veces
  devuelve el mismo movimiento. «Ya lo anoté» enlaza uno existente del mismo mes, tipo y
  cuenta que no tenga regla.
- Una aportación con objetivo crea, al confirmarse, la transferencia y una aportación
  enlazada a ella. Borrar ese movimiento borra la aportación; deshacer recupera las dos.

**Presupuesto**

| Cifra | Cálculo |
|---|---|
| Gasto real de una línea | Gasto del mes en la categoría y en sus subcategorías |
| Sin presupuestar | Gasto del mes en categorías sin línea y sin categoría. Cuenta en el gastado |
| Estado de una línea | Excedida si el gasto supera lo previsto; cerca desde el 80 %; dentro en otro caso |
| Raya del día | Día de hoy ÷ días del mes. Solo en el mes en curso |
| Propuesta al crear | Media de gasto de cada categoría en los tres meses naturales anteriores, repartida entre los meses de esos tres que tienen algún gasto. Sin histórico, vacío |
| Disponible del mes (D1) | Presupuesto total − gastado − fijos pendientes. Un fijo confirmado ya está en el gastado y no se resta dos veces |
| Por día | Disponible ÷ días que quedan contando hoy, hacia abajo al céntimo. Cero si el disponible es negativo |

El presupuesto no lleva divisa: se entiende en la divisa principal (la de la primera
cuenta). Las reglas y los objetivos sí llevan la de su cuenta y no se mezclan.

**Previsión de fin de mes (D4)**

previsto = saldo de banco y efectivo − gastos recurrentes pendientes + ingresos
recurrentes pendientes − transferencias pendientes que salen de banco y efectivo (netas)
− gasto variable diario × días que quedan sin contar hoy.

El gasto variable diario es el gasto del mes de movimientos sin regla entre los días
transcurridos contando hoy. Una transferencia pendiente entre dos cuentas de banco o
efectivo no cambia el total; una que entra desde inversión, suma.

**Objetivos (D8)**

| Cifra | Cálculo |
|---|---|
| Aportado | Suma de las aportaciones no borradas |
| Avance | Aportado ÷ meta, hacia abajo y con tope del 100 % |
| Meses restantes | (año límite − año actual) × 12 + (mes límite − mes actual), con mínimo 1 |
| Necesario al mes | (meta − aportado) ÷ meses restantes, hacia arriba al céntimo |

Sin fecha límite no hay ritmo. Con lo aportado igual o mayor que la meta el objetivo está
conseguido. Con la fecha límite pasada sin llegar, el plazo está vencido.

### 4.7 Capturas de pagos y avisos (17/11/2026)

Implementado en `src/dominio/captura.ts` y `src/dominio/avisos.ts`. La migración 4 añade
cuatro tablas, todas con los campos comunes, sin tocar las existentes:

| Tabla | Guarda |
|---|---|
| `captura` | `recibida_en`, `origen` (`transaccion`, `notificacion`, `manual`, `prueba`), los tres textos tal como llegaron (`importe_texto`, `comercio_texto`, `tarjeta_texto`), lo extraído (`importe`, `divisa`), la cuenta y la categoría propuestas, `estado` (`pendiente`, `guardada`, `descartada`, `duplicada`), `movimiento_id` e `id_de_cola` (único entre las no borradas) |
| `alias_de_tarjeta` | Texto de la tarjeta normalizado (único) y su cuenta |
| `regla_de_comercio` | Comercio normalizado (único) y su categoría |
| `aviso_emitido` | Clave (única) y fecha de un aviso que ya se dio, para no repetirlo |

**Extracción de importe y divisa.** Reconoce los símbolos €, $ y £ y un código de tres
letras. Con punto y coma, el último es el decimal. Con un solo separador seguido de una o
dos cifras, es el decimal. Con un solo separador repetido, separa miles. Devuelve «sin
importe» si el texto está vacío, no tiene números, tiene más de un número, es negativo, es
cero o admite dos lecturas: «1.234» puede ser mil doscientos treinta y cuatro o uno con
doscientos treinta y cuatro, así que no se interpreta. Nunca inventa un importe.

**Tarjeta a cuenta.** La regla de `04`, apartado A.4, tal cual: coincidencia exacta del
texto normalizado con un alias; sin coincidencia y con una sola cuenta de banco, esa, como
sugerida; con varias, sin cuenta. Un alias cuya cuenta está archivada o borrada no cuenta.
Al guardar una captura con nombre de tarjeta y sin alias, se crea el alias con la cuenta
elegida.

**Comercio a categoría.** Al guardar una captura con categoría se recuerda para ese
comercio (normalizado). La siguiente del mismo comercio la propone. El último guardado
manda. Una categoría archivada o borrada deja de proponerse.

**Duplicados.** Una captura con el mismo importe y la misma cuenta que otra pendiente o
guardada, a menos de 10 minutos, queda como `duplicada`: visible en la bandeja y
recuperable. Una captura y un movimiento manual del mismo pago no se fusionan.

**Guardar.** Con importe, cuenta y categoría se guarda con un toque: crea un gasto con
origen `apple_pay` (o `notificacion`), con `captura_id`, y la captura pasa a `guardada`. Si
falta algo, se abre el alta con lo que haya. Descartar cambia el estado, no borra. Borrar
el movimiento de una captura guardada la devuelve a `pendiente`; deshacer ese borrado la
vuelve a dejar `guardada`.

**Cola de Atajos.** Las acciones «Registrar pago» y «Añadir gasto» se ejecutan con la app
cerrada y dejan su trabajo en una cola del dispositivo. La app la vuelca en `captura` al
abrirse y al volver a primer plano. `id_de_cola` impide importar dos veces la misma
entrada. «Añadir gasto» crea el movimiento al volcarse, si trae importe, categoría y una
cuenta que se pueda determinar; si no, deja una captura pendiente.

**Avisos.** `calcularAvisos(datos, preferencias, ahora)` es una función pura que devuelve
los avisos que hay que dejar programados y los que hay que mostrar ya:

| Aviso | Cuándo |
|---|---|
| Cobro próximo | A las 9:00 del día del cobro menos `aviso_dias_antes`, si la ocurrencia sigue pendiente y ese momento no ha pasado. Se miran el mes en curso y los dos siguientes |
| Presupuesto | Al pasar una línea del 80 % o excederse. Una vez por categoría, mes y nivel, anotada en `aviso_emitido`. Si se excede de golpe, solo el de excedida |
| Pagos sin revisar | Cuando la captura pendiente más antigua cumple 24 horas |
| Valor de inversión | A las 9:00 del día en que el último valor de una cuenta de inversión cumple 30 días |

Los programados se recalculan enteros al abrir la app y cuando cambian los datos: se
cancelan los propios (identificador con prefijo `fc:`) y se vuelven a programar. Nunca
más de 40 a la vez; tienen prioridad los más cercanos. «Las 9:00» se calcula con el
calendario local, así que no cambia con la hora de verano. Las preferencias (qué avisos
están activados) se guardan en el almacén de clave y valor de expo-sqlite, no en estas
tablas.

### 4.8 Esquema remoto (22/11/2026, bloque 4b-1)

En Supabase (Postgres), definido en `supabase/migrations/`. El servidor no guarda ningún
dato financiero en claro. Diseño del cifrado: `docs/seguridad/diseno-criptografico.md`.

**`claves_de_usuario`**: una fila por cuenta.

| Columna | Contenido | ¿En claro? |
|---|---|---|
| `user_id` | Clave primaria. Referencia a `auth.users`, con borrado en cascada. Por defecto, `auth.uid()` | Sí |
| `clave_por_contrasena` | La clave de datos, cifrada en el dispositivo con la clave que sale de la contraseña. Un sobre de 98 caracteres; **dos seguidos (196) mientras dura un cambio de contraseña** | Cifrado |
| `clave_por_recuperacion` | La misma clave de datos, cifrada con la que sale del código de recuperación | Cifrado |
| `version_de_derivacion` | Con qué parámetros se derivaron las claves de la contraseña | Sí |
| `version_de_formato` | Formato de los dos sobres | Sí |
| `creado_en`, `actualizada_en` | Las pone el servidor | Sí |

**`fila_cifrada`**: una fila por cada fila de la base local. La llena la sincronización
desde el 4b-2 (apartado 4.9).

| Columna | Contenido | ¿En claro? |
|---|---|---|
| `user_id` | Dueño. Por defecto, `auth.uid()` | Sí |
| `tabla` | Tabla local de origen. Restringida a una lista | Sí |
| `id` | UUID de la fila local | Sí |
| `contenido` | El sobre cifrado, hasta 64 KiB de texto | Cifrado |
| `version_de_formato` | Formato del sobre | Sí |
| `borrada` | Marca de borrado, para que llegue a los demás dispositivos | Sí |
| `actualizada_en` | La pone el servidor; decide qué escritura es la última | Sí |

Clave primaria: (`user_id`, `tabla`, `id`).

Tablas locales que se sincronizarán (12): `cuenta`, `categoria`, `movimiento`,
`valor_de_inversion`, `objetivo`, `aportacion_a_objetivo`, `regla_recurrente`,
`presupuesto`, `linea_de_presupuesto`, `captura`, `alias_de_tarjeta` y `regla_de_comercio`.

**`aviso_emitido` no se sincroniza.** Dice qué avisos ha dado ya un dispositivo, y eso es de
cada dispositivo. Consecuencia aceptada por el dueño: con dos dispositivos, un aviso de
presupuesto («llevas el 80 %», «te has pasado») puede darse una vez en cada uno.

**Aislamiento.** En las dos tablas: RLS activado y forzado; cuatro políticas (leer, crear,
cambiar, borrar) solo para el rol `authenticated`, todas con `auth.uid() = user_id`; ningún
permiso para el rol anónimo. Las marcas de tiempo las pone un disparador: lo que envíe el
cliente en esas columnas se ignora.

**Funciones.** `borrar_mi_cuenta()`: borra las filas, las claves y el usuario de quien la
llama. No admite parámetros; a quién borrar lo dice la sesión. Tiene privilegios elevados
porque un usuario no puede borrar de `auth.users`; por eso lleva `search_path` vacío y solo
puede ejecutarla el rol `authenticated`.

**Pruebas.** 33 de aislamiento y 8 de la cuenta, contra una instancia local:
`npx supabase start`, `npx supabase db reset`, `npm run test:remoto`.

**Segunda migración remota (4b-2).** `20261122120000_retirar_execute_de_rls_auto_enable.sql`
retira a `public`, `anon` y `authenticated` el permiso de ejecutar
`public.rls_auto_enable()`, una función que crea Supabase en el proyecto. No cambia tablas.
No hace nada si la función no existe.

### 4.9 Sincronización cifrada (22/11/2026, bloque 4b-2)

Diseño completo: `docs/seguridad/diseno-sincronizacion.md`. Código: `src/sincronizacion/`.

**Esquema local, versión 5.** Solo añade tablas internas y disparadores; ninguna tabla ni
fila existente cambia.

| Tabla | Contenido |
|---|---|
| `sinc_pendiente` | Filas locales por subir (`cambio`, `tabla`, `id`). `cambio` solo crece |
| `sinc_remota` | Última marca de tiempo del servidor conocida de cada fila |
| `sinc_retenida` | Filas remotas que no se han podido aplicar: `ilegible` o `no_aplicable` |
| `sinc_estado` | Cuenta a la que está ligada la base, cursor, última sincronización y último repaso |

Cada una de las doce tablas sincronizadas tiene dos disparadores (`AFTER INSERT` y
`AFTER UPDATE`) que apuntan la fila en `sinc_pendiente`. Los repositorios no cambian.

**Piezas.**

| Fichero | Qué hace |
|---|---|
| `tablas.ts` | Catálogo de las doce tablas: columnas, reglas de unicidad y orden de dependencia. Una prueba lo compara con el esquema real |
| `filas.ts` | Fila ↔ sobre cifrado. Datos autenticados: `FC1\|fila/<user_id>/<tabla>/<id>` |
| `servidor.ts` | Lo que el motor necesita del servidor, sobre el cliente de Supabase. Sin mensajes internos |
| `motor.ts` | Subir, bajar, aplicar, repaso completo y entrada en una cuenta |
| `sincronizador.ts` | Cuándo se sincroniza, reintentos y estado para la pantalla |
| `src/estado/sincronizacionDeLaApp.ts` | Une lo anterior con la base, el cliente y la cuenta reales |

**Reglas.** Un ciclo es subir y luego bajar. Gana la última escritura que llega al
servidor, por fila. Los borrados son lógicos; nunca se usa `DELETE` en `fila_cifrada`. La
base local se liga a una cuenta y no se sincroniza con ninguna otra. Si la nube y el
dispositivo tienen datos, no se fusiona: se pregunta.

**Transacciones.** Como la sincronización escribe mientras la persona usa la app, el
adaptador de la base (`bdExpo.ts`) pone las transacciones en fila: una no empieza hasta
que acaba la anterior.

**Exportación** (`src/exportacion/`, Ajustes › Exportar mis datos). Un JSON con todas las
filas de todas las tablas de datos (formato `financialcontrol.exportacion`, versión 1) y
un CSV de movimientos con signo y divisa. En claro. No depende de la cuenta.

### 4.10 Versión web (22/11/2026, bloque 5)

Diseño completo: `docs/seguridad/diseno-web.md`.

La web es la misma app exportada como sitio estático (`npx expo export -p web`,
`web.output: "single"`). No hay servidor propio. Usa el mismo dominio, los mismos
repositorios, el mismo cifrado y el mismo motor de sincronización; lo que cambia va en
ficheros `.web.ts(x)`, que Metro elige solo al compilar para web.

| Capa | iOS | Web |
|---|---|---|
| Base de datos | expo-sqlite en disco | expo-sqlite (WebAssembly) abierto como `:memory:` |
| Biblioteca de cifrado | `react-native-libsodium` (nativo) | `libsodium-wrappers-sumo` (WebAssembly) |
| Clave de datos y sesión | Llavero del sistema | Memoria de la pestaña |
| Cuenta | Opcional | Obligatoria |
| Navegación | Pestañas nativas | Enlaces: abajo o barra lateral desde 900 px |

En el navegador solo se guardan el correo y la apariencia. Recargar pide la contraseña.

Ficheros de la web fuera de `src/`: `metro.config.js` (WebAssembly como recurso y
cabeceras de aislamiento en desarrollo), `public/index.html` y `public/base.css`
(plantilla sin nada en línea), `public/_headers` (cabeceras del sitio),
`scripts/cabeceras-web.cjs`, `scripts/servir-web.cjs` y `scripts/pruebas-web.cjs`,
`playwright.config.ts` y `web/pruebas/`.

**Límites de texto** (`src/dominio/textos.ts`, en las dos plataformas): 200 caracteres en
nombres y comercio, 2.000 en notas.

## 5. Correspondencia con el Notion del primer usuario

Solo sirve para comprobar que el modelo cubre el uso actual. La app no importa ni
sincroniza nada con Notion (decisión D5).

Cada campo inspeccionado el 15/11/2026 tiene destino o figura como descartado con motivo.

### 5.1 Tracker de gastos

| Campo de Notion | Destino en el modelo | Notas |
|---|---|---|
| Nombre | `Movimiento.nombre` | |
| Cantidad (€) | `Movimiento.importe` en céntimos, divisa EUR | |
| Fecha | `Movimiento.fecha` | |
| Categoría: Casa, Transporte, Ocio, IA | `Categoria` de tipo gasto | Se crean como categorías iniciales del primer usuario |
| Categoría: **Inversión** | **Cambia de naturaleza**: `Movimiento` de tipo `transferencia` hacia una cuenta de inversión | Deja de contar como gasto. En la importación, cada fila con esta categoría se convierte en transferencia. El usuario confirma la cuenta de destino |
| Método de pago: SANTANDER, TRADE, EFECTIVO | `Movimiento.cuenta_id` | El método de pago es en realidad la cuenta de la que sale el dinero |
| Cuenta: DEBITO, CREDITO | `AliasDeTarjeta.instrumento` | Solo informativo en V1. Pasa a ser relevante con las tarjetas de crédito (V2) |
| Cuenta: otras opciones heredadas de plantilla | **Descartado** | Parecen valores de la plantilla original sin uso. El usuario debe confirmarlo antes de importar. Si alguna tiene filas, se listan y se decide una a una |
| Banco (relación con Cuentas) | `Movimiento.cuenta_id` | Redundante con "Método de pago". Si los dos discrepan en una fila, manda la relación y la fila se lista en el informe de importación |
| Fórmulas mensuales | **No se guardan** | Se sustituyen por consultas calculadas (apartado 4.4). Su contenido está PENDIENTE DE EVIDENCIA: hay que leerlo para confirmar que no calculan algo no previsto |

### 5.2 Tracker de ingresos

| Campo de Notion | Destino en el modelo | Notas |
|---|---|---|
| Nombre, Cantidad, Fecha | Igual que en gastos, con tipo `ingreso` | |
| Categoría: Sueldo, Ventas, Paga Papa | `Categoria` de tipo ingreso | |
| Categoría: **Préstamo** | `Categoria` de tipo ingreso en V1 | Un préstamo recibido no es un ingreso, es una deuda. En V1 se conserva como categoría para no perder el dato. En V2 pasa al módulo de deudas (B4) |
| Método de pago, Cuenta, Banco | Igual que en gastos | |
| Fórmulas mensuales | No se guardan | Igual que en gastos |

### 5.3 Cuentas

| Campo de Notion | Destino en el modelo | Notas |
|---|---|---|
| Cuenta | `Cuenta.nombre` | |
| Tipo: Banco, Inversión, Efectivo | `Cuenta.tipo` | Correspondencia directa |
| Saldo inicial | `Cuenta.saldo_inicial` | |
| Fecha del saldo inicial | `Cuenta.fecha_saldo_inicial` | |
| Agregado de gastos | **No se guarda** | Calculado |
| Agregado de ingresos | **No se guarda** | Calculado |
| Agregado de invertido | **No se guarda** | Calculado a partir de las transferencias a cuentas de inversión |
| Saldo actual | **No se guarda** | Calculado. |

### 5.4 Gastos fijos

| Campo de Notion | Destino en el modelo | Notas |
|---|---|---|
| Gasto | `ReglaRecurrente.nombre` | |
| Importe mensual | `ReglaRecurrente.importe`, periodicidad mensual | |
| Día de cobro | `ReglaRecurrente.dia_del_mes` | |
| Categoría (lista distinta de la del tracker) | `ReglaRecurrente.categoria_id` sobre la **lista única** | Hace falta una tabla de equivalencias entre las dos listas, que el usuario confirma en la vista previa de la importación |
| Tipo: Fijo | `ReglaRecurrente.clase = fijo` | |
| Tipo: Suscripción | `ReglaRecurrente.clase = suscripcion` | |
| Tipo: **Ocio** | `clase = fijo` y categoría Ocio | "Ocio" es una categoría, no una clase de recurrencia. Se traslada a la categoría |
| Activo | `ReglaRecurrente.activa` | |
| (no existe en Notion) | `ReglaRecurrente.cuenta_id` | Dato nuevo obligatorio |

### 5.5 Objetivos

| Campo de Notion | Destino en el modelo | Notas |
|---|---|---|
| Objetivo | `Objetivo.nombre` | |
| Tipo: Ahorro, Inversión | `Objetivo.tipo` | |
| Meta | `Objetivo.meta` | |
| Aportado (a mano) | Una `AportacionAObjetivo` inicial con el importe acumulado y la fecha de la importación | A partir de ahí, el aportado es la suma de aportaciones. Deja de ser un número editable |
| Fecha límite | `Objetivo.fecha_limite` | |

### 5.6 Alimentación

| Elemento | Destino | Notas |
|---|---|---|
| Atajos del iPhone que escriben en Notion | Sustituidos por la acción "Registrar pago" de la app | No inspeccionados: NO DISPONIBLE. Conviene revisarlos antes del hito H1 para no perder ninguna lógica que contengan (por ejemplo, categorías por defecto). No se modifican |

### 5.7 Pendientes de evidencia para cerrar la correspondencia

1. Contenido de las fórmulas mensuales.
2. Lista exacta de las opciones heredadas del campo "Cuenta" y si tienen filas.
3. Lista de categorías de "Gastos fijos" para montar la tabla de equivalencias.
4. Lógica de los Atajos actuales.
5. Volumen: número de filas por tabla y rango de fechas.

Ninguno bloquea el diseño ni el desarrollo: ya no hay tarea de importación.
