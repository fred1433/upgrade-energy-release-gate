-- BROKEN ON PURPOSE. Family 3.
-- Staff may edit hold notes, so UPDATE is granted on the table; the status columns are then "protected"
-- by a column-level REVOKE. A column REVOKE does not cancel a table-level GRANT.
-- Expected: test_direct_write_is_refused fails: the operator's PATCH lifts the hold.
grant update on public.holds to authenticated;
revoke update (status, lifted_by, lifted_at) on public.holds from authenticated;
create policy staff_edit_notes on public.holds for update to authenticated
  using ((select mes_private.caller_shop_role()) is not null)
  with check ((select mes_private.caller_shop_role()) is not null);
