# Riesgo de mantenimiento: `react-native-libsodium`

Fecha: 18/11/2026. **Punto a revisar en el bloque 4c**, y antes si cambia algo de lo de abajo.

## Qué pasa

La app enlaza libsodium en iOS y Android con el paquete `react-native-libsodium`, fijado en
la versión exacta **1.7.0**. Es la dependencia de la que cuelga toda la criptografía.

- La 1.7.0 (publicada el 09/02/2026) **no compila para iOS con React Native 0.88**: usa una
  clase, `RCTCxxBridge`, que React Native ha eliminado.
- En su repositorio, la incidencia #110 (10/11/2026) describe el fallo y **no ha tenido
  respuesta**. El arreglo propuesto, PR #109 (17/10/2026), es de una persona ajena al equipo
  del paquete y lleva un mes **sin revisar ni fusionar**.
- El proyecto aplica ese mismo cambio con un parche propio: `plugins/parche-libsodium.js`.

## Qué riesgo es

1. **Mantenemos un parche sobre código nativo de la dependencia criptográfica.** Es corto
   (tres sustituciones en un fichero) y no toca criptografía, pero es código que sus autores
   no han revisado. Lo hemos revisado nosotros.
2. **El paquete puede estar dejando de mantenerse.** Si es así, no llegarán arreglos de
   seguridad ni versiones para futuras versiones de React Native, y cada subida de SDK de
   Expo puede volver a romper la compilación.
3. **La libsodium que va dentro del paquete se actualiza solo cuando el paquete se
   actualiza.** Si libsodium publica una corrección de seguridad, no la recibimos hasta
   entonces.
4. La versión nativa del paquete admite menos tipos de dato que la de WebAssembly
   (`diseno-criptografico.md`, apartado 2.2). Un cambio descuidado en `src/cripto/` puede
   funcionar en las pruebas y fallar en el iPhone. Lo vigila una prueba.

## Qué lo contiene hoy

- Versiones exactas en `package.json`, sin `^` ni `~`.
- El parche solo se aplica si la huella SHA-256 del fichero es la esperada, y comprueba la
  del resultado. Con cualquier otra, la compilación falla.
- La app se comprueba a sí misma contra vectores conocidos antes de permitir ninguna
  operación de cuenta (`src/cripto/autocomprobacion.ts`).
- Toda la app llama a la biblioteca a través de un único fichero (`src/cripto/sodio.ts`):
  cambiar de paquete toca un sitio.

## Qué revisar en 4c

- [ ] ¿Ha respondido alguien a la incidencia #110 o se ha fusionado el PR #109?
- [ ] ¿Hay una versión del paquete que compile con la versión de React Native en uso? Si la
      hay: actualizar, retirar el parche siguiendo su cabecera y repetir pruebas y
      autocomprobación.
- [ ] ¿Cuándo fue el último commit del paquete? Si lleva más de seis meses parado, evaluar
      las alternativas.
- [ ] ¿Qué versión de libsodium lleva dentro, y hay avisos de seguridad posteriores?
- [ ] Alternativas a evaluar si el paquete está abandonado: otro paquete que envuelva
      libsodium con las tres plataformas y Argon2id, o un módulo nativo propio y mínimo.
      **Ninguna está evaluada.**

Cambiar de biblioteca no cambia los datos ya cifrados, siempre que la nueva sea libsodium o
dé los mismos resultados: los vectores de `src/cripto/vectores.json` lo dicen.
