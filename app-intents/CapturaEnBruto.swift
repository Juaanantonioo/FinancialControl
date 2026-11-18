import Foundation
import UserNotifications

/// Utilidades de la captura en bruto que llega desde Atajos.
enum CapturaEnBruto {
  /// Nombre con el que la parte de TypeScript reconoce esta acción.
  static let nombreDeLaAccion = "registrarPago"

  /// Nombre con el que la parte de TypeScript reconoce la acción "Añadir gasto".
  static let nombreDeAnadirGasto = "anadirGasto"

  /// Longitud máxima de cada texto. Evita guardar un texto desmesurado si un
  /// atajo mal montado envía, por ejemplo, el contenido entero de una página.
  static let longitudMaxima = 200

  /// Deja un texto llegado de un atajo listo para guardarse y mostrarse: sin
  /// caracteres de control (saltos de línea, tabuladores, nulos y marcas
  /// invisibles de formato, que pasan a ser un espacio), sin espacios
  /// repetidos ni en los extremos, y recortado. Un valor ausente se trata
  /// como texto vacío. Hace lo mismo que `limpiarTextoExterno` en
  /// `src/dominio/entradas.ts`.
  static func limpiar(_ texto: String?) -> String {
    // Se acota antes de limpiar para no recorrer un texto desmesurado.
    let acotado = String((texto ?? "").prefix(longitudMaxima * 8))
    let prohibidos = CharacterSet.controlCharacters
      .union(.newlines)
      .union(.illegalCharacters)
    let sinControl = String(
      String.UnicodeScalarView(
        acotado.unicodeScalars.map { prohibidos.contains($0) ? " " : $0 }
      )
    )
    let limpio = sinControl
      .split(separator: " ", omittingEmptySubsequences: true)
      .joined(separator: " ")
      .trimmingCharacters(in: .whitespacesAndNewlines)
    return String(limpio.prefix(longitudMaxima))
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }
}

/// Textos que la capa nativa muestra en tiempo de ejecución. Están reunidos
/// aquí para que ninguno quede disperso por el código.
enum TextosDeCaptura {
  static let guardado = "Guardado en la bandeja"
  static let pagoSinComercio = "Pago registrado"
  static let faltaElImporte = "Falta el importe"
  static let gastoAnotado = "Anotado. Se guardará al abrir FinancialControl"
}

/// Aviso local que acompaña a cada captura (T-012).
enum AvisoDeCaptura {
  static func mostrar(id: String, importe: String, comercio: String, tarjeta: String) async {
    let centro = UNUserNotificationCenter.current()
    let ajustes = await centro.notificationSettings()
    // Desde segundo plano no se puede pedir el permiso: lo pide la app al abrirse.
    guard ajustes.authorizationStatus == .authorized
      || ajustes.authorizationStatus == .provisional
    else {
      return
    }

    let contenido = UNMutableNotificationContent()
    contenido.title = comercio.isEmpty ? TextosDeCaptura.pagoSinComercio : comercio
    let lineaDeImporte = importe.isEmpty ? TextosDeCaptura.faltaElImporte : importe
    contenido.body = tarjeta.isEmpty ? lineaDeImporte : "\(lineaDeImporte) · \(tarjeta)"
    contenido.sound = .default
    // Al tocar el aviso, la app abre la bandeja en esta captura. `id` es el
    // identificador de la entrada en la cola, que la app guarda con la captura.
    contenido.userInfo = ["capturaId": id]

    // Sin disparador (`trigger: nil`) el aviso se entrega de inmediato.
    let peticion = UNNotificationRequest(identifier: id, content: contenido, trigger: nil)
    // Si la entrega falla no se propaga el error: la captura ya está guardada
    // y un error haría que iOS avisara de que la automatización ha fallado.
    try? await centro.add(peticion)
  }
}
