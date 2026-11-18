-- B4b-1 · Esquema remoto: claves de la cuenta y filas cifradas.
--
-- El servidor nunca ve datos financieros en claro. Guarda:
--   * claves_de_usuario: la clave de datos de cada cuenta, envuelta (cifrada)
--     dos veces en el dispositivo: con la contraseña y con el código de
--     recuperación. Sin la contraseña o el código no se puede abrir.
--   * fila_cifrada: cada fila de la base local, cifrada en el dispositivo.
--     En este bloque queda creada y vacía: la sincronización es del 4b-2.
--
-- Aislamiento: RLS activado y forzado en las dos tablas; solo el rol
-- `authenticated` tiene permisos, y solo sobre sus propias filas. El rol
-- `anon` no tiene ninguno.
--
-- Diseño completo: docs/seguridad/diseno-criptografico.md.

-- ---------------------------------------------------------------- marcas de tiempo

-- Pone las marcas de tiempo en el servidor. El cliente no puede fijarlas:
-- lo que envíe en esas columnas se sustituye aquí.
create function public.poner_marcas_de_tiempo()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if tg_table_name = 'claves_de_usuario' then
      new.creado_en := now();
    end if;
  elsif tg_table_name = 'claves_de_usuario' then
    new.creado_en := old.creado_en;
  end if;
  new.actualizada_en := now();
  return new;
end;
$$;

revoke all on function public.poner_marcas_de_tiempo() from public, anon, authenticated;

-- ---------------------------------------------------------------- claves_de_usuario

create table public.claves_de_usuario (
  user_id uuid primary key default auth.uid()
    references auth.users (id) on delete cascade,
  -- Sobres en base64 para URL: versión, nonce y la clave de datos cifrada (98 caracteres hoy).
  clave_por_contrasena text not null
    check (char_length(clave_por_contrasena) between 98 and 400 and clave_por_contrasena ~ '^[A-Za-z0-9_-]+$'),
  clave_por_recuperacion text not null
    check (char_length(clave_por_recuperacion) between 98 and 400 and clave_por_recuperacion ~ '^[A-Za-z0-9_-]+$'),
  -- Con qué parámetros se derivaron las claves de la contraseña.
  version_de_derivacion smallint not null check (version_de_derivacion between 1 and 1000),
  -- Formato de los dos sobres.
  version_de_formato smallint not null check (version_de_formato between 1 and 255),
  creado_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

comment on table public.claves_de_usuario is
  'Clave de datos de cada cuenta, cifrada en el dispositivo. El servidor no puede abrirla.';

alter table public.claves_de_usuario enable row level security;
alter table public.claves_de_usuario force row level security;

create trigger marcas_de_tiempo
  before insert or update on public.claves_de_usuario
  for each row execute function public.poner_marcas_de_tiempo();

revoke all on table public.claves_de_usuario from public, anon, authenticated;
grant select, insert, update, delete on table public.claves_de_usuario to authenticated;

create policy "leer las claves propias" on public.claves_de_usuario
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "crear las claves propias" on public.claves_de_usuario
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "cambiar las claves propias" on public.claves_de_usuario
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "borrar las claves propias" on public.claves_de_usuario
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- fila_cifrada

create table public.fila_cifrada (
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  -- Tabla local a la que pertenece la fila. Solo las que se sincronizan.
  tabla text not null check (tabla in (
    'cuenta',
    'categoria',
    'movimiento',
    'valor_de_inversion',
    'objetivo',
    'aportacion_a_objetivo',
    'regla_recurrente',
    'presupuesto',
    'linea_de_presupuesto',
    'captura',
    'alias_de_tarjeta',
    'regla_de_comercio'
  )),
  id uuid not null,
  -- El sobre cifrado, en base64 para URL. Como mucho 64 KiB de texto.
  contenido text not null
    check (char_length(contenido) between 55 and 65536 and contenido ~ '^[A-Za-z0-9_-]+$'),
  version_de_formato smallint not null check (version_de_formato between 1 and 255),
  -- Una fila borrada se conserva marcada, para que el borrado llegue a los demás dispositivos.
  borrada boolean not null default false,
  -- La pone el servidor. Decide qué escritura es la última.
  actualizada_en timestamptz not null default now(),
  primary key (user_id, tabla, id)
);

comment on table public.fila_cifrada is
  'Filas de la base local, cifradas en el dispositivo. El servidor solo ve a quién pertenecen, de qué tabla son y cuándo cambiaron.';

create index fila_cifrada_por_cambio on public.fila_cifrada (user_id, actualizada_en);

alter table public.fila_cifrada enable row level security;
alter table public.fila_cifrada force row level security;

create trigger marcas_de_tiempo
  before insert or update on public.fila_cifrada
  for each row execute function public.poner_marcas_de_tiempo();

revoke all on table public.fila_cifrada from public, anon, authenticated;
grant select, insert, update, delete on table public.fila_cifrada to authenticated;

create policy "leer las filas propias" on public.fila_cifrada
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "crear filas propias" on public.fila_cifrada
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "cambiar las filas propias" on public.fila_cifrada
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "borrar las filas propias" on public.fila_cifrada
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- borrado de cuenta

-- Borra la cuenta de quien la llama, y de nadie más: no recibe ningún
-- parámetro, y a quién borrar lo dice la sesión (auth.uid()).
--
-- Necesita privilegios elevados (security definer) porque el rol
-- `authenticated` no puede borrar de auth.users. Por eso: search_path vacío,
-- todos los nombres con su esquema, y ejecución permitida solo a
-- `authenticated`.
create function public.borrar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := auth.uid();
begin
  if yo is null then
    raise exception 'Hace falta una sesión para borrar la cuenta.' using errcode = '28000';
  end if;
  delete from public.fila_cifrada where user_id = yo;
  delete from public.claves_de_usuario where user_id = yo;
  delete from auth.users where id = yo;
end;
$$;

comment on function public.borrar_mi_cuenta() is
  'Borra las filas, las claves y el usuario de quien la llama. No admite parámetros.';

revoke all on function public.borrar_mi_cuenta() from public, anon;
grant execute on function public.borrar_mi_cuenta() to authenticated;
