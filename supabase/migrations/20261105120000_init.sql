create table reception_tables (
  id bigint generated always as identity primary key,
  name text not null unique,
  capacity integer not null check (capacity between 1 and 30),
  created_at timestamptz not null default now()
);

create table guests (
  id bigint generated always as identity primary key,
  invitation_code text unique not null check (invitation_code ~ '^WP-[0-9]{4}$'),
  name text not null,
  category text not null default 'Uncategorised',
  reserved_seats integer not null default 1 check (reserved_seats between 1 and 12),
  plus_one_allowed boolean not null default false,
  plus_one_name text not null default '',
  attending_ceremony boolean not null default false,
  attending_reception boolean not null default false,
  rsvp_at timestamptz,
  table_id bigint references reception_tables(id) on delete set null,
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index guests_table_id_idx on guests(table_id);
create index guests_category_idx on guests(category);

alter table reception_tables enable row level security;
alter table guests enable row level security;

create policy "authenticated manage tables"
  on reception_tables
  for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated manage guests"
  on guests
  for all
  to authenticated
  using (true)
  with check (true);

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
    'checked', g.checked_in_at is not null
  );
$$;

create or replace function public.lookup_invitation(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g guests;
begin
  select * into g
  from guests
  where invitation_code = upper(trim(p_code));

  if not found then
    return null;
  end if;

  return public.guest_json(g);
end;
$$;

create or replace function public.submit_rsvp(
  p_code text,
  p_ceremony boolean,
  p_reception boolean,
  p_plus_one_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g guests;
  ceremony boolean := coalesce(p_ceremony, false);
  reception boolean := ceremony and coalesce(p_reception, false);
  plus_one text := case when reception then left(trim(coalesce(p_plus_one_name, '')), 120) else '' end;
begin
  update guests
  set
    attending_ceremony = ceremony,
    attending_reception = reception,
    plus_one_name = case when plus_one_allowed then plus_one else '' end,
    rsvp_at = now(),
    updated_at = now()
  where invitation_code = upper(trim(p_code))
  returning * into g;

  if not found then
    return null;
  end if;

  return public.guest_json(g);
end;
$$;

revoke all on function public.guest_json(guests) from public;
revoke all on function public.lookup_invitation(text) from public;
revoke all on function public.submit_rsvp(text, boolean, boolean, text) from public;

grant execute on function public.lookup_invitation(text) to anon, authenticated;
grant execute on function public.submit_rsvp(text, boolean, boolean, text) to anon, authenticated;
