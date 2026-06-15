import { createElement, Card, Table, Button, Badge, Modal, Form, Alert, Spinner } from '../components.js';
import { api } from '../api.js';
import { hasRole } from '../auth.js';

export async function renderTithesPage(container) {
  container.innerHTML = '';
  let tithes = [];
  let total = 0;
  let summary = [];
  let page = 1;
  const limit = 20;
  let loading = false;
  let error = null;
  let showModal = false;
  let editingTithe = null;
  let deleteConfirm = null;
  const canWrite = hasRole('pastor', 'secretario', 'tesoureiro');
  const canDelete = hasRole('pastor', 'tesoureiro');
  const typeOptions = ['Dízimo', 'Oferta', 'Missões', 'Construção', 'Outros'];
  const paymentOptions = ['Dinheiro', 'PIX', 'Cartão', 'Transferência', 'Outros'];
  async function fetchTithes() {
    loading = true;
    error = null;
    render();
    
    try {
      const [listRes, summaryRes] = await Promise.all([
        api.tithes.list({ limit, offset: (page - 1) * limit }),
        api.tithes.list({ limit: 1 }),
      ]);
      tithes = listRes.tithes || [];
      total = listRes.total || 0;
      summary = summaryRes.summary || [];
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
      render();
    }
  async function handleCreate(data) {
    try {
      await api.tithes.create(data);
      showModal = false;
      editingTithe = null;
      await fetchTithes();
    } catch (e) {
      return { error: e.message };
    }
  async function handleUpdate(id, data) {
    try {
      await api.tithes.update(id, data);
      showModal = false;
      editingTithe = null;
      await fetchTithes();
    } catch (e) {
      return { error: e.message };
    }
  async function handleDelete(id) {
    try {
      await api.tithes.delete(id);
      deleteConfirm = null;
      await fetchTithes();
    } catch (e) {
      return { error: e.message };
    }
  function openCreate() {
    editingTithe = null;
    showModal = true;
    render();
  function openEdit(tithe) {
    editingTithe = tithe;
    showModal = true;
    render();
  function confirmDelete(tithe) {
    deleteConfirm = tithe;
    render();
  async function render() {
    const columns = [
      { key: 'name', header: 'Nome' },
      { key: 'member_name', header: 'Membro', render: (row) => row.member_name || 'Avulso' },
      { key: 'type', header: 'Tipo', render: (row) => Badge({ label: row.type, variant: row.type === 'Dízimo' ? 'primary' : 'default' }) },
      { key: 'amount', header: 'Valor', render: (row) => `R$ ${Number(row.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
      { key: 'payment_method', header: 'Método', render: (row) => Badge({ label: row.payment_method, variant: 'info' }) },
      { key: 'date', header: 'Data', render: (row) => new Date(row.date).toLocaleDateString('pt-BR') },
    ];
    
    const actions = canWrite ? [
      { label: 'Editar', variant: 'secondary', handler: openEdit },
      ...(canDelete ? [{ label: 'Excluir', variant: 'danger', handler: confirmDelete }] : []),
    ] : undefined;
    
    const summaryCards = typeOptions.map(type => {
      const s = summary.find(x => x.type === type);
      return createElement('div', { class: 'stat-card' }, [
        createElement('div', { class: 'stat-icon', style: { backgroundColor: type === 'Dízimo' ? 'rgba(15,52,96,0.1)' : 'rgba(37,99,235,0.1)', color: type === 'Dízimo' ? 'var(--primary)' : 'var(--info)' } }, '💰'),
        createElement('div', { class: 'stat-content' }, [
          createElement('p', { class: 'stat-label' }, type),
          createElement('h2', { class: 'stat-value' }, s ? `R$ ${Number(s.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00'),
          createElement('small', { style: { color: 'var(--text-muted)' } }, `${s?.count || 0} registros`),
        ]),
      ]);
    });
    
    const content = createElement('div', { class: 'page-content-inner' }, [
      createElement('div', { class: 'page-header' }, [
        createElement('div', {}, [
          createElement('h1', {}, 'Dízimos e Ofertas'),
          createElement('p', { class: 'page-subtitle' }, 'Controle financeiro da igreja'),
        ]),
        canWrite && Button({ label: 'Novo Registro', variant: 'primary', onclick: openCreate }),
      ]),
      
      error && Alert({ type: 'error', message: error, dismissible: true, onDismiss: () => { error = null; render(); } }),
      
      Card({
        title: 'Resumo por Tipo',
        children: createElement('div', { class: 'stats-grid' }, summaryCards),
      }),
      
      Card({
        children: loading ? createElement('div', { class: 'page-loading' }, Spinner({ size: 'lg' })) : 
          tithes.length > 0 ? Table({ columns, data: tithes, actions, onRowClick: openEdit }) :
          createElement('div', { class: 'empty-state' }, [
            createElement('p', {}, 'Nenhum registro financeiro'),
            canWrite && Button({ label: 'Cadastrar Primeiro', variant: 'primary', onclick: openCreate, style: { marginTop: '16px' } }),
          ]),
        footer: total > limit ? createElement('div', { class: 'pagination' }, [
          createElement('span', {}, `Página ${page} de ${Math.ceil(total / limit)} — Total: ${total}`),
          createElement('div', { class: 'pagination-controls' }, [
            Button({ label: 'Anterior', variant: 'secondary', size: 'sm', disabled: page === 1, onclick: () => { page--; fetchTithes(); } }),
            Button({ label: 'Próxima', variant: 'secondary', size: 'sm', disabled: page >= Math.ceil(total / limit), onclick: () => { page++; fetchTithes(); } }),
          ]),
        ]) : undefined,
      }),
    ]);
    
    container.innerHTML = '';
    container.appendChild(content);
    
    if (showModal) {
      const modalContent = await renderTitheForm(editingTithe);
      container.appendChild(Modal({
        isOpen: true,
        title: editingTithe ? 'Editar Registro' : 'Novo Registro',
        size: 'md',
        onClose: () => { showModal = false; editingTithe = null; render(); },
        children: modalContent,
      }));
    }
    
    if (deleteConfirm) {
      container.appendChild(Modal({
        isOpen: true,
        title: 'Confirmar Exclusão',
        onClose: () => { deleteConfirm = null; render(); },
        children: createElement('div', {}, [
          createElement('p', {}, `Tem certeza que deseja excluir <strong>${deleteConfirm.name} - R$ ${Number(deleteConfirm.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>?`),
          createElement('p', { style: { color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '8px' } }, 'Esta ação não pode ser desfeita.'),
          createElement('div', { class: 'form-actions', style: { marginTop: '24px' } }, [
            Button({ label: 'Cancelar', variant: 'secondary', onclick: () => { deleteConfirm = null; render(); } }),
            Button({ label: 'Excluir', variant: 'danger', onclick: () => handleDelete(deleteConfirm.id) }),
          ]),
        ]),
      }));
    }
  await fetchTithes();
}