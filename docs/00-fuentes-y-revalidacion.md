# 00 · Fuentes y revalidación de restricciones

Fecha de consulta de todas las fuentes: **15/11/2026**, salvo que se indique otra.
Las fuentes se citan en el resto de documentos por su identificador `[Sxx]`.

Etiquetas de estado:

- **CONFIRMADO**: respaldado por fuente oficial vigente.
- **CONFIRMADO CON MATIZ**: cierto, pero la fuente oficial añade o corrige un detalle.
- **CAMBIA DE ESTADO**: el punto figuraba como no demostrado y ahora tiene respaldo oficial.
- **NO DEMOSTRADO**: sin fuente oficial que lo respalde.
- **FUENTE SECUNDARIA**: solo lo afirma un tercero (blog, comparador, foro). Se usa como indicio, no como hecho.

## 1. Revalidación de las ocho restricciones de partida

| # | Restricción | Resultado | Detalle | Fuentes |
|---|---|---|---|---|
| R1 | Apple Pay solo se captura con la automatización "Transacción" de Atajos, que entrega tarjeta, comercio e importe a una acción de la app | CONFIRMADO CON MATIZ | La guía oficial de Atajos documenta el disparador en sus ediciones para iOS 17, 18, 26 y 27, con la opción "When I tap: Select a card". La guía oficial **no enumera** los campos que entrega. Que sean tarjeta, comercio e importe lo afirman fuentes secundarias. Se comprobará en el spike A. | [S01] oficial; [S03], [S04] secundarias |
| R2 | El disparador falla a veces, no salta en Mac ni iPad y lo configura el usuario | CONFIRMADO CON MATIZ | El hilo 765516 sigue abierto, con mensajes hasta febrero de 2026 y dos informes (FB14035016, FB16379100). Añade dos datos: el disparador **también salta con pagos rechazados**, y un usuario apunta a que falla más con tarjetas Mastercard (anécdota, no demostrado). Matiz de iOS 27: las automatizaciones van dentro del atajo y se comparten con él, de modo que la app puede ofrecer un enlace a un atajo ya montado. El usuario sigue teniendo que añadirlo y activarlo. La limitación a Mac e iPad no aparece en fuente oficial: FUENTE SECUNDARIA. | [S02], [S05] oficiales; [S06], [S07] secundarias |
| R3 | FinanceKit no es viable para España | CONFIRMADO CON MATIZ | EE. UU.: iOS 17.4 o posterior, Apple Card, Apple Cash y Savings. Reino Unido: **iOS 18.4** o posterior, mediante open banking con una lista cerrada de entidades. Exige entitlement gestionado, cuenta de organización, rol Account Holder, categoría Finanzas y distribución en el App Store de EE. UU. o Reino Unido. España no figura. Sigue siendo EXTERNAL_GATE. | [S08], [S09] |
| R4 | Disparador de Atajos por notificación en iOS 27 | **CAMBIA DE ESTADO → CONFIRMADO** | Las notas oficiales de Apple (publicadas el 26/10/2026) listan la automatización "Notifications (When I receive a notification from News)" como novedad de iOS 27. La sesión 310 de la WWDC26 la describe como automatización "which runs when a notification is received from a specific app". Los campos que entrega (título, subtítulo, cuerpo, app) y la posibilidad de filtrar por texto son FUENTE SECUNDARIA. | [S05], [S10] oficiales; [S11], [S12] secundarias |
| R5 | Las acciones para Atajos se declaran en Swift; existen puentes | CONFIRMADO | Expo: "You cannot create App Intent types dynamically from JavaScript at runtime. Declare the AppIntent types you need in Swift". `expo-app-intents` está en **alfa** (versión recomendada ~0.5.17, SDK 58, iOS 16.4 o posterior). Flutter: `app_intents` 0.21.1 (iOS 17 o posterior, publicado hace dos días, 37 versiones en ocho meses, 3 "likes") y `flutter_app_intents` 0.7.0 (última versión del 02/10/2025, sin actividad en trece meses). | [S13], [S14], [S15], [S16] |
| R6 | Captura de pagos en Android sin equivalente verificado | **CAMBIA DE ESTADO → PARCIALMENTE DEMOSTRADO** | Android ofrece `NotificationListenerService`: una app aprobada por el usuario recibe las notificaciones de otras apps. Wallet by BudgetBakers lo usa en producción para leer las notificaciones de Google Pay (paquete `com.google.android.apps.walletnfcrel`) y crear movimientos. La lectura de SMS está restringida por política de Google Play a apps que sean gestor predeterminado. La política de Play aplicable al acceso a notificaciones no se ha localizado en fuente oficial: NO DEMOSTRADO. No hay paridad con iOS: el mecanismo es distinto y depende del texto de cada notificación. | [S17], [S18], [S19] |
| R7 | Publicar y usar TestFlight exige el Apple Developer Program (99 USD al año) | CONFIRMADO | 99 USD por año de membresía, como particular o como organización. Con cuenta gratuita ("Personal Team"): hasta 3 dispositivos, hasta 10 App ID y perfiles que caducan a los 7 días. Apple indica que hace falta inscripción para capacidades como Siri, Apple Pay e iCloud. Si App Intents, App Groups y widgets funcionan con Personal Team: NO DEMOSTRADO, se comprueba en el hito H0. | [S20], [S21], [S22] |
| R8 | Compilar para iOS sin Mac mediante servicios en la nube | **CAMBIA DE ESTADO → CONFIRMADO para Expo** | Expo documenta el flujo completo desde Windows o Linux: compilación en la nube, firma y envío a App Store Connect. Plan gratuito: 15 compilaciones de iOS al mes en cola de baja prioridad. Instalar en un iPhone sigue exigiendo el programa de pago. Depurar código nativo (Swift) y usar el simulador exige macOS. Para Flutter, Codemagic documenta la compilación de iOS, pero sus precios vigentes son FUENTE SECUNDARIA. Este punto pierde peso: el equipo del usuario es un Mac (ver apartado 2). | [S23], [S24], [S25] oficiales; [S26] secundaria |

