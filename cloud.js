/* Nosso Cantinho — integração opcional Firebase Auth + Firestore.
   NUNCA colocar senhas, service account keys ou tokens privados neste arquivo.
   Sem configuração Firebase o app local continua funcionando normalmente.
*/
(() => {
  'use strict';
  const CONFIG = window.NOSSO_CANTINHO_FIREBASE || {};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const configured = ['apiKey','authDomain','projectId','appId'].every((key) =>
    typeof CONFIG[key] === 'string' && CONFIG[key].trim() && !/COLE|YOUR_|EXEMPLO/i.test(CONFIG[key]));
  const PANEL = 'syncPanel';
  let bridge, api, auth, db, user, homeId = null, home = null, requests = [];
  let taskDocs = null, messageDocs = null, gotTasks = false, gotMessages = false;
  let stopHome = null, stopTasks = null, stopMessages = null, stopRequests = null, stopPending = null;
  let initialized = false, previouslyReady = false, busy = false, pendingId = null;

  function notice(message) { bridge?.toast?.(message); }
  function status(text, linked = false) {
    if ($('syncStatus')) { $('syncStatus').textContent = text; $('syncStatus').classList.toggle('is-linked', linked); }
  }
  function cleanup() {
    [stopHome,stopTasks,stopMessages,stopRequests,stopPending].forEach((stop) => {try {stop?.();} catch {}});
    stopHome = stopTasks = stopMessages = stopRequests = stopPending = null;
    homeId = null; home = null; requests = [];
    taskDocs = messageDocs = null; gotTasks = gotMessages = previouslyReady = false;
    pendingId = null;
    bridge?.setLocalMode?.();
  }
  function messageFor(error) {
    const code = error?.code || '';
    const messages = {
      'auth/email-already-in-use': 'Esse e-mail já tem conta. Use Entrar.',
      'auth/invalid-email': 'Confira o endereço de e-mail.',
      'auth/weak-password': 'Sua senha precisa ter pelo menos 6 caracteres.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
      'permission-denied': 'Permissão negada. Confira as regras do Firestore ou a aprovação da casa.',
      'unavailable': 'Sem conexão com o banco. Verifique sua internet.'
    };
    return messages[code] || `Não foi possível concluir (${code || 'erro de conexão'}).`;
  }
  async function run(action) {
    if (busy) return;
    busy = true;
    render();
    try { await action(); }
    catch (error) { console.error('Nosso Cantinho / Firebase:', error); notice(messageFor(error)); }
    finally { busy = false; render(); }
  }
  function emailText() { return user?.email ? esc(user.email) : ''; }
  function render() {
    const panel = $(PANEL);
    if (!panel) return;
    if (!configured) {
      status('Modo local — falta configurar sincronização');
      panel.innerHTML = `<p class="sync-text">Para vocês verem as mesmas tarefas, falta conectar o Firebase gratuito. As tarefas atuais continuam salvas neste celular.</p><p class="helper">O projeto já tem suporte a sincronização, mas precisa da configuração do Firebase e das regras de acesso antes de ligar.</p>`;
      return;
    }
    if (!initialized) {
      status('Preparando conexão…');
      panel.innerHTML = '<p class="sync-text">Conectando ao banco de dados…</p>';
      return;
    }
    if (!user) {
      status('Modo local — entre para compartilhar');
      panel.innerHTML = `<p class="sync-text">Entre com sua conta. Felipe e Aline precisam usar contas diferentes.</p>
        <form id="cloudLogin" class="sync-form">
          <label class="field">E-mail<input type="email" name="email" autocomplete="email" required></label>
          <label class="field">Senha<input type="password" name="password" autocomplete="current-password" minlength="6" required></label>
          <div class="sync-buttons"><button type="submit" class="button button-primary" name="authAction" value="login" ${busy?'disabled':''}>Entrar</button>
          <button type="submit" class="button button-outline" name="authAction" value="register" ${busy?'disabled':''}>Criar conta</button></div>
        </form><p class="helper">Crie uma conta com um e-mail seu. A senha não é enviada ao GitHub nem fica salva neste aplicativo.</p>`;
      return;
    }
    const account = `<div class="sync-account">Conectado como <strong>${emailText()}</strong> <button type="button" class="tiny-action" data-cloud="logout">Sair</button></div>`;
    if (homeId && home && gotTasks && gotMessages) {
      const myRequests = home.ownerUid === user.uid ? requests.filter((r) => r.status === 'pending') : [];
      status('Compartilhado — atualizado em tempo real', true);
      panel.innerHTML = `${account}<div class="sync-success"><strong>✓ Celulares conectados à mesma casa</strong><p>Tudo que vocês adicionarem ou concluírem aparece nos dois aparelhos conectados à internet.</p></div>
        <div class="invite-line"><span><small>Código da casa</small><strong>${esc(homeId)}</strong></span><button type="button" class="button button-outline" data-cloud="copy">Copiar</button></div>
        <p class="helper">${home.members?.length || 1} de 2 pessoas conectadas. Compartilhe o código apenas com a Aline.</p>
        ${myRequests.length ? `<div class="pending-requests"><h4>Aguardando sua aprovação</h4>${myRequests.map((r) => `<div class="request-line"><span>${esc(r.email)}</span><button type="button" class="button button-primary" data-cloud="approve" data-uid="${esc(r.uid)}">Autorizar</button></div>`).join('')}</div>` : ''}
        <div class="sync-buttons"><button class="button button-outline" type="button" data-cloud="migrate">Adicionar minhas tarefas locais à casa</button><button class="button button-soft" type="button" data-cloud="notify">Ativar avisos</button></div>
        <p class="helper">Avisos aparecem quando o aplicativo está aberto. Notificações com o aplicativo totalmente fechado ainda não estão disponíveis.</p>`;
      return;
    }
    if (pendingId) {
      status('Aguardando Felipe/Aline aprovar o acesso');
      panel.innerHTML = `${account}<p class="sync-text">Seu pedido foi enviado! A outra pessoa precisa abrir <strong>Nós</strong> e aprovar seu acesso. Depois a lista aparecerá automaticamente.</p><div class="sync-buttons"><button type="button" class="button button-outline" data-cloud="check">Verificar acesso</button><button type="button" class="button button-soft" data-cloud="change">Trocar código</button></div>`;
      return;
    }
    status('Modo local — falta conectar a casa');
    panel.innerHTML = `${account}<p class="sync-text">Uma pessoa cria a casa. A outra entra com o código que recebeu.</p>
      <button class="button button-primary" type="button" data-cloud="create" ${busy?'disabled':''}>Criar nossa casa ♡</button>
      <form id="cloudJoin" class="sync-form"><label class="field">Já tem o código? Digite aqui<input name="code" minlength="15" maxlength="80" autocomplete="off" placeholder="Código que o Felipe enviou" required></label>
      <button class="button button-outline" type="submit" ${busy?'disabled':''}>Pedir para entrar</button></form>
      <p class="helper">Quem criou a casa aprova o pedido na tela Nós. Só então as tarefas ficam compartilhadas.</p>`;
  }
  function applySnapshots() {
    if (!gotTasks || !gotMessages || !homeId) return;
    const tasks = [...taskDocs].sort((a,b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const messages = [...messageDocs].sort((a,b) => (b.at || '').localeCompare(a.at || ''));
    bridge?.receiveCloudState?.({tasks,messages}, {notify: previouslyReady});
    previouslyReady = true;
    render();
  }
  function listenHome(id) {
    cleanup();
    homeId = id;
    try { localStorage.setItem(`nosso-cantinho-home-${user.uid}`, id); } catch {}
    const homeRef = api.doc(db,'homes',id);
    stopHome = api.onSnapshot(homeRef, (snapshot) => {
      if (!snapshot.exists()) { notice('Casa não encontrada.'); cleanup(); render(); return; }
      home = snapshot.data();
      if (home.ownerUid !== user.uid && home.ownerName) {
        bridge?.choosePerson?.(home.ownerName === 'Felipe' ? 'Aline' : 'Felipe');
      }
      if (!stopTasks) {
        stopTasks = api.onSnapshot(api.collection(db,'homes',id,'tasks'), (snap) => {
          taskDocs = snap.docs.map((item) => item.data()); gotTasks = true; applySnapshots();
        }, onListenError);
        stopMessages = api.onSnapshot(api.collection(db,'homes',id,'messages'), (snap) => {
          messageDocs = snap.docs.map((item) => item.data()); gotMessages = true; applySnapshots();
        }, onListenError);
      }
      if (home.ownerUid === user.uid && !stopRequests) {
        stopRequests = api.onSnapshot(api.collection(db,'homes',id,'requests'), (snap) => {
          requests = snap.docs.map((d) => d.data()); render();
        }, onListenError);
      }
      render();
    }, onListenError);
  }
  function onListenError(error) { console.error('Escuta Firebase:', error); notice(messageFor(error)); }
  function watchPending(id) {
    pendingId = id;
    const ref = api.doc(db,'homes',id,'requests',user.uid);
    stopPending?.();
    stopPending = api.onSnapshot(ref, (doc) => {
      if (doc.exists() && doc.data().status === 'approved') { stopPending?.(); stopPending = null; pendingId = null; listenHome(id); }
    }, onListenError);
    render();
  }
  async function restoreHome() {
    if (!user) return;
    let id = '';
    try { id = localStorage.getItem(`nosso-cantinho-home-${user.uid}`) || ''; } catch {}
    if (!id) { render(); return; }
    // Pode estar pendente; o próprio usuário só tem acesso ao pedido até ser aprovado.
    try {
      const request = await api.getDoc(api.doc(db,'homes',id,'requests',user.uid));
      if (request.exists() && request.data().status === 'pending') { watchPending(id); return; }
    } catch (error) { console.warn('Pedido de acesso não encontrado:',error); }
    try {
      const doc = await api.getDoc(api.doc(db,'homes',id));
      if (doc.exists()) { listenHome(id); return; }
    } catch (error) { console.warn('Casa ainda não acessível:',error); }
    render();
  }
  async function createHome() {
    const payload = {ownerUid:user.uid,ownerName:bridge?.person?.() || 'Felipe',members:[user.uid],title:'Nosso Cantinho',createdAt:new Date().toISOString()};
    const ref = await api.addDoc(api.collection(db,'homes'),payload);
    listenHome(ref.id);
    notice('Nossa casa foi criada! Agora compartilhe o código. ♡');
  }
  async function requestHome(code) {
    const id = code.trim();
    if (!/^[a-zA-Z0-9]{15,80}$/.test(id)) { notice('Confira o código recebido.'); return; }
    const requestRef = api.doc(db,'homes',id,'requests',user.uid);
    const existing = await api.getDoc(requestRef);
    if (existing.exists()) {
      if (existing.data().status === 'approved') { listenHome(id); return; }
      watchPending(id); return;
    }
    await api.setDoc(requestRef,{uid:user.uid,email:user.email,status:'pending',requestedAt:new Date().toISOString()});
    try { localStorage.setItem(`nosso-cantinho-home-${user.uid}`,id); } catch {}
    watchPending(id);
    notice('Pedido enviado! Aguarde a aprovação.');
  }
  async function approve(uid) {
    if (!home || home.ownerUid !== user.uid) return;
    if (home.members.includes(uid)) { notice('Esta pessoa já participa da casa.'); return; }
    if (home.members.length >= 2) { notice('Essa casa já tem duas pessoas.'); return; }
    const request = requests.find((r) => r.uid === uid && r.status === 'pending');
    if (!request || !window.confirm(`Permitir que ${request.email} veja e edite as tarefas da casa?`)) return;
    const batch = api.writeBatch(db);
    batch.update(api.doc(db,'homes',homeId), {members:api.arrayUnion(uid)});
    batch.update(api.doc(db,'homes',homeId,'requests',uid), {status:'approved'});
    await batch.commit();
    notice(`${request.email} agora participa do Nosso Cantinho! ♡`);
  }
  async function copyCode() {
    if (!homeId) return;
    try { await navigator.clipboard.writeText(homeId); notice('Código copiado! Envie pelo WhatsApp.'); }
    catch { window.prompt('Copie este código e envie para a Aline:',homeId); }
  }
  async function enableNotices() {
    if (!('Notification' in window) && !('serviceWorker' in navigator)) { notice('Este aparelho não oferece notificações neste navegador.'); return; }
    if (typeof Notification === 'undefined') { notice('Este navegador não oferece permissão de avisos.'); return; }
    try {
      const permission = await Notification.requestPermission();
      notice(permission === 'granted' ? 'Avisos autorizados quando o aplicativo estiver em execução! ♡' : 'Avisos não autorizados.');
    } catch { notice('Seu navegador não permitiu ativar os avisos.'); }
  }
  async function importState(data) {
    if (!homeId) throw new Error('A casa não está conectada.');
    const entries = [
      ...data.tasks.map((t) => ['tasks',t]),
      ...data.messages.map((m) => ['messages',m])
    ];
    for (let i = 0; i < entries.length; i += 400) {
      const batch = api.writeBatch(db);
      for (const [type,obj] of entries.slice(i,i+400)) {
        batch.set(api.doc(db,'homes',homeId,type,obj.id),{...obj,updatedAt:new Date().toISOString()});
      }
      await batch.commit();
    }
  }
  async function handlePanel(event) {
    const btn = event.target.closest('[data-cloud]');
    if (!btn) return;
    const action = btn.dataset.cloud;
    if (action === 'logout') return run(() => api.signOut(auth));
    if (action === 'create') return run(createHome);
    if (action === 'approve') return run(() => approve(btn.dataset.uid));
    if (action === 'copy') return copyCode();
    if (action === 'notify') return enableNotices();
    if (action === 'check') return run(restoreHome);
    if (action === 'change') {stopPending?.();stopPending=null;pendingId=null;render();return;}
    if (action === 'migrate') {
      const old = bridge?.localState?.();
      if (!old || (!old.tasks.length && !old.messages.length)) {notice('Não há tarefas locais para importar.');return;}
      if (!window.confirm(`Adicionar ${old.tasks.length} tarefas e ${old.messages.length} recados antigos à casa compartilhada? Isso não apaga os dados atuais.`))return;
      return run(async()=>{await importState(old);notice('Tarefas locais adicionadas à casa! ♡');});
    }
  }
  async function handleForm(event) {
    if (event.target?.id === 'cloudLogin') {
      event.preventDefault();
      const data = new FormData(event.target);
      const email = String(data.get('email')||'').trim();
      const password = String(data.get('password')||'');
      const action = event.submitter?.value || 'login';
      return run(async() => {
        if (action === 'register') await api.createUserWithEmailAndPassword(auth,email,password);
        else await api.signInWithEmailAndPassword(auth,email,password);
      });
    }
    if (event.target?.id === 'cloudJoin') {
      event.preventDefault();
      return run(() => requestHome(String(new FormData(event.target).get('code') || '')));
    }
  }
  const controller = {
    get active() { return Boolean(user && homeId && gotTasks && gotMessages); },
    async putTask(task) {
      if (!this.active) return;
      try {await api.setDoc(api.doc(db,'homes',homeId,'tasks',task.id),{...task,updatedAt:new Date().toISOString()});}
      catch(error){notice(messageFor(error));throw error;}
    },
    async deleteTask(taskId) {
      if (!this.active) return;
      try {await api.deleteDoc(api.doc(db,'homes',homeId,'tasks',taskId));}
      catch(error){notice(messageFor(error));throw error;}
    },
    async putMessage(message) {
      if (!this.active) return;
      try {await api.setDoc(api.doc(db,'homes',homeId,'messages',message.id),{...message,updatedAt:new Date().toISOString()});}
      catch(error){notice(messageFor(error));throw error;}
    },
    importState,
    async start(appBridge) {
      bridge=appBridge;
      render();
      if (!configured) return;
      try {
        const version='11.10.0';
        const [appModule,authModule,dbModule] = await Promise.all([
          import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
          import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
          import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
        ]);
        const firebaseApp=appModule.initializeApp(CONFIG);
        api={...authModule,...dbModule};
        auth=authModule.getAuth(firebaseApp);
        db=dbModule.getFirestore(firebaseApp);
        initialized=true;
        $(PANEL).addEventListener('click', handlePanel);
        $(PANEL).addEventListener('submit', handleForm);
        authModule.onAuthStateChanged(auth,async(nextUser)=>{
          cleanup(); user=nextUser;
          render();
          if (user) await restoreHome();
        },(err)=>notice(messageFor(err)));
      } catch(error) {
        console.error('Não foi possível iniciar o Firebase:',error);
        status('Modo local — conexão indisponível');
        $(PANEL).innerHTML='<p>Não foi possível carregar a sincronização. Confira as configurações do Firebase e sua conexão.</p>';
      }
    }
  };
  window.NossoCantinhoCloud=controller;
})();
