-- B4b-2 · Retira el permiso de ejecutar public.rls_auto_enable() a quien no lo necesita.
--
-- Esa función no es de este repositorio: la crea Supabase en el proyecto al
-- activar «RLS en tablas nuevas». Es SECURITY DEFINER, devuelve event_trigger
-- y la lanza un disparador de eventos cuando se crea una tabla. Al estar en
-- `public`, Supabase concede EXECUTE a `anon` y `authenticated` como a
-- cualquier función de ese esquema, y el asesor de seguridad avisa de ello.
--
-- Nadie tiene que llamarla: un disparador de eventos ejecuta su función sin
-- mirar el permiso EXECUTE de quien crea la tabla. Retirarlo no cambia que
-- las tablas nuevas de `public` sigan quedando con RLS (comprobado en
-- supabase/pruebas/rls_auto_enable.test.ts).
--
-- No hace nada si la función no existe (en la instancia local no existe), y
-- no toca ninguna otra función, tabla ni permiso.

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;
