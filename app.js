/* AvSec Portal — портал авиационной безопасности и подготовки к USAP-CMA · АГА при ПРТ.
   Vanilla JS без сборки. Данные лежат шифрованными в data-enc/*.enc (AES-256-GCM поверх gzip);
   ключ выводится из кода доступа (PBKDF2) прямо в браузере, бэкенда нет. Самооценка (ВП, CC,
   SASAQ, дорожная карта) хранится в localStorage устройства; резервная копия — раздел «Данные».
   Версия приложения = версия кэша в sw.js = ?v= в index.html. Бампать вместе. */
'use strict';
const APP_VERSION = '43';

/* ---------- хранилище ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const K = { key: 'avsec-key', lang: 'avsec-lang', theme: 'avsec-theme', pq: 'avsec-pq', cc: 'avsec-cc', sasaq: 'avsec-sasaq', plan: 'avsec-plan', set: 'avsec-settings', team: 'avsec-team', arearesp: 'avsec-arearesp', audit: 'avsec-audit', capi: 'avsec-capitems', log: 'avsec-log' };
const STATE_KEYS = [K.pq, K.cc, K.sasaq, K.plan, K.set, K.team, K.arearesp, K.audit, K.capi, K.log];

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
  'Приём и культурная программа': 'Hospitality and cultural programme', 'Транспорт': 'Transport', 'Подарки': 'Gifts', 'Уточнить': 'To be confirmed', 'Приём: мероприятий готово': 'Hospitality: items ready',
  'Трассировка': 'Traceability', 'Приём': 'Hospitality', 'ответственный': 'responsible', 'Мероприятие плана и приём': 'Plan activity and hospitality', 'Приём и культурная программа': 'Hospitality and cultural programme',
  'Список': 'List', 'Сводка': 'Summary', 'К работе': 'To do', 'Области проверки': 'Audit areas', 'Самооценка': 'Self-assessment', 'Не соответствует': 'Not satisfactory', 'Просрочен срок': 'Overdue', 'Есть вывод аудита 2019': 'Has a 2019 finding', 'С выводом 2019': 'With a 2019 finding',
  'Об аудите': 'About the audit', 'Сроки и доступ': 'Deadlines and access', 'План и приём': 'Plan and hospitality', 'Обзор': 'Overview', 'Документы': 'Documents', 'Проживание, въезд, транспорт': 'Accommodation, entry, transport', 'Суточные и лимит': 'DSA and limit', 'Переводчики': 'Interpreters',
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
  { g: 'Надзор АБ', items: [
    { id: 'subjects', ic: '🏢', t: 'Субъекты надзора', short: 'Субъекты', cnt: () => D('subjects') ? D('subjects').orgs.length : '' },
    { id: 'qc', ic: '🔍', t: 'Контроль качества', short: 'КК', cnt: () => D('qc') ? (D('qc').findings.length || D('qc').activities.length || '') : '' } ] },
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
  // ссылка из карточки-модалки («→ ПКД») меняет хэш, но сама модалка не закрывалась:
  // новый раздел оставался под затемнением с заблокированной прокруткой
  if (!$('#sheet').hidden) closeSheet();
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
const TABLE_NA = new Set(['', '—', '-', '0', 'Н/П', 'н/п', 'Нет статуса', 'Не начато']);   // на телефоне такие ячейки в карточке скрыты (колонка на десктопе остаётся)
function table(cols, rows, rowFn, onClick, opts = {}) {
  const w = el('div', 'tw');
  const tb = el('table', opts.w ? 'fixedw' : '');
  // opts.w — доли ширины колонок: с table-layout:fixed длинное наименование получает своё место,
  // а короткий статус не растягивает колонку (без этого ширины считаются по содержимому)
  tb.innerHTML = (opts.w ? `<colgroup>${opts.w.map(x => `<col style="width:${x}">`).join('')}</colgroup>` : '')
    + `<thead><tr>${cols.map(c => `<th>${esc(t(c))}</th>`).join('')}</tr></thead>`;
  const body = el('tbody');
  if (!rows.length) body.innerHTML = `<tr><td class="empty" colspan="${cols.length}">${esc(t(opts.empty || 'Ничего не найдено'))}</td></tr>`;
  let lastG = null;
  rows.forEach(r => {
    if (opts.groupKey) { const g = opts.groupKey(r); if (g !== lastG) { lastG = g; body.appendChild(el('tr', 'grp', `<td colspan="${cols.length}">${esc(g)}</td>`)); } }
    const tr = el('tr', onClick ? 'clk' : '');
    // data-label — подпись колонки (карточный вид на телефоне); na — пустая ячейка, на телефоне скрыта;
    // ctl — ячейка с элементом управления (галочка, статус, кнопка): на телефоне отдельной строкой
    tr.innerHTML = rowFn(r).map((c, i) => { const v = c == null ? '' : String(c); const plain = v.replace(/<[^>]+>/g, '').trim(); const ctl = /<(input|select|button|textarea)/i.test(v);
      return `<td data-label="${esc(cols[i] || '')}" class="${!ctl && TABLE_NA.has(plain) ? 'na' : ''}${ctl ? ' ctl' : ''}">${v}</td>`; }).join('');
    // клик по контролу внутри строки (галочка, статус, ссылка, кнопка) не должен открывать карточку строки
    if (onClick) { tr.onclick = e => { if (e.target.closest('input,select,button,a,textarea,label,summary,details')) return; onClick(r); }; tr.tabIndex = 0; tr.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === tr) { e.preventDefault(); onClick(r); } }; }
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
const PAGE = 60;
// Длинные списки (493 ВП, 139 SARPs, 329 терминов) — порциями: первые 60 строк, дальше по кнопке.
// Фильтры и поиск работают по всему списку; порция запоминается на адрес (фильтры + поиск), пока открыт портал.
function paged(m, rows, draw) {
  const key = S.page + '?' + Object.entries(S.f).filter(([, v]) => v).map(([k, v]) => k + '=' + v).join('&') + '#' + (S.q || '');
  S.more = S.more || {}; const lim = S.more[key] || PAGE;
  draw(rows.slice(0, lim));
  if (rows.length <= lim) return;
  const b = el('div', 'row mt');
  const more = el('button', 'btn sm', `${esc(t('Показать ещё'))} ${Math.min(PAGE, rows.length - lim)}`); more.onclick = () => { S.more[key] = lim + PAGE; render(); };
  const all = el('button', 'btn sm ghost', `${esc(t('Показать все'))} (${rows.length})`); all.onclick = () => { S.more[key] = rows.length; render(); };
  b.append(more, all, el('span', 'dim small', `${esc(t('показано'))} ${lim} ${esc(t('из'))} ${rows.length}`)); m.appendChild(b);
}
function prog(parts, total) {
  const segs = Object.entries(parts).filter(([, v]) => v > 0).map(([k, v]) => `<span class="p-${k}" style="width:${v * 100 / (total || 1)}%" title="${esc(t(PQST[k] || k))}: ${v}"></span>`).join('');
  return `<div class="prog">${segs}</div>`;
}

/* ---------- журнал изменений (Track Changes в OLF) ----------
   Пишем только фактические изменения полей: что, с чего на что, когда и кем (NCMC из настроек).
   Хранится на устройстве, входит в резервную копию, ограничен 500 записями. */
const logState = () => { const a = LS.get(K.log, []); return Array.isArray(a) ? a : []; };
const logVal = (f, v) => { if (v == null || v === '') return ''; if (f.map) return f.map[v] || String(v); if (Array.isArray(v)) return v.map(e => [e.doc, e.ref, e.date].filter(Boolean).join(' ')).join(' | '); if (v === true) return 'да'; if (v === false) return ''; return String(v); };
const logNorm = v => (Array.isArray(v) && !v.length) || v == null || v === false ? '' : v;   // пустой список и «не задано» — одно и то же
function logChange(kind, id, before, after, fields) {
  const ch = fields.filter(f => JSON.stringify(logNorm((before || {})[f.k])) !== JSON.stringify(logNorm((after || {})[f.k])))
    .map(f => ({ n: f.n, from: logVal(f, (before || {})[f.k]), to: logVal(f, (after || {})[f.k]) }))
    .filter(c => c.from !== c.to);
  if (!ch.length) return;
  const who = String(settings().ncmc || '').split(',')[0].trim();
  LS.set(K.log, [{ ts: Date.now(), at: today(), kind, id, who, ch }, ...logState()].slice(0, 500));
}
function changeLog(kind, id) {
  const rows = logState().filter(x => x.kind === kind && x.id === id);
  if (!rows.length) return '';
  return `<details class="mt"><summary><b>${esc(t('История изменений'))}</b> <span class="dim small">${rows.length}</span></summary><ul class="list small">`
    + rows.slice(0, 20).map(r => `<li><span class="dim">${esc(r.at)}${r.who ? ' · ' + esc(r.who) : ''}</span> — `
      + r.ch.map(c => `${esc(c.n)}: <span class="dim">${esc(c.from || '—')}</span> → <b>${esc(c.to || '—')}</b>`).join('; ') + `</li>`).join('') + '</ul></details>';
}
const PQLOGF = [{ k: 'st', n: 'Статус', map: PQST }, { k: 'draft', n: 'Черновик' }, { k: 'due', n: 'Срок' }, { k: 'resp', n: 'Ответственный' }, { k: 'evl', n: 'Доказательства' }, { k: 'note', n: 'Примечание' }, { k: 'en', n: 'English translation' }, { k: 'pnote', n: 'Личная заметка' }];
// CAPPR объявлен ниже по файлу — поэтому функция, а не константа (иначе ReferenceError при загрузке)
const CAPLOGF = () => [{ k: 'progress', n: 'Progress Status', map: CAPPR }, { k: 'percent', n: 'Progress %' }, { k: 'org', n: 'Action Office' }, { k: 'evref', n: 'Evidence Reference' }, { k: 'est', n: 'Est. Imp. Date' }, { k: 'rev', n: 'Rev. Imp. Date' }, { k: 'done', n: 'Date of Completion' }];

/* ---------- состояние самооценки ---------- */
const pqState = () => LS.get(K.pq, {});
const pqOf = id => pqState()[id] || {};
const ccState = () => LS.get(K.cc, {});
const sasaqState = () => LS.get(K.sasaq, {});
const planState = () => LS.get(K.plan, {});
/* настройки: значения по умолчанию — из usap.json (дата аудита, NCMC), ручные правки на устройстве — поверх */
// usap.json правится руками: отсутствие audit/ncmc не должно ронять обзор, дорожную карту и «Данные»
const settings = () => { const u = U() || {}; const d = {};
  if (u.audit && u.audit.start) d.auditDate = u.audit.start;
  if (u.ncmc && u.ncmc.name) d.ncmc = [u.ncmc.name, u.ncmc.title].filter(Boolean).join(', ');
  const s = LS.get(K.set, {}); Object.keys(s).forEach(k => { if (s[k] === '' || s[k] == null) delete s[k]; }); return { ...d, ...s }; };
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
  { id: 'mou', t: 'МоВ с ИКАО, уведомление об аудите и согласование сроков', hint: () => { const u = U(); return u ? `МоВ подписан ${fmtDate(u.mou.signed)}. Уведомление ИКАО от ${fmtDate(u.notification.date)} (${u.notification.ref}): предложено ${u.notification.proposed}. Согласовано: ${fmtDate(u.audit.start)} – ${fmtDate(u.audit.end)}${u.audit.agreedBy ? ` (${esc(u.audit.agreedBy)})` : ''}.` : 'Дата аудита задаётся в «Данные → Настройки».'; }, auto: () => U() ? 'done' : (settings().auditDate ? 'wip' : '') },
  { id: 'sasaq', t: 'Заполнение и подача SASAQ (EN) через защищённую ссылку ИКАО', due: () => (U() || { audit: {} }).audit.docsDeadline, hint: () => { const d = D('sasaq'); if (!d) return ''; const f = d.items.filter(i => i.filled).length; return `Черновик SASAQ 1 (19.06.2026): заполнено ${f} из ${d.items.length} вопросов. Подаётся вместе с CC и обновлённым CAP — не позднее чем за 60 дней до аудита.`; }, auto: () => (auditState().docs.sasaq || {}).st === 'sent' ? 'done' : 'wip' },
  { id: 'cc', t: 'Контрольные перечни соответствия (CC) по Прил. 17 и Прил. 9 (EN): заполнение, проверка, подача', due: () => (U() || { audit: {} }).audit.docsDeadline, hint: () => { const u = U(); const d = D('cc'); const base = d ? `Редакция в3 (01.07.2026) в портале: ${d.items.filter(i => i.kind === 'std' || i.kind === 'rp').length} SARPs. ` : ''; const sent = (auditState().docs.cc || {}).st === 'sent'; return base + (sent ? 'Отправлено в ИКАО.' : (u && u.ccCheck ? `Проверка редакции 12.09.2026 (${fmtDate(u.ccCheck.date)}): ${u.ccCheck.verdict} ${u.ccCheck.summary}` : '')); }, auto: () => (auditState().docs.cc || {}).st === 'sent' ? 'done' : 'wip' },
  { id: 'cap', t: 'Обновлённый план корректирующих действий (CAP) по итогам аудита USAP-CMA 2019', due: () => (U() || { audit: {} }).audit.docsDeadline, hint: () => { const c = D('cap2019'); const u = U(); return c ? `${c.meta.update ? `Редакция EN (${c.meta.update.approved}): выполнено ${capStats(c).done} из ${capStats(c).total}, незакрыто ${capStats(c).open}. ` : ''}Основа — ПКД 2020: ${c.meta.findings} выводов, ${c.meta.items} рекомендаций (раздел «Выводы аудита 2019»). ${u ? `Результаты ИКАО 2019: EI ${u.previous.results2019.ei} %, соответствие Прил. 17 — ${u.previous.results2019.compliance} %; ${u.previous.results.source}: EI ${u.previous.results.ei} %, соответствие — ${u.previous.results.compliance} %.` : ''}` : ''; }, auto: () => (auditState().docs.cap || {}).st === 'sent' ? 'done' : (D('cap2019') && D('cap2019').meta.update ? 'wip' : '') },
  { id: 'docs', t: 'Пакет национальной, аэропортовой и эксплуатантской документации (запрос ИКАО от 15.06.2026, SASAQ GEN-05) и переводы на английский', due: () => (U() || { audit: {} }).audit.docsDeadline, hint: () => { const u = U(); if (!u) return ''; const a = auditState(); const n = u.requested.length, sent = u.requested.filter(r => docSent(r, a.docs)).length; return `Отправлено ${sent} из ${n} позиций (чек-лист — раздел «Аудит USAP-CMA 2026»). Загрузка только через защищённую ссылку ИКАО, не по e-mail.`; }, auto: () => { const u = U(); if (!u) return 'wip'; const a = auditState(); const sent = u.requested.filter(r => docSent(r, a.docs)).length; return sent === u.requested.length ? 'done' : 'wip'; } },
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
const PAGES = { dash, audit: pAudit, cap: pCAP, pq: pPQ, cc: pCC, sasaq: pSASAQ, plan: pPlan, team: pTeam, subjects: pSubjects, qc: pQC, docs: pDocs, matrix: pMatrix, gm: pGM, drive: pDrive, icao: pICAO, nb: pNB, glossary: pGlossary, data: pData, about: pAbout, find: pFind };