Ninguna restricción verificada ha resultado falsa. No se activa la condición de parada.

### Consecuencia de R4 para el diseño

El disparador por notificación abre una segunda vía de captura en iOS 27 o posterior:
notificaciones de Wallet y de la app del banco, que también cubren compras en línea
y pagos con tarjeta física. La vía "Transacción" queda como base (iOS 17 o posterior)
y la de notificación como complemento. Ambas se miden en el spike A.

## 2. Medios del usuario comprobados en este equipo

Comprobación hecha por línea de órdenes el 15/11/2026. Resuelve parte de la decisión
pendiente de la FASE 6.

| Elemento | Resultado |
|---|---|
| Equipo | Mac con chip Apple M2 |
| Sistema | macOS 27.2 (26B123) |
| Xcode | **Instalado**: `/Applications/Xcode.app`, versión 27.2 (27B52), con plataforma iPhoneOS |
| Directorio de desarrollo activo | Apunta a las Command Line Tools, no a Xcode. Hay que ejecutar `sudo xcode-select -s /Applications/Xcode.app` |
| Identidades de firma | Ninguna (`0 valid identities found`). No hay sesión de desarrollador configurada en este equipo |
| Espacio libre en disco | 32 GB. Justo para simuladores y compilaciones: conviene liberar espacio |
| Node.js / npm | 22.20.0 / 11.6.4 |
| Flutter, Dart, CocoaPods, EAS CLI | No instalados |
| Cuenta en el Apple Developer Program | **NO DISPONIBLE**: no se puede comprobar desde aquí. Lo confirma el usuario |
| iPhone y versión de iOS del usuario | **NO DISPONIBLE** |

## 3. Registro de fuentes

### Apple

