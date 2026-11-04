# Production deployment: Winston & Pokua RSVP

## 1. Create the Managed PostgreSQL database

In DigitalOcean, create a Managed PostgreSQL cluster. From a trusted terminal, apply `server/db/schema.sql` using the connection string DigitalOcean provides. Set the API's `DATABASE_URL` to that same connection string.

## 2. Deploy the API to App Platform

Create an App Platform service from this repository, using `/server` as the source directory and `npm start` as the run command. Set these encrypted environment variables:

- `DATABASE_URL`
- `JWT_SECRET` — a long, random value
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Set `FRONTEND_ORIGIN` to the final Static Site URL. After the first deployment, run `npm run seed:admin` once from an App Platform console or a trusted machine with the same environment variables.

The API has health checks at `/health`; configure App Platform to use it.

## 3. Deploy the frontend as a Static Site

In `app/config.js`, set `apiBaseUrl` to the API URL followed by `/api`, for example:

```js
window.APP_CONFIG = { apiBaseUrl: 'https://your-api.ondigitalocean.app/api' };
```

Create a DigitalOcean Static Site using `/app` as the source directory. There is no build command; publish `index.html`.

## Security checklist

- Never commit `.env` or production passwords.
- Set a unique `JWT_SECRET` of at least 32 random characters.
- Restrict `FRONTEND_ORIGIN` to the exact Static Site domain.
- Use HTTPS only (DigitalOcean provides this by default).
- Give reception staff separate administrator accounts if multiple devices need access.

## Data model

PostgreSQL is the source of truth. `guests` holds each invitation and RSVP, `reception_tables` holds capacity and seats, and `administrators` holds password hashes only. This allows phones, tablets, and computers to use the same current guest list.
