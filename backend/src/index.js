import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

console.log('[DEBUG] Starting server...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'igreja-saas-secret-change-in-production';
const JWT_EXPIRES = '7d';

const dbPath = path.resolve(__dirname, '../data/igreja.db');
console.log('[DEBUG] DB path:', dbPath);
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

console.log('[DEBUG] Middleware loaded');

function getChurchIdFromSlug(slug) {
  const church = db.prepare('SELECT id FROM churches WHERE slug = ?').get(slug);
  return church?.id;
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

function requireChurch(req, res, next) {
  if (!req.user?.churchId) {
    return res.status(403).json({ error: 'Usuário sem igreja associada' });
  }
  req.churchId = req.user.churchId;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permissão insuficiente' });
    }
    next();
  };
}

app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/debug/routes', (req, res) => {
  const routes = [];
  app.router.stack.forEach(layer => {
    if (layer.route) {
      routes.push({ path: layer.route.path, methods: Object.keys(layer.route.methods) });
    } else if (layer.name === 'router' && layer.handle.stack) {
      layer.handle.stack.forEach(l => {
        if (l.route) {
          routes.push({ path: l.route.path, methods: Object.keys(l.route.methods) });
        }
      });
    }
  });
  res.json({ routes });
});

app.post('/auth/login', (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    churchSlug: z.string().min(1)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
  }

  const { email, password, churchSlug } = parsed.data;
  const churchId = getChurchIdFromSlug(churchSlug);
  if (!churchId) {
    return res.status(404).json({ error: 'Igreja não encontrada' });
  }

  const user = db.prepare('SELECT * FROM users WHERE church_id = ? AND email = ? AND active = 1').get(churchId, email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  const token = jwt.sign(
    { userId: user.id, churchId: user.church_id, role: user.role, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, churchId: user.church_id }
  });
});