/* ---------- активные фильтры (чипы с ✕), расшифровка сокращений, «что делать сейчас» — по образцу Библиотеки Shohin ---------- */
const FILTER_LABELS = { area: 'Область', sub: 'Подраздел', ce: 'КЭ', st: 'Статус', star: 'Только ★', resp: 'Ответственный', s: 'Поиск', annex: 'Приложение', ch: 'Глава', defs: 'Определения и заголовки', b: 'Статус', lvl: 'Уровень', l: 'Язык', prio: 'Приоритет', sec: 'Раздел', en: 'Только с EN', over: 'Просрочен срок', cap: 'С выводом 2019', hint: 'Подсказки без доказательств', type: 'Тип субъекта', kind: 'Роль', pst: 'Программы', org: 'Субъект', sev: 'Уровень' };
const FILTER_BOOL = { star: 1, defs: 1, en: 1, over: 1, cap: 1, hint: 1 };
function filterVal(k, v) {
  if (k === 'st') return ({ none: 'Не оценено', bad: 'Частично + расхождения', open: 'Незакрытые', filled: 'Заполнено', empty: 'Не заполнено', checked: 'Проверено' })[v] || PQST[v] || CCST[v] || CAPST[v] || v;
  if (k === 'b') return BUCKET[v] || v;
  if (k === 'prio') return CAPP[v] || v;
  if (k === 'resp') return v === 'none' ? 'Не назначен' : nameOf(v);
  if (k === 'l') return String(v).toUpperCase();
  if (k === 'type') return S.page === 'qc' ? qcType(v).name_ru : subjType(v).name_ru;
  if (k === 'sev') return qcSev(v).level + ' — ' + qcSev(v).name_ru;
  if (k === 'kind') return ORGK[v] || v;
  if (k === 'pst') return PSTL[v] || v;
  return v;
}
function injectActiveFilters(m) {
  // `t` — вкладка раздела, а не фильтр: чипа «убрать» у неё быть не должно
  const act = Object.entries(S.f).filter(([k, v]) => v && k !== 't'); if (!act.length) return;
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
    const a = auditState(); const n = u.requested.length, sent = u.requested.filter(r => docSent(r, a.docs)).length; const dl = u.audit.docsDeadline; const late = daysTo(dl) < 0 && sent < n;
    add(`<b>Документы для ИКАО</b>: отправлено ${sent} из ${n} · срок ${fmtDate(dl)}${late ? ` <span class="warn">· просрочен на ${-daysTo(dl)} дн.</span>` : ''}`, '#audit?t=docs');
    if (u.ccCheck && !docSent({ id: 'cc' }, a.docs)) add(`<b>CC</b>: проверка ${fmtDate(u.ccCheck.date)} — <span class="warn">${esc(u.ccCheck.verdict)}</span>`, '#audit?t=docs');
    if (u.capCheck && !docSent({ id: 'cap' }, a.docs)) add(`<b>ПКД</b>: проверка ${fmtDate(u.capCheck.date)} — <span class="warn">${esc(u.capCheck.verdict)}</span>`, '#audit?t=docs');
    const ld = u.logistics.filter(l => (a.log[l.id] || (l.done ? { done: true } : {})).done).length; if (ld < u.logistics.length) add(`<b>Логистика аудита</b>: выполнено ${ld} из ${u.logistics.length}`, '#audit?t=log');
    if (u.hospitality) { const h = hosStats(u.hospitality, a.hos); if (h.d < h.n) add(`<b>Приём группы</b>: подтверждено ${h.d} из ${h.n} мероприятий (транспорт, питание, экскурсии)`, '#audit?t=plan'); }
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

/* Контекстная подсказка под блоком — «Suggested actions: … → Go to module» в OLF.
   Показывается только когда действие действительно требуется. */
function suggest(text, href, label) {
  return `<div class="callout small mt"><b>${esc(t('Требуется действие'))}:</b> ${text} <a class="btn sm ghost" href="${esc(href)}">${esc(t(label || 'Перейти'))} →</a></div>`;
}
/* ---------- Обзор ---------- */
function dash(m) {
  head(m, 'Обзор', 'Состояние подготовки к USAP-CMA и нормативной базы АБ · Агентство гражданской авиации при Правительстве Республики Таджикистан');
  todoCard(m);
  const pq = D('pq'), cc = D('cc'), sq = D('sasaq'), reg = D('registry'), mx = D('matrix'), cap = D('cap2019'), u = U();
  const st = pqState();
  // единственное предупреждение, которого нет в списке дел: срок для документов, требующих утверждения (НПАБГА)
  if (u && u.audit.docsApprovedDeadline && daysTo(u.audit.docsApprovedDeadline) >= 0) {
    const nc = u.requested.find(r => r.id === 'ncasp');
    if (nc && !docSent(nc, auditState().docs)) m.appendChild(el('div', 'card', suggest(`НПАБГА не отправлена, а документы, требующие утверждения, принимаются только до <b>${fmtDate(u.audit.docsApprovedDeadline)}</b> (${daysTo(u.audit.docsApprovedDeadline)} дн.) — после начала аудита их не рассматривают`, '#audit?t=docs', 'К документам')));
  }
  // четыре числа состояния; показатели реестра и матрицы живут в своих разделах
  const tiles = el('div', 'tiles');
  const ad = settings().auditDate;
  if (ad) tiles.appendChild(tile(daysTo(ad) < 30 ? 'miss' : 'info', daysTo(ad) >= 0 ? daysTo(ad) : '—', `дней до аудита · ${fmtDate(ad)}`, () => go('audit')));
  if (pq) {
    const cnt = { sat: 0, wip: 0, unsat: 0, na: 0 }; pq.items.forEach(i => { const x = (st[i.id] || {}).st; if (x) cnt[x]++; });
    const n = cnt.sat + cnt.wip + cnt.unsat + cnt.na;
    tiles.appendChild(tile(n ? 'info' : 'miss', `${pct(n, pq.items.length)}%`, `ВП оценено (${n} из ${pq.items.length})`, () => go('pq', { t: 'sum' })));
  }
  if (cc) {
    const sarps = cc.items.filter(i => i.kind === 'std' || i.kind === 'rp'); const bad = sarps.filter(i => ccOf(i).st !== 'ok');
    tiles.appendChild(tile(bad.length ? 'draft' : 'ok', bad.length, `CC: расхождения / частично (из ${sarps.length})`, () => go('cc', { st: 'bad' })));
  }
  if (sq) { const f = sq.items.filter(i => i.filled).length; tiles.appendChild(tile(f === sq.items.length ? 'ok' : 'draft', `${f}/${sq.items.length}`, 'SASAQ: вопросов заполнено', () => go('sasaq'))); }
  m.appendChild(tiles);

  const g = el('div', 'grid2');
  // по областям проверки
  if (pq) {
    const c = el('div', 'card'); c.innerHTML = `<h2>Готовность по областям проверки</h2>`;
    pq.meta.areas.forEach(a => {
      const its = pq.items.filter(i => i.area === a.code); const cnt = { sat: 0, wip: 0, unsat: 0, na: 0 };
      its.forEach(i => { const x = (st[i.id] || {}).st; if (x) cnt[x]++; });
      const n = cnt.sat + cnt.wip + cnt.unsat + cnt.na;
      const r = el('div', '', `<div class="row small" style="margin-top:8px"><span class="badge b-area">${a.code}</span><span class="grow">${esc(a.name)}</span><span class="dim">${n}/${its.length}</span></div>${prog(cnt, its.length)}`);
      r.style.cursor = 'pointer'; r.onclick = () => go('pq', { area: a.code }); c.appendChild(r);
    });
    c.appendChild(el('div', 'legend', `<span><i style="background:var(--ok)"></i>${esc(t('Удовлетворительно'))}</span><span><i style="background:var(--draft)"></i>${esc(t('В работе'))}</span><span><i style="background:var(--miss)"></i>${esc(t('Неудовлетворительно'))}</span><span><i style="background:var(--na)"></i>${esc(t('Не применимо'))}</span>`));
    g.appendChild(c);
  }
  // дорожная карта — только где мы сейчас; полный список этапов в своём разделе
  {
    const done = STAGES.filter(x => stageStatus(x) === 'done').length;
    const cur = STAGES.find(x => stageStatus(x) !== 'done'); const nxt = cur ? STAGES[STAGES.indexOf(cur) + 1] : null;
    const c = el('div', 'card');
    c.innerHTML = `<h2>${esc(t('Дорожная карта'))} <span class="dim small">${done} ${esc(t('из'))} ${STAGES.length}</span></h2>${prog({ sat: done, wip: cur && stageStatus(cur) === 'wip' ? 1 : 0 }, STAGES.length)}`
      + (cur ? `<div class="mt"><span class="badge b-${stageStatus(cur) === 'wip' ? 'wip' : 'none'}">${STAGES.indexOf(cur) + 1}</span> <b>${esc(cur.t)}</b></div>` : `<div class="mt">${esc(t('Все этапы выполнены'))}</div>`)
      + (nxt ? `<div class="small dim mt">${esc(t('Далее'))}: ${STAGES.indexOf(nxt) + 1}. ${esc(nxt.t)}</div>` : '')
      + auditBrief()
      + `<div class="row mt"><a class="btn sm ghost" href="#plan">${esc(t('Открыть дорожную карту'))}</a><a class="btn sm ghost" href="#team">${esc(t('Ответственные'))} →</a></div>`;
    g.appendChild(c);
  }
  m.appendChild(g);
  // нормативная база и CC: что требует внимания — свёрнуто, чтобы обзор оставался обзором
  const items = [];
  if (mx) mx.sections.flatMap(x => x.items).filter(i => i.bucket === 'missing').forEach(i => items.push(`<li>${badge('missing')} ${esc(i.title)} <span class="dim small">— ${esc(i.icao)}</span></li>`));
  if (reg) reg.docs.filter(d => d.bucket === 'draft' || d.bucket === 'ready').forEach(d => items.push(`<li>${badge(d.bucket)} ${esc(d.ru)} <span class="dim small">— ${esc(d.approved)}</span></li>`));
  if (cc) cc.items.filter(i => (i.kind === 'std' || i.kind === 'rp') && ccOf(i).st === 'missing').forEach(i => items.push(`<li>${badge('missing', 'CC')} Прил. ${i.annex} ${esc(i.kind === 'rp' ? 'РП' : 'Ст.')} ${esc(i.id)} <span class="dim small">— ${esc((i.remarks || i.desc || i.ref).slice(0, 140))}</span></li>`));
  if (items.length) { const d = el('details', 'card'); d.innerHTML = `<summary><b>${esc(t('Требует внимания'))}</b> <span class="dim small">${items.length} ${esc(t('позиций: матрица, реестр, CC'))}</span></summary><ul class="list mt">${items.join('')}</ul>`; m.appendChild(d); }
  const dr = D('drive'); if (dr) m.appendChild(el('p', 'small dim', `<a href="${esc(dr.meta.root)}" target="_blank" rel="noopener">${esc(t('Папка проекта Avsec в Google Drive'))} →</a>`));
}

/* ---------- Протокольные вопросы ---------- */
/* Раздел ВП: рабочий список, сводка и «к работе» — как в разделе аудита, вкладка лежит в адресе (#pq?t=sum). */
const QTABS = [{ id: 'list', t: 'Список' }, { id: 'sum', t: 'Сводка' }, { id: 'todo', t: 'К работе' }];
// Аудитор ИКАО по области — из плана аудита v1.0; область и её наименование живут здесь, в разделе ВП
const areaAuditor = code => { const u = U(); const x = u && (u.audit.areaAuditors || []).find(y => y.code === code); return x ? x.auditor : ''; };
function pPQ(m) {
  const d = D('pq'); if (!d) return m.appendChild(el('div', 'empty', 'Данные ВП не загружены'));
  head(m, 'Протокольные вопросы', `${esc(d.meta.title)} · опубликовано ${fmtDate(d.meta.published)} · ${d.items.length} ВП. Статус, ответственный, срок и доказательства — самооценка государства, хранится на этом устройстве.`);
  const st = pqState();
  const tab = QTABS.some(x => x.id === S.f.t) ? S.f.t : 'list';
  const goTab = id => go('pq', { ...S.f, t: id === 'list' ? '' : id }, S.q);
  const all = d.items;
  const none = all.filter(i => !(st[i.id] || {}).st).length;
  const unsat = all.filter(i => (st[i.id] || {}).st === 'unsat').length;
  const over = all.filter(i => { const o = st[i.id] || {}; return o.due && o.st !== 'sat' && o.st !== 'na' && daysTo(o.due) < 0; }).length;
  m.appendChild(segbar(QTABS.map(x => ({ ...x, n: x.id === 'list' ? all.length : x.id === 'todo' ? none + unsat + over : null })), tab, goTab));

  if (tab === 'list') {
    const tb = el('div', 'toolbar');
    tb.appendChild(selector('Все области', 'area', d.meta.areas.map(a => a.code), c => { const a = d.meta.areas.find(x => x.code === c); return `${c} — ${a.name}`; }));
    const subs = d.meta.subs.filter(x => !S.f.area || x.code[0] === (d.meta.areas.findIndex(a => a.code === S.f.area) + 1 + ''));
    tb.appendChild(selector('Подраздел', 'sub', subs.map(x => x.code), c => { const x = subs.find(y => y.code === c); return `${c} ${x.name}`; }));
    tb.appendChild(selector('Все КЭ', 'ce', Object.keys(d.meta.ce), c => `${c} — ${d.meta.ce[c]}`));
    tb.appendChild(selector('Все статусы', 'st', ['wip', 'sat', 'unsat', 'na', 'none'], c => c === 'none' ? t('Не оценено') : t(PQST[c])));
    tb.appendChild(toggle('Только со звёздочкой', 'star'));
    tb.appendChild(selector('Все ответственные', 'resp', team().map(x => x.id).concat(['none']), c => c === 'none' ? t('Не назначен') : nameOf(c)));
    tb.appendChild(inputFilter('Поиск по тексту ВП'));
    const ex = el('button', 'btn ghost sm', esc(t('Экспорт CSV'))); ex.onclick = () => exportPQ(list); tb.appendChild(ex);
    const pr = el('button', 'btn ghost sm', esc(t('Печать'))); pr.onclick = () => window.print(); tb.appendChild(pr);
    m.appendChild(tb);
    var list = all.filter(i => (!S.f.area || i.area === S.f.area) && (!S.f.sub || i.sub === S.f.sub) && (!S.f.ce || i.ce === S.f.ce) && (!S.f.star || i.star) && (!S.f.hint || pqHintOpen(i))
      && (!S.f.st || (S.f.st === 'none' ? !(st[i.id] || {}).st : (st[i.id] || {}).st === S.f.st))
      && (!S.f.resp || (S.f.resp === 'none' ? !respOfPQ(i) : (respOfPQ(i) || {}).id === S.f.resp))
      && (!S.f.over || (o => o.due && o.st !== 'sat' && o.st !== 'na' && daysTo(o.due) < 0)(st[i.id] || {}))
      && (!S.f.cap || capHas(i.id))
      && has(S.f.s, i.id, i.q, i.g.join(' '), i.doc, (respOfPQ(i) || {}).name, evText(st[i.id])));
    const cnt = { sat: 0, wip: 0, unsat: 0, na: 0 }; list.forEach(i => { const o = (st[i.id] || {}).st; if (o) cnt[o]++; });
    const nn = cnt.sat + cnt.wip + cnt.unsat + cnt.na;
    m.appendChild(el('div', 'card', `<div class="row"><b>${list.length}</b> <span class="dim">ВП · ${esc(t('Оценено'))} ${nn} (${pct(nn, list.length)}%) · ★ — применяется при оценке соблюдения Стандарта</span></div>${prog(cnt, list.length)}`));
    paged(m, list, part => m.appendChild(table(['№ ВП', 'Область', 'КЭ', 'Вопрос', 'Прил.', 'Статус', 'Ответственный', 'Срок'], part,
      i => { const o = st[i.id] || {}; return [`<span class="code">${esc(i.id)}</span>${i.star ? ' <span class="star">★</span>' : ''}${o.draft ? ' <span class="dim" title="Черновик ответа (Draft copy)">✎</span>' : ''}${capHas(i.id) ? ' <span class="dim" title="Вывод аудита 2019 (номер ВП — по протоколу 2019)">⚑</span>' : ''}`, `<span class="badge b-area">${i.area}</span>`, `<span class="badge b-ce">${esc(i.ce)}</span>`,
        `<div class="td-wrap clamp" title="${esc(i.q)}">${esc(i.q)}</div>`, `<span class="mono">${esc(i.doc)}</span>`, pqBadge(o.st), (r => r ? (r.byArea ? `<span class="dim" title="${esc(t('по области'))}">${esc(r.name)}</span>` : esc(r.name)) : '—')(respOfPQ(i)), o.due ? `<span class="${daysTo(o.due) < 0 && o.st !== 'sat' ? 'warn' : ''}">${fmtDate(o.due)}</span>` : '—']; },
      openPQ, { groupKey: S.f.sub || S.f.ce ? null : (i => { const x = d.meta.subs.find(y => y.code === i.sub); return x ? `${x.code} ${x.name}` : i.area; }) })));
  }

  if (tab === 'sum') {
    const cnt = { sat: 0, wip: 0, unsat: 0, na: 0 }; all.forEach(i => { const o = (st[i.id] || {}).st; if (o) cnt[o]++; });
    const nn = cnt.sat + cnt.wip + cnt.unsat + cnt.na;
    m.appendChild(el('div', 'card', `<h2>${esc(t('Самооценка'))} <span class="dim small">${nn} из ${all.length} (${pct(nn, all.length)}%)</span></h2>${prog(cnt, all.length)}`
      + `<div class="small dim mt">Удовлетворительно ${cnt.sat} · в работе ${cnt.wip} · не соответствует ${cnt.unsat} · не применимо ${cnt.na} · не оценено ${all.length - nn}</div>`));
    m.appendChild(ceEI(d, all, st));
    const ar = el('div', 'card');
    ar.innerHTML = `<h2>${esc(t('Области проверки'))} <span class="dim small">${d.meta.areas.length} областей · аудиторы по плану v1.0, две подгруппы с ротацией</span></h2>`;
    ar.appendChild(table(['Область', 'Наименование', 'Аудитор ИКАО', 'ВП', 'Оценено', 'EI'], d.meta.areas, x => {
      const items = all.filter(i => i.area === x.code);
      const n = { sat: 0, na: 0, done: 0 };
      items.forEach(i => { const k = (st[i.id] || {}).st; if (k) n.done++; if (k === 'sat') n.sat++; if (k === 'na') n.na++; });
      const appl = items.length - n.na; const ei = appl ? Math.round(n.sat * 100 / appl) : null;
      return [`<span class="badge b-area">${esc(x.code)}</span>`, `<span class="small">${esc(x.name)}</span>`,
        `<span class="small">${esc(areaAuditor(x.code) || '—')}</span>`, items.length,
        `${n.done} <span class="dim small">(${pct(n.done, items.length)}%)</span>`,
        ei == null ? '<span class="dim">—</span>' : `<b class="${ei < 60 ? 'warn' : ''}">${ei}%</b>`];
    }, x => go('pq', { area: x.code })));
    m.appendChild(ar);
    const X = xref();
    if (X) {
      const miss = all.filter(i => !(X.byKey.get(pqSarp(i)) || {}).cc);
      const withDoc = all.filter(i => ((X.byKey.get(pqSarp(i)) || {}).docs || []).length).length;
      const noNat = all.filter(i => { const c = (X.byKey.get(pqSarp(i)) || {}).cc; return c && !c.ref; }).length;
      const tr = el('div', 'card');
      tr.innerHTML = `<h2>${esc(t('Трассировка'))} <span class="dim small">ключи ${idChip('PQ:1.035')} → ${idChip('A17:3.1.1')} → ${idChip('R02')} → ${idChip('MX:А-2')}</span></h2>`
        + kv([['ВП → пункт CC', `<b>${all.length - miss.length}</b> из ${all.length}`],
          ['ВП → документ нормбазы по самому пункту', `<b>${withDoc}</b> из ${all.length} <span class="dim small">(остальные — через документы на всё приложение или по КЭ)</span>`],
          ['Пункт CC без национальной нормы', noNat ? `<b class="warn">${noNat}</b> ВП` : '0']])
        + (miss.length ? `<details class="mt"><summary class="small"><b>${miss.length} ВП не находят пункт CC</b> — для Прил. 9 ВП составлены по Поправке ${esc((D('pq').meta.title.match(/Поправка (\d+) к Приложению 9/) || [])[1] || '?')}, а CC — по Поправке ${esc((D('cc').meta.title.match(/Annex 9 Amendment (\d+)/) || [])[1] || '?')}</summary><div class="row mt">`
          + miss.map(i => `<button class="idc clk" type="button" data-openpq="${esc(i.id)}">PQ:${esc(i.id)} → ${esc(pqSarp(i))}</button>`).join(' ') + '</div></details>' : '');
      m.appendChild(tr);
    }
  }

  if (tab === 'todo') {
    const block = (title, n, href, note) => `<div class="subgrp"><div class="subhd">${esc(title)} <span class="dim small">${n}</span></div><div class="small dim">${esc(note)}</div>${n ? `<div class="row mt"><a class="btn sm ghost" href="${href}">Открыть →</a></div>` : ''}</div>`;
    const cap = all.filter(i => capHas(i.id)).length;
    const c = el('div', 'card');
    c.innerHTML = `<h2>${esc(t('К работе'))}</h2><p class="small dim">Списки открываются во вкладке «Список» с уже выставленным фильтром.</p>`
      + `<div class="subdocs">`
      + block('Не оценено', none, '#pq?st=none', 'Без статуса EI считается нулевым — это первое, что смотрит ИКАО')
      + block('Не соответствует', unsat, '#pq?st=unsat', 'Требуют корректирующего действия и доказательства до начала аудита')
      + block('Просрочен срок', over, '#pq?over=1', 'Срок в самооценке прошёл, а статус не «удовлетворительно»')
      + block('Есть вывод аудита 2019', cap, '#pq?cap=1', 'По этим ВП были выводы ИКАО — проверьте, закрыты ли рекомендации')
      + (D('pq_hints') ? block('Есть подсказки, нет доказательств', all.filter(pqHintOpen).length, '#pq?hint=1', 'Абзацы НПАБГА, Правил КК, Программы КК и Порядка по упрощению формальностей подобраны по тексту ВП — проверьте и перенесите в доказательства') : '')
      + `</div>`;
    m.appendChild(c);
  }
}
/* ---------- Сквозные идентификаторы (трассировка) ----------
   Один формат ключа на тип объекта:
     A17:3.1.1 / A9:3.7 — стандарт или рекомендуемая практика (Приложение : пункт);
     PQ:1.035 — вопрос протокола USAP-CMA;  R02 — документ нормбазы;  MX:А-2 — пункт матрицы;  CAP19:23.1 — рекомендация 2019.
   Редакция (Поправка 18 к Прил. 17, Поправка 29/30 к Прил. 9, протокол 2025) в ключ не вшивается — берётся из meta набора
   и показывается рядом: при смене поправки ключи стабильны, а расхождение редакций видно сразу.
   Связи считаются из данных. Ссылки реестра и матрицы записаны диапазонами («3.4.1–3.4.7»), и прежний поиск подстроки
   их не раскрывал: у 234 из 493 ВП терялись 345 привязок к документам нормбазы. */
const sarpKey = (an, id) => `A${an}:${id}`;
const pqDoc = i => String(i.doc || '').trim().replace(/^[АA]9\s+/, '').replace(/\.$/, '');   // «А9 8.13», «2.4.1.» → пункт
const pqSarp = i => sarpKey(i.area === 'FAL' ? 9 : 17, pqDoc(i));
const numCmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let k = 0; k < Math.max(x.length, y.length); k++) { const d = (x[k] ?? -1) - (y[k] ?? -1); if (d) return d; } return 0; };
const underPara = (id, p) => id === p || id.startsWith(p + '.');
// «Прил. 17 — 2.1.2, 3.4.1–3.4.7; Doc 8973» / «Прил. 17, ст. 4.2» → ключи пунктов CC.
// «SARPs целиком» или «Прил. 9» без пунктов → A17:* / A9:* (документ охватывает всё приложение)
function sarpRefs(str, ids) {
  const out = new Set();
  for (const m of String(str || '').matchAll(/Прил\.\s*(17|9)\b([^;]*)/g)) {
    const an = +m[1], tail = m[2];
    if (/целиком/i.test(tail) || !/\d+\.\d/.test(tail)) { out.add(`A${an}:*`); continue; }
    for (const r of tail.matchAll(/(\d+(?:\.\d+)+)(?:\s*[–-]\s*(\d+(?:\.\d+)+))?/g)) {
      const a = r[1], b = r[2];
      (ids[an] || []).forEach(id => { if (b ? numCmp(id, a) >= 0 && (numCmp(id, b) <= 0 || underPara(id, b)) : underPara(id, a)) out.add(`A${an}:${id}`); });
    }
  }
  return out;
}
// Индекс «ключ стандарта → пункт CC, ВП, документы нормбазы, пункты матрицы»; строится один раз на загруженные данные
const XREF = new WeakMap();
function xref() {
  const cc = D('cc'); if (!cc) return null;
  let x = XREF.get(cc); if (x) return x;
  const ids = { 17: [], 9: [] };
  cc.items.forEach(i => { if (i.id && (i.kind === 'std' || i.kind === 'rp')) (ids[i.annex] = ids[i.annex] || []).push(i.id); });
  const byKey = new Map(); const node = k => { if (!byKey.has(k)) byKey.set(k, { cc: null, pqs: [], docs: [], mx: [] }); return byKey.get(k); };
  cc.items.forEach(i => { if (i.id && (i.kind === 'std' || i.kind === 'rp')) node(sarpKey(i.annex, i.id)).cc = i; });
  const pq = D('pq'); if (pq) pq.items.forEach(i => node(pqSarp(i)).pqs.push(i));
  const reg = D('registry'); if (reg) reg.docs.forEach(d => sarpRefs((d.icao || []).join('; '), ids).forEach(k => node(k).docs.push(d)));
  const mx = D('matrix'); if (mx) mx.sections.forEach(s => s.items.forEach(it => sarpRefs(it.icao, ids).forEach(k => node(k).mx.push({ s, it }))));
  x = { byKey, ids }; XREF.set(cc, x); return x;
}
const idChip = (txt, attrs = '') => `<span class="idc"${attrs}>${esc(txt)}</span>`;
// Блок «Трассировка» в карточке ВП: стандарт → национальная норма по CC → документы нормбазы → матрица → другие ВП по пункту
function traceBlock(i) {
  const X = xref(); if (!X) return '';
  const k = pqSarp(i), n = X.byKey.get(k) || { cc: null, pqs: [], docs: [], mx: [] }, an = k.split(':')[0];
  const whole = (X.byKey.get(an + ':*') || { docs: [] }).docs;
  const ccm = D('cc').meta.title || '', pm = D('pq').meta.title || '';
  const edCC = an === 'A9' ? (ccm.match(/Annex 9 Amendment (\d+)/) || [])[1] : (ccm.match(/Annex 17 Amendment (\d+)/) || [])[1];
  const edPQ = an === 'A9' ? (pm.match(/Поправка (\d+) к Приложению 9/) || [])[1] : (pm.match(/Поправка (\d+) к Приложению 17/) || [])[1];
  const c = n.cc; const st = c ? ccOf(c).st : '';
  const others = n.pqs.filter(x => x.id !== i.id);
  const rows = [
    ['Стандарт ИКАО', c ? `${idChip(k)} ${badge(c.kind === 'std' ? 'info' : 'none', c.kind === 'std' ? 'Стандарт' : 'Рекомендуемая практика')} <span class="dim small">Поправка ${esc(edCC || '?')}</span> <button class="btn sm ghost" type="button" data-opencc="${esc(c.annex + ':' + c.id)}">Пункт CC →</button>`
      : `${idChip(k)} <span class="warn small">нет в контрольном перечне${edCC && edPQ && edCC !== edPQ ? ` — CC по Поправке ${esc(edCC)}, ВП по Поправке ${esc(edPQ)}` : ''}</span>`],
    ['Национальная норма (CC)', c ? `${esc(c.ref || '—')} ${st ? badge(st, CCST[st] || st) : ''}${c.diff ? `<div class="small dim">Различие: ${esc(c.diff)}</div>` : ''}` : ''],
    ['Нормбаза', n.docs.length ? n.docs.map(d => `${idChip(d.id)} ${esc(d.ru.length > 70 ? d.ru.slice(0, 70) + '…' : d.ru)}`).join('<br>') + (whole.length ? `<div class="small dim">и всё приложение: ${whole.map(d => esc(d.id)).join(', ')}</div>` : '')
      : (whole.length ? `<span class="dim small">точной ссылки нет; всё приложение охватывают ${whole.map(d => esc(d.id)).join(', ')}</span>` : '<span class="warn small">не найдено</span>')],
    ['Матрица соответствия', n.mx.map(({ s, it }) => `${idChip('MX:' + s.code + '-' + it.n)} ${esc(it.title)}`).join('<br>')],
    ['Другие ВП по пункту', others.length ? others.slice(0, 12).map(x => `<button class="idc clk" type="button" data-openpq="${esc(x.id)}">PQ:${esc(x.id)}</button>`).join(' ') + (others.length > 12 ? ` <span class="dim small">и ещё ${others.length - 12}</span>` : '') : ''],
  ];
  return `<h4>${esc(t('Трассировка'))} <span class="dim small">${idChip('PQ:' + i.id)}</span></h4>` + kv(rows);
}
// Справочные материалы к ВП — как вкладка «Reference & Guidance» в OLF: документы реестра, пункты матрицы, документы ИКАО.
// Связь по пункту Приложения (i.doc), критическому элементу (i.ce) и области аудита (i.area) — точное совпадение важнее общего.
function refsForPQ(i) {
  const reg = D('registry'), mx = D('matrix'), ic = D('icao');
  // ранги: 3 — ссылка на сам пункт (с раскрытием диапазонов), 2 — документ на всё приложение или тот же КЭ, 1 — та же область
  const X = xref(), k = pqSarp(i), node = X && X.byKey.get(k), an = k.split(':')[0];
  const exact = new Set(node ? node.docs.map(d => d.id) : []), whole = new Set(X && X.byKey.get(an + ':*') ? X.byKey.get(an + ':*').docs.map(d => d.id) : []);
  const docs = [];
  if (reg) reg.docs.forEach(x => {
    const rank = exact.has(x.id) ? 3 : whole.has(x.id) || (x.icao || []).includes(i.ce) ? 2 : (x.usap || []).includes(i.area) ? 1 : 0;
    if (rank) docs.push({ x, rank });
  });
  docs.sort((a, b) => b.rank - a.rank || a.x.n - b.x.n);
  const mrows = node ? node.mx.slice() : [];
  if (mx && !mrows.length) mx.sections.forEach(s => s.items.forEach(it => { if (String(it.icao || '').includes(i.ce)) mrows.push({ s, it }); }));
  const want = i.area === 'FAL' ? 'Приложение 9' : 'Приложение 17';
  const icaoDocs = ic ? ic.items.filter(x => x.code === want || x.code === 'Doc 8973') : [];
  return { docs, mrows, icaoDocs };
}
function refsBlock(R) {
  if (!R.docs.length && !R.mrows.length && !R.icaoDocs.length) return '';
  const dl = a => (a || []).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a>`).join(' · ');
  return `<details class="mt"><summary><b>${esc(t('Справочные материалы'))}</b> <span class="dim small">${R.docs.length} док. нормбазы · ${R.mrows.length} п. матрицы</span></summary>`
    + (R.docs.length ? `<h4>${esc(t('Нормативная база'))}</h4><ul class="list">${R.docs.slice(0, 8).map(({ x }) => `<li>${badge(x.bucket)} <b>${esc(x.ru)}</b>${x.approved ? ` <span class="dim small">${esc(x.approved)}</span>` : ''}${(x.drive || []).length ? ` — ${dl(x.drive)}` : ''}</li>`).join('')}</ul>` : '')
    + (R.mrows.length ? `<h4>${esc(t('Матрица ИКАО'))}</h4><ul class="list">${R.mrows.slice(0, 6).map(({ s, it }) => `<li><span class="dim small">${esc(s.code)}</span> ${esc(it.title)} <span class="dim small">— ${esc(it.icao)}</span></li>`).join('')}</ul>` : '')
    + (R.icaoDocs.length ? `<h4>${esc(t('Документы ИКАО'))}</h4><ul class="list">${R.icaoDocs.map(x => `<li><b>${esc(x.code)}</b> — ${esc(x.title)}${x.restricted ? ' <span class="dim small">(ограниченный доступ)</span>' : ''}${(x.links || []).length ? ` — ${dl(x.links)}` : ''}</li>`).join('')}</ul>` : '')
    + `</details>`;
}
// Доказательства одной строкой (для поиска и экспорта): структурированный список + старый свободный текст
const evText = o => [...((o || {}).evl || []).map(e => [e.doc, e.ref, e.date].filter(Boolean).join(' · ')), (o || {}).ev || ''].filter(Boolean).join('\n');
// EI по критическим элементам — главный график OLF: удовлетворительно ÷ применимые (не применимые исключаются)
function ceEI(d, list, st) {
  const c = el('div', 'card');
  const rows = Object.keys(d.meta.ce).map(ce => {
    const items = list.filter(i => i.ce === ce); if (!items.length) return null;
    const n = { sat: 0, unsat: 0, wip: 0, na: 0, none: 0 };
    items.forEach(i => { n[(st[i.id] || {}).st || 'none']++; });
    const appl = items.length - n.na;
    return { ce, n, appl, ei: appl ? Math.round(n.sat * 100 / appl) : null };
  }).filter(Boolean);
  c.innerHTML = `<h2>${esc(t('EI по критическим элементам'))} <span class="dim small">удовлетворительно ÷ применимые · ${S.f.star ? 'только ★' : 'все ВП'}${S.f.area ? ' · ' + esc(S.f.area) : ''}</span></h2>`
    + rows.map(r => `<div class="cerow"><div class="celab"><b>${esc(r.ce)}</b> <span class="dim small">${esc(d.meta.ce[r.ce] || '')}</span></div><div class="cebar"><span style="width:${r.ei == null ? 0 : r.ei}%"></span></div><div class="ceval"><b>${r.ei == null ? '—' : r.ei + '%'}</b> <span class="dim small">${r.n.sat}/${r.appl}${r.n.na ? ' · н/п ' + r.n.na : ''}</span></div></div>`).join('')
    + `<p class="small dim">Неоценённые ВП считаются неудовлетворительными — как в USAP до подтверждения доказательствами.</p>`;
  return c;
}
/* ---------- подсказки доказательств (pq_hints.json, tools/hints.py): абзацы национальных документов по тексту ВП ---------- */
const HINTDOC = { R02: 'НПАБГА', R05: 'Правила КК', QCP: 'Программа КК', R03: 'Порядок по упрощению формальностей', R04: 'Программа подготовки', R01: 'Воздушный кодекс' };
const hintDoc = code => { const r = D('registry') && D('registry').docs.find(d => d.id === code); return HINTDOC[code] || (r ? r.ru : code); };
const pqHints = id => (D('pq_hints') && D('pq_hints').hints[id]) || [];
// есть подсказки, а доказательств в самооценке ещё нет — очередь для NCMC
const pqHintOpen = i => pqHints(i.id).length > 0 && !(((pqOf(i.id).evl) || []).length) && !pqOf(i.id).ev;
function hintsBlock(i) {
  const hs = pqHints(i.id); if (!hs.length) return '';
  return `<details class="mt hints"><summary><b>${esc(t('Подсказки доказательств'))}</b> <span class="dim small">${hs.length} · ${esc(t('абзацы национальных документов по тексту ВП — ориентиры, не доказательства; сверьте по первоисточнику'))}</span></summary><ul class="list small">${hs.map((h, k) => `<li><span class="badge b-info">${esc(hintDoc(h.doc))}</span> <b>${esc(h.ref || '')}</b> <span class="dim">${esc(h.ctx || '')}</span><div>${esc(h.text)}</div><button type="button" class="btn sm ghost" data-evhint="${k}">${esc(t('в доказательства'))}</button></li>`).join('')}</ul></details>`;
}
function openPQ(i) {
  const d = D('pq'); const o = pqOf(i.id); const R = refsForPQ(i); const evl = Array.isArray(o.evl) ? o.evl : [];
  openSheet(`<h3><span class="code">${esc(i.id)}</span>${i.star ? ' <span class="star">★</span>' : ''} <span class="badge b-area">${i.area}</span> <span class="badge b-ce" title="${esc(d.meta.ce[i.ce] || '')}">${esc(i.ce)}</span> ${pqBadge(o.st)}</h3>
    <p><b>${esc(i.q)}</b></p>${capRef(i.id)}
    <h4>Рекомендации по рассмотрению / подтверждающие данные</h4>${i.g.length ? `<ul class="list">${i.g.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : '<p class="dim">—</p>'}
    ${kv([['Документ ИКАО', `<span class="mono">${esc(i.doc)}</span> (${i.area === 'FAL' ? 'Приложение 9' : 'Приложение 17'})`], ['Критический элемент', `${esc(i.ce)} — ${esc(d.meta.ce[i.ce] || '')}`], ['Подраздел', esc((d.meta.subs.find(s => s.code === i.sub) || {}).name || '')]])}
    ${traceBlock(i)}
    ${refsBlock(R)}${hintsBlock(i)}
    <h4>Самооценка</h4>
    <form class="form" id="pqForm">
      <div class="two">
        <label>${esc(t('Статус'))}<select name="st">${Object.entries(PQST).map(([k, v]) => `<option value="${k}"${o.st === k ? ' selected' : ''}>${esc(t(v))}</option>`).join('')}</select></label>
        <label>${esc(t('Срок'))}<input type="date" name="due" value="${esc(o.due || '')}"></label>
      </div>
      <label class="chk"><input type="checkbox" name="draft"${o.draft ? ' checked' : ''}> ${esc(t('Черновик ответа'))} <span class="dim small">(Draft copy — ответ ещё не утверждён)</span></label>
      <label>${esc(t('Ответственный'))}${(r => r && r.byArea ? ` <span class="dim">(${esc(t('по области'))}: ${esc(r.name)})</span>` : '')(respOfPQ(i))}${respSelect('resp', o.resp || '', true)}</label>
      <div class="evhead"><b>${esc(t('Доказательства'))}</b> <span class="dim small">документ · пункт или страница · дата — как требует USAP</span></div>
      <div id="evList"></div>
      <datalist id="evDocs">${R.docs.map(({ x }) => `<option value="${esc(x.ru)}">`).join('')}</datalist>
      <div class="row"><button type="button" class="btn sm ghost" id="evAdd">+ ${esc(t('Добавить доказательство'))}</button></div>
      ${o.ev ? `<label class="mt">${esc(t('Ранее внесённый текст доказательств'))} <span class="dim small">(перенесите в список выше и очистите поле)</span><textarea name="ev">${esc(o.ev)}</textarea></label>` : ''}
      <label>${esc(t('Примечание'))}<textarea name="note">${esc(o.note || '')}</textarea></label>
      <label>English translation <span class="dim small">перевод примечания и доказательств — аудиторы читают EN</span><textarea name="en">${esc(o.en || '')}</textarea></label>
      <label>${esc(t('Личная заметка'))} <span class="dim small">(Personal note — не попадает в экспорт)</span><textarea name="pnote">${esc(o.pnote || '')}</textarea></label>
      <div class="row"><button class="btn" type="submit">${esc(t('Сохранить'))}</button><button class="btn ghost" type="button" id="pqClear">Очистить</button><span class="dim small grow">${o.at ? 'изменено ' + esc(o.at) : ''}</span></div>
    </form>${changeLog('pq', i.id)}`);
  const evBox = $('#evList');
  const evRow = (v = {}) => { const r = el('div', 'evrow', `<input class="inp" data-k="doc" list="evDocs" placeholder="Документ" value="${esc(v.doc || '')}"><input class="inp" data-k="ref" placeholder="Пункт / страница" value="${esc(v.ref || '')}"><input class="inp" data-k="date" type="date" value="${esc(v.date || '')}"><button type="button" class="btn sm ghost evdel" title="Убрать">×</button>`);
    r.querySelector('.evdel').onclick = () => r.remove(); return r; };
  (evl.length ? evl : [{}]).forEach(v => evBox.appendChild(evRow(v)));
  $('#evAdd').onclick = () => evBox.appendChild(evRow());
  $$('#sheet [data-evhint]').forEach(b => { b.onclick = () => { const h = pqHints(i.id)[Number(b.dataset.evhint)]; if (!h) return;
    const empty = $$('.evrow', evBox).find(r => !r.querySelector('[data-k="doc"]').value && !r.querySelector('[data-k="ref"]').value); if (empty) empty.remove();
    evBox.appendChild(evRow({ doc: hintDoc(h.doc), ref: [h.ref, h.ctx].filter(Boolean).join(' · ') })); b.disabled = true; b.textContent = t('добавлено'); toast(t('Добавлено в доказательства — проверьте по первоисточнику и сохраните'), 'ok'); }; });
  $('#pqForm').onsubmit = e => {
    e.preventDefault(); const f = new FormData(e.target); const all = pqState();
    const rows = $$('.evrow', evBox).map(r => { const g = k => (r.querySelector(`[data-k="${k}"]`).value || '').trim(); return { doc: g('doc'), ref: g('ref'), date: g('date') }; }).filter(x => x.doc || x.ref || x.date);
    const rec = { st: f.get('st'), draft: !!f.get('draft'), due: f.get('due'), resp: (f.get('resp') || '').trim(), evl: rows, ev: (f.get('ev') || '').trim(), note: f.get('note').trim(), en: (f.get('en') || '').trim(), pnote: (f.get('pnote') || '').trim(), at: today() };
    logChange('pq', i.id, o, rec, PQLOGF);
    if (!rec.st && !rec.draft && !rec.due && !rec.resp && !rows.length && !rec.ev && !rec.note && !rec.en && !rec.pnote) delete all[i.id]; else all[i.id] = rec;
    LS.set(K.pq, all); toast('Сохранено: ВП ' + i.id, 'ok'); closeSheet(); render();
  };
  $('#pqClear').onclick = () => { const all = pqState(); delete all[i.id]; LS.set(K.pq, all); closeSheet(); render(); };
}
function exportPQ(list) {
  const st = pqState();
  const rows = [['№ ВП', '★', 'Область', 'Подраздел', 'КЭ', 'Вопрос', 'Рекомендации', 'Документ ИКАО', 'Статус самооценки', 'Ответственный', 'Срок', 'Доказательства', 'Примечание', 'English translation', 'Черновик']];
  list.forEach(i => { const o = st[i.id] || {}; rows.push([i.id, i.star ? '*' : '', i.area, i.sub, i.ce, i.q, i.g.join('\n'), i.doc, PQST[o.st || ''], (respOfPQ(i) || {}).name || '', o.due || '', evText(o), o.note || '', o.en || '', o.draft ? 'да' : '']); });
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
  paged(m, list, part => m.appendChild(table(['Пункт', 'Текст SARP', 'Национальная норма', 'Статус', 'Замечание'], part,
    i => { const o = ccOf(i); return [i.kind === 'hdr' ? `<b>${esc(i.text)}</b>` : `<span class="badge b-${i.kind}">${i.kind === 'std' ? 'Ст.' : i.kind === 'rp' ? 'РП' : 'Опр.'}</span> <span class="mono">${esc(i.id)}</span>`,
      i.kind === 'hdr' ? '' : `<div class="td-wrap clamp" title="${esc(i.text)}">${esc(i.text)}</div>`, `<div class="td-wrap clamp">${esc(i.ref || '—')}</div>`, o.st ? badge(o.st, CCST[o.st]) + (o.auto ? '' : ' <span class="dim small">✎</span>') : '', `<div class="td-wrap clamp small">${esc(i.remarks || i.desc || '')}</div>`]; },
    i => i.kind !== 'hdr' && openCC(i), { groupKey: i => i.section || `Глава ${i.ch}` })));
}
// ВП, которые ссылаются на пункт CC, — по ключу A17:3.1.1, а не поиском подстроки «3.1.1» (та находила и 3.1.10, и номера ВП)
function ccPQList(i) {
  const X = xref(); const n = X && X.byKey.get(sarpKey(i.annex, i.id));
  if (!n || !n.pqs.length) return (i.kind === 'std' || i.kind === 'rp') ? `<h4>${esc(t('Трассировка'))} ${idChip(sarpKey(i.annex, i.id))}</h4><p class="small dim">Ни один ВП протокола не ссылается на этот пункт.</p>` : '';
  return `<h4>${esc(t('Трассировка'))} ${idChip(sarpKey(i.annex, i.id))}</h4><p class="small">ВП по этому пункту: ${n.pqs.length}</p><div class="row">`
    + n.pqs.map(x => `<button class="idc clk" type="button" data-openpq="${esc(x.id)}" title="${esc(x.q.slice(0, 160))}">PQ:${esc(x.id)} ${pqBadge((pqOf(x.id) || {}).st)}</button>`).join(' ') + '</div>'
    + (n.docs.length ? `<p class="small mt">Нормбаза: ${n.docs.map(d => idChip(d.id) + ' ' + esc(d.ru.slice(0, 60))).join('; ')}</p>` : '');
}
function openCC(i) {
  const o = ccOf(i);
  openSheet(`<h3><span class="badge b-${i.kind}">${i.kind === 'std' ? 'Стандарт' : i.kind === 'rp' ? 'Рекомендуемая практика' : 'Определение'}</span> Приложение ${i.annex}, глава ${i.ch} ${esc(i.id)} ${o.st ? badge(o.st, CCST[o.st]) : ''}</h3>
    <p>${esc(i.text)}</p>
    ${kv([['Национальная норма', esc(i.ref || '—')], ['Категория различия', esc(i.diff)], ['Описание различия', esc(i.desc)], ['Замечания', esc(i.remarks)], ['Раздел', esc(i.section)]])}
    ${(i.kind === 'std' || i.kind === 'rp') ? `<h4>Оценка соответствия (портал)</h4><form class="form" id="ccForm">
      <div class="two"><label>${esc(t('Статус'))}<select name="st"><option value="">авто: ${esc(t(CCST[ccAuto(i)] || ''))}</option>${Object.entries(CCST).map(([k, v]) => `<option value="${k}"${!o.auto && o.st === k ? ' selected' : ''}>${esc(t(v))}</option>`).join('')}</select></label></div>
      <label>${esc(t('Примечание'))} (что нужно сделать, где норма)<textarea name="note">${esc(o.note)}</textarea></label>
      <div class="row"><button class="btn" type="submit">${esc(t('Сохранить'))}</button></div></form>` : ''}${ccPQList(i)}`);
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
  // Пакет документов GEN-05 — из usap.json (requested): один перечень с чек-листом раздела «Аудит», а не второй вшитый список
  const reg = D('registry'), up = U();
  if (up && reg) {
    const a = auditState(); const sent = up.requested.filter(r => docSent(r, a.docs)).length;
    const k = el('div', 'card');
    k.innerHTML = `<h2>Пакет документов к подаче (SASAQ GEN-05) <span class="dim small">${sent}/${up.requested.length} отправлено</span></h2>`
      + `<p class="small dim">Перечень и статусы — из раздела «Аудит USAP-CMA 2026»; менять их там.</p>`;
    k.appendChild(table(['№', 'Документ', 'В реестре АБ', 'Статус'], up.requested, r => {
      const ds = (r.reg || []).map(id => reg.docs.find(d => d.id === id)).filter(Boolean);
      const o = a.docs[r.id] || {}; const ss = subStats(r, a.docs); const hasParts = r.parts && r.parts.length;
      return [r.n, `${esc(r.ru)}<div class="small dim">${esc(r.en)}</div>`,
        ds.map(d => `<div class="small">${badge(d.bucket)} ${esc(d.ru)}</div>`).join('') || `<span class="dim small">${esc(r.note || '—')}</span>`,
        hasParts ? badge(ss.s === ss.tot ? 'ok' : ss.s > 0 ? 'wip' : 'none', `${ss.s}/${ss.tot} отправлено`) : badge(ADOCB[o.st || ''], ADOC[o.st || ''])];
    }));
    k.appendChild(el('div', 'row', `<a class="btn sm ghost" href="#audit?t=docs">Чек-лист подачи →</a>`));
    m.appendChild(k);
  }
}

