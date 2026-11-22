/* Stage 2, part B: alternative hypotheses tested by the agent on newly generated data.
   Replays the saved run (alt-data.js, alt-readings.js): the agent's steps, then one row per hypothesis with
   the measured accuracy and a verdict from the rule fixed before the run. "show activations" opens, below the
   page, the probe's reading at every token of the test statements. */

const VERDICTS = {
  generalizes: { cls: 'ok', label: 'Not confirmed' },
  partly: { cls: 'part', label: 'Partly confirmed' },
  supported: { cls: 'miss', label: 'Confirmed' }
};
const ruleVerdict = acc => acc >= 90 ? 'generalizes' : acc <= 70 ? 'supported' : 'partly';   // PREDICTIONS.md

/** Accuracy and verdict of a hypothesis: its own dataset, or the mean over its parts. */
function altScore(h) {
  const s = ALT_READINGS.scores;
  if (!h.parts) return { mean: s[h.key].mean, min: s[h.key].min, max: s[h.key].max, verdict: s[h.key].verdict };
  const mean = h.parts.reduce((n, p) => n + s[p.key].mean, 0) / h.parts.length;
  return { mean, verdict: ruleVerdict(mean) };
}

const Alt = (() => {
  const list = $('#alts'), sum = $('#altSum'), status = $('#altStatus'), showBtn = $('#altShow');
  const pct = x => `${x.toFixed(1)}%`;
  const pause = ms => new Promise(r => setTimeout(r, reduceMotion || skipAnim ? 0 : ms));
  let token = 0;

  function waitRows(n, text) {
    const note = el('li', 'claims-wait', text);
    const rows = Array.from({ length: n }, (_, k) => {
      const li = el('li', 'claim claim-loading');
      li.setAttribute('aria-hidden', 'true');
      li.style.animationDelay = `${k * 0.15}s`;
      li.append(el('span', 'bar bar-text'), el('span', 'bar bar-chip'), el('span', 'bar bar-nums'));
      return li;
    });
    return [note, ...rows];
  }

  function row(h, i, control) {
    const s = altScore(h), v = VERDICTS[s.verdict], scores = ALT_READINGS.scores;
    const li = el('li', 'claim alt');
    const top = el('div', 'claim-top');
    top.append(el('span', 'claim-text', h.text), el('span', 'chip ' + v.cls, v.label));
    const nums = el('div', 'claim-nums');
    if (h.parts) {
      h.parts.forEach((p, k) => {
        if (k) nums.append(el('span', 'sep', ' · '));
        nums.append(el('span', null, p.name + ' '), el('b', null, pct(scores[p.key].mean)));
        if (k === h.parts.length - 1) nums.append(el('span', null, ' correct'));
      });
    } else {
      nums.append(el('b', null, pct(s.mean)), el('span', null, ' correct'),
                  el('span', 'sep', ' · '), el('span', null, `${pct(control.mean)} on the paper’s statements`));
    }
    const btn = el('button', 'comp-evidence claim-explain-btn', 'explain');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'altExplain' + i);
    btn.setAttribute('aria-label', `Explain: ${h.text}`);
    const box = el('div', 'claim-explain');
    box.id = 'altExplain' + i; box.hidden = true;
    box.append(el('p', 'explain-text', h.explain));
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      list.querySelectorAll('.claim-explain-btn').forEach(b => {
        b.setAttribute('aria-expanded', 'false');
        $('#' + b.getAttribute('aria-controls')).hidden = true;
      });
      btn.setAttribute('aria-expanded', String(open));
      box.hidden = !open;
      if (open) box.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    const links = el('span', 'claim-links');
    links.append(btn);
    li.append(top, nums, links, box);
    return li;
  }

  /** While the reproduction runs, the panel waits. */
  function wait(key) {
    token++;
    const a = ALTS[key];
    sum.textContent = '';
    showBtn.hidden = true;
    showBtn.setAttribute('aria-pressed', 'false');
    NextSteps.clearStage2();
    list.replaceChildren(...(a ? waitRows(a.hypotheses.length, 'Starts when the reproduction is finished…') : []));
  }

  /** The agent's run, replayed step by step, then the results. */
  async function run(key) {
    const a = ALTS[key], id = ++token;
    if (!a) return;
    const control = ALT_READINGS.scores[a.control];
    // The agent's run is the last block of the pipeline: "Testing…", then "Done".
    const block = document.querySelector('#pipeline .pipe-step:last-child'), st = block?.querySelector('.pipe-state');
    const note = list.querySelector('.claims-wait');
    if (block) { block.dataset.state = 'running'; st.textContent = 'Testing…'; }
    if (note) note.textContent = 'The agent is testing alternative hypotheses on new data…';
    for (const step of a.agent) {
      status.textContent = step;
      await pause(900);
      if (id !== token) return;
    }
    if (block) { block.dataset.state = 'done'; st.textContent = 'Done'; }
    list.replaceChildren();
    for (const [i, h] of a.hypotheses.entries()) {
      await pause(260);
      if (id !== token) return;
      list.append(row(h, i, control));
    }
    const counts = {};
    a.hypotheses.forEach(h => { const l = VERDICTS[altScore(h).verdict].label; counts[l] = (counts[l] || 0) + 1; });
    sum.textContent = Object.entries(counts).map(([l, n]) => `${n} ${l.toLowerCase()}`).join(' · ');
    showBtn.hidden = false;
    showBtn.onclick = () => { showBtn.setAttribute('aria-pressed', 'true'); ActView.show(key); };
    NextSteps.fromStage2(key);   // the hypothesis steps join the Stage 1 steps
    status.textContent = `Tests complete: ${sum.textContent}.`;
    seen.rerun[key] = true;   // next visit shows Stage 2 at once
    skipAnim = false;
    showSkip('#skip2', false);
  }

  return { wait, run, stop: () => { token++; } };
})();

