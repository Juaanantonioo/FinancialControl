# Pasos del propietario · bloque 4b-1

Fecha: 22/11/2026. Lo que tienes que hacer tú, en el panel de Supabase y en tu terminal,
para que la cuenta funcione contra tu proyecto. **Nada de esto lo ha hecho el asistente:**
en el proyecto remoto no se ha aplicado nada.

Proyecto: referencia `btkpyvfwdbnuralhvwhg`, región eu-west-1.

Los nombres de los menús del panel son los vistos en la documentación de Supabase; si han
cambiado de sitio, busca el concepto.

## Lo que nunca debes copiar fuera del panel

- La **clave de servicio** o **secreta** (`service_role`, `sb_secret_…`). Salta todas las
  protecciones de la base de datos. No va en `.env`, ni en la app, ni en un mensaje, ni en
  un documento, ni se pega en este chat.
- La **contraseña de la base de datos**. Solo la escribes tú en tu terminal cuando la CLI
  la pida (paso 4).
- Un **token de acceso personal** de Supabase.
- La cadena de conexión de Postgres completa (lleva la contraseña dentro).

Lo único que sale del panel hacia tu ordenador es la **URL del proyecto** y la **clave
pública** (`anon` o `sb_publishable_…`). Es pública por diseño: viaja dentro de la app.

## Paso 1 · Revisar qué despliega la integración con GitHub (antes que nada)

Tu proyecto está enlazado al repositorio. Hay que saber qué rama despliega migraciones
sola.

1. Panel › Project Settings › Integrations › GitHub.
2. Mira la **rama de producción** (normalmente `main`) y si está activado el despliegue
   automático de migraciones.

Resultado esperado: la rama de producción es `main`. La rama `b4b1-cuenta-y-claves` **no
está fusionada**, así que hasta ahora no se ha desplegado nada.

Decide una de dos formas de aplicar las migraciones, no las dos:

- **A (recomendada ahora): a mano desde tu terminal** (paso 4). Sabes exactamente cuándo
  se aplica. Si usas esta, comprueba después que al fusionar en `main` la integración no
  intenta aplicarlas otra vez; no pasa nada si lo hace (verá que ya están), pero conviene
  saberlo.
- **B: dejar que lo haga la integración** al fusionar en `main`. Entonces sáltate el paso 4.

## Paso 2 · Crear el fichero `.env`

1. Panel › Project Settings › API (o «Data API» y «API Keys»).
2. Copia la **Project URL** y la clave **pública** (`anon` / `publishable`).
3. En la carpeta del proyecto:

   ```sh
   cp .env.example .env
   ```