| Id | Fuente | Versión o fecha |
|---|---|---|
| S01 | Apple Support, Shortcuts User Guide, "Transaction triggers in Shortcuts on iPhone or iPad". https://support.apple.com/guide/shortcuts/transaction-trigger-apd65c67538a/ios | Ediciones iOS 17, 18, 26 y 27 |
| S02 | Apple Developer Forums, hilo 765516, "Shortcuts Automation Trigger Transaction Timeouts". https://developer.apple.com/forums/thread/765516 | Abierto en oct. 2024, último mensaje de feb. 2026 |
| S03 | Matthew Cassinelli, "Shortcuts has new Automations in iOS 17". https://matthewcassinelli.com/shortcuts-automations-ios-ipados-transaction-display-stage-manager | 01/08/2023, secundaria |
| S04 | Skwad, "Track Apple Pay purchases automatically with iOS Shortcuts". https://skwad.app/blog/creating-skwad-transactions-using-ios-shortcuts | 19/06/2024, secundaria |
| S05 | Apple Support, "New in iOS, iPadOS, macOS, watchOS, and visionOS 27" (artículo 149045). https://support.apple.com/en-us/149045 | Publicado el 26/10/2026 |
| S06 | Apple Developer Forums, hilos 758053 y 746889 (fallo en iOS 18; no se puede probar en el simulador). https://developer.apple.com/forums/thread/758053 | 2024-2025 |
| S07 | CashJot, guía de captura de Apple Pay por versión de iOS. https://www.cashjot.com/blog/apple-pay-expense-tracking | Actualizada el 20/10/2026, secundaria |
| S08 | Apple Developer, "Get started with FinanceKit". https://developer.apple.com/financekit | Vigente |
| S09 | Apple Developer Documentation, FinanceKit. https://developer.apple.com/documentation/financekit | Vigente |
| S10 | WWDC26, sesión 310, "What's new in Shortcuts". https://developer.apple.com/videos/play/wwdc2026/310 | 08/06/2026 |
| S11 | NotiKeep, "The iOS 27 Notification Automation in Shortcuts". https://notikeep.app/en/ios-27-notification-automation/ | 24/10/2026, secundaria |
| S12 | Moneko y Expensa, guías de captura por notificación en iOS 27. https://moneko.io/blogs/capture-transactions-from-iphone-notifications-ios-27 · https://getexpensa.com/blog/how-to-set-up-apple-pay-sync-ios-27 | Sept. 2026, secundarias |
| S20 | Apple Developer, "Program enrollment". https://developer.apple.com/help/account/membership/program-enrollment | Vigente |
| S21 | Apple Developer, "Developer account overview" (límites del Personal Team). https://developer.apple.com/help/account/basics/about-your-developer-account | Vigente |
| S22 | Apple Developer Program. https://developer.apple.com/programs | Vigente |
| S69 | Apple Support, Shortcuts User Guide, "Add automations to Shortcuts on iPhone or iPad" (lista de automatizaciones que se ejecutan sin preguntar). https://support.apple.com/guide/shortcuts/add-automations-apdfbdbd7123/ios | Edición iOS 27 |
| S70 | Apple, App Store Connect Help, "Set up introductory offers for auto-renewable subscriptions" (duraciones de la prueba gratuita). https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions | Vigente |
| S27 | App Review Guidelines. https://developer.apple.com/app-store/review/guidelines/ | Vigente, © 2026 |
| S28 | Apple, "5.1.1(v) Offering account deletion in your app". https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion | Vigente |
| S29 | Apple, "App Privacy Details". https://developer.apple.com/app-store/app-privacy-details/ | Vigente |
| S30 | Apple, "User Privacy and Data Use" (manifiestos de privacidad). https://developer.apple.com/app-store/user-privacy-and-data-use/ | Vigente |
| S31 | Apple, "Manage European Union Digital Services Act trader requirements". https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/ | Vigente |
| S32 | Apple, "App Store Small Business Program". https://developer.apple.com/app-store/small-business-program | Vigente |
| S33 | Apple, "Auto-renewable Subscriptions". https://developer.apple.com/app-store/subscriptions/ | Vigente |
| S34 | Apple Developer Documentation, AppIntent y "Configuring the runtime behavior of your app intents". https://developer.apple.com/documentation/appintents/appintent | iOS 16.0 o posterior |
| S35 | Apple Developer Documentation, "Creating controls to perform actions across the system" y `ControlWidget`. https://developer.apple.com/documentation/swiftui/controlwidget | iOS 18.0 o posterior |
| S36 | Apple Developer Documentation, "Adding interactivity to widgets and Live Activities". https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities | iOS 17 o posterior |
| S37 | Apple Developer Documentation, "Configuring app groups". https://developer.apple.com/documentation/xcode/configuring-app-groups | Vigente |