/* ---------- Аудит USAP-CMA 2026 ---------- */
// Статусы документов: локальная отметка на устройстве; если её нет — факт отправки из данных (usap.requested[].sent),
// чтобы «отправлено в ИКАО» было видно на любом устройстве без ручных галочек.
function auditState() { const a = LS.get(K.audit, {}); const docs = { ...(a.docs || {}) }; const u = U();
  if (u) u.requested.forEach(r => {
    if (r.sent && !(docs[r.id] && docs[r.id].st)) docs[r.id] = { ...(docs[r.id] || {}), st: 'sent', at: r.sent.date, note: (docs[r.id] || {}).note || `${fmtDate(r.sent.date)}: ${r.sent.files.join('; ')} — ${r.sent.via}`, data: true };
    // подпункты (несколько документов эксплуатанта/аэропорта): факт отправки из данных, если нет ручной отметки
    if (r.parts) r.parts.forEach(g => g.items.forEach(it => { if (it.sent && !(docs[it.id] && docs[it.id].st)) docs[it.id] = { st: 'sent', at: it.sent.date, note: `${fmtDate(it.sent.date)} — ${it.sent.via}`, data: true }; }));
  });
  return { docs, log: a.log || {}, hos: a.hos || {} }; }
const saveAudit = a => LS.set(K.audit, { ...a, docs: Object.fromEntries(Object.entries(a.docs).filter(([, v]) => !v.data)) });   // факт из данных не дублируем в localStorage
// Подпункты и агрегат по строке: строка с parts считается «отправленной», только когда отправлены все её документы
function subStats(r, docs) { let s = 0, tot = 0; (r.parts || []).forEach(g => g.items.forEach(it => { tot++; if ((docs[it.id] || {}).st === 'sent') s++; })); return { s, tot }; }
function docSent(r, docs) { if (r.parts && r.parts.length) { const { s, tot } = subStats(r, docs); return tot > 0 && s === tot; } return (docs[r.id] || {}).st === 'sent'; }
const ADOC = { '': 'Не начато', wip: 'В работе', ready: 'Готово', sent: 'Отправлено в ИКАО', na: 'Не применимо' };
const ADOCB = { '': 'none', wip: 'wip', ready: 'draft', sent: 'ok', na: 'na' };
function auditBrief() {
  const u = U(); if (!u) return '';
  const a = auditState(); const n = u.requested.length, sent = u.requested.filter(r => docSent(r, a.docs)).length;
  const dl = u.audit.docsDeadline, late = daysTo(dl) < 0 && sent < n;
  return `<div class="small mt">${esc(t('Аудит на месте'))}: <b>${fmtDate(u.audit.start)} – ${fmtDate(u.audit.end)}</b>, ${esc(u.audit.placeShort)} · NCMC: ${esc(u.ncmc.name)}</div><div class="small ${late ? 'warn' : 'dim'}">Документы ИКАО: отправлено ${sent} из ${n} · срок ${fmtDate(dl)}${late ? ' · просрочен на ' + (-daysTo(dl)) + ' дн.' : ''}</div><div class="mt"><a class="btn sm ghost" href="#audit">${esc(t('Аудит USAP-CMA 2026'))} →</a></div>`;
}
/* Приём группы: транспорт, питание, культурная программа, подарки — внутренняя организация, в план ИКАО не входит.
   Отметки «готово» хранятся на устройстве (auditState().hos). */
