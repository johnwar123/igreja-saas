import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../../data/igreja.db');
const db = new Database(dbPath);

const passwordHash = bcrypt.hashSync('igreja123', 10);

const church = db.prepare(`
  INSERT OR IGNORE INTO churches (name, slug, email, phone, address)
  VALUES (?, ?, ?, ?, ?)
`).run('Igreja Fácil Demo', 'igreja-facil-demo', 'contato@igrejafacil.demo', '(11) 99999-9999', 'Rua das Flores, 123 - Centro');

const churchId = church.lastInsertRowid || db.prepare('SELECT id FROM churches WHERE slug = ?').get('igreja-facil-demo').id;

const user = db.prepare(`
  INSERT OR IGNORE INTO users (church_id, name, email, password_hash, role)
  VALUES (?, ?, ?, ?, ?)
`).run(churchId, 'Pastor João', 'pastor@igrejafacil.demo', passwordHash, 'pastor');

const userId = user.lastInsertRowid || db.prepare('SELECT id FROM users WHERE email = ?').get('pastor@igrejafacil.demo').id;

const members = [
  { name: 'Maria Silva', phone: '(11) 98888-1111', email: 'maria@email.com', status: 'Ativo', role: 'Membro' },
  { name: 'José Santos', phone: '(11) 97777-2222', email: 'jose@email.com', status: 'Ativo', role: 'Líder' },
  { name: 'Ana Costa', phone: '(11) 96666-3333', email: 'ana@email.com', status: 'Visitante', role: 'Membro' },
  { name: 'Pedro Oliveira', phone: '(11) 95555-4444', email: 'pedro@email.com', status: 'Ativo', role: 'Diácono' },
];

const insertMember = db.prepare(`
  INSERT OR IGNORE INTO members (church_id, name, phone, email, status, role, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
for (const m of members) {
  insertMember.run(churchId, m.name, m.phone, m.email, m.status, m.role, userId);
}

const tithes = [
  { member_id: 1, name: 'Maria Silva', amount: 150.00, type: 'Dízimo', date: '2024-01-15', payment_method: 'PIX' },
  { member_id: 2, name: 'José Santos', amount: 200.00, type: 'Oferta', date: '2024-01-20', payment_method: 'Dinheiro' },
  { member_id: 3, name: 'Ana Costa', amount: 50.00, type: 'Missões', date: '2024-02-05', payment_method: 'Transferência' },
  { member_id: 4, name: 'Pedro Oliveira', amount: 300.00, type: 'Dízimo', date: '2024-02-10', payment_method: 'Cartão' },
];

const insertTithe = db.prepare(`
  INSERT OR IGNORE INTO tithes (church_id, member_id, name, amount, type, date, payment_method, recorded_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const t of tithes) {
  insertTithe.run(churchId, t.member_id, t.name, t.amount, t.type, t.date, t.payment_method, userId);
}

const events = [
  { title: 'Culto de Domingo', description: 'Culto matinal às 10h', start_date: '2024-02-18 10:00:00', end_date: '2024-02-18 12:00:00', location: 'Templo Principal', type: 'Culto' },
  { title: 'Estudo Bíblico', description: 'Estudo de Quarta-feira', start_date: '2024-02-21 19:30:00', end_date: '2024-02-21 21:00:00', location: 'Salão Social', type: 'Estudo' },
  { title: 'Conferência de Jovens', description: 'Fim de semana de conferência', start_date: '2024-03-15 18:00:00', end_date: '2024-03-17 20:00:00', location: 'Auditório', type: 'Conferência' },
];

const insertEvent = db.prepare(`
  INSERT OR IGNORE INTO events (church_id, title, description, start_date, end_date, location, type, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const e of events) {
  insertEvent.run(churchId, e.title, e.description, e.start_date, e.end_date, e.location, e.type, userId);
}

const songs = [
  { title: 'Grande é o Senhor', author: 'Marcus Salles', category: 'Louvor', key_signature: 'D', bpm: 120 },
  { title: 'Oceano', author: 'Ana Paula Valadão', category: 'Adoração', key_signature: 'G', bpm: 72 },
  { title: 'Te Louvarei', author: 'Fernandinho', category: 'Celebração', key_signature: 'A', bpm: 100 },
];

const insertSong = db.prepare(`
  INSERT OR IGNORE INTO songs (church_id, title, author, category, key_signature, bpm, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
for (const s of songs) {
  insertSong.run(churchId, s.title, s.author, s.category, s.key_signature, s.bpm, userId);
}

const announcements = [
  { title: 'Batismo no próximo domingo', content: 'Haverá batismo no culto das 10h. Interessados procurar a secretaria.', priority: 'alta', target_audience: 'todos', published_at: new Date().toISOString() },
  { title: 'Reunião de líderes', content: 'Reunião mensal de líderes sábado às 8h.', priority: 'normal', target_audience: 'lideres', published_at: new Date().toISOString() },
];

const insertAnn = db.prepare(`
  INSERT OR IGNORE INTO announcements (church_id, title, content, priority, target_audience, published_at, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
for (const a of announcements) {
  insertAnn.run(churchId, a.title, a.content, a.priority, a.target_audience, a.published_at, userId);
}

console.log('✅ Seed concluído!');
console.log('Church ID:', churchId);
console.log('User ID:', userId);
console.log('Login: pastor@igrejafacil.demo / igreja123');

db.close();