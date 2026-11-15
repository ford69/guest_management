insert into reception_tables (name, capacity) values
  ('Table 1', 10),
  ('Table 2', 8),
  ('Table 3', 10),
  ('Table 4', 8);

insert into guests (
  invitation_code,
  name,
  category,
  reserved_seats,
  plus_one_allowed,
  plus_one_name,
  attending_ceremony,
  attending_reception,
  table_id,
  checked_in_at
) values
  ('WP-1042', 'Mr. & Mrs. Mensah', 'Groom’s Family', 2, true, '', true, true, 3, null),
  ('WP-1095', 'Akosua Owusu', 'Bride’s Friend', 1, false, '', true, true, 1, null),
  ('WP-1108', 'Daniel & Esi Boateng', 'Bride’s Family', 2, false, '', true, true, 1, now()),
  ('WP-1121', 'Nana Agyeman', 'Church Leader', 1, false, '', true, true, null, null),
  ('WP-1130', 'The Addo Family', 'Groom’s Family', 4, false, '', true, true, 2, null),
  ('WP-1152', 'Kojo Asante', 'Groom’s Friend', 1, false, '', true, true, 3, null);
