import { createElement, Form, Button, Alert, Card } from '../components.js';
import { register } from '../auth.js';

export function renderRegisterPage(container) {
  container.innerHTML = '';
  
  let errorMessage = null;
  
  const handleRegister = async (data) => {
    errorMessage = null;
    renderForm();
    
    try {
      await register(data);
      window.location.hash = '#/dashboard';
    } catch (error) {
      errorMessage = error.message;
      renderForm();
    }
  };
  
  const renderForm = () => {
    const form = Form({
      fields: [
        { name: 'churchName', label: 'Nome da Igreja', type: 'text', required: true, placeholder: 'Igreja Central' },
        { name: 'churchSlug', label: 'Slug da Igreja', type: 'text', required: true, placeholder: 'igreja-central', help: 'Apenas letras minúsculas, números e hífen' },
        { name: 'churchEmail', label: 'Email da Igreja', type: 'email', required: true, placeholder: 'contato@igreja.com' },
        { name: 'name', label: 'Seu Nome', type: 'text', required: true, placeholder: 'João Silva' },
        { name: 'email', label: 'Seu Email', type: 'email', required: true, placeholder: 'joao@email.com' },
        { name: 'password', label: 'Senha', type: 'password', required: true, placeholder: '••••••••', help: 'Mínimo 6 caracteres' },
        { name: 'phone', label: 'Telefone (opcional)', type: 'text', placeholder: '(11) 99999-9999' },
      ],
      onSubmit: handleRegister,
      submitLabel: 'Criar Igreja e Entrar',
    });
    
    form.addEventListener('cancel', () => {
      window.location.hash = '#/login';
    });
    
    const content = createElement('div', { class: 'login-page' }, [
      createElement('div', { class: 'login-card' }, [
        createElement('div', { class: 'login-header' }, [
          createElement('div', { class: 'login-logo' }, '✝️'),
          createElement('h2', {}, 'Criar Nova Igreja'),
          createElement('p', { class: 'login-subtitle' }, 'Cadastre sua igreja e comece a gerenciar'),
        ]),
        errorMessage && Alert({ type: 'error', message: errorMessage, dismissible: true, onDismiss: () => { errorMessage = null; renderForm(); } }),
        form,
        createElement('div', { class: 'login-footer' }, [
          createElement('p', {}, 'Já tem conta? '),
          createElement('a', { href: '#/login', onclick: e => { e.preventDefault(); window.location.hash = '#/login'; } }, 'Fazer login'),
        ]),
      ]),
    ]);
    
    container.appendChild(content);
  };
  
  renderForm();
}