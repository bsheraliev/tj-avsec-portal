/* AvSec Portal — портал авиационной безопасности и подготовки к USAP-CMA · АГА при ПРТ.
   Vanilla JS без сборки. Данные лежат шифрованными в data-enc/*.enc (AES-256-GCM поверх gzip);
   ключ выводится из кода доступа (PBKDF2) прямо в браузере, бэкенда нет. Самооценка (ВП, CC,
   SASAQ, дорожная карта) хранится в localStorage устройства; резервная копия — раздел «Данные».
   Версия приложения = версия кэша в sw.js = ?v= в index.html. Бампать вместе. */
'use strict';
const APP_VERSION = '12';

/* ---------- хранилище ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const K = { key: 'avsec-key', lang: 'avsec-lang', theme: 'avsec-theme', pq: 'avsec-pq', cc: 'avsec-cc', sasaq: 'avsec-sasaq', plan: 'avsec-plan', set: 'avsec-settings', team: 'avsec-team', arearesp: 'avsec-arearesp', audit: 'avsec-audit' };
const STATE_KEYS = [K.pq, K.cc, K.sasaq, K.plan, K.set, K.team, K.arearesp, K.audit];

const S = { cfg: null, key: null, D: {}, page: 'dash', q: '', f: {}, lang: LS.get(K.lang, 'ru'), pqSel: new Set() };

/* ---------- помощники ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const uniq = a => [...new Set(a.filter(Boolean))].sort((x, y) => String(x).localeCompare(String(y), 'ru', { numeric: true }));
const pct = (a, b) => b ? Math.round(a * 100 / b) : 0;
const norm = s => String(s || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
const fmtDate = iso => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return d && m ? `${d}.${m}.${y}` : iso; };
const today = () => new Date().toISOString().slice(0, 10);
const daysTo = iso => Math.ceil((new Date(iso) - new Date(today())) / 86400000);

function toast(msg, type) {
  const t = el('div', 'toast' + (type ? ' ' + type : ''), esc(msg));
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3200);
}
function download(text, name, mime = 'text/plain;charset=utf-8') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function csv(rows) { return '﻿' + rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(';')).join('\r\n'); }

/* ---------- i18n: RU базовый, EN — для аудита ИКАО. Данные первоисточников не переводим. ---------- */
const TR = { en: {
  'Обзор': 'Overview', 'USAP-CMA': 'USAP-CMA', 'Протокольные вопросы': 'Protocol Questions', 'Контрольный перечень (CC)': 'Compliance Checklist',
  'SASAQ': 'SASAQ', 'Дорожная карта': 'Roadmap', 'Документы АБ': 'AVSEC documents', 'Реестр документов': 'Document register',
  'Соответствие ИКАО': 'ICAO compliance matrix', 'Инструктивные материалы': 'Guidance material', 'Материалы (Drive)': 'Files (Drive)',
  'Справочники': 'References', 'Документы ИКАО': 'ICAO documents', 'Соседние страны': 'Neighbouring States', 'Словарь RU·TJ·EN': 'Glossary RU·TJ·EN',
  'Сервис': 'Service', 'Данные и резервная копия': 'Data & backup', 'О портале': 'About', 'Поиск': 'Search', 'Выйти': 'Sign out',
  'Не оценено': 'Not assessed', 'В работе': 'In progress', 'Удовлетворительно': 'Satisfactory', 'Неудовлетворительно': 'Not satisfactory', 'Не применимо': 'Not applicable',
  'Действует': 'In force', 'Проект': 'Draft', 'Готов': 'Ready', 'Уточняется': 'TBD', 'Отсутствует': 'Missing', 'Частично': 'Partial', 'За эксплуатантами': 'Operators', 'Н/П': 'N/A',
  'Соответствует': 'Compliant', 'Расхождение / нет нормы': 'Difference / no provision',
  'Область': 'Audit area', 'Все области': 'All areas', 'Все КЭ': 'All CEs', 'Все статусы': 'All statuses', 'Только со звёздочкой': 'Starred only',
  'Экспорт CSV': 'Export CSV', 'Печать': 'Print', 'Сохранить': 'Save', 'Ответственный': 'Responsible', 'Срок': 'Due', 'Доказательства': 'Evidence', 'Примечание': 'Note',
  'Статус': 'Status', 'Вопрос': 'Question', 'Документ': 'Document', 'Стандарт': 'Standard', 'Национальная норма': 'National provision', 'Замечание': 'Remark',
  'Всего': 'Total', 'Оценено': 'Assessed', 'Заполнено': 'Filled', 'Не заполнено': 'Not filled', 'Проверено': 'Checked',
  'Дней до аудита': 'Days to audit', 'Дата аудита не задана': 'Audit date not set', 'Настройки': 'Settings',
  'Реестр нормативных документов по авиационной безопасности': 'Register of Aviation Security Regulatory Documents',
  'Уровень': 'Level', 'Утверждение': 'Approval', 'Ревизия': 'Revision', 'Файлы': 'Files', 'Папка': 'Folder',
  'Найти': 'Find', 'Ничего не найдено': 'Nothing found', 'Результаты поиска': 'Search results',
  'Ответственные': 'Responsible persons', 'Все ответственные': 'All responsible', 'Не назначен': 'Not assigned', 'по области': 'by area', 'Просрочено': 'Overdue',
  'Аудит USAP-CMA 2026': 'USAP-CMA audit 2026', 'Выводы аудита 2019 (CAP)': '2019 audit findings (CAP)', 'План аудита': 'Audit plan', 'Запрошенные документы': 'Requested documents',
  'Логистика': 'Logistics', 'Контакты': 'Contacts', 'Не начато': 'Not started', 'Готово': 'Ready', 'Отправлено в ИКАО': 'Sent to ICAO', 'Аудит на месте': 'On-site audit', 'Ключевые факты': 'Key facts', 'Где открыть': 'Where to open', 'Группа аудита ИКАО': 'ICAO audit team', 'Участник': 'Member', 'Роль': 'Role', 'Направлен': 'Seconded by', 'Паспорт / виза': 'Passport / visa', 'Прибытие': 'Arrival', 'Отъезд': 'Departure', 'Подтверждён': 'Confirmed', 'Ожидает подтверждения': 'Awaiting confirmation', 'Визы': 'Visas', 'Гостиница': 'Hotel', 'План аудита': 'Audit plan', 'Дней до начала аудита': 'Days to audit start',
  'Статус ПКД': 'CAP status', 'Выполнено': 'Completed', 'Частично': 'Partially completed', 'Постоянно': 'Ongoing', 'Нет статуса': 'No status', 'Незакрытые': 'Open', 'Незакрытых рекомендаций ПКД': 'Open CAP recommendations', 'Готовность ПКД к подаче': 'CAP readiness', 'Готовность CC к подаче': 'CC readiness', 'В работе / постоянно': 'In progress / ongoing',
  'Сбросить всё': 'Clear all', 'Убрать фильтр': 'Remove filter', 'Сокращения': 'Abbreviations', 'Что делать сейчас': 'Do next', 'Только ★': 'Starred only', 'Подраздел': 'Subsection', 'Приложение': 'Annex', 'Глава': 'Chapter', 'Определения и заголовки': 'Definitions and headings', 'Язык': 'Language', 'Приоритет': 'Priority', 'Раздел': 'Section', 'Только с EN': 'With English only',
} };
const t = s => (S.lang === 'en' && TR.en[s]) || s;

/* ---------- маршруты ---------- */
const ROUTES = [
  { g: 'Обзор', items: [{ id: 'dash', ic: '◎', t: 'Обзор', short: 'Обзор' }] },
  { g: 'USAP-CMA', items: [
    { id: 'audit', ic: '🛡', t: 'Аудит USAP-CMA 2026', short: 'Аудит' },
    { id: 'pq', ic: '❔', t: 'Протокольные вопросы', short: 'ВП', cnt: () => D('pq') ? D('pq').items.length : '' },
    { id: 'cc', ic: '☑', t: 'Контрольный перечень (CC)', short: 'CC', cnt: () => D('cc') ? D('cc').items.filter(i => i.kind === 'std' || i.kind === 'rp').length : '' },
    { id: 'sasaq', ic: '▤', t: 'SASAQ', cnt: () => D('sasaq') ? D('sasaq').items.length : '' },
    { id: 'plan', ic: '⏱', t: 'Дорожная карта', short: 'План' },
    { id: 'team', ic: '👥', t: 'Ответственные', cnt: () => team().length || '' },
    { id: 'cap', ic: '⚑', t: 'Выводы аудита 2019 (CAP)', cnt: () => D('cap2019') ? D('cap2019').findings.length : '' } ] },
  { g: 'Документы АБ', items: [
    { id: 'docs', ic: '📚', t: 'Реестр документов', cnt: () => D('registry') ? D('registry').docs.length : '' },
    { id: 'matrix', ic: '⊞', t: 'Соответствие ИКАО', cnt: () => D('matrix') ? D('matrix').sections.reduce((a, s) => a + s.items.length, 0) : '' },
    { id: 'gm', ic: '📘', t: 'Инструктивные материалы', cnt: () => D('gm') ? D('gm').items.length : '' },
    { id: 'drive', ic: '🗂', t: 'Материалы (Drive)' } ] },
  { g: 'Справочники', items: [
    { id: 'icao', ic: '🌐', t: 'Документы ИКАО' },
    { id: 'nb', ic: '🌍', t: 'Соседние страны' },
    { id: 'glossary', ic: 'Аа', t: 'Словарь RU·TJ·EN', cnt: () => D('glossary') ? D('glossary').terms.length : '' } ] },
  { g: 'Сервис', items: [{ id: 'data', ic: '⇅', t: 'Данные и резервная копия' }, { id: 'about', ic: 'ⓘ', t: 'О портале' }] },
];
const BOTTOM = ['dash', 'audit', 'pq', 'cc', 'plan'];
const D = name => S.D[name];
const U = () => S.D.usap;

/* ---------- словари статусов ---------- */
const BUCKET = { ok: 'Действует', draft: 'Проект', ready: 'Готов', tbd: 'Уточняется', missing: 'Отсутствует', part: 'Частично', ext: 'За эксплуатантами', na: 'Н/П' };
const PQST = { '': 'Не оценено', wip: 'В работе', sat: 'Удовлетворительно', unsat: 'Неудовлетворительно', na: 'Не применимо' };
const CCST = { ok: 'Соответствует', part: 'Частично', missing: 'Расхождение / нет нормы', na: 'Не применимо' };
const badge = (b, text) => `<span class="badge b-${esc(b || 'none')}">${esc(t(text || BUCKET[b] || b))}</span>`;
const pqBadge = st => `<span class="badge b-${st === 'sat' ? 'ok' : st === 'unsat' ? 'unsat' : st === 'wip' ? 'wip' : st === 'na' ? 'na' : 'none'}">${esc(t(PQST[st] || PQST['']))}</span>`;

/* ---------- крипто: код доступа → ключ → расшифровка ---------- */
const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
const unhex = h => Uint8Array.from((h.match(/.{2}/g) || []), x => parseInt(x, 16));
async function deriveKey(code) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(norm(code)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unhex(S.cfg.salt), iterations: S.cfg.kdfIter || 250000, hash: 'SHA-256' }, base, 256);
  return new Uint8Array(bits);
}
async function keyOk(raw) { return hex(await crypto.subtle.digest('SHA-256', raw)) === S.cfg.check; }
async function decryptEnc(bytes, raw) {
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  const u8 = new Uint8Array(bytes);
  const gz = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8.slice(0, 12) }, key, u8.slice(12));
  return new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
async function loadFile(name) {
  if (S.cfg.plain) { const r = await fetch('data/' + name, { cache: 'no-cache' }); if (!r.ok) throw new Error(`data/${name}: HTTP ${r.status}`); return r.json(); }
  const r = await fetch('data-enc/' + name + '.enc');
  if (!r.ok) throw new Error(`data-enc/${name}.enc: HTTP ${r.status}`);
  return JSON.parse(await decryptEnc(await r.arrayBuffer(), S.key));
}
/* Ошибки загрузки — по файлам, чтобы на экране было видно, чего именно не хватает. */
S.loadErrors = [];
async function loadAll() {
  const files = S.cfg.files || [];
  S.loadErrors = [];
  const got = await Promise.all(files.map(f => loadFile(f).catch(e => { console.warn(f, e); S.loadErrors.push(String(e && e.message || e)); return null; })));
  files.forEach((f, i) => { if (got[i]) S.D[f.replace(/\.json$/, '')] = got[i]; });
}
const cryptoReady = () => !!(window.crypto && crypto.subtle && typeof DecompressionStream !== 'undefined');

/* ---------- вход ---------- */
function showGate(show) { $('#gate').hidden = !show; if (show) setTimeout(() => $('#gateCode').focus(), 50); }
async function enter() {
  $('#main').innerHTML = '<div class="loading">Расшифровываю данные…</div>';
  await loadAll();
  if (!D('pq') && !D('registry')) {
    const missing = S.loadErrors.filter(e => /HTTP 404/.test(e)).length, total = (S.cfg.files || []).length;
    const hint = missing === total && total
      ? `Папка <span class="mono">data-enc/</span> отсутствует или пуста (${missing} файлов не найдено). Скопируйте её из репозитория или соберите: <span class="mono">node tools/build.mjs --code "…"</span> при наличии <span class="mono">data/*.json</span>.`
      : 'Проверьте код доступа, сеть и наличие файлов data-enc/*.enc.';
    $('#main').innerHTML = `<div class="card" style="max-width:720px;margin:40px auto"><b>Не удалось загрузить данные.</b><p>${hint}</p>${S.loadErrors.length ? `<details><summary class="dim small">Подробности (${S.loadErrors.length})</summary><pre class="mono small" style="white-space:pre-wrap">${esc(S.loadErrors.join('\n'))}</pre></details>` : ''}<div class="row mt"><button class="btn sm ghost" onclick="location.reload()">Повторить</button><button class="btn sm ghost" id="errLogout">Ввести код заново</button></div></div>`;
    const b = $('#errLogout'); if (b) b.onclick = () => { LS.del(K.key); location.reload(); };
    return;
  }
  $('#who').hidden = !!S.cfg.plain;
  buildNav(); route();
}
function initGate() {
  $('#gateForm').onsubmit = async e => {
    e.preventDefault();
    const code = $('#gateCode').value, err = $('#gateErr'), btn = $('#gateBtn');
    err.hidden = true;
    if (!cryptoReady()) { err.textContent = 'Браузер не поддерживает WebCrypto/gzip или страница открыта не по https/localhost.'; err.hidden = false; return; }
    if (!code.trim()) return;
    btn.disabled = true; btn.textContent = 'Проверяю…';
    try {
      const raw = await deriveKey(code);
      if (!(await keyOk(raw))) { err.textContent = 'Код не подошёл. Проверьте раскладку и попробуйте ещё раз.'; err.hidden = false; }
      else { S.key = raw; LS.set(K.key, hex(raw)); showGate(false); await enter(); }
    } catch (ex) { err.textContent = 'Ошибка: ' + ex.message; err.hidden = false; }
    btn.disabled = false; btn.textContent = t('Войти');
  };
  $('#who').onclick = () => { if (confirm('Выйти из портала на этом устройстве? Самооценка останется в памяти устройства.')) { LS.del(K.key); location.reload(); } };
}

