import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../../data/igreja.db');
const db = new Database(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS churches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    address TEXT,
    logo_url TEXT,
    settings TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    church_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('pastor', 'secretario', 'tesoureiro', 'membro')),
    avatar_url TEXT,
    active INTEGER DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
    UNIQUE (church_id, email)
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    church_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    birth_date DATE,
    baptism_date DATE,
    status TEXT DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo', 'Visitante', 'Transferido')),
    role TEXT DEFAULT 'Membro' CHECK (role IN ('Membro', 'Líder', 'Diácono', 'Presbítero', 'Pastor')),
    address TEXT,
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tithes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    church_id INTEGER NOT NULL,
    member_id INTEGER,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Dízimo', 'Oferta', 'Missões', 'Construção', 'Outros')),
    date DATE NOT NULL,
    payment_method TEXT DEFAULT 'Dinheiro' CHECK (payment_method IN ('Dinheiro', 'PIX', 'Cartão', 'Transferência', 'Outros')),
    notes TEXT,
    recorded_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL,
    FOREIGN KEY (recorded_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    church_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_date DATETIME NOT NULL,
    end_date DATETIME,
    location TEXT,
    type TEXT DEFAULT 'Culto' CHECK (type IN ('Culto', 'Estudo', 'Evento', 'Reunião', 'Conferência', 'Outros')),
    max_attendees INTEGER,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS event_attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    status TEXT DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'pendente', 'recusado')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    UNIQUE (event_id, member_id)
  );

  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    church_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    author TEXT,
    category TEXT DEFAULT 'Louvor' CHECK (category IN ('Louvor', 'Adoração', 'Celebração', 'Outros')),
    key_signature TEXT,
    lyrics TEXT,
    chords TEXT,
    bpm INTEGER,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS setlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    church_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    event_id INTEGER,
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS setlist_songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setlist_id INTEGER NOT NULL,
    song_id INTEGER NOT NULL,
    order_index INTEGER NOT NULL,
    notes TEXT,
    FOREIGN KEY (setlist_id) REFERENCES setlists(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    church_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('baixa', 'normal', 'alta', 'urgente')),
    target_audience TEXT DEFAULT 'todos' CHECK (target_audience IN ('todos', 'membros', 'lideres', 'pastores')),
    published_at DATETIME,
    expires_at DATETIME,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS liturgies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    church_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    order_json TEXT NOT NULL,
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (church_id) REFERENCES churches(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_users_church_email ON users(church_id, email);
  CREATE INDEX IF NOT EXISTS idx_members_church_status ON members(church_id, status);
  CREATE INDEX IF NOT EXISTS idx_tithes_church_date ON tithes(church_id, date);
  CREATE INDEX IF NOT EXISTS idx_events_church_date ON events(church_id, start_date);
  CREATE INDEX IF NOT EXISTS idx_songs_church_category ON songs(church_id, category);
  CREATE INDEX IF NOT EXISTS idx_announcements_church_published ON announcements(church_id, published_at);
`);

console.log('✅ Banco de dados inicializado em:', dbPath);
db.close();