/**
 * Vectores de prueba del diseño criptográfico, calculados llamando a
 * libsodium directamente, sin pasar por `src/cripto/`. Sirven para comprobar
 * que el módulo de la app hace exactamente lo que dice
 * `docs/seguridad/diseno-criptografico.md`, y para que otra persona pueda
 * repetir el cálculo con cualquier libsodium.
 *
 * Uso:  node scripts/vectores-de-cripto.cjs            (los escribe en pantalla)
 *       node scripts/vectores-de-cripto.cjs --guardar  (actualiza vectores.json)
 *
 * Todos los datos de entrada son de ejemplo. No hay ninguna clave real.
 */
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const sodium = require('libsodium-wrappers-sumo');

const utf8 = (texto) => new TextEncoder().encode(texto);
const secuencia = (desde, cuantos) => Uint8Array.from({ length: cuantos }, (_, i) => desde + i);
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function base32(bytes) {
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let texto = '';
  for (let i = 0; i < bits.length; i += 5) texto += ALFABETO[parseInt(bits.slice(i, i + 5), 2)];
  return texto.match(/.{4}/g).join('-');
}

function sobre(clave, contenido, nonce, uso) {
  const cifrado = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    contenido,
    `FC1|${uso}`,
    null,
    nonce,
    clave,
  );
  return sodium.to_base64(Uint8Array.from([1, ...nonce, ...cifrado]));
}

(async () => {
  await sodium.ready;
  const hex = (bytes) => sodium.to_hex(bytes);
  const entrada = {
    correo_escrito: '  Ana.Ejemplo@Example.COM ',
    correo_normalizado: 'ana.ejemplo@example.com',
    contrasena: 'correcta batería caballo grapa',
    argon2id_pasadas: 8,
    argon2id_memoria_bytes: 67108864,
    clave_de_datos_hex: hex(secuencia(0x00, 32)),
    nonce_contrasena_hex: hex(secuencia(0x40, 24)),
    nonce_recuperacion_hex: hex(secuencia(0x60, 24)),
    secreto_de_recuperacion_hex: hex(secuencia(0xa0, 32)),
  };

  const sal = sodium.crypto_generichash(
    16,
    utf8(entrada.correo_normalizado),
    utf8('FinancialControl/sal-de-cuenta/v1'),
  );
  const maestra = sodium.crypto_pwhash(
    32,
    utf8(entrada.contrasena.normalize('NFKC')),
    sal,
    entrada.argon2id_pasadas,
    entrada.argon2id_memoria_bytes,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
  const autenticacion = sodium.crypto_kdf_derive_from_key(32, 1, 'FCautent', maestra);
  const envoltura = sodium.crypto_kdf_derive_from_key(32, 2, 'FCenvolt', maestra);

  const claveDeDatos = secuencia(0x00, 32);
  const secreto = secuencia(0xa0, 32);
  const control = sodium
    .crypto_generichash(16, secreto, utf8('FinancialControl/control-de-codigo/v1'))
    .subarray(0, 3);
  const claveDeRecuperacion = sodium.crypto_kdf_derive_from_key(32, 1, 'FCrecupe', secreto);

  const salida = {
    sal_hex: hex(sal),
    clave_maestra_hex: hex(maestra),
    subclave_de_autenticacion_hex: hex(autenticacion),
    subclave_de_autenticacion_base64url: sodium.to_base64(autenticacion),
    subclave_de_envoltura_hex: hex(envoltura),
    sobre_por_contrasena: sobre(
      envoltura,
      claveDeDatos,
      secuencia(0x40, 24),
      'clave-de-datos/contrasena',
    ),
    control_del_codigo_hex: hex(control),
    codigo_de_recuperacion: base32(Uint8Array.from([...secreto, ...control])),
    clave_de_recuperacion_hex: hex(claveDeRecuperacion),
    sobre_por_recuperacion: sobre(
      claveDeRecuperacion,
      claveDeDatos,
      secuencia(0x60, 24),
      'clave-de-datos/recuperacion',
    ),
  };

  const vectores = { libsodium: sodium.SODIUM_VERSION_STRING, entrada, salida };
  const texto = `${JSON.stringify(vectores, null, 2)}\n`;
  if (process.argv.includes('--guardar')) {
    writeFileSync(join(__dirname, '..', 'src', 'cripto', 'vectores.json'), texto);
  }
  process.stdout.write(texto);
})();
