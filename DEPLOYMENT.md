# Deploying Ever After

## 1. Create the Supabase project

Create a project in the Supabase dashboard. Apply `supabase/migrations/20261105120000_init.sql`. Add guests from the admin dashboard.

Create at least one reception user under **Authentication → Users**. Every authenticated user can manage guests and tables.

## 2. Environment variables

Set these on Vercel (or any Next.js host):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the project publishable/anon key

## 3. Deploy the Next.js app

The API and UI are one Next.js app. Deploy the repository root:

```bash
npm run build
npm start
```

On Vercel, import the Git repository and use the default Next.js settings.

## Security checklist

- Never commit `.env.local`.
- Keep the service role key off the Next.js app. Public RSVP uses `lookup_invitation` and `submit_rsvp` RPCs with the publishable key.
- Create separate staff accounts if more than one device needs admin access.
- Use HTTPS only.
