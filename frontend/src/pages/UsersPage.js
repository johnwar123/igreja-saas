import { createElement, Card, Table, Button, Badge, Modal, Form, Alert, Spinner } from '../components.js';
import { api } from '../api.js';
import { hasRole } from '../auth.js';

export async function renderUsersPage(container) {
  container.innerHTML = '';
  
  let users = [];
  let loading = false;
  let error = null;
  let showModal = false;
  let editingUser = null;
  let deleteConfirm = null;
  
  const canWrite = hasRole('pastor');
  const canDelete = hasRole('pastor');
  
  const roleOptions = ['pastor', 'secretario', 'tesoureiro', 'membro'];
  
  async function fetchUsers() {
    loading = true;
    error = null;
    render();
    
    try {
      const res = await api.users.list();
      users = res.users || [];
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
      render();
    }
  }
  
  async function handleCreate(data) {
    try {
      await api.users.create(data);
      showModal = false;
      editingUser = null;
      await fetchUsers();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  async function handleUpdate(id, data) {
    try {
      await api.users.update(id, data);
      showModal = false;
      editingUser = null;
      await fetchUsers();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  async function handleDelete(id) {
    try {
      await api.users.delete(id);
      deleteConfirm = null;
      await fetchUsers();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  function openCreate() {
    editingUser = null;
    showModal = true;
    render();
  }
  
  function openEdit(user) {
    editingUser = user;
    showModal = true;
    render();
  }
  
  function confirmDelete(user) {
    deleteConfirm = user;
    render();
  }
  
  function render() {
    const columns = [
      { key: 'name', header: 'Nome' },
      { key: 'email', header: 'Email' },
      { key: 'role', header: 'Cargo', render: (row) => Badge({ label: row.role, variant: row.role === 'pastor' ? 'danger' : row.role === 'secretario' ? 'warning' : row.role === 'tesoureiro' ? 'info' : 'default' }) },
      { key: 'active', header: 'Status', render: (row) => Badge({ label: row.active ? 'Ativo' : 'Inativo', variant: row.active ? 'success' : 'default' }) },
    ];
    
    const actions = canWrite ? [
      { label: 'Editar', variant: 'secondary', handler: openEdit },
      ...(canDelete ? [{ label: 'Excluir', variant: 'danger', handler: confirmDelete }] : []),
    ] : undefined;
    
    const content = createElement('div', { class: 'page-content-inner' }, [
      createElement('div', { class: 'page-header' }, [
        createElement('div', {}, [
          createElement('h1', {}, 'Usuários'),
          createElement('p', { class: 'page-subtitle' }, 'Gerencie usuários do sistema (apenas pastores)'),
        ]),
        canWrite && Button({ label: 'Novo Usuário', variant: 'primary', onclick: openCreate }),
      ]),
      
      error && Alert({ type: 'error', message: error, dismissible: true, onDismiss: () => { error = null; render(); } }),
      
      Card({
        children: loading ? createElement('div', { class: 'page-loading' }, Spinner({ size: 'lg' })) : 
          users.length > 0 ? Table({ columns, data: users, actions, onRowClick: openEdit }) :
          createElement('div', { class: 'empty-state' }, [
            createElement('p', {}, 'Nenhum usuário cadastrado'),
            canWrite && Button({ label: 'Cadastrar Primeiro Usuário', variant: 'primary', onclick: openCreate, style: { marginTop: '16px' } }),
          ]),
      }),
    ]);
    
    container.innerHTML = '';
    container.appendChild(content);
    
    if (showModal) {
      const modalContent = editingUser ? renderUserForm(editingUser) : renderUserForm();
      container.appendChild(Modal({
        isOpen: true,
        title: editingUser ? 'Editar Usuário' : 'Novo Usuário',
        size: 'md',
        onClose: () => { showModal = false; editingUser = null; render(); },
        children: modalContent,
      }));
    }
    
    if (deleteConfirm) {
      container.appendChild(Modal({
        isOpen: true,
        title: 'Confirmar Exclusão',
        onClose: () => { deleteConfirm = null; render(); },
        children: createElement('div', {}, [
          createElement('p', {}, `Tem certeza que deseja excluir <strong>${deleteConfirm.name}</strong>?`),
          createElement('p', { style: { color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '8px' } }, 'Esta ação não pode ser desfeita.'),
          createElement('div', { class: 'form-actions', style: { marginTop: '24px' } }, [
            Button({ label: 'Cancelar', variant: 'secondary', onclick: () => { deleteConfirm = null; render(); } }),
            Button({ label: 'Excluir', variant: 'danger', onclick: () => handleDelete(deleteConfirm.id) }),
          ]),
        ]),
      }));
    }
  }
  
  function renderUserForm(user = null) {
    let formError = null;
    
    const handleSubmit = async (data) => {
      formError = null;
      const payload = {
        ...data,
        active: data.active === 'true',
      };
      if (!data.password) delete payload.password;
      const result = user ? await handleUpdate(user.id, payload) : await handleCreate(payload);
      if (result?.error) {
        formError = result.error;
        renderModalContent();
      }
    };
    
    function renderModalContent() {
      const form = Form({
        fields: [
          { name: 'name', label: 'Nome *', type: 'text', required: true, placeholder: 'Nome completo' },
          { name: 'email', label: 'Email *', type: 'email', required: true, placeholder: 'email@exemplo.com' },
          { name: 'password', label: user ? 'Nova Senha (opcional)' : 'Senha *', type: 'password', required: !user, placeholder: user ? 'Deixe vazio para manter' : 'Mínimo 6 caracteres' },
          { name: 'role', label: 'Cargo *', type: 'select', required: true, options: roleOptions.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) })) },
          { name: 'active', label: 'Status', type: 'select', options: [
            { value: 'true', label: 'Ativo' },
            { value: 'false', label: 'Inativo' },
          ]},
        ],
        onSubmit: handleSubmit,
        initialValues: user || { role: 'membro', active: 'true' },
        submitLabel: user ? 'Salvar Alterações' : 'Criar Usuário',
      });
      
      form.addEventListener('cancel', () => { showModal = false; editingUser = null; render(); });
      
      return createElement('div', {}, [
        formError && Alert({ type: 'error', message: formError, dismissible: true, onDismiss: () => { formError = null; renderModalContent(); } }),
        form,
      ]);
    }
    
    return renderModalContent();
  }
  
  await fetchUsers();
}