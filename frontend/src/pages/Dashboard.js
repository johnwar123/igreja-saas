// Componente Dashboard
import { api } from '../api.js';
import { auth } from '../auth.js';

export async function DashboardPage() {
  // Verifica autenticação
  if (!auth.isAuthenticated()) {
    window.router.navigate('/');
    return '';
  }

  // Carrega dados do dashboard
  let stats = { members: 0, tithes: 0, events: 0, songs: 0, announcements: 0 };
  try {
    const [members, tithes, events, songs, announcements] = await Promise.all([
      api.getMembers({ limit: 1 }),
      api.getTithes({ limit: 1 }),
      api.getEvents({ limit: 1 }),
      api.getSongs({ limit: 1 }),
      api.getAnnouncements({ limit: 1 })
    ]);
    stats = {
      members: members.total || 0,
      tithes: tithes.summary?.reduce((sum, s) => sum + (s.total || 0), 0) || 0,
      events: events.total || 0,
      songs: songs.total || 0,
      announcements: announcements.total || 0
    };
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
  }

  const user = auth.getUser();

  return `
    <header class="header">
      <h1>✝️ Igreja SaaS</h1>
      <div class="header-right">
        <span class="user-info">👋 ${user?.name || 'Usuário'} (${user?.role || 'membro'})</span>
        <button id="logout-btn" class="btn-logout">Sair</button>
      </div>
    </header>

    <main class="main">
      <div class="welcome">
        <h2>Dashboard</h2>
        <p>Bem-vindo, ${user?.name || 'Usuário'}! Hoje é um ótimo dia para servir.</p>
      </div>

      <section class="stats-grid">
        <article class="stat-card" data-link href="/members">
          <div class="stat-icon">👥</div>
          <div class="stat-info">
            <span class="stat-value">${stats.members}</span>
            <span class="stat-label">Membros</span>
          </div>
        </article>

        <article class="stat-card" data-link href="/tithes">
          <div class="stat-icon">💰</div>
          <div class="stat-info">
            <span class="stat-value">R$ ${Number(stats.tithes).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <span class="stat-label">Total Dízimos/Ofertas</span>
          </div>
        </article>

        <article class="stat-card" data-link href="/events">
          <div class="stat-icon">📅</div>
          <div class="stat-info">
            <span class="stat-value">${stats.events}</span>
            <span class="stat-label">Eventos</span>
          </div>
        </article>

        <article class="stat-card" data-link href="/songs">
          <div class="stat-icon">🎵</div>
          <div class="stat-info">
            <span class="stat-value">${stats.songs}</span>
            <span class="stat-label">Músicas</span>
          </div>
        </article>

        <article class="stat-card" data-link href="/announcements">
          <div class="stat-icon">📢</div>
          <div class="stat-info">
            <span class="stat-value">${stats.announcements}</span>
            <span class="stat-label">Comunicados</span>
          </div>
        </article>

        <article class="stat-card" data-link href="/liturgies">
          <div class="stat-icon">📖</div>
          <div class="stat-info">
            <span class="stat-value">—</span>
            <span class="stat-label">Liturgias</span>
          </div>
        </article>
      </section>

      <section class="quick-actions">
        <h3>Ações Rápidas</h3>
        <div class="action-buttons">
          <a data-link href="/members" class="action-btn">
            <span>➕</span> Novo Membro
          </a>
          <a data-link href="/tithes" class="action-btn">
            <span>💰</span> Registrar Dízimo
          </a>
          <a data-link href="/events" class="action-btn">
            <span>📅</span> Novo Evento
          </a>
          <a data-link href="/songs" class="action-btn">
            <span>🎵</span> Nova Música
          </a>
          <a data-link href="/announcements" class="action-btn">
            <span>📢</span> Novo Comunicado
          </a>
          ${auth.hasRole('pastor', 'secretario') ? `
          <a data-link href="/users" class="action-btn">
            <span>👤</span> Gerenciar Usuários
          </a>
          ` : ''}
        </div>
      </section>
    </main>

    <script>
      document.getElementById('logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.dispatchEvent(new CustomEvent('auth:logout'));
        window.router.navigate('/');
      });
    </script>
  `;
}