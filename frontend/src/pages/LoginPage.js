import { createElement, Form, Button, Alert, Card } from '../components.js';
import { login } from '../auth.js';

export function renderLoginPage(container) {
  container.innerHTML = '';
  
  let errorMessage = null;
  
  const handleLogin = async (data) => {
    errorMessage = null;
    renderForm();
    
    try {
      await login(data.email, data.password, data.churchSlug);
      window.location.hash = '#/dashboard';
    } catch (error) {
      errorMessage = error.message;
      renderForm();
    }
  };
  
  const renderForm = () => {
    const form = Form({
      fields: [
        { name: 'churchSlug', label: 'Slug da Igreja', type: 'text', required: true, placeholder: 'ex: minha-igreja', help: 'Identificador único da sua igreja' },
        { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'seu@email.com' },
        { name: 'password', label: 'Senha', type: 'password', required: true, placeholder: '••••••••' },
      ],
      onSubmit: handleLogin,
      initialValues: { churchSlug: 'igreja-central' },
      submitLabel: 'Entrar',
    });
    
    form.addEventListener('cancel', () => {
      form.reset();
    });
    
    const content = createElement('div', { class: 'login-page' }, [
      createElement('div', { class: 'login-card' }, [
        createElement('div', { class: 'login-header' }, [
          createElement('div', { class: 'login-logo' }, '✝️'),
          createElement('h2', {}, 'Igreja SaaS'),
          createElement('p', { class: 'login-subtitle' }, 'Sistema de gestão para igrejas'),
        ]),
        errorMessage && Alert({ type: 'error', message: errorMessage, dismissible: true, onDismiss: () => { errorMessage = null; renderForm(); } }),
        form,
        createElement('div', { class: 'login-footer' }, [
          createElement('p', {}, 'Não tem conta? '),
          createElement('a', { href: '#/register', onclick: e => { e.preventDefault(); window.location.hash = '#/register'; } }, 'Criar igreja'),
        ]),
      ]),
    ]);
    
    container.appendChild(content);
  };
  
  renderForm();
}