app.post('/auth/register', (req, res) => {
  const schema = z.object({
    churchName: z.string().min(2),
    churchSlug: z.string().min(2).regex(/^[a-z0-9-]+$/),
    churchEmail: z.string().email(),
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    phone: z.string().optional()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
  }

  const { churchName, churchSlug, churchEmail, name, email, password, phone } = parsed.data;

  const existingChurch = db.prepare('SELECT id FROM churches WHERE slug = ? OR email = ?').get(churchSlug, churchEmail);
  if (existingChurch) {
    return res.status(409).json({ error: 'Igreja já existe com esse slug ou email' });
  }

  const churchResult = db.prepare('INSERT INTO churches (name, slug, email, phone) VALUES (?, ?, ?, ?)').run(
    churchName, churchSlug, churchEmail, phone || null
  );
  const churchId = churchResult.lastInsertRowid;

  const passwordHash = bcrypt.hashSync(password, 10);
  const userResult = db.prepare('INSERT INTO users (church_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(
    churchId, name, email, passwordHash, 'pastor'
  );
  const userId = userResult.lastInsertRowid;

  const token = jwt.sign(
    { userId, churchId, role: 'pastor', name, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );

  res.status(201).json({
    token,
    user: { id: userId, name, email, role: 'pastor', churchId }
  });
});

app.get('/auth/me', requireAuth, requireChurch, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, avatar_url, created_at FROM users WHERE id = ?').get(req.user.userId);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({ user });
});

// ===== MEMBERS =====
app.get('/members', requireAuth, requireChurch, (req, res) => {
  const { status, search, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT * FROM members WHERE church_id = ?';
  const params = [req.churchId];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (search) { sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  sql += ' ORDER BY name LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  const members = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as c FROM members WHERE church_id = ?' + (status ? ' AND status = ?' : '')).get(...params.slice(0, -2));
  res.json({ members, total: total.c });
});

app.get('/members/:id', requireAuth, requireChurch, (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ? AND church_id = ?').get(req.params.id, req.churchId);
  if (!member) return res.status(404).json({ error: 'Membro não encontrado' });
  res.json({ member });
});

app.post('/members', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    birth_date: z.string().optional(),
    baptism_date: z.string().optional(),
    status: z.enum(['Ativo', 'Inativo', 'Visitante', 'Transferido']).default('Ativo'),
    role: z.enum(['Membro', 'Líder', 'Diácono', 'Presbítero', 'Pastor']).default('Membro'),
    address: z.string().optional(),
    notes: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
  const data = parsed.data;
  const result = db.prepare(`
    INSERT INTO members (church_id, name, phone, email, birth_date, baptism_date, status, role, address, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.churchId, data.name, data.phone || null, data.email || null, data.birth_date || null, data.baptism_date || null, data.status, data.role, data.address || null, data.notes || null, req.user.userId);
  res.status(201).json({ id: result.lastInsertRowid, ...data });
});

app.put('/members/:id', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ? AND church_id = ?').get(req.params.id, req.churchId);
  if (!member) return res.status(404).json({ error: 'Membro não encontrado' });
  const schema = z.object({
    name: z.string().min(2).optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    birth_date: z.string().optional(),
    baptism_date: z.string().optional(),
    status: z.enum(['Ativo', 'Inativo', 'Visitante', 'Transferido']).optional(),
    role: z.enum(['Membro', 'Líder', 'Diácono', 'Presbítero', 'Pastor']).optional(),
    address: z.string().optional(),
    notes: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
  const data = parsed.data;
  const fields = [], values = [];
  for (const [k, v] of Object.entries(data)) { if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); } }
  if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  values.push(req.params.id, req.churchId);
  db.prepare(`UPDATE members SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND church_id = ?`).run(...values);
  res.json({ id: req.params.id, ...member, ...data });
});

app.delete('/members/:id', requireAuth, requireChurch, requireRole('pastor'), (req, res) => {
  const result = db.prepare('DELETE FROM members WHERE id = ? AND church_id = ?').run(req.params.id, req.churchId);
  if (result.changes === 0) return res.status(404).json({ error: 'Membro não encontrado' });
  res.json({ success: true });
});

// ===== TITHES =====
app.get('/tithes', requireAuth, requireChurch, (req, res) => {
  const { type, member_id, start_date, end_date, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT t.*, m.name as member_name FROM tithes t LEFT JOIN members m ON t.member_id = m.id WHERE t.church_id = ?';
  const params = [req.churchId];
  if (type) { sql += ' AND t.type = ?'; params.push(type); }
  if (member_id) { sql += ' AND t.member_id = ?'; params.push(member_id); }
  if (start_date) { sql += ' AND t.date >= ?'; params.push(start_date); }
  if (end_date) { sql += ' AND t.date <= ?'; params.push(end_date); }
  sql += ' ORDER BY t.date DESC, t.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  const tithes = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as c FROM tithes WHERE church_id = ?').get(req.churchId);
  const summary = db.prepare('SELECT type, SUM(amount) as total, COUNT(*) as count FROM tithes WHERE church_id = ? GROUP BY type').all(req.churchId);
  res.json({ tithes, total: total.c, summary });
});

app.get('/tithes/:id', requireAuth, requireChurch, (req, res) => {
  const tithe = db.prepare('SELECT t.*, m.name as member_name FROM tithes t LEFT JOIN members m ON t.member_id = m.id WHERE t.id = ? AND t.church_id = ?').get(req.params.id, req.churchId);
  if (!tithe) return res.status(404).json({ error: 'Registro não encontrado' });
  res.json({ tithe });
});

app.post('/tithes', requireAuth, requireChurch, requireRole('pastor', 'secretario', 'tesoureiro'), (req, res) => {
  const schema = z.object({
    member_id: z.number().int().optional().nullable(),
    name: z.string().min(2),
    amount: z.number().positive(),
    type: z.enum(['Dízimo', 'Oferta', 'Missões', 'Construção', 'Outros']),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    payment_method: z.enum(['Dinheiro', 'PIX', 'Cartão', 'Transferência', 'Outros']).default('Dinheiro'),
    notes: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
  const data = parsed.data;
  const result = db.prepare(`
    INSERT INTO tithes (church_id, member_id, name, amount, type, date, payment_method, notes, recorded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.churchId, data.member_id || null, data.name, data.amount, data.type, data.date, data.payment_method, data.notes || null, req.user.userId);
  res.status(201).json({ id: result.lastInsertRowid, ...data });
});

app.put('/tithes/:id', requireAuth, requireChurch, requireRole('pastor', 'secretario', 'tesoureiro'), (req, res) => {
  const tithe = db.prepare('SELECT * FROM tithes WHERE id = ? AND church_id = ?').get(req.params.id, req.churchId);
  if (!tithe) return res.status(404).json({ error: 'Registro não encontrado' });
  const schema = z.object({
    member_id: z.number().int().optional().nullable(),
    name: z.string().min(2).optional(),
    amount: z.number().positive().optional(),
    type: z.enum(['Dízimo', 'Oferta', 'Missões', 'Construção', 'Outros']).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    payment_method: z.enum(['Dinheiro', 'PIX', 'Cartão', 'Transferência', 'Outros']).optional(),
    notes: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
  const data = parsed.data;
  const fields = [], values = [];
  for (const [k, v] of Object.entries(data)) { if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); } }
  if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  values.push(req.params.id, req.churchId);
  db.prepare(`UPDATE tithes SET ${fields.join(', ')} WHERE id = ? AND church_id = ?`).run(...values);
  res.json({ id: req.params.id, ...tithe, ...data });
});

app.delete('/tithes/:id', requireAuth, requireChurch, requireRole('pastor', 'tesoureiro'), (req, res) => {
  const result = db.prepare('DELETE FROM tithes WHERE id = ? AND church_id = ?').run(req.params.id, req.churchId);
  if (result.changes === 0) return res.status(404).json({ error: 'Registro não encontrado' });
  res.json({ success: true });
});

// ===== EVENTS =====
app.get('/events', requireAuth, requireChurch, (req, res) => {
  const { type, start_date, end_date, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT e.*, u.name as created_by_name FROM events e LEFT JOIN users u ON e.created_by = u.id WHERE e.church_id = ?';
  const params = [req.churchId];
  if (type) { sql += ' AND e.type = ?'; params.push(type); }
  if (start_date) { sql += ' AND e.start_date >= ?'; params.push(start_date); }
  if (end_date) { sql += ' AND e.start_date <= ?'; params.push(end_date); }
  sql += ' ORDER BY e.start_date ASC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  const events = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as c FROM events WHERE church_id = ?').get(req.churchId);
  res.json({ events, total: total.c });
});

app.get('/events/:id', requireAuth, requireChurch, (req, res) => {
  const event = db.prepare('SELECT e.*, u.name as created_by_name FROM events e LEFT JOIN users u ON e.created_by = u.id WHERE e.id = ? AND e.church_id = ?').get(req.params.id, req.churchId);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado' });
  const attendees = db.prepare('SELECT ea.*, m.name, m.phone FROM event_attendees ea JOIN members m ON ea.member_id = m.id WHERE ea.event_id = ?').all(req.params.id);
  res.json({ event, attendees });
});

app.post('/events', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
  const schema = z.object({
    title: z.string().min(2),
    description: z.string().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/).optional(),
    location: z.string().optional(),
    type: z.enum(['Culto', 'Estudo', 'Evento', 'Reunião', 'Conferência', 'Outros']).default('Culto'),
    max_attendees: z.number().int().positive().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
  const data = parsed.data;
  const result = db.prepare(`
    INSERT INTO events (church_id, title, description, start_date, end_date, location, type, max_attendees, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.churchId, data.title, data.description || null, data.start_date, data.end_date || null, data.location || null, data.type, data.max_attendees || null, req.user.userId);
  res.status(201).json({ id: result.lastInsertRowid, ...data });
});

app.put('/events/:id', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ? AND church_id = ?').get(req.params.id, req.churchId);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado' });
  const schema = z.object({
    title: z.string().min(2).optional(),
    description: z.string().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/).optional(),
    location: z.string().optional(),
    type: z.enum(['Culto', 'Estudo', 'Evento', 'Reunião', 'Conferência', 'Outros']).optional(),
    max_attendees: z.number().int().positive().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
  const data = parsed.data;
  const fields = [], values = [];
  for (const [k, v] of Object.entries(data)) { if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); } }
  if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  values.push(req.params.id, req.churchId);
  db.prepare(`UPDATE events SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND church_id = ?`).run(...values);
  res.json({ id: req.params.id, ...event, ...data });
});

app.delete('/events/:id', requireAuth, requireChurch, requireRole('pastor'), (req, res) => {
  const result = db.prepare('DELETE FROM events WHERE id = ? AND church_id = ?').run(req.params.id, req.churchId);
  if (result.changes === 0) return res.status(404).json({ error: 'Evento não encontrado' });
  res.json({ success: true });
});

// ===== SONGS =====
app.get('/songs', requireAuth, requireChurch, (req, res) => {
  const { category, search, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT * FROM songs WHERE church_id = ?';
  const params = [req.churchId];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (search) { sql += ' AND (title LIKE ? OR author LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY title LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  const songs = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as c FROM songs WHERE church_id = ?').get(req.churchId);
  res.json({ songs, total: total.c });
});

app.get('/songs/:id', requireAuth, requireChurch, (req, res) => {
  const song = db.prepare('SELECT * FROM songs WHERE id = ? AND church_id = ?').get(req.params.id, req.churchId);
  if (!song) return res.status(404).json({ error: 'Música não encontrada' });
  res.json({ song });
});

app.post('/songs', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
  const schema = z.object({
    title: z.string().min(2),
    author: z.string().optional(),
    category: z.enum(['Louvor', 'Adoração', 'Celebração', 'Outros']).default('Louvor'),
    key_signature: z.string().optional(),
    lyrics: z.string().optional(),
    chords: z.string().optional(),
    bpm: z.number().int().positive().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
  const data = parsed.data;
  const result = db.prepare(`
    INSERT INTO songs (church_id, title, author, category, key_signature, lyrics, chords, bpm, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.churchId, data.title, data.author || null, data.category, data.key_signature || null, data.lyrics || null, data.chords || null, data.bpm || null, req.user.userId);
  res.status(201).json({ id: result.lastInsertRowid, ...data });
});

app.put('/songs/:id', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
  const song = db.prepare('SELECT * FROM songs WHERE id = ? AND church_id = ?').get(req.params.id, req.churchId);
  if (!song) return res.status(404).json({ error: 'Música não encontrada' });
  const schema = z.object({
    title: z.string().min(2).optional(),
    author: z.string().optional(),
    category: z.enum(['Louvor', 'Adoração', 'Celebração', 'Outros']).optional(),
    key_signature: z.string().optional(),
    lyrics: z.string().optional(),
    chords: z.string().optional(),
    bpm: z.number().int().positive().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
  const data = parsed.data;
  const fields = [], values = [];
  for (const [k, v] of Object.entries(data)) { if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); } }
  if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  values.push(req.params.id, req.churchId);
  db.prepare(`UPDATE songs SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND church_id = ?`).run(...values);
  res.json({ id: req.params.id, ...song, ...data });
});

app.delete('/songs/:id', requireAuth, requireChurch, requireRole('pastor'), (req, res) => {
  const result = db.prepare('DELETE FROM songs WHERE id = ? AND church_id = ?').run(req.params.id, req.churchId);
  if (result.changes === 0) return res.status(404).json({ error: 'Música não encontrada' });
  res.json({ success: true });
});

// ===== ANNOUNCEMENTS =====
app.get('/announcements', requireAuth, requireChurch, (req, res) => {
  const { priority, target_audience, published_only = 'true', limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT a.*, u.name as created_by_name FROM announcements a LEFT JOIN users u ON a.created_by = u.id WHERE a.church_id = ?';
  const params = [req.churchId];
  if (priority) { sql += ' AND a.priority = ?'; params.push(priority); }
  if (target_audience) { sql += ' AND a.target_audience = ?'; params.push(target_audience); }
  if (published_only === 'true') { sql += ' AND a.published_at IS NOT NULL AND a.published_at <= datetime(\'now\')'; }
  sql += ' ORDER BY a.priority DESC, a.published_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  const announcements = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as c FROM announcements WHERE church_id = ?').get(req.churchId);
  res.json({ announcements, total: total.c });
});

app.get('/announcements/:id', requireAuth, requireChurch, (req, res) => {
  const announcement = db.prepare('SELECT a.*, u.name as created_by_name FROM announcements a LEFT JOIN users u ON a.created_by = u.id WHERE a.id = ? AND a.church_id = ?').get(req.params.id, req.churchId);
  if (!announcement) return res.status(404).json({ error: 'Comunicado não encontrado' });
  res.json({ announcement });
});

app.post('/announcements', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
  const schema = z.object({
    title: z.string().min(2),
    content: z.string().min(10),
    priority: z.enum(['baixa', 'normal', 'alta', 'urgente']).default('normal'),
    target_audience: z.enum(['todos', 'membros', 'lideres', 'pastores']).default('todos'),
    published_at: z.string().optional(),
    expires_at: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
  const data = parsed.data;
  const result = db.prepare(`
    INSERT INTO announcements (church_id, title, content, priority, target_audience, published_at, expires_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.churchId, data.title, data.content, data.priority, data.target_audience, data.published_at || null, data.expires_at || null, req.user.userId);
  res.status(201).json({ id: result.lastInsertRowid, ...data });
});

app.put('/announcements/:id', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
  const announcement = db.prepare('SELECT * FROM announcements WHERE id = ? AND church_id = ?').get(req.params.id, req.churchId);
  if (!announcement) return res.status(404).json({ error: 'Comunicado não encontrado' });
  const schema = z.object({
    title: z.string().min(2).optional(),
    content: z.string().min(10).optional(),
    priority: z.enum(['baixa', 'normal', 'alta', 'urgente']).optional(),
    target_audience: z.enum(['todos', 'membros', 'lideres', 'pastores']).optional(),
    published_at: z.string().optional(),
    expires_at: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
  const data = parsed.data;
  const fields = [], values = [];
  for (const [k, v] of Object.entries(data)) { if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); } }
  if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  values.push(req.params.id, req.churchId);
  db.prepare(`UPDATE announcements SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND church_id = ?`).run(...values);
  res.json({ id: req.params.id, ...announcement, ...data });
});

app.delete('/announcements/:id', requireAuth, requireChurch, requireRole('pastor'), (req, res) => {
  const result = db.prepare('DELETE FROM announcements WHERE id = ? AND church_id = ?').run(req.params.id, req.churchId);
  if (result.changes === 0) return res.status(404).json({ error: 'Comunicado não encontrado' });
  res.json({ success: true });
});

// ===== LITURGIES =====
app.get('/liturgies', requireAuth, requireChurch, (req, res) => {
  const { date, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT l.*, u.name as created_by_name FROM liturgies l LEFT JOIN users u ON l.created_by = u.id WHERE l.church_id = ?';
  const params = [req.churchId];
  if (date) { sql += ' AND l.date = ?'; params.push(date); }
  sql += ' ORDER BY l.date DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  const liturgies = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as c FROM liturgies WHERE church_id = ?').get(req.churchId);
  res.json({ liturgies, total: total.c });
});

app.get('/liturgies/:id', requireAuth, requireChurch, (req, res) => {
  const liturgy = db.prepare('SELECT l.*, u.name as created_by_name FROM liturgies l LEFT JOIN users u ON l.created_by = u.id WHERE l.id = ? AND l.church_id = ?').get(req.params.id, req.churchId);
  if (!liturgy) return res.status(404).json({ error: 'Liturgia não encontrada' });
  try { liturgy.order = JSON.parse(liturgy.order_json); } catch { liturgy.order = []; }
  res.json({ liturgy });
});

app.post('/liturgies', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
  const schema = z.object({
    title: z.string().min(2),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    order: z.array(z.object({ type: z.string(), title: z.string(), details: z.string().optional(), duration: z.number().optional() })),
    notes: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
  const data = parsed.data;
  const result = db.prepare(`
    INSERT INTO liturgies (church_id, title, date, order_json, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.churchId, data.title, data.date, JSON.stringify(data.order), data.notes || null, req.user.userId);
  res.status(201).json({ id: result.lastInsertRowid, ...data, order_json: JSON.stringify(data.order) });
});

app.put('/liturgies/:id', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
  const liturgy = db.prepare('SELECT * FROM liturgies WHERE id = ? AND church_id = ?').get(req.params.id, req.churchId);
  if (!liturgy) return res.status(404).json({ error: 'Liturgia não encontrada' });
  const schema = z.object({
    title: z.string().min(2).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    order: z.array(z.object({ type: z.string(), title: z.string(), details: z.string().optional(), duration: z.number().optional() })).optional(),
    notes: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
  const data = parsed.data;
  const fields = [], values = [];
  for (const [k, v] of Object.entries(data)) { 
    if (v !== undefined) { 
      fields.push(k === 'order' ? 'order_json = ?' : `${k} = ?`); 
      values.push(k === 'order' ? JSON.stringify(v) : v); 
    } 
  }
  if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  values.push(req.params.id, req.churchId);
  db.prepare(`UPDATE liturgies SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND church_id = ?`).run(...values);
  res.json({ id: req.params.id, ...liturgy, ...data });
});

app.delete('/liturgies/:id', requireAuth, requireChurch, requireRole('pastor'), (req, res) => {
  const result = db.prepare('DELETE FROM liturgies WHERE id = ? AND church_id = ?').run(req.params.id, req.churchId);
  if (result.changes === 0) return res.status(404).json({ error: 'Liturgia não encontrada' });
  res.json({ success: true });
});

// ===== USERS (church members with login) =====
app.get('/users', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
  const { role, active, limit = 50, offset = 0 } = req.query;
  let sql = 'SELECT id, name, email, role, avatar_url, active, last_login, created_at FROM users WHERE church_id = ?';
  const params = [req.churchId];
  if (role) { sql += ' AND role = ?'; params.push(role); }
  if (active !== undefined) { sql += ' AND active = ?'; params.push(active === 'true' ? 1 : 0); }
  sql += ' ORDER BY name LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  const users = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as c FROM users WHERE church_id = ?').get(req.churchId);
  res.json({ users, total: total.c });
});

app.post('/users', requireAuth, requireChurch, requireRole('pastor'), (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['pastor', 'secretario', 'tesoureiro', 'membro']).default('membro')
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
  const data = parsed.data;
  const existing = db.prepare('SELECT id FROM users WHERE church_id = ? AND email = ?').get(req.churchId, data.email);
  if (existing) return res.status(409).json({ error: 'Email já cadastrado nesta igreja' });
  const passwordHash = bcrypt.hashSync(data.password, 10);
  const result = db.prepare('INSERT INTO users (church_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
    .run(req.churchId, data.name, data.email, passwordHash, data.role);
  res.status(201).json({ id: result.lastInsertRowid, name: data.name, email: data.email, role: data.role });
});

app.put('/users/:id', requireAuth, requireChurch, requireRole('pastor'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND church_id = ?').get(req.params.id, req.churchId);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (user.id === req.user.userId) return res.status(400).json({ error: 'Não pode editar a si mesmo' });
  const schema = z.object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    role: z.enum(['pastor', 'secretario', 'tesoureiro', 'membro']).optional(),
    active: z.boolean().optional(),
    password: z.string().min(6).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
  const data = parsed.data;
  const fields = [], values = [];
  for (const [k, v] of Object.entries(data)) { 
    if (v !== undefined) { 
      fields.push(k === 'password' ? 'password_hash = ?' : `${k} = ?`); 
      values.push(k === 'password' ? bcrypt.hashSync(v, 10) : v); 
    } 
  }
  if (fields.length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  values.push(req.params.id, req.churchId);
  db.prepare(`UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND church_id = ?`).run(...values);
  res.json({ id: req.params.id, ...user, ...data });
});

app.delete('/users/:id', requireAuth, requireChurch, requireRole('pastor'), (req, res) => {
  if (Number(req.params.id) === req.user.userId) return res.status(400).json({ error: 'Não pode excluir a si mesmo' });
  const result = db.prepare('DELETE FROM users WHERE id = ? AND church_id = ?').run(req.params.id, req.churchId);
  if (result.changes === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({ success: true });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Backend rodando em http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Debug routes: http://localhost:${PORT}/debug/routes`);
});

server.on('error', (err) => {
  console.error('[ERROR] Server error:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[ERROR] Uncaught Exception:', err);
});