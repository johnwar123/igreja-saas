import { createElement, Card, Table, Button, Badge, Modal, Form, Alert, Spinner } from '../components.js';
import { api } from '../api.js';
import { hasRole } from '../auth.js';

export async function renderSongsPage(container) {
  container.innerHTML = '';
  
  let songs = [];
  let total = 0;
  let page = 1;
  const limit = 20;
  let loading = false;
  let error = null;
  let showModal = false;
  let editingSong = null;
  let deleteConfirm = null;
  
  const canWrite = hasRole('pastor', 'secretario');
  const canDelete = hasRole('pastor');
  
  const categoryOptions = ['Louvor', 'Adoração', 'Celebração', 'Outros'];
  
  async function fetchSongs() {
    loading = true;
    error = null;
    render();
    
    try {
      const res = await api.songs.list({ limit, offset: (page - 1) * limit });
      songs = res.songs || [];
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
      await api.songs.create(data);
      showModal = false;
      editingSong = null;
      await fetchSongs();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  async function handleUpdate(id, data) {
    try {
      await api.songs.update(id, data);
      showModal = false;
      editingSong = null;
      await fetchSongs();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  async function handleDelete(id) {
    try {
      await api.songs.delete(id);
      deleteConfirm = null;
      await fetchSongs();
    } catch (e) {
      return { error: e.message };
    }
  }
  
  function openCreate() {
    editingSong = null;
    showModal = true;
    render();
  }
  
  function openEdit(song) {
    editingSong = song;
    showModal = true;
    render();
  }
  
  function confirmDelete(song) {
    deleteConfirm = song;
    render();
  }
  
  function render() {
    const columns = [
      { key: 'title', header: 'Título' },
      { key: 'author', header: 'Autor', render: (row) => row.author || '-' },
      { key: 'category', header: 'Categoria', render: (row) => Badge({ label: row.category, variant: 'purple' }) },
      { key: 'key_signature', header: 'Tom', render: (row) => row.key_signature || '-' },
      { key: 'bpm', header: 'BPM', render: (row) => row.bpm || '-' },
    ];
    
    const actions = canWrite ? [
      { label: 'Editar', variant: 'secondary', handler: openEdit },
      ...(canDelete ? [{ label: 'Excluir', variant: 'danger', handler: confirmDelete }] : []),
    ] : undefined;
    
    const content = createElement('div', { class: 'page-content-inner' }, [
      createElement('div', { class: 'page-header' }, [
        createElement('div', {}, [
          createElement('h1', {}, 'Louvor - Repertório'),
          createElement('p', { class: 'page-subtitle' }, 'Gerencie as músicas da igreja'),
        ]),
        canWrite && Button({ label: 'Nova Música', variant: 'primary', onclick: openCreate }),
      ]),
      
      error && Alert({ type: 'error', message: error, dismissible: true, onDismiss: () => { error = null; render(); } }),
      
      Card({
        children: loading ? createElement('div', { class: 'page-loading' }, Spinner({ size: 'lg' })) : 
          songs.length > 0 ? Table({ columns, data: songs, actions, onRowClick: openEdit }) :
          createElement('div', { class: 'empty-state' }, [
            createElement('p', {}, 'Nenhuma música cadastrada'),
            canWrite && Button({ label: 'Cadastrar Primeira Música', variant: 'primary', onclick: openCreate, style: { marginTop: '16px' } }),
          ]),
        footer: total > limit ? createElement('div', { class: 'pagination' }, [
          createElement('span', {}, `Página ${page} de ${Math.ceil(total / limit)} — Total: ${total}`),
          createElement('div', { class: 'pagination-controls' }, [
            Button({ label: 'Anterior', variant: 'secondary', size: 'sm', disabled: page === 1, onclick: () => { page--; fetchSongs(); } }),
            Button({ label: 'Próxima', variant: 'secondary', size: 'sm', disabled: page >= Math.ceil(total / limit), onclick: () => { page++; fetchSongs(); } }),
          ]),
        ]) : undefined,
      }),
    ]);
    
    container.innerHTML = '';
    container.appendChild(content);
    
    if (showModal) {
      const modalContent = editingSong ? renderSongForm(editingSong) : renderSongForm();
      container.appendChild(Modal({
        isOpen: true,
        title: editingSong ? 'Editar Música' : 'Nova Música',
        size: 'lg',
        onClose: () => { showModal = false; editingSong = null; render(); },
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
  
  function renderSongForm(song = null) {
    let formError = null;
    
    const handleSubmit = async (data) => {
      formError = null;
      const payload = {
        ...data,
        bpm: data.bpm ? Number(data.bpm) : null,
      };
      const result = song ? await handleUpdate(song.id, payload) : await handleCreate(payload);
      if (result?.error) {
        formError = result.error;
        renderModalContent();
      }
    };
    
    function renderModalContent() {
      const form = Form({
        fields: [
          { name: 'title', label: 'Título *', type: 'text', required: true, placeholder: 'Título da música' },
          { name: 'author', label: 'Autor', type: 'text', placeholder: 'Autor/Compositor' },
          { name: 'category', label: 'Categoria *', type: 'select', required: true, options: categoryOptions.map(c => ({ value: c, label: c })) },
          { name: 'key_signature', label: 'Tom', type: 'text', placeholder: 'Ex: D, G, A menor' },
          { name: 'bpm', label: 'BPM', type: 'number', min: '1', max: '300', placeholder: 'Ex: 120' },
          { name: 'lyrics', label: 'Letra', type: 'textarea', placeholder: 'Letra da música', rows: 8 },
          { name: 'chords', label: 'Cifras', type: 'textarea', placeholder: 'Cifras/acordes', rows: 8 },
        ],
        onSubmit: handleSubmit,
        initialValues: song || { category: 'Louvor' },
        submitLabel: song ? 'Salvar Alterações' : 'Cadastrar Música',
      });
      
      form.addEventListener('cancel', () => { showModal = false; editingSong = null; render(); });
      
      return createElement('div', {}, [
        formError && Alert({ type: 'error', message: formError, dismissible: true, onDismiss: () => { formError = null; renderModalContent(); } }),
        form,
      ]);
    }
    
    return renderModalContent();
  }
  
  await fetchSongs();
}