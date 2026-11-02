-- Allow presidents to create Bureau mandates, posts, and member assignments.
-- Run after supabase-roles-setup.sql in the Supabase SQL Editor.
-- These INSERT policies do not grant update or delete access.

DROP POLICY IF EXISTS bureau_mandats_insert_president ON public.bureau_mandats;
CREATE POLICY bureau_mandats_insert_president ON public.bureau_mandats
  FOR INSERT TO authenticated
  WITH CHECK (private.carnet_current_role() = 'president');

DROP POLICY IF EXISTS bureau_postes_insert_president ON public.bureau_postes;
CREATE POLICY bureau_postes_insert_president ON public.bureau_postes
  FOR INSERT TO authenticated
  WITH CHECK (private.carnet_current_role() = 'president');

DROP POLICY IF EXISTS bureau_membres_insert_president ON public.bureau_membres;
CREATE POLICY bureau_membres_insert_president ON public.bureau_membres
  FOR INSERT TO authenticated
  WITH CHECK (
    private.carnet_current_role() = 'president'
    AND EXISTS (
      SELECT 1
      FROM public.membres m
      WHERE m.id = bureau_membres.membre_id
        AND NOT m.ap
        AND private.carnet_can_read_member(
          m.id::text, m.programme_ids, m.all_programmes, m.ap
        )
    )
  );
