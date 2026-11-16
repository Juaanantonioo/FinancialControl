# H0 · Lista de comprobación de medios (T-003)

Fecha: 15/11/2026. Las seis preguntas son las del apartado 1.2 de `docs/06-publicacion.md`.
Estado: **PENDIENTE DEL USUARIO**. Solo la pregunta 2 tiene respuesta.

| # | Pregunta | Respuesta | Fecha |
|---|---|---|---|
| 1 | ¿Tengo un Apple Account con autenticación de doble factor? | Pendiente | |
| 2 | ¿Estoy inscrito en el Apple Developer Program? | **No** (`docs/09-decisiones.md`, apartado 2) | 15/11/2026 |
| 3 | ¿Con qué tipo de inscripción? | No aplica mientras la respuesta 2 sea "no" | 15/11/2026 |
| 4 | ¿Tengo un iPhone para pruebas y qué versión de iOS lleva? | Pendiente: modelo y versión | |
| 5 | ¿Tengo al menos una tarjeta en Wallet con la que pago en tiendas? | Pendiente: cuántas y cuáles | |
| 6 | ¿Soy mayor de edad? | Pendiente | |

Dato adicional necesario para el spike A: si el iPhone lleva iOS 27 o posterior. De eso
depende que se pueda medir la vía por notificación (T-015) y el atajo compartido (T-016).

## Medios comprobados en el Mac (15/11/2026)

| Medio | Valor | Cómo se comprobó |
|---|---|---|
| macOS | 27.2 | `sw_vers` |
| Xcode | 27.2 (27B52), instalado en `/Applications/Xcode.app` | `xcodebuild -version` con `DEVELOPER_DIR` |
| Directorio de desarrollo activo | `/Library/Developer/CommandLineTools`. **No es Xcode** | `xcode-select -p` |
| Cuentas en Xcode | Ninguna | Preferencias de Xcode sin equipos |
| Simuladores | iOS 27.2: iPhone 17, 17e, Air, 18 Pro, 18 Pro Max y otros | `xcrun simctl list` |
| Node | 22.20.0, con npm 11.6.4 | `node -v`, `npm -v` |
| CocoaPods | 1.17.0, instalado en esta sesión con Homebrew | `pod --version` |
| Espacio libre | 31 GB al empezar, 18 GB tras compilar | `df -h` |
