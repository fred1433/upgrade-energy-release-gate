-- NOT A DATABASE BUG. Family 3, the "0 rows" story.
-- UPDATE is granted and an RLS policy lets only quality update holds. For an operator the policy's USING
-- clause filters the row out: the database changes nothing and returns no error (HTTP 204, or 200 with []).
-- The row is protected; a screen that only checks the error reports success.
-- Expected: test_direct_write_is_refused fails because the refusal is not explicit; the row stays open.
grant update on public.holds to authenticated;
create policy quality_updates_holds on public.holds for update to authenticated
  using ((select mes_private.caller_shop_role()) = 'quality')
  with check ((select mes_private.caller_shop_role()) = 'quality');