4. Abre `.env` y pon los dos valores:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://btkpyvfwdbnuralhvwhg.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<la clave pública>
   ```

Resultado esperado: `git status` **no** muestra `.env` (git lo ignora). Si lo muestra,
para y no hagas commit.

Comprobación: `git check-ignore .env` responde `.env`.

## Paso 3 · Desactivar la confirmación de correo

El correo integrado de Supabase solo envía a miembros del equipo, así que con la
confirmación activada nadie más podría entrar.

1. Panel › Authentication › Sign In / Providers › Email.
2. Desactiva **Confirm email**. Guarda.
3. Deja activado el alta con correo y contraseña.

Resultado esperado: «Confirm email» desactivado.

Consecuencia que aceptas: cualquiera puede registrar una cuenta con un correo que no es
suyo. No accede a nada ajeno, pero ocupa ese correo. Antes de abrir la beta a mucha gente
habrá que poner un proveedor de correo y volver a activar la confirmación.

## Paso 4 · Aplicar las migraciones desde tu terminal (solo si elegiste A)

En la carpeta del proyecto:

```sh
npx supabase login
npx supabase link --project-ref btkpyvfwdbnuralhvwhg
npx supabase db push --dry-run
```

- `login` abre el navegador para autorizar la CLI.
- `link` te pide la **contraseña de la base de datos**. Escríbela tú; no la pegues en
  ningún otro sitio.
- `db push --dry-run` no cambia nada: solo enseña lo que haría.

Resultado esperado del ensayo: una sola migración pendiente,
`20261118120000_cuenta_y_filas_cifradas.sql`.

Si es eso y nada más:

```sh
npx supabase db push
```

Resultado esperado: «Finished supabase db push» (o equivalente) sin errores.

Si el ensayo enseña otra cosa (más migraciones, o cambios que no reconoces), **no sigas** y
pregunta.

## Paso 5 · Comprobar en el panel que las dos tablas tienen RLS

1. Panel › Table Editor. Deben existir `claves_de_usuario` y `fila_cifrada`, las dos
   vacías y las dos con la etiqueta de **RLS enabled**. Ninguna debe decir «Unrestricted».
2. Panel › Authentication › Policies. Cuatro políticas por tabla (leer, crear, cambiar,
   borrar), todas para el rol `authenticated`.
3. Panel › Advisors › Security (o «Security Advisor»). No debe haber avisos sobre estas
   tablas.
4. Opcional, en SQL Editor:

   ```sql
   select relname, relrowsecurity, relforcerowsecurity
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r';
   ```

   Resultado esperado: dos filas, con `true` en las dos columnas.

## Paso 6 · Probar la cuenta en el simulador o en el iPhone

Hay código nativo nuevo (libsodium y el llavero): hace falta compilar, no basta recargar.

```sh
npm install
npx expo prebuild --clean
npx expo run:ios                       # simulador
npx expo run:ios --device --configuration Release   # iPhone
```

`npm install` aplica solo el parche de libsodium y comprueba su huella. Si falla con
«no es el fichero esperado», no sigas: algo ha cambiado en el paquete.

En la app, con datos de prueba:

| # | Paso | Resultado esperado |
|---|---|---|
| 1 | Ajustes › Diagnóstico | «Conexión con el servidor: Correcto. El servidor responde y las tablas existen…» y «Biblioteca de cifrado: Correcta» |
| 2 | En Diagnóstico, pulsar «Medir» tres veces | Un tiempo en milisegundos. **Apúntalo**: hace falta para fijar los parámetros (paso 7) |
| 3 | Ajustes › Cuenta | «Sin cuenta», con la explicación de que hoy no sincroniza nada |
| 4 | Crear cuenta con un correo de prueba y una contraseña de 12 caracteres o más | Aparece el código de recuperación, 14 grupos. No hay botón de volver |
| 5 | «Guardar o imprimir» | La hoja de compartir de iOS, con Imprimir y Guardar en Archivos |
| 6 | «Ya lo he guardado» y escribir los dos grupos pedidos | «Sesión iniciada» con tu correo |
| 7 | En el panel › Authentication › Users y Table Editor › `claves_de_usuario` | Un usuario y una fila. Las dos columnas de clave son texto ilegible |
| 8 | Cerrar la app del todo y abrirla | Cuenta sigue en «Sesión iniciada» |
| 9 | Cerrar sesión e iniciarla de nuevo | Entra sin enseñar ningún código |
| 10 | Iniciar sesión con la contraseña mal | «Correo o contraseña incorrectos» |
| 11 | Modo avión y crear cuenta | «No hay conexión con el servidor…» en unos segundos, sin quedarse colgada |
| 12 | Borrar cuenta: escribir BORRAR | «Sin cuenta». En el panel ya no está el usuario ni su fila |
| 13 | Con el bloqueo de la app activado, abrir Cuenta por Ajustes tras salir y volver | Pide Face ID antes de enseñar nada |

## Paso 7 · Antes de crear la primera cuenta real: fijar Argon2id

Los parámetros de derivación (64 MiB, 8 pasadas) son **provisionales**. Cambiarlos después
de que exista una cuenta real obliga a esa persona a rehacer su cuenta.

1. Mide el tiempo en tu iPhone (paso 6, fila 2).
2. Cuando exista la versión web, mídelo en un navegador de móvil.
3. Objetivo: entre medio segundo y dos segundos en el dispositivo más lento que quieras
   admitir. Si queda muy por debajo, se suben las pasadas; si el navegador no concede la
   memoria, se baja.
4. Con las medidas, se fijan los valores en `src/cripto/parametros.ts` y se regeneran los
   vectores. Es un encargo corto.

Hasta entonces, usa solo cuentas de prueba y bórralas después.

## Lo que queda decidido por ti

1. Forma de aplicar las migraciones (paso 1): A o B. Recomendación: A.
2. Parámetros definitivos de Argon2id (paso 7), con tus medidas.
3. Qué hacer con el parche de libsodium si el paquete sigue sin mantenimiento
   (`riesgo-de-dependencia-libsodium.md`). Se revisa en el 4c.
