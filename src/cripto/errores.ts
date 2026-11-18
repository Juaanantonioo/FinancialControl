/**
 * Único error que sale del módulo criptográfico. No dice por qué falló: una
 * contraseña equivocada, un contenido alterado, un sobre truncado o una
 * versión desconocida se ven igual desde fuera. Así un fallo no da pistas a
 * quien esté probando, y ningún mensaje puede arrastrar una clave.
 */
export class ErrorDeCripto extends Error {
  constructor() {
    super('No se ha podido completar la operación criptográfica.');
    this.name = 'ErrorDeCripto';
  }
}
