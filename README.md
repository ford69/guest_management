# Ever After guest management

Wedding RSVP, reception check-in, and table assignment for Winston and Pokua. The app is **Next.js + TypeScript**, and **Supabase** is the database and auth layer.

## Setup

Requires Node.js 22 or newer (`nvm use` picks it up from `.nvmrc`).

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and add the project URL plus the publishable (anon) key.
3. Apply the schema:

```bash
npx supabase link --project-ref your-project-ref
npx supabase db push
```

Or paste `supabase/migrations/20261105120000_init.sql` into the Supabase SQL editor.

4. In **Authentication → Users**, create a reception staff account. That email and password open the admin desk and `/admin` dashboard.

5. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Add guests from `/admin` — there is no demo seed data.

## What lives where

- `app/` — Next.js App Router pages and server actions
- `components/` — RSVP, reception desk, and admin dashboard UI
- `lib/supabase/` — browser, server, and proxy Supabase clients
- `supabase/` — database config and migrations