/* ---------- навигация ---------- */
function buildNav() {
  const side = $('#side'); side.innerHTML = '';
  ROUTES.forEach(g => {
    const mk = it => { const a = el('a', '', `<span class="ic">${it.ic}</span><span>${esc(t(it.t))}</span>${it.cnt ? `<i>${esc(it.cnt())}</i>` : ''}`); a.href = '#' + it.id; a.dataset.p = it.id; return a; };
    if (g.items.length === 1) { side.appendChild(mk(g.items[0])); return; }
    // группа-аккордеон: раскрыта группа активной страницы, остальные — по клику на заголовок (как в Библиотеке Shohin)
    const grp = el('div', 'navgrp'); grp.dataset.g = g.g;
    const h = el('button', 'navh', `<span>${esc(t(g.g))}</span><i>${g.items.length}</i>`); h.type = 'button'; grp.appendChild(h);
    g.items.forEach(it => grp.appendChild(mk(it)));
    side.appendChild(grp);
  });
  side.appendChild(el('div', 'navfoot', `AvSec Portal v${APP_VERSION} · <span class="dim">${esc(S.cfg.built || '')}</span>`));
  const bb = $('#bottombar'); bb.innerHTML = '';
  BOTTOM.forEach(id => { const it = ROUTES.flatMap(g => g.items).find(x => x.id === id); const a = el('a', '', `<span>${it.ic}</span>${esc(it.short || t(it.t))}`); a.href = '#' + id; a.dataset.p = id; bb.appendChild(a); });
  markNav();
}
function markNav() {
  $$('[data-p]').forEach(a => a.classList.toggle('on', a.dataset.p === S.page));
  $$('.side .navgrp').forEach(g => g.classList.toggle('open', !!g.querySelector(`a[data-p="${S.page}"]`)));
}
function parseHash() {
  const h = location.hash.replace(/^#/, ''); const [page, qs] = h.split('?');
  const p = new URLSearchParams(qs || ''); const f = {}; p.forEach((v, k) => { if (k !== 'q') f[k] = v; });
  return { page: page || 'dash', f, q: p.get('q') || '' };
}
function go(page, f = {}, q = '') {
  const p = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, v); }); if (q) p.set('q', q);
  const s = p.toString(); const h = page + (s ? '?' + s : '');
  // смена фильтра внутри раздела не плодит записей в истории: «назад» ведёт в прежний раздел, а не по каждому чипу
  if (page === S.page && location.hash.replace(/^#/, '') !== h) { history.replaceState(null, '', '#' + h); route(); } else location.hash = h;
}
function route() {
  const { page, f, q } = parseHash();
  const next = PAGES[page] ? page : 'dash'; const changed = next !== S.page;
  S.page = next; S.f = f; S.q = q;
  if (S.page !== 'find') $('#q').value = '';
  markNav(); $('#side').classList.remove('open'); render(); tgSync();
  if (changed) window.scrollTo(0, 0);   // наверх — только при переходе в другой раздел; смена фильтра оставляет позицию
}
// Перерисовка на месте (галочка, статус, примечание, ответственный) не должна сбрасывать прокрутку и фокус:
// запоминаем позицию и активный элемент (по data-атрибутам), после перерисовки возвращаем.
const focusSel = n => { const ds = Object.entries(n.dataset || {}); if (!ds.length) return n.id ? '#' + CSS.escape(n.id) : ''; return n.tagName.toLowerCase() + ds.map(([k, v]) => `[data-${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${CSS.escape(v)}"]`).join(''); };
function render() {
  const m = $('#main');
  const y = window.scrollY; const ae = document.activeElement; const sel = ae && m.contains(ae) ? focusSel(ae) : '';
  m.innerHTML = '';
  try { PAGES[S.page](m); injectActiveFilters(m); markAbbr(m); } catch (e) { console.error(e); m.innerHTML = `<div class="card"><b>Ошибка отображения раздела.</b><div class="mono mt">${esc(e.message)}</div></div>`; }
  window.scrollTo(0, y);
  if (sel) { const n = m.querySelector(sel); if (n) n.focus({ preventScroll: true }); }
}
function head(m, title, sub) { m.appendChild(el('h1', '', esc(t(title)))); if (sub) m.appendChild(el('p', 'sub', sub)); }

/* ---------- общие виджеты ---------- */
function table(cols, rows, rowFn, onClick, opts = {}) {
  const w = el('div', 'tw');
  const tb = el('table');
  tb.innerHTML = `<thead><tr>${cols.map(c => `<th>${esc(t(c))}</th>`).join('')}</tr></thead>`;
  const body = el('tbody');
  if (!rows.length) body.innerHTML = `<tr><td class="empty" colspan="${cols.length}">${esc(t(opts.empty || 'Ничего не найдено'))}</td></tr>`;
  let lastG = null;
  rows.forEach(r => {
    if (opts.groupKey) { const g = opts.groupKey(r); if (g !== lastG) { lastG = g; body.appendChild(el('tr', 'grp', `<td colspan="${cols.length}">${esc(g)}</td>`)); } }
    const tr = el('tr', onClick ? 'clk' : ''); tr.innerHTML = rowFn(r).map(c => `<td>${c}</td>`).join('');
    if (onClick) { tr.onclick = () => onClick(r); tr.tabIndex = 0; tr.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === tr) { e.preventDefault(); onClick(r); } }; }
    body.appendChild(tr);
  });
  tb.appendChild(body); w.appendChild(tb); return w;
}
function openSheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').hidden = false; $('.sheet-card').focus(); document.body.style.overflow = 'hidden'; tgSync(); }
function closeSheet() { $('#sheet').hidden = true; document.body.style.overflow = ''; tgSync(); }
const kv = pairs => `<div class="kv">${pairs.filter(p => p[1]).map(([k, v]) => `<div>${esc(t(k))}</div><div>${v}</div>`).join('')}</div>`;
const links = arr => (arr || []).length ? `<ul class="list">${arr.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a>${l.date ? ` <span class="dim small">${esc(l.date)}</span>` : ''}</li>`).join('')}</ul>` : '<span class="dim">—</span>';
function selector(label, key, values, labelFn) {
  const s = el('select', 'sel'); s.innerHTML = `<option value="">${esc(t(label))}</option>` + values.map(v => `<option value="${esc(v)}"${S.f[key] === String(v) ? ' selected' : ''}>${esc(labelFn ? labelFn(v) : v)}</option>`).join('');
  s.onchange = () => { S.f[key] = s.value; go(S.page, S.f, S.q); };
  return s;
}
function inputFilter(placeholder) {
  const i = el('input', 'inp'); i.type = 'search'; i.placeholder = t(placeholder); i.value = S.f.s || '';
  let tm; i.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { S.f.s = i.value; go(S.page, S.f, S.q); }, 250); };
  return i;
}
function toggle(label, key) {
  const b = el('button', 'chip' + (S.f[key] ? ' on' : ''), esc(t(label)));
  b.onclick = () => { S.f[key] = S.f[key] ? '' : '1'; go(S.page, S.f, S.q); }; return b;
}
function tile(cls, n, label, onclick) { const b = el('button', 'tile ' + cls, `<div class="n">${n}</div><div class="t">${esc(t(label))}</div>`); b.onclick = onclick; return b; }
const has = (q, ...fields) => { q = norm(q); return !q || fields.some(f => norm(f).includes(q)); };
function prog(parts, total) {
  const segs = Object.entries(parts).filter(([, v]) => v > 0).map(([k, v]) => `<span class="p-${k}" style="width:${v * 100 / (total || 1)}%" title="${esc(t(PQST[k] || k))}: ${v}"></span>`).join('');
  return `<div class="prog">${segs}</div>`;
}

/* ---------- состояние самооценки ---------- */
const pqState = () => LS.get(K.pq, {});
const pqOf = id => pqState()[id] || {};
const ccState = () => LS.get(K.cc, {});
const sasaqState = () => LS.get(K.sasaq, {});
const planState = () => LS.get(K.plan, {});
/* настройки: значения по умолчанию — из usap.json (дата аудита, NCMC), ручные правки на устройстве — поверх */
const settings = () => { const u = U(); const d = u ? { auditDate: u.audit.start, ncmc: `${u.ncmc.name}, ${u.ncmc.title}` } : {}; const s = LS.get(K.set, {}); Object.keys(s).forEach(k => { if (s[k] === '' || s[k] == null) delete s[k]; }); return { ...d, ...s }; };
/* команда: список по умолчанию — из team.json, правки списка — на устройстве */
const team = () => { const o = LS.get(K.team, null); if (o) return o; const d = D('team'); return d ? d.members : []; };
const member = id => team().find(m => m.id === id);
const nameOf = id => (member(id) || {}).name || id || '';
const areaResp = () => LS.get(K.arearesp, {});
/* ответственный за ВП: назначенный лично, иначе — по области */
const respOfPQ = i => { const o = pqOf(i.id); if (o.resp) return { id: o.resp, name: nameOf(o.resp) || o.resp, byArea: false }; const a = areaResp()[i.area]; return a ? { id: a, name: nameOf(a), byArea: true } : null; };
function respSelect(name, value, allowFree) {
  return `<select name="${name}"><option value="">— ${esc(t('Не назначен'))} —</option>${team().map(m => `<option value="${m.id}"${value === m.id ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}${allowFree && value && !member(value) ? `<option value="${esc(value)}" selected>${esc(value)}</option>` : ''}</select>`;
}
function ccAuto(it) {
  if (it.kind !== 'std' && it.kind !== 'rp') return '';
  if (/^\s*расхождение/i.test(it.remarks) || /^\s*расхождение/i.test(it.desc)) return 'missing';
  if (!it.ref || /^(нет|—|-)\s*$/i.test(it.ref) || /прямой нормы .* нет/i.test(it.ref)) return 'missing';
  if (it.remarks || it.desc || /частичн/i.test(it.ref)) return 'part';
  return 'ok';
}
const ccOf = it => { const o = ccState()[it.annex + ':' + it.id] || {}; return { st: o.st || ccAuto(it), note: o.note || '', auto: !o.st }; };

/* ---------- дорожная карта USAP-CMA ---------- */
const STAGES = [
  { id: 'ncmc', t: 'Назначение национального координатора (NCMC) и рабочей группы по USAP-CMA', hint: () => { const u = U(); return u ? `${u.ncmc.name} — ${u.ncmc.title} (${u.ncmc.source}). Рабочая группа: ${team().length} чел. — раздел «Ответственные».` : 'SASAQ GEN-01: координатор назначен.'; }, auto: () => 'done' },
  { id: 'mou', t: 'МоВ с ИКАО, уведомление об аудите и согласование сроков', hint: () => { const u = U(); return u ? `МоВ подписан ${fmtDate(u.mou.signed)}. Уведомление ИКАО от ${fmtDate(u.notification.date)} (${u.notification.ref}): предложено ${u.notification.proposed}. Согласовано: ${fmtDate(u.audit.start)} – ${fmtDate(u.audit.end)} (${u.audit.agreedBy}).` : 'Дата аудита задаётся в «Данные → Настройки».'; }, auto: () => U() ? 'done' : (settings().auditDate ? 'wip' : '') },
  { id: 'sasaq', t: 'Заполнение и подача SASAQ (EN) через защищённую ссылку ИКАО', due: () => (U() || { audit: {} }).audit.docsDeadline, hint: () => { const d = D('sasaq'); if (!d) return ''; const f = d.items.filter(i => i.filled).length; return `Черновик SASAQ 1 (19.06.2026): заполнено ${f} из ${d.items.length} вопросов. Подаётся вместе с CC и обновлённым CAP — не позднее чем за 60 дней до аудита.`; }, auto: () => (auditState().docs.sasaq || {}).st === 'sent' ? 'done' : 'wip' },
  { id: 'cc', t: 'Контрольные перечни соответствия (CC) по Прил. 17 и Прил. 9 (EN): заполнение, проверка, подача', due: () => (U() || { audit: {} }).audit.docsDeadline, hint: () => { const u = U(); const d = D('cc'); const base = d ? `Редакция в3 (01.07.2026) в портале: ${d.items.filter(i => i.kind === 'std' || i.kind === 'rp').length} SARPs. ` : ''; return base + (u && u.ccCheck ? `Проверка редакции 12.09.2026 (${fmtDate(u.ccCheck.date)}): ${u.ccCheck.verdict} ${u.ccCheck.summary}` : ''); }, auto: () => (auditState().docs.cc || {}).st === 'sent' ? 'done' : 'wip' },
  { id: 'cap', t: 'Обновлённый план корректирующих действий (CAP) по итогам аудита USAP-CMA 2019', due: () => (U() || { audit: {} }).audit.docsDeadline, hint: () => { const c = D('cap2019'); const u = U(); return c ? `${c.meta.update ? `Редакция EN (${c.meta.update.approved}): выполнено ${capStats(c).done} из ${capStats(c).total}, незакрыто ${capStats(c).open}. ` : ''}Основа — ПКД 2020: ${c.meta.findings} выводов, ${c.meta.items} рекомендаций (раздел «Выводы аудита 2019»). ${u ? `Результаты ИКАО 2019: EI ${u.previous.results2019.ei} %, соответствие Прил. 17 — ${u.previous.results2019.compliance} %; ${u.previous.results.source}: EI ${u.previous.results.ei} %, соответствие — ${u.previous.results.compliance} %.` : ''}` : ''; }, auto: () => (auditState().docs.cap || {}).st === 'sent' ? 'done' : (D('cap2019') && D('cap2019').meta.update ? 'wip' : '') },
  { id: 'docs', t: 'Пакет национальной, аэропортовой и эксплуатантской документации (запрос ИКАО от 15.06.2026, SASAQ GEN-05) и переводы на английский', due: () => (U() || { audit: {} }).audit.docsDeadline, hint: () => { const u = U(); if (!u) return ''; const a = auditState(); const n = u.requested.length, sent = u.requested.filter(r => (a.docs[r.id] || {}).st === 'sent').length; return `Отправлено ${sent} из ${n} позиций (чек-лист — раздел «Аудит USAP-CMA 2026»). Загрузка только через защищённую ссылку ИКАО, не по e-mail.`; }, auto: () => { const u = U(); if (!u) return 'wip'; const a = auditState(); const sent = u.requested.filter(r => (a.docs[r.id] || {}).st === 'sent').length; return sent === u.requested.length ? 'done' : 'wip'; } },
  { id: 'pq', t: 'Самооценка по протокольным вопросам (ВП) — 9 областей, 8 КЭ', hint: () => { const d = D('pq'); if (!d) return ''; const st = pqState(); const n = d.items.filter(i => (st[i.id] || {}).st).length; return `Оценено ${n} из ${d.items.length} ВП (${pct(n, d.items.length)}%). Все ВП будут рассмотрены — аудит полномасштабный.`; }, auto: () => { const d = D('pq'); if (!d) return ''; const st = pqState(); const n = d.items.filter(i => (st[i.id] || {}).st).length; return n === 0 ? '' : n === d.items.length ? 'done' : 'wip'; } },
  { id: 'evidence', t: 'Доказательная база по ВП; адаптированные наборы ВП для DYU, эксплуатантов и госорганов; подготовка персонала к интервью', hint: 'Доказательства фиксируются в карточке каждого ВП (поле «Доказательства»). Группа ИКАО запрашивает письменные подтверждения по каждому ответу — у каждой проверяемой организации документы должны быть под рукой.', auto: () => { const st = pqState(); return Object.values(st).some(o => o.ev) ? 'wip' : ''; } },
  { id: 'logistics', t: 'Логистика аудита: план аудита, гостиницы, транспорт, переводчики, визы, площадка брифингов', hint: () => { const u = U(); if (!u) return ''; const a = auditState(); const n = u.logistics.length, d = u.logistics.filter(l => (a.log[l.id] || (l.done ? { done: true } : {})).done).length; return `Выполнено ${d} из ${n} пунктов чек-листа (раздел «Аудит USAP-CMA 2026»). Лимит ООН на гостиницу — ${u.audit.hotelLimit}.`; }, auto: () => { const u = U(); if (!u) return ''; const a = auditState(); const d = u.logistics.filter(l => (a.log[l.id] || (l.done ? { done: true } : {})).done).length; return d === 0 ? '' : d === u.logistics.length ? 'done' : 'wip'; } },
  { id: 'onsite', t: 'Аудит на месте: 9–18 ноября 2026, Душанбе / DYU (UTDD) — брифинг, документальная фаза, наблюдения, разбор итогов', hint: () => { const u = U(); return u ? `${u.audit.scope}. Группа — ${u.audit.teamSize} чел., руководитель — ${u.audit.teamLeader}. ${u.audit.language}.` : ''; }, auto: () => { const d = settings().auditDate; const u = U(); if (!d) return ''; if (u && daysTo(u.audit.end) < 0) return 'done'; return daysTo(d) <= 0 ? 'wip' : ''; } },
  { id: 'report', t: 'Предварительные выводы и рекомендации (18.11.2026, EN) → проект отчёта ИКАО → замечания государства → окончательный отчёт (RU)', hint: 'Баллы (EI, соответствие) — только в окончательном отчёте.', auto: () => '' },
  { id: 'cap2', t: 'План корректирующих действий (CAP) по выводам аудита 2026 и мониторинг выполнения', hint: 'Инструкция: USAP-CMA CAP Manager Completion Instructions (папка ICAO docs). Корректирующие действия можно начинать по предварительным выводам, не дожидаясь отчёта.', auto: () => '' },
];
const STG = { '': 'Не начато', wip: 'В работе', done: 'Выполнено' };
const stageStatus = s => { const o = planState()[s.id] || {}; return o.st !== undefined && o.st !== '' ? o.st : (s.auto() || ''); };

/* ================================================================== СТРАНИЦЫ ================================================================== */
const PAGES = { dash, audit: pAudit, cap: pCAP, pq: pPQ, cc: pCC, sasaq: pSASAQ, plan: pPlan, team: pTeam, docs: pDocs, matrix: pMatrix, gm: pGM, drive: pDrive, icao: pICAO, nb: pNB, glossary: pGlossary, data: pData, about: pAbout, find: pFind };

/* ---------- активные фильтры (чипы с ✕), расшифровка сокращений, «что делать сейчас» — по образцу Библиотеки Shohin ---------- */
const FILTER_LABELS = { area: 'Область', sub: 'Подраздел', ce: 'КЭ', st: 'Статус', star: 'Только ★', resp: 'Ответственный', s: 'Поиск', annex: 'Приложение', ch: 'Глава', defs: 'Определения и заголовки', b: 'Статус', lvl: 'Уровень', l: 'Язык', prio: 'Приоритет', sec: 'Раздел', en: 'Только с EN' };
const FILTER_BOOL = { star: 1, defs: 1, en: 1 };
function filterVal(k, v) {
  if (k === 'st') return ({ none: 'Не оценено', bad: 'Частично + расхождения', open: 'Незакрытые', filled: 'Заполнено', empty: 'Не заполнено', checked: 'Проверено' })[v] || PQST[v] || CCST[v] || CAPST[v] || v;
  if (k === 'b') return BUCKET[v] || v;
  if (k === 'prio') return CAPP[v] || v;
  if (k === 'resp') return v === 'none' ? 'Не назначен' : nameOf(v);
  if (k === 'l') return String(v).toUpperCase();
  return v;
}
function injectActiveFilters(m) {
  const act = Object.entries(S.f).filter(([, v]) => v); if (!act.length) return;
  const bar = el('div', 'activebar');
  act.forEach(([k, v]) => {
    const b = el('button', 'activechip', `${esc(t(FILTER_LABELS[k] || k))}${FILTER_BOOL[k] ? '' : ': ' + esc(t(String(filterVal(k, v))))} <span class="x" aria-hidden="true">✕</span>`);
    b.title = t('Убрать фильтр'); b.onclick = () => { delete S.f[k]; go(S.page, S.f, S.q); }; bar.appendChild(b);
  });
  if (act.length > 1) { const all = el('button', 'activechip', `${esc(t('Сбросить всё'))} <span class="x" aria-hidden="true">✕</span>`); all.onclick = () => go(S.page, {}, S.q); bar.appendChild(all); }
  const tb = m.querySelector('.toolbar'); if (tb) tb.after(bar); else { const h = m.querySelector('.sub') || m.querySelector('h1'); if (h) h.after(bar); else m.prepend(bar); }
}
/* Сокращения интерфейса: подсказка при наведении в заголовках, подписях и карточках; полный список — «О портале». */
const ABBR = {
  'USAP-CMA': 'Universal Security Audit Programme — Continuous Monitoring Approach: программа ИКАО универсальных проверок в сфере авиационной безопасности, метод непрерывного мониторинга',
  'НПАБГА': 'Национальная программа авиационной безопасности гражданской авиации (NCASP)',
  'NCASP': 'National Civil Aviation Security Programme — национальная программа авиационной безопасности (НПАБГА)',
  'SASAQ': 'State Aviation Security Activities Questionnaire — вопросник о деятельности государства в области авиационной безопасности',
  'NCMC': 'National Continuous Monitoring Coordinator — национальный координатор по непрерывному мониторингу',
  'SARP': 'Standards and Recommended Practices — стандарты и рекомендуемая практика ИКАО',
  'ПКД': 'План корректирующих действий (Corrective Action Plan, CAP)',
  'CAP': 'Corrective Action Plan — план корректирующих действий (ПКД)',
  'MoU': 'Memorandum of Understanding — меморандум о взаимопонимании между государством и ИКАО',
  'DYU': 'Международный аэропорт Душанбе (код ИАТА; код ИКАО — UTDD)',
  'АГА': 'Агентство гражданской авиации при Правительстве Республики Таджикистан',
  'ПРТ': 'Правительство Республики Таджикистан',
  'ВП': 'Протокольный вопрос (Protocol Question, PQ)',
  'КЭ': 'Критический элемент системы надзора за авиационной безопасностью (Critical Element, CE)',
  'CC': 'Compliance Checklist — контрольный перечень соответствия Приложениям 17 и 9',
  'ИМ': 'Инструктивный материал (серия РТ-SEC-ИМ)',
  'АБ': 'Авиационная безопасность',
  'EI': 'Effective Implementation — уровень эффективной реализации критических элементов, %',
  'РП': 'Рекомендуемая практика ИКАО',
  'LEG': 'Область проверки: законодательство и нормативные акты', 'TRG': 'Область проверки: подготовка персонала по авиационной безопасности', 'QCF': 'Область проверки: контроль качества', 'OPS': 'Область проверки: аэропорт и эксплуатанты', 'IFS': 'Область проверки: безопасность на борту', 'PAX': 'Область проверки: пассажиры и багаж', 'CGO': 'Область проверки: груз, почта, бортпитание', 'AUI': 'Область проверки: реагирование на акты незаконного вмешательства', 'FAL': 'Область проверки: упрощение формальностей (Приложение 9)',
};
const ABBR_RE = new RegExp('(^|[^\\p{L}\\p{N}])(' + Object.keys(ABBR).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\p{L}\\p{N}])', 'gu');
const ABBR_SCOPE = 'h1, .sub, .card h2, .stage b, .tile .t, .kv > div:nth-child(odd), .callout, .taskrow';
function markAbbr(root) {
  const done = [];
  root.querySelectorAll(ABBR_SCOPE).forEach(node => {
    if (done.some(p => p.contains(node))) return; done.push(node);
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT); const texts = [];
    while (w.nextNode()) { const tn = w.currentNode; if (!tn.parentElement.closest('a, abbr, code, .code, .mono, input, select, textarea, .btn')) texts.push(tn); }
    texts.forEach(tn => {
      const str = tn.nodeValue; ABBR_RE.lastIndex = 0; if (!ABBR_RE.test(str)) return; ABBR_RE.lastIndex = 0;
      const frag = document.createDocumentFragment(); let last = 0, mm;
      while ((mm = ABBR_RE.exec(str))) { const start = mm.index + mm[1].length; frag.appendChild(document.createTextNode(str.slice(last, start))); const ab = document.createElement('abbr'); ab.title = ABBR[mm[2]]; ab.textContent = mm[2]; frag.appendChild(ab); last = start + mm[2].length; }
      frag.appendChild(document.createTextNode(str.slice(last))); tn.parentNode.replaceChild(frag, tn);
    });
  });
}
/* «Что делать сейчас» — первый экран после входа: сроки, незакрытое, проверки; каждая строка ведёт в свой раздел */
function todoCard(m) {
  const u = U(), pq = D('pq'), cap = D('cap2019'); const rows = [];
  const add = (html, href) => rows.push({ html, href });
  if (u) {
    const a = auditState(); const n = u.requested.length, sent = u.requested.filter(r => (a.docs[r.id] || {}).st === 'sent').length; const dl = u.audit.docsDeadline; const late = daysTo(dl) < 0 && sent < n;
    add(`<b>Документы для ИКАО</b>: отправлено ${sent} из ${n} · срок ${fmtDate(dl)}${late ? ` <span class="warn">· просрочен на ${-daysTo(dl)} дн.</span>` : ''}`, '#audit');
    if (u.ccCheck) add(`<b>CC</b>: проверка ${fmtDate(u.ccCheck.date)} — <span class="warn">${esc(u.ccCheck.verdict)}</span>`, '#audit');
    if (u.capCheck) add(`<b>ПКД</b>: проверка ${fmtDate(u.capCheck.date)} — <span class="warn">${esc(u.capCheck.verdict)}</span>`, '#audit');
    const ld = u.logistics.filter(l => (a.log[l.id] || (l.done ? { done: true } : {})).done).length; if (ld < u.logistics.length) add(`<b>Логистика аудита</b>: выполнено ${ld} из ${u.logistics.length}`, '#audit');
  }
  if (cap && cap.meta.update) { const s = capStats(cap); if (s.open) add(`<b>ПКД</b>: незакрытых рекомендаций ${s.open} из ${s.total}`, '#cap?st=open'); }
  if (pq) {
    const st = pqState(); const n = pq.items.filter(i => (st[i.id] || {}).st).length; add(`<b>ВП</b>: оценено ${n} из ${pq.items.length} (${pct(n, pq.items.length)}%)`, '#pq?st=none');
    const od = pq.items.filter(i => { const o = st[i.id] || {}; return o.due && o.st !== 'sat' && o.st !== 'na' && daysTo(o.due) < 0; }).length; if (od) add(`<b>ВП с просроченным сроком</b>: <span class="warn">${od}</span>`, '#pq');
  }
  const late = STAGES.filter(s => { const o = planState()[s.id] || {}; const due = o.date || (typeof s.due === 'function' ? s.due() : s.due); return due && stageStatus(s) !== 'done' && daysTo(due) < 0; }).length;
  if (late) add(`<b>Дорожная карта</b>: этапов с просроченным сроком — <span class="warn">${late}</span>`, '#plan');
  if (!rows.length) return;
  const c = el('div', 'card'); c.innerHTML = `<h2>📌 ${esc(t('Что делать сейчас'))}</h2>`;
  rows.forEach(r => { const b = el('button', 'taskrow', r.html); b.onclick = () => { location.hash = r.href; }; c.appendChild(b); });
  m.appendChild(c);
}