/* Activation viewer: one filter per tested dataset (first selected), plus the original statements for comparison. */
const ActView = (() => {
  const root = $('#actView'), filters = $('#actFilters'), listEl = $('#actList');

  /** Blue for "true", orange for "false": a pair that stays distinct for colour-blind readers. */
  function colour(p) {
    const a = Math.min(1, Math.abs(p - 0.5) * 2) * 0.62;
    return p >= 0.5 ? `rgba(37,110,190,${a.toFixed(3)})` : `rgba(225,120,25,${a.toFixed(3)})`;
  }

  function sets(key) {
    const out = [];
    for (const h of ALTS[key].hypotheses) {
      if (h.parts) h.parts.forEach(p => out.push({ id: p.key, name: p.name, label: `${h.short}: ${p.name}`, verdict: ALT_READINGS.scores[p.key].verdict }));
      else out.push({ id: h.key, name: h.short, label: h.short, verdict: ALT_READINGS.scores[h.key].verdict });
    }
    out.push({ id: 'cities', name: 'The paper’s statements', label: 'The paper’s own statements, for comparison', ref: true });
    return out;
  }

  /** Every statement of the set; only its last token (the final punctuation) is coloured, because the
      paper's probe reads the activation at that token alone. */
  function render(k, all) {
    const set = all[k], rows = ALT_READINGS.readings[set.id];
    filters.querySelectorAll('.ev-filter').forEach((f, j) => f.setAttribute('aria-pressed', String(j === k)));
    const s = ALT_READINGS.scores[set.ref ? 'control_cities' : set.id];
    $('#actOrigin').textContent = `${set.label} · ${rows.length.toLocaleString('en-US')} statements · the probe is correct on ${s.mean.toFixed(1)}%`;
    $('#actNote').textContent = 'p(true) is how likely the probe thinks a statement is true, from 0 to 1, averaged over ten trained probes; ✓ means its answer was right.';
    const frag = document.createDocumentFragment();
    for (const [text, label, p] of rows) {
      const rowEl = el('div', 'act-row');
      const sentence = el('div', 'act-sentence');
      const cut = text.length - 1;   // the final punctuation mark: ".", "。" or "।"
      const last = el('span', 'tok last', text.slice(cut));
      last.style.background = colour(p);
      last.title = `p(true) ${p.toFixed(2)} at the last token`;
      sentence.append(el('span', 'act-text', text.slice(0, cut)), last);
      const correct = (p >= 0.5) === Boolean(label);
      const res = el('div', 'act-result');
      res.append(el('span', 'act-label', label ? 'True statement' : 'False statement'),
                 el('span', 'chip ' + (correct ? 'ok' : 'miss'), `p(true) ${p.toFixed(2)} ${correct ? '✓' : '✗'}`));
      rowEl.append(sentence, res);
      frag.append(rowEl);
    }
    listEl.replaceChildren(frag);
    listEl.scrollTop = 0;
  }


  function show(key, startSet) {
    const all = sets(key);
    filters.replaceChildren(...all.map((s, k) => {
      const f = el('button', 'ev-filter');
      f.type = 'button';
      f.innerHTML = `<span class="dot" data-tone="${s.ref ? 'code' : VERDICTS[s.verdict].cls}" aria-hidden="true"></span>`;
      f.append(s.name);
      f.addEventListener('click', () => render(k, all));
      return f;
    }));
    Drawer.open(root);   // a side panel, like the paper reader
    render(Math.max(0, all.findIndex(x => x.id === startSet)), all);
  }

  return { show, hide: () => { root.hidden = true; } };
})();

