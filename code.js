/* Stage 2 code viewer: "show code" opens, in a side panel, the verbatim code behind the
   reproduction results (code-data.js). As in the Stage 1 paper reader: one filter per result
   (the first is selected), one tab per file, and the lines that matter for that result highlighted. */

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
    excerpts = all[i];
    tabs.replaceChildren(...excerpts.map((ex, k) => {
      const t = el('button', 'ev-tab', ex.file);
      t.type = 'button';
      t.dataset.tone = 'ok';
      t.addEventListener('click', () => render(k));
      return t;
    }));
    render(Math.min(file, excerpts.length - 1));
  }

  function show(key, claims) {
    all = CODE[key];
    file = 0;
    $('#codeFor').textContent = 'Reproduction results:';
    filters.replaceChildren(...claims.map((c, i) => {
      const f = el('button', 'ev-filter');
      f.type = 'button';
      f.disabled = !all[i];
      f.innerHTML = `<span class="dot" data-tone="${c.verdict}" aria-hidden="true"></span>`;
      f.append(c.text);
      f.addEventListener('click', () => select(i));
      return f;
    }));
    Drawer.open(root);   // a side panel, like the paper reader
    select(0);
  }

  function hide() { root.hidden = true; }

  return { show, hide };
})();