/* ---------- Обзор ---------- */
function dash(m) {
  head(m, 'Обзор', 'Состояние подготовки к USAP-CMA и нормативной базы АБ · Агентство гражданской авиации при Правительстве Республики Таджикистан');
  todoCard(m);
  const pq = D('pq'), cc = D('cc'), sq = D('sasaq'), reg = D('registry'), mx = D('matrix'), cap = D('cap2019');
  const tiles = el('div', 'tiles');
  const st = pqState();
  if (pq) {
    const cnt = { sat: 0, wip: 0, unsat: 0, na: 0 }; pq.items.forEach(i => { const s = (st[i.id] || {}).st; if (s) cnt[s]++; });
    const n = cnt.sat + cnt.wip + cnt.unsat + cnt.na;
    tiles.appendChild(tile('info', `${pct(n, pq.items.length)}%`, `ВП оценено (${n} из ${pq.items.length})`, () => go('pq')));
    tiles.appendChild(tile('ok', cnt.sat, 'ВП удовлетворительно', () => go('pq', { st: 'sat' })));
    tiles.appendChild(tile('miss', cnt.unsat, 'ВП неудовлетворительно', () => go('pq', { st: 'unsat' })));
  }
  if (cc) {
    const s = cc.items.filter(i => i.kind === 'std' || i.kind === 'rp');
    const bad = s.filter(i => ccOf(i).st !== 'ok');
    tiles.appendChild(tile(bad.length ? 'draft' : 'ok', bad.length, `CC: SARPs с расхождением / частично (из ${s.length})`, () => go('cc', { st: 'bad' })));
  }
  if (sq) { const f = sq.items.filter(i => i.filled).length; tiles.appendChild(tile(f === sq.items.length ? 'ok' : 'draft', `${f}/${sq.items.length}`, 'SASAQ: вопросов заполнено', () => go('sasaq'))); }
  if (reg) {
    const b = {}; reg.docs.forEach(d => { b[d.bucket] = (b[d.bucket] || 0) + 1; });
    tiles.appendChild(tile('ok', b.ok || 0, 'Документов АБ действует', () => go('docs', { b: 'ok' })));
    tiles.appendChild(tile('draft', (b.draft || 0) + (b.ready || 0), 'Проекты и готовые к утверждению', () => go('docs', { b: 'draft' })));
    tiles.appendChild(tile('miss', b.tbd || 0, 'Уточняется / отсутствует', () => go('docs', { b: 'tbd' })));
  }
  if (mx) { const all = mx.sections.flatMap(s => s.items); const miss = all.filter(i => i.bucket === 'missing').length; tiles.appendChild(tile('miss', miss, `Матрица ИКАО: требований без акта (из ${all.length})`, () => go('matrix', { b: 'missing' }))); }
  m.appendChild(tiles);

  const g = el('div', 'grid2');
  // обратный отсчёт
  const ad = settings().auditDate;
  const cd = el('div', 'card');
  cd.innerHTML = `<h2>${esc(t('Дней до аудита'))}</h2>` + (ad
    ? `<div class="countdown ${daysTo(ad) < 60 ? 'warn' : ''}">${daysTo(ad) >= 0 ? daysTo(ad) : 'аудит прошёл'}</div><div class="dim">${esc(t('Аудит на месте'))}: ${fmtDate(ad)}${settings().ncmc ? ' · NCMC: ' + esc(settings().ncmc) : ''}</div>`
    : `<div class="dim">${esc(t('Дата аудита не задана'))}. <a href="#data">${esc(t('Настройки'))} →</a></div>`)
    + auditBrief() + `<h3>Дорожная карта USAP-CMA</h3>` + STAGES.map((s, i) => { const stt = stageStatus(s); return `<div class="row small" style="padding:3px 0"><span class="badge b-${stt === 'done' ? 'ok' : stt === 'wip' ? 'wip' : 'none'}" style="min-width:26px;text-align:center">${i + 1}</span><span class="grow">${esc(s.t)}</span></div>`; }).join('')
    + `<div class="mt"><a class="btn sm ghost" href="#plan">Открыть дорожную карту</a></div>`;
  g.appendChild(cd);
  // по областям
  if (pq) {
    const c = el('div', 'card'); c.innerHTML = `<h2>Готовность по областям проверки</h2>`;
    pq.meta.areas.forEach(a => {
      const its = pq.items.filter(i => i.area === a.code); const cnt = { sat: 0, wip: 0, unsat: 0, na: 0 };
      its.forEach(i => { const s = (st[i.id] || {}).st; if (s) cnt[s]++; });
      const n = cnt.sat + cnt.wip + cnt.unsat + cnt.na;
      const r = el('div', '', `<div class="row small" style="margin-top:8px"><span class="badge b-area">${a.code}</span><span class="grow">${esc(a.name)}</span><span class="dim">${n}/${its.length}</span></div>${prog(cnt, its.length)}`);
      r.style.cursor = 'pointer'; r.onclick = () => go('pq', { area: a.code }); c.appendChild(r);
    });
    c.appendChild(el('div', 'legend', `<span><i style="background:var(--ok)"></i>${esc(t('Удовлетворительно'))}</span><span><i style="background:var(--draft)"></i>${esc(t('В работе'))}</span><span><i style="background:var(--miss)"></i>${esc(t('Неудовлетворительно'))}</span><span><i style="background:var(--na)"></i>${esc(t('Не применимо'))}</span>`));
    g.appendChild(c);
  }
  // на что смотреть
  const w = el('div', 'card'); w.innerHTML = `<h2>Требует внимания</h2>`;
  const ul = el('ul', 'list');
  if (mx) mx.sections.flatMap(s => s.items).filter(i => i.bucket === 'missing').forEach(i => ul.appendChild(el('li', '', `${badge('missing')} ${esc(i.title)} <span class="dim small">— ${esc(i.icao)}</span>`)));
  if (reg) reg.docs.filter(d => d.bucket === 'draft' || d.bucket === 'ready').forEach(d => ul.appendChild(el('li', '', `${badge(d.bucket)} ${esc(d.ru)} <span class="dim small">— ${esc(d.approved)}</span>`)));
  if (cc) cc.items.filter(i => (i.kind === 'std' || i.kind === 'rp') && ccOf(i).st === 'missing').forEach(i => ul.appendChild(el('li', '', `${badge('missing', 'CC')} Прил. ${i.annex} ${esc(i.kind === 'rp' ? 'РП' : 'Ст.')} ${esc(i.id)} <span class="dim small">— ${esc((i.remarks || i.desc || i.ref).slice(0, 140))}</span>`)));
  if (cap && cap.meta.update) { const s = capStats(cap); if (s.open) ul.appendChild(el('li', '', `${badge('draft', 'ПКД')} ${esc(t('Незакрытых рекомендаций ПКД'))}: ${s.open} из ${s.total} <a href="#cap?st=open">→</a>`)); }
  if (!ul.children.length) ul.appendChild(el('li', 'dim', 'Открытых позиций нет.'));
  w.appendChild(ul); g.appendChild(w);
  // по ответственным
  if (pq && team().length) {
    const c = el('div', 'card'); c.innerHTML = `<h2>${esc(t('Ответственные'))}</h2>`;
    c.appendChild(table(['Ответственный', 'ВП', 'Оценено', 'Удовл.', 'Неудовл.', 'Просрочено'], teamStats(), r => [`<b>${esc(r.name)}</b>${r.areas.length ? `<div class="small dim">${r.areas.join(', ')}</div>` : ''}`, r.total, r.assessed, r.sat, r.unsat, r.overdue ? `<span class="warn">${r.overdue}</span>` : '0'], r => go('pq', { resp: r.id })));
    c.appendChild(el('div', 'row', `<a class="btn sm ghost" href="#team">${esc(t('Ответственные'))} →</a>`));
    g.appendChild(c);
  }
  // ссылки
  const l = el('div', 'card'); const dr = D('drive');
  l.innerHTML = `<h2>Быстрые ссылки</h2>` + links([
    dr && { title: 'Папка проекта Avsec в Google Drive', url: dr.meta.root },
    { title: 'Реестр документов АБ', url: '#docs' }, { title: 'Протокольные вопросы USAP-CMA', url: '#pq' }, { title: 'Документы ИКАО (Прил. 17, Doc 8973, Doc 10047, Doc 9807)', url: '#icao' },
    { title: 'Словарь RU·TJ·EN', url: '#glossary' }].filter(Boolean));
  g.appendChild(l);
  m.appendChild(g);
}

