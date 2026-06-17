import { z } from 'zod';

const attendeeSchema = z.object({
  member_id: z.number().int().positive(),
  status: z.enum(['confirmado', 'pendente', 'recusado']).default('confirmado'),
});

const bulkAttendeesSchema = z.object({
  attendees: z.array(z.object({
    member_id: z.number().int().positive(),
    status: z.enum(['confirmado', 'pendente', 'recusado']).default('confirmado'),
  })).min(1),
});

const checkinSchema = z.object({
  member_id: z.number().int().positive(),
  status: z.enum(['confirmado', 'pendente', 'recusado']).default('confirmado'),
});

export default function eventAttendeesRoutes(app, db, requireAuth, requireChurch, requireRole) {
  // GET /events/:id/attendees - Listar participantes do evento
  app.get('/events/:id/attendees', requireAuth, requireChurch, (req, res) => {
    const event = db.prepare('SELECT id FROM events WHERE id = ? AND church_id = ?').get(req.params.id, req.churchId);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

    const attendees = db.prepare(`
      SELECT ea.*, m.name, m.phone, m.email
      FROM event_attendees ea
      JOIN members m ON ea.member_id = m.id
      WHERE ea.event_id = ?
      ORDER BY m.name
    `).all(req.params.id);

    res.json({ attendees });
  });

  // POST /events/:id/attendees - Adicionar participante
  app.post('/events/:id/attendees', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
    const event = db.prepare('SELECT id, max_attendees FROM events WHERE id = ? AND church_id = ?').get(req.params.id, req.churchId);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

    const parsed = attendeeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }
    const { member_id, status } = parsed.data;

    const member = db.prepare('SELECT id FROM members WHERE id = ? AND church_id = ?').get(member_id, req.churchId);
    if (!member) return res.status(404).json({ error: 'Membro não encontrado' });

    if (event.max_attendees) {
      const count = db.prepare('SELECT COUNT(*) as c FROM event_attendees WHERE event_id = ?').get(req.params.id).c;
      if (count >= event.max_attendees) {
        return res.status(400).json({ error: 'Evento lotado' });
      }
    }

    try {
      const result = db.prepare(
        'INSERT INTO event_attendees (event_id, member_id, status) VALUES (?, ?, ?)'
      ).run(req.params.id, member_id, status);
      res.status(201).json({ id: result.lastInsertRowid, event_id: req.params.id, member_id, status });
    } catch (e) {
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'Membro já inscrito neste evento' });
      }
      throw e;
    }
  });

  // POST /events/:id/attendees/bulk - Adicionar múltiplos participantes
  app.post('/events/:id/attendees/bulk', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
    const event = db.prepare('SELECT id, max_attendees FROM events WHERE id = ? AND church_id = ?').get(req.params.id, req.churchId);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

    const parsed = bulkAttendeesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }

    const insertStmt = db.prepare('INSERT OR IGNORE INTO event_attendees (event_id, member_id, status) VALUES (?, ?, ?)');
    const transaction = db.transaction((attendees) => {
      for (const a of attendees) {
        const member = db.prepare('SELECT id FROM members WHERE id = ? AND church_id = ?').get(a.member_id, req.churchId);
        if (member) {
          insertStmt.run(req.params.id, a.member_id, a.status);
        }
      }
    });
    transaction(parsed.data.attendees);
    res.json({ success: true, added: parsed.data.attendees.length });
  });

  // PUT /events/:id/attendees/:memberId - Atualizar status do participante
  app.put('/events/:id/attendees/:memberId', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
    const parsed = attendeeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }
    const { status } = parsed.data;

    const result = db.prepare(
      'UPDATE event_attendees SET status = ? WHERE event_id = ? AND member_id = ?'
    ).run(status, req.params.id, req.params.memberId);
    if (result.changes === 0) return res.status(404).json({ error: 'Participante não encontrado' });
    res.json({ success: true });
  });

  // POST /events/:id/checkin - Check-in rápido (pastor/secretario/membro próprio)
  app.post('/events/:id/checkin', requireAuth, requireChurch, (req, res) => {
    const event = db.prepare('SELECT id FROM events WHERE id = ? AND church_id = ?').get(req.params.id, req.churchId);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

    const parsed = checkinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }
    let { member_id, status } = parsed.data;

    // Se for membro, só pode fazer check-in próprio
    if (req.user.role === 'membro') {
      const member = db.prepare('SELECT id FROM members WHERE id = ? AND church_id = ? AND user_id = ?').get(member_id, req.churchId, req.user.userId);
      if (!member) return res.status(403).json({ error: 'Só pode fazer check-in próprio' });
    }

    const existing = db.prepare('SELECT * FROM event_attendees WHERE event_id = ? AND member_id = ?').get(req.params.id, member_id);
    if (existing) {
      db.prepare('UPDATE event_attendees SET status = ? WHERE event_id = ? AND member_id = ?').run(status, req.params.id, member_id);
      return res.json({ success: true, action: 'updated' });
    }

    db.prepare('INSERT INTO event_attendees (event_id, member_id, status) VALUES (?, ?, ?)').run(req.params.id, member_id, status);
    res.status(201).json({ success: true, action: 'created' });
  });

  // DELETE /events/:id/attendees/:memberId - Remover participante
  app.delete('/events/:id/attendees/:memberId', requireAuth, requireChurch, requireRole('pastor', 'secretario'), (req, res) => {
    const result = db.prepare('DELETE FROM event_attendees WHERE event_id = ? AND member_id = ?').run(req.params.id, req.params.memberId);
    if (result.changes === 0) return res.status(404).json({ error: 'Participante não encontrado' });
    res.json({ success: true });
  });

  // GET /events/:id/attendees/stats - Estatísticas do evento
  app.get('/events/:id/attendees/stats', requireAuth, requireChurch, (req, res) => {
    const event = db.prepare('SELECT id, max_attendees FROM events WHERE id = ? AND church_id = ?').get(req.params.id, req.churchId);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'confirmado' THEN 1 ELSE 0 END) as confirmados,
        SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) as pendentes,
        SUM(CASE WHEN status = 'recusado' THEN 1 ELSE 0 END) as recusados
      FROM event_attendees WHERE event_id = ?
    `).get(req.params.id);

    res.json({
      ...stats,
      max_attendees: event.max_attendees,
      vagas: event.max_attendees ? Math.max(0, event.max_attendees - stats.total) : null,
    });
  });
}