const HOSK = { meet: ['✈', 'Встреча'], transfer: ['🚐', 'Трансфер'], lunch: ['🍽', 'Обед'], dinner: ['🌙', 'Ужин'], tour: ['🏛', 'Экскурсия'], meeting: ['👥', 'Встреча'], org: ['📋', 'Организация'], gift: ['🎁', 'Подарки'] };
// считаем только пункты, требующие действия (бронь, закуп, заказ): встреча и трансфер отмечать нечего
function hosStats(h, hos) { let n = 0, d = 0; (h.days || []).forEach(x => x.items.forEach(i => { if (!i.task) return; n++; if ((hos[i.id] || {}).done) d++; })); return { n, d }; }
// Мероприятия приёма за один день плана — врезкой в строку подневного плана ИКАО
function hosDayBlock(x, a) {
  if (!x || !x.items.length) return '';
  const tk = x.items.filter(i => i.task); const ds = tk.filter(i => (a.hos[i.id] || {}).done).length;
  const ic = i => { const k = HOSK[i.kind] || ['·', '']; return `<span title="${esc(k[1])}">${k[0]}</span>`; };
  return `<div class="subdocs"><div class="subgrp"><div class="subhd">${esc(t('Приём'))}${tk.length ? ` <span class="dim small">${ds}/${tk.length}</span>` : ''}</div>`
    + x.items.map(i => { const on = (a.hos[i.id] || {}).done;
      // галочка — только у пунктов, которые надо подтвердить или закупить; остальное просто строка программы
      return i.task
        ? `<label class="subrow${on ? ' on' : ''}"><input type="checkbox" data-hos="${esc(i.id)}"${on ? ' checked' : ''}><span>${ic(i)} ${esc(i.text)}</span></label>`
        : `<div class="subrow nb"><span>${ic(i)} ${esc(i.text)}</span></div>`; }).join('')
    + '</div></div>';
}
/* Раздел аудита раньше был одним экраном из 11 карточек — читать было тяжело, факты повторялись.
   Теперь четыре вкладки; активная лежит в адресе (#audit?t=plan), поэтому на неё можно дать ссылку. */