### Frameworks y herramientas

| Id | Fuente | Versión o fecha |
|---|---|---|
| S13 | Expo, documentación de `expo-app-intents`. https://docs.expo.dev/versions/latest/sdk/app-intents/ | SDK 58, modificada el 15/10/2026, alfa |
| S14 | Expo, "Introducing expo-app-intents". https://expo.dev/blog/introducing-expo-app-intents | 19/10/2026 |
| S15 | pub.dev, `app_intents`. https://pub.dev/packages/app_intents | 0.21.1 |
| S16 | pub.dev, `flutter_app_intents`. https://pub.dev/packages/flutter_app_intents | 0.7.0, 02/10/2025 |
| S23 | Expo, "How to test an iOS app without a Mac or an iPhone". https://expo.dev/articles/testing-and-previewing/test-ios-app-without-mac | 07/10/2026 |
| S24 | Expo, precios de los servicios. https://expo.dev/pricing | Vigente |
| S25 | Codemagic, documentación de compilación y firma para iOS. https://docs.codemagic.io/yaml-quick-start/building-a-native-ios-app | Vigente |
| S26 | Newly, "Build an iOS app without a Mac". https://newly.app/guides/build-an-ios-app-without-a-mac | Oct. 2026, secundaria |
| S38 | pub.dev, `home_widget`. https://pub.dev/packages/home_widget | 0.10.0 |
| S39 | Expo, "Home screen widgets and Live Activities in Expo" (`expo-widgets`). https://expo.dev/blog/home-screen-widgets-and-live-activities-in-expo | Alfa |
| S40 | Kotlin, "Compatibility and versions" de Compose Multiplatform. https://kotlinlang.org/docs/multiplatform/compose-compatibility-and-versioning.html | 1.12.2, iOS 14 mínimo |
| S41 | Kotlin, comparativa oficial KMP y React Native (estado de estabilidad). https://kotlinlang.org/docs/multiplatform/kotlin-multiplatform-react-native.html | Vigente |
| S42 | Expo, "React Native's New Architecture". https://docs.expo.dev/guides/new-architecture | Vigente |
| S43 | Flutter, "What's new in Flutter 3.50". https://flutter.dev/blog/whats-new-in-flutter-3-50 | 3.50 |
| S44 | Comparativas de versiones de frameworks. https://tech-insider.org/kotlin-multiplatform-vs-flutter-vs-react-native-2026 · https://www.edgewisely.com/top-7-cross-platform-app-development-frameworks-2026 | Nov. 2026, secundarias |

### Android

| Id | Fuente | Versión o fecha |
|---|---|---|
| S17 | Android Developers, `NotificationListenerService`. https://developer.android.com/reference/android/service/notification/NotificationListenerService | 16/09/2026 |
| S18 | BudgetBakers, "Notification Access Permission". https://support.budgetbakers.com/hc/en-us/articles/27357560590098-Notification-Access-Permission | 19/06/2025 |
| S19 | Google Play Console Help, "Permissions and APIs that Access Sensitive Information". https://support.google.com/googleplay/android-developer/answer/16558241 | Vigente |

### Notion (sin uso: la integración quedó descartada, ver `09-decisiones.md`)

