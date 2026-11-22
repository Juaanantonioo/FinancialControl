/**
 * El correo de la última entrada, para rellenar el formulario. Solo existe en
 * la web (`correoRecordado.web.ts`). En iOS no se guarda aparte: la sesión
 * dura y el correo ya está en el llavero.
 */
export function leerCorreoRecordado(): string {
  return '';
}

export function guardarCorreoRecordado(_correo: string): void {
  // Nada que hacer fuera de la web.
}