const ATABS = [{ id: 'sum', t: 'Обзор' }, { id: 'plan', t: 'План и приём' }, { id: 'docs', t: 'Документы' }, { id: 'log', t: 'Логистика' }];
function segbar(items, cur, pick) {
  const b = el('div', 'segs');
  items.forEach(x => { const n = el('button', 'seg' + (x.id === cur ? ' on' : ''), `${esc(t(x.t))}${x.n == null ? '' : ` <span class="n">${esc(String(x.n))}</span>`}`);
    n.onclick = () => pick(x.id); b.appendChild(n); });
  return b;
}
function pAudit(m) {
  const u = U(); if (!u) return m.appendChild(el('div', 'empty', 'Данные об аудите не загружены'));
  head(m, 'Аудит USAP-CMA 2026', `${esc(u.meta.title)} · обновлено ${fmtDate(u.meta.updated)} · факты — из переписки с ИКАО и SASAQ, статусы чек-листов — на этом устройстве`);
  const a = auditState();
  const sent = u.requested.filter(r => docSent(r, a.docs)).length, done = u.logistics.filter(l => (a.log[l.id] || (l.done ? { done: true } : {})).done).length, dl = daysTo(u.audit.docsDeadline);
  const hs = u.hospitality ? hosStats(u.hospitality, a.hos) : null;
  const tab = ATABS.some(x => x.id === S.f.t) ? S.f.t : 'sum';
  const goTab = id => go('audit', { ...S.f, t: id === 'sum' ? '' : id }, S.q);

  // Плитки — одной строкой: просрочка подачи ушла подписью к документам, а не отдельной плиткой
  const tiles = el('div', 'tiles');
  tiles.appendChild(tile('info', daysTo(u.audit.start), `Дней до аудита · ${fmtDate(u.audit.start)}`, () => go('plan')));
  tiles.appendChild(tile(sent === u.requested.length ? 'ok' : 'miss', `${sent}/${u.requested.length}`,
    dl < 0 && sent < u.requested.length ? `Документов в ИКАО · просрочка ${-dl} дн.` : 'Документов отправлено в ИКАО', () => goTab('docs')));
  tiles.appendChild(tile(done === u.logistics.length ? 'ok' : 'draft', `${done}/${u.logistics.length}`, 'Логистика: пунктов выполнено', () => goTab('log')));
  if (hs) tiles.appendChild(tile(hs.d === hs.n ? 'ok' : 'draft', `${hs.d}/${hs.n}`, 'Приём: мероприятий готово', () => goTab('plan')));
  m.appendChild(tiles);
  m.appendChild(segbar(ATABS.map(x => ({ ...x, n: x.id === 'docs' ? `${sent}/${u.requested.length}` : x.id === 'log' ? `${done}/${u.logistics.length}` : x.id === 'plan' && hs ? `${hs.d}/${hs.n}` : null })), tab, goTab));

  if (tab === 'sum') {
    const g = el('div', 'grid2');
    // «Согласование дат» дублировало источник строки «Аудит на месте» — убрано
    const f = el('div', 'card'); f.innerHTML = `<h2>${esc(t('Об аудите'))}</h2>` + kv([
      ['Аудит на месте', `<b>${fmtDate(u.audit.start)} – ${fmtDate(u.audit.end)}</b> · ${esc(u.audit.place)}${u.audit.agreedBy ? `<div class="src">Согласование: ${esc(u.audit.agreedBy)}</div>` : ''}`],
      ['Охват', esc(u.audit.scope)], ['Язык', esc(u.audit.language)],
      ['Группа ИКАО', `${u.audit.teamSize} чел.; руководитель — ${esc(u.audit.teamLeader)} · <a href="#audit?t=plan">состав и области →</a>`],
      ['Уведомление ИКАО', `${fmtDate(u.notification.date)}, ${esc(u.notification.ref)} — предложено ${esc(u.notification.proposed)}; адресат — ${esc(u.notification.addressee)}`],
      ['МоВ ИКАО — Таджикистан', `подписан ${fmtDate(u.mou.signed)}`],
      ['Предыдущий аудит', `${esc(u.previous.audit)}. ${esc(u.previous.cap)}. 2019: EI ${u.previous.results2019.ei} %, соответствие Прил. 17 — ${u.previous.results2019.compliance} %; ${esc(u.previous.results.source)}: EI ${u.previous.results.ei} %, соответствие — ${u.previous.results.compliance} %. <a href="#cap">Выводы 2019 →</a>`],
    ]);
    g.appendChild(f);
    const dd = el('div', 'card'); dd.innerHTML = `<h2>${esc(t('Сроки и доступ'))}</h2>` + kv([
      ['Срок утверждённых документов', u.audit.docsApprovedDeadline ? `<b class="${daysTo(u.audit.docsApprovedDeadline) < 30 ? 'warn' : ''}">${fmtDate(u.audit.docsApprovedDeadline)}</b> — через ${daysTo(u.audit.docsApprovedDeadline)} дн.<div class="src">${esc(u.audit.docsApprovedNote || '')}</div>` : ''],
      ['Срок подачи документов', `<span class="${dl < 0 ? 'warn' : ''}">${fmtDate(u.audit.docsDeadline)}</span> — ${esc(u.audit.docsDeadlineNote)}`],
      ['Брифинг и разбор', esc(u.audit.briefing || '')],
      ['План аудита', esc(u.audit.auditPlan || '')],
      ['AvSec Week', esc(u.audit.avsecWeek || '')],
      ['Загрузка документов', `<a href="${esc(u.audit.upload)}" target="_blank" rel="noopener">${esc(u.audit.upload)}</a> (не по e-mail)`],
      ['Портал ИКАО', `<a href="${esc(u.audit.portal)}" target="_blank" rel="noopener">${esc(u.audit.portal)}</a> — группа USAP (ВП, SASAQ, CC); доступ — по NC Welcome Package`],
      ['NCMC', `${esc(u.ncmc.name)}, ${esc(u.ncmc.title)} · ${esc(u.ncmc.email)} · ${esc(u.ncmc.phone)}`],
    ]);
    g.appendChild(dd);
    m.appendChild(g);
    const g2 = el('div', 'grid2');
    const ct = el('div', 'card'); ct.innerHTML = `<h2>${esc(t('Контакты'))}</h2>` + kv(u.contacts.map(c => [c.who, `${esc(c.role)}${c.email ? ' · <a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : ''}${c.phone ? ' · ' + esc(c.phone) : ''}`]));
    g2.appendChild(ct);
    const fl = el('div', 'card'); fl.innerHTML = `<h2>${esc(t('Файлы'))} (Drive)</h2>` + links(u.files); g2.appendChild(fl);
    m.appendChild(g2);
    m.appendChild(el('details', 'card small dim', `<summary>${esc(t('Источники'))} <span class="dim">${u.meta.sources.length}</span></summary><div class="mt">${u.meta.sources.map(esc).join('; ')}.</div>`));
  }

  if (tab === 'plan') {
    // План ИКАО и приём группы — об одних и тех же днях, поэтому одна карточка:
    // мероприятия приёма встают прямо в строку своего дня, а не отдельным списком с теми же датами
    const h = u.hospitality; const byDate = {}; if (h) (h.days || []).forEach(x => { byDate[x.date] = x; });
    const sc = el('div', 'card'); sc.id = 'hosp';
    sc.innerHTML = `<h2>${esc(t('План аудита'))} <span class="dim small">редакция v1.0 от 18.09.2026${h ? ` · приём ${hs.d}/${hs.n}` : ''}</span></h2>`
      + (h && h.transport ? `<p class="small dim">${esc(t('Транспорт'))}: <b>${esc(h.transport.vehicle)}</b> · ${esc(t('ответственный'))} ${esc(h.transport.resp)} · ${esc(h.transport.text)}</p>` : '');
    sc.appendChild(table(['Дата', 'Мероприятие плана и приём'], u.schedule,
      r => [`<span class="mono">${r.date ? fmtDate(r.date) : ''}</span> <span class="dim small">${esc(r.dow || '')}</span>`,
        esc(r.text) + hosDayBlock(byDate[r.date], a)]));
    if (h && (h.open || []).length) sc.appendChild(el('div', '', `<div class="small mt"><b>${esc(t('Уточнить'))}:</b></div><ul class="list small">${h.open.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`));
    const sjd = SUBJ();
    if (sjd) {
      // раздел 5 плана: по областям проверки — организации из реестра субъектов с текстом, отправленным ИКАО; «уточнить» — позиции без наименования
      const areas = D('pq') ? D('pq').meta.areas.map(a => a.code) : [...new Set(sjd.orgs.flatMap(o => o.areas.map(a => a.code)))];
      const rows = areas.map(code => ({ code,
        list: sjd.orgs.filter(o => !o.tbd && o.areas.some(a => a.code === code)).map(o => ({ o, text: o.areas.find(a => a.code === code).text || orgName(o) })),
        tbd: sjd.orgs.filter(o => o.tbd && o.areas.some(a => a.code === code)) })).filter(r => r.list.length || r.tbd.length);
      const nIn = new Set(rows.flatMap(r => r.list.map(x => x.o.code))).size, nTbd = sjd.orgs.filter(o => o.tbd).length;
      const dt = el('details', 'mt');
      dt.innerHTML = `<summary><b>${esc(t('Организации для раздела 5 плана'))}</b> <span class="dim small">${nIn} ${esc(t('организаций'))}${nTbd ? ` · ${nTbd} ${esc(t('уточнить'))}` : ''} · <a href="#subjects">${esc(t('реестр субъектов'))}</a></span></summary><p class="small dim">${esc(u.audit.entitiesNote || '')}</p>`;
      dt.appendChild(table(['Область', 'Организации', 'Уточнить'], rows,
        x => [`<span class="badge b-area">${esc(x.code)}</span>`,
          `<ul class="list small">${x.list.map(e => `<li><button class="idc clk" data-openorg="${esc(e.o.code)}">${esc(e.o.code)}</button> ${esc(e.text)}</li>`).join('')}</ul>`,
          x.tbd.length ? `<ul class="list small warn">${x.tbd.map(o => `<li><button class="idc clk" data-openorg="${esc(o.code)}">${esc(o.code)}</button> ${esc(o.tbd)}</li>`).join('')}</ul>` : '<span class="dim small">—</span>']));
      sc.appendChild(dt);
    }
    sc.onchange = e => { const x = e.target; if (!x.dataset.hos) return; const st = auditState(); st.hos[x.dataset.hos] = x.checked ? { done: true, at: today() } : { done: false }; saveAudit(st); render(); };
    m.appendChild(sc);
    if (u.audit.team) {
      const TEAMST = { confirmed: ['ok', 'Подтверждён'], pending: ['draft', 'Ожидает подтверждения'] };
      const tc = el('div', 'card'); tc.id = 'team';
      tc.innerHTML = `<h2>${esc(t('Группа аудита ИКАО'))} <span class="dim small">${u.audit.team.length} чел. · письма 03.07 и 31.07.2026</span></h2>`;
      tc.appendChild(table(['Участник', 'Роль', 'Области', 'Направлен', 'Паспорт / виза', 'Прибытие', 'Отъезд', 'Статус'], u.audit.team, x => [
        `<b>${esc(x.name)}</b>${x.email ? `<div class="small"><a href="mailto:${esc(x.email)}">${esc(x.email)}</a>${x.phone ? ' · ' + esc(x.phone) : ''}</div>` : ''}`,
        `<span class="small">${esc(x.role)}</span>`, `<span class="small mono">${esc(x.areas || '—')}</span>`, `<span class="small">${esc(x.org)}</span>`, `<span class="small">${esc(x.passport)}</span>`,
        `<span class="small mono">${esc(x.arrive)}</span>`, `<span class="small mono">${esc(x.depart)}</span>`, badge((TEAMST[x.status] || ['none', x.status])[0], (TEAMST[x.status] || ['none', x.status])[1])],
        x => openSheet(`<h3>${esc(x.name)} ${badge((TEAMST[x.status] || ['none', x.status])[0], (TEAMST[x.status] || ['none', x.status])[1])}</h3>${kv([['Роль', esc(x.role)], ['Области проверки', esc(x.areas || '')], ['Направлен', esc(x.org)], ['Паспорт / виза', esc(x.passport)], ['Прибытие', esc(x.arrive)], ['Отъезд', esc(x.depart)], ['E-mail', x.email ? `<a href="mailto:${esc(x.email)}">${esc(x.email)}</a>` : ''], ['Телефон', esc(x.phone || '')]])}<p class="small dim">${esc(u.audit.teamNote || '')}</p><div class="row mt">${x.email ? `<a class="btn sm" href="mailto:${esc(x.email)}">Написать</a>` : ''}<button class="btn sm ghost" data-go="audit?t=plan">К плану</button></div>`)));
      if (u.audit.teamNote) tc.appendChild(el('p', 'small dim', esc(u.audit.teamNote)));
      m.appendChild(tc);
    }
  }

  if (tab === 'docs') {
    const reg = D('registry');
    const rd = el('div', 'card'); rd.id = 'reqDocs';
    rd.innerHTML = `<h2>${esc(t('Запрошенные документы'))} <span class="dim small">${sent}/${u.requested.length} отправлено</span></h2><p class="small dim">Письмо ИКАО от 01.05.2026 (не позднее чем за 60 дней), запрос руководителя группы от 15.06.2026, SASAQ GEN-05. Статус и примечание сохраняются на этом устройстве.</p>`;
    // подпункты (несколько документов эксплуатанта/аэропорта) — галочки «что уже ушло»
    const subList = r => !(r.parts && r.parts.length) ? '' : `<div class="subdocs">${r.parts.map(g => {
      const gs = g.items.filter(it => (a.docs[it.id] || {}).st === 'sent').length;
      return `<div class="subgrp"><div class="subhd">${esc(g.group)} <span class="dim small">${gs}/${g.items.length}</span></div>${g.items.map(it => { const on = (a.docs[it.id] || {}).st === 'sent';
        return `<label class="subrow${on ? ' on' : ''}"><input type="checkbox" data-sub="${esc(it.id)}"${on ? ' checked' : ''}><span>${esc(it.ru)}<span class="dim small"> · ${esc(it.en)}</span>${it.note ? `<span class="dim small"> — ${esc(it.note)}</span>` : ''}</span></label>`; }).join('')}</div>`;
    }).join('')}</div>`;
    rd.appendChild(table(['№', 'Документ', 'Основание', 'В реестре АБ', 'Статус', 'Примечание'], u.requested,
      r => { const o = a.docs[r.id] || {}; const ds = reg ? (r.reg || []).map(id => reg.docs.find(d => d.id === id)).filter(Boolean) : [];
        const hasParts = r.parts && r.parts.length; const ss = subStats(r, a.docs);
        return [r.n, `<b>${esc(r.ru)}</b><div class="small dim">${esc(r.en)}</div>${r.note ? `<div class="small">${esc(r.note)}</div>` : ''}${subList(r)}`, `<span class="small">${esc(r.ref)}</span>`,
          ds.map(d => `<div class="small">${badge(d.bucket)} ${esc(d.ru)}</div>`).join('') || '<span class="dim small">—</span>',
          hasParts ? `${badge(ss.s === ss.tot ? 'ok' : ss.s > 0 ? 'wip' : 'none', `${ss.s}/${ss.tot}`)} <span class="small dim">отправлено</span>`
            : `<select class="sel" data-doc="${esc(r.id)}" style="height:30px">${Object.entries(ADOC).map(([k, v]) => `<option value="${k}"${(o.st || '') === k ? ' selected' : ''}>${esc(t(v))}</option>`).join('')}</select>${o.st && o.at ? `<div class="small dim">${esc(o.at)}</div>` : ''}`,
          hasParts ? '<span class="dim small">отметьте документы слева</span>' : `<input class="inp" data-note="${esc(r.id)}" value="${esc(o.note || '')}" placeholder="файл, дата, кто отправил">`]; }, null, { w: ['3%', '34%', '13%', '17%', '16%', '17%'] }));
    rd.onchange = e => { const x = e.target; const st = auditState();
      // дату ставим только вместе со статусом: снятая галочка не должна выглядеть как «выполнено сегодня»
      if (x.dataset.sub) st.docs[x.dataset.sub] = { ...(st.docs[x.dataset.sub] || {}), data: undefined, st: x.checked ? 'sent' : '', at: x.checked ? today() : '' };
      else if (x.dataset.doc) st.docs[x.dataset.doc] = { ...(st.docs[x.dataset.doc] || {}), data: undefined, st: x.value, at: x.value ? today() : '' };
      else if (x.dataset.note) st.docs[x.dataset.note] = { ...(st.docs[x.dataset.note] || {}), data: undefined, note: x.value.trim() };
      else return; saveAudit(st); toast('Сохранено', 'ok'); if (x.dataset.doc || x.dataset.sub) render(); };
    // Enter в примечании — сохранить и перейти к следующей строке (быстрый ввод, как в Библиотеке Shohin)
    rd.addEventListener('keydown', e => { if (e.key !== 'Enter' || !e.target.dataset.note) return; e.preventDefault(); const ins = $$('input[data-note]', rd); const i = ins.indexOf(e.target); e.target.dispatchEvent(new Event('change', { bubbles: true })); if (ins[i + 1]) ins[i + 1].focus(); });
    if (sent < u.requested.length) rd.appendChild(el('div', '', suggest(`осталось отправить позиций: <b>${u.requested.length - sent}</b>; загрузка только через защищённую ссылку ИКАО`, u.audit.upload, 'Открыть ICAO Box')));
    m.appendChild(rd);
    const checkCard = (x, title, href, label, docId) => { const c = el('div', 'card'); const st = a.docs[docId] || {}; const on = st.st === 'sent';
      c.innerHTML = `<h2>${esc(t(title))} — проверка ${fmtDate(x.date)} <span class="dim small">${esc(x.file)}</span></h2>`
        + (on ? `<p>${badge('ok', `Отправлено в ИКАО${st.at ? ' ' + fmtDate(st.at) : ''}`)} <span class="dim small">— замечания ниже относятся к проверке перед подачей (история)</span></p>`
              : `<p><b class="warn">${esc(x.verdict)}</b> ${esc(x.summary)}</p>`)
        + `<ul class="list">${x.items.map(y => `<li>${esc(y)}</li>`).join('')}</ul><p class="small dim">${esc(x.source)}</p><div class="row"><a class="btn sm ghost" href="${href}">${esc(label)} →</a></div>`; return c; };
    if (u.ccCheck) m.appendChild(checkCard(u.ccCheck, 'Готовность CC к подаче', '#cc', 'Контрольный перечень в портале', 'cc'));
    if (u.capCheck) m.appendChild(checkCard(u.capCheck, 'Готовность ПКД к подаче', '#cap?st=open', 'Незакрытые рекомендации ПКД', 'cap'));
  }

  if (tab === 'log') {
    const lg = el('div', 'card'); lg.id = 'logi'; lg.innerHTML = `<h2>${esc(t('Логистика'))} и организация <span class="dim small">${done}/${u.logistics.length}</span></h2>`;
    lg.appendChild(table(['', 'Пункт', 'Источник'], u.logistics, l => { const o = a.log[l.id] || (l.done ? { done: true, at: l.done } : {}); return [`<input type="checkbox" data-log="${esc(l.id)}"${o.done ? ' checked' : ''}>`, `<span class="${o.done ? 'dim' : ''}">${esc(l.text)}</span>${o.done && o.at ? ` <span class="dim small">${esc(o.at)}</span>` : ''}`, `<span class="small dim">${esc(l.ref || '')}</span>`]; }));
    lg.onchange = e => { const x = e.target; if (!x.dataset.log) return; const st = auditState(); st.log[x.dataset.log] = x.checked ? { done: true, at: today() } : { done: false }; saveAudit(st); render(); };
    m.appendChild(lg);
    // проживание, въезд и транспорт — рядом с чек-листом, а не в «Ключевых фактах»
    const tr = u.hospitality && u.hospitality.transport;
    const st = el('div', 'card'); st.innerHTML = `<h2>${esc(t('Проживание, въезд, транспорт'))}</h2>` + kv([
      ['Гостиница', esc(u.audit.hotel || '')], ['Суточные и лимит', esc(u.audit.hotelLimit || '')],
      ['Визы', esc(u.audit.visa || '')], ['Переводчики', esc(u.audit.interpreters || '')],
      ['Транспорт', tr ? `<b>${esc(tr.vehicle)}</b> · ${esc(t('ответственный'))} ${esc(tr.resp)}<div class="src">${esc(tr.text)}</div>` : ''],
    ]);
    m.appendChild(st);
  }
}

/* ---------- Выводы аудита 2019 (CAP) ---------- */
const CAPP = { critical: 'Очень высокий', high: 'Высокий', medium: 'Средний', low: 'Низкий' };
const CAPB = { critical: 'unsat', high: 'missing', medium: 'draft', low: 'ok' };
/* статусы выполнения рекомендаций — из редакции ПКД EN (cap2019.meta.update) */
const CAPST = { done: 'Выполнено', part: 'Частично', wip: 'В работе', ongoing: 'Постоянно', na: 'Не применимо', '': 'Нет статуса' };
const CAPSB = { done: 'ok', part: 'draft', wip: 'wip', ongoing: 'info', na: 'na', '': 'none' };
const capSt = i => (i.status && i.status.st) || '';
function capStats(c) { const s = { done: 0, part: 0, wip: 0, ongoing: 0, na: 0, open: 0, total: 0 }; c.findings.forEach(f => f.items.forEach(i => { const k = capSt(i); s.total++; if (s[k] !== undefined) s[k]++; if (k !== 'done' && k !== 'na') s.open++; })); return s; }

