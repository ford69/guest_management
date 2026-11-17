create or replace function public.guest_json(g guests)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', g.id,
    'code', g.invitation_code,
    'name', g.name,
    'category', g.category,
    'seats', g.reserved_seats,
    'plusOne', g.plus_one_allowed,
    'plusOneName', g.plus_one_name,
    'ceremony', g.attending_ceremony,
    'reception', g.attending_reception,
    'table', g.table_id,
    'checked', g.checked_in_at is not null,
    'rsvpAt', g.rsvp_at
  );
$$;
