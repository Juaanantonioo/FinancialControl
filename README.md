# FinancialControl

Aplicación móvil de finanzas personales, primero para iOS y después para Android.

Estado: **hitos H0, H1 y H2 en curso**. El detalle de cada tarea, con su evidencia, está en
[docs/estado.md](docs/estado.md).

## Ramas

El trabajo de cada hito está en su rama. Ninguna se ha fusionado en `main`.

| Rama | Contenido |
|---|---|
| `h0-preparacion` | Proyecto de Expo, formato, análisis estático, pruebas y conexión con Supabase |
| `h1-spike-apple-pay` | Acción de Atajos "Registrar pago", almacén de capturas y aviso local |
| `h2-nucleo-movimientos` | Cuentas, categorías, movimientos, transferencias, búsqueda y deshacer |

Las dependencias cambian de una rama a otra. Después de cambiar de rama ejecuta
`npm install`.

## Requisitos

- Mac con Xcode 27 y sus simuladores de iOS.
- Node 22 y npm.
- CocoaPods (`brew install cocoapods`).
- Xcode como directorio de desarrollo activo. Se hace una sola vez y pide tu contraseña:

  ```sh
  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
  xcodebuild -version   # debe responder "Xcode 27.2"
  ```

## Instalar

```sh
git switch h2-nucleo-movimientos   # o la rama que quieras probar
npm install
```

Para la conexión con Supabase (opcional, solo la usa la pantalla de diagnóstico):

```sh
cp .env.example .env
# Rellena .env con la dirección del proyecto y la clave PÚBLICA. Nunca la de servicio.
```

`.env` está excluido de git. No lo subas ni copies su contenido en ningún documento.

## Ejecutar

La app usa código nativo propio, así que no funciona en Expo Go. Se compila con Xcode.

```sh
npm run ios                        # compila y abre la app en el simulador
npx expo run:ios --device          # elige simulador o tu iPhone conectado por cable
```

La primera compilación tarda unos 20 minutos y ocupa varios GB. Las siguientes, 3 o 4.
Para instalarla en tu iPhone, antes inicia sesión con tu Apple Account en
Xcode › Settings › Accounts.

### Regenerar y compilar desde cero

La carpeta `ios/` se genera sola a partir de `app.json` y de los plugins de la carpeta
`plugins/`. No se edita a mano ni se sube a git. Todo lo que antes había que retocar en
Xcode está ya escrito en el repositorio:

| Ajuste | Dónde queda fijado |
|---|---|
| Equipo de firma (`8Z856TA59Z`) | `app.json`, campo `ios.appleTeamId` |
| `ENABLE_USER_SCRIPT_SANDBOXING = NO` en todos los targets | `plugins/sin-sandbox-de-scripts.js` |
| Sin permiso de push (`aps-environment`) | `plugins/sin-push.js` |

Si cambias de rama, si la compilación falla sin motivo claro o si quieres partir de cero:

```sh
npx expo prebuild --clean --platform ios   # borra ios/ y la vuelve a generar, con sus pods
npm run ios                                # compila y abre la app en el simulador
```

No hace falta abrir Xcode ni tocar nada después del `prebuild`.

### Instalar en el iPhone

Con el iPhone conectado por cable y desbloqueado:

```sh
npx expo run:ios --device --configuration Release
```

En modo Release la app lleva su código dentro y funciona sin el Mac. Cada vez que cambie
el código hay que repetir la orden para verlo en el iPhone.

Con una cuenta de Apple gratuita, **la app instalada caduca a los 7 días** y deja de
abrirse. Se arregla repitiendo la misma orden. Al instalar encima, **los datos se
conservan**: no borres la app del iPhone antes, porque al borrarla sí se pierden.

## Probar

```sh
npm run check        # todo: formato, análisis estático, tipos y pruebas
npm test             # solo las pruebas automáticas
npm run format       # corrige el formato
```

`npm run check` es lo mismo que ejecuta GitHub con cada subida
(`.github/workflows/comprobacion.yml`).

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/app/` | Pantallas. Cada fichero es una pantalla (Expo Router) |
| `src/dominio/` | Reglas sin interfaz: dinero en céntimos, modelo y cálculo de saldo |
| `src/datos/` | Base de datos local, migraciones y repositorios |
| `src/estado/` | Acceso a los datos desde las pantallas, formato regional y avisos |
| `src/componentes/` | Piezas de interfaz compartidas |
| `src/i18n/` | Catálogo de traducción. Todos los textos visibles están en `es.json` |
| `src/captura/` | Lectura de las capturas de Atajos (rama de H1) |
| `app-intents/` | Acción de Atajos, en Swift (rama de H1) |
| `docs/` | Planificación, estado, notas y material del spike |

## Documentación

| Documento | Contenido |
|---|---|
| [Informe final](docs/INFORME-FINAL.md) | Resumen, decisiones y estado |
| [00 · Fuentes y revalidación](docs/00-fuentes-y-revalidacion.md) | Registro de fuentes y comprobación de las restricciones técnicas |
| [01 · Catálogo y competencia](docs/01-catalogo-y-competencia.md) | Capacidades posibles y análisis de apps existentes |
| [02 · Alcance por versiones](docs/02-alcance-por-versiones.md) | Propuesta de primera versión y posteriores |
| [03 · Diseño de producto](docs/03-diseno-de-producto.md) | Navegación, pantallas, flujos y dashboards |
| [04 · Spikes de viabilidad](docs/04-spikes-viabilidad.md) | Apple Pay e inversiones |
| [05 · Arquitectura y modelo de datos](docs/05-arquitectura-y-modelo-de-datos.md) | Comparativa de frameworks, almacenamiento y modelo |
| [06 · Publicación](docs/06-publicacion.md) | Medios necesarios, App Store, privacidad y modelo de negocio |
| [07 · Hoja de ruta y backlog](docs/07-hoja-de-ruta-y-backlog.md) | Hitos y tareas con criterios de aceptación |
| [08 · Riesgos y gates](docs/08-riesgos-y-gates.md) | Registro de riesgos y dependencias externas |
| [09 · Decisiones](docs/09-decisiones.md) | Decisiones del usuario del 15/11/2026 y sus consecuencias |
| [Prompt para Claude Code](docs/prompt-claude-code-h0-h2.md) | Prompt maestro de ejecución de los hitos H0 a H2 |
| [Estado](docs/estado.md) | Baseline, estado y evidencia de cada tarea de H0 a H2 |
| [Spike A · Instrucciones](docs/spike-a/instrucciones.md) | Pasos de la medición con pagos reales y hoja de control |