/* Корректирующие действия в формате ИКАО OLF (таблица Corrective Action Items):
   Step · Proposed Action · Action Office · Evidence Reference · Est./Rev. Imp. Date · Date of Completion · Progress Status.
   Факты берём из ПКД 2020 / редакции EN v2.1, недостающие поля заполняет пользователь — хранятся на устройстве. */
const CAPPR = { completed: 'Выполнено с доказательством', inprogress: 'В работе', notsub: 'Не представлено', na: 'Не применимо' };
const CAPPRB = { completed: 'completed', inprogress: 'inprogress', notsub: 'notsub', na: 'na' };
const CAPPREN = { completed: 'Completed with evidence as indicated by the State', inprogress: 'In-Progress', notsub: 'Not Submitted', na: 'Not applicable' };
const capProgOf = i => ({ done: 'completed', part: 'inprogress', wip: 'inprogress', ongoing: 'inprogress', na: 'na' })[capSt(i)] || 'notsub';
const capItemState = () => LS.get(K.capi, {});
const capKey = (f, idx) => f.n + '-' + (idx + 1);
function capItem(f, idx, i) {
  const key = capKey(f, idx), o = capItemState()[key] || {}, st = i.status || {};
  return { key, step: idx + 1, action: i.action || '', org: o.org != null ? o.org : (st.orgEn || i.org || ''), evref: o.evref || '',
    est: o.est || st.due || '', rev: o.rev || '', done: o.done || '', progress: o.progress || capProgOf(i), percent: o.percent || '', at: o.at || '', saved: !!o.at };
}
// стек «CAP Status by Audit Area» — как на дашборде OLF
function capByArea(c) {
  const map = {};
  c.findings.forEach(f => f.items.forEach((i, idx) => {
    const a = f.area, p = capItem(f, idx, i).progress;
    (map[a] = map[a] || { completed: 0, inprogress: 0, notsub: 0, na: 0, total: 0 });
    map[a][p]++; map[a].total++;
  }));
  const box = el('div', 'card');
  box.innerHTML = `<h2>${esc(t('Статус ПКД по областям аудита'))} <span class="dim small">${Object.entries(CAPPR).map(([k, v]) => `<span class="badge b-${CAPPRB[k] === 'completed' ? 'ok' : CAPPRB[k] === 'inprogress' ? 'wip' : CAPPRB[k] === 'na' ? 'na' : 'none'}">${esc(t(v))}</span>`).join(' ')}</span></h2>`
    + Object.entries(map).sort((a, b) => b[1].total - a[1].total).map(([a, n]) => `<div class="cerow"><div class="celab"><b>${esc(a)}</b> <span class="dim small">${n.total} рек.</span></div>`
      + `<div class="prog">${['completed', 'inprogress', 'notsub', 'na'].filter(k => n[k]).map(k => `<span class="p-${k}" style="width:${n[k] * 100 / n.total}%" title="${esc(t(CAPPR[k]))}: ${n[k]}"></span>`).join('')}</div>`
      + `<div class="ceval"><b>${Math.round(n.completed * 100 / n.total)}%</b> <span class="dim small">${n.completed}/${n.total}</span></div></div>`).join('');
  return box;
}
// Колонки листа CAPExportToExcel из выгруженного шаблона OLF (23.09.2026). Excel у OLF read-only:
// файл годится для сверки и зеркала, обратно импортируется только .docx, выданный самим OLF.
function capProgOLF(x) { if (x.percent) return `${x.percent}% complete`; if (x.progress === 'completed') return '100% complete'; return CAPPREN[x.progress] || ''; }
function exportCapOLF(c) {
  const who = ((U() || {}).ncmc || {}).name || '';
  const rows = [['Audit Area', 'CE Code', 'PQ Number', 'Description of Finding', 'Step', 'Actions Of CAP', 'Action Office', 'Evidence', 'Estimated Implementation Date', 'Revised Implementation Date', 'Date Of Completion', 'Progress', 'Latest Modified', 'Latest Modified By']];
  c.findings.forEach(f => f.items.forEach((i, idx) => { const x = capItem(f, idx, i);
    rows.push([f.area, 'CE-' + i.ce, i.pq, i.rec, x.step, x.action, x.org, x.evref, x.est, x.rev, x.done, capProgOLF(x), x.at, x.at ? who : '']); }));
  download(csv(rows), `AvSec_CAP_OLF_sverka_${today()}.csv`, 'text/csv;charset=utf-8');
}
// Индекс «ВП → выводы 2019» строится один раз на загруженные данные: иначе 493 строки × 176 рекомендаций на каждую перерисовку
const CAPIDX = new WeakMap();
function capIdx() { const c = D('cap2019'); if (!c) return null; let m = CAPIDX.get(c);
  if (!m) { m = new Map(); c.findings.forEach(f => f.items.forEach(i => { if (!m.has(i.pq)) m.set(i.pq, []); m.get(i.pq).push({ f, i }); })); CAPIDX.set(c, m); }
  return m; }