/* "Next steps based on identified seams": a messenger-style assistant in the bottom-right corner, on every screen.
   Empty until a paper is analysed; Stage 1 adds steps from the audit, Stage 2 adds the hypothesis steps. */
const NextSteps = (() => {
  const panel = $('#assistantPanel'), launcher = $('#stepsLink'), list = $('#nextSteps'), count = $('#stepsCount'),
        empty = $('#stepsEmpty'), intro = $('#stepsIntro');
  let stage1 = [], stage2 = [], key = null;
  const lower = n => n.charAt(0).toLowerCase() + n.slice(1);
  const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][n] || String(n);
  const Cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  const join = xs => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];

  let shown = 0;
  function refresh() {
    const n = stage1.length + stage2.length;
    count.textContent = String(n);
    count.dataset.empty = String(n === 0);
    if (n > shown) { count.classList.remove('pulse'); void count.offsetWidth; count.classList.add('pulse'); }   // new steps: pulse once
    shown = n;
    if (!panel.hidden) render();
  }

  /** Stage 1: steps from the audit of the paper, most severe first. */
  function fromAudit(paper, k) {
    key = k; stage2 = [];
    const items = paper.groups.flatMap(g => g.items);
    const blocked = items.filter(i => i.required && MISSING(i.status)).map(i => lower(i.name));
    const asks = items.filter(i => i.ask);
    stage1 = [];
    // One step for everything the authors could supply; when something required is missing, say so first.
    if (asks.length) {
      const lead = blocked.length
        ? `${blocked.length > 1 ? `${Cap(word(blocked.length))} required details are` : 'A required detail is'} not available (${join(blocked)}), so the experiment cannot be rerun as published. `
        : '';
      stage1.push({ title: 'Ask the authors for the missing details',
        why: `${lead}The draft email asks ${asks.length} question${asks.length > 1 ? 's' : ''} about details that are missing, partial, or only in code, such as ${join(asks.slice(0, 2).map(i => lower(i.name)))}.`,
        action: { type: 'mail', label: 'Draft email' } });
    }
    refresh();
  }

  /** Stage 2: the hypothesis steps, added once the agent's tests are done. */
  function fromStage2(k) { stage2 = (ALTS[k] && ALTS[k].next) || []; refresh(); }
  function clear() { stage1 = []; stage2 = []; key = null; refresh(); }
  function clearStage2() { stage2 = []; refresh(); }

  function render() {
    const all = [...stage1, ...stage2];
    empty.hidden = all.length > 0;
    intro.hidden = all.length === 0;
    intro.textContent = `Based on identified seams in “${AUDITS[key]?.title || ''}”, here ${all.length > 1 ? `are ${all.length} things` : 'is one thing'} you can do next:`;
    list.replaceChildren(...all.map(n => {
      const li = el('li', 'next-step');
      const text = el('div', 'next-text');
      text.append(el('strong', null, n.title), el('p', null, n.why));
      li.append(text);
      if (n.action) {
        const btn = el('button', 'btn secondary next-btn', n.action.label);
        btn.type = 'button';
        btn.addEventListener('click', () => {
          close();
          if (n.action.type === 'mail') openMail(AUDITS[key]);
          else { $('#altShow').setAttribute('aria-pressed', 'true'); ActView.show(key, n.action.set); }
        });
        li.append(btn);
      }
      return li;
    }));
  }

  function open() {
    render();
    panel.hidden = false;
    launcher.setAttribute('aria-expanded', 'true');
    $('#stepsClose').focus({ preventScroll: true });
  }
  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    launcher.setAttribute('aria-expanded', 'false');
  }
  launcher.addEventListener('click', () => (panel.hidden ? open() : close()));
  $('#stepsClose').addEventListener('click', () => { close(); launcher.focus({ preventScroll: true }); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden && !document.querySelector('dialog[open]')) { close(); launcher.focus({ preventScroll: true }); } });
  refresh();
  return { fromAudit, fromStage2, clear, clearStage2, open, close };
})();
