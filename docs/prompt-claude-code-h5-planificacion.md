# Prompt para Claude Code · Bloque 2: Planificación (H5 y parte de H6)

Pega todo lo que sigue en Claude Code, abierto en `~/Desktop/FinancialControl`.

```
======================================================================
1. CONTEXTO
======================================================================
FinancialControl es una app de finanzas personales para iPhone hecha con
Expo SDK 58, React Native 0.88, TypeScript y Expo Router. El registro es
manual y los datos viven en SQLite dentro del dispositivo (expo-sqlite).
No hay conexión con bancos.

Estado de partida, comprobado el 17/11/2026:

- Rama actual: h3-vision-completa. Último commit: b055bf5.
- 388 pruebas en 18 suites, todas en verde con `npm run check`.
- Esquema de base de datos en la versión 2 (src/datos/migraciones.ts).
- Pestañas: Inicio, Movimientos, Análisis y Cuentas
  (src/app/(tabs)/_layout.tsx, con NativeTabs).
- La app ya responde a «cuánto tengo» (patrimonio, inversiones) y a «qué
  he hecho con el dinero» (Análisis por día, mes y año).
- El dueño la ha probado en su iPhone real y la da por buena.

Lo que la app todavía no responde es «qué puedo gastar» y «qué viene».
Ese es el hueco que cierra este bloque.

Capas del código, que debes respetar:

- src/dominio/   cálculo puro, sin base de datos ni React. Recibe «hoy»
                 como parámetro, nunca lo lee del reloj.
- src/datos/     repositorios sobre SQLite y migraciones.
- src/estado/    lo que las pantallas consumen.
- src/app/       pantallas de Expo Router.
- src/componentes/ y src/theme/   piezas visuales, paleta y gráficos
                 propios con react-native-svg.
- src/i18n/es.json   todos los textos visibles.

Convenciones vigentes (src/dominio/modelo.ts): importes en céntimos
enteros con su divisa, id UUID generado en el dispositivo, creadoEn y
modificadoEn en UTC, borrado lógico con borradoEn, fechas de movimiento
como día local "AAAA-MM-DD". Los agregados se calculan, no se guardan.
Los errores de negocio son ErrorDeDominio con un código, y el texto sale
del catálogo.

======================================================================
2. OBJETIVO
======================================================================
Al terminar, una persona puede:

1. Crear el presupuesto de un mes por categorías y ver previsto frente a
   real.
2. Ver en Inicio cuánto le queda por gastar este mes y cuánto es eso por
   día.
3. Dar de alta sus gastos fijos, suscripciones e ingresos periódicos, ver
   qué se le cobra en los próximos 14 días y confirmar cada cobro con un
   toque.
4. Crear objetivos de ahorro o inversión, aportar a ellos y saber cuánto
   necesita aportar al mes para llegar a tiempo.
5. Ver una previsión del saldo con el que llegará a fin de mes.

Tareas del backlog que cubre (docs/07-hoja-de-ruta-y-backlog.md):
T-060, T-061, T-062, T-063, T-064, T-065, T-066, T-067, T-069, T-070
(Objetivo y AportacionAObjetivo), T-071, T-072, y la parte de T-084 que
dependía de ellas (D1, D4, D8 y D9 en Inicio).

======================================================================
3. DECISIONES YA TOMADAS (no las reabras)
======================================================================
D-a. Rama nueva `h5-planificacion`, creada desde `h3-vision-completa`.
D-b. Ninguna dependencia nueva, ni nativa ni de JavaScript. No se toca
     la carpeta ios/, no se ejecuta `expo prebuild` ni `pod install`.
     La carpeta ios/ tiene ajustes manuales de firma que no están en git.
D-c. Sin notificaciones del sistema en este bloque. Los avisos de T-066
     y T-067 se resuelven dentro de la app (tarjetas y marcas en
     pantalla). La notificación real queda para el bloque de entrada
     rápida. Anótalo como alcance reducido de esas dos tareas, no como
     hechas al completo.
D-d. Sin versión web. El error «Unable to resolve react-native-web» al
     abrir en navegador es conocido y pertenece a un bloque posterior.
     No instales react-native-web.
D-e. Pestaña nueva «Plan» entre Análisis y Cuentas, con tres secciones:
     Presupuesto, Fijos y Objetivos.
D-f. El botón «+» se queda donde está (arriba a la derecha).
D-g. Periodicidades admitidas: mensual y anual. Nada más.
D-h. No hay «saltar un cobro este mes». Quien no quiera un cobro
     desactiva la regla o le pone fecha de fin. Regístralo como
     limitación.
D-i. No subas nada a GitHub. Los commits se quedan en local.

======================================================================
4. LECTURA OBLIGATORIA ANTES DE DISEÑAR
======================================================================
Lee los archivos reales. No supongas su contenido por el nombre.

- AGENTS.md
- docs/estado.md, apartado 8 entero
- docs/03-diseno-de-producto.md: flujos F4, F5 y F6, tabla de dashboards
  (D1, D3, D4, D8, D9) y las pantallas P11 a P16
- docs/05-arquitectura-y-modelo-de-datos.md: apartado 4 (entidades,
  relaciones y definiciones de cálculo)
- docs/07-hoja-de-ruta-y-backlog.md: H5 y H6
- docs/09-decisiones.md
- src/dominio/ completo, con atención a modelo.ts, resumen.ts, tiempo.ts
  y patrimonio.ts
- src/datos/migraciones.ts, valores.ts y movimientos.ts
- src/app/(tabs)/index.tsx y analisis.tsx
- src/componentes/Graficos.tsx y Tarjeta.tsx, src/theme/

Si un documento contradice este prompt en una regla de cálculo, PARA y
pregunta. Si la diferencia es de presentación (un texto, el orden de dos
campos), sigue este prompt y anótalo en docs/estado.md.

======================================================================
5. BASELINE
======================================================================
Antes de cambiar nada, registra en docs/estado.md, en un apartado 9
nuevo:

- rama y commit de partida
- resultado de `npm run check` (número de pruebas y suites)
- versión del esquema de la base de datos
- `git status` limpio, o qué hay sin confirmar

PARA si la rama no es h3-vision-completa, si `npm run check` falla antes
de empezar o si hay cambios sin confirmar que no sean de docs/.

======================================================================
6. MODELO DE DATOS (migración 3)
======================================================================
Una sola migración nueva, la 3. Las migraciones 1 y 2 no se modifican.
La base de datos de una persona con datos reales debe pasar de la 2 a la
3 sin perder nada.

Tablas nuevas, todas con los campos comunes (id, creado_en,
modificado_en, borrado_en) y con el mismo estilo de CHECK que las
existentes:

regla_recurrente
  nombre, clase ('fijo', 'suscripcion', 'ingreso', 'aportacion'),
  tipo_movimiento ('gasto', 'ingreso', 'transferencia'), importe (> 0),
  divisa, cuenta_id, cuenta_destino_id, categoria_id, periodicidad
  ('mensual', 'anual'), dia_del_mes (1 a 31), fecha_inicio, fecha_fin
  (opcional), activa, aviso_dias_antes, objetivo_id (opcional).
  Coherencia: fijo y suscripcion son gasto, ingreso es ingreso,
  aportacion es transferencia con cuenta destino obligatoria. Gasto e
  ingreso llevan categoría del tipo correcto.

presupuesto
  periodo ("AAAA-MM"), nota. Uno por mes: índice único sobre periodo
  entre los no borrados.

linea_de_presupuesto
  presupuesto_id, categoria_id, importe (>= 0). Una línea por categoría
  y presupuesto.

objetivo
  nombre, tipo ('ahorro', 'inversion'), meta (> 0), divisa, fecha_limite
  (opcional), cuenta_id (opcional), archivado.

aportacion_a_objetivo
  objetivo_id, fecha, importe (> 0), movimiento_id (opcional), nota.

Movimiento ya tiene reglaRecurrenteId y objetivoId. Úsalos, no crees
columnas nuevas en movimiento.

Cada tabla tiene su repositorio en src/datos/ con pruebas de creación,
consulta, edición y borrado lógico, al estilo de valores.ts.

======================================================================
7. REGLAS DE CÁLCULO
======================================================================
Todo esto va en src/dominio/, como funciones puras con pruebas. «Hoy»
entra como parámetro.

7.1 Ocurrencias de una regla
- Una regla mensual ocurre una vez cada mes, el dia_del_mes. Si el mes
  tiene menos días, ocurre el último día del mes (el 31 cae el 28 o 29
  de febrero y el 30 de abril).
- Una regla anual ocurre una vez al año, en el mes de su fecha_inicio.
- No hay ocurrencias antes de fecha_inicio, después de fecha_fin, ni
  con la regla inactiva o borrada.
- Una ocurrencia está CONFIRMADA si existe un movimiento no borrado con
  ese reglaRecurrenteId y fecha dentro del mismo mes. Si no, está
  PENDIENTE. Pendiente con día anterior o igual a hoy es «por
  confirmar». Pendiente con día posterior es «próximo».

7.2 Confirmar una ocurrencia (T-066)
- Crea un movimiento con origen 'recurrente', reglaRecurrenteId, y los
  datos de la regla. La persona puede cambiar importe y fecha antes de
  guardar.
- Alternativa «Ya lo anoté»: enlaza un movimiento existente del mismo
  mes, mismo tipo y misma cuenta que aún no tenga regla. Se le pone el
  reglaRecurrenteId. No se crea nada nuevo.
- Confirmar dos veces la misma ocurrencia no crea dos movimientos.
- En una regla de clase 'aportacion' con objetivo, confirmar crea la
  transferencia con objetivoId y una aportacion_a_objetivo enlazada a
  ese movimiento (T-072).

7.3 Presupuesto (T-061, T-062)
- Las líneas van sobre categorías de gasto de primer nivel. El gasto
  real de una línea suma el de la categoría y el de sus subcategorías.
- El gasto en categorías sin línea se muestra en una fila «Sin
  presupuestar» y cuenta en el gastado total.
- Propuesta al crear: para cada categoría, la media de gasto de los tres
  meses naturales anteriores. Para el caso de menos de tres meses con
  datos, sigue lo que diga el flujo F4 de docs/03.
- «Copiar el mes anterior» reproduce las líneas del presupuesto del mes
  anterior. Si no existe, la acción aparece desactivada con su
  explicación.
- Estados de una línea: dentro, cerca (80 % o más) y excedida. Cada
  estado se distingue con icono y texto, no solo con color.
- Marca del día: posición = día de hoy ÷ días del mes. Solo en el mes en
  curso.

7.4 Disponible del mes (D1, T-063)
  disponible = presupuesto total − gastado del mes − fijos pendientes

- gastado del mes: suma de movimientos de tipo gasto del mes. Las
  transferencias y los ajustes no cuentan.
- fijos pendientes: ocurrencias pendientes este mes de reglas de gasto.
  Una ocurrencia confirmada ya está dentro del gastado y no se resta dos
  veces.
- por día = disponible ÷ días que quedan contando hoy, redondeado hacia
  abajo al céntimo.
- Si el disponible es negativo, se muestra «Te has pasado X» y el
  importe por día es 0.
- Sin presupuesto del mes no hay cifra: se muestra la invitación a
  crearlo.

Caso de comprobación, hoy 17/11/2026 (noviembre tiene 30 días):
presupuesto 1.100,00 €, gastado 687,00 €, un fijo pendiente de 45,00 €.
Disponible 368,00 €. Quedan 14 días contando hoy. Por día 26,28 €.
Si ese fijo se confirma por 45,00 €, el gastado pasa a 732,00 € y el
disponible sigue en 368,00 €.

7.5 Previsión de fin de mes (D4, T-069)
  previsto = saldo actual de banco y efectivo
             − gastos recurrentes pendientes
             + ingresos recurrentes pendientes
             − aportaciones pendientes que salen hacia inversión
             − gasto variable diario × días que quedan sin contar hoy

- gasto variable diario = gasto del mes de movimientos sin regla ÷ días
  transcurridos contando hoy.
- Una transferencia pendiente entre dos cuentas de banco o efectivo no
  cambia el total.

Caso de comprobación, hoy 17/11/2026: saldo 2.000,00 €, fijos pendientes
de 300,00 € y 50,00 €, un ingreso pendiente de 1.500,00 €, gasto
variable del mes 340,00 € (20,00 € al día), quedan 13 días.
Previsto = 2.000 − 350 + 1.500 − 260 = 2.890,00 €.

7.6 Objetivos (D8, T-071)
- aportado = suma de aportaciones no borradas.
- avance = aportado ÷ meta, con tope visual del 100 %.
- meses restantes = (año límite − año actual) × 12 + (mes límite − mes
  actual), con mínimo 1.
- necesario al mes = (meta − aportado) ÷ meses restantes, redondeado
  hacia arriba al céntimo.
- Sin fecha límite no hay «necesario al mes».
- aportado ≥ meta: estado «Conseguido», sin ritmo.
- Fecha límite pasada sin conseguir: estado «Plazo vencido», sin ritmo.
- Borrar un movimiento enlazado borra también su aportación. Deshacer el
  borrado recupera las dos cosas.

Caso de comprobación, hoy 17/11/2026: meta 1.500,00 €, aportado
500,00 €, límite 31/07/2027. Meses restantes 8. Necesario 125,00 € al
mes.

7.7 Divisas
Sigue el mismo criterio que src/dominio/patrimonio.ts. No sumes importes
de divisas distintas. Si ese criterio no cubre un caso de este bloque,
PARA y pregunta.

======================================================================
8. PANTALLAS
======================================================================
Usa los componentes, la paleta y los gráficos que ya existen. El aspecto
debe ser indistinguible del resto de la app, en claro y en oscuro.

Plan (pestaña nueva), con selector Presupuesto / Fijos / Objetivos:

- Presupuesto del mes (P11): mes con navegación, presupuestado y gastado,
  una barra por línea con previsto frente a real, lo que queda o el
  exceso, y la marca del día. Sin presupuesto: «Crea tu presupuesto de
  <mes>».
- Edición de presupuesto (P12): importe por categoría con la propuesta
  ya puesta, total arriba, y «Copiar el mes anterior».
- Gastos fijos (P13): total mensual (suma de las reglas mensuales de
  gasto activas), reglas anuales en un grupo aparte con su mes, lista
  por clase, calendario del mes con los días de cobro y lista de los
  próximos 14 días.
- Alta y edición de regla (P14): nombre, importe, clase, día, cuenta,
  categoría, periodicidad, fecha de fin opcional y activa.
- Objetivos (P15): tarjetas con anillo de avance, aportado de meta y
  «necesitas X al mes».
- Detalle de objetivo (P16): avance, fecha límite, necesario al mes,
  lista de aportaciones, «Aportar» y «Crear aportación mensual», que
  abre el alta de regla con la clase aportacion y el objetivo puestos.

Inicio, bloques nuevos debajo del patrimonio y sin quitar nada de lo que
hay:

- «Disponible este mes» (D1): cifra grande, importe por día y barra de
  avance del presupuesto.
- «Por confirmar»: ocurrencias con día vencido, con confirmación en un
  toque. Solo aparece si hay alguna.
- «Próximos cobros» (D9): los de los próximos 14 días.
- «Objetivos» (D8): hasta tres, con anillo y ritmo necesario.
- «Fin de mes previsto» (D4): la cifra y una línea con el saldo real
  hasta hoy y el previsto en trazo discontinuo.
- Aviso de presupuesto (T-067, versión en pantalla): si alguna línea
  pasa del 80 %, una tarjeta la nombra. Se deriva del estado, no se
  guarda.

Cada bloque sin datos muestra un estado vacío con una frase que explica
qué falta y un acceso para crearlo. Nunca un hueco ni un cero engañoso.

Accesibilidad: áreas táctiles de 44 puntos como mínimo, etiquetas para
VoiceOver en cifras y gráficos, texto grande sin cortes, respeto de
«Reducir movimiento», contraste validado con src/theme/contraste.ts.

Todos los textos van a src/i18n/es.json. Español de España, trato de tú,
frases cortas.

======================================================================
9. FASES
======================================================================
Un commit por fase, con el prefijo «H5:». Dentro de cada fase:
diagnosticar, implementar, prueba dirigida, intentar romperlo, corregir.
La suite completa se pasa al cerrar cada fase, no tras cada cambio.

Fase 0. Baseline y lectura (apartados 4 y 5).
Fase 1. Dominio: ocurrencias, presupuesto, disponible, previsión y
        objetivos, con sus pruebas y los tres casos de comprobación.
Fase 2. Migración 3 y repositorios. Prueba de que una base en versión 2
        con datos pasa a la 3 y conserva cuentas, categorías,
        movimientos y valores.
Fase 3. Pestaña Plan: Presupuesto (P11 y P12).
Fase 4. Pestaña Plan: Fijos (P13 y P14) y confirmación de cobros.
Fase 5. Pestaña Plan: Objetivos (P15 y P16) y aportación mensual.
Fase 6. Inicio con los bloques nuevos.
Fase 7. Casos límite, accesibilidad, capturas y regresión.
Fase 8. Documentación e informe.

======================================================================
10. CASOS LÍMITE QUE DEBES PROBAR
======================================================================
- Regla del día 31 en febrero, abril y en febrero de año bisiesto.
- Regla anual fuera de su mes y dentro de él.
- Regla con fecha_fin a mitad de mes, antes y después de su día.
- Regla inactiva, y regla cuya cuenta o categoría se archiva.
- Confirmar dos veces seguidas la misma ocurrencia.
- Movimiento confirmado que luego se borra: la ocurrencia vuelve a
  pendiente. Si se deshace el borrado, vuelve a confirmada.
- Movimiento confirmado al que se le cambia la fecha a otro mes.
- Presupuesto sin líneas, con una línea a 0 y con gasto solo en
  categorías sin línea.
- Gasto en una subcategoría cuya categoría padre tiene línea.
- Disponible negativo, y último día del mes (queda 1 día).
- Primer día del mes en la previsión (1 día transcurrido).
- Mes pasado y mes futuro en P11: sin marca del día.
- Objetivo sin fecha, con fecha este mismo mes, con plazo vencido, con
  aportado mayor que la meta y con meta de más de un millón.
- Aportación sin movimiento enlazado.
- Nombres duplicados que solo cambian en mayúsculas o acentos.
- Importes de 0,01 € y de más de 1.000.000 € en barras, anillos y
  tarjetas, sin desbordes.
- Texto grande del sistema y modo oscuro en todas las pantallas nuevas.
- Base de datos vacía: Inicio y Plan muestran sus estados vacíos.

======================================================================
11. LO QUE NO PUEDE CAMBIAR
======================================================================
- Las 388 pruebas existentes siguen pasando sin modificar lo que
  comprueban. Si una prueba antigua falla, la causa está en tu cambio.
- Saldos, patrimonio, inversión y Análisis dan las mismas cifras que
  antes con los mismos datos.
- Las migraciones 1 y 2, intactas.
- Las pantallas existentes conservan su comportamiento. En Inicio solo
  se añaden bloques.
- ios/, app.json, package.json y package-lock.json no se tocan.
- La rama main y las ramas anteriores no se tocan.

======================================================================
12. VERIFICACIÓN VISUAL
======================================================================
Usa el mismo método de capturas del bloque anterior (simulador con
`xcrun simctl io booted screenshot` y los enlaces `financialcontrol://`,
descrito en docs/estado.md). Si el simulador no arranca o la app
instalada en él no carga el código nuevo sin recompilar, no fuerces una
compilación nativa: registra NO DEMOSTRADO para las capturas y sigue.

