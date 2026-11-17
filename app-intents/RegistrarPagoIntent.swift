import AppIntents
import Foundation
internal import ExpoAppIntents

// Acción de Atajos "Registrar pago" (T-010). Diseño en docs/04, apartado A.3.
//
// Para quien viene de Java: un `struct` que cumple el protocolo `AppIntent` es
// una acción que iOS publica en la app Atajos. iOS lee este fichero al
// compilar para saber qué acciones ofrece la app, así que los títulos tienen
// que ser textos literales escritos aquí: no admite constantes de otro
// fichero. Por eso estos textos en español viven en el código Swift y no en
// el catálogo `src/i18n/es.json`.

/// De dónde viene la captura. Atajos lo muestra como una lista de opciones.
enum OrigenDeCaptura: String, AppEnum {
  case transaccion
  case notificacion
  case manual

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Origen"
  static let caseDisplayRepresentations: [OrigenDeCaptura: DisplayRepresentation] = [
    .transaccion: "Transacción de Wallet",
    .notificacion: "Notificación",
    .manual: "Manual"
  ]
}

struct RegistrarPagoIntent: AppIntent {
  static let title: LocalizedStringResource = "Registrar pago"
  static let description = IntentDescription(
    "Guarda un pago en FinancialControl para revisarlo después y muestra un aviso con el importe."
  )
  /// La acción se ejecuta en segundo plano. No abre la app.
  static let openAppWhenRun: Bool = false

  // El importe llega como texto porque el formato exacto que entrega Atajos no
  // está documentado. La app extrae el número y la divisa al importar la cola.
  //
  // Los cuatro parámetros son opcionales a propósito, también el importe: si
  // fuera obligatorio y la automatización no lo entregara, Atajos se pararía a
  // preguntarlo y la automatización fallaría. La acción nunca falla hacia
  // fuera: guarda la captura con lo que tenga.
  @Parameter(title: "Importe")
  var importe: String?

  @Parameter(title: "Comercio")
  var comercio: String?

  @Parameter(title: "Tarjeta")
  var tarjeta: String?

  @Parameter(title: "Origen")
  var origen: OrigenDeCaptura?

  static var parameterSummary: some ParameterSummary {
    Summary("Registrar pago de \(\.$importe)") {
      \.$comercio
      \.$tarjeta
      \.$origen
    }
  }

  func perform() async throws -> some IntentResult & ReturnsValue<String> {
    let importeLimpio = CapturaEnBruto.limpiar(importe)
    let comercioLimpio = CapturaEnBruto.limpiar(comercio)
    let tarjetaLimpia = CapturaEnBruto.limpiar(tarjeta)
    let origenFinal = origen ?? .transaccion

    // T-011. Almacén compartido mínimo: la biblioteca guarda la captura en una
    // cola persistente del dispositivo. La app la lee al abrirse, aunque
    // estuviera cerrada cuando se ejecutó la acción.
    let id = await AppIntentDispatcher.shared.dispatch(
      name: CapturaEnBruto.nombreDeLaAccion,
      params: [
        "importe": .string(importeLimpio),
        "comercio": .string(comercioLimpio),
        "tarjeta": .string(tarjetaLimpia),
        "origen": .string(origenFinal.rawValue)
      ]
    )

    // T-012. Aviso local con el contenido de la captura. Si el usuario no ha
    // dado permiso de avisos, la captura queda guardada igualmente.
    await AvisoDeCaptura.mostrar(
      id: id,
      importe: importeLimpio,
      comercio: comercioLimpio,
      tarjeta: tarjetaLimpia
    )

    return .result(value: TextosDeCaptura.guardado)
  }
}
