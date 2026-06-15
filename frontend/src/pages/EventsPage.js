import { createElement, Card, Table, Button, Badge, Modal, Form, Alert, Spinner } from '../components.js';
import { api } from '../api.js';
import { hasRole } from '../auth.js';

export async function renderEventsPage(container) {
  container.innerHTML = '';
  
  let events = [];
  let total = 0;
  let page = 1;
  const limit = 20;
  let loading = false;
  let error = null;
  let showModal = false;
  let editingEvent = null;
  let deleteConfirm = null;
  
  const canWrite = hasRole('pastor', 'secretario');
  const canDelete = hasRole('pastor');
  
  const typeOptions = ['Culto', 'Estudo', 'Evento', 'Reunião', 'Conferência', 'Outros'];
  
  async function fetchEvents() {
    loading = true;
    error = null;
    render();
    
    try {
      const res = await api.events.list({ limit, offset: (page - 1) * limit });
      events = res.events || [];
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
      await api.events.create(data);
      showModal = false;
      editingEvent = null;
      await fetchEvents();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  async function handleUpdate(id, data) {
    try {
      await api.events.update(id, data);
      showModal = false;
      editingEvent = null;
      await fetchEvents();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  async function handleDelete(id) {
    try {
      await api.events.delete(id);
      deleteConfirm = null;
      await fetchEvents();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  function openCreate() {
    editingEvent = null;
    showModal = true;
    render();
  }
  
  function openEdit(event) {
    editingEvent = event;
    showModal = true;
    render();
  }
  
  function confirmDelete(event) {
    deleteConfirm = event;
    render();
  }
  
  function render() {
    const columns = [
      { key: 'title', header: 'Título' },
      { key: 'type', header: 'Tipo', render: (row) => Badge({ label: row.type, variant: 'info' }) },
      { key: 'start_date', header: 'Início', render: (row) => new Date(row.start_date).toLocaleString('pt-BR') },
      { key: 'end_date', header: 'Fim', render: (row) => row.end_date ? new Date(row.end_date).toLocaleString('pt-BR') : '-' },
      { key: 'location', header: 'Local', render: (row) => row.location || '-' },
      { key: 'created_by_name', header: 'Criado por', render: (row) => row.created_by_name || '-' },
    ];
    
    const actions = canWrite ? [
      { label: 'Editar', variant: 'secondary', handler: openEdit },
      ...(canDelete ? [{ label: 'Excluir', variant: 'danger', handler: confirmDelete }] : []),
    ] : undefined;
    
    const upcomingEvents = events.filter(e => new Date(e.start_date) >= new Date());
    const pastEvents = events.filter(e => new Date(e.start_date) < new Date());
    
    const content = createElement('div', { class: 'page-content-inner' }, [
      createElement('div', { class: 'page-header' }, [
        createElement('div', {}, [
          createElement('h1', {}, 'Eventos'),
          createElement('p', { class: 'page-subtitle' }, 'Agenda de cultos e eventos da igreja'),
        ]),
        canWrite && Button({ label: 'Novo Evento', variant: 'primary', onclick: openCreate }),
      ]),
      
      error && Alert({ type: 'error', message: error, dismissible: true, onDismiss: () => { error = null; render(); } }),
      
      upcomingEvents.length > 0 && Card({
        title: `Próximos Eventos (${upcomingEvents.length})`,
        children: Table({ 
          columns, 
          data: upcomingEvents.slice(0, 10), 
          actions,
          onRowClick: openEdit,
        }),
      }),
      
      Card({
        title: `Eventos Passados (${pastEvents.length})`,
        children: loading ? createElement('div', { class: 'page-loading' }, Spinner({ size: 'lg' })) : 
          events.length > 0 ? Table({ columns, data: pastEvents, actions, onRowClick: openEdit }) :
          createElement('div', { class: 'empty-state' }, [
            createElement('p', {}, 'Nenhum evento cadastrado'),
            canWrite && Button({ label: 'Cadastrar Primeiro Evento', variant: 'primary', onclick: openCreate, style: { marginTop: '16px' } }),
          ]),
        footer: total > limit ? createElement('div', { class: 'pagination' }, [
          createElement('span', {}, `Página ${page} de ${Math.ceil(total / limit)} — Total: ${total}`),
          createElement('div', { class: 'pagination-controls' }, [
            Button({ label: 'Anterior', variant: 'secondary', size: 'sm', disabled: page === 1, onclick: () => { page--; fetchEvents(); } }),
            Button({ label: 'Próxima', variant: 'secondary', size: 'sm', disabled: page >= Math.ceil(total / limit), onclick: () => { page++; fetchEvents(); } }),
          ]),
        ]) : undefined,
      }),
    ]);
    
    container.innerHTML = '';
    container.appendChild(content);
    
    if (showModal) {
      const modalContent = editingEvent ? renderEventForm(editingEvent) : renderEventForm();
      container.appendChild(Modal({
        isOpen: true,
        title: editingEvent ? 'Editar Evento' : 'Novo Evento',
        size: 'md',
        onClose: () => { showModal = false; editingEvent = null; render(); },
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
  
  function renderEventForm(event = null) {
    let formError = null;
    
    const handleSubmit = async (data) => {
      formError = null;
      const payload = {
        ...data,
        max_attendees: data.max_attendees ? Number(data.max_attendees) : null,
      };
      const result = event ? await handleUpdate(event.id, payload) : await handleCreate(payload);
      if (result?.error) {
        formError = result.error;
        renderModalContent();
      }
    };
    
    function renderModalContent() {
      const form = Form({
        fields: [
          { name: 'title', label: 'Título *', type: 'text', required: true, placeholder: 'Título do evento' },
          { name: 'description', label: 'Descrição', type: 'textarea', placeholder: 'Descrição do evento' },
          { name: 'start_date', label: 'Data/Hora Início *', type: 'datetime-local', required: true },
          { name: 'end_date', label: 'Data/Hora Fim', type: 'datetime-local' },
          { name: 'location', label: 'Local', type: 'text', placeholder: 'Local do evento' },
          { name: 'type', label: 'Tipo *', type: 'select', required: true, options: typeOptions.map(t => ({ value: t, label: t })) },
          { name: 'max_attendees', label: 'Máx. Participantes', type: 'number', min: '1', placeholder: 'Opcional' },
        ],
        onSubmit: handleSubmit,
        initialValues: event || { type: 'Culto' },
        submitLabel: event ? 'Salvar Alterações' : 'Criar Evento',
      });
      
      form.addEventListener('cancel', () => { showModal = false; editingEvent = null; render(); });
      
      return createElement('div', {}, [
        formError && Alert({ type: 'error', message: formError, dismissible: true, onDismiss: () => { formError = null; renderModalContent(); } }),
        form,
      ]);
    }
    
    return renderModalContent();
  }
  
  await fetchEvents();
}