# Pasos del propietario · bloque 4b-2 (sincronización cifrada)

Fecha: 22/11/2026. Lo que tienes que hacer tú para dar el bloque por bueno. Nada de esto
lo ha hecho Claude Code: no ha tocado el proyecto remoto ni ha probado con dos teléfonos.

Mientras no hagas los pasos 1 y 3, el bloque está en `COMPLETED_WITH_EXTERNAL_GATES`.

## Lo que nunca debes copiar fuera del panel

Igual que en el 4b-1: la contraseña de la base de datos, la clave secreta
(`service_role` / `sb_secret_…`) y cualquier token de acceso. Si una orden te pide la
contraseña de la base, escríbela tú en tu terminal; no la pegues en ningún chat ni
fichero.

## Paso 1 · Aplicar la migración nueva al proyecto remoto

Solo hay una migración nueva: `20261122120000_retirar_execute_de_rls_auto_enable.sql`.
Retira a `public`, `anon` y `authenticated` el permiso de ejecutar
`public.rls_auto_enable()`. No toca tablas, datos ni ninguna otra función.

Desde `~/Desktop/FinancialControl`, en la rama `b4b2-sincronizacion`:

```bash
npx supabase db push --remote --dry-run
```

Tiene que anunciar **solo** esa migración. Si anuncia cualquier otra cosa, para y no
sigas. Después:

```bash
npx supabase db push --remote
```

La CLI actual apunta a la instancia local salvo que lleve `--remote`: sin ese parámetro
no cambiarías nada en el proyecto.

**No ejecutes `supabase config push`.** El fichero `supabase/config.toml` sube el límite
de inicios de sesión a 600 cada cinco minutos para las pruebas locales; ese valor no debe
llegar al proyecto remoto.

### Comprobar

1. Panel › Advisors › Security: los dos avisos sobre `public.rls_auto_enable()` deben
   desaparecer. Queda el de `public.borrar_mi_cuenta()`, que es esperado.
2. Panel › SQL Editor, crea una tabla de prueba y mira que sigue naciendo con RLS:

   ```sql
   create table public.zz_prueba_rls (id int);
   select relrowsecurity from pg_class where oid = 'public.zz_prueba_rls'::regclass;
   drop table public.zz_prueba_rls;
   ```

   El `select` debe devolver `true`. En la instancia local, reproduciendo la función y su
   disparador con la definición que publica Supabase, da `true`. **Que la función de tu
   proyecto sea exactamente esa no lo he podido comprobar**: por eso este paso.

Si el `select` devolviera `false`, deshaz la migración con:

```sql
grant execute on function public.rls_auto_enable() to anon, authenticated;
```

y avísame con el resultado.

## Paso 2 · Instalar la versión nueva en el iPhone

Hay código nativo que antes no se usaba (escritura del fichero de exportación), así que
hay que volver a instalar:

```bash
npx expo run:ios --device --configuration Release
```

Al abrirla, la base local pasa de la versión 4 a la 5. Solo añade tablas internas de la
sincronización; tus datos no cambian.

## Paso 3 · Prueba con dos dispositivos

Necesitas dos dispositivos con la app (dos iPhone, o un iPhone y un simulador contra el
proyecto remoto). Usa una **cuenta de prueba**, no la tuya, hasta terminar la lista.

Tu iPhone ya tiene la cuenta del 22/11 y datos locales. Al abrir la versión nueva con esa
sesión, **la app subirá tus datos locales a esa cuenta**, porque su nube está vacía. Si
no quieres que eso pase todavía, cierra sesión en Ajustes › Cuenta antes de instalar.

| # | Qué haces | Qué debe pasar |
|---|---|---|
| 1 | En A, crea una cuenta de prueba (o entra) con datos locales | Cuenta muestra «Al día» y «No hay cambios pendientes» a los pocos segundos |
| 2 | Panel › Table Editor › `fila_cifrada` | Hay filas; en `contenido` solo se ve texto ilegible. Ningún nombre, importe ni fecha tuya |
| 3 | En B (recién instalado), entra en la misma cuenta | Aparecen los datos de A. Las categorías no están duplicadas |
| 4 | En A, crea un movimiento, cambia otro y borra otro. Espera unos segundos. En B, abre la app o pulsa «Sincronizar ahora» | Los tres cambios aparecen en B |
| 5 | Lo mismo de B hacia A | Aparecen en A |
| 6 | Pon A en modo avión. Crea dos movimientos. Mira Ajustes › Cuenta | «Sin conexión…» y «2 cambios pendientes de subir». La app funciona con normalidad |
| 7 | Quita el modo avión y espera, o pulsa «Sincronizar ahora» | «Al día», sin pendientes. Los dos movimientos llegan a B |
| 8 | Con los dos en modo avión, cambia **el mismo** movimiento en A y en B con importes distintos. Conecta primero B, sincroniza; luego A, sincroniza; luego B otra vez | Los dos acaban con la versión de **A** (la que subió después). La de B se pierde: es lo acordado |
| 9 | En A: Ajustes › Cuenta › Cambiar la contraseña | «Contraseña cambiada». A sigue sincronizando |
| 10 | En B: cierra sesión y entra con la contraseña **antigua** | No entra |
| 11 | En B: entra con la **nueva** | Entra, no pregunta nada, y sigue sincronizando con sus datos |
| 12 | En un tercer dispositivo, o tras borrar la app de B y crear en ella un par de movimientos antes de entrar: entra en la cuenta | Sale la pregunta «Hay datos en la nube y en este dispositivo» |
| 13 | Pulsa «Cancelar y cerrar sesión» | Vuelve a «Sin cuenta». Los movimientos locales siguen ahí |
| 14 | Vuelve a entrar y pulsa «Usar los datos de la nube». En la hoja, guarda el fichero en Archivos | Los datos pasan a ser los de la cuenta. El fichero guardado contiene los que había |
| 15 | Repite el 14 pero cierra la hoja sin guardar | Mensaje «No se ha guardado la copia…» y no cambia nada |
| 16 | Ajustes › Exportar mis datos › Exportar todo (JSON), guardándolo en Archivos | El fichero se abre como texto y están tus cuentas y movimientos |
| 17 | Exportar movimientos (CSV) y ábrelo en Numbers o Excel | Los gastos salen en negativo, los ingresos en positivo, cada uno con su divisa, y los acentos se leen bien |
| 18 | Activa el bloqueo de la app y exporta otra vez | Pide Face ID o el código antes de abrir la hoja |
| 19 | Cierra sesión en un dispositivo y úsalo sin cuenta | Todo funciona igual que antes de este bloque |

Lo que **no** vas a poder ver con esta lista y solo está probado con pruebas automáticas:
los cortes a mitad del cambio de contraseña, las escrituras confirmadas fuera de orden y
los sobres manipulados.

## Paso 4 · Dos ajustes del panel que conviene mirar

No bloquean nada, pero no los he podido leer:

1. **Authentication › Sign In / Providers › Email › «Secure password change».** Con
   cualquiera de los dos valores el cambio de contraseña funciona, porque la app inicia
   sesión justo antes. Anota cuál tienes.
2. **Authentication › Rate Limits.** Con varias versiones de derivación, una contraseña
   mal escrita gastará un intento por versión. Hoy solo hay una versión.

## Lo que queda decidido por ti (y puedes cambiar)

Están en `docs/informes/b4b2-informe-final.md`, apartado «Te toca decidir».