Capturas en docs/capturas/h5/, en claro y en oscuro: presupuesto vacío,
presupuesto con una línea excedida, edición de presupuesto, fijos con
calendario, alta de regla, objetivos, detalle de objetivo, Inicio parte
alta e Inicio parte baja.

Mira cada captura antes de darla por buena. Una pantalla con texto
cortado, solapado o ilegible no está terminada. Cualquier código
temporal usado para capturar no entra en la rama.

======================================================================
13. CRITERIOS DE ÉXITO
======================================================================
Todos deben cumplirse:

[ ] `npm run check` pasa entero: formato, lint, tipos y pruebas.
[ ] Las 388 pruebas de partida siguen en verde y hay pruebas nuevas para
    cada regla del apartado 7 y cada caso del apartado 10.
[ ] Los tres casos de comprobación dan exactamente 368,00 € y 26,28 € al
    día, 2.890,00 €, y 125,00 € al mes.
[ ] Una base en versión 2 con datos pasa a la 3 sin perder ninguno.
[ ] Con tres meses de datos, P12 propone la media por categoría, y
    «Copiar» reproduce el mes anterior.
[ ] Una línea excedida se distingue por icono y texto.
[ ] Un fijo del día 18 aparece el 18 en el calendario.
[ ] Confirmar un cobro crea un movimiento con origen 'recurrente'
    enlazado a la regla, y solo uno.
