# Ever After guest management

Wedding RSVP, reception check-in, and table assignment for Winston and Pokua. The app is **Next.js + TypeScript**, and **Supabase** is the database and auth layer.

## Setup

Requires Node.js 22 or newer (`nvm use` picks it up from `.nvmrc`).

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and add the project URL plus the publishable (anon) key.
3. Apply the schema and seed data:

```bash
npx supabase link --project-ref your-project-ref
npx supabase db push
npx supabase db query --file supabase/seed.sql
```

You can also paste `supabase/migrations/20261105120000_init.sql` and `supabase/seed.sql` into the Supabase SQL editor.

4. In **Authentication → Users**, create a reception staff account. That email and password open the admin desk.

5. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Demo invitation code: `WP-1042`.

## What lives where

- `app/` — Next.js App Router pages and server actions
- `components/` — RSVP and reception-desk UI
- `lib/supabase/` — browser, server, and proxy Supabase clients
- `supabase/` — database config, migration, and seed data
