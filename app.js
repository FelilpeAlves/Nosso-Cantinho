/* Nosso Cantinho — aplicativo local e sem dependências externas.
 * Atenção: este armazenamento não sincroniza dois aparelhos.
 */
(() => {
  'use strict';
  const VERSION = 4;
  const STORAGE_KEY = 'nosso-cantinho-v4';
  const PERSON_KEY = 'nosso-cantinho-person';
  const LEGACY_KEYS = ['nosso-cantinho-v2', 'nosso-cantinho-v1'];
  const PEOPLE = ['Felipe', 'Aline'];
  const CATEGORIES = {
    cozinha: { name: 'Cozinha', file: 'cozinha.svg' },
    banheiro: { name: 'Banheiro', file: 'banheiro.svg' },
    roupas: { name: 'Lavanderia', file: 'roupas.svg' },
    sala: { name: 'Sala', file: 'sala.svg' },
    quarto: { name: 'Quarto', file: 'quarto.svg' },
    geral: { name: 'Outros', file: 'geral.svg' }
  };
  const FREQUENCIES = {once: 'Uma vez', daily: 'Diária', weekly: 'Semanal'};
  const $ = (id) => document.getElementById(id);
  let state;
  let currentPerson = 'Felipe';
  let currentPage = 'home';
  let homeFilter = 'today';
  let listFilter = 'all';
  let gratitudeTaskId = null;
  let storageAvailable = true;
  let toastTimer;

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }
  function uid() {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
  function safeRead(key) { try { return window.localStorage.getItem(key); } catch { storageAvailable = false; return null; } }
  function safeWrite(key, value) { try { window.localStorage.setItem(key, value); return true; } catch { storageAvailable = false; return false; } }
  function dateKey(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function weekKey(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return dateKey(d);
  }
  function isDone(task, now = new Date()) {
    if (!task.done || !task.lastDone) return Boolean(task.done && task.frequency === 'once');
    if (task.frequency === 'daily') return dateKey(task.lastDone) === dateKey(now);
    if (task.frequency === 'weekly') return weekKey(task.lastDone) === weekKey(now);
    return Boolean(task.done);
  }
  function detectCategory(title) {
    const s = String(title).toLocaleLowerCase('pt-BR');
    if (/banheir|vaso|chuveiro|box/.test(s)) return 'banheiro';
    if (/roupa|lavanderia|lençol/.test(s)) return 'roupas';
    if (/cozinha|louça|prato|fogão|pia/.test(s)) return 'cozinha';
    if (/sala|sofá|varrer/.test(s)) return 'sala';
    if (/quarto|cama/.test(s)) return 'quarto';
    return 'geral';
  }
  function normalizeTask(t) {
    if (!t || typeof t.title !== 'string' || !t.title.trim()) return null;
    const title = t.title.trim().slice(0, 90);
    const frequency = ({diaria: 'daily', semanal: 'weekly', unica: 'once'}[t.frequency] || t.frequency);
    return {
      id: String(t.id || uid()).slice(0, 90), title,
      category: CATEGORIES[t.category] ? t.category : detectCategory(title),
      owner: PEOPLE.includes(t.owner) ? t.owner : 'Felipe',
      frequency: FREQUENCIES[frequency] ? frequency : 'once',
      done: Boolean(t.done),
      lastDone: typeof (t.lastDone || t.completedAt) === 'string' ? t.lastDone || t.completedAt : null,
      completedBy: PEOPLE.includes(t.completedBy) ? t.completedBy : null,
      createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString()
    };
  }
  function normalizeMessage(m) {
    if (!m || typeof m.text !== 'string' || !m.text.trim()) return null;
    return {
      id: String(m.id || uid()).slice(0, 90),
      taskId: String(m.taskId || '').slice(0, 90),
      task: String(m.task || '').slice(0, 90),
      author: PEOPLE.includes(m.author) ? m.author : 'Felipe',
      to: PEOPLE.includes(m.to) ? m.to : 'Aline',
      text: m.text.trim().slice(0, 300),
      at: typeof m.at === 'string' ? m.at : new Date().toISOString()
    };
  }
  function samples() {
    return {
      version: VERSION,
      tasks: [
        ['Lavar a louça', 'cozinha', 'Felipe', 'daily'],
        ['Lavar o banheiro', 'banheiro', 'Aline', 'weekly'],
        ['Organizar a roupa', 'roupas', 'Felipe', 'weekly'],
        ['Varrer a sala', 'sala', 'Aline', 'daily']
      ].map(([title, category, owner, frequency]) => ({
        id: uid(), title, category, owner, frequency, done: false,
        lastDone: null, completedBy: null, createdAt: new Date().toISOString()
      })),
      messages: []
    };
  }
  function validateState(raw) {
    if (!raw || !Array.isArray(raw.tasks) || !Array.isArray(raw.messages)) return null;
    if (raw.tasks.length > 1500 || raw.messages.length > 3000) return null;
    return {
      version: VERSION,
      tasks: raw.tasks.map(normalizeTask).filter(Boolean),
      messages: raw.messages.map(normalizeMessage).filter(Boolean)
    };
  }
  function load() {
    const savedPerson = safeRead(PERSON_KEY);
    if (PEOPLE.includes(savedPerson)) currentPerson = savedPerson;
    for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
      const text = safeRead(key);
      if (!text) continue;
      try {
        const loaded = validateState(JSON.parse(text));
        if (loaded) { state = loaded; if (key !== STORAGE_KEY) persist(); return; }
      } catch (error) { console.warn('Backup local não pôde ser carregado:', error); }
    }
    state = samples();
    persist();
  }
  function persist() {
    return safeWrite(STORAGE_KEY, JSON.stringify(state));
  }
  function toast(text) {
    const el = $('toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3300);
  }
  function update() {
    const ok = persist();
    render();
    if (!ok) toast('Atenção: este navegador não está salvando as alterações.');
  }
  function navigate(page) {
    if (!['home', 'tasks', 'routine', 'us'].includes(page)) return;
    currentPage = page;
    document.querySelectorAll('.page').forEach((panel) => {
      const active = panel.id === `page-${page}`;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
    document.querySelectorAll('[data-nav]').forEach((button) => {
      const active = button.dataset.nav === page;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function setHomeFilter(value) {
    if (!['today', 'mine', 'done'].includes(value)) return;
    homeFilter = value;
    document.querySelectorAll('[data-top]').forEach((button) => {
      const active = button.dataset.top === value;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    navigate('home');
    render();
  }
  function setListFilter(value) {
    if (!['all', 'mine', 'pending', 'done'].includes(value)) return;
    listFilter = value;
    document.querySelectorAll('[data-filter]').forEach((button) => button.classList.toggle('is-active', button.dataset.filter === value));
    render();
  }
  function setPerson(person) {
    if (!PEOPLE.includes(person)) return;
    currentPerson = person;
    safeWrite(PERSON_KEY, person);
    $('taskOwner').value = person;
    document.querySelectorAll('[data-person]').forEach((button) => button.classList.toggle('is-active', button.dataset.person === person));
    render();
  }
  function filteredTasks(tasks, filter) {
    if (filter === 'mine') return tasks.filter((t) => t.owner === currentPerson);
    if (filter === 'done') return tasks.filter((t) => isDone(t));
    if (filter === 'pending') return tasks.filter((t) => !isDone(t));
    return tasks;
  }
  function emptyState(text) { return `<div class="empty-state"><span aria-hidden="true">🌷</span>${escapeHTML(text)}</div>`; }
  function icon(name) { return `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`; }
  function taskCard(task) {
    const done = isDone(task);
    const image = `assets/${CATEGORIES[task.category].file}`;
    return `<article class="task-card ${done ? 'is-done' : ''}" data-task-card="${escapeHTML(task.id)}">
      <div class="category-art"><img src="${image}" alt="" loading="lazy"></div>
      <div class="task-body"><h3>${escapeHTML(task.title)}</h3><div class="task-detail">Responsável: <strong>${escapeHTML(task.owner)}</strong><br>${escapeHTML(FREQUENCIES[task.frequency])}</div><span class="task-status ${done ? 'done' : ''}">${done ? '✓ Concluída' : '◷ Pendente'}</span>
      <div class="task-menu" aria-label="Gerenciar tarefa"><button type="button" class="tiny-action" data-action="edit" data-id="${escapeHTML(task.id)}" aria-label="Editar tarefa: ${escapeHTML(task.title)}">✎ Editar</button><button type="button" class="tiny-action tiny-action-danger" data-action="delete" data-id="${escapeHTML(task.id)}" aria-label="Excluir tarefa: ${escapeHTML(task.title)}">🗑 Excluir</button></div>
      </div><div class="task-controls"><button type="button" class="button ${done ? 'button-sage' : 'button-primary'}" data-action="toggle" data-id="${escapeHTML(task.id)}">${done ? '↶ Desfazer' : `${icon('check')} Concluir`}</button>${done ? `<button class="button button-outline" type="button" data-action="thank" data-id="${escapeHTML(task.id)}">♡ Agradecer</button>` : ''}</div>
    </article>`;
  }
  function renderSpotlight() {
    const completed = state.tasks.filter(isDone).sort((a,b) => new Date(b.lastDone || 0) - new Date(a.lastDone || 0));
    const last = completed[0];
    if (!last) {
      $('spotlight').innerHTML = `<div class="spotlight"><div class="spotlight-main"><div class="spotlight-illustration"><img src="assets/geral.svg" alt=""></div><div class="spotlight-copy"><p class="spotlight-kicker">Nossa casa, nosso cuidado</p><h2>Uma tarefa de cada vez! 💗</h2><button class="button button-primary" type="button" data-nav="tasks">${icon('plus')} Criar tarefa</button></div></div><p class="spotlight-note">Quando uma tarefa for concluída, vamos celebrar aqui.</p></div>`;
      return;
    }
    const lastMessage = state.messages.find((m) => m.taskId === last.id);
    $('spotlight').innerHTML = `<div class="spotlight"><div class="spotlight-main"><div class="spotlight-illustration"><img src="assets/${CATEGORIES[last.category].file}" alt=""></div><div class="spotlight-copy"><p class="spotlight-kicker">${escapeHTML(last.completedBy || last.owner)} concluiu:</p><h2>${escapeHTML(last.title)} 🎉</h2><div class="spotlight-actions"><button type="button" class="button button-primary" data-action="thank" data-id="${escapeHTML(last.id)}">👏 Parabenizar</button><button type="button" class="button button-outline" data-action="share" data-id="${escapeHTML(last.id)}">♡ WhatsApp</button></div></div></div><p class="spotlight-note">${lastMessage ? `<b>${escapeHTML(lastMessage.author)}:</b> ${escapeHTML(lastMessage.text)}` : '💌 Pequenos cuidados também merecem reconhecimento!'}</p></div>`;
  }
  function render() {
    renderSpotlight();
    const homeTasks = filteredTasks(state.tasks, homeFilter === 'today' ? 'all' : homeFilter);
    $('todayTasks').innerHTML = homeTasks.length ? homeTasks.map(taskCard).join('') : emptyState(homeFilter === 'done' ? 'Ainda não temos tarefas concluídas. Bora começar?' : 'Nenhuma tarefa por aqui. Que tal criar a primeira?');
    const allTasks = filteredTasks(state.tasks, listFilter);
    $('allTasks').innerHTML = allTasks.length ? allTasks.map(taskCard).join('') : emptyState('Nenhuma tarefa encontrada nesse filtro.');
    const repeatTasks = state.tasks.filter(t => t.frequency !== 'once');
    $('routineTasks').innerHTML = repeatTasks.length ? repeatTasks.map(taskCard).join('') : emptyState('Cadastre uma tarefa diária ou semanal pra montar a rotina.');
    const done = state.tasks.filter(isDone).length;
    $('stats').innerHTML = `<div class="stat"><strong>${done}</strong><span>Concluídas neste ciclo</span></div><div class="stat"><strong>${state.tasks.length - done}</strong><span>Pendentes agora</span></div>`;
    $('messages').innerHTML = state.messages.length
      ? state.messages.slice(0, 70).map((m) => `<article class="message"><strong>💗 ${escapeHTML(m.author)} para ${escapeHTML(m.to)}</strong><p>${escapeHTML(m.text)}</p><time>${escapeHTML(m.task)} · ${formatDate(m.at)}</time></article>`).join('')
      : emptyState('Ainda não tem recadinhos no mural. Que tal começar?');
    document.querySelectorAll('[data-person]').forEach((button) => button.classList.toggle('is-active', button.dataset.person === currentPerson));
  }
  function formatDate(iso) {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
  }
  function resetForm() {
    $('taskForm').reset();
    $('taskId').value = '';
    $('taskOwner').value = currentPerson;
    $('editorTitle').textContent = 'Adicionar tarefa ✨';
    $('saveTask').innerHTML = `${icon('plus')} Adicionar tarefa`;
    $('cancelEdit').hidden = true;
  }
  function editTask(task) {
    navigate('tasks');
    $('taskId').value = task.id;
    $('taskTitle').value = task.title;
    $('taskOwner').value = task.owner;
    $('taskCategory').value = task.category;
    $('taskFrequency').value = task.frequency;
    $('editorTitle').textContent = 'Editar tarefa ✏️';
    $('saveTask').textContent = 'Salvar alterações';
    $('cancelEdit').hidden = false;
    $('taskTitle').focus();
  }
  function submitTask(event) {
    event.preventDefault();
    const title = $('taskTitle').value.trim();
    if (!title) return;
    const owner = $('taskOwner').value;
    const category = $('taskCategory').value;
    const frequency = $('taskFrequency').value;
    if (!PEOPLE.includes(owner) || !CATEGORIES[category] || !FREQUENCIES[frequency]) {
      toast('Revise os dados da tarefa.'); return;
    }
    const existing = state.tasks.find(t => t.id === $('taskId').value);
    const values = {title: title.slice(0,90), owner, category, frequency};
    if (existing) {
      Object.assign(existing, values);
      toast('Tarefa atualizada! ♡');
    } else {
      state.tasks.unshift({id: uid(), ...values, done: false, lastDone: null, completedBy: null, createdAt: new Date().toISOString()});
      toast('Tarefa adicionada com carinho! ♡');
    }
    resetForm();
    update();
  }
  function toggleTask(task) {
    if (isDone(task)) {
      task.done = false;
      task.lastDone = null;
      task.completedBy = null;
      toast('Tarefa voltou para pendente.');
    } else {
      task.done = true;
      task.lastDone = new Date().toISOString();
      task.completedBy = currentPerson;
      toast(`Boa! ${currentPerson} concluiu ${task.title} 🎉`);
    }
    update();
  }
  function askThanks(task) {
    gratitudeTaskId = task.id;
    const receiver = task.completedBy || task.owner;
    $('thanksPrompt').textContent = `Um recadinho para ${receiver} por “${task.title}”`;
    $('thanksText').value = '';
    if (typeof $('thanksDialog').showModal === 'function') $('thanksDialog').showModal();
    else {
      const message = window.prompt(`Escreva um carinho para ${receiver}:`, 'Obrigado por cuidar do nosso cantinho! ❤️');
      if (message?.trim()) saveThanks(task, message.trim());
    }
  }
  function saveThanks(task, text) {
    state.messages.unshift({id: uid(), taskId: task.id, task: task.title, author: currentPerson, to: task.completedBy || task.owner, text: text.slice(0, 300), at: new Date().toISOString()});
    toast('Carinho guardado no mural! 💗');
    update();
  }
  function shareWhatsApp(task) {
    const person = task.completedBy || task.owner;
    const message = `💗 No Nosso Cantinho, ${person} concluiu “${task.title}”! Obrigado pelo carinho e por cuidar da nossa casa. 🏡❤️`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  function onClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.nav) { navigate(button.dataset.nav); return; }
    if (button.dataset.top) { setHomeFilter(button.dataset.top); return; }
    if (button.dataset.filter) { setListFilter(button.dataset.filter); return; }
    if (button.dataset.person) { setPerson(button.dataset.person); return; }
    if (button.dataset.preset) { $('thanksText').value = button.dataset.preset; return; }
    if (!button.dataset.action) return;
    const task = state.tasks.find((t) => t.id === button.dataset.id);
    if (!task) return;
    switch (button.dataset.action) {
      case 'toggle': toggleTask(task); break;
      case 'edit': editTask(task); break;
      case 'delete':
        if (window.confirm(`Excluir a tarefa “${task.title}”?`)) {
          state.tasks = state.tasks.filter((t) => t.id !== task.id);
          if ($('taskId').value === task.id) resetForm();
          update(); toast('Tarefa excluída.');
        }
        break;
      case 'thank': askThanks(task); break;
      case 'share': shareWhatsApp(task); break;
    }
  }
  function exportBackup() {
    const data = JSON.stringify({...state, exportedAt: new Date().toISOString()}, null, 2);
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nosso-cantinho-backup-${dateKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Backup preparado! ♡');
  }
  async function importBackup(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Arquivo muito grande');
      const loaded = validateState(JSON.parse(await file.text()));
      if (!loaded) throw new Error('Dados inválidos');
      if (window.confirm('Importar este backup vai substituir as tarefas e mensagens salvas neste aparelho. Continuar?')) {
        state = loaded; update(); resetForm(); toast('Backup importado com sucesso! ♡');
      }
    } catch (error) {
      console.warn(error);
      window.alert('Não foi possível importar. Escolha um backup JSON do Nosso Cantinho.');
    } finally { input.value = ''; }
  }
  function init() {
    try {
      load();
      $('taskForm').addEventListener('submit', submitTask);
      $('cancelEdit').addEventListener('click', resetForm);
      document.addEventListener('click', onClick);
      $('cancelThanks').addEventListener('click', () => $('thanksDialog').close());
      $('thanksForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const task = state.tasks.find(t => t.id === gratitudeTaskId);
        const text = $('thanksText').value.trim();
        if (task && text) saveThanks(task, text);
        $('thanksDialog').close();
      });
      $('exportBtn').addEventListener('click', exportBackup);
      $('importFile').addEventListener('change', importBackup);
      resetForm();
      navigate('home');
      render();
      if (!storageAvailable) toast('Aviso: este navegador bloqueou o salvamento. Use o GitHub Pages.');
      document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Offline indisponível:', error));
      }
    } catch (error) {
      console.error('Nosso Cantinho não iniciou:', error);
      $('fatalError').hidden = false;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
