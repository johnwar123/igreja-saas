import { z } from 'zod';

const setlistSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  event_id: z.number().int().positive().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const setlistSongSchema = z.object({
  song_id: z.number().int().positive(),
  order_index: z.number().int().min(0),
  notes: z.string().nullable().optional(),
});

const reorderSchema = z.object({
  songs: z.array(z.object({
    id: z.number().int().positive(),
    order_index: z.number().int().min(0),
  })).min(1),
});

export default function setlistsRoutes(app, db, requireAuth, requireChurch, requireRole) {
  // GET /setlists - Listar setlists
  app.get('/setlists', requireAuth, requireChurch, (req, res) => {
    const { event_id, limit = 50, offset = 0 } = req.query;
    let sql = 'SELECT s.*, e.title as event_title FROM setlists s LEFT JOIN events e ON s.event_id = e.id WHERE s.church_id = ?';
    const params = [req.churchId];
    if (event_id) {
      sql += ' AND s.event_id = ?';
      params.push(event_id);
    }
    sql += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    const setlists = db.prepare(sql).all(...params);
    res.json({ setlists });
  });

  // GET /setlists/:id - Obter setlist com músicas
  app.get('/setlists/:id', requireAuth, requireChurch, (req, res) => {
    const setlist = db.prepare('SELECT * FROM setlists WHERE id = ? AND church_id = ?').get(req.params.id, req.churchId);
    if (!setlist) return res.status(404).json({ error: 'Setlist não encontrada' });

    const songs = db.prepare(`
      SELECT ss.*, s.title, s.key_signature, s.bpm, s.category
      FROM setlist_songs ss
      JOIN songs s ON ss.song_id = s.id
      WHERE ss.setlist_id = ?
      ORDER BY ss.order_index
    `).all(req.params.id);

    res.json({ setlist, songs });
  });

  // POST /setlists - Criar setlist
  app.post('/setlists', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
    const parsed = setlistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }
    const { name, event_id, notes } = parsed.data;
    const result = db.prepare(
      'INSERT INTO setlists (church_id, name, event_id, notes, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(req.churchId, name, event_id || null, notes || null, req.user.userId);
    res.status(201).json({ id: result.lastInsertRowid, name, event_id, notes });
  });

  // PUT /setlists/:id - Atualizar setlist
  app.put('/setlists/:id', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
    const parsed = setlistSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }
    const { name, event_id, notes } = parsed.data;
    const result = db.prepare(
      'UPDATE setlists SET name = ?, event_id = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND church_id = ?'
    ).run(name, event_id || null, notes || null, req.params.id, req.churchId);
    if (result.changes === 0) return res.status(404).json({ error: 'Setlist não encontrada' });
    res.json({ success: true });
  });

  // DELETE /setlists/:id - Excluir setlist
  app.delete('/setlists/:id', requireAuth, requireChurch, requireRole('pastor'), (req, res) => {
    const result = db.prepare('DELETE FROM setlists WHERE id = ? AND church_id = ?').run(req.params.id, req.churchId);
    if (result.changes === 0) return res.status(404).json({ error: 'Setlist não encontrada' });
    res.json({ success: true });
  });

  // POST /setlists/:id/songs - Adicionar música à setlist
  app.post('/setlists/:id/songs', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
    const setlist = db.prepare('SELECT id FROM setlists WHERE id = ? AND church_id = ?').get(req.params.id, req.churchId);
    if (!setlist) return res.status(404).json({ error: 'Setlist não encontrada' });

    const parsed = setlistSongSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }
    const { song_id, order_index, notes } = parsed.data;

    const song = db.prepare('SELECT id FROM songs WHERE id = ? AND church_id = ?').get(song_id, req.churchId);
    if (!song) return res.status(404).json({ error: 'Música não encontrada' });

    const result = db.prepare(
      'INSERT INTO setlist_songs (setlist_id, song_id, order_index, notes) VALUES (?, ?, ?, ?)'
    ).run(req.params.id, song_id, order_index, notes || null);
    res.status(201).json({ id: result.lastInsertRowid, setlist_id: req.params.id, song_id, order_index, notes });
  });

  // PUT /setlists/:id/songs/:songId - Atualizar música na setlist
  app.put('/setlists/:id/songs/:songId', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
    const parsed = setlistSongSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }
    const { order_index, notes } = parsed.data;
    const result = db.prepare(
      'UPDATE setlist_songs SET order_index = ?, notes = ? WHERE setlist_id = ? AND song_id = ?'
    ).run(order_index, notes || null, req.params.id, req.params.songId);
    if (result.changes === 0) return res.status(404).json({ error: 'Música não encontrada na setlist' });
    res.json({ success: true });
  });

  // DELETE /setlists/:id/songs/:songId - Remover música da setlist
  app.delete('/setlists/:id/songs/:songId', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
    const result = db.prepare('DELETE FROM setlist_songs WHERE setlist_id = ? AND song_id = ?').run(req.params.id, req.params.songId);
    if (result.changes === 0) return res.status(404).json({ error: 'Música não encontrada na setlist' });
    res.json({ success: true });
  });

  // PUT /setlists/:id/reorder - Reordenar músicas da setlist (bulk)
  app.put('/setlists/:id/reorder', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
    const setlist = db.prepare('SELECT id FROM setlists WHERE id = ? AND church_id = ?').get(req.params.id, req.churchId);
    if (!setlist) return res.status(404).json({ error: 'Setlist não encontrada' });

    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const updateStmt = db.prepare('UPDATE setlist_songs SET order_index = ? WHERE setlist_id = ? AND song_id = ?');
    const transaction = db.transaction((songs) => {
      for (const s of songs) {
        updateStmt.run(s.order_index, req.params.id, s.id);
      }
    });
    transaction(parsed.data.songs);
    res.json({ success: true });
  });
}