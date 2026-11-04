import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '../src/db.js';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required.');
const hash = await bcrypt.hash(password, 12);
await db.query('INSERT INTO administrators(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash',[email.toLowerCase(),hash]);
console.log(`Administrator configured for ${email}`);
await db.end();
