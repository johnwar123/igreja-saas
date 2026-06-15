import { createElement, Card, Table, Button, Badge, Spinner, Alert } from '../components.js';
import { api } from '../api.js';
import { getCurrentUser, hasRole } from '../auth.js';

export async function renderDashboardPage(container) {
  container.innerHTML = '';
  
  const user = getCurrentUser();
  
  const loading = createElement('div', { class: 'page-loading' }, Spinner({ size: 'lg' }));
  container.appendChild(loading);
  
  try {
    const [membersRes, tithesRes, eventsRes] = await Promise.all([
      api.members.list({ limit: 5 }),
      api.tithes.list({ limit: 5 }),
      api.events.list({ limit: 5 }),
    ]);
    
    const tithesSummary = await api.tithes.list({ limit: 1 }).then(r => r.summary || []);
    
    container.innerHTML = '';
    
    const stats = [
      { label: 'Membros', value: membersRes.total, icon: '👥', color: '#0f3460' },
      { label: 'Total Dízimos/Ofertas', value: tithesSummary.reduce((sum, s) => sum + (s.total || 0), 0), icon: '💰', color: '#16a34a', format: 'currency' },
      { label: 'Eventos Próximos', value: eventsRes.data?.filter(e => new Date(e.start_date) >= new Date()).length || eventsRes.total, icon: '📅', color: '#ea580c' },
      { label: 'Arrecadação Mês', value: tithesSummary.find(s => s.type === 'Dízimo')?.total || 0, icon: '📈', color: '#7c3aed', format: 'currency' },
    ];
    
    const recentMembers = membersRes.data?.slice(0, 5) || [];
    const recentTithes = tithesRes.data?.slice(0, 5) || [];
    const upcomingEvents = (eventsRes.data || [])
      .filter(e => new Date(e.start_date) >= new Date())
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
      .slice(0, 5);
    
    const content = createElement('div', { class: 'dashboard-page' }, [
      createElement('div', { class: 'page-header' }, [
        createElement('h1', {}, `Dashboard`),
        createElement('p', { class: 'page-subtitle' }, `Bem-vindo, ${user?.name}!`),
      ]),
      
      createElement('div', { class: 'stats-grid' },
        stats.map(stat => createElement('div', { class: 'stat-card' }, [
          createElement('div', { class: 'stat-icon', style: { backgroundColor: stat.color + '20', color: stat.color } }, stat.icon),
          createElement('div', { class: 'stat-content' }, [
            createElement('p', { class: 'stat-label' }, stat.label),
            createElement('h2', { class: 'stat-value' }, 
              stat.format === 'currency' 
                ? `R$ ${Number(stat.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : stat.value
            ),
          ]),
        ]))
      ),
      
      createElement('div', { class: 'dashboard-grid' }, [
        createElement('div', { class: 'dashboard-card' }, [
          createElement('div', { class: 'card-header' }, [
            createElement('h3', {}, 'Membros Recentes'),
            hasRole('pastor', 'secretario') && createElement('a', { href: '#/members', class: 'btn btn-sm btn-secondary' }, 'Ver todos'),
          ]),
          recentMembers.length > 0 ? Table({
            columns: [
              { key: 'name', header: 'Nome' },
              { key: 'status', header: 'Status', render: (row) => Badge({ label: row.status, variant: row.status === 'Ativo' ? 'success' : 'default' }) },
              { key: 'role', header: 'Cargo' },
            ],
            data: recentMembers,
            onRowClick: (row) => window.location.hash = `#/members/${row.id}`,
          }) : createElement('p', { class: 'empty-state' }, 'Nenhum membro cadastrado'),
        ]),
        
        createElement('div', { class: 'dashboard-card' }, [
          createElement('div', { class: 'card-header' }, [
            createElement('h3', {}, 'Últimos Dízimos/Ofertas'),
            hasRole('pastor', 'secretario', 'tesoureiro') && createElement('a', { href: '#/tithes', class: 'btn btn-sm btn-secondary' }, 'Ver todos'),
          ]),
          recentTithes.length > 0 ? Table({
            columns: [
              { key: 'name', header: 'Nome' },
              { key: 'type', header: 'Tipo', render: (row) => Badge({ label: row.type, variant: row.type === 'Dízimo' ? 'primary' : 'default' }) },
              { key: 'amount', header: 'Valor', render: (row) => `R$ ${Number(row.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
              { key: 'date', header: 'Data', render: (row) => new Date(row.date).toLocaleDateString('pt-BR') },
            ],
            data: recentTithes,
            onRowClick: (row) => window.location.hash = `#/tithes/${row.id}`,
          }) : createElement('p', { class: 'empty-state' }, 'Nenhum registro financeiro'),
        ]),
        
        createElement('div', { class: 'dashboard-card full-width' }, [
          createElement('div', { class: 'card-header' }, [
            createElement('h3', {}, 'Próximos Eventos'),
            hasRole('pastor', 'secretario') && createElement('a', { href: '#/events', class: 'btn btn-sm btn-secondary' }, 'Ver todos'),
          ]),
          upcomingEvents.length > 0 ? Table({
            columns: [
              { key: 'title', header: 'Evento' },
              { key: 'type', header: 'Tipo', render: (row) => Badge({ label: row.type, variant: 'info' }) },
              { key: 'start_date', header: 'Data/Hora', render: (row) => new Date(row.start_date).toLocaleString('pt-BR') },
              { key: 'location', header: 'Local' },
            ],
            data: upcomingEvents,
            onRowClick: (row) => window.location.hash = `#/events/${row.id}`,
          }) : createElement('p', { class: 'empty-state' }, 'Nenhum evento agendado'),
        ]),
      ]),
    ]);
    
    container.appendChild(content);
    
  } catch (error) {
    container.innerHTML = '';
    container.appendChild(Alert({ type: 'error', message: `Erro ao carregar dashboard: ${error.message}` }));
  }
}