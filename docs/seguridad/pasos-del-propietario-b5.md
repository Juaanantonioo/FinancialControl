# Pasos del propietario · bloque 5 (versión web)

Fecha: 22/11/2026. Lo que tienes que hacer tú. Claude Code **no ha desplegado nada**, no
ha tocado el proyecto remoto de Supabase y no ha probado la web en un móvil real.

Orden recomendado: 1 (probar en tu Mac) → 2 (probar en tu móvil) → 3 (textos legales) →
4 (Supabase) → 5 (desplegar) → 6 (comprobar lo desplegado).

## Lo que nunca debes copiar fuera del panel

Igual que siempre: la contraseña de la base de datos, la clave secreta (`service_role` /
`sb_secret_…`) y cualquier token. La web solo lleva la dirección del proyecto y la clave
**pública**, que ya están en tu `.env`.

## Paso 1 · Probar la web en tu Mac

Desde `~/Desktop/FinancialControl`, en la rama `b5-web`:

```bash
npm install
npm run web:exportar
npm run web:servir
```

- `web:exportar` crea la carpeta `dist/` con el sitio, usando tu `.env` (tu proyecto real
  de Supabase). Al final dice con qué dirección podrá conectar el sitio: debe ser
  `https://btkpyvfwdbnuralhvwhg.supabase.co`.
- `web:servir` lo sirve en `http://127.0.0.1:4173` con las mismas cabeceras que tendrá
  publicado. Ábrelo en Safari y en Chrome.

Qué probar, **con una cuenta de prueba**:

| # | Qué haces | Qué debe pasar |
|---|---|---|
| 1 | Abres la página | Solo se ve «Beta gratuita» y el formulario. Nada de la app |
| 2 | Creas una cuenta | Sale el código de recuperación. «Guardar o imprimir» descarga un fichero de texto |
| 3 | Confirmas los dos grupos | Entras en Inicio |
| 4 | Creas una cuenta bancaria y anotas dos gastos | Aparecen en Movimientos y el saldo cuadra |
| 5 | Recargas la página | Vuelve el formulario, con tu correo ya puesto. Pide la contraseña |
| 6 | Entras | Están tus datos |
| 7 | Ajustes › Exportar mis datos | Se descargan el JSON y el CSV |
| 8 | Apagas el wifi y anotas un gasto | Banda roja «Sin conexión…». El gasto se ve en la lista |
| 9 | Intentas cerrar la pestaña | El navegador pregunta si quieres salir |
| 10 | Enciendes el wifi | La banda desaparece sola en unos segundos |
| 11 | Ajustes › Cuenta › Cerrar sesión | Vuelve el formulario |
| 12 | Haces la ventana estrecha y ancha | Barra abajo en estrecho; barra lateral en ancho |
| 13 | Con el iPhone (cuando tengas la app instalada): entras con la misma cuenta | Ves los mismos datos, y lo que anotes en uno aparece en el otro |

El paso 13 es el único que comprueba web e iPhone juntos de verdad. Con pruebas
automáticas está comprobado con el mismo código del iPhone ejecutado en el Mac, no con un
iPhone.

## Paso 2 · Probar en tu móvil (antes de desplegar)

Sin desplegar no se puede probar bien en el móvil: el cifrado del navegador exige HTTPS o
`localhost`, y el servidor de pruebas solo escucha en tu Mac. La forma sencilla es hacer el
paso 5 primero **en una dirección de prueba** que no des a nadie, y probar ahí.

En el móvil, apunta dos cosas y pásamelas:

1. **Ajustes › Diagnóstico › «Medir»** tres veces: los milisegundos de Argon2id. En el Mac
   salen unos 300. Si en tu móvil pasa de 3.000, o la página se cierra o se recarga sola,
   **no publiques**: es la señal de que 64 MiB es demasiado para ese teléfono.
2. Si al crear la cuenta o al entrar se queda en «Calculando las claves…» más de diez
   segundos.

## Paso 3 · Revisar los textos legales

Están en la web, en Ajustes › Política de privacidad y Condiciones de uso, y enlazados
desde el formulario de alta. **Son un borrador**: lo dicen arriba en un recuadro rojo.

Los textos viven en `src/i18n/es.json`, sección `legal`. Tienes que:

1. Sustituir todo lo que va entre corchetes. Búscalo con:

   ```bash
   grep -o '\[[^]]*\]' src/i18n/es.json | sort -u
   ```

   Son: tu nombre o razón social, NIF, domicilio, correo de contacto, el proveedor de
   alojamiento, la base jurídica, el plazo de las copias de seguridad, la edad mínima, la
   limitación de responsabilidad, el aviso de cierre y la ley aplicable.
2. Leerlos enteros. Describen lo que la app hace hoy; si algo no es así, dímelo.
3. **Que los revise alguien que sepa de protección de datos** antes de admitir usuarios
   que no seas tú. Yo no soy abogado y esto no es asesoramiento jurídico.