| Id | Fuente | Versión o fecha |
|---|---|---|
| S45 | Notion, "Request limits". https://developers.notion.com/reference/request-limits | Vigente |
| S46 | Notion, "Upgrade guide 2025-09-03". https://developers.notion.com/guides/get-started/upgrade-guide-2025-09-03 | 2025-09-03 |
| S47 | Notion, "Versioning" (la cabecera de ejemplo usa `2026-03-11`). https://developers.notion.com/reference/versioning | Vigente |
| S48 | Notion, "Webhooks". https://developers.notion.com/reference/webhooks | Vigente |
| S49 | Notion, "Public connections" y "Authorization". https://developers.notion.com/guides/get-started/public-connections | Vigente |

### Datos de mercado

| Id | Fuente | Versión o fecha |
|---|---|---|
| S50 | Twelve Data, precios personales y de empresa, y condiciones de uso. https://twelvedata.com/pricing · https://twelvedata.com/pricing-business · https://twelvedata.com/terms | Vigente |
| S51 | Twelve Data Support, "Commercial and personal usage". https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage | Vigente |
| S52 | EODHD, precios personales y comerciales, y ayuda sobre uso comercial. https://eodhd.com/pricing · https://eodhd.com/commercial-pricing · https://eodhd.com/help/commercial | Vigente |
| S53 | Financial Modeling Prep, precios. https://site.financialmodelingprep.com/developer/docs/pricing | Vigente |
| S54 | CoinGecko, precios de la API. https://www.coingecko.com/en/api/pricing | Vigente |
| S55 | Condiciones de Yahoo, Alpha Vantage y Finnhub citadas por terceros. https://xfinlink.com/blog/can-you-use-yahoo-finance-data-commercially · https://cors.dev/guides/free-stock-api | 29/07/2026 y 26/10/2026, secundarias |

### Almacenamiento y sincronización

| Id | Fuente | Versión o fecha |
|---|---|---|
| S56 | Supabase, precios. https://supabase.com/pricing | Vigente |
| S57 | Firebase, cuotas de Firestore. https://firebase.google.com/docs/firestore/quotas | 12/11/2026 |
| S58 | PowerSync, precios. https://powersync.com/pricing | Vigente |

### Apps de la competencia

| Id | Fuente | Versión o fecha |
|---|---|---|
| S59 | Spendee, web oficial en español (planes del App Store de España). https://www.spendee.com/es/ | Vigente |
| S60 | YNAB, precios. https://www.ynab.com/pricing | Vigente |
| S61 | Dinerio, "Las 7 mejores apps para controlar gastos" (precios comprobados en la ficha española el 14/09/2026). https://dinerioapp.es/blog/mejores-apps-controlar-gastos | Secundaria |
| S62 | Neto, "Alternativas a Wallet" (precios comprobados el 02/10/2026). https://netoapp.es/blog/alternativas-a-wallet/ | Secundaria |
| S63 | Cuéntamo, "Fintonic alternatives". https://cuentamo.com/en/fintonic-alternatives | 2026, secundaria |
| S64 | Finanzas Con Cabeza, comparativa de apps. https://jovenmillonario.com/mejores-apps-de-finanzas-personales-y-presupuestos-en-espanol | 13/10/2026, secundaria |

### Normativa

| Id | Fuente |
|---|---|
| S65 | Reglamento (UE) 2016/679 (RGPD). https://eur-lex.europa.eu/eli/reg/2016/679/oj |
| S66 | Ley Orgánica 3/2018 (LOPDGDD). https://www.boe.es/eli/es/lo/2018/12/05/3 |
| S67 | Ley 34/2002 (LSSI-CE). https://www.boe.es/eli/es/l/2002/07/11/34 |
| S68 | Reglamento (UE) 2022/2065 (DSA), artículos 30 y 31. https://eur-lex.europa.eu/eli/reg/2022/2065/oj |

Nota: S65 a S68 se citan por artículo a partir del texto consolidado conocido. No se
han vuelto a descargar en esta sesión. Las referencias legales de este proyecto son
orientativas y no sustituyen a un asesor jurídico.
