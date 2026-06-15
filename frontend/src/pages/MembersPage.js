import { createElement, Card, Table, Button, Badge, Modal, Form, Alert, Spinner } from '../components.js';
import { api } from '../api.js';
import { hasRole } from '../auth.js';

export async function renderMembersPage(container) {
  container.innerHTML = '';
  
  let members = [];
  let total = 0;
  let page = 1;
  const limit = 20;
  let loading = false;
  let error = null;
  let showModal = false;
  let editingMember = null;
  let deleteConfirm = null;
  
  const canWrite = hasRole('pastor', 'secretario');
  const canDelete = hasRole('pastor');
  
  async function fetchMembers() {
    loading = true;
    error = null;
    render();
    
    try {
      const res = await api.members.list({ limit, offset: (page - 1) * limit });
      members = res.members || [];
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
      await api.members.create(data);
      showModal = false;
      editingMember = null;
      await fetchMembers();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  async function handleUpdate(id, data) {
    try {
      await api.members.update(id, data);
      showModal = false;
      editingMember = null;
      await fetchMembers();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  async function handleDelete(id) {
    try {
      await api.members.delete(id);
      deleteConfirm = null;
      await fetchMembers();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  function openCreate() {
    editingMember = null;
    showModal = true;
    render();
  }
  
  function openEdit(member) {
    editingMember = member;
    showModal = true;
    render();
  }
  
  function confirmDelete(member) {
    deleteConfirm = member;
    render();
  }
  
  function render() {
    const columns = [
      { key: 'name', header: 'Nome' },
      { key: 'phone', header: 'Telefone', render: (row) => row.phone || '-' },
      { key: 'email', header: 'Email', render: (row) => row.email || '-' },
      { key: 'status', header: 'Status', render: (row) => Badge({ label: row.status, variant: row.status === 'Ativo' ? 'success' : 'default' }) },
      { key: 'role', header: 'Cargo' },
      { key: 'baptism_date', header: 'Batismo', render: (row) => row.baptism_date ? new Date(row.baptism_date).toLocaleDateString('pt-BR') : '-' },
    ];
    
    const actions = canWrite ? [
      { label: 'Editar', variant: 'secondary', handler: openEdit },
      ...(canDelete ? [{ label: 'Excluir', variant: 'danger', handler: confirmDelete }] : []),
    ] : undefined;
    
    const content = createElement('div', { class: 'page-content-inner' }, [
      createElement('div', { class: 'page-header' }, [
        createElement('div', {}, [
          createElement('h1', {}, 'Membros'),
          createElement('p', { class: 'page-subtitle' }, 'Gerencie os membros da igreja'),
        ]),
        canWrite && Button({ label: 'Novo Membro', variant: 'primary', onclick: openCreate }),
      ]),
      
      error && Alert({ type: 'error', message: error, dismissible: true, onDismiss: () => { error = null; render(); } }),
      
      Card({
        children: loading ? createElement('div', { class: 'page-loading' }, Spinner({ size: 'lg' })) : 
          members.length > 0 ? Table({ columns, data: members, actions, onRowClick: openEdit }) :
          createElement('div', { class: 'empty-state' }, [
            createElement('p', {}, 'Nenhum membro cadastrado'),
            canWrite && Button({ label: 'Cadastrar Primeiro Membro', variant: 'primary', onclick: openCreate, style: { marginTop: '16px' } }),
          ]),
        footer: total > limit ? createElement('div', { class: 'pagination' }, [
          createElement('span', {}, `Página ${page} de ${Math.ceil(total / limit)} — Total: ${total}`),
          createElement('div', { class: 'pagination-controls' }, [
            Button({ label: 'Anterior', variant: 'secondary', size: 'sm', disabled: page === 1, onclick: () => { page--; fetchMembers(); } }),
            Button({ label: 'Próxima', variant: 'secondary', size: 'sm', disabled: page >= Math.ceil(total / limit), onclick: () => { page++; fetchMembers(); } }),
          ]),
        ]) : undefined,
      }),
    ]);
    
    container.innerHTML = '';
    container.appendChild(content);
    
    if (showModal) {
      const modalContent = editingMember ? renderMemberForm(editingMember) : renderMemberForm();
      container.appendChild(Modal({
        isOpen: true,
        title: editingMember ? 'Editar Membro' : 'Novo Membro',
        size: 'lg',
        onClose: () => { showModal = false; editingMember = null; render(); },
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
  
  function renderMemberForm(member = null) {
    let formError = null;
    
    const handleSubmit = async (data) => {
      formError = null;
      const result = member ? await handleUpdate(member.id, data) : await handleCreate(data);
      if (result?.error) {
        formError = result.error;
        renderModalContent();
      }
    };
    
    function renderModalContent() {
      const form = Form({
        fields: [
          { name: 'name', label: 'Nome *', type: 'text', required: true, placeholder: 'Nome completo' },
          { name: 'phone', label: 'Telefone', type: 'text', placeholder: '(11) 99999-9999' },
          { name: 'email', label: 'Email', type: 'email', placeholder: 'email@exemplo.com' },
          { name: 'birth_date', label: 'Data de Nascimento', type: 'date' },
          { name: 'baptism_date', label: 'Data do Batismo', type: 'date' },
          { name: 'status', label: 'Status', type: 'select', required: true, options: [
            { value: 'Ativo', label: 'Ativo' },
            { value: 'Inativo', label: 'Inativo' },
            { value: 'Visitante', label: 'Visitante' },
            { value: 'Transferido', label: 'Transferido' },
          ]},
          { name: 'role', label: 'Cargo', type: 'select', required: true, options: [
            { value: 'Membro', label: 'Membro' },
            { value: 'Líder', label: 'Líder' },
            { value: 'Diácono', label: 'Diácono' },
            { value: 'Presbítero', label: 'Presbítero' },
            { value: 'Pastor', label: 'Pastor' },
          ]},
          { name: 'address', label: 'Endereço', type: 'textarea', placeholder: 'Endereço completo' },
          { name: 'notes', label: 'Observações', type: 'textarea', placeholder: 'Notas adicionais' },
        ],
        onSubmit: handleSubmit,
        initialValues: member || { status: 'Ativo', role: 'Membro' },
        submitLabel: member ? 'Salvar Alterações' : 'Cadastrar',
      });
      
      form.addEventListener('cancel', () => { showModal = false; editingMember = null; render(); });
      
      return createElement('div', {}, [
        formError && Alert({ type: 'error', message: formError, dismissible: true, onDismiss: () => { formError = null; renderModalContent(); } }),
        form,
      ]);
    }
    
    return renderModalContent();
  }
  
  await fetchMembers();
}