[ ] Confirmar una aportación mensual crea la transferencia y suma al
    objetivo.
[ ] Inicio muestra D1, D9, D8 y D4 con datos, o su estado vacío.
[ ] `git diff --stat h3-vision-completa` no incluye ios/, app.json,
    package.json ni package-lock.json.

======================================================================
14. NO HACER
======================================================================
- No inventes datos, cifras, capturas ni resultados de pruebas.
- No instales dependencias ni toques la configuración nativa.
- No desactives, saltes ni reescribas pruebas para que pasen.
- No guardes en la base de datos totales, saldos ni avances calculados.
- No leas la fecha del reloj dentro de src/dominio/.
- No pongas textos visibles fuera de es.json.
- No uses el color como única señal de un estado.
- No refactorices lo que no hace falta para este bloque.
- No implementes notificaciones, widgets, importaciones, sincronización,
  cuentas de usuario, suscripción de pago ni versión web.
- No subas nada a GitHub ni toques main.
- No marques como hecha una tarea con alcance reducido. Escribe qué
  parte queda.

======================================================================
15. CUÁNDO PARAR Y CUÁNDO NO
======================================================================
PARA Y PREGUNTA si:
- el baseline no coincide con el apartado 1
- un documento contradice una regla de cálculo del apartado 7
- cumplir un requisito exige una dependencia nueva o tocar ios/
- la migración 3 no puede aplicarse sin perder o alterar datos
- hay que cambiar el comportamiento de una pantalla existente

