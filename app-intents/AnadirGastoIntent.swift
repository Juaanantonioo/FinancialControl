import AppIntents
import Foundation
internal import ExpoAppIntents

// Acción de Atajos "Añadir gasto" (T-038).
//
// Sirve para los atajos que monte la propia persona: por ejemplo, un botón
// en la pantalla de inicio que anote un café. Igual que "Registrar pago", no
// abre la app y nunca falla hacia fuera: deja el gasto en la cola del
// dispositivo y la app lo convierte en movimiento la próxima vez que se
// abre. Si al abrirse falta el importe, la categoría no existe o no se sabe
// la cuenta, queda como pago por revisar en la bandeja.
//
// Los textos van escritos aquí porque iOS los lee al compilar y no admite
// constantes de otro fichero.

struct AnadirGastoIntent: AppIntent {
  static let title: LocalizedStringResource = "Añadir gasto"
  static let description = IntentDescription(
    "Anota un gasto en FinancialControl con su importe, su categoría y su cuenta."
  )
  /// La acción se ejecuta en segundo plano. No abre la app.
  static let openAppWhenRun: Bool = false

  // Los tres parámetros son opcionales a propósito: si alguno fuera
  // obligatorio y el atajo no lo entregara, Atajos se pararía a preguntarlo.
  @Parameter(title: "Importe")
  var importe: String?

  @Parameter(title: "Categoría")
  var categoria: String?

  @Parameter(title: "Cuenta")
  var cuenta: String?

  static var parameterSummary: some ParameterSummary {
    Summary("Añadir gasto de \(\.$importe) en \(\.$categoria)") {
      \.$cuenta
    }
  }

  func perform() async throws -> some IntentResult & ReturnsValue<String> {
    _ = await AppIntentDispatcher.shared.dispatch(
      name: CapturaEnBruto.nombreDeAnadirGasto,
      params: [
        "importe": .string(CapturaEnBruto.limpiar(importe)),
        "categoria": .string(CapturaEnBruto.limpiar(categoria)),
        "cuenta": .string(CapturaEnBruto.limpiar(cuenta))
      ]
    )
    return .result(value: TextosDeCaptura.gastoAnotado)
  }
}
