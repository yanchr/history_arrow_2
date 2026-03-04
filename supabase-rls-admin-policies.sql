-- Admin-only write policies for History Arrow
-- Run this file in Supabase SQL Editor after switching frontend CRUD to direct Supabase calls.
--
-- What this does:
-- 1) Creates `admin_users` table (list of user ids allowed to write)
-- 2) Keeps public read access for `events` and `labels`
-- 3) Restricts INSERT/UPDATE/DELETE on `events` and `labels` to admins only
--
-- Note:
-- - Replace '<your-auth-user-uuid>' below with your own Supabase Auth user id.
-- - If you do not insert at least one admin id, nobody can edit data.

-- Admin list table
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- No client-side access needed for this table
DROP POLICY IF EXISTS "No direct reads on admin_users" ON public.admin_users;
CREATE POLICY "No direct reads on admin_users"
  ON public.admin_users
  FOR SELECT
  USING (false);

DROP POLICY IF EXISTS "No direct writes on admin_users" ON public.admin_users;
CREATE POLICY "No direct writes on admin_users"
  ON public.admin_users
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Helper function used in policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
  );
$$;

-- Allow calling helper from app roles
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ---------------------------
-- EVENTS: keep public read, admin-only writes
-- ---------------------------
DROP POLICY IF EXISTS "Authenticated users can insert events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can update events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can delete events" ON public.events;

DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
CREATE POLICY "Admins can insert events"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update events" ON public.events;
CREATE POLICY "Admins can update events"
  ON public.events
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
CREATE POLICY "Admins can delete events"
  ON public.events
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ---------------------------
-- LABELS: keep public read, admin-only writes
-- ---------------------------
DROP POLICY IF EXISTS "Authenticated users can insert labels" ON public.labels;
DROP POLICY IF EXISTS "Authenticated users can update labels" ON public.labels;
DROP POLICY IF EXISTS "Authenticated users can delete labels" ON public.labels;

DROP POLICY IF EXISTS "Admins can insert labels" ON public.labels;
CREATE POLICY "Admins can insert labels"
  ON public.labels
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update labels" ON public.labels;
CREATE POLICY "Admins can update labels"
  ON public.labels
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete labels" ON public.labels;
CREATE POLICY "Admins can delete labels"
  ON public.labels
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Seed your own admin user id (replace value first)
-- You can find it in Supabase Dashboard -> Authentication -> Users.
-- Keep commented out until you replace placeholder.
-- INSERT INTO public.admin_users (user_id)
-- VALUES ('<your-auth-user-uuid>')
-- ON CONFLICT (user_id) DO NOTHING;
