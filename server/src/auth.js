import jwt from 'jsonwebtoken';

export function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Administrator sign-in is required.' });
  try { req.admin = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Your session has expired. Please sign in again.' }); }
}

export const createToken = (admin) => jwt.sign({ sub: admin.id, email: admin.email }, process.env.JWT_SECRET, { expiresIn: '12h' });
