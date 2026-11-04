# Ever After RSVP app

This is a self-contained, browser-based wedding RSVP and reception-desk app. It persists its data in the browser's local storage, so it works without a server for a single event device or a prototype.

## Try it

Open `index.html` in a modern browser. Use `WP-1042` for the guest RSVP flow and `wedding2026` for the admin desk.

## Production connection

For a multi-device, live wedding deployment, replace the small `storage` object in `app.js` with Supabase calls and store the data in `invitations`, `tables`, `rsvps`, and `check_ins` tables. Authentication should use Supabase Auth or another server-side provider; the local passcode is deliberately demo-only.

The app already keeps invitations, table capacities, RSVP details, plus-one information, check-ins, and table assignments as separate fields, which maps directly to that database layout.
