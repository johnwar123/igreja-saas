import { createElement, Card, Table, Button, Badge, Modal, Form, Alert, Spinner } from '../components.js';
import { api } from '../api.js';
import { hasRole } from '../auth.js';

export async function renderLiturgiesPage(container) {
  container.innerHTML = '';
  
  let liturgies = [];
  let total = 0;
  let page = 1;
  const limit = 20;
  let loading = false;
  let error = null;
  let showModal = false;
  let editingLiturgy = null;
  let deleteConfirm = null;
  
  const canWrite = hasRole('pastor', 'secretario');
  const canDelete = hasRole('pastor');
  
  async function fetchLiturgies() {
    loading = true;
    error = null;
    render();
    
    try {
      const res = await api.liturgies.list({ limit, offset: (page - 1) * limit });
      liturgies = res.liturgies || [];
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
      await api.liturgies.create(data);
      showModal = false;
      editingLiturgy = null;
      await fetchLiturgies();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  async function handleUpdate(id, data) {
    try {
      await api.liturgies.update(id, data);
      showModal = false;
      editingLiturgy = null;
      await fetchLiturgies();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  async function handleDelete(id) {
    try {
      await api.liturgies.delete(id);
      deleteConfirm = null;
      await fetchLiturgies();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  function openCreate() {
    editingLiturgy = null;
    showModal = true;
    render();
  }
  
  function openEdit(liturgy) {
    editingLiturgy = liturgy;
    showModal = true;
    render();
  }
  
  function confirmDelete(liturgy) {
    deleteConfirm = liturgy;
    render();
  }
  
  function render() {
    const columns = [
      { key: 'title', header: 'Título' },
      { key: 'type', header: 'Tipo', render: (row) => Badge({ label: row.type, variant: 'purple' }) },
      { key: 'date', header: 'Data', render: (row) => row.date ? new Date(row.date).toLocaleDateString('pt-BR') : '-' },
      { key: 'created_by_name', header: 'Responsável', render: (row) => row.created_by_name || '-' },
    ];
    
    const actions = canWrite ? [
      { label: 'Editar', variant: 'secondary', handler: openEdit },
      ...(canDelete ? [{ label: 'Excluir', variant: 'danger', handler: confirmDelete }] : []),
    ] : undefined;
    
    const content = createElement('div', { class: 'page-content-inner' }, [
      createElement('div', { class: 'page-header' }, [
        createElement('div', {}, [
          createElement('h1', {}, 'Liturgia'),
          createElement('p', { class: 'page-subtitle' }, 'Ordens de culto e liturgias'),
        ]),
        canWrite && Button({ label: 'Nova Liturgia', variant: 'primary', onclick: openCreate }),
      ]),
      
      error && Alert({ type: 'error', message: error, dismissible: true, onDismiss: () => { error = null; render(); } }),
      
      Card({
        children: loading ? createElement('div', { class: 'page-loading' }, Spinner({ size: 'lg' })) : 
          liturgies.length > 0 ? Table({ columns, data: liturgies, actions, onRowClick: openEdit }) :
          createElement('div', { class: 'empty-state' }, [
            createElement('p', {}, 'Nenhuma liturgia cadastrada'),
            canWrite && Button({ label: 'Cadastrar Primeira Liturgia', variant: 'primary', onclick: openCreate, style: { marginTop: '16px' } }),
          ]),
        footer: total > limit ? createElement('div', { class: 'pagination' }, [
          createElement('span', {}, `Página ${page} de ${Math.ceil(total / limit)} — Total: ${total}`),
          createElement('div', { class: 'pagination-controls' }, [
            Button({ label: 'Anterior', variant: 'secondary', size: 'sm', disabled: page === 1, onclick: () => { page--; fetchLiturgies(); } }),
            Button({ label: 'Próxima', variant: 'secondary', size: 'sm', disabled: page >= Math.ceil(total / limit), onclick: () => { page++; fetchLiturgies(); } }),
          ]),
        ]) : undefined,
      }),
    ]);
    
    container.innerHTML = '';
    container.appendChild(content);
    
    if (showModal) {
      const modalContent = editingLiturgy ? renderLiturgyForm(editingLiturgy) : renderLiturgyForm();
      container.appendChild(Modal({
        isOpen: true,
        title: editingLiturgy ? 'Editar Liturgia' : 'Nova Liturgia',
        size: 'lg',
        onClose: () => { showModal = false; editingLiturgy = null; render(); },
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
  
  function renderLiturgyForm(liturgy = null) {
    let formError = null;
    
    const handleSubmit = async (data) => {
      formError = null;
      const result = liturgy ? await handleUpdate(liturgy.id, data) : await handleCreate(data);
      if (result?.error) {
        formError = result.error;
        renderModalContent();
      }
    };
    
    function renderModalContent() {
      const form = Form({
        fields: [
          { name: 'title', label: 'Título *', type: 'text', required: true, placeholder: 'Título da liturgia' },
          { name: 'type', label: 'Tipo', type: 'text', placeholder: 'Ex: Culto Dominical, Santa Ceia, Batismo' },
          { name: 'date', label: 'Data', type: 'date' },
          { name: 'order', label: 'Ordem', type: 'textarea', placeholder: 'Ordem do culto (JSON ou texto)', rows: 6 },
          { name: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Notas adicionais', rows: 4 },
        ],
        onSubmit: handleSubmit,
        initialValues: liturgy || {},
        submitLabel: liturgy ? 'Salvar Alterações' : 'Criar Liturgia',
      });
      
      form.addEventListener('cancel', () => { showModal = false; editingLiturgy = null; render(); });
      
      return createElement('div', {}, [
        formError && Alert({ type: 'error', message: formError, dismissible: true, onDismiss: () => { formError = null; renderModalContent(); } }),
        form,
      ]);
    }
    
    return renderModalContent();
  }
  
  await fetchLiturgies();
}