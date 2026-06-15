import { createElement, Card, Table, Button, Badge, Modal, Form, Alert, Spinner } from '../components.js';
import { api } from '../api.js';
import { hasRole } from '../auth.js';

export async function renderAnnouncementsPage(container) {
  container.innerHTML = '';
  
  let announcements = [];
  let total = 0;
  let page = 1;
  const limit = 20;
  let loading = false;
  let error = null;
  let showModal = false;
  let editingAnnouncement = null;
  let deleteConfirm = null;
  
  const canWrite = hasRole('pastor', 'secretario');
  const canDelete = hasRole('pastor');
  
  const priorityOptions = ['baixa', 'normal', 'alta', 'urgente'];
  const audienceOptions = ['todos', 'membros', 'lideres', 'pastores'];
  
  async function fetchAnnouncements() {
    loading = true;
    error = null;
    render();
    
    try {
      const res = await api.announcements.list({ limit, offset: (page - 1) * limit, published_only: 'false' });
      announcements = res.announcements || [];
      total = res.total || 0;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
      render();
    }
  }
  
  async function handleCreate(data) {
    try {
      await api.announcements.create(data);
      showModal = false;
      editingAnnouncement = null;
      await fetchAnnouncements();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  async function handleUpdate(id, data) {
    try {
      await api.announcements.update(id, data);
      showModal = false;
      editingAnnouncement = null;
      await fetchAnnouncements();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  async function handleDelete(id) {
    try {
      await api.announcements.delete(id);
      deleteConfirm = null;
      await fetchAnnouncements();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  function openCreate() {
    editingAnnouncement = null;
    showModal = true;
    render();
  }
  
  function openEdit(announcement) {
    editingAnnouncement = announcement;
    showModal = true;
    render();
  }
  
  function confirmDelete(announcement) {
    deleteConfirm = announcement;
    render();
  }
  
  function render() {
    const columns = [
      { key: 'title', header: 'Título' },
      { key: 'priority', header: 'Prioridade', render: (row) => Badge({ label: row.priority, variant: row.priority === 'urgente' ? 'danger' : row.priority === 'alta' ? 'warning' : row.priority === 'normal' ? 'info' : 'default' }) },
      { key: 'target_audience', header: 'Público', render: (row) => Badge({ label: row.target_audience, variant: 'purple' }) },
      { key: 'published_at', header: 'Publicado em', render: (row) => row.published_at ? new Date(row.published_at).toLocaleString('pt-BR') : '<span style="color:var(--text-muted)">Rascunho</span>' },
      { key: 'expires_at', header: 'Expira em', render: (row) => row.expires_at ? new Date(row.expires_at).toLocaleString('pt-BR') : '-' },
      { key: 'created_by_name', header: 'Autor', render: (row) => row.created_by_name || '-' },
    ];
    
    const actions = canWrite ? [
      { label: 'Editar', variant: 'secondary', handler: openEdit },
      ...(canDelete ? [{ label: 'Excluir', variant: 'danger', handler: confirmDelete }] : []),
    ] : undefined;
    
    const content = createElement('div', { class: 'page-content-inner' }, [
      createElement('div', { class: 'page-header' }, [
        createElement('div', {}, [
          createElement('h1', {}, 'Comunicados'),
          createElement('p', { class: 'page-subtitle' }, 'Avisos e comunicados para a igreja'),
        ]),
        canWrite && Button({ label: 'Novo Comunicado', variant: 'primary', onclick: openCreate }),
      ]),
      
      error && Alert({ type: 'error', message: error, dismissible: true, onDismiss: () => { error = null; render(); } }),
      
      Card({
        children: loading ? createElement('div', { class: 'page-loading' }, Spinner({ size: 'lg' })) : 
          announcements.length > 0 ? Table({ columns, data: announcements, actions, onRowClick: openEdit }) :
          createElement('div', { class: 'empty-state' }, [
            createElement('p', {}, 'Nenhum comunicado cadastrado'),
            canWrite && Button({ label: 'Criar Primeiro Comunicado', variant: 'primary', onclick: openCreate, style: { marginTop: '16px' } }),
          ]),
        footer: total > limit ? createElement('div', { class: 'pagination' }, [
          createElement('span', {}, `Página ${page} de ${Math.ceil(total / limit)} — Total: ${total}`),
          createElement('div', { class: 'pagination-controls' }, [
            Button({ label: 'Anterior', variant: 'secondary', size: 'sm', disabled: page === 1, onclick: () => { page--; fetchAnnouncements(); } }),
            Button({ label: 'Próxima', variant: 'secondary', size: 'sm', disabled: page >= Math.ceil(total / limit), onclick: () => { page++; fetchAnnouncements(); } }),
          ]),
        ]) : undefined,
      }),
    ]);
    
    container.innerHTML = '';
    container.appendChild(content);
    
    if (showModal) {
      const modalContent = editingAnnouncement ? renderAnnouncementForm(editingAnnouncement) : renderAnnouncementForm();
      container.appendChild(Modal({
        isOpen: true,
        title: editingAnnouncement ? 'Editar Comunicado' : 'Novo Comunicado',
        size: 'lg',
        onClose: () => { showModal = false; editingAnnouncement = null; render(); },
        children: modalContent,
      }));
    }
    
    if (deleteConfirm) {
      container.appendChild(Modal({
        isOpen: true,
        title: 'Confirmar Exclusão',
        onClose: () => { deleteConfirm = null; render(); },
        children: createElement('div', {}, [
          createElement('p', {}, `Tem certeza que deseja excluir <strong>${deleteConfirm.title}</strong>?`),
          createElement('p', { style: { color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '8px' } }, 'Esta ação não pode ser desfeita.'),
          createElement('div', { class: 'form-actions', style: { marginTop: '24px' } }, [
            Button({ label: 'Cancelar', variant: 'secondary', onclick: () => { deleteConfirm = null; render(); } }),
            Button({ label: 'Excluir', variant: 'danger', onclick: () => handleDelete(deleteConfirm.id) }),
          ]),
        ]),
      }));
    }
  }
  
  function renderAnnouncementForm(announcement = null) {
    let formError = null;
    
    const handleSubmit = async (data) => {
      formError = null;
      const result = announcement ? await handleUpdate(announcement.id, data) : await handleCreate(data);
      if (result?.error) {
        formError = result.error;
        renderModalContent();
      }
    };
    
    function renderModalContent() {
      const form = Form({
        fields: [
          { name: 'title', label: 'Título *', type: 'text', required: true, placeholder: 'Título do comunicado' },
          { name: 'content', label: 'Conteúdo *', type: 'textarea', required: true, placeholder: 'Conteúdo do comunicado', rows: 6 },
          { name: 'priority', label: 'Prioridade *', type: 'select', required: true, options: priorityOptions.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) })) },
          { name: 'target_audience', label: 'Público-alvo *', type: 'select', required: true, options: audienceOptions.map(a => ({ value: a, label: a.charAt(0).toUpperCase() + a.slice(1) })) },
          { name: 'published_at', label: 'Publicar em', type: 'datetime-local', placeholder: 'Deixe vazio para rascunho' },
          { name: 'expires_at', label: 'Expirar em', type: 'datetime-local', placeholder: 'Opcional' },
        ],
        onSubmit: handleSubmit,
        initialValues: announcement || { priority: 'normal', target_audience: 'todos' },
        submitLabel: announcement ? 'Salvar Alterações' : 'Criar Comunicado',
      });
      
      form.addEventListener('cancel', () => { showModal = false; editingAnnouncement = null; render(); });
      
      return createElement('div', {}, [
        formError && Alert({ type: 'error', message: formError, dismissible: true, onDismiss: () => { formError = null; renderModalContent(); } }),
        form,
      ]);
    }
    
    return renderModalContent();
  }
  
  await fetchAnnouncements();
}