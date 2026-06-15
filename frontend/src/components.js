export function createElement(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'class') el.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value);
  });
  children.flat().forEach(child => {
    if (child == null) return;
    if (typeof child === 'string' || typeof child === 'number') el.appendChild(document.createTextNode(child));
    else if (child instanceof Node) el.appendChild(child);
    else if (Array.isArray(child)) child.forEach(c => el.appendChild(c));
  });
  return el;
}

import { hasRole } from './auth.js';

export function Header({ title, user, onLogout }) {
  const header = createElement('header', { class: 'app-header' }, [
    createElement('div', { class: 'header-left' }, [
      createElement('h1', {}, '✝️ Igreja SaaS'),
    ]),
    createElement('div', { class: 'header-right' }, [
      user && createElement('span', { class: 'user-info' }, `${user.name} (${user.role})`),
      user && createElement('button', { class: 'btn btn-danger', onclick: onLogout }, 'Sair'),
    ]),
  ]);
  return header;
}

export function Sidebar({ currentPath, onNavigate, user }) {
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊', roles: ['pastor', 'secretario', 'tesoureiro', 'membro'] },
    { path: '/members', label: 'Membros', icon: '👥', roles: ['pastor', 'secretario'] },
    { path: '/tithes', label: 'Dízimos', icon: '💰', roles: ['pastor', 'secretario', 'tesoureiro'] },
    { path: '/events', label: 'Eventos', icon: '📅', roles: ['pastor', 'secretario'] },
    { path: '/songs', label: 'Louvor', icon: '🎵', roles: ['pastor', 'secretario'] },
    { path: '/announcements', label: 'Comunicados', icon: '📢', roles: ['pastor', 'secretario'] },
    { path: '/liturgies', label: 'Liturgia', icon: '📖', roles: ['pastor', 'secretario'] },
    { path: '/users', label: 'Usuários', icon: '👤', roles: ['pastor'] },
  ];

  const allowedItems = navItems.filter(item => !item.roles || hasRole(...item.roles));

  const sidebar = createElement('aside', { class: 'app-sidebar' }, [
    createElement('nav', { class: 'sidebar-nav' }, 
      allowedItems.map(item => createElement('a', {
        class: `nav-link ${currentPath === item.path ? 'active' : ''}`,
        href: `#${item.path}`,
        onclick: (e) => { e.preventDefault(); onNavigate(item.path); }
      }, [
        createElement('span', { class: 'nav-icon' }, item.icon),
        createElement('span', { class: 'nav-label' }, item.label),
      ]))
    ),
  ]);
  return sidebar;
}

export function Modal({ isOpen, title, children, onClose, size = 'md' }) {
  if (!isOpen) return createElement('div');
  
  const overlay = createElement('div', { class: 'modal-overlay', onclick: onClose }, [
    createElement('div', { class: `modal modal-${size}`, onclick: e => e.stopPropagation() }, [
      createElement('div', { class: 'modal-header' }, [
        createElement('h3', {}, title),
        createElement('button', { class: 'modal-close', onclick: onClose }, '×'),
      ]),
      createElement('div', { class: 'modal-body' }, children),
    ]),
  ]);
  return overlay;
}

export function Table({ columns, data, onRowClick, actions, emptyMessage = 'Nenhum registro encontrado' }) {
  if (!data || data.length === 0) {
    return createElement('div', { class: 'table-empty' }, emptyMessage);
  }

  return createElement('div', { class: 'table-container' }, [
    createElement('table', { class: 'data-table' }, [
      createElement('thead', {}, [
        createElement('tr', {}, [
          ...columns.map(col => createElement('th', {}, col.header)),
          actions && createElement('th', {}, 'Ações'),
        ]),
      ]),
      createElement('tbody', {}, 
        data.map(row => createElement('tr', { onclick: () => onRowClick?.(row) }, [
          ...columns.map(col => createElement('td', {}, col.render ? col.render(row) : row[col.key])),
          actions && createElement('td', { class: 'actions-cell' }, 
            actions.map(action => createElement('button', {
              class: `btn btn-sm btn-${action.variant || 'secondary'}`,
              onclick: (e) => { e.stopPropagation(); action.handler(row); }
            }, action.label))
          ),
        ]))
      ),
    ]),
  ]);
}