NO pares por:
- una prueba que falla mientras desarrollas
- un caso límite reproducible dentro del alcance
- un defecto relacionado que hay que corregir para cumplir el objetivo
- no poder hacer capturas (regístralo y continúa)

======================================================================
16. DOCUMENTACIÓN
======================================================================
Describe el estado real, no el deseado. Actualiza solo lo afectado:

- docs/estado.md: apartado 9 con baseline, hecho, casos límite,
  limitaciones y acciones del usuario, con la misma forma que el 8.
- docs/07-hoja-de-ruta-y-backlog.md: estado de cada tarea tocada y el
  bloque 2 de la tabla 2.1. T-066 y T-067 quedan como parciales por la
  decisión D-c.
- docs/05-arquitectura-y-modelo-de-datos.md: las reglas de cálculo del
  apartado 7 tal como han quedado.
- docs/03-diseno-de-producto.md: la nota de Inicio que decía que D1, D4,
  D8 y D9 no aparecían.

En las acciones del usuario, explica que la app instalada en modo
Release lleva el código dentro y que para ver este bloque en el iPhone
hay que volver a ejecutar
`npx expo run:ios --device --configuration Release`.

======================================================================
17. INFORME FINAL
======================================================================
Breve y verificable, sin volcados de registro:

- Baseline
- Qué se ha hecho, por fase y con el commit de cada una
- Archivos creados y modificados
- Pruebas: cuántas había, cuántas hay, resultado de `npm run check`
- Resultado de los tres casos de comprobación
- Casos límite probados y su resultado
- Regresión: qué se comprobó de lo anterior
- Capturas hechas y cuáles faltan
- Decisiones tomadas por tu cuenta y por qué
- Limitaciones y lo NO DEMOSTRADO
- Pendientes externos y acciones del usuario
- Estado final, uno de: COMPLETED, COMPLETED_WITH_EXTERNAL_GATES,
  PARTIALLY_COMPLETED, BLOCKED_BY_EVIDENCE,
  BLOCKED_BY_EXTERNAL_DEPENDENCY, FAILED_VALIDATION

No declares COMPLETED si queda sin cumplir algún criterio del
apartado 13.
```
