# Prompt para Claude Code · Bloque 3b: Navegación y organización de pestañas

Pega todo lo que sigue en Claude Code, abierto en `~/Desktop/FinancialControl`.

```
======================================================================
1. CONTEXTO
======================================================================
FinancialControl es una app de finanzas personales para iPhone hecha con
Expo SDK 58, React Native 0.88, TypeScript y Expo Router (pestañas con
NativeTabs y una pila con hojas modales en src/app/_layout.tsx).

Estado de partida, comprobado el 17/11/2026:

- Rama actual: b3-entrada-rapida. Último commit: 4012009.
- 672 pruebas en 28 suites, en verde con `npm run check`.
- Esquema de la base de datos en la versión 4.
- Pestañas actuales: Inicio, Movimientos, Análisis, Plan y Cuentas.
- El dueño la usa en su iPhone real, instalada en modo Release.

La app ha crecido por bloques y cada bloque añadió pantallas donde
cabían. El contenido es correcto. La organización ya no lo es. Estos
son los problemas observados en el código, que debes confirmar:

P1. Inicio acumula unos trece bloques (patrimonio, disponible, aviso de
    presupuesto, por confirmar, pagos por revisar, próximos cobros, fin
    de mes previsto, objetivos, balance del mes, hoy, cuentas, gasto por
    categoría y evolución). Varios repiten lo que ya está en Análisis,
    Plan o Cuentas.
P2. El botón «+» para anotar un movimiento está arriba a la derecha,
    lejos del pulgar, aunque es la acción más repetida de la app.
P3. El mismo símbolo «+» significa cosas distintas según la pantalla:
    en Inicio y Movimientos añade un movimiento, en Plan crea un gasto
    fijo o un objetivo y en Cuentas crea una cuenta.
P4. Los ajustes (Categorías, Apple Pay, Avisos, Diagnóstico) están al
    pie de la pestaña Cuentas, donde nadie los busca.
P5. Inversiones y Patrimonio solo se alcanzan desde enlaces dentro de
    otras pantallas. La bandeja de pagos por revisar, desde Movimientos
    o desde una tarjeta de Inicio que no siempre aparece.
P6. docs/03-diseno-de-producto.md, apartados 2 y 3, describe una
    navegación (botón central, engranaje de Ajustes en Inicio) que nunca
    se llegó a construir.

======================================================================
2. OBJETIVO
======================================================================
Que una persona que abre la app por primera vez sepa dónde está cada
cosa sin explicación, y que quien la usa a diario llegue a lo frecuente
con el mínimo de toques.

El modelo mental es una pregunta por pestaña:

  Inicio        ¿Cómo voy y qué tengo que hacer hoy?
  Movimientos   ¿En qué se ha ido el dinero? (lista y bandeja)
  Análisis      ¿Cómo gasto a lo largo del tiempo?
  Plan          ¿Qué puedo gastar y qué viene?
  Cuentas       ¿Cuánto tengo y dónde está?

Este bloque NO añade funciones ni cambia ningún cálculo. Mueve, agrupa,
renombra y unifica. Lo que queda cerrado al terminar: P1 a P6.

======================================================================
3. DECISIONES YA TOMADAS (no las reabras)
======================================================================
D-a. Rama nueva `b3b-navegacion`, creada desde `b3-entrada-rapida`.
D-b. Se mantienen las cinco pestañas, con esos nombres y ese orden.
D-c. Añadir un movimiento es una acción global, igual en las cinco
     pestañas, al alcance del pulgar y con un solo toque. Orden de
     preferencia para construirla:
       1. Un botón de acción integrado en la barra de pestañas, si la
          versión instalada de NativeTabs lo admite de forma
          documentada. Compruébalo en la documentación de Expo 58, no
          lo supongas.
       2. Si no lo admite, un botón flotante abajo a la derecha, justo
          encima de la barra, con margen inferior en todas las listas y
          pantallas para que nunca tape contenido ni el último elemento.
     No vuelve a la esquina superior. No se sustituye NativeTabs por
     una barra hecha a mano.
D-d. El símbolo «+» a solas queda reservado para «añadir movimiento».
     Las demás altas (cuenta, gasto fijo, objetivo, categoría, valor de
     inversión) usan un botón con texto dentro de su sección: «Nueva
     cuenta», «Nuevo gasto fijo», «Nuevo objetivo».
D-e. Pantalla «Ajustes» nueva, abierta con un engranaje en la cabecera
     de Inicio. Reúne Categorías, Apple Pay y tarjetas, Avisos y
     Diagnóstico. Esos accesos desaparecen del pie de Cuentas.
D-f. Inicio queda en un máximo de siete bloques, en este orden:
       1. Lo que tienes (cabecera de patrimonio, como hoy)
       2. Disponible este mes
       3. Pendiente: un solo bloque que reúne cobros por confirmar,
          pagos por revisar y avisos de presupuesto. Solo aparece si
          hay algo pendiente.
       4. Próximos cobros: como mucho tres y «Ver todos»
       5. Este mes: ingresos, gastos y balance, con el gasto de hoy en
          una línea y acceso a Análisis
       6. Objetivos: como mucho dos y «Ver todos»
       7. Primeros pasos (ver D-h), solo mientras falte alguno
     Lo que sale de Inicio no se borra, se reubica según el apartado 5.
D-g. Cuentas pasa a ser el sitio de todo lo que se tiene: patrimonio
     arriba con acceso a su evolución, cuentas de banco y efectivo, y
     las inversiones como sección propia con su ganancia. Inversiones y
     Patrimonio dejan de depender de enlaces sueltos.
D-h. «Primeros pasos»: una tarjeta en Inicio con tres tareas (crear una
     cuenta, anotar un movimiento, crear el presupuesto del mes). Cada
     una se marca sola al cumplirse y la tarjeta desaparece al
     completar las tres. Se deduce de los datos, no se guarda nada.
D-i. Sin dependencias nuevas. Sin tocar app.json, plugins/,
     app-intents/, src/widgets/, ios/ ni las migraciones. Si algo de
     este bloque lo exigiera, PARA y pregunta.
D-j. Sin versión web ni Android.
D-k. Puedes subir la rama nueva a GitHub al terminar. No toques main ni
     fusiones nada.

======================================================================
4. LECTURA Y MAPA PREVIO (antes de mover nada)
======================================================================
Lee los archivos reales:

- AGENTS.md y docs/estado.md, apartados 9 y 10
- docs/03-diseno-de-producto.md completo
- src/app/_layout.tsx y todo src/app/, pantalla por pantalla
- src/componentes/basicos.tsx (Cabecera, BotonAnadir, Segmentos,
  useMargenDeLista) y src/componentes/plan/
- src/estado/widget.ts, src/estado/avisos.ts y el código que abre una
  pantalla al tocar un aviso
- src/pruebas/__tests__/ (pruebas de pantalla)
- La documentación de NativeTabs de Expo Router para SDK 58

Después, y antes de cambiar código, escribe en
docs/notas/navegacion-b3b.md el MAPA ACTUAL:

- cada pantalla de src/app/, qué pregunta responde y cómo se llega a
  ella (desde dónde y con cuántos toques desde Inicio)
- cada bloque de Inicio y en qué otra pantalla existe ya el mismo dato
- cada lugar donde aparece un «+» y qué hace
- cada enlace de entrada externo: URLs financialcontrol:// del widget,
  destinos de los avisos, parámetros de plan y de analisis

Si el mapa contradice los problemas P1 a P6, manda lo que observes y
anótalo. Si descubres que reubicar un bloque obligaría a perder un dato
que no existe en ningún otro sitio, ese dato se mueve, no se elimina.

======================================================================
5. REUBICACIÓN DE LO QUE SALE DE INICIO
======================================================================
Destino por defecto de cada bloque. Antes de quitar uno de Inicio,
comprueba que su destino muestra el mismo dato con el mismo cálculo. Si
no lo muestra, lleva allí el bloque tal cual.

  Fin de mes previsto     Plan > Presupuesto
  Gasto por categoría     Análisis > Mes
  Evolución               Análisis (la vista que ya tenga la serie)
  Cuentas (lista)         Pestaña Cuentas
  Hoy                     Una línea dentro de «Este mes» y Análisis > Día
  Aviso de presupuesto    Dentro de «Pendiente»
  Por confirmar           Dentro de «Pendiente»
  Pagos por revisar       Dentro de «Pendiente»

Cada elemento de «Pendiente» conserva su acción directa: confirmar un
cobro, abrir la bandeja, abrir la línea de presupuesto.

======================================================================
6. REGLAS DE COHERENCIA PARA TODA LA APP
======================================================================
R1. Cada pestaña tiene título, y debajo, si tiene secciones, el mismo
    selector de segmentos en la misma posición.
R2. Ver un detalle empuja una pantalla con flecha de volver. Crear o
    editar abre una hoja modal con Cancelar y Guardar. Sin excepciones.
R3. Toda pantalla secundaria tiene una forma visible de volver.
R4. Un mismo dato se llama igual en todas partes. Revisa en es.json los
    rótulos de navegación y unifica los que difieran para lo mismo.
R5. Los bloques con más elementos de los que caben muestran un número
    fijo y un «Ver todos» que lleva a su pestaña y sección exactas.
R6. Cambiar de pestaña y volver conserva el mes elegido, la sección y
    la posición, como hoy.
R7. Todos los enlaces de entrada siguen funcionando con las mismas
    URLs: financialcontrol://, financialcontrol://movimiento,
    plan?seccion=…&mes=…, analisis?vista=…, y los destinos de cada tipo
    de aviso. Si una pantalla cambia de sitio, su ruta antigua se
    mantiene.
R8. Áreas táctiles de 44 puntos, etiquetas de VoiceOver en el botón de
    añadir, el engranaje y cada acceso nuevo, y nada cortado con el
    texto del sistema al máximo.

======================================================================
7. FASES
======================================================================
Un commit por fase, con el prefijo «B3b:».

Fase 0. Baseline: rama, commit, `npm run check`, `git status`. Regístralo
        en docs/estado.md, apartado 11 nuevo.
Fase 1. Mapa actual (apartado 4) y, en el mismo documento, el MAPA
        PROPUESTO con la tabla antes y después de cada pantalla y
        bloque. Si tu propuesta se aparta de D-a a D-k, PARA y pregunta.
Fase 2. Acción global de añadir movimiento (D-c) y reserva del «+»
        (D-d).
Fase 3. Pantalla Ajustes y limpieza del pie de Cuentas (D-e).
Fase 4. Cuentas como sitio del patrimonio y las inversiones (D-g).
Fase 5. Inicio en siete bloques y reubicación (D-f y apartado 5).
Fase 6. Primeros pasos (D-h).
Fase 7. Reglas de coherencia R1 a R8 en el resto de pantallas.
Fase 8. Casos límite, capturas y regresión.
Fase 9. Documentación e informe.

======================================================================
8. CASOS LÍMITE QUE DEBES PROBAR
======================================================================
- App recién instalada, sin datos: Inicio muestra Primeros pasos y
  estados vacíos con sentido, no siete huecos.
- Con cuenta pero sin movimientos, y con movimientos pero sin
  presupuesto: Primeros pasos marca lo hecho.
- Nada pendiente: el bloque «Pendiente» no aparece ni deja hueco.
- Mucho pendiente (5 cobros, 12 pagos, 3 avisos): el bloque no crece
  sin límite.
- Ningún objetivo y ningún gasto fijo.
- Botón de añadir: última fila de cada lista visible y tocable, también
  en Movimientos con 500 filas, en el calendario de Análisis y en los
  formularios con el teclado abierto.
- Botón de añadir con una hoja modal abierta: no se superpone.
- Abrir financialcontrol://movimiento con la app cerrada y con la app
  en cada una de las cinco pestañas.
- Tocar un aviso de cobro, de presupuesto, de pago sin revisar y de
  valor de inversión: cada uno abre su pantalla.
- Ir a una sección por «Ver todos» y volver atrás: se vuelve al sitio
  de origen.
- Texto del sistema al máximo: las cinco etiquetas de la barra, el
  selector de segmentos y la pantalla Ajustes.
- Modo oscuro en todas las pantallas tocadas.
- Rutas antiguas (/inversiones, /patrimonio, /capturas, /avisos,
  /apple-pay, /categorias) siguen abriendo algo válido.

======================================================================
9. LO QUE NO PUEDE CAMBIAR
======================================================================
- Ningún cálculo. Las cifras de cada bloque son idénticas antes y
  después con los mismos datos.
- Ninguna función desaparece. Todo lo que se podía hacer antes se puede
  hacer después.
- Las pruebas de dominio y de datos no se tocan.
- De las pruebas de pantalla solo pueden cambiar las que comprueban en
  qué pantalla está un bloque o un acceso que este encargo mueve. Cada
  cambio se lista con su motivo. Ninguna se borra sin sustituirla por
  otra que compruebe lo mismo en el sitio nuevo.
- La base de datos, las migraciones, las acciones de Atajos, el widget y
  la configuración nativa.
- El aspecto visual: misma paleta, tarjetas, tipografía y gráficos.

======================================================================
10. VERIFICACIÓN
======================================================================
- `npm run check` al cerrar cada fase.
- Tabla de toques, medida sobre la app real y no deducida, en
  docs/notas/navegacion-b3b.md, antes y después:
    anotar un gasto desde cualquier pestaña          objetivo: 1
    abrir la bandeja de pagos por revisar            objetivo: 2 o menos
    confirmar un cobro pendiente                     objetivo: 2 o menos
    abrir Ajustes > Avisos                           objetivo: 2 o menos
    actualizar el valor de una inversión             objetivo: 3 o menos
    ver el presupuesto del mes                       objetivo: 1
    ver la evolución del patrimonio                  objetivo: 2 o menos
- Capturas en docs/capturas/b3b/, en claro y en oscuro, con el método
  de los bloques anteriores: las cinco pestañas, Inicio sin datos,
  Inicio con pendientes, Ajustes, Cuentas con inversiones y una lista
  larga con el botón de añadir sobre la última fila. Con el texto al
  máximo: barra de pestañas y Ajustes.
- Mira cada captura antes de darla por buena.
- Este bloque es solo JavaScript: no hace falta prebuild. Si el
  simulador no carga el código nuevo, no fuerces nada nativo y marca
  las capturas como NO DEMOSTRADO. El Mac va lento con el simulador:
  espera, no supongas.

======================================================================
11. CRITERIOS DE ÉXITO
======================================================================
[ ] `npm run check` pasa entero.
[ ] Las 672 pruebas de partida siguen en verde, con las excepciones
    listadas, y hay pruebas nuevas para: la acción global en las cinco
    pestañas, Ajustes y sus cuatro accesos, el bloque «Pendiente» con y
    sin contenido, Primeros pasos en sus cuatro estados y cada «Ver
    todos».
[ ] Inicio tiene siete bloques como máximo.
[ ] El «+» a solas solo añade movimientos, en toda la app.
[ ] Cada dato que salió de Inicio está en su destino con la misma cifra,
    con una prueba que lo compruebe.
[ ] La tabla de toques cumple todos los objetivos.
[ ] Todas las pantallas de src/app/ son alcanzables por navegación
    visible. El mapa propuesto lo demuestra pantalla a pantalla.
[ ] Los enlaces de entrada de R7 funcionan, con prueba.
[ ] `git diff --stat b3-entrada-rapida` no incluye app.json, plugins/,
    app-intents/, src/widgets/, src/datos/migraciones.ts, src/dominio/
    ni package.json.
[ ] docs/03, apartados 2 y 3, describe la navegación real.

======================================================================
12. NO HACER
======================================================================
- No añadas funciones, pantallas de contenido nuevo ni cálculos.
- No elimines un dato porque «ya no cabe». Reubícalo.
- No cambies nombres ni orden de las pestañas.
- No rediseñes el aspecto.
- No construyas una barra de pestañas propia.
- No dejes el botón de añadir tapando contenido en ninguna pantalla.
- No rompas rutas ni URLs existentes.
- No debilites pruebas ni las borres sin sustituirlas.
- No pongas textos visibles fuera de es.json.
- No toques nada nativo ni instales dependencias.
- No des por buena una pantalla que no has visto.

======================================================================
13. CUÁNDO PARAR Y CUÁNDO NO
======================================================================
PARA Y PREGUNTA si:
- el baseline no coincide con el apartado 1
- ninguna de las dos vías de D-c puede hacerse sin tapar contenido o
  sin dependencias nuevas
- reubicar un bloque exige cambiar un cálculo
- hay que tocar algo de la lista de D-i
- tu mapa propuesto necesita cambiar las pestañas

NO pares por:
- pruebas de pantalla que fallan porque un bloque cambió de sitio:
  actualízalas dentro de lo permitido y lístalas
- un defecto de navegación relacionado que encuentres por el camino:
  corrígelo y anótalo
- no poder hacer capturas

======================================================================
14. DOCUMENTACIÓN
======================================================================
- docs/notas/navegacion-b3b.md: mapa actual, mapa propuesto, tabla
  antes y después y tabla de toques.
- docs/03-diseno-de-producto.md, apartados 2 y 3: la arquitectura y la
  navegación tal como quedan, y qué parte del diseño original se
  descartó y por qué.
- docs/estado.md, apartado 11: baseline, hecho por fase, decisiones
  tomadas sin consultar, casos límite, capturas, limitaciones y lo NO
  DEMOSTRADO.
- docs/07: una línea en la tabla de bloques.
- En las acciones del usuario: reinstalar con
  `npx expo run:ios --device --configuration Release`.

======================================================================
15. INFORME FINAL
======================================================================
Breve y verificable:

- Baseline
- Qué confirmaste y qué no de P1 a P6
- Hecho por fase, con su commit
- Vía elegida para el botón de añadir y por qué
- Tabla antes y después: dónde estaba cada cosa y dónde está
- Tabla de toques
- Pruebas: cuántas había, cuántas hay y cuáles antiguas se tocaron
- Casos límite
- Regresión: cifras idénticas y enlaces de entrada
- Capturas hechas y cuáles faltan
- Decisiones tomadas por tu cuenta
- Limitaciones y lo NO DEMOSTRADO
- Estado final, uno de: COMPLETED, COMPLETED_WITH_EXTERNAL_GATES,
  PARTIALLY_COMPLETED, BLOCKED_BY_EVIDENCE,
  BLOCKED_BY_EXTERNAL_DEPENDENCY, FAILED_VALIDATION

No declares COMPLETED si queda algún criterio del apartado 11 sin
cumplir.
```