4. Cuando estén revisados, quitar el recuadro de borrador: es el texto `legal.borrador`.
   No lo quites antes.

Una prueba automática (`npm test`) falla si quitas el recuadro mientras queden corchetes.

## Paso 4 · Supabase

En el panel del proyecto:

1. **Authentication › URL Configuration › Site URL:** pon la dirección definitiva de la
   web (la del paso 5). Hoy la app no envía correos, así que no afecta al uso; es para que
   quede bien si algún día se activan.
2. **Authentication › Sign In / Providers › Email:** «Confirm email» sigue **desactivado**
   (sin proveedor de correo, activarlo dejaría a todo el mundo sin poder entrar).
3. **Authentication › Rate Limits:** mira el límite de altas e inicios de sesión por IP.
   Con una web pública, ese límite es lo que frena a quien pruebe contraseñas.
4. **Authentication › Attack Protection:** si quieres captcha en el alta, dímelo antes: la
   política de seguridad de la web no deja cargar nada de terceros y habría que abrirle
   una excepción concreta.
5. **No hace falta tocar CORS:** la API de Supabase acepta peticiones de cualquier origen
   con la clave pública; lo que protege los datos son las políticas RLS, ya comprobadas.
6. La migración `20261122120000` (rls_auto_enable) sigue pendiente de que la apliques si
   no lo has hecho. La web no depende de ella.

**No ejecutes `supabase config push`.**

## Paso 5 · Desplegar gratis en Cloudflare Pages

Elegido porque es gratuito, da HTTPS y respeta el fichero de cabeceras del repositorio
(`public/_headers`). Sin esas cabeceras la web **no arranca**.

1. Crea una cuenta en <https://dash.cloudflare.com> (gratis, no pide tarjeta). Activa la
   verificación en dos pasos: **quien entre en esa cuenta puede cambiar el código que
   reciben tus usuarios** (ver «Lo que debes saber», abajo).
2. En tu Mac, con tu `.env` real:

   ```bash
   npm run web:exportar
   ```

   Comprueba que la última línea nombra `https://btkpyvfwdbnuralhvwhg.supabase.co` y **no**
   dice «instancia LOCAL». Si lo dice, no subas esa carpeta.
3. En el panel: **Workers & Pages › Create › Pages › Upload assets** (subida directa).
   Ponle un nombre al proyecto y arrastra la carpeta `dist` entera.
4. Te da una dirección `https://<nombre>.pages.dev`.

Para actualizar la web más adelante: repite el 2 y sube `dist` de nuevo como un despliegue
nuevo del mismo proyecto.

No conectes el repositorio a Cloudflare para que compile solo: necesitaría tus variables
y dejaría que un cambio en GitHub publique código sin que lo veas. Con la subida a mano,
lo publicado es exactamente lo que tú has exportado.

**No hay fichero `404.html` a propósito:** así Cloudflare sirve la app para cualquier
dirección, que es lo que necesita.

Alternativa: Netlify lee el mismo `public/_headers`. Habría que añadir un fichero
`public/_redirects` con la línea `/*  /index.html  200`.

## Paso 6 · Comprobar lo desplegado

1. Abre la dirección y repite la tabla del paso 1.
2. Mira las cabeceras:

   ```bash
   curl -sI https://<nombre>.pages.dev | grep -iE "content-security|strict-transport|cross-origin|x-frame|referrer|permissions"
   ```

   Deben salir las ocho. Si falta `content-security-policy` o las dos `cross-origin-…`,
   el fichero `_headers` no se ha subido: no dejes entrar a nadie.
3. Pasa la dirección por <https://securityheaders.com> y por
   <https://csp-evaluator.withgoogle.com>. Guarda el resultado.
4. Abre las herramientas del navegador › Consola: no debe haber ningún error rojo.

## Lo que debes saber antes de abrirla a otras personas

1. **En la web, el servidor entrega el código.** Quien controle tu cuenta de Cloudflare
   (o el dominio, si pones uno) puede publicar una versión que robe contraseñas. El
   cifrado protege los datos de Supabase, no de quien sirve la web. Protege esa cuenta
   como la más importante que tienes.
2. **Sin recuperación de cuenta.** Quien olvide la contraseña pierde su cuenta. La web lo
   dice en el alta. Hasta el bloque 4b-3 no tiene arreglo.
3. **Es una beta sin revisar por nadie de fuera.** Ni el cifrado ni la web.
4. **El plan gratuito de Supabase tiene límites** (tamaño, y pausa del proyecto si pasa
   un tiempo sin uso). No los he comprobado para tu proyecto: míralos en su panel antes de
   invitar a nadie.

## Lo que no se ha hecho y te toca decidir

Está en `docs/informes/b5-informe-final.md`, apartado «Te toca decidir».
