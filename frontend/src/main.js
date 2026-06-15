import './style.css';
import { addRoute, setNotFoundHandler, beforeEach, startRouter, navigate } from './router.js';
import { loadSession, logout, getCurrentUser, hasRole } from './auth.js';
import { Header, Sidebar, createElement } from './components.js';
import { renderLoginPage } from './pages/LoginPage.js';
import { renderRegisterPage } from './pages/RegisterPage.js';
import { renderDashboardPage } from './pages/DashboardPage.js';
import { renderMembersPage } from './pages/MembersPage.js';
import { renderTithesPage } from './pages/TithesPage.js';
import { renderEventsPage } from './pages/EventsPage.js';
import { renderSongsPage } from './pages/SongsPage.js';
import { renderAnnouncementsPage } from './pages/AnnouncementsPage.js';
import { renderLiturgiesPage } from './pages/LiturgiesPage.js';
import { renderUsersPage } from './pages/UsersPage.js';

const app = document.getElementById('app');

let currentLayout = null;

function renderLayout({ title, children, currentPath }) {
  const user = getCurrentUser();
  
  if (currentLayout) {
    currentLayout.remove();
  }
  
  currentLayout = createElement('div', { class: 'app-layout' }, [
    Header({ title, user, onLogout: logout }),
    createElement('div', { class: 'app-main' }, [
      Sidebar({ currentPath, onNavigate: navigate, user }),
      createElement('main', { class: 'app-content', id: 'page-content' }, children),
    ]),
  ]);
  
  app.appendChild(currentLayout);
  return document.getElementById('page-content');
}

function createPageContainer() {
  return createElement('div', { class: 'page-container' });
}

beforeEach(async (path) => {
  const publicPaths = ['/login', '/register'];
  const isPublic = publicPaths.includes(path);
  
  if (!isPublic) {
    const hasSession = await loadSession();
    if (!hasSession) {
      window.location.hash = '#/login';
      return false;
    }
  } else {
    const hasSession = await loadSession();
    if (hasSession) {
      window.location.hash = '#/dashboard';
      return false;
    }
  }
  
  return true;
});

addRoute('/login', () => {
  const container = createPageContainer();
  renderLayout({ title: 'Login', children: container, currentPath: '/login' });
  renderLoginPage(container);
});

addRoute('/register', () => {
  const container = createPageContainer();
  renderLayout({ title: 'Cadastro', children: container, currentPath: '/register' });
  renderRegisterPage(container);
});

addRoute('/dashboard', () => {
  const container = createPageContainer();
  const content = renderLayout({ title: 'Dashboard', children: container, currentPath: '/dashboard' });
  renderDashboardPage(content);
});

addRoute('/members', () => {
  const container = createPageContainer();
  const content = renderLayout({ title: 'Membros', children: container, currentPath: '/members' });
  renderMembersPage(content);
});

addRoute('/tithes', () => {
  const container = createPageContainer();
  const content = renderLayout({ title: 'Dízimos', children: container, currentPath: '/tithes' });
  renderTithesPage(content);
});

addRoute('/events', () => {
  const container = createPageContainer();
  const content = renderLayout({ title: 'Eventos', children: container, currentPath: '/events' });
  renderEventsPage(content);
});

addRoute('/songs', () => {
  const container = createPageContainer();
  const content = renderLayout({ title: 'Louvor', children: container, currentPath: '/songs' });
  renderSongsPage(content);
});

addRoute('/announcements', () => {
  const container = createPageContainer();
  const content = renderLayout({ title: 'Comunicados', children: container, currentPath: '/announcements' });
  renderAnnouncementsPage(content);
});

addRoute('/liturgies', () => {
  const container = createPageContainer();
  const content = renderLayout({ title: 'Liturgia', children: container, currentPath: '/liturgies' });
  renderLiturgiesPage(content);
});

addRoute('/users', () => {
  const container = createPageContainer();
  const content = renderLayout({ title: 'Usuários', children: container, currentPath: '/users' });
  renderUsersPage(content);
});

setNotFoundHandler((path) => {
  const container = createPageContainer();
  renderLayout({ title: 'Não Encontrado', children: container, currentPath: path });
  container.innerHTML = `
    <div class="error-page">
      <h1>404</h1>
      <p>Página não encontrada: ${path}</p>
      <a href="#/dashboard" class="btn btn-primary">Voltar ao Dashboard</a>
    </div>
  `;
});

startRouter();