/* ---------- Протокольные вопросы ---------- */
function pPQ(m) {
  const d = D('pq'); if (!d) return m.appendChild(el('div', 'empty', 'Данные ВП не загружены'));
  head(m, 'Протокольные вопросы', `${esc(d.meta.title)} · опубликовано ${fmtDate(d.meta.published)} · ${d.items.length} ВП. Статус, ответственный, срок и доказательства — самооценка государства, хранится на этом устройстве.`);
  const st = pqState();
  const tb = el('div', 'toolbar');
  tb.appendChild(selector('Все области', 'area', d.meta.areas.map(a => a.code), c => { const a = d.meta.areas.find(x => x.code === c); return `${c} — ${a.name}`; }));
  const subs = d.meta.subs.filter(s => !S.f.area || s.code[0] === (d.meta.areas.findIndex(a => a.code === S.f.area) + 1 + ''));
  tb.appendChild(selector('Подраздел', 'sub', subs.map(s => s.code), c => { const s = subs.find(x => x.code === c); return `${c} ${s.name}`; }));
  tb.appendChild(selector('Все КЭ', 'ce', Object.keys(d.meta.ce), c => `${c} — ${d.meta.ce[c]}`));
  tb.appendChild(selector('Все статусы', 'st', ['', 'wip', 'sat', 'unsat', 'na'].filter(Boolean).concat(['none']), c => c === 'none' ? t('Не оценено') : t(PQST[c])));
  tb.appendChild(toggle('Только со звёздочкой', 'star'));
  tb.appendChild(selector('Все ответственные', 'resp', team().map(x => x.id).concat(['none']), c => c === 'none' ? t('Не назначен') : nameOf(c)));
  tb.appendChild(inputFilter('Поиск по тексту ВП'));
  const ex = el('button', 'btn ghost sm', esc(t('Экспорт CSV'))); ex.onclick = () => exportPQ(list); tb.appendChild(ex);
  const pr = el('button', 'btn ghost sm', esc(t('Печать'))); pr.onclick = () => window.print(); tb.appendChild(pr);
  m.appendChild(tb);
  let list = d.items.filter(i => (!S.f.area || i.area === S.f.area) && (!S.f.sub || i.sub === S.f.sub) && (!S.f.ce || i.ce === S.f.ce) && (!S.f.star || i.star)
    && (!S.f.st || (S.f.st === 'none' ? !(st[i.id] || {}).st : (st[i.id] || {}).st === S.f.st))
    && (!S.f.resp || (S.f.resp === 'none' ? !respOfPQ(i) : (respOfPQ(i) || {}).id === S.f.resp))
    && has(S.f.s, i.id, i.q, i.g.join(' '), i.doc, (respOfPQ(i) || {}).name, (st[i.id] || {}).ev));
  const cnt = { sat: 0, wip: 0, unsat: 0, na: 0 }; list.forEach(i => { const s = (st[i.id] || {}).st; if (s) cnt[s]++; });
  const n = cnt.sat + cnt.wip + cnt.unsat + cnt.na;
  m.appendChild(el('div', 'card', `<div class="row"><b>${list.length}</b> <span class="dim">ВП · ${esc(t('Оценено'))} ${n} (${pct(n, list.length)}%) · ★ — применяется при оценке соблюдения Стандарта</span></div>${prog(cnt, list.length)}`));
  m.appendChild(table(['№ ВП', 'Область', 'КЭ', 'Вопрос', 'Прил.', 'Статус', 'Ответственный', 'Срок'], list,
    i => { const o = st[i.id] || {}; return [`<span class="code">${esc(i.id)}</span>${i.star ? ' <span class="star">★</span>' : ''}${capHas(i.id) ? ' <span class="dim" title="Вывод аудита 2019">⚑</span>' : ''}`, `<span class="badge b-area">${i.area}</span>`, `<span class="badge b-ce">${esc(i.ce)}</span>`,
      `<div class="td-wrap clamp" title="${esc(i.q)}">${esc(i.q)}</div>`, `<span class="mono">${esc(i.doc)}</span>`, pqBadge(o.st), (r => r ? (r.byArea ? `<span class="dim" title="${esc(t('по области'))}">${esc(r.name)}</span>` : esc(r.name)) : '—')(respOfPQ(i)), o.due ? `<span class="${daysTo(o.due) < 0 && o.st !== 'sat' ? 'warn' : ''}">${fmtDate(o.due)}</span>` : '—']; },
    openPQ, { groupKey: S.f.sub || S.f.ce ? null : (i => { const s = d.meta.subs.find(x => x.code === i.sub); return s ? `${s.code} ${s.name}` : i.area; }) }));
}
function openPQ(i) {
  const d = D('pq'); const o = pqOf(i.id);
  openSheet(`<h3><span class="code">${esc(i.id)}</span>${i.star ? ' <span class="star">★</span>' : ''} <span class="badge b-area">${i.area}</span> <span class="badge b-ce" title="${esc(d.meta.ce[i.ce] || '')}">${esc(i.ce)}</span> ${pqBadge(o.st)}</h3>
    <p><b>${esc(i.q)}</b></p>${capRef(i.id)}
    <h4>Рекомендации по рассмотрению / подтверждающие данные</h4>${i.g.length ? `<ul class="list">${i.g.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : '<p class="dim">—</p>'}
    ${kv([['Документ ИКАО', `<span class="mono">${esc(i.doc)}</span> (${i.area === 'FAL' ? 'Приложение 9' : 'Приложение 17'})`], ['Критический элемент', `${esc(i.ce)} — ${esc(d.meta.ce[i.ce] || '')}`], ['Подраздел', esc((d.meta.subs.find(s => s.code === i.sub) || {}).name || '')]])}
    <h4>Самооценка</h4>
    <form class="form" id="pqForm">
      <div class="two">
        <label>${esc(t('Статус'))}<select name="st">${Object.entries(PQST).map(([k, v]) => `<option value="${k}"${o.st === k ? ' selected' : ''}>${esc(t(v))}</option>`).join('')}</select></label>
        <label>${esc(t('Срок'))}<input type="date" name="due" value="${esc(o.due || '')}"></label>
      </div>
      <label>${esc(t('Ответственный'))}${(r => r && r.byArea ? ` <span class="dim">(${esc(t('по области'))}: ${esc(r.name)})</span>` : '')(respOfPQ(i))}${respSelect('resp', o.resp || '', true)}</label>
      <label>${esc(t('Доказательства'))} (документы, пункты, ссылки на Drive)<textarea name="ev">${esc(o.ev || '')}</textarea></label>
      <label>${esc(t('Примечание'))}<textarea name="note">${esc(o.note || '')}</textarea></label>
      <div class="row"><button class="btn" type="submit">${esc(t('Сохранить'))}</button><button class="btn ghost" type="button" id="pqClear">Очистить</button><span class="dim small grow">${o.at ? 'изменено ' + esc(o.at) : ''}</span></div>
    </form>`);
  $('#pqForm').onsubmit = e => {
    e.preventDefault(); const f = new FormData(e.target); const all = pqState();
    const rec = { st: f.get('st'), due: f.get('due'), resp: (f.get('resp') || '').trim(), ev: f.get('ev').trim(), note: f.get('note').trim(), at: today() };
    if (!rec.st && !rec.due && !rec.resp && !rec.ev && !rec.note) delete all[i.id]; else all[i.id] = rec;
    LS.set(K.pq, all); toast('Сохранено: ВП ' + i.id, 'ok'); closeSheet(); render();
  };
  $('#pqClear').onclick = () => { const all = pqState(); delete all[i.id]; LS.set(K.pq, all); closeSheet(); render(); };
}
function exportPQ(list) {
  const st = pqState();
  const rows = [['№ ВП', '★', 'Область', 'Подраздел', 'КЭ', 'Вопрос', 'Рекомендации', 'Документ ИКАО', 'Статус самооценки', 'Ответственный', 'Срок', 'Доказательства', 'Примечание']];
  list.forEach(i => { const o = st[i.id] || {}; rows.push([i.id, i.star ? '*' : '', i.area, i.sub, i.ce, i.q, i.g.join('\n'), i.doc, PQST[o.st || ''], (respOfPQ(i) || {}).name || '', o.due || '', o.ev || '', o.note || '']); });
  download(csv(rows), `AvSec_PQ_${today()}.csv`, 'text/csv;charset=utf-8');
}

/* ---------- Контрольный перечень соответствия ---------- */
function pCC(m) {
  const d = D('cc'); if (!d) return m.appendChild(el('div', 'empty', 'Данные CC не загружены'));
  head(m, 'Контрольный перечень (CC)', `${esc(d.meta.title)} · источник: ${esc(d.meta.source)}. Статус выводится автоматически из графы «Замечания» и может быть уточнён вручную.`);
  const tb = el('div', 'toolbar');
  const annex = S.f.annex || '17';
  ['17', '9'].forEach(a => { const b = el('button', 'chip' + (annex === a ? ' on' : ''), `Приложение ${a}`); b.onclick = () => { S.f.annex = a; S.f.ch = ''; go('cc', S.f); }; tb.appendChild(b); });
  const items = d.items.filter(i => String(i.annex) === annex);
  tb.appendChild(selector('Все главы', 'ch', uniq(items.map(i => String(i.ch))), c => 'Глава ' + c));
  tb.appendChild(selector('Все статусы', 'st', ['ok', 'part', 'missing', 'bad'], c => c === 'bad' ? 'Частично + расхождения' : t(CCST[c])));
  tb.appendChild(toggle('Показать определения и заголовки', 'defs'));
  tb.appendChild(inputFilter('Поиск по тексту SARP / норме'));
  const ex = el('button', 'btn ghost sm', esc(t('Экспорт CSV'))); ex.onclick = () => {
    const rows = [['Приложение', 'Глава', 'Тип', 'Пункт', 'Текст SARP', 'Национальная норма', 'Категория различия', 'Описание', 'Замечания', 'Статус (портал)', 'Примечание (портал)']];
    list.forEach(i => { const o = ccOf(i); rows.push([i.annex, i.ch, i.kind, i.id, i.text, i.ref, i.diff, i.desc, i.remarks, CCST[o.st] || '', o.note]); });
    download(csv(rows), `AvSec_CC_Annex${annex}_${today()}.csv`, 'text/csv;charset=utf-8');
  }; tb.appendChild(ex);
  m.appendChild(tb);
  let list = items.filter(i => (S.f.defs || i.kind === 'std' || i.kind === 'rp') && (!S.f.ch || String(i.ch) === S.f.ch) && has(S.f.s, i.id, i.text, i.ref, i.remarks, i.desc));
  if (S.f.st) list = list.filter(i => { const s = ccOf(i).st; return S.f.st === 'bad' ? (s === 'part' || s === 'missing') : s === S.f.st; });
  const sarps = items.filter(i => i.kind === 'std' || i.kind === 'rp'); const cnt = {}; sarps.forEach(i => { const s = ccOf(i).st; cnt[s] = (cnt[s] || 0) + 1; });
  m.appendChild(el('div', 'card', `<div class="row"><b>${list.length}</b><span class="dim">строк · Прил. ${annex}: SARPs ${sarps.length} — ${badge('ok', CCST.ok)} ${cnt.ok || 0} · ${badge('part', CCST.part)} ${cnt.part || 0} · ${badge('missing', CCST.missing)} ${cnt.missing || 0}</span></div>`));
  m.appendChild(table(['Пункт', 'Текст SARP', 'Национальная норма', 'Статус', 'Замечание'], list,
    i => { const o = ccOf(i); return [i.kind === 'hdr' ? `<b>${esc(i.text)}</b>` : `<span class="badge b-${i.kind}">${i.kind === 'std' ? 'Ст.' : i.kind === 'rp' ? 'РП' : 'Опр.'}</span> <span class="mono">${esc(i.id)}</span>`,
      i.kind === 'hdr' ? '' : `<div class="td-wrap clamp" title="${esc(i.text)}">${esc(i.text)}</div>`, `<div class="td-wrap clamp">${esc(i.ref || '—')}</div>`, o.st ? badge(o.st, CCST[o.st]) + (o.auto ? '' : ' <span class="dim small">✎</span>') : '', `<div class="td-wrap clamp small">${esc(i.remarks || i.desc || '')}</div>`]; },
    i => i.kind !== 'hdr' && openCC(i), { groupKey: i => i.section || `Глава ${i.ch}` }));
}
function openCC(i) {
  const o = ccOf(i);
  openSheet(`<h3><span class="badge b-${i.kind}">${i.kind === 'std' ? 'Стандарт' : i.kind === 'rp' ? 'Рекомендуемая практика' : 'Определение'}</span> Приложение ${i.annex}, глава ${i.ch} ${esc(i.id)} ${o.st ? badge(o.st, CCST[o.st]) : ''}</h3>
    <p>${esc(i.text)}</p>
    ${kv([['Национальная норма', esc(i.ref || '—')], ['Категория различия', esc(i.diff)], ['Описание различия', esc(i.desc)], ['Замечания', esc(i.remarks)], ['Раздел', esc(i.section)]])}
    ${(i.kind === 'std' || i.kind === 'rp') ? `<h4>Оценка соответствия (портал)</h4><form class="form" id="ccForm">
      <div class="two"><label>${esc(t('Статус'))}<select name="st"><option value="">авто: ${esc(t(CCST[ccAuto(i)] || ''))}</option>${Object.entries(CCST).map(([k, v]) => `<option value="${k}"${!o.auto && o.st === k ? ' selected' : ''}>${esc(t(v))}</option>`).join('')}</select></label></div>
      <label>${esc(t('Примечание'))} (что нужно сделать, где норма)<textarea name="note">${esc(o.note)}</textarea></label>
      <div class="row"><button class="btn" type="submit">${esc(t('Сохранить'))}</button><a class="btn ghost" href="#pq?s=${encodeURIComponent(i.id)}">ВП по пункту ${esc(i.id)}</a></div></form>` : ''}`);
  const f = $('#ccForm'); if (f) f.onsubmit = e => {
    e.preventDefault(); const fd = new FormData(e.target); const all = ccState(); const k = i.annex + ':' + i.id;
    const rec = { st: fd.get('st'), note: fd.get('note').trim() }; if (!rec.st && !rec.note) delete all[k]; else all[k] = rec;
    LS.set(K.cc, all); toast('Сохранено: ' + i.id, 'ok'); closeSheet(); render();
  };
}

/* ---------- SASAQ ---------- */
function pSASAQ(m) {
  const d = D('sasaq'); if (!d) return m.appendChild(el('div', 'empty', 'Данные SASAQ не загружены'));
  head(m, 'SASAQ', `${esc(d.meta.title)} · источник: ${esc(d.meta.source)}. «Заполнено» — в ответных ячейках есть текст; «Проверено» — отметка ответственного на этом устройстве.`);
  const st = sasaqState();
  const tb = el('div', 'toolbar');
  tb.appendChild(selector('Все области', 'area', d.meta.areas.map(a => a.code), c => `${c} — ${d.meta.areas.find(a => a.code === c).name}`));
  tb.appendChild(selector('Все статусы', 'st', ['filled', 'empty', 'checked'], c => ({ filled: t('Заполнено'), empty: t('Не заполнено'), checked: t('Проверено') })[c]));
  tb.appendChild(inputFilter('Поиск по вопросу'));
  m.appendChild(tb);
  const list = d.items.filter(i => (!S.f.area || i.area === S.f.area) && has(S.f.s, i.code, i.text, i.rows.flat().join(' '))
    && (!S.f.st || (S.f.st === 'filled' ? i.filled : S.f.st === 'empty' ? !i.filled : (st[i.code] || {}).done)));
  const f = d.items.filter(i => i.filled).length, c = d.items.filter(i => (st[i.code] || {}).done).length;
  m.appendChild(el('div', 'card', `<div class="row"><b>${list.length}</b><span class="dim">вопросов · ${esc(t('Заполнено'))} ${f}/${d.items.length} · ${esc(t('Проверено'))} ${c}/${d.items.length}</span></div>${prog({ sat: c, wip: f - c > 0 ? f - c : 0 }, d.items.length)}`));
  m.appendChild(table(['Код', 'Вопрос', 'Ответ (фрагмент)', 'Статус'], list,
    i => { const o = st[i.code] || {}; const ans = i.rows.slice(1).flat().filter(x => !x.toUpperCase || x !== x.toUpperCase()).join(' · ').slice(0, 160);
      return [`<span class="code">${esc(i.code)}</span>`, `<div class="td-wrap">${esc(i.text)}</div>`, `<div class="td-wrap clamp small dim">${esc(ans || '—')}</div>`, (i.filled ? badge('ok', 'Заполнено') : badge('missing', 'Не заполнено')) + (o.done ? ' ' + badge('info', 'Проверено') : '')]; },
    openSASAQ, { groupKey: i => `${i.area} — ${d.meta.areas.find(a => a.code === i.area).name}` }));
}
function openSASAQ(i) {
  const o = sasaqState()[i.code] || {};
  openSheet(`<h3><span class="code">${esc(i.code)}</span> ${i.filled ? badge('ok', 'Заполнено') : badge('missing', 'Не заполнено')} ${o.done ? badge('info', 'Проверено') : ''}</h3><p><b>${esc(i.text)}</b></p>
    <h4>Содержимое ячеек SASAQ 1</h4>${i.rows.length ? `<div class="tw"><table>${i.rows.map((r, k) => `<tr>${r.map(c => `<td class="${k === 0 ? 'small dim' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>` : '<p class="dim">Ответные ячейки пусты.</p>'}
    <form class="form" id="sqForm"><label><input type="checkbox" name="done"${o.done ? ' checked' : ''} style="width:auto;margin-right:8px">${esc(t('Проверено'))} ответственным</label>
      <label>${esc(t('Примечание'))} (что дополнить в SASAQ)<textarea name="note">${esc(o.note || '')}</textarea></label>
      <div class="row"><button class="btn" type="submit">${esc(t('Сохранить'))}</button></div></form>`);
  $('#sqForm').onsubmit = e => { e.preventDefault(); const fd = new FormData(e.target); const all = sasaqState(); const rec = { done: !!fd.get('done'), note: fd.get('note').trim() }; if (!rec.done && !rec.note) delete all[i.code]; else all[i.code] = rec; LS.set(K.sasaq, all); toast('Сохранено: ' + i.code, 'ok'); closeSheet(); render(); };
}

/* ---------- Дорожная карта ---------- */
function pPlan(m) {
  head(m, 'Дорожная карта', 'Этапы подготовки к аудиту USAP-CMA. Статус части этапов выводится из данных портала (SASAQ, CC, ВП); даты и статусы можно задать вручную — они хранятся на этом устройстве.');
  const ad = settings().auditDate;
  m.appendChild(el('div', 'card callout', ad ? `<b>${esc(t('Дней до аудита'))}: ${daysTo(ad)}</b> · ${fmtDate(ad)} · <a href="#data">${esc(t('Настройки'))}</a>` : `${esc(t('Дата аудита не задана'))} — <a href="#data">${esc(t('Настройки'))}</a>`));
  const c = el('div', 'card'); const ps = planState();
  STAGES.forEach((s, i) => {
    const stt = stageStatus(s); const o = ps[s.id] || {}; const hint = typeof s.hint === 'function' ? s.hint() : s.hint; const due = o.date || (typeof s.due === 'function' ? s.due() : s.due) || ''; const late = due && stt !== 'done' && daysTo(due) < 0;
    const row = el('div', 'stage ' + (stt || ''), `<div class="no">${i + 1}</div><div><b>${esc(s.t)}</b><div class="small dim">${esc(hint)}</div>${due ? `<div class="small ${late ? 'warn' : 'dim'}">${esc(t('Срок'))}: ${fmtDate(due)}${late ? ' · ' + esc(t('Просрочено')) + ' ' + (-daysTo(due)) + ' дн.' : ''}</div>` : ''}${o.resp ? `<div class="small">👤 ${esc(nameOf(o.resp))}</div>` : ''}${o.note ? `<div class="small">${esc(o.note)}</div>` : ''}</div>
      <div class="ctl"><select data-id="${s.id}" data-k="resp" title="${esc(t('Ответственный'))}"><option value="">— ${esc(t('Ответственный'))} —</option>${team().map(x => `<option value="${x.id}"${o.resp === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select><select data-id="${s.id}" data-k="st">${Object.entries(STG).map(([k, v]) => `<option value="${k}"${(o.st !== undefined && o.st !== '' ? o.st : '') === k ? ' selected' : ''}>${esc(t(v))}${k === '' && s.auto() ? ' (авто: ' + esc(t(STG[s.auto()])) + ')' : ''}</option>`).join('')}</select><input type="date" data-id="${s.id}" data-k="date" value="${esc(o.date || '')}" title="Плановая дата"><button class="btn sm ghost" data-note="${s.id}">✎</button></div>`);
    c.appendChild(row);
  });
  c.onchange = e => { const x = e.target; if (!x.dataset.id) return; const all = planState(); all[x.dataset.id] = { ...(all[x.dataset.id] || {}), [x.dataset.k]: x.value }; LS.set(K.plan, all); render(); };
  c.onclick = e => { const b = e.target.closest('[data-note]'); if (!b) return; const id = b.dataset.note; const all = planState(); const v = prompt('Примечание к этапу', (all[id] || {}).note || ''); if (v === null) return; all[id] = { ...(all[id] || {}), note: v.trim() }; LS.set(K.plan, all); render(); };
  m.appendChild(c);
  // пакет документов GEN-05
  const reg = D('registry');
  if (reg) {
    const need = [['Primary aviation security legislation', ['R01']], ['Aviation security regulations', ['R06', 'R05', 'R09']], ['National Civil Aviation Security Programme', ['R02']], ['National Civil Aviation Security Training Programme/Policy', ['R04']], ['National Civil Aviation Security Quality Control Programme', ['R05', 'R16']], ['National Air Transport Facilitation Programme', ['R03']], ['Airport Security Programme(s) — Dushanbe (DYU)', []], ['Schedule of national quality control activities (2 предыдущих года + текущий)', []]];
    const k = el('div', 'card'); k.innerHTML = `<h2>Пакет документов к подаче (SASAQ GEN-05)</h2>`;
    k.appendChild(table(['№', 'Документ', 'В реестре АБ', 'Статус'], need.map((n, i) => ({ i: i + 1, n })), r => { const ds = r.n[1].map(id => reg.docs.find(d => d.id === id)).filter(Boolean); return [r.i, esc(r.n[0]), ds.map(d => `<div class="small">${esc(d.ru)}</div>`).join('') || '<span class="dim small">' + (r.i === 7 ? 'ПАБ аэропорта — за эксплуатантом (в папке «перевод на англ» есть ASP DYU 2026 EN)' : 'график КК — формируется отделом АБ') + '</span>', ds.map(d => badge(d.bucket)).join(' ') || badge('tbd')]; }));
    m.appendChild(k);
  }
}

/* ---------- Аудит USAP-CMA 2026 ---------- */
// Статусы документов: локальная отметка на устройстве; если её нет — факт отправки из данных (usap.requested[].sent),
// чтобы «отправлено в ИКАО» было видно на любом устройстве без ручных галочек.
function auditState() { const a = LS.get(K.audit, {}); const docs = { ...(a.docs || {}) }; const u = U();
  if (u) u.requested.forEach(r => { if (r.sent && !(docs[r.id] && docs[r.id].st)) docs[r.id] = { ...(docs[r.id] || {}), st: 'sent', at: r.sent.date, note: (docs[r.id] || {}).note || `${fmtDate(r.sent.date)}: ${r.sent.files.join('; ')} — ${r.sent.via}`, data: true }; });
  return { docs, log: a.log || {} }; }
const saveAudit = a => LS.set(K.audit, { ...a, docs: Object.fromEntries(Object.entries(a.docs).filter(([, v]) => !v.data)) });   // факт из данных не дублируем в localStorage
const ADOC = { '': 'Не начато', wip: 'В работе', ready: 'Готово', sent: 'Отправлено в ИКАО', na: 'Не применимо' };
const ADOCB = { '': 'none', wip: 'wip', ready: 'draft', sent: 'ok', na: 'na' };
function auditBrief() {
  const u = U(); if (!u) return '';
  const a = auditState(); const n = u.requested.length, sent = u.requested.filter(r => (a.docs[r.id] || {}).st === 'sent').length;
  const dl = u.audit.docsDeadline, late = daysTo(dl) < 0 && sent < n;
  return `<div class="small mt">${esc(t('Аудит на месте'))}: <b>${fmtDate(u.audit.start)} – ${fmtDate(u.audit.end)}</b>, ${esc(u.audit.placeShort)} · NCMC: ${esc(u.ncmc.name)}</div><div class="small ${late ? 'warn' : 'dim'}">Документы ИКАО: отправлено ${sent} из ${n} · срок ${fmtDate(dl)}${late ? ' · просрочен на ' + (-daysTo(dl)) + ' дн.' : ''}</div><div class="mt"><a class="btn sm ghost" href="#audit">${esc(t('Аудит USAP-CMA 2026'))} →</a></div>`;
}
function pAudit(m) {
  const u = U(); if (!u) return m.appendChild(el('div', 'empty', 'Данные об аудите не загружены'));
  head(m, 'Аудит USAP-CMA 2026', `${esc(u.meta.title)} · обновлено ${fmtDate(u.meta.updated)} · факты — из переписки с ИКАО и SASAQ, статусы чек-листов — на этом устройстве`);
  const a = auditState();
  const sent = u.requested.filter(r => (a.docs[r.id] || {}).st === 'sent').length, done = u.logistics.filter(l => (a.log[l.id] || (l.done ? { done: true } : {})).done).length, dl = daysTo(u.audit.docsDeadline);
  const tiles = el('div', 'tiles');
  tiles.appendChild(tile('info', daysTo(u.audit.start), 'Дней до начала аудита', () => go('plan')));
  tiles.appendChild(tile(sent === u.requested.length ? 'ok' : 'miss', `${sent}/${u.requested.length}`, 'Документов отправлено в ИКАО', () => $('#reqDocs').scrollIntoView({ behavior: 'smooth' })));
  tiles.appendChild(tile(done === u.logistics.length ? 'ok' : 'draft', `${done}/${u.logistics.length}`, 'Логистика: пунктов выполнено', () => $('#logi').scrollIntoView({ behavior: 'smooth' })));
  tiles.appendChild(tile(dl < 0 && sent < u.requested.length ? 'miss' : 'draft', dl < 0 ? `−${-dl}` : dl, dl < 0 ? 'Дней просрочки подачи документов' : 'Дней до срока подачи документов', () => $('#reqDocs').scrollIntoView({ behavior: 'smooth' })));
  m.appendChild(tiles);
  const g = el('div', 'grid2');
  const f = el('div', 'card'); f.innerHTML = `<h2>${esc(t('Ключевые факты'))}</h2>` + kv([
    ['Аудит на месте', `<b>${fmtDate(u.audit.start)} – ${fmtDate(u.audit.end)}</b> · ${esc(u.audit.place)}`],
    ['Согласование дат', esc(u.audit.agreedBy)],
    ['Уведомление ИКАО', `${fmtDate(u.notification.date)}, ${esc(u.notification.ref)} — предложено ${esc(u.notification.proposed)}; адресат — ${esc(u.notification.addressee)}`],
    ['МоВ ИКАО — Таджикистан', `подписан ${fmtDate(u.mou.signed)}`],
    ['Охват', esc(u.audit.scope)], ['Язык', esc(u.audit.language)],
    ['Группа ИКАО', `${u.audit.teamSize} чел.; руководитель — ${esc(u.audit.teamLeader)} · <a href="#audit" onclick="document.getElementById('team').scrollIntoView({behavior:'smooth'});return false">состав ↓</a>`],
    ['Визы', esc(u.audit.visa || '')], ['Гостиница', esc(u.audit.hotel || '')], ['План аудита', esc(u.audit.auditPlan || '')], ['AvSec Week', esc(u.audit.avsecWeek || '')],
    ['Срок подачи документов', `<span class="${dl < 0 ? 'warn' : ''}">${fmtDate(u.audit.docsDeadline)}</span> — ${esc(u.audit.docsDeadlineNote)}`],
    ['Загрузка документов', `<a href="${esc(u.audit.upload)}" target="_blank" rel="noopener">${esc(u.audit.upload)}</a> (не по e-mail)`],
    ['Портал ИКАО', `<a href="${esc(u.audit.portal)}" target="_blank" rel="noopener">${esc(u.audit.portal)}</a> — группа USAP (ВП, SASAQ, CC); доступ — по NC Welcome Package`],
    ['NCMC', `${esc(u.ncmc.name)}, ${esc(u.ncmc.title)} · ${esc(u.ncmc.email)} · ${esc(u.ncmc.phone)} <span class="dim small">(${esc(u.ncmc.source)})</span>`],
    ['Предыдущий аудит', `${esc(u.previous.audit)}. ${esc(u.previous.cap)}. 2019: EI ${u.previous.results2019.ei} %, соответствие Прил. 17 — ${u.previous.results2019.compliance} %; ${esc(u.previous.results.source)}: EI ${u.previous.results.ei} %, соответствие — ${u.previous.results.compliance} %. <a href="#cap">Выводы 2019 →</a>`],
  ]);
  g.appendChild(f);
  const sc = el('div', 'card'); sc.innerHTML = `<h2>${esc(t('План аудита'))} <span class="dim small">проект — письмо руководителя группы от 15.06.2026; окончательный план — после подачи SASAQ</span></h2>`;
  sc.appendChild(table(['Дата', 'Мероприятие'], u.schedule, r => [`<span class="mono">${r.date ? fmtDate(r.date) : ''}</span> <span class="dim small">${esc(r.dow || '')}</span>`, esc(r.text)]));
  g.appendChild(sc);
  m.appendChild(g);
  if (u.audit.team) {
    const TEAMST = { confirmed: ['ok', 'Подтверждён'], pending: ['draft', 'Ожидает подтверждения'] };
    const tc = el('div', 'card'); tc.id = 'team';
    tc.innerHTML = `<h2>${esc(t('Группа аудита ИКАО'))} <span class="dim small">${u.audit.team.length} чел. · письма 03.07 и 31.07.2026</span></h2>`;
    tc.appendChild(table(['Участник', 'Роль', 'Направлен', 'Паспорт / виза', 'Прибытие', 'Отъезд', 'Статус'], u.audit.team, x => [
      `<b>${esc(x.name)}</b>${x.email ? `<div class="small"><a href="mailto:${esc(x.email)}">${esc(x.email)}</a>${x.phone ? ' · ' + esc(x.phone) : ''}</div>` : ''}`,
      `<span class="small">${esc(x.role)}</span>`, `<span class="small">${esc(x.org)}</span>`, `<span class="small">${esc(x.passport)}</span>`,
      `<span class="small mono">${esc(x.arrive)}</span>`, `<span class="small mono">${esc(x.depart)}</span>`, badge((TEAMST[x.status] || ['none', x.status])[0], (TEAMST[x.status] || ['none', x.status])[1])]));
    if (u.audit.teamNote) tc.appendChild(el('p', 'small dim', esc(u.audit.teamNote)));
    m.appendChild(tc);
  }
  const reg = D('registry');
  const rd = el('div', 'card'); rd.id = 'reqDocs';
  rd.innerHTML = `<h2>${esc(t('Запрошенные документы'))} <span class="dim small">${sent}/${u.requested.length} отправлено</span></h2><p class="small dim">Письмо ИКАО от 01.05.2026 (не позднее чем за 60 дней), запрос руководителя группы от 15.06.2026, SASAQ GEN-05. Статус и примечание сохраняются на этом устройстве.</p>`;
  rd.appendChild(table(['№', 'Документ', 'Основание', 'В реестре АБ', 'Статус', 'Примечание'], u.requested,
    r => { const o = a.docs[r.id] || {}; const ds = reg ? (r.reg || []).map(id => reg.docs.find(d => d.id === id)).filter(Boolean) : [];
      return [r.n, `<b>${esc(r.ru)}</b><div class="small dim">${esc(r.en)}</div>${r.note ? `<div class="small">${esc(r.note)}</div>` : ''}`, `<span class="small">${esc(r.ref)}</span>`,
        ds.map(d => `<div class="small">${badge(d.bucket)} ${esc(d.ru)}</div>`).join('') || '<span class="dim small">—</span>',
        `<select class="sel" data-doc="${esc(r.id)}" style="height:30px">${Object.entries(ADOC).map(([k, v]) => `<option value="${k}"${(o.st || '') === k ? ' selected' : ''}>${esc(t(v))}</option>`).join('')}</select>${o.at ? `<div class="small dim">${esc(o.at)}</div>` : ''}`,
        `<input class="inp" data-note="${esc(r.id)}" value="${esc(o.note || '')}" placeholder="файл, дата, кто отправил">`]; }));
  rd.onchange = e => { const x = e.target; const st = auditState();
    if (x.dataset.doc) st.docs[x.dataset.doc] = { ...(st.docs[x.dataset.doc] || {}), data: undefined, st: x.value, at: today() };
    else if (x.dataset.note) st.docs[x.dataset.note] = { ...(st.docs[x.dataset.note] || {}), data: undefined, note: x.value.trim() };
    else return; saveAudit(st); toast('Сохранено', 'ok'); if (x.dataset.doc) render(); };
  // Enter в примечании — сохранить и перейти к следующей строке (быстрый ввод, как в Библиотеке Shohin)
  rd.addEventListener('keydown', e => { if (e.key !== 'Enter' || !e.target.dataset.note) return; e.preventDefault(); const ins = $$('input[data-note]', rd); const i = ins.indexOf(e.target); e.target.dispatchEvent(new Event('change', { bubbles: true })); if (ins[i + 1]) ins[i + 1].focus(); });
  m.appendChild(rd);
  const checkCard = (x, title, href, label) => { const c = el('div', 'card'); c.innerHTML = `<h2>${esc(t(title))} — проверка ${fmtDate(x.date)} <span class="dim small">${esc(x.file)}</span></h2><p><b class="warn">${esc(x.verdict)}</b> ${esc(x.summary)}</p><ul class="list">${x.items.map(y => `<li>${esc(y)}</li>`).join('')}</ul><p class="small dim">${esc(x.source)}</p><div class="row"><a class="btn sm ghost" href="${href}">${esc(label)} →</a></div>`; return c; };
  if (u.ccCheck) m.appendChild(checkCard(u.ccCheck, 'Готовность CC к подаче', '#cc', 'Контрольный перечень в портале'));
  if (u.capCheck) m.appendChild(checkCard(u.capCheck, 'Готовность ПКД к подаче', '#cap?st=open', 'Незакрытые рекомендации ПКД'));
  const lg = el('div', 'card'); lg.id = 'logi'; lg.innerHTML = `<h2>${esc(t('Логистика'))} и организация <span class="dim small">${done}/${u.logistics.length}</span></h2>`;
  lg.appendChild(table(['', 'Пункт', 'Источник'], u.logistics, l => { const o = a.log[l.id] || (l.done ? { done: true, at: l.done } : {}); return [`<input type="checkbox" data-log="${esc(l.id)}"${o.done ? ' checked' : ''}>`, `<span class="${o.done ? 'dim' : ''}">${esc(l.text)}</span>${o.at ? ` <span class="dim small">${esc(o.at)}</span>` : ''}`, `<span class="small dim">${esc(l.ref || '')}</span>`]; }));
  lg.onchange = e => { const x = e.target; if (!x.dataset.log) return; const st = auditState(); st.log[x.dataset.log] = { done: x.checked, at: today() }; saveAudit(st); render(); };
  m.appendChild(lg);
  const g2 = el('div', 'grid2');
  const ct = el('div', 'card'); ct.innerHTML = `<h2>${esc(t('Контакты'))}</h2>` + kv(u.contacts.map(c => [c.who, `${esc(c.role)}${c.email ? ' · <a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : ''}${c.phone ? ' · ' + esc(c.phone) : ''}`]));
  g2.appendChild(ct);
  const fl = el('div', 'card'); fl.innerHTML = `<h2>${esc(t('Файлы'))} (Drive)</h2>` + links(u.files); g2.appendChild(fl);
  m.appendChild(g2);
  m.appendChild(el('div', 'card small dim', `Источники: ${u.meta.sources.map(esc).join('; ')}.`));
}

/* ---------- Выводы аудита 2019 (CAP) ---------- */
const CAPP = { critical: 'Очень высокий', high: 'Высокий', medium: 'Средний', low: 'Низкий' };
const CAPB = { critical: 'unsat', high: 'missing', medium: 'draft', low: 'ok' };
/* статусы выполнения рекомендаций — из редакции ПКД EN (cap2019.meta.update) */
const CAPST = { done: 'Выполнено', part: 'Частично', wip: 'В работе', ongoing: 'Постоянно', na: 'Не применимо', '': 'Нет статуса' };
const CAPSB = { done: 'ok', part: 'draft', wip: 'wip', ongoing: 'info', na: 'na', '': 'none' };
const capSt = i => (i.status && i.status.st) || '';
function capStats(c) { const s = { done: 0, part: 0, wip: 0, ongoing: 0, na: 0, open: 0, total: 0 }; c.findings.forEach(f => f.items.forEach(i => { const k = capSt(i); s.total++; if (s[k] !== undefined) s[k]++; if (k !== 'done' && k !== 'na') s.open++; })); return s; }
const capHas = id => { const c = D('cap2019'); return !!c && c.findings.some(f => f.items.some(i => i.pq === id)); };
function capRef(id) {
  const c = D('cap2019'); if (!c) return '';
  const hits = c.findings.flatMap(f => f.items.filter(i => i.pq === id).map(i => ({ f, i }))); if (!hits.length) return '';
  return `<div class="callout small"><b>Аудит 2019:</b> ${hits.map(({ f, i }) => `вывод № ${f.n} (${esc(CAPP[f.priority] || f.priority)}, SARP ${esc(i.sarp)}, КЭ-${esc(i.ce)}) — ${esc(i.rec)} ${i.status ? badge(CAPSB[capSt(i)], CAPST[capSt(i)]) : ''}`).join('<br>')} <a href="#cap?s=${encodeURIComponent(id)}">→ ПКД</a></div>`;
}
// срок незакрытой рекомендации (status.due из редакции EN v2): красным, если прошёл
const capDue = i => { const d = i.status && i.status.due; if (!d) return ''; const late = daysTo(d) < 0 && capSt(i) !== 'done'; return `<div class="small ${late ? 'warn' : 'dim'}" title="Deadline в редакции EN v2 (предложение, подтвердить)">${late ? '⚠ ' : ''}срок ${esc(fmtDate(d))}</div>`; };
function pCAP(m) {
  const c = D('cap2019'); if (!c) return m.appendChild(el('div', 'empty', 'Данные ПКД не загружены'));
  const up = c.meta.update;
  head(m, 'Выводы аудита 2019 (CAP)', `${esc(c.meta.audit)} · ${esc(c.meta.cap)}${up ? ` · статусы — ${esc(up.title)}, ${esc(up.approved)}` : ''} · источник: ${esc(c.meta.source)}; ${esc(c.meta.report)}`);
  const stOk = i => !S.f.st || (S.f.st === 'open' ? (capSt(i) !== 'done' && capSt(i) !== 'na') : capSt(i) === S.f.st);
  const itOk = i => stOk(i) && has(S.f.s, i.sarp, i.pq, i.rec, i.action, i.status && i.status.en);
  const tb = el('div', 'toolbar');
  tb.appendChild(selector('Все области', 'area', Object.keys(c.meta.byArea), a => `${a} (${c.meta.byArea[a]})`));
  tb.appendChild(selector('Приоритет вывода', 'prio', ['critical', 'high', 'medium', 'low'], p => CAPP[p]));
  if (up) tb.appendChild(selector('Статус ПКД', 'st', ['open', 'done', 'part', 'wip', 'ongoing', 'na'], k => k === 'open' ? t('Незакрытые') : t(CAPST[k])));
  tb.appendChild(inputFilter('Поиск по SARP, ВП, тексту'));
  const ex = el('button', 'btn ghost sm', esc(t('Экспорт CSV'))); ex.onclick = () => download(csv([['Вывод', 'Приоритет вывода', 'Область', 'Приоритет', 'SARP', 'КЭ', 'ВП (2019)', 'Рекомендация ИКАО', 'Замечания', 'Корректирующее действие', 'Организация', 'Начало', 'Окончание', 'Окончание (EN v2)', 'Срок (EN v2)', 'Статус', 'Статус (EN, редакция v2 2026)']].concat(list.flatMap(f => f.items.filter(itOk).map(i => [f.n, CAPP[f.priority], f.area, CAPP[i.prio], i.sarp, i.ce, i.pq, i.rec, i.comment, i.action, i.org, i.start, i.end, i.status ? i.status.endEn || '' : '', i.status ? i.status.due || '' : '', CAPST[capSt(i)], i.status ? i.status.en : ''])))), `AvSec_CAP2019_${today()}.csv`, 'text/csv;charset=utf-8'); tb.appendChild(ex);
  m.appendChild(tb);
  if (up) {
    const s = capStats(c); const tiles = el('div', 'tiles');
    tiles.appendChild(tile('ok', s.done, 'Выполнено', () => go('cap', { st: 'done' })));
    tiles.appendChild(tile('draft', s.part, 'Частично', () => go('cap', { st: 'part' })));
    tiles.appendChild(tile('info', s.wip + s.ongoing, 'В работе / постоянно', () => go('cap', { st: 'wip' })));
    tiles.appendChild(tile(s.open ? 'miss' : 'ok', s.open, `Незакрыто (из ${s.total})`, () => go('cap', { st: 'open' })));
    m.appendChild(tiles);
  }
  const list = c.findings.filter(f => (!S.f.area || f.area === S.f.area) && (!S.f.prio || f.priority === S.f.prio) && f.items.some(itOk));
  m.appendChild(el('div', 'card', `<div class="row"><b>${list.length}</b><span class="dim">выводов из ${c.findings.length} · рекомендаций ${c.meta.items} · ${['critical', 'high', 'medium', 'low'].map(p => badge(CAPB[p], CAPP[p]) + ' ' + c.findings.filter(f => f.priority === p).length).join(' · ')}</span></div><p class="small dim">${esc(c.meta.note)}${up ? ' ' + esc(up.note) : ''}</p>${up && up.files ? links(up.files) : ''}`));
  const pq = D('pq');
  list.forEach(f => {
    const card = el('div', 'card');
    card.innerHTML = `<h2>Вывод № ${f.n} <span class="badge b-area">${f.area}</span> ${badge(CAPB[f.priority], CAPP[f.priority] || f.priority)}</h2>`;
    card.appendChild(table(['Приоритет', 'SARP', 'КЭ', 'ВП (2019)', 'Рекомендация ИКАО', 'Корректирующее действие (ПКД 2020)', 'Сроки', 'Статус'], f.items.filter(itOk),
      i => { const cur = pq && pq.items.find(x => x.id === i.pq); const k = capSt(i); return [badge(CAPB[i.prio], CAPP[i.prio] || i.prio), `<span class="mono">${esc(i.sarp)}</span>`, `<span class="badge b-ce">КЭ-${esc(i.ce)}</span>`,
        cur ? `<a href="#pq?s=${encodeURIComponent(i.pq)}" class="code">${esc(i.pq)}</a>` : `<span class="code dim" title="номер прежней редакции ВП">${esc(i.pq)}</span>`,
        `<div class="td-wrap small">${esc(i.rec)}</div>`, `<div class="td-wrap small">${esc(i.action)}${i.org ? `<div class="dim">${esc(i.org)}</div>` : ''}</div>`, `<span class="small">${esc(i.start)}${i.end ? ' – ' + esc(i.end) : ''}</span>${i.status && i.status.endEn ? `<div class="small dim" title="графа Completion date в редакции EN v2">EN v2: ${esc(i.status.endEn)}</div>` : ''}`,
        `${i.status ? badge(CAPSB[k], CAPST[k]) : ''}${capDue(i)}${i.status && i.status.en ? `<details class="small"><summary class="dim">EN</summary><div class="td-wrap">${esc(i.status.en)}</div></details>` : ''}`]; }));
    m.appendChild(card);
  });
}

/* ---------- Ответственные ---------- */
function teamStats() {
  const pq = D('pq'); const ar = areaResp();
  return team().map(m => {
    const its = pq ? pq.items.filter(i => (respOfPQ(i) || {}).id === m.id) : [];
    const r = { id: m.id, name: m.name, areas: Object.entries(ar).filter(([, v]) => v === m.id).map(([a]) => a), total: its.length, assessed: 0, sat: 0, unsat: 0, wip: 0, overdue: 0 };
    its.forEach(i => { const o = pqOf(i.id); if (o.st) r.assessed++; if (o.st === 'sat') r.sat++; if (o.st === 'unsat') r.unsat++; if (o.st === 'wip') r.wip++; if (o.due && o.st !== 'sat' && o.st !== 'na' && daysTo(o.due) < 0) r.overdue++; });
    return r;
  });
}
function pTeam(m) {
  const d = D('team') || { meta: {}, members: [] };
  head(m, 'Ответственные', `${esc(d.meta.title || '')} · ${esc(d.meta.sub || '')} · источник: ${esc(d.meta.source || '')}`);
  const pq = D('pq');
  // сводка
  m.appendChild(table(['Ответственный', 'Области', 'ВП', 'Оценено', 'Удовл.', 'Неудовл.', 'В работе', 'Просрочено'], teamStats(),
    r => [`<b>${esc(r.name)}</b>`, r.areas.map(a => `<span class="badge b-area">${a}</span>`).join(' ') || '<span class="dim">—</span>', r.total, r.assessed, r.sat, r.unsat, r.wip, r.overdue ? `<span class="warn">${r.overdue}</span>` : '0'], r => go('pq', { resp: r.id })));
  // распределение областей
  if (pq) {
    const c = el('div', 'card'); c.innerHTML = `<h2>Распределение областей проверки</h2><p class="small dim">Ответственный по области отвечает за все ВП области, у которых не назначен личный ответственный (в карточке ВП). Список ВП — по клику на область.</p>`;
    const ar = areaResp(); const st = pqState();
    c.appendChild(table(['Область', 'Название', 'ВП', 'Оценено', 'Ответственный'], pq.meta.areas, a => { const its = pq.items.filter(i => i.area === a.code); const n = its.filter(i => (st[i.id] || {}).st).length;
      return [`<a href="#pq?area=${a.code}"><span class="badge b-area">${a.code}</span></a>`, esc(a.name), its.length, `${n} (${pct(n, its.length)}%)`, `<select class="sel" data-area="${a.code}" style="height:30px"><option value="">— ${esc(t('Не назначен'))} —</option>${team().map(x => `<option value="${x.id}"${ar[a.code] === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`]; }));
    c.onchange = e => { const x = e.target; if (!x.dataset.area) return; const all = areaResp(); if (x.value) all[x.dataset.area] = x.value; else delete all[x.dataset.area]; LS.set(K.arearesp, all); toast('Ответственный по области ' + x.dataset.area + ' сохранён', 'ok'); render(); };
    m.appendChild(c);
  }
  // этапы дорожной карты
  const ps = planState(); const stg = STAGES.filter(s => (ps[s.id] || {}).resp);
  if (stg.length) { const c = el('div', 'card'); c.innerHTML = `<h2>Этапы дорожной карты</h2>`; c.appendChild(table(['№', 'Этап', 'Ответственный', 'Статус', 'Дата'], stg, s => { const o = ps[s.id] || {}; const stt = stageStatus(s); return [STAGES.indexOf(s) + 1, esc(s.t), esc(nameOf(o.resp)), `<span class="badge b-${stt === 'done' ? 'ok' : stt === 'wip' ? 'wip' : 'none'}">${esc(t(STG[stt]))}</span>`, fmtDate(o.date)]; })); m.appendChild(c); }
  // состав команды
  const c2 = el('div', 'card'); const custom = !!LS.get(K.team, null);
  c2.innerHTML = `<h2>Состав</h2><p class="small dim">${esc(d.meta.note || '')}${custom ? ' Список изменён на этом устройстве.' : ''}</p>`;
  c2.appendChild(table(['№', 'Ф.И.О.', ''], team().map((x, i) => ({ ...x, i: i + 1 })), x => [x.i, esc(x.name), `<button class="btn sm ghost" data-del="${esc(x.id)}">Убрать</button>`]));
  c2.appendChild(el('div', 'row', `<button class="btn sm" id="tmAdd">＋ Добавить</button>${custom ? '<button class="btn sm ghost" id="tmReset">Вернуть список по умолчанию</button>' : ''}`));
  c2.onclick = e => {
    const del = e.target.closest('[data-del]');
    if (del) { if (!confirm('Убрать ' + nameOf(del.dataset.del) + ' из списка? Назначения на ВП сохранятся.')) return; LS.set(K.team, team().filter(x => x.id !== del.dataset.del)); render(); return; }
    if (e.target.id === 'tmAdd') { const v = prompt('Ф.И.О. (Фамилия Имя)'); if (!v || !v.trim()) return; const id = 'm' + Date.now().toString(36); LS.set(K.team, team().concat([{ id, name: v.trim() }])); render(); }
    if (e.target.id === 'tmReset') { LS.del(K.team); render(); }
  };
  m.appendChild(c2);
}

/* ---------- Реестр документов ---------- */
function pDocs(m) {
  const d = D('registry'); if (!d) return m.appendChild(el('div', 'empty', 'Реестр не загружен'));
  head(m, 'Реестр документов', `${esc(d.meta.title)} · ${esc(d.meta.tj)} · ${esc(d.meta.en)} · обновлено ${fmtDate(d.meta.updated)} (${esc(d.meta.source)})`);
  const tb = el('div', 'toolbar');
  const L = S.f.l || S.lang; ['ru', 'tj', 'en'].forEach(l => { const b = el('button', 'chip' + (L === l ? ' on' : ''), l.toUpperCase()); b.onclick = () => { S.f.l = l; go('docs', S.f); }; tb.appendChild(b); });
  tb.appendChild(selector('Все статусы', 'b', ['ok', 'ready', 'draft', 'tbd'], c => t(BUCKET[c])));
  tb.appendChild(selector('Уровень', 'lvl', uniq(d.docs.map(x => x.level))));
  tb.appendChild(selector('Область USAP', 'area', ['LEG', 'TRG', 'QCF', 'OPS', 'IFS', 'PAX', 'CGO', 'AUI', 'FAL']));
  tb.appendChild(inputFilter('Поиск по названию'));
  const ex = el('button', 'btn ghost sm', esc(t('Экспорт CSV'))); ex.onclick = () => download(csv([['№', 'RU', 'TJ', 'EN', 'Уровень', 'Статус', 'Утверждение', 'Ревизия', 'ИКАО', 'USAP']].concat(list.map(x => [x.n, x.ru, x.tj, x.en, x.level, BUCKET[x.bucket], x.approved, x.revision, x.icao.join('; '), x.usap.join(', ')]))), `AvSec_Registry_${today()}.csv`, 'text/csv;charset=utf-8'); tb.appendChild(ex);
  m.appendChild(tb);
  const list = d.docs.filter(x => (!S.f.b || x.bucket === S.f.b || (S.f.b === 'draft' && x.bucket === 'ready') || (S.f.b === 'tbd' && x.bucket === 'missing')) && (!S.f.lvl || x.level === S.f.lvl) && (!S.f.area || x.usap.includes(S.f.area)) && has(S.f.s, x.ru, x.tj, x.en, x.approved));
  const cnt = {}; d.docs.forEach(x => { cnt[x.bucket] = (cnt[x.bucket] || 0) + 1; });
  m.appendChild(el('div', 'card', `<div class="row"><b>${list.length}</b><span class="dim">документов · ${Object.entries(cnt).map(([k, v]) => badge(k) + ' ' + v).join(' · ')}</span></div>`));
  m.appendChild(table(['№', 'Документ', 'Уровень', 'Статус', 'Утверждение', 'Ревизия', 'USAP'], list,
    x => [x.n, `<div class="td-wrap"><b>${esc(x[L] || x.ru)}</b>${L !== 'ru' ? `<div class="small dim">${esc(x.ru)}</div>` : ''}</div>`, esc(x.level), badge(x.bucket), esc(x.approved), esc(x.revision), x.usap.map(a => `<span class="badge b-area">${a}</span>`).join(' ')], openDoc));
}
function openDoc(x) {
  const mx = D('matrix'); const mrows = mx ? mx.sections.flatMap(s => s.items).filter(i => (x.matrix || []).includes(i.n)) : [];
  openSheet(`<h3>${esc(x.ru)} ${badge(x.bucket)}</h3><p class="dim">${esc(x.tj)}</p><p class="dim">${esc(x.en)}</p>
    ${kv([['Уровень', esc(x.level)], ['Утверждение', esc(x.approved)], ['Ревизия', esc(x.revision)], ['Основание ИКАО', x.icao.map(esc).join('; ')], ['Области USAP', x.usap.map(a => `<span class="badge b-area">${a}</span>`).join(' ')], ['Примечание', esc(x.note)]])}
    <h4>${esc(t('Файлы'))} в Drive</h4>${links(x.drive)}
    ${mrows.length ? `<h4>В матрице ИКАО</h4><ul class="list">${mrows.map(i => `<li>${badge(i.bucket)} ${esc(i.title)} <span class="dim small">— ${esc(i.icao)}</span></li>`).join('')}</ul>` : ''}
    <div class="row mt"><a class="btn ghost sm" href="#pq?s=${encodeURIComponent(x.ru.split(' ').slice(0, 2).join(' '))}">Искать в ВП</a><a class="btn ghost sm" href="#cc?s=${encodeURIComponent(x.ru.split('«')[0].trim().split(' ').slice(0, 2).join(' '))}">Искать в CC</a></div>`);
}

/* ---------- Матрица ИКАО ---------- */
function pMatrix(m) {
  const d = D('matrix'); if (!d) return m.appendChild(el('div', 'empty', 'Матрица не загружена'));
  head(m, 'Соответствие ИКАО', `${esc(d.meta.title)}. ${esc(d.meta.sub)} · обновлено ${fmtDate(d.meta.updated)}`);
  const all = d.sections.flatMap(s => s.items.map(i => ({ ...i, sec: s.code + '. ' + s.title })));
  const tb = el('div', 'toolbar');
  tb.appendChild(selector('Все статусы', 'b', ['ok', 'part', 'draft', 'ready', 'missing', 'ext'], c => t(BUCKET[c])));
  tb.appendChild(inputFilter('Поиск'));
  m.appendChild(tb);
  const list = all.filter(i => (!S.f.b || i.bucket === S.f.b) && has(S.f.s, i.title, i.icao, i.status, i.analog));
  const cnt = {}; all.forEach(i => { cnt[i.bucket] = (cnt[i.bucket] || 0) + 1; });
  const tiles = el('div', 'tiles');
  [['ok', 'ok'], ['part', 'draft'], ['draft', 'draft'], ['missing', 'miss'], ['ext', 'exp']].forEach(([b, cls]) => tiles.appendChild(tile(cls, cnt[b] || 0, BUCKET[b], () => go('matrix', { b }))));
  m.appendChild(tiles);
  m.appendChild(table(['№', 'Документ / программа', 'Требование ИКАО и НППБ', 'Статус в АГА при ПРТ', 'Аналог РК / КР'], list,
    i => [i.n, `<b>${esc(i.title)}</b>`, `<div class="small">${esc(i.icao)}</div>`, `${badge(i.bucket)}<div class="small">${esc(i.status)}</div>`, `<div class="small dim">${esc(i.analog)}</div>`],
    i => { const reg = D('registry'); const rd = reg ? i.reg.map(id => reg.docs.find(x => x.id === id)).filter(Boolean) : []; openSheet(`<h3>${i.n}. ${esc(i.title)} ${badge(i.bucket)}</h3>${kv([['Требование ИКАО', esc(i.icao)], ['Статус', esc(i.status)], ['Аналог РК / КР', esc(i.analog)], ['Раздел', esc(i.sec)]])}${rd.length ? `<h4>Документы реестра</h4><ul class="list">${rd.map(x => `<li>${badge(x.bucket)} ${esc(x.ru)} <span class="dim small">${esc(x.approved)}</span>${x.drive.length ? ' — ' + x.drive.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a>`).join(', ') : ''}</li>`).join('')}</ul>` : ''}<p class="small dim mt">${esc(d.meta.note)}</p>`); },
    { groupKey: i => i.sec }));
}

/* ---------- Инструктивные материалы ---------- */
function pGM(m) {
  const d = D('gm'); if (!d) return m.appendChild(el('div', 'empty', 'Данные ИМ не загружены'));
  head(m, 'Инструктивные материалы', `${esc(d.meta.title)}. ${esc(d.meta.sub)} · ${fmtDate(d.meta.updated)}`);
  const tb = el('div', 'toolbar'); tb.appendChild(inputFilter('Поиск по ИМ')); m.appendChild(tb);
  const list = d.items.filter(i => has(S.f.s, i.code, i.title, i.ncasp, i.status));
  m.appendChild(el('div', 'card', `<div class="row">${d.meta.folders.map(l => `<a class="btn ghost sm" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a>`).join('')}</div>`));
  m.appendChild(table(['Код', 'Инструктивный материал', 'Раздел / § НПАБГА РТ', 'Статус', 'Папка'], list,
    i => [`<span class="code">${esc(i.code)}</span>`, `<b>${esc(i.title)}</b>`, esc(i.ncasp), badge(i.bucket, i.status), `<a href="${esc(i.folder)}" target="_blank" rel="noopener">Drive ↗</a>`]));
  m.appendChild(el('div', 'card', `<h2>Примечания</h2><ul class="list">${d.meta.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`));
}

/* ---------- Материалы (Drive) ---------- */
function pDrive(m) {
  const d = D('drive'); if (!d) return m.appendChild(el('div', 'empty', 'Карта папки не загружена'));
  head(m, 'Материалы (Drive)', `${esc(d.meta.title)} · локально: <span class="mono">${esc(d.meta.local)}</span> · <a href="${esc(d.meta.root)}" target="_blank" rel="noopener">открыть корень в Drive ↗</a>`);
  const tb = el('div', 'toolbar'); tb.appendChild(inputFilter('Поиск по папкам и файлам')); m.appendChild(tb);
  const g = el('div', 'grid2');
  d.folders.filter(f => has(S.f.s, f.title, f.desc, f.children.map(c => c.title).join(' '))).forEach(f => {
    g.appendChild(el('div', 'card', `<h2><a href="${esc(f.url)}" target="_blank" rel="noopener">🗂 ${esc(f.title)}</a></h2><div class="small dim">${esc(f.desc)}</div>${f.children.length ? `<div class="chips mt">${f.children.map(c => `<a class="chip" style="height:28px;line-height:26px;text-decoration:none;font-size:12px" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title)}</a>`).join('')}</div>` : ''}`));
  });
  m.appendChild(g);
  const files = d.rootFiles.filter(f => has(S.f.s, f.title));
  m.appendChild(el('h2', 'mt', 'Файлы в корне папки'));
  m.appendChild(table(['Файл', 'Дата'], files, f => [`<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.title)}</a>`, esc(f.date)]));
}

/* ---------- Документы ИКАО ---------- */
function pICAO(m) {
  const d = D('icao'); if (!d) return m.appendChild(el('div', 'empty', 'Нет данных'));
  head(m, 'Документы ИКАО', esc(d.meta.title) + '. ' + esc(d.meta.note));
  const tb = el('div', 'toolbar'); tb.appendChild(inputFilter('Поиск')); m.appendChild(tb);
  const g = el('div', 'grid2');
  d.items.filter(i => has(S.f.s, i.code, i.title, i.ed, i.area)).forEach(i => g.appendChild(el('div', 'card', `<h2>${esc(i.code)} ${i.restricted ? badge('missing', 'RESTRICTED') : ''}</h2><div>${esc(i.title)}</div><div class="small dim">${esc(i.ed)}${i.area ? ' · ' + esc(i.area) : ''}</div>${links(i.links)}`)));
  m.appendChild(g);
}

/* ---------- Соседние страны ---------- */
function pNB(m) {
  const d = D('neighbours'); if (!d) return m.appendChild(el('div', 'empty', 'Нет данных'));
  head(m, 'Соседние страны', `${esc(d.meta.title)} · ${fmtDate(d.meta.updated)} · <a href="${esc(d.meta.folder)}" target="_blank" rel="noopener">папка «Сравнение — соседние страны» ↗</a>`);
  d.countries.forEach(c => {
    m.appendChild(el('h2', 'mt', `${esc(c.name)} <span class="dim small">— ${esc(c.regulator)} · <a href="${esc(c.folder)}" target="_blank" rel="noopener">папка ↗</a></span>`));
    m.appendChild(table(['Документ', 'Тема', 'Реквизиты', 'Файл / источник'], c.docs, x => [`<b>${esc(x.title)}</b>`, esc(x.topic), esc(x.ref), [x.local && `<a href="${esc(x.local)}" target="_blank" rel="noopener">в папке ↗</a>`, x.local2 && `<a href="${esc(x.local2)}" target="_blank" rel="noopener">PDF ↗</a>`, x.src && `<span class="small dim">${esc(x.src)}</span>`].filter(Boolean).join(' · ')]));
  });
}

/* ---------- Словарь ---------- */
function pGlossary(m) {
  const d = D('glossary'); if (!d) return m.appendChild(el('div', 'empty', 'Словарь не загружен'));
  head(m, 'Словарь RU·TJ·EN', esc(d.meta.sub));
  const tb = el('div', 'toolbar');
  tb.appendChild(selector('Все разделы', 'sec', uniq(d.terms.map(x => x.sec))));
  tb.appendChild(toggle('Только с английским', 'en'));
  tb.appendChild(inputFilter('Термин на любом языке'));
  const ex = el('button', 'btn ghost sm', esc(t('Экспорт CSV'))); ex.onclick = () => download(csv([['№', 'RU', 'TJ', 'EN', 'Раздел']].concat(list.map(x => [x.n, x.ru, x.tj, x.en, x.sec]))), `AvSec_Glossary_${today()}.csv`, 'text/csv;charset=utf-8'); tb.appendChild(ex);
  m.appendChild(tb);
  const list = d.terms.filter(x => (!S.f.sec || x.sec === S.f.sec) && (!S.f.en || x.en) && has(S.f.s, x.ru, x.tj, x.en));
  m.appendChild(el('div', 'count', `${list.length} терминов`));
  m.appendChild(table(['№', 'Русский', 'Тоҷикӣ', 'English'], list, x => [x.n, esc(x.ru), esc(x.tj || '—'), esc(x.en || '—')], null, { groupKey: S.f.s ? null : (x => x.sec) }));
  if (!S.f.s) { m.appendChild(el('h2', 'mt', 'Сокращения (фиксированные соответствия RU → EN)')); m.appendChild(table(['RU', 'EN'], d.abbr, a => [`<b>${esc(a.ru)}</b>`, esc(a.en)])); m.appendChild(el('div', 'card', `<h2>Правила перевода</h2><ul class="list">${d.meta.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`)); }
}

/* ---------- Данные и резервная копия ---------- */
function pData(m) {
  head(m, 'Данные и резервная копия', 'Самооценка (ВП, CC, SASAQ, дорожная карта, настройки) хранится в браузере этого устройства. Перед сменой устройства или чисткой браузера — выгрузите копию.');
  const s = settings();
  const c = el('div', 'card', `<h2>${esc(t('Настройки'))}</h2><p class="small dim">По умолчанию дата аудита и NCMC берутся из данных портала (usap.json: 9–18.11.2026, Шералиев Б.); здесь их можно переопределить — пустое поле возвращает значение по умолчанию.</p><form class="form" id="setForm"><div class="two"><label>Дата аудита на месте<input type="date" name="auditDate" value="${esc(s.auditDate || '')}"></label><label>Национальный координатор (NCMC)<input name="ncmc" value="${esc(s.ncmc || '')}" placeholder="Ф.И.О., должность"></label></div><div class="row"><button class="btn" type="submit">${esc(t('Сохранить'))}</button></div></form>`);
  m.appendChild(c);
  $('#setForm').onsubmit = e => { e.preventDefault(); const fd = new FormData(e.target); LS.set(K.set, { auditDate: fd.get('auditDate'), ncmc: fd.get('ncmc').trim() }); toast('Настройки сохранены', 'ok'); render(); };
  const st = pqState(), cs = ccState(), ss = sasaqState(), ps = planState();
  const b = el('div', 'card', `<h2>Резервная копия</h2><div class="kv"><div>ВП с самооценкой</div><div>${Object.keys(st).length}</div><div>CC — ручные статусы</div><div>${Object.keys(cs).length}</div><div>SASAQ — отметки</div><div>${Object.keys(ss).length}</div><div>Дорожная карта</div><div>${Object.keys(ps).length}</div><div>Ответственные по областям</div><div>${Object.keys(areaResp()).length}</div><div>Аудит 2026 — чек-листы</div><div>${Object.keys(auditState().docs).length + Object.keys(auditState().log).length}</div></div>
    <div class="row mt"><button class="btn" id="bkExp">⬇ Выгрузить JSON</button><label class="btn ghost" style="cursor:pointer">⬆ Загрузить JSON<input type="file" id="bkImp" accept="application/json" hidden></label><button class="btn danger" id="bkClear">Очистить самооценку</button></div>
    <p class="small dim mt">Файл резервной копии можно положить в папку проекта Avsec (Drive) — тогда самооценку можно поднять на другом устройстве или передать коллеге.</p>`);
  m.appendChild(b);
  $('#bkExp').onclick = () => { const out = { app: 'avsec-portal', version: APP_VERSION, at: new Date().toISOString() }; STATE_KEYS.forEach(k => { out[k] = LS.get(k, null); }); download(JSON.stringify(out, null, 1), `AvSec_backup_${today()}.json`, 'application/json'); };
  $('#bkImp').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const j = JSON.parse(await f.text()); if (j.app !== 'avsec-portal') throw new Error('Это не резервная копия AvSec Portal'); if (!confirm('Заменить самооценку на этом устройстве данными из файла?')) return; STATE_KEYS.forEach(k => { if (j[k]) LS.set(k, j[k]); }); toast('Копия загружена', 'ok'); render(); } catch (ex) { toast(ex.message, 'err'); } };
  $('#bkClear').onclick = () => { if (confirm('Удалить всю самооценку на этом устройстве? Данные портала (ВП, CC, реестр) не пострадают.')) { [K.pq, K.cc, K.sasaq, K.plan, K.arearesp, K.audit].forEach(k => LS.del(k)); toast('Очищено'); render(); } };
  m.appendChild(el('div', 'card', `<h2>Источник данных</h2><div class="kv"><div>Сборка данных</div><div>${esc(S.cfg.built || '—')}</div><div>Файлы</div><div class="small">${(S.cfg.files || []).map(esc).join(', ')}</div><div>Режим</div><div>${S.cfg.plain ? 'открытые data/*.json (локальная разработка)' : 'шифрованные data-enc/*.enc, ключ из кода доступа'}</div></div>`));
}

/* ---------- О портале ---------- */
function pAbout(m) {
  head(m, 'О портале', 'AvSec Portal v' + APP_VERSION);
  if (S.cfg.site || S.cfg.tg) m.appendChild(el('div', 'card', `<h2>${esc(t('Где открыть'))}</h2>` + kv([
    ['Веб (GitHub Pages)', S.cfg.site ? `<a href="${esc(S.cfg.site)}" target="_blank" rel="noopener">${esc(S.cfg.site)}</a> — на телефоне «Добавить на экран „Домой“», работает офлайн` : ''],
    ['Telegram', S.cfg.tg ? `<a href="${esc(S.cfg.tg)}" target="_blank" rel="noopener">${esc(S.cfg.tg)}</a> — кнопка «Портал» внизу чата с ботом (Mini App)` : ''],
    ['Код доступа', 'один и тот же для веба и Telegram, вводится один раз на устройстве; выдаёт NCMC'],
  ])));
  m.appendChild(el('div', 'card', `<h2>Назначение</h2><p>Рабочий портал отдела авиационной безопасности АГА при ПРТ: единое место для нормативной базы АБ (реестр, соответствие Приложению 17 и Doc 8973, инструктивные материалы) и для подготовки к аудиту ИКАО USAP-CMA (протокольные вопросы, контрольный перечень соответствия, SASAQ, дорожная карта). Построен по образцу «Портала сертификации и надзора» и «Библиотеки Shohin Airlines».</p>
    <h2>Источники данных</h2><ul class="list"><li>Реестр доков АБ 20260619.docx; Необходимые документы АБ — матрица ИКАО.docx (27.06.2026); Соответствие ИМ — НПАБГА РТ.docx (16.07.2026).</li><li>RU — USAP-CMA Protocol Questions, Amendment 18 to Annex 17 / Amendment 30 to Annex 9 (ИКАО, 11.07.2025).</li><li>USAP_CMA_CC_01_07_2026 в3.docx; USAP-CMA SASAQ 1.xlsx (19.06.2026).</li><li>Авиасловарь_Рус-Тадж_20260622.docx; Глоссарий АБ RU-EN (ИМ, 2026-08-13).md.</li><li>Папка проекта Avsec в Google Drive (карта папок и файлов).</li><li>Аудит 2026: письмо ИКАО AS 8/16.18.196 от 01.05.2026; переписка с руководителем группы ИКАО (15.06.2026); «Давид аудит план.docx»; NC Welcome Package V2024.</li><li>Аудит 2019: USAP-CMA Tajikistan On-site Audit Report.FINAL.pdf (06.02.2020); Корр. План устр.ИКАО 2020.docx; Tajikistan 2024 EN.pdf.</li><li>Проверка USAP-CMA CC (12.09.2026).md — сверка контрольного перечня перед подачей.</li><li>ICAO Corrective Action Plan — CAA Tajikistan — EN.docx (приказ директора АГА при ПРТ № 133 от 10.08.2026) — статусы выполнения ПКД; проверка ПКД перед подачей (17.09.2026).</li></ul>
    <h2>Как устроено</h2><ul class="list"><li>Vanilla JS, PWA, без бэкенда. Данные зашифрованы (AES-256-GCM); ключ выводится из кода доступа в браузере, поэтому портал можно размещать на обычном статическом хостинге.</li><li>Самооценка хранится в браузере устройства; раздел «Данные» — резервная копия и перенос.</li><li>Обновление данных: править <span class="mono">data/*.json</span> → <span class="mono">node tools/build.mjs --code …</span> → поднять версию в <span class="mono">sw.js</span>, <span class="mono">app.js</span>, <span class="mono">index.html</span> → опубликовать.</li></ul>
    <h2>Нормативная основа</h2><p class="small">Приложение 17 (12-е изд., Попр. 18), Приложение 9 (17-е изд., Попр. 29/30), Doc 8973 (13-е изд.), Doc 10047 (2-е изд.), Doc 9807 (3-е изд.), Doc 10118 GASeP (2-е изд.), Воздушный кодекс РТ (13.11.2023 № 1999, ред. 17.12.2025 № 2211), НПБГА 2025–2030 (ППРТ № 480), проект НПАБГА 2026–2031, ППРТ № 554 от 31.10.2025. Нормы сверять с первоисточником.</p>
    <h2>${esc(t('Сокращения'))}</h2>${kv(Object.entries(ABBR).map(([k, v]) => [k, esc(v)]))}`));
}

/* ---------- Глобальный поиск ---------- */
function pFind(m) {
  const q = S.q; head(m, 'Результаты поиска', `«${esc(q)}»`);
  if (!q) return m.appendChild(el('div', 'empty', 'Введите запрос в строке поиска'));
  const out = el('div');
  const group = (title, arr, fn, onClick) => { if (!arr.length) return; out.appendChild(el('h2', 'mt', `${esc(title)} <span class="dim small">${arr.length}</span>`)); arr.slice(0, 40).forEach(x => { const c = el('div', 'card hit', fn(x)); c.onclick = () => onClick(x); out.appendChild(c); }); if (arr.length > 40) out.appendChild(el('div', 'dim small', `… и ещё ${arr.length - 40}. Уточните запрос.`)); };
  const pq = D('pq'), cc = D('cc'), reg = D('registry'), mx = D('matrix'), gm = D('gm'), gl = D('glossary'), ic = D('icao'), sq = D('sasaq'), cap = D('cap2019');
  if (pq) group('Протокольные вопросы', pq.items.filter(i => has(q, i.id, i.q, i.g.join(' '), i.doc)), i => `<span class="code">${esc(i.id)}</span> <span class="badge b-area">${i.area}</span> ${esc(i.q)}`, openPQ);
  if (cc) group('Контрольный перечень (CC)', cc.items.filter(i => i.kind !== 'hdr' && has(q, i.id, i.text, i.ref, i.remarks)), i => `<span class="badge b-${i.kind}">Прил. ${i.annex} · ${esc(i.id)}</span> ${esc(i.text.slice(0, 220))}<div class="small dim">${esc(i.ref)}</div>`, openCC);
  if (sq) group('SASAQ', sq.items.filter(i => has(q, i.code, i.text, i.rows.flat().join(' '))), i => `<span class="code">${esc(i.code)}</span> ${esc(i.text)}`, openSASAQ);
  if (cap) group('Выводы аудита 2019 (CAP)', cap.findings.filter(f => f.items.some(i => has(q, i.sarp, i.pq, i.rec, i.action, i.status && i.status.en))), f => `${badge(CAPB[f.priority], CAPP[f.priority])} <span class="badge b-area">${f.area}</span> Вывод № ${f.n}: ${esc(f.items.map(i => i.rec).join(' · ').slice(0, 220))}`, f => go('cap', { area: f.area }, ''));
  if (reg) group('Реестр документов', reg.docs.filter(x => has(q, x.ru, x.tj, x.en, x.approved, x.icao.join(' '))), x => `${badge(x.bucket)} <b>${esc(x.ru)}</b><div class="small dim">${esc(x.en)}</div>`, openDoc);
  if (mx) group('Матрица ИКАО', mx.sections.flatMap(s => s.items).filter(i => has(q, i.title, i.icao, i.status, i.analog)), i => `${badge(i.bucket)} ${esc(i.title)} <span class="dim small">${esc(i.icao)}</span>`, () => go('matrix', {}, ''));
  if (gm) group('Инструктивные материалы', gm.items.filter(i => has(q, i.code, i.title, i.ncasp)), i => `<span class="code">${esc(i.code)}</span> ${esc(i.title)}`, i => window.open(i.folder, '_blank'));
  if (ic) group('Документы ИКАО', ic.items.filter(i => has(q, i.code, i.title, i.ed)), i => `<b>${esc(i.code)}</b> ${esc(i.title)}`, () => go('icao', { s: q }));
  if (team().length) group('Ответственные', team().filter(x => has(q, x.name)), x => `👤 <b>${esc(x.name)}</b>`, x => go('pq', { resp: x.id }));
  if (gl) group('Словарь', gl.terms.filter(x => has(q, x.ru, x.tj, x.en)), x => `<b>${esc(x.ru)}</b> · ${esc(x.tj || '—')} · ${esc(x.en || '—')}`, () => go('glossary', { s: q }));
  if (!out.children.length) out.appendChild(el('div', 'empty', esc(t('Ничего не найдено'))));
  m.appendChild(out);
}

/* ---------- запуск ---------- */
function applyTheme() {
  const tg = TG(); const th = LS.get(K.theme, '') || (tg && tg.colorScheme) || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = th;
  $('meta[name=theme-color]').content = th === 'dark' ? '#0d1b2a' : '#123b5e';
}
function applyLang() { $$('#lang button').forEach(b => b.classList.toggle('on', b.dataset.l === S.lang)); document.documentElement.lang = S.lang; }
/* ---------- Telegram Mini App ---------- */
// Портал открывается из бота как Mini App (кнопка меню → URL GitHub Pages). Бэкенда нет, поэтому вход — тем же кодом,
// ключ хранится в localStorage webview Telegram. Здесь только оболочка: ready/expand, чистка хеша, кнопка «Назад», тема.
const TG = () => (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData !== undefined && window.Telegram.WebApp.platform !== 'unknown') ? window.Telegram.WebApp : null;
function tgInit() {
  const tg = TG(); if (!tg) return;
  try {
    tg.ready(); tg.expand();
    if (/^#tgWebApp/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);   // параметры Telegram в хеше — иначе роутер не найдёт раздел
    document.documentElement.dataset.tg = '1';
    if (tg.colorScheme && !LS.get(K.theme, '')) { document.documentElement.dataset.theme = tg.colorScheme; }
    tg.onEvent && tg.onEvent('themeChanged', () => { if (!LS.get(K.theme, '')) applyTheme(); });
    // кнопка «Назад» Telegram: закрыть шторку, иначе — на обзор
    if (tg.BackButton) tg.BackButton.onClick(() => { if (!$('#sheet').hidden) closeSheet(); else go('dash'); });
    if (tg.setHeaderColor) try { tg.setHeaderColor(document.documentElement.dataset.theme === 'dark' ? '#0f1b26' : '#123b5e'); } catch (e) {}
  } catch (e) { console.warn('Telegram init', e); }
}
function tgSync() {
  const tg = TG(); if (!tg || !tg.BackButton) return;
  try { const need = !$('#sheet').hidden || S.page !== 'dash'; need ? tg.BackButton.show() : tg.BackButton.hide(); } catch (e) {}
}
async function boot() {
  $$('.appver').forEach(e => { e.textContent = 'v' + APP_VERSION; });
  tgInit();
  applyTheme(); applyLang(); initGate();
  $('#themeBtn').onclick = () => { LS.set(K.theme, document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); applyTheme(); };
  $$('#lang button').forEach(b => b.onclick = () => { S.lang = b.dataset.l; LS.set(K.lang, S.lang); applyLang(); if (S.cfg) { buildNav(); render(); } });
  $('#burger').onclick = () => $('#side').classList.toggle('open');
  document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); if (!e.target.closest('#side') && !e.target.closest('#burger')) $('#side').classList.remove('open'); const nh = e.target.closest('.navh'); if (nh) nh.parentElement.classList.toggle('open'); });
  // Esc — закрыть шторку; «/» — курсор в поиск, если не печатаем в поле
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); if (e.key === '/' && !/^(input|textarea|select)$/i.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); $('#q').focus(); } });
  $('#qclear').onclick = () => { $('#q').value = ''; if (S.page === 'find') go('dash'); };
  let tm; $('#q').oninput = () => { clearTimeout(tm); tm = setTimeout(() => { const v = $('#q').value.trim(); if (v.length >= 2) go('find', {}, v); }, 300); };
  $('#q').onkeydown = e => { if (e.key === 'Enter') { const v = $('#q').value.trim(); if (v) go('find', {}, v); } };
  window.addEventListener('hashchange', route);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  try { S.cfg = await (await fetch('data/config.json', { cache: 'no-cache' })).json(); }
  catch (e) { $('#main').innerHTML = '<div class="empty">Не найден data/config.json. Портал нужно открыть через http(s)-сервер (node tools/serve.mjs), а не как файл.</div>'; return; }
  if (S.cfg.plain) { await enter(); return; }
  const saved = LS.get(K.key, '');
  if (saved && cryptoReady()) { try { const raw = unhex(saved); if (await keyOk(raw)) { S.key = raw; await enter(); return; } } catch (e) {} LS.del(K.key); }
  $('#main').innerHTML = ''; showGate(true);
}
boot();
