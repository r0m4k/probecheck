/* In-page flow: pick a paper -> step 2 becomes current -> four component cards
   are analyzed one after another; each item can show its evidence in the paper. Findings come from audit-data.js (pre-saved);
   the gradual reveal only replays them. */

const ICONS = {
  model: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx=".8"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  data: '<ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6"/><path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6"/>',
  extraction: '<path d="m12 3 8 4-8 4-8-4z"/><path d="m4 11 8 4 8-4"/><path d="m4 15 8 4 8-4"/><circle cx="20" cy="4" r="1.6"/>',
  probe: '<path d="M4 20 20 4"/><circle cx="7" cy="8" r="1.4"/><circle cx="10" cy="5.5" r="1.4"/><circle cx="5" cy="12" r="1.4"/><circle cx="17" cy="15" r="1.4"/><circle cx="14" cy="18.5" r="1.4"/><circle cx="19.5" cy="11" r="1.4"/>'
};
const STATUS = {
  'Reported': { cls: 'ok', label: 'Reported' },
  'In code': { cls: 'code', label: 'In code' },
  'Gated': { cls: 'code', label: 'Gated' },
  'Partially reported': { cls: 'part', label: 'Partial' },
  'Not reported': { cls: 'miss', label: 'Not reported' },
  'Restricted': { cls: 'miss', label: 'Restricted' }
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let skipAnim = false;   // set by a "skip" link, or when a result has been seen before: replays finish instantly
const wait = ms => new Promise(r => setTimeout(r, reduceMotion || skipAnim ? 0 : ms));
const seen = { audit: {}, rerun: {} };   // what the user has already watched once, per paper

const $ = s => document.querySelector(s);
const choose = $('#choose'), audit = $('#audit'), list = $('#components'), statusEl = $('#auditStatus');
const here = $('.here');
let current = null; // key of the paper being inspected
let run = 0; // increments on every new inspection so an abandoned run stops updating the page
let auditDone = false, stage2Locked = false;

/** "Skip" links were removed; showSkip stays a no-op so the replay code does not need to change. */
function showSkip(id, on) { const b = $(id); if (b) b.hidden = !on; }
document.querySelectorAll('.skip-link').forEach(b => b.addEventListener('click', () => { skipAnim = true; b.hidden = true; }));

/** A group blocks a rerun if a required detail is missing or inaccessible.
    Gaps in non-required details, or partial answers, only make it "partially stated". */
const MISSING = s => s === 'Not reported' || s === 'Restricted';
function verdict(items) {
  if (items.some(i => i.required && MISSING(i.status))) return { cls: 'miss', text: 'Not enough to rerun' };
  if (items.some(i => i.status !== 'Reported')) return { cls: 'part', text: 'Enough, with gaps' };
  return { cls: 'ok', text: 'Enough to rerun' };
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function cardFor(group) {
  // The verdict sits in a folder-style tab above the card's top-left corner.
  const card = el('article', 'comp');
  card.dataset.state = 'waiting';
  const pill = el('span', 'pill', 'Waiting');
  const body = el('div', 'comp-body');
  body.innerHTML = `<svg class="icon comp-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[group.icon]}</svg>`;
  body.append(el('h3', 'comp-name', group.name), el('ul', 'comp-items'), el('p', 'comp-summary'));
  card.append(pill, body);
  return card;
}

/** One "evidence" link per card: opens the paper at every passage behind the card's items. */
function evidenceButton(paper, key, group) {
  const b = el('button', 'comp-evidence', 'evidence');
  b.type = 'button';
  b.setAttribute('aria-pressed', 'false');
  b.setAttribute('aria-controls', 'reader');
  b.setAttribute('aria-label', `Show evidence for ${group.name}`);
  b.addEventListener('click', () => {
    list.querySelectorAll('.comp-evidence').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    Reader.show(paper, key, group);
  });
  return b;
}

/** A paper that cannot be rerun locks Stage 2: its step turns gray. */
function lockStage2(locked) {
  const stage = $('#stage2');
  stage.classList.toggle('locked', locked);
  stage.querySelectorAll('.step').forEach(s => {
    locked ? s.setAttribute('aria-disabled', 'true') : s.removeAttribute('aria-disabled');
    s.title = locked ? 'Unavailable: the paper does not report everything needed to rerun the experiment.' : '';
  });
}

/** The card's seam, as in Seamful XAI: what reproduction expects vs. what the paper provides. */
function seamLines(box, group) {
  box.replaceChildren();
  box.classList.add('seam');
  for (const [label, text] of [['Expected', group.seam.expected], ['Found', group.seam.found]]) {
    const line = el('span', 'seam-line');
    line.append(el('b', null, label + ':'), el('span', null, text));   // label on its own line, then the text
    box.append(line);
  }
}

/* ---------- Paper, code, and activation viewers ----------
   One viewer at a time opens below the page and the page scrolls to it (the original layout). */
/** Eased, animated page scroll (ease-in-out, 0.75–1 s depending on distance). It stops if the user scrolls
    themselves, and jumps straight there when motion is reduced or the page is hidden (no animation frames). */
let scrollAnim = 0;
function smoothScrollTo(y) {
  const start = window.scrollY, dist = y - start, id = ++scrollAnim;
  if (Math.abs(dist) < 2) return;
  if (reduceMotion || document.hidden) { window.scrollTo(0, y); return; }
  const duration = Math.min(1000, Math.max(750, Math.abs(dist) * 0.8));
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const stop = () => { scrollAnim++; cleanup(); };
  const cleanup = () => ['wheel', 'touchstart', 'keydown'].forEach(ev => window.removeEventListener(ev, stop));
  ['wheel', 'touchstart', 'keydown'].forEach(ev => window.addEventListener(ev, stop, { passive: true, once: true }));
  let t0 = null;
  const step = now => {
    if (id !== scrollAnim) return;
    if (t0 === null) t0 = now;
    const t = Math.min(1, (now - t0) / duration);
    window.scrollTo(0, start + dist * ease(t));
    if (t < 1) requestAnimationFrame(step); else cleanup();
  };
  requestAnimationFrame(step);
}

const Drawer = (() => {
  const PANELS = ['#reader', '#codeView', '#actView'];
  let trigger = null;
  function open(panel) {
    PANELS.forEach(id => { const p = $(id); if (p !== panel) p.hidden = true; });
    if (panel.hidden) trigger = document.activeElement;
    panel.hidden = false;
    // Replay the reveal animation, then glide down to the viewer.
    panel.classList.remove('viewer-in'); void panel.offsetWidth; panel.classList.add('viewer-in');
    smoothScrollTo(panel.offsetTop);   // layout position: not shifted by the reveal animation
  }
  function close() {
    if (!PANELS.some(id => !$(id).hidden)) return;
    if (typeof Reader !== 'undefined') Reader.hide();
    PANELS.forEach(id => { $(id).hidden = true; });
    document.querySelectorAll('.comp-evidence[aria-pressed="true"]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
    trigger = null;
  }
  return { open, close };
})();

/* ---------- Email to the authors: one question per gap, grouped by card ---------- */
const mailDialog = $('#mailDialog');
function draftEmail(paper) {
  const id = paper.meta.match(/arXiv:\S+/)?.[0] || '';
  const lines = [
    paper.contact ? `Dear ${paper.contact.names.join(' and ')},` : 'Dear authors,',
    '',
    `I am a researcher trying to reproduce the linear-probe experiments in your paper “${paper.title}”${id ? ` (${id})` : ''}. ` +
    'Some details needed for this are missing or incomplete in the paper, or appear only in the released code. I would be grateful for any clarification on the following:',
  ];
  let n = 0;
  for (const g of paper.groups) {
    const qs = g.items.filter(i => i.ask);
    if (!qs.length) continue;
    lines.push('', g.name);
    qs.forEach(i => lines.push(`${++n}. ${i.name}: ${i.ask}`));
  }
  lines.push('', 'If any of these are available in released code or supplementary material, a pointer would be very helpful.', '', 'Thank you for your time.', '', 'Best regards,', '[Your name]', '[Affiliation]');
  return { subject: `Reproducibility questions about “${paper.title}”${id ? ` (${id})` : ''}`, body: lines.join('\n'), count: n };
}
function openMail(paper) {
  const to = $('#mailTo'), found = $('#mailFound');
  const d = draftEmail(paper);
  $('#mailSubject').value = d.subject;
  $('#mailBody').value = d.body;
  $('#mailCount').textContent = `${d.count} question${d.count === 1 ? '' : 's'}, one for each detail the audit found missing, partial, or only in code.`;
  $('#mailStatus').textContent = '';
  // The corresponding author was pre-extracted from the paper; fill it in straight away.
  if (paper.contact) {
    to.value = paper.contact.emails.join(', ');
    found.className = 'mail-found';
    found.textContent = `Corresponding author${paper.contact.names.length > 1 ? 's' : ''}: ${paper.contact.names.join(', ')} · found on ${paper.contact.source}`;
  } else {
    found.className = 'mail-found missing';
    found.textContent = 'No corresponding author found in the paper; add an address.';
    to.value = '';
  }
  mailDialog.showModal();
}
$('#mailCopy').addEventListener('click', async () => {
  const text = `Subject: ${$('#mailSubject').value}\n\n${$('#mailBody').value}`;
  try { await navigator.clipboard.writeText(text); $('#mailStatus').textContent = 'Copied to the clipboard.'; }
  catch { $('#mailBody').select(); $('#mailStatus').textContent = 'Copy was blocked; the text is selected, press ⌘C / Ctrl+C.'; }
});
$('#mailOpen').addEventListener('click', () => {
  const to = $('#mailTo').value.split(',').map(a => encodeURIComponent(a.trim()).replace(/%40/g, '@')).filter(Boolean).join(',');
  const href = `mailto:${to}?subject=${encodeURIComponent($('#mailSubject').value)}&body=${encodeURIComponent($('#mailBody').value)}`;
  window.location.href = href;   // hands the draft to the user's email app; nothing is sent from here
});
$('#mailClose').addEventListener('click', () => mailDialog.close());

/* "What do these labels mean?": a short glossary of every status and verdict on the current screen. */
const legendDialog = $('#legendDialog');
document.querySelectorAll('[data-legend]').forEach(b => b.addEventListener('click', () => {
  legendDialog.querySelectorAll('.legend-part').forEach(p => { p.hidden = p.dataset.part !== b.dataset.legend; });
  legendDialog.showModal();
}));
$('#legendClose').addEventListener('click', () => legendDialog.close());


const steps = [1, 2, 3].map(n => $('#step' + n));
let stepNow = 1;
function setStep(n) {
  stepNow = n;
  steps.forEach((s, i) => {
    const active = i + 1 === n;
    s.classList.toggle('current', active);
    s.classList.toggle('done', i + 1 < n);
    active ? s.setAttribute('aria-current', 'step') : s.removeAttribute('aria-current');
  });
  steps[n - 1].prepend(here);
}

async function inspect(key) {
  const paper = AUDITS[key], id = ++run;
  current = key; auditDone = false;
  if (typeof NextSteps !== 'undefined') NextSteps.clear();
  skipAnim = !!seen.audit[key];   // a paper seen before is shown at once
  showSkip('#skip1', !skipAnim);
  Drawer.close();
  $('#stage2View').hidden = true;
  $('#auditTitle').textContent = paper.title;
  // Hold the verdict line's place from the start, so the header height does not change when the result arrives.
  $('#auditVerdict').className = 'audit-verdict pending';
  $('#auditVerdict').textContent = '';   // empty, but its line keeps its height (styles.css)
  statusEl.className = 'audit-status sr-only';   // progress and verdict are announced to screen readers only
  lockStage2(false);
  statusEl.textContent = 'Reading the paper…';
  $('#headLinks').hidden = true;

  choose.classList.add('leaving');
  await wait(280);
  if (id !== run) return;
  choose.hidden = true;
  choose.classList.remove('leaving');
  setStep(2);
  list.replaceChildren(...paper.groups.map(cardFor));
  audit.hidden = false;
  $('#auditTitle').focus({ preventScroll: true });

  const cards = [...list.children];
  for (const [gi, group] of paper.groups.entries()) {
    const card = cards[gi], pill = card.querySelector('.pill'), ul = card.querySelector('.comp-items');
    card.dataset.state = 'loading';
    pill.textContent = 'Analyzing…';
    statusEl.textContent = `Checking ${group.name.toLowerCase()} (${gi + 1} of ${paper.groups.length})…`;
    for (const item of group.items) {
      await wait(380);
      if (id !== run) return;
      const st = STATUS[item.status];
      const li = el('li', 'item' + (item.required ? ' req' : ''));
      li.title = (item.required ? 'Required to rerun. ' : '') + item.note + (item.ref ? ` (${item.ref})` : '');
      li.append(el('span', 'item-name', item.name), el('span', 'chip ' + st.cls, st.label));
      ul.append(li);
    }
    await wait(250);
    if (id !== run) return;
    const v = verdict(group.items);
    pill.className = 'pill ' + v.cls;
    pill.textContent = v.text;
    seamLines(card.querySelector('.comp-summary'), group);
    if (group.items.some(i => i.find?.length)) card.querySelector('.comp-body').append(evidenceButton(paper, key, group));
    card.dataset.state = 'done';
  }

  const blocked = paper.groups.filter(g => verdict(g.items).cls === 'miss').length;
  const gaps = paper.groups.some(g => verdict(g.items).cls === 'part');
  // The overall result, next to the title: what the user needs to know first.
  const av = $('#auditVerdict');
  av.className = 'audit-verdict ' + (blocked ? 'miss' : 'ok');
  av.textContent = blocked ? `Can’t be rerun · ${blocked} of ${paper.groups.length} components miss required details`
    : gaps ? 'Can be rerun · some details are partial or only in code' : 'Can be rerun';
  statusEl.classList.add(blocked ? 'miss' : 'ok');
  statusEl.textContent = blocked
    ? `Cannot be rerun: ${blocked} of 4 components miss required details`
    : 'Enough is stated to rerun it in Stage 2';
  lockStage2(!!blocked);
  stage2Locked = !!blocked; auditDone = true; seen.audit[key] = true;
  if (typeof NextSteps !== 'undefined') NextSteps.fromAudit(paper, key);   // populate the next steps from Stage 1
  skipAnim = false; showSkip('#skip1', false);
  // Header links: request details from the authors, and the (locked) way into Stage 2.
  $('#headLinks').hidden = false;
  const req = $('#headRequest'), next = $('#headNext');
  req.querySelector('.label').textContent = blocked ? 'Request missing details' : 'Ask authors to clarify';
  // The authors button takes the colour of the most common card verdict (ties go to the more severe one).
  const tones = paper.groups.map(g => verdict(g.items).cls), rank = { miss: 3, part: 2, ok: 1 };
  const tally = tones.reduce((m, t) => (m[t] = (m[t] || 0) + 1, m), {});
  req.dataset.tone = Object.keys(tally).sort((a, b) => tally[b] - tally[a] || rank[b] - rank[a])[0];
  req.hidden = !paper.groups.some(g => g.items.some(i => i.ask));
  req.onclick = () => openMail(paper);
  next.disabled = !!blocked;
  next.title = blocked ? 'Locked: the missing details are needed before the experiment can be rerun.' : '';
}

/** Back to the paper choice (step 1 in the stepper). */
function reset() {
  run++;
  if (typeof NextSteps !== 'undefined') NextSteps.clear();
  skipAnim = false; showSkip('#skip1', false);
  if (typeof Rerun !== 'undefined') Rerun.stop();
  lockStage2(false);
  Drawer.close();
  $('#headLinks').hidden = true;
  audit.hidden = true;
  $('#stage2View').hidden = true;
  choose.hidden = false;
  setStep(1);
  document.querySelector('[data-inspect]').focus({ preventScroll: true });
}

document.querySelectorAll('[data-inspect]').forEach(b => b.addEventListener('click', () => inspect(b.dataset.inspect)));
// "End inspection" (Stage 2 header): finish and go back to choosing a paper.
$('#endInspection').addEventListener('click', () => { reset(); window.scrollTo({ top: 0 }); });
// "Go back" (Stage 1 header): back to choosing a paper.
$('#headBack').addEventListener('click', () => { reset(); window.scrollTo({ top: 0 }); });
// Into Stage 2: the setup step asks permission before anything is downloaded (setup.js).
$('#headNext').addEventListener('click', () => { if (current && SETUPS[current]) Setup.open(current); });
document.querySelectorAll('[data-pending]').forEach(btn => btn.addEventListener('click', () => {
  btn.closest('.caption').querySelector('.pending').textContent = btn.dataset.pending;
}));
