CREATE TABLE administrators (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reception_tables (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE guests (
  id BIGSERIAL PRIMARY KEY,
  invitation_code TEXT UNIQUE NOT NULL CHECK (invitation_code ~ '^WP-[0-9]{4}$'),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Uncategorised',
  reserved_seats INTEGER NOT NULL DEFAULT 1 CHECK (reserved_seats BETWEEN 1 AND 12),
  plus_one_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  plus_one_name TEXT NOT NULL DEFAULT '',
  attending_ceremony BOOLEAN NOT NULL DEFAULT FALSE,
  attending_reception BOOLEAN NOT NULL DEFAULT FALSE,
  rsvp_at TIMESTAMPTZ,
  table_id BIGINT REFERENCES reception_tables(id) ON DELETE SET NULL,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX guests_table_id_idx ON guests(table_id);
CREATE INDEX guests_category_idx ON guests(category);