export function Form({ fields, onSubmit, initialValues = {}, submitLabel = 'Salvar' }) {
  const form = createElement('form', { class: 'form', onsubmit: e => { e.preventDefault(); onSubmit(getFormData(form)); } });
  
  fields.forEach(field => {
    const wrapper = createElement('div', { class: 'form-field' });
    
    if (field.label) {
      wrapper.appendChild(createElement('label', { for: field.name }, field.label + (field.required ? ' *' : '')));
    }
    
    let input;
    switch (field.type) {
      case 'select':
        input = createElement('select', { name: field.name, id: field.name, required: field.required });
        (field.options || []).forEach(opt => {
          input.appendChild(createElement('option', { value: opt.value }, opt.label));
        });
        break;
      case 'textarea':
        input = createElement('textarea', { name: field.name, id: field.name, required: field.required, rows: field.rows || 4 });
        break;
      case 'number':
        input = createElement('input', { type: 'number', name: field.name, id: field.name, required: field.required, step: field.step, min: field.min, max: field.max });
        break;
      case 'date':
        input = createElement('input', { type: 'date', name: field.name, id: field.name, required: field.required });
        break;
      case 'datetime-local':
        input = createElement('input', { type: 'datetime-local', name: field.name, id: field.name, required: field.required });
        break;
      default:
        input = createElement('input', { type: field.type || 'text', name: field.name, id: field.name, required: field.required, placeholder: field.placeholder });
    }
    
    if (initialValues[field.name] !== undefined) {
      input.value = initialValues[field.name];
    }
    
    wrapper.appendChild(input);
    
    if (field.help) {
      wrapper.appendChild(createElement('small', { class: 'form-help' }, field.help));
    }
    
    form.appendChild(wrapper);
  });
  
  form.appendChild(createElement('div', { class: 'form-actions' }, [
    createElement('button', { type: 'submit', class: 'btn btn-primary' }, submitLabel),
    createElement('button', { type: 'button', class: 'btn btn-secondary', onclick: () => form.dispatchEvent(new Event('cancel')) }, 'Cancelar'),
  ]));
  
  return form;
}

function getFormData(form) {
  const data = {};
  new FormData(form).forEach((value, key) => {
    const input = form.querySelector(`[name="${key}"]`);
    if (input?.type === 'number') data[key] = value ? Number(value) : null;
    else if (input?.type === 'checkbox') data[key] = input.checked;
    else data[key] = value || (input?.required ? null : '');
  });
  return data;
}

export function Button({ label, variant = 'primary', size = 'md', onclick, disabled, type = 'button' }) {
  return createElement('button', {
    class: `btn btn-${variant} btn-${size}`,
    onclick,
    disabled,
    type,
  }, label);
}

export function Input({ name, label, type = 'text', value = '', required, placeholder, help, onChange }) {
  const wrapper = createElement('div', { class: 'form-field' });
  if (label) wrapper.appendChild(createElement('label', { for: name }, label + (required ? ' *' : '')));
  const input = createElement('input', { type, name, id: name, value, required, placeholder, onchange: onChange });
  wrapper.appendChild(input);
  if (help) wrapper.appendChild(createElement('small', { class: 'form-help' }, help));
  return wrapper;
}

export function Select({ name, label, options = [], value = '', required, help, onChange }) {
  const wrapper = createElement('div', { class: 'form-field' });
  if (label) wrapper.appendChild(createElement('label', { for: name }, label + (required ? ' *' : '')));
  const select = createElement('select', { name, id: name, required, onchange: onChange });
  options.forEach(opt => select.appendChild(createElement('option', { value: opt.value }, opt.label)));
  select.value = value;
  wrapper.appendChild(select);
  if (help) wrapper.appendChild(createElement('small', { class: 'form-help' }, help));
  return wrapper;
}

export function Alert({ type = 'info', message, dismissible = false, onDismiss }) {
  const alert = createElement('div', { class: `alert alert-${type}` }, message);
  if (dismissible) {
    alert.appendChild(createElement('button', { class: 'alert-close', onclick: onDismiss }, '×'));
  }
  return alert;
}

export function Card({ title, children, actions, footer }) {
  return createElement('div', { class: 'card' }, [
    title && createElement('div', { class: 'card-header' }, [
      createElement('h3', {}, title),
      actions && createElement('div', { class: 'card-actions' }, actions),
    ]),
    createElement('div', { class: 'card-body' }, children),
    footer && createElement('div', { class: 'card-footer' }, footer),
  ]);
}

export function Badge({ label, variant = 'default' }) {
  return createElement('span', { class: `badge badge-${variant}` }, label);
}

export function Spinner({ size = 'md' }) {
  return createElement('div', { class: `spinner spinner-${size}` });
}

export function Tabs({ tabs, activeTab, onChange }) {
  return createElement('div', { class: 'tabs' }, [
    createElement('div', { class: 'tabs-nav' }, 
      tabs.map(tab => createElement('button', {
        class: `tab-btn ${activeTab === tab.id ? 'active' : ''}`,
        onclick: () => onChange(tab.id),
      }, tab.label))
    ),
    createElement('div', { class: 'tabs-content' },
      tabs.find(t => t.id === activeTab)?.content || ''
    ),
  ]);
}