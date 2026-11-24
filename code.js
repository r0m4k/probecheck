/* Stage 2 code viewer: "show code and code quality summary" opens, below the page, the code quality summary and the verbatim
   code behind each potential downside it lists (code-data.js). As in the Stage 1 paper reader: one filter
   per downside (the first is selected), one tab per file, and the lines behind that downside highlighted. */

const CodeView = (() => {
  const root = $('#codeView'), tabs = $('#codeTabs'), filters = $('#codeFilters'), body = $('#codeBody');
  let all = [], excerpts = [], file = 0;

  function render(k) {
    file = k;
    const ex = excerpts[k];
    tabs.querySelectorAll('.ev-tab').forEach((t, i) => i === k ? t.setAttribute('aria-current', 'true') : t.removeAttribute('aria-current'));
    $('#codeOrigin').textContent = `${ex.file} · ${ex.origin}`;
    $('#codeNote').textContent = ex.note;
    const link = $('#codeLink');
    link.hidden = !ex.url;
    if (ex.url) link.href = ex.url;
    const hot = n => ex.hl.some(([a, b]) => n >= a && n <= b);
    body.dataset.tone = all.find(d => d.excerpts === excerpts)?.tone || 'ok';
    body.replaceChildren(...ex.lines.map((text, i) => {
      const n = ex.start + i, row = el('span', 'code-line' + (hot(n) ? ' hot' : ''));
      row.append(el('span', 'ln', String(n)), el('span', 'lc', text || ' '));
      return row;
    }));
    // Bring the first highlighted line into view inside the code box (without moving the page).
    const hot1 = body.querySelector('.hot');
    body.scrollTop = hot1 ? Math.max(0, hot1.offsetTop - body.clientHeight / 3) : 0;
  }

  /** Select one result: its excerpts replace the file tabs, keeping the same file open. */
  function select(i) {
    filters.querySelectorAll('.ev-filter').forEach((f, j) => f.setAttribute('aria-pressed', String(j === i)));
    excerpts = all[i].excerpts;
    tabs.replaceChildren(...excerpts.map((ex, k) => {
      const t = el('button', 'ev-tab', ex.file);
      t.type = 'button';
      t.dataset.tone = all[i].tone;
      t.addEventListener('click', () => render(k));
      return t;
    }));
    render(Math.min(file, excerpts.length - 1));
  }

  /** The code quality summary: our review of the released code, grouped by kind of finding. */
  function renderQuality(key) {
    const q = typeof CODE_QUALITY !== 'undefined' && CODE_QUALITY[key];
    const gh = CODE[key].flatMap(d => d.excerpts).find(e => e.url)?.url.replace(/[^/]+(#.*)?$/, '') || '';
    renderSummary($('#codeQuality'), q, gh);
  }

  function show(key) {
    all = CODE[key];
    renderQuality(key);
    file = 0;
    $('#codeFor').textContent = 'Potential downsides:';
    filters.replaceChildren(...all.map((d, i) => {
      const f = el('button', 'ev-filter');
      f.type = 'button';
      f.innerHTML = `<span class="dot" data-tone="${d.tone}" aria-hidden="true"></span>`;
      f.append(d.label);
      f.addEventListener('click', () => select(i));
      return f;
    }));
    Drawer.open(root);   // a side panel, like the paper reader
    select(0);
  }

  function hide() { root.hidden = true; }

  return { show, hide };
})();

/** A quality summary (code or data): a count line, then one column per group of findings.
    Shared by the code viewer and the activation viewer; `gh` is the base for code links. */
function renderSummary(box, q, gh = '') {
  box.hidden = !q;
  if (!q) return;
  const count = g => g.countText || (g.items.length ? `${g.items.length} ${g.count[g.items.length === 1 ? 0 : 1]}` : `no ${g.count[1]}`);
  const dot = tone => { const d = el('span', 'dot'); d.setAttribute('aria-hidden', 'true'); d.dataset.tone = tone; return d; };
  const counts = box.querySelector('.cq-counts');
  counts.hidden = q.counts === false;
  counts.replaceChildren(...(q.counts === false ? [] : q.groups.map(g => { const c = el('span', '', count(g)); c.prepend(dot(g.tone)); return c; })));
  const groups = box.querySelector('.cq-groups');
  groups.replaceChildren(...q.groups.map(g => {
    const sec = el('section', 'cq-group'), h = el('h3', '', g.name), list = el('ul');
    h.prepend(dot(g.tone));
    if (!g.items.length) list.append(el('li', 'cq-none', 'None'));
    list.append(...g.items.map(it => {
      const li = el('li');
      li.append(el('p', 'cq-text', it.text));
      if (it.where || it.effect) {   // optional: where in the code, and the measured effect
        const meta = el('p', 'cq-meta');
        if (it.where) {
          const a = el('a', '', it.where);
          a.href = it.link || gh + it.url;
          a.target = '_blank'; a.rel = 'noopener';
          meta.append(a);
        }
        if (it.effect) meta.append((it.where ? ' · ' : '') + it.effect);
        li.append(meta);
      }
      return li;
    }));
    sec.append(h, list);
    return sec;
  }));
  // One equal column per group.
  groups.style.gridTemplateColumns = `repeat(${q.groups.length}, minmax(0, 1fr))`;
  const scope = box.querySelector('.cq-scope');
  if (scope) { scope.textContent = q.scope || ''; scope.hidden = !q.scope; }
}
