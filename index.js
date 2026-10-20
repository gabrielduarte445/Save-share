(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 3200); };

  // ---------- header / menu ----------
  const header = $('#header') || $('header'), burger = $('#burger'), menu = $('#menu');
  const onScroll = () => {
    header.classList.toggle('scrolled', scrollY > 20);
    const tl = $('#timeline'), r = tl.getBoundingClientRect();
    tl.style.setProperty('--p', Math.min(100, Math.max(0, (innerHeight * .6 - r.top) / r.height * 100)) + '%');
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  burger.onclick = () => { const o = menu.classList.toggle('open'); burger.setAttribute('aria-expanded', o); };
  $$('#menu a').forEach(a => a.addEventListener('click', () => { menu.classList.remove('open'); burger.setAttribute('aria-expanded', false); }));

  // scrollspy
  const links = $$('#menu a');
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) links.forEach(l => l.classList.toggle('on', l.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach(s => spy.observe(s));

  // contadores
  const fmt = new Intl.NumberFormat('pt-BR');
  const count = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; count.unobserve(e.target);
    const el = e.target, to = +el.dataset.to, t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / 1600); el.textContent = fmt.format(Math.round(to * (1 - Math.pow(1 - k, 3)))) + (k === 1 ? el.dataset.suf : ''); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: .6 });
  $$('[data-to]').forEach(n => count.observe(n));

  // ---------- login / cadastro ----------
  // TROQUE estas funções por chamadas à sua API (fetch). Hoje é só demonstração no navegador.
  const api = {
    register: async (d) => { await new Promise(r => setTimeout(r, 500)); return { nome: d.nome, email: d.email, tipo: d.tipo }; },
    login: async (d) => { await new Promise(r => setTimeout(r, 500)); return { nome: d.email.split('@')[0], email: d.email, tipo: 'consumidor' }; }
  };
  const store = { get() { try { return JSON.parse(localStorage.getItem('ss_user')); } catch { return null; } },
    set(u) { try { localStorage.setItem('ss_user', JSON.stringify(u)); } catch {} },
    del() { try { localStorage.removeItem('ss_user'); } catch {} } };

  const dlg = $('#authDlg'), loginF = $('#loginForm'), signF = $('#signForm');
  const setTab = (tab) => {
    const login = tab === 'login';
    loginF.hidden = !login; signF.hidden = login;
    $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
    $('#authTitle').textContent = login ? 'Bem-vindo de volta' : 'Crie sua conta';
    $$('.err').forEach(e => e.textContent = '');
  };
  const openAuth = (tab, role) => {
    setTab(tab); if (role) signF.elements.tipo.value = role;
    if (!dlg.open) dlg.showModal();
    setTimeout(() => (tab === 'login' ? loginF : signF).querySelector('input:not([type=radio])').focus(), 50);
  };
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-auth]'); if (a) { menu.classList.remove('open'); burger.setAttribute('aria-expanded', false); openAuth(a.dataset.auth, a.dataset.role); return; }
    const t = e.target.closest('[data-tab]'); if (t) setTab(t.dataset.tab);
    if (e.target === dlg) dlg.close();
  });
  $('#authClose').onclick = () => dlg.close();
  $$('.eye').forEach(b => b.onclick = () => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; });

  const submit = (form, fn, okMsg) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('.err', form), btn = $('[type=submit]', form);
    if (!form.checkValidity()) { err.textContent = form.querySelector(':invalid').validity.tooShort ? 'A senha precisa ter pelo menos 6 caracteres.' : 'Preencha todos os campos corretamente.'; return; }
    btn.disabled = true; err.textContent = '';
    try { const u = await fn(Object.fromEntries(new FormData(form))); store.set(u); renderUser(); dlg.close(); form.reset(); toast(okMsg(u)); }
    catch { err.textContent = 'Não foi possível continuar. Tente novamente.'; }
    btn.disabled = false;
  });
  submit(loginF, api.login, u => `Bem-vindo, ${u.nome}!`);
  submit(signF, api.register, u => `Conta criada! Bem-vindo, ${u.nome.split(' ')[0]}.`);

  function renderUser() {
    const u = store.get(), box = $('#authBox'), mob = $('.auth-m');
    if (!u) { box.innerHTML = mob.innerHTML = '<button class="btn ghost" data-auth="login">Entrar</button><button class="btn gold" data-auth="cadastro">Cadastrar</button>'; return; }
    const nome = u.nome.split(' ')[0], ini = nome[0].toUpperCase();
    const html = `<span class="hello"><i>${ini}</i>Olá, ${nome.replace(/[<>&]/g, '')}</span><button class="btn ghost" data-out>Sair</button>`;
    box.innerHTML = mob.innerHTML = html;
  }
  document.addEventListener('click', (e) => { if (e.target.closest('[data-out]')) { store.del(); renderUser(); toast('Você saiu da conta.'); } });
  renderUser();

  // ---------- contato / newsletter ----------
  $('#copyMail').onclick = async () => { try { await navigator.clipboard.writeText($('#mailTxt').textContent); toast('Email copiado!'); } catch { toast('Copie manualmente: ' + $('#mailTxt').textContent); } };
  $('#contactForm').addEventListener('submit', (e) => { e.preventDefault(); if (!e.target.checkValidity()) { e.target.reportValidity(); return; } e.target.reset(); toast('Mensagem enviada! Responderemos em breve.'); });
  $('#newsForm').addEventListener('submit', (e) => { e.preventDefault(); e.target.reset(); toast('Inscrição feita. Obrigado!'); });
  $('#ano').textContent = new Date().getFullYear();
})();