const capHas = id => { const m = capIdx(); return !!m && m.has(id); };
// Номера ВП в ПКД 2020 — по протоколу 2019; в Поправке 18 (2025) часть номеров переиспользована.
// 18 номеров вовсе не находятся, а совпавшие сверяем по критическому элементу: расходится — ссылку помечаем «сверить».
const ceNorm = v => String(v == null ? '' : v).replace(/КЭ-?/gi, '').trim();
const capSusp = (i, cur) => !!cur && ceNorm(i.ce) !== ceNorm(cur.ce);
function capRef(id) {
  const m = capIdx(); if (!m) return '';
  const hits = m.get(id); if (!hits || !hits.length) return '';
  const pq = D('pq'); const cur = pq && pq.items.find(x => x.id === id); const any = hits.some(({ i }) => capSusp(i, cur));
  return `<div class="callout small"><b>Аудит 2019:</b> ${hits.map(({ f, i }) => `вывод № ${f.n} (${esc(CAPP[f.priority] || f.priority)}, SARP ${esc(i.sarp)}, КЭ-${esc(i.ce)}) — ${esc(i.rec)} ${i.status ? badge(CAPSB[capSt(i)], CAPST[capSt(i)]) : ''}${capSusp(i, cur) ? ' ' + badge('missing', 'сверить номер') : ''}`).join('<br>')} <a href="#cap?s=${encodeURIComponent(id)}">→ ПКД</a>${any ? '<div class="dim">Номер ВП взят из протокола 2019; критический элемент не совпал с Поправкой 18 — проверьте, тот ли это вопрос.</div>' : ''}</div>`;
}
// карточка рекомендации ПКД: полный текст, статус EN, срок, переходы к ВП и к фильтрам
function openCapItem(i, f, idx) {
  if (idx == null) idx = f.items.indexOf(i);
  const pq = D('pq'); const cur = pq && pq.items.find(x => x.id === i.pq); const k = capSt(i); const st = i.status || {}; const ci = capItem(f, idx, i);
  openSheet(`<h3>Вывод № ${f.n} <span class="badge b-area">${f.area}</span> ${badge(CAPB[f.priority], CAPP[f.priority] || f.priority)} · ВП <span class="code">${esc(i.pq)}</span> ${st.st ? badge(CAPSB[k], CAPST[k]) : ''} ${badge(CAPPRB[ci.progress] === 'completed' ? 'ok' : CAPPRB[ci.progress] === 'inprogress' ? 'wip' : CAPPRB[ci.progress] === 'na' ? 'na' : 'none', CAPPR[ci.progress])}</h3>
    <p><b>${esc(i.rec)}</b></p>
    ${kv([['SARP', `<span class="mono">${esc(i.sarp)}</span> · КЭ-${esc(i.ce)} · приоритет: ${CAPP[i.prio] || esc(i.prio)}`], ['Замечания', esc(i.comment || '')], ['Корректирующее действие (ПКД 2020)', esc(i.action || '')], ['Организация', esc(i.org || '')],
      ['Сроки (ПКД 2020)', `${esc(i.start || '')}${i.end ? ' – ' + esc(i.end) : ''}`], ['Completion date (EN v2)', esc(st.endEn || '')], ['Исполнитель (EN v2)', esc(st.orgEn || '')],
      ['Срок (EN v2)', st.due ? `${daysTo(st.due) < 0 && k !== 'done' ? '<span class="warn">⚠ ' : '<span>'}${esc(fmtDate(st.due))}</span> <span class="dim small">предложение, подтвердить</span>` : '']])}
    ${st.en ? `<h4>Статус (EN, редакция v2.1)</h4><p class="small">${esc(st.en)}</p>` : ''}
    <h4>Corrective Action Item (формат ИКАО OLF)</h4>
    <p class="small dim">Колонки как в таблице Corrective Action Items в OLF. Значения по умолчанию взяты из ПКД и редакции EN v2.1; правки хранятся на этом устройстве и попадают в экспорт для сверки с OLF. <b>Импорт в OLF принимает только .docx, выданный самим OLF</b> — CSV годится для сверки, не для загрузки.</p>
    <form class="form" id="capForm">
      ${kv([['Step', String(ci.step)], ['Proposed Action', esc(ci.action || '—')]])}
      <label>Action Office<input class="inp" name="org" value="${esc(ci.org)}"></label>
      <label>Evidence Reference <span class="dim small">документ, пункт, дата — чем закрывается</span><textarea name="evref">${esc(ci.evref)}</textarea></label>
      <div class="two">
        <label>Est. Imp. Date<input type="date" name="est" value="${esc(ci.est)}"></label>
        <label>Rev. Imp. Date<input type="date" name="rev" value="${esc(ci.rev)}"></label>
      </div>
      <div class="two">
        <label>Date of Completion<input type="date" name="done" value="${esc(ci.done)}"></label>
        <label>Progress Status<select name="progress">${Object.entries(CAPPR).map(([kk, v]) => `<option value="${kk}"${ci.progress === kk ? ' selected' : ''}>${esc(t(v))}</option>`).join('')}</select></label>
      </div>
      <div class="two">
        <label>Progress, % <span class="dim small">колонка Progress в Excel OLF: «75% complete»</span><input class="inp" name="percent" inputmode="numeric" placeholder="напр. 75" value="${esc(ci.percent)}"></label>
      </div>
      <div class="row"><button class="btn" type="submit">${esc(t('Сохранить'))}</button><button class="btn ghost" type="button" id="capClear">Сбросить к данным ПКД</button><span class="dim small grow">${ci.saved ? 'изменено ' + esc(ci.at) : 'значения из ПКД'}</span></div>
    </form>${changeLog('cap', ci.key)}
    <div class="row mt">${cur ? `<button class="btn sm" data-go="pq?s=${encodeURIComponent(i.pq)}">К ВП ${esc(i.pq)}</button>` : `<span class="dim small">ВП ${esc(i.pq)} — номер прежней редакции протокола, в текущем перечне нет</span>`}
      <button class="btn sm ghost" data-go="cap?area=${esc(f.area)}">Выводы области ${esc(f.area)}</button>
      ${k !== 'done' && k !== 'na' ? '<button class="btn sm ghost" data-go="cap?st=open">Все незакрытые</button>' : ''}</div>`);
  $('#capForm').onsubmit = e => {
    e.preventDefault(); const fd = new FormData(e.target); const all = capItemState();
    const rec = { org: (fd.get('org') || '').trim(), evref: (fd.get('evref') || '').trim(), est: fd.get('est') || '', rev: fd.get('rev') || '', done: fd.get('done') || '', progress: fd.get('progress'), percent: (fd.get('percent') || '').trim(), at: today() };
    logChange('cap', ci.key, ci, rec, CAPLOGF());
    all[ci.key] = rec;
    LS.set(K.capi, all); toast('Сохранено: вывод ' + f.n + ', шаг ' + ci.step, 'ok'); closeSheet(); render();
  };
  $('#capClear').onclick = () => { const all = capItemState(); delete all[ci.key]; LS.set(K.capi, all); toast('Сброшено к данным ПКД'); closeSheet(); render(); };
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
  const exo = el('button', 'btn ghost sm', esc(t('ПКД — сверка с OLF (CSV)'))); exo.onclick = () => exportCapOLF(c); tb.appendChild(exo);
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
  m.appendChild(capByArea(c));
  const pq = D('pq');
  list.forEach(f => {
    // 50 раскрытых карточек с таблицами — 73 000 px на одной странице; теперь свёрнуты, раскрываются при фильтре, поиске или по клику
    const its = f.items.filter(itOk); const nd = its.filter(i => capSt(i) === 'done' || capSt(i) === 'na').length;
    const card = el('details', 'card'); if (list.length <= 5 || S.f.s || S.q || S.f.st) card.open = true;
    card.innerHTML = `<summary><h2>Вывод № ${f.n} <span class="badge b-area">${f.area}</span> ${badge(CAPB[f.priority], CAPP[f.priority] || f.priority)}</h2><span class="dim small">${its.length} ${esc(t('рекомендаций'))}${up ? ` · ${esc(t('выполнено'))} ${nd}` : ''}</span></summary>`;
    card.appendChild(table(['Приоритет', 'SARP', 'КЭ', 'ВП (2019)', 'Рекомендация ИКАО', 'Корректирующее действие (ПКД 2020)', 'Сроки', 'Статус'], f.items.filter(itOk),
      i => { const cur = pq && pq.items.find(x => x.id === i.pq); const k = capSt(i); return [badge(CAPB[i.prio], CAPP[i.prio] || i.prio), `<span class="mono">${esc(i.sarp)}</span>`, `<span class="badge b-ce">КЭ-${esc(i.ce)}</span>`,
        cur ? `<a href="#pq?s=${encodeURIComponent(i.pq)}" class="code">${esc(i.pq)}</a>` : `<span class="code dim" title="номер прежней редакции ВП">${esc(i.pq)}</span>`,
        `<div class="td-wrap small">${esc(i.rec)}</div>`, `<div class="td-wrap small">${esc(i.action)}${i.org ? `<div class="dim">${esc(i.org)}</div>` : ''}</div>`, `<span class="small">${esc(i.start)}${i.end ? ' – ' + esc(i.end) : ''}</span>${i.status && i.status.endEn ? `<div class="small dim" title="графа Completion date в редакции EN v2">EN v2: ${esc(i.status.endEn)}</div>` : ''}`,
        `${i.status ? badge(CAPSB[k], CAPST[k]) : ''}${(x => `<div class="small mt">${badge(CAPPRB[x.progress] === 'completed' ? 'ok' : CAPPRB[x.progress] === 'inprogress' ? 'wip' : CAPPRB[x.progress] === 'na' ? 'na' : 'none', CAPPR[x.progress])}${x.evref ? `<div class="dim" title="Evidence Reference">${esc(x.evref)}</div>` : ''}${x.done ? `<div class="dim">завершено ${esc(fmtDate(x.done))}</div>` : ''}</div>`)(capItem(f, f.items.indexOf(i), i))}${capDue(i)}${i.status && i.status.en ? `<details class="small"><summary class="dim">EN</summary><div class="td-wrap">${esc(i.status.en)}</div></details>` : ''}`]; }, i => openCapItem(i, f, f.items.indexOf(i))));
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
/* ---------- субъекты надзора АБ (этап 1 «прогнать АБ»): организации, объекты, программы безопасности ---------- */
// Статусы программ — как в целевой схеме БД (security_programme.status); null = статус ещё не внесён.
const PGST = { draft: 'Проект', submitted: 'Представлена', under_review: 'На рассмотрении', returned: 'Возвращена', approved: 'Согласована', expired: 'Истекла', withdrawn: 'Отозвана' };
const PGSB = { draft: 'draft', submitted: 'wip', under_review: 'wip', returned: 'unsat', approved: 'ok', expired: 'missing', withdrawn: 'na' };
const PSTL = { none: 'Статус не внесён', nosent: 'Не отправлены в ИКАО', has: 'Есть программы' };
const ORGK = { oversight: 'Субъект надзора', party: 'Участник (госорган)', tbd: 'Уточнить' };
const SITET = { terminal: 'Терминал', screening_checkpoint: 'Пункт досмотра', hold_baggage_screening: 'Досмотр багажа', sra_access_point: 'Точка доступа в охраняемую зону', perimeter_sector: 'Периметр', cargo_terminal: 'Грузовой терминал', catering_facility: 'Цех бортпитания', other: 'Прочее' };
const SUBJ = () => D('subjects');
const subjOrgs = () => (SUBJ() ? SUBJ().orgs : []);
const subjType = code => (SUBJ() && SUBJ().entity_types.find(x => x.code === code)) || { code, name_ru: code, oversight: true };
const subjProg = code => (SUBJ() && SUBJ().programme_types.find(x => x.code === code)) || { code, name_ru: code };
const orgName = o => o.name || o.name_en || o.code;
// роль организации: субъект надзора (обязан иметь программу) / участник НПАБГА (госорган) / позиция «уточнить» без наименования
const orgKind = o => o.tbd ? 'tbd' : subjType(o.entity_type).oversight ? 'oversight' : 'party';
const kindBadge = o => { const k = orgKind(o); return badge(k === 'tbd' ? 'tbd' : k === 'oversight' ? 'info' : 'none', ORGK[k]); };
const progBadge = st => badge(st ? PGSB[st] || 'none' : 'tbd', st ? PGST[st] || st : 'Статус не внесён');
// запрошенный ИКАО документ по id части (usap.requested[].parts[].items[].id) — статус отправки программы в ИКАО
function reqPart(id) { const u = U(); if (!u || !id) return null; for (const r of u.requested || []) for (const p of r.parts || []) for (const it of p.items || []) if (it.id === id) return { ...it, req: r }; return null; }
const progNotSent = p => { const r = reqPart(p.req); return !!r && !r.sent; };
function reqCell(p) {
  const r = reqPart(p.req); if (!r) return '<span class="dim">—</span>';
  return r.sent ? `${badge('ok', 'Отправлен')} <span class="small dim">${fmtDate(r.sent.date)}</span>`
    : `${badge('missing', 'Не отправлен')} <span class="small dim">${esc(t('запрос ИКАО, поз.'))} ${r.req.n}</span>`;
}
function openOrg(o) {
  const ty = subjType(o.entity_type);
  const areas = (o.areas || []).map(a => `<a href="#pq?area=${esc(a.code)}"><span class="badge b-area">${esc(a.code)}</span></a>`).join(' ');
  const codes = [o.iata && `IATA ${o.iata}`, o.icao_code && `ICAO ${o.icao_code}`].filter(Boolean).join(' · ');
  const progs = o.programmes || [];
  const dates = p => [p.approved_on && `${t('согласована')} ${fmtDate(p.approved_on)}`, p.valid_until && `${t('до')} ${fmtDate(p.valid_until)}`].filter(Boolean).join(' · ') || '—';
  const pt = progs.length ? table(['Программа', 'Версия', 'Статус', 'Сроки', 'Запрос ИКАО'], progs,
    p => [`<b>${esc(p.programme_type)}</b> <span class="small dim">${esc(subjProg(p.programme_type).name_ru)}</span>${p.note ? `<div class="small">${esc(p.note)}</div>` : ''}`,
      esc(p.version || '—') + (p.lang ? ` <span class="small dim">${esc(p.lang)}</span>` : ''), progBadge(p.status), dates(p), reqCell(p)]).outerHTML
    : `<p class="dim small">${esc(t('Программы не внесены'))}</p>`;
  const sites = o.sites || [];
  const stt = sites.length ? table(['Код', 'Объект', 'Тип', 'Области'], sites,
    x => [idChip(`S:${o.code}/${x.code}`), esc(x.name) + (x.note ? ` <span class="small dim">${esc(x.note)}</span>` : ''), esc(t(SITET[x.site_type] || x.site_type)),
      (x.areas || []).map(a => `<span class="badge b-area">${esc(a)}</span>`).join(' ')]).outerHTML : '';
  const plan5 = (o.areas || []).filter(a => a.text).map(a => `<li><span class="badge b-area">${esc(a.code)}</span> ${esc(a.text)}</li>`).join('');
  openSheet(`<div class="sheet-head"><div class="small dim">${idChip('S:' + o.code)} ${kindBadge(o)}</div><h2>${esc(orgName(o))}</h2></div>
    ${kv([['Тип', `${esc(ty.name_ru)}${ty.ncasp ? ` <span class="small dim">НПАБГА ${esc(ty.ncasp)}</span>` : ''}`], ['Наименование (EN)', esc(o.name_en || '')], ['Коды', esc(codes)], ['Город', esc(o.city || '')],
      ['Международные рейсы', o.intl_ops == null ? '' : esc(t(o.intl_ops ? 'Да' : 'Нет'))], ['Области проверки', areas], ['Уточнить', o.tbd ? `<span class="warn">${esc(o.tbd)}</span>` : '']])}
    ${plan5 ? `<h3 class="mt">${esc(t('В разделе 5 плана аудита'))}</h3><ul class="list small">${plan5}</ul>` : ''}
    <h3 class="mt">${esc(t('Программы безопасности'))} <span class="dim small">${progs.length}</span></h3>${pt}
    ${sites.length ? `<h3 class="mt">${esc(t('Объекты'))} <span class="dim small">${sites.length}</span></h3>${stt}` : ''}
    ${o.note ? `<p class="small mt">${esc(o.note)}</p>` : ''}`);
}
function pSubjects(m) {
  const d = SUBJ(); if (!d) return m.appendChild(el('div', 'empty', 'Данные субъектов не загружены'));
  const orgs = d.orgs;
  head(m, 'Субъекты надзора', `${esc(d.meta.title)} · ${orgs.length} ${esc(t('организаций'))} · ${esc(t('основание'))}: ${esc(d.meta.basis)}`);
  const progs = orgs.flatMap(o => (o.programmes || []).map(p => ({ o, p })));
  const nOv = orgs.filter(o => orgKind(o) === 'oversight').length, nTbd = orgs.filter(o => o.tbd).length;
  const noSt = progs.filter(x => !x.p.status).length, noSent = progs.filter(x => progNotSent(x.p)).length;
  const tiles = el('div', 'tiles');
  tiles.appendChild(tile('info', nOv, `субъектов надзора (из ${orgs.length})`, () => go('subjects', { kind: 'oversight' })));
  tiles.appendChild(tile(nTbd ? 'draft' : 'ok', nTbd, 'уточнить наименование', () => go('subjects', { kind: 'tbd' })));
  tiles.appendChild(tile(noSt ? 'draft' : 'ok', noSt, `программ без статуса (из ${progs.length})`, () => go('subjects', { pst: 'none' })));
  tiles.appendChild(tile(noSent ? 'miss' : 'ok', noSent, 'программ не отправлено в ИКАО', () => go('subjects', { pst: 'nosent' })));
  m.appendChild(tiles);
  const tb = el('div', 'toolbar');
  tb.appendChild(selector('Все типы', 'type', d.entity_types.map(x => x.code), c => subjType(c).name_ru));
  const areas = D('pq') ? D('pq').meta.areas.map(a => a.code) : [...new Set(orgs.flatMap(o => o.areas.map(a => a.code)))];
  tb.appendChild(selector('Все области', 'area', areas));
  tb.appendChild(selector('Все роли', 'kind', Object.keys(ORGK), k => ORGK[k]));
  tb.appendChild(selector('Все программы', 'pst', Object.keys(PSTL), v => PSTL[v]));
  m.appendChild(tb);
  const byPst = o => { const ps = o.programmes || []; return S.f.pst === 'has' ? ps.length : S.f.pst === 'none' ? ps.some(p => !p.status) : ps.some(progNotSent); };
  const rows = orgs.filter(o => (!S.f.type || o.entity_type === S.f.type) && (!S.f.area || o.areas.some(a => a.code === S.f.area))
    && (!S.f.kind || orgKind(o) === S.f.kind) && (!S.f.pst || byPst(o)) && has(S.q, o.code, o.name, o.name_en, o.short_name, o.tbd));
  m.appendChild(el('p', 'small dim', `${rows.length} ${esc(t('из'))} ${orgs.length}`));
  m.appendChild(table(['Код', 'Организация', 'Тип', 'Области', 'Программы', 'Роль'], rows,
    o => [`<span class="code">${esc(o.code)}</span>`, `<b>${esc(orgName(o))}</b>${o.tbd ? `<div class="small warn">${esc(o.tbd)}</div>` : ''}`, esc(subjType(o.entity_type).name_ru),
      o.areas.map(a => `<span class="badge b-area">${esc(a.code)}</span>`).join(' '),
      (o.programmes || []).map(p => `<span class="badge b-${p.status ? PGSB[p.status] || 'none' : 'tbd'}" title="${esc(subjProg(p.programme_type).name_ru)}">${esc(p.programme_type)}</span>`).join(' ') || '<span class="dim">—</span>',
      kindBadge(o)], openOrg));
  const c = el('div', 'card mt'); c.innerHTML = `<h2>${esc(t('Типы субъектов по НПАБГА'))}</h2><p class="small dim">${esc(d.meta.note || '')}</p>`;
  c.appendChild(table(['Тип', 'НПАБГА', 'Программа', 'Организаций'], d.entity_types,
    x => [esc(x.name_ru) + (x.note ? ` <div class="small dim">${esc(x.note)}</div>` : ''), esc(x.ncasp || ''),
      x.programme ? `<b>${esc(x.programme)}</b> <span class="small dim">${esc(subjProg(x.programme).name_ru)}</span>` : '<span class="dim">—</span>',
      orgs.filter(o => o.entity_type === x.code).length], x => go('subjects', { type: x.code })));
  m.appendChild(c);
}

/* ---------- контроль качества АБ (этап 2 «прогнать АБ»): основа, план, мероприятия, находки, CAP субъектов ---------- */
const QCTABS = [{ id: 'ref', t: 'Основа' }, { id: 'plan', t: 'План' }, { id: 'acts', t: 'Мероприятия' }, { id: 'findings', t: 'Находки' }];
// статусы — как в целевой схеме БД (oversight_activity.status, finding.status)
const ACTST = { planned: 'Запланировано', in_progress: 'Идёт', report_draft: 'Акт готовится', report_issued: 'Акт выдан', closed: 'Закрыто', cancelled: 'Отменено' };
const ACTSB = { planned: 'none', in_progress: 'wip', report_draft: 'wip', report_issued: 'info', closed: 'ok', cancelled: 'na' };
const FST = { open: 'Открыта', cap_submitted: 'ПКД подан', cap_accepted: 'ПКД принят', cap_rejected: 'ПКД отклонён', implemented: 'Выполнено', closed: 'Закрыта', escalated: 'Эскалация', cancelled: 'Снята' };
const FSB = { open: 'missing', cap_submitted: 'wip', cap_accepted: 'wip', cap_rejected: 'unsat', implemented: 'ready', closed: 'ok', escalated: 'unsat', cancelled: 'na' };
const SEVB = { critical: 'unsat', major: 'missing', minor: 'draft', compliant: 'ok', na: 'na', nc: 'tbd' };
const PLST = { planned: 'none', done: 'ok', postponed: 'draft', cancelled: 'na' };
const QC = () => D('qc');
const qcType = c => (QC() && QC().activity_types.find(x => x.code === c)) || { code: c, name_ru: c };
const qcSev = c => (QC() && QC().severity.find(x => x.code === c)) || { code: c, name_ru: c, level: '?' };
const orgChip = code => { const o = subjOrgs().find(x => x.code === code); return o ? `<button class="idc clk" data-openorg="${esc(code)}" title="${esc(orgName(o))}">S:${esc(code)}</button>` : esc(code || '—'); };
const sevBadge = c => { const x = qcSev(c); return `<span class="badge b-${SEVB[c] || 'none'}" title="${esc(x.name_ru)}">${esc(x.level)} · ${esc(t(c === 'critical' ? 'критическое' : c === 'major' ? 'существенное' : c === 'minor' ? 'незначительное' : x.name_ru))}</span>`; };
function openActivity(a) {
  const d = QC(); const fs = (d.findings || []).filter(f => f.activity === a.ref_no);
  openSheet(`<div class="sheet-head"><div class="small dim">${idChip(a.ref_no)} ${badge(ACTSB[a.status] || 'none', ACTST[a.status] || a.status)}</div><h2>${esc(qcType(a.activity_type).name_ru)}</h2></div>
    ${kv([['Субъект', orgChip(a.org)], ['Объект', a.site ? idChip(`S:${a.org}/${a.site}`) : ''], ['Сроки', `${fmtDate(a.start_on)}${a.end_on ? ' – ' + fmtDate(a.end_on) : ''}`], ['Форма', a.is_covert ? t('негласное') : a.is_unannounced ? t('без уведомления') : ''], ['Руководитель', esc(a.lead || '')], ['Акт / отчёт', a.report_issued_on ? `${esc(a.report_no || '')} ${t('от')} ${fmtDate(a.report_issued_on)}` : ''], ['Итог', esc(a.summary || '')]])}
    <h3 class="mt">${esc(t('Находки'))} <span class="dim small">${fs.length}</span></h3>
    ${fs.length ? table(['Находка', 'Требование', 'Тяжесть', 'Статус', 'Срок'], fs, f => [`<button class="idc clk" data-openfinding="${esc(f.ref_no)}">${esc(f.ref_no)}</button>`, idChip(f.requirement), sevBadge(f.severity), badge(FSB[f.status] || 'none', FST[f.status] || f.status), fmtDate(f.close_due_on) || '—']).outerHTML : `<p class="dim small">${esc(t('Находок не внесено'))}</p>`}`);
}
function openFinding(f) {
  const d = QC(); const a = (d.activities || []).find(x => x.ref_no === f.activity);
  const X = xref(); const node = X && X.byKey.get(f.requirement);
  const cc = node && node.cc; const pqs = node ? node.pqs || [] : [];
  const caps = f.caps || [];
  openSheet(`<div class="sheet-head"><div class="small dim">${idChip(f.ref_no)} ${sevBadge(f.severity)} ${badge(FSB[f.status] || 'none', FST[f.status] || f.status)}${f.repeat_of ? ` ${badge('unsat', 'повторная')}` : ''}</div><h2>${esc(f.description || '')}</h2></div>
    ${kv([['Субъект', orgChip(f.org)], ['Мероприятие', a ? `<button class="idc clk" data-openactivity="${esc(a.ref_no)}">${esc(a.ref_no)}</button> ${esc(qcType(a.activity_type).name_ru)}` : esc(f.activity || '')], ['Выявлена', fmtDate(f.identified_on)], ['Срок ПКД', f.cap_due_on ? fmtDate(f.cap_due_on) : ''], ['Срок устранения', f.close_due_on ? fmtDate(f.close_due_on) : ''], ['Причина', esc(f.root_cause || '')], ['Закрыта', f.closed_on ? fmtDate(f.closed_on) : '']])}
    <h4 class="mt">${esc(t('Трассировка'))}</h4>
    ${kv([['Требование', `${idChip(f.requirement)}${f.national_ref ? ` <span class="small">${esc(f.national_ref)}</span>` : ''}`], ['Пункт CC', cc ? `<button class="idc clk" data-opencc="${esc(f.requirement.replace(/^A/, ''))}">${esc(cc.id)}</button> ${esc(cc.ref || '')}` : ''], ['ВП по пункту', pqs.map(p => `<button class="idc clk" data-openpq="${esc(p.id)}">PQ:${esc(p.id)}</button>`).join(' ')]])}
    <h3 class="mt">${esc(t('План корректирующих действий'))} <span class="dim small">${caps.length}</span></h3>
    ${caps.length ? table(['Ред.', 'Подан', 'Причина', 'Действия', 'Ответственный', 'Срок', 'Статус'], caps, c => [c.revision || 1, fmtDate(c.submitted_on), esc(c.root_cause || ''), `<div class="small">${(c.actions || []).map(x => `• ${esc(x.action)} — ${fmtDate(x.due_on)}${x.completed_on ? ' ✓' : ''}`).join('<br>')}</div>`, esc(c.responsible || ''), fmtDate(c.target_date), badge(c.status === 'accepted' ? 'ok' : c.status === 'rejected' ? 'unsat' : c.status === 'superseded' ? 'na' : 'wip', c.status === 'accepted' ? 'Принят' : c.status === 'rejected' ? 'Отклонён' : c.status === 'superseded' ? 'Заменён' : 'Подан')]).outerHTML : `<p class="dim small">${esc(t('ПКД не внесён'))}${(QC().cap_rules || {}).submit_days ? ` · ${esc(t('срок подачи'))} ${QC().cap_rules.submit_days} ${esc(t('календарных дней после акта'))}` : ''}</p>`}`);
}
function pQC(m) {
  const d = QC(); if (!d) return m.appendChild(el('div', 'empty', 'Данные контроля качества не загружены'));
  head(m, 'Контроль качества АБ', `${esc(d.meta.title)} · ${esc(t('основание'))}: ${esc((d.meta.basis || [])[0] || '')}`);
  const tab = QCTABS.some(x => x.id === S.f.t) ? S.f.t : 'ref';
  const items = (d.plan || {}).items || [], acts = d.activities || [], fs = d.findings || [];
  m.appendChild(segbar(QCTABS.map(x => ({ ...x, n: x.id === 'plan' ? items.length : x.id === 'acts' ? acts.length : x.id === 'findings' ? fs.length : null })), tab, id => go('qc', { ...S.f, t: id === 'ref' ? '' : id }, S.q)));
  if (tab === 'ref') {
    const c1 = el('div', 'card'); c1.innerHTML = `<h2>${esc(t('Виды мероприятий'))}</h2>`;
    c1.appendChild(table(['Вид', 'Основание', 'Уведомление', 'Акт / отчёт', 'Что проверяется'], d.activity_types, x => [`<b>${esc(x.name_ru)}</b>${x.classification ? ` ${badge('unsat', 'конфиденциально')}` : ''}<div class="small dim">${esc(x.name_en || '')}</div>`, `<span class="small">${esc(x.basis)}</span>`, `<span class="small">${esc(x.notice || '')}</span>`, `<span class="small">${esc(x.report || '')}</span>`, `<span class="small">${esc(x.scope || '')}</span>`]));
    m.appendChild(c1);
    const g = el('div', 'grid2');
    const c2 = el('div', 'card'); c2.innerHTML = `<h2>${esc(t('Уровни несоответствия'))} <span class="dim small">Правила КК п. 113</span></h2>`;
    c2.appendChild(table(['Уровень', 'Описание', 'Действие'], d.severity, x => [sevBadge(x.code), `<span class="small">${esc(x.name_ru)}</span>`, `<span class="small">${esc(x.action)}</span>`]));
    c2.innerHTML += `<h3 class="mt">${esc(t('Сроки устранения по Программе КК'))}</h3>`;
    c2.appendChild(table(['Уровень', 'Срок', 'Основание'], d.levels_abc, x => [`<b>${esc(x.code)}</b> <span class="small">${esc(x.name_ru)}</span>`, x.deadline_days ? `${x.deadline_days} ${t('дн.')}` : esc(x.deadline || ''), `<span class="small dim">${esc(x.basis)}</span>`]));
    g.appendChild(c2);
    const c3 = el('div', 'card'); c3.innerHTML = `<h2>${esc(t('Категории риска и периодичность'))}</h2><p class="small dim">${esc(d.risk_basis || '')}</p>`;
    c3.appendChild(table(['Категория', 'Одна проверка в', 'Сертификат не более'], d.risk_categories, x => [esc(x.name_ru), `${x.period_months} ${t('мес.')}`, `${x.cert_months} ${t('мес.')}`]));
    const r = d.cap_rules || {};
    c3.innerHTML += `<h3 class="mt">${esc(t('План корректирующих действий субъекта'))}</h3>` + kv([['Подача', `${r.submit_days} ${esc(r.submit_basis || '')}`], ['Содержание', `<ul class="list small">${(r.contents || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul><span class="small dim">${esc(r.contents_basis || '')}</span>`], ['Утверждение', esc(r.approval || '')], ['Рассмотрение', esc(r.review || '')], ['Закрытие', esc(r.closure || '')]]);
    g.appendChild(c3); m.appendChild(g);
    if ((d.meta.issues || []).length) { const w = el('div', 'card'); w.innerHTML = `<h2>${esc(t('Требует решения'))} <span class="dim small">${d.meta.issues.length}</span></h2><ul class="list">${d.meta.issues.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`; m.appendChild(w); }
    m.appendChild(el('p', 'small dim', esc(d.meta.note || '')));
  }
  if (tab === 'plan') {
    const p = d.plan || {};
    const c = el('div', 'card'); c.innerHTML = `<h2>${esc(t('План контроля качества'))} ${p.year || ''} <span class="dim small">${esc(p.version || '')} · ${badge(p.status === 'approved' ? 'ok' : p.status === 'closed' ? 'na' : 'draft', p.status === 'approved' ? 'Утверждён' : p.status === 'closed' ? 'Закрыт' : 'Проект')}${p.approved_on ? ' · ' + fmtDate(p.approved_on) : ''}</span></h2><p class="small dim">${esc(p.basis || '')}</p><p class="small">${esc(p.note || '')}</p>`;
    c.appendChild(table(['№', 'Субъект', 'Мероприятие', 'Месяц', 'Категория риска', 'Статус', 'Факт'], items, x => [esc(x.id), orgChip(x.org), esc(qcType(x.activity_type).name_ru), x.planned_month, esc((d.risk_categories.find(r => r.code === x.risk_category) || {}).name_ru || x.risk_category || '—'), badge(PLST[x.status] || 'none', x.status === 'done' ? 'Выполнено' : x.status === 'postponed' ? 'Перенесено' : x.status === 'cancelled' ? 'Отменено' : 'Запланировано'), x.activity ? `<button class="idc clk" data-openactivity="${esc(x.activity)}">${esc(x.activity)}</button>` : '—'], null, { empty: 'Позиции плана не внесены — источник: график КК, направленный ИКАО 23.09.2026' }));
    m.appendChild(c);
  }
  if (tab === 'acts') {
    const tb = el('div', 'toolbar');
    tb.appendChild(selector('Все виды', 'type', d.activity_types.map(x => x.code), c => qcType(c).name_ru));
    tb.appendChild(selector('Все субъекты', 'org', [...new Set(acts.map(a => a.org))], c => { const o = subjOrgs().find(x => x.code === c); return o ? orgName(o) : c; }));
    tb.appendChild(selector('Все статусы', 'st', Object.keys(ACTST), k => ACTST[k]));
    m.appendChild(tb);
    const rows = acts.filter(a => (!S.f.type || a.activity_type === S.f.type) && (!S.f.org || a.org === S.f.org) && (!S.f.st || a.status === S.f.st) && has(S.q, a.ref_no, a.org, a.summary, a.lead));
    m.appendChild(table(['Ключ', 'Мероприятие', 'Субъект', 'Сроки', 'Статус', 'Находок'], rows, a => [`<span class="code">${esc(a.ref_no)}</span>`, `${esc(qcType(a.activity_type).name_ru)}${a.is_covert ? ` ${badge('unsat', 'негласно')}` : ''}`, orgChip(a.org), `${fmtDate(a.start_on)}${a.end_on ? ' – ' + fmtDate(a.end_on) : ''}`, badge(ACTSB[a.status] || 'none', ACTST[a.status] || a.status), fs.filter(f => f.activity === a.ref_no).length || '—'], openActivity, { empty: 'Мероприятия не внесены — источник: акты проверок, инспекций и испытаний 2025–2026' }));
  }
  if (tab === 'findings') {
    const tb = el('div', 'toolbar');
    tb.appendChild(selector('Все субъекты', 'org', [...new Set(fs.map(f => f.org))], c => { const o = subjOrgs().find(x => x.code === c); return o ? orgName(o) : c; }));
    tb.appendChild(selector('Все уровни', 'sev', d.severity.map(x => x.code), c => `${qcSev(c).level} — ${qcSev(c).name_ru.slice(0, 40)}`));
    tb.appendChild(selector('Все статусы', 'st', Object.keys(FST), k => FST[k]));
    m.appendChild(tb);
    const rows = fs.filter(f => (!S.f.org || f.org === S.f.org) && (!S.f.sev || f.severity === S.f.sev) && (!S.f.st || f.status === S.f.st) && has(S.q, f.ref_no, f.description, f.requirement, f.org));
    const over = rows.filter(f => f.close_due_on && !['closed', 'cancelled'].includes(f.status) && daysTo(f.close_due_on) < 0).length;
    m.appendChild(el('p', 'small dim', `${rows.length} ${esc(t('из'))} ${fs.length}${over ? ` · <span class="warn">${esc(t('просрочено'))}: ${over}</span>` : ''}`));
    m.appendChild(table(['Ключ', 'Субъект', 'Несоответствие', 'Требование', 'Уровень', 'Статус', 'Срок устранения'], rows, f => [`<span class="code">${esc(f.ref_no)}</span>`, orgChip(f.org), `<div class="td-wrap clamp" title="${esc(f.description || '')}">${esc(f.description || '')}</div>`, idChip(f.requirement), sevBadge(f.severity), badge(FSB[f.status] || 'none', FST[f.status] || f.status), f.close_due_on ? `<span class="${!['closed', 'cancelled'].includes(f.status) && daysTo(f.close_due_on) < 0 ? 'warn' : ''}">${fmtDate(f.close_due_on)}</span>` : '—'], openFinding, { empty: 'Находки не внесены — источник: акты проверок 2025–2026; каждая находка со ссылкой на требование (A17:… или R..:…)' }));
  }
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
    i => [`<span class="code">${esc(i.code)}</span>`, `<b>${esc(i.title)}</b>`, esc(i.ncasp), badge(i.bucket, i.status), `<a href="${esc(i.folder)}" target="_blank" rel="noopener">Drive ↗</a>`],
    i => openSheet(`<h3><span class="code">${esc(i.code)}</span> ${badge(i.bucket, i.status)}</h3><p><b>${esc(i.title)}</b></p>${kv([['Раздел / § НПАБГА РТ', esc(i.ncasp || '')], ['Статус', esc(i.status || '')]])}<div class="row mt"><button class="btn sm" data-open="${esc(i.folder)}">Папка Drive ↗</button><button class="btn sm ghost" data-go="matrix">Матрица ИКАО</button></div>`)));
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
    m.appendChild(table(['Документ', 'Тема', 'Реквизиты', 'Файл / источник'], c.docs, x => [`<b>${esc(x.title)}</b>`, esc(x.topic), esc(x.ref), [x.local && `<a href="${esc(x.local)}" target="_blank" rel="noopener">в папке ↗</a>`, x.local2 && `<a href="${esc(x.local2)}" target="_blank" rel="noopener">PDF ↗</a>`, x.src && `<span class="small dim">${esc(x.src)}</span>`].filter(Boolean).join(' · ')],
      x => openSheet(`<h3>${esc(x.title)}</h3>${kv([['Страна / регулятор', `${esc(c.name)} — ${esc(c.regulator)}`], ['Тема', esc(x.topic || '')], ['Реквизиты', esc(x.ref || '')], ['Источник', esc(x.src || '')]])}<div class="row mt">${x.local ? `<button class="btn sm" data-open="${esc(x.local)}">В папке ↗</button>` : ''}${x.local2 ? `<button class="btn sm ghost" data-open="${esc(x.local2)}">PDF ↗</button>` : ''}<button class="btn sm ghost" data-open="${esc(c.folder)}">Папка страны ↗</button></div>`)));
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
  paged(m, list, part => m.appendChild(table(['№', 'Русский', 'Тоҷикӣ', 'English'], part, x => [x.n, esc(x.ru), esc(x.tj || '—'), esc(x.en || '—')], null, { groupKey: S.f.s ? null : (x => x.sec) })));
  if (!S.f.s) { m.appendChild(el('h2', 'mt', 'Сокращения (фиксированные соответствия RU → EN)')); m.appendChild(table(['RU', 'EN'], d.abbr, a => [`<b>${esc(a.ru)}</b>`, esc(a.en)])); m.appendChild(el('div', 'card', `<h2>Правила перевода</h2><ul class="list">${d.meta.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`)); }
}

/* ---------- Данные и резервная копия ---------- */
function pData(m) {
  head(m, 'Данные и резервная копия', 'Самооценка (ВП, CC, SASAQ, дорожная карта, настройки) хранится в браузере этого устройства. Перед сменой устройства или чисткой браузера — выгрузите копию.');
  // в полях — только сохранённые переопределения: иначе «Сохранить» без правок заморозило бы текущие данные портала
  const s = settings(); const so = LS.get(K.set, {});
  const c = el('div', 'card', `<h2>${esc(t('Настройки'))}</h2><p class="small dim">Дата аудита и NCMC берутся из данных портала; здесь их можно переопределить на этом устройстве — пустое поле возвращает значение из данных.</p><form class="form" id="setForm"><div class="two"><label>Дата аудита на месте<input type="date" name="auditDate" value="${esc(so.auditDate || '')}"><span class="small dim">Из данных: ${s.auditDate ? fmtDate(s.auditDate) : '—'}</span></label><label>Национальный координатор (NCMC)<input name="ncmc" value="${esc(so.ncmc || '')}" placeholder="${esc(s.ncmc || 'Ф.И.О., должность')}"><span class="small dim">Из данных: ${esc(s.ncmc || '—')}</span></label></div><div class="row"><button class="btn" type="submit">${esc(t('Сохранить'))}</button></div></form>`);
  m.appendChild(c);
  $('#setForm').onsubmit = e => { e.preventDefault(); const fd = new FormData(e.target); LS.set(K.set, { auditDate: fd.get('auditDate'), ncmc: fd.get('ncmc').trim() }); toast('Настройки сохранены', 'ok'); render(); };
  const st = pqState(), cs = ccState(), ss = sasaqState(), ps = planState();
  const b = el('div', 'card', `<h2>Резервная копия</h2><div class="kv"><div>ВП с самооценкой</div><div>${Object.keys(st).length}</div><div>CC — ручные статусы</div><div>${Object.keys(cs).length}</div><div>SASAQ — отметки</div><div>${Object.keys(ss).length}</div><div>Дорожная карта</div><div>${Object.keys(ps).length}</div><div>Ответственные по областям</div><div>${Object.keys(areaResp()).length}</div><div>Аудит 2026 — чек-листы</div><div>${Object.keys(auditState().docs).length + Object.keys(auditState().log).length}</div></div>
    <div class="row mt"><button class="btn" id="bkExp">⬇ Выгрузить JSON</button><label class="btn ghost" style="cursor:pointer">⬆ Загрузить JSON<input type="file" id="bkImp" accept="application/json" hidden></label><button class="btn danger" id="bkClear">Очистить самооценку</button></div>
    <p class="small dim mt">Файл резервной копии можно положить в папку проекта Avsec (Drive) — тогда самооценку можно поднять на другом устройстве или передать коллеге.</p>`);
  m.appendChild(b);
  $('#bkExp').onclick = () => { const out = { app: 'avsec-portal', version: APP_VERSION, at: new Date().toISOString() }; STATE_KEYS.forEach(k => { out[k] = LS.get(k, null); }); download(JSON.stringify(out, null, 1), `AvSec_backup_${today()}.json`, 'application/json'); };
  $('#bkImp').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const j = JSON.parse(await f.text()); if (j.app !== 'avsec-portal') throw new Error('Это не резервная копия AvSec Portal'); if (!confirm('Заменить самооценку на этом устройстве данными из файла?')) return; STATE_KEYS.forEach(k => { if (j[k]) LS.set(k, j[k]); }); toast('Копия загружена', 'ok'); render(); } catch (ex) { toast(ex.message, 'err'); } };
  $('#bkClear').onclick = () => { if (confirm('Удалить всю самооценку на этом устройстве? Данные портала (ВП, CC, реестр) не пострадают.')) { [K.pq, K.cc, K.sasaq, K.plan, K.arearesp, K.audit, K.capi, K.log].forEach(k => LS.del(k)); toast('Очищено'); render(); } };
  m.appendChild(el('div', 'card', `<h2>Источник данных</h2><div class="kv"><div>Сборка данных</div><div>${esc(S.cfg.built || '—')}</div><div>Файлы</div><div class="small">${(S.cfg.files || []).map(esc).join(', ')}</div><div>Режим</div><div>${S.cfg.plain ? 'открытые data/*.json (локальная разработка)' : 'шифрованные data-enc/*.enc, ключ из кода доступа'}</div></div>`));
}

