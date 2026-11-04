import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { createToken, requireAdmin } from './auth.js';

const app = express();
const allowedOrigins = (process.env.FRONTEND_ORIGIN || '').split(',').filter(Boolean);
app.use(helmet());
app.use(cors({ origin(origin, done) { if (!origin || allowedOrigins.includes(origin)) return done(null, true); return done(new Error('Origin is not allowed')); } }));
app.use(express.json({ limit: '200kb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, limit: 250, standardHeaders: true, legacyHeaders: false }));

const clean = (value, max = 120) => String(value || '').trim().slice(0, max);
const guestColumns = 'id, invitation_code AS code, name, category, reserved_seats AS seats, plus_one_allowed AS "plusOne", plus_one_name AS "plusOneName", attending_ceremony AS ceremony, attending_reception AS reception, table_id AS table, checked_in_at AS "checkedInAt"';
const shapeGuest = (row) => ({ ...row, checked: Boolean(row.checkedInAt) });
const listGuests = async () => (await db.query(`SELECT ${guestColumns} FROM guests ORDER BY name`)).rows.map(shapeGuest);

app.get('/health', async (_req, res) => { await db.query('SELECT 1'); res.json({ ok: true }); });

app.post('/api/auth/login', async (req, res) => {
  const email = clean(req.body.email, 254).toLowerCase(); const password = String(req.body.password || '');
  const { rows } = await db.query('SELECT id, email, password_hash FROM administrators WHERE email = $1', [email]);
  const admin = rows[0];
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) return res.status(401).json({ error: 'Invalid email or password.' });
  res.json({ token: createToken(admin), administrator: { id: admin.id, email: admin.email } });
});

app.get('/api/public/invitations/:code', async (req, res) => {
  const { rows } = await db.query(`SELECT ${guestColumns} FROM guests WHERE invitation_code = $1`, [clean(req.params.code).toUpperCase()]);
  if (!rows[0]) return res.status(404).json({ error: 'Invitation not found.' });
  res.json({ guest: shapeGuest(rows[0]) });
});

app.put('/api/public/invitations/:code/rsvp', async (req, res) => {
  const ceremony = Boolean(req.body.ceremony); const reception = ceremony && Boolean(req.body.reception);
  const plusOneName = reception ? clean(req.body.plusOneName) : '';
  const { rows } = await db.query(`UPDATE guests SET attending_ceremony=$1, attending_reception=$2, plus_one_name=CASE WHEN plus_one_allowed THEN $3 ELSE '' END, rsvp_at=NOW(), updated_at=NOW() WHERE invitation_code=$4 RETURNING ${guestColumns}`,[ceremony,reception,plusOneName,clean(req.params.code).toUpperCase()]);
  if (!rows[0]) return res.status(404).json({ error: 'Invitation not found.' });
  res.json({ guest: shapeGuest(rows[0]) });
});

app.get('/api/admin/guests', requireAdmin, async (_req, res) => res.json({ guests: await listGuests() }));
app.put('/api/admin/state', requireAdmin, async (req, res) => {
  const client = await db.connect();
  try { await client.query('BEGIN');
    for (const table of (req.body.tables || [])) { await client.query('INSERT INTO reception_tables(name,capacity) VALUES($1,$2) ON CONFLICT(name) DO UPDATE SET capacity=EXCLUDED.capacity',[clean(table.name,60),Number(table.capacity)]); }
    for (const guest of (req.body.guests || [])) { await client.query(`INSERT INTO guests(invitation_code,name,category,reserved_seats,plus_one_allowed,plus_one_name,attending_ceremony,attending_reception,table_id,checked_in_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(invitation_code) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,reserved_seats=EXCLUDED.reserved_seats,plus_one_allowed=EXCLUDED.plus_one_allowed,plus_one_name=EXCLUDED.plus_one_name,attending_ceremony=EXCLUDED.attending_ceremony,attending_reception=EXCLUDED.attending_reception,table_id=EXCLUDED.table_id,checked_in_at=EXCLUDED.checked_in_at,updated_at=NOW()`,[clean(guest.code,12),clean(guest.name),clean(guest.category,60),Number(guest.seats),Boolean(guest.plusOne),clean(guest.plusOneName),Boolean(guest.ceremony),Boolean(guest.reception),guest.table||null,guest.checked?new Date():null]); }
    await client.query('COMMIT'); res.json({ ok: true });
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
});
app.post('/api/admin/guests', requireAdmin, async (req, res) => {
  const name = clean(req.body.name); const seats = Number(req.body.seats);
  if (!name || !Number.isInteger(seats) || seats < 1 || seats > 12) return res.status(400).json({ error: 'A name and 1–12 reserved seats are required.' });
  const category = clean(req.body.category, 60) || 'Uncategorised';
  for (let n = 0; n < 5; n++) { const code = `WP-${Math.floor(1000 + Math.random() * 9000)}`; try { const result = await db.query(`INSERT INTO guests (invitation_code,name,category,reserved_seats,plus_one_allowed) VALUES ($1,$2,$3,$4,$5) RETURNING ${guestColumns}`,[code,name,category,seats,Boolean(req.body.plusOne)]); return res.status(201).json({ guest: shapeGuest(result.rows[0]) }); } catch (error) { if (error.code !== '23505') throw error; } }
  res.status(503).json({ error: 'Could not create a unique invitation code. Please try again.' });
});
app.patch('/api/admin/guests/:id', requireAdmin, async (req, res) => {
  const values=[]; const set=[]; const add=(column,value)=>{values.push(value);set.push(`${column}=$${values.length}`)};
  if ('category' in req.body) add('category', clean(req.body.category,60));
  if ('table' in req.body) add('table_id', req.body.table ? Number(req.body.table) : null);
  if ('checked' in req.body) add('checked_in_at', req.body.checked ? new Date() : null);
  if (!set.length) return res.status(400).json({ error: 'No supported changes supplied.' });
  set.push('updated_at=NOW()'); values.push(Number(req.params.id));
  const { rows } = await db.query(`UPDATE guests SET ${set.join(', ')} WHERE id=$${values.length} RETURNING ${guestColumns}`,values);
  if (!rows[0]) return res.status(404).json({ error: 'Guest not found.' }); res.json({ guest: shapeGuest(rows[0]) });
});

app.get('/api/admin/tables', requireAdmin, async (_req, res) => { const { rows }=await db.query('SELECT id, name, capacity FROM reception_tables ORDER BY id'); res.json({ tables: rows }); });
app.post('/api/admin/tables', requireAdmin, async (req,res) => { const capacity=Number(req.body.capacity || 10); const name=clean(req.body.name)||'Table'; if(!Number.isInteger(capacity)||capacity<1||capacity>30)return res.status(400).json({error:'Capacity must be between 1 and 30.'}); const {rows}=await db.query('INSERT INTO reception_tables(name,capacity) VALUES($1,$2) RETURNING id,name,capacity',[name,capacity]); res.status(201).json({table:rows[0]}); });
app.patch('/api/admin/tables/:id', requireAdmin, async (req,res) => { const capacity=Number(req.body.capacity); if(!Number.isInteger(capacity)||capacity<1||capacity>30)return res.status(400).json({error:'Capacity must be between 1 and 30.'}); const {rows}=await db.query('UPDATE reception_tables SET capacity=$1 WHERE id=$2 RETURNING id,name,capacity',[capacity,Number(req.params.id)]);if(!rows[0])return res.status(404).json({error:'Table not found.'});res.json({table:rows[0]}); });

app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ error: 'Something went wrong. Please try again.' }); });
app.listen(process.env.PORT || 8080, () => console.log(`API listening on ${process.env.PORT || 8080}`));