/* ---------- О портале ---------- */
function pAbout(m) {
  head(m, 'О портале', 'AvSec Portal v' + APP_VERSION);
  m.appendChild(el('p', 'small dim', 'Номер версии виден в шапке (на телефоне справа от поиска) и внизу меню. Если после обновления на телефоне или в Telegram номер другой — закройте и снова откройте мини-апп: при смене сборки портал перезагружается сам.'));
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
  if (cap) group('Выводы аудита 2019 (CAP)', cap.findings.filter(f => f.items.some(i => has(q, i.sarp, i.pq, i.rec, i.action, i.status && i.status.en))), f => `${badge(CAPB[f.priority], CAPP[f.priority] || f.priority)} <span class="badge b-area">${f.area}</span> Вывод № ${f.n}: ${esc(f.items.map(i => i.rec).join(' · ').slice(0, 220))}`, f => go('cap', { area: f.area }, q));
  const sj = D('subjects'); if (sj) group('Субъекты надзора', sj.orgs.filter(o => has(q, o.code, o.name, o.name_en, o.short_name, o.tbd, (o.programmes || []).map(p => p.programme_type).join(' '))), o => `<span class="code">${esc(o.code)}</span> <b>${esc(orgName(o))}</b> <span class="dim small">${esc(subjType(o.entity_type).name_ru)}</span>${o.tbd ? ` <span class="warn small">${esc(o.tbd)}</span>` : ''}`, openOrg);
  const qd = D('qc'); if (qd) { group('Контроль качества — мероприятия', qd.activities.filter(a => has(q, a.ref_no, a.org, a.summary)), a => `<span class="code">${esc(a.ref_no)}</span> ${esc(qcType(a.activity_type).name_ru)} · ${esc(a.org)}`, openActivity); group('Контроль качества — находки', qd.findings.filter(f => has(q, f.ref_no, f.description, f.requirement, f.org)), f => `<span class="code">${esc(f.ref_no)}</span> ${esc((f.description || '').slice(0, 160))} ${idChip(f.requirement)}`, openFinding); }
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
  tgInit();   // Telegram Web держит мини-апп на заглушке, пока страница не скажет ready() — первым делом, до любых await
  $$('.appver').forEach(e => { e.textContent = 'v' + APP_VERSION; });   // номер версии в шапке и в «О портале»
  const mq = matchMedia('(max-width:640px)'); const setPh = () => { $('#q').placeholder = mq.matches ? 'Поиск' : 'Поиск: ВП, стандарт, документ, термин…'; }; setPh(); mq.addEventListener('change', setPh);
  $('#who').title = 'Выйти из портала на этом устройстве';
  applyTheme(); applyLang(); initGate();
  $('#themeBtn').onclick = () => { LS.set(K.theme, document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); applyTheme(); };
  $$('#lang button').forEach(b => b.onclick = () => { S.lang = (mq.matches && b.classList.contains('on')) ? (S.lang === 'ru' ? 'en' : 'ru') : b.dataset.l; LS.set(K.lang, S.lang); applyLang(); if (S.cfg) { buildNav(); render(); } });
  $('#burger').onclick = () => $('#side').classList.toggle('open');
  document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet();
    const gto = e.target.closest('[data-go]'); if (gto) { closeSheet(); location.hash = gto.dataset.go; return; }   // кнопки перехода в карточках
    // переходы по трассировке внутри карточки: ВП ↔ пункт CC (лист перерисовывается, раздел не меняется)
    const oact = e.target.closest('[data-openactivity]'); if (oact) { const it = QC() && QC().activities.find(x => x.ref_no === oact.dataset.openactivity); if (it) openActivity(it); return; }
    const ofin = e.target.closest('[data-openfinding]'); if (ofin) { const it = QC() && QC().findings.find(x => x.ref_no === ofin.dataset.openfinding); if (it) openFinding(it); return; }
    const oorg = e.target.closest('[data-openorg]'); if (oorg) { const it = subjOrgs().find(x => x.code === oorg.dataset.openorg); if (it) openOrg(it); return; }
    const opq = e.target.closest('[data-openpq]'); if (opq) { const it = D('pq') && D('pq').items.find(x => x.id === opq.dataset.openpq); if (it) openPQ(it); return; }
    const occ = e.target.closest('[data-opencc]'); if (occ) { const [a, id] = occ.dataset.opencc.split(':'); const it = D('cc') && D('cc').items.find(x => String(x.annex) === a && x.id === id); if (it) openCC(it); return; }
    const opn = e.target.closest('[data-open]'); if (opn) { window.open(opn.dataset.open, '_blank', 'noopener'); return; } if (!e.target.closest('#side') && !e.target.closest('#burger')) $('#side').classList.remove('open'); const nh = e.target.closest('.navh'); if (nh) nh.parentElement.classList.toggle('open'); });
  // Esc — закрыть шторку; «/» — курсор в поиск, если не печатаем в поле
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); if (e.key === '/' && !/^(input|textarea|select)$/i.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); $('#q').focus(); } });
  $('#qclear').onclick = () => { $('#q').value = ''; if (S.page === 'find') go('dash'); };
  let tm; $('#q').oninput = () => { clearTimeout(tm); tm = setTimeout(() => { const v = $('#q').value.trim(); if (v.length >= 2) go('find', {}, v); }, 300); };
  $('#q').onkeydown = e => { if (e.key === 'Enter') { const v = $('#q').value.trim(); if (v) go('find', {}, v); } };
  window.addEventListener('hashchange', route);
  if ('serviceWorker' in navigator) {
    // новая версия SW активируется (skipWaiting+claim) — один раз перезагружаем страницу, чтобы не сидеть на старой оболочке (телефон/Telegram)
    const hadController = !!navigator.serviceWorker.controller; let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloading) { reloading = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js').then(r => { try { r.update(); } catch (e) {} }).catch(() => {});
  }
  try { S.cfg = await (await fetch('data/config.json', { cache: 'no-cache' })).json(); }
  catch (e) { $('#main').innerHTML = '<div class="empty">Не найден data/config.json. Портал нужно открыть через http(s)-сервер (node tools/serve.mjs), а не как файл.</div>'; return; }
  if (S.cfg.plain) { await enter(); return; }
  const saved = LS.get(K.key, '');
  if (saved && cryptoReady()) { try { const raw = unhex(saved); if (await keyOk(raw)) { S.key = raw; await enter(); return; } } catch (e) {} LS.del(K.key); }
  $('#main').innerHTML = ''; showGate(true);
}
boot();
