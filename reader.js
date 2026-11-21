/* Paper reader: renders the paper PDF with PDF.js and highlights the passages
   that describe the selected reproducibility item. Highlights come from
   the short `find` phrases in audit-data.js; matching ignores case, spaces and
   hyphens so phrases survive PDF line breaks, and each match is widened to the
   whole sentence that contains it. */

const Reader = (() => {
  const PDFJS = 'vendor/';   // pdf.js 3.11.174, bundled so the reader works offline
  const norm = s => s.toLowerCase().replace(/[\s\-‐‑–]+/g, '');
  const root = document.querySelector('#reader');
  const pagesEl = root.querySelector('.reader-pages');
  const statusEl = root.querySelector('.reader-status');
  let doc = null, docKey = null, loading = null;
  let pages = [];          // { el, layer, rendered, strs, divs, text }
  let active = null;       // { group }
  let observer = null;
  let seq = 0;             // latest show() call wins
  const TONE = { 'Reported': 'ok', 'In code': 'code', 'Gated': 'code', 'Partially reported': 'part', 'Not reported': 'miss', 'Restricted': 'miss' };
  let current = 1;         // page centered in the strip
  let zoom = 1;            // 1 = fit the reader's width (capped for line length)
  const ZOOMS = [0.6, 0.8, 1, 1.25, 1.5, 2];
  const MAX_FIT = 980;     // px: widest a page gets at zoom 1
  const posEl = root.querySelector('.reader-pos');
  const prevBtn = root.querySelector('.reader-prev'), nextBtn = root.querySelector('.reader-next');

  function libReady() {
    if (!window.pdfjsLib) throw new Error('PDF viewer library did not load (it needs an internet connection).');
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
  }

  /** Page text in two forms:
      raw  – the text items joined (line ends become "\n"), with each character's item and offset;
      norm – lowercase without spaces/hyphens, used to find phrases across line breaks. */
  function indexText(strs, items) {
    let raw = '', item = [], off = [], norm = '', normToRaw = [];
    strs.forEach((s, i) => {
      for (let k = 0; k < s.length; k++) {
        raw += s[k]; item.push(i); off.push(k);
        if (!/[\s\-‐‑–]/.test(s[k])) { norm += s[k].toLowerCase(); normToRaw.push(raw.length - 1); }
      }
      if (items?.[i]?.hasEOL) { raw += '\n'; item.push(-1); off.push(0); }
    });
    const lines = raw.split('\n').map(l => l.trim().length).filter(n => n > 0).sort((a, b) => a - b);
    return { raw, item, off, norm, normToRaw, typicalLine: lines[Math.floor(lines.length * 0.75)] || 80 };
  }

  /* Sentence boundaries. A full stop ends a sentence unless it belongs to an
     abbreviation, an initial, or a number; a short line without end punctuation
     (heading, table row) also ends one. */
  const ABBR = /(?:\be\.g|\bi\.e|\bet al|\bFig|\bFigs|\bEq|\bEqs|\bSec|\bSecs|\bApp|\bcf|\bvs|\bresp|\bca|\bapprox|\bNo|\bresp|\bTab)$/i;
  function endsSentence(raw, i) {
    if (!/[.?!]/.test(raw[i] || '')) return false;
    const before = raw.slice(Math.max(0, i - 12), i);
    const reference = /(?:App|Appendix|Fig|Figure|Sec|Section|Tab|Table)\.?\s[A-Z]$/.test(before);   // "see App. H."
    if (raw[i] === '.' && (ABBR.test(before) || (!reference && /(?:^|[\s(])[A-Z]$/.test(before)))) return false;
    // "4.5" is a decimal, but "Sonnet 4.⁵ For" is a sentence end followed by a footnote mark.
    if (raw[i] === '.' && /\d$/.test(before) && /\d/.test(raw[i + 1] || '') && !/^\d{1,2}\s+[A-Z][a-z]/.test(raw.slice(i + 1, i + 8))) return false;
    let j = i + 1;
    while (j < raw.length && /[\d”"’')\]]/.test(raw[j])) j++;      // footnote marks, closing quotes
    if (j < raw.length && !/\s/.test(raw[j])) return false;
    while (j < raw.length && /\s/.test(raw[j])) j++;
    return j >= raw.length || /[A-Z§“"(\d]/.test(raw[j]) || /^[a-z][a-z _]{1,35}\.\s+[A-Z]/.test(raw.slice(j, j + 45));
  }
  function blockBreakAt(raw, i, typical) {                       // raw[i] is "\n"
    const lineStart = raw.lastIndexOf('\n', i - 1) + 1;
    const line = raw.slice(lineStart, i).trim();
    const next = raw.slice(i + 1).trimStart();
    if (next && !/^[A-Z0-9§“"(•]/.test(next)) return false;
    // a heading or caption line: short, made of words (not an equation fragment), no trailing comma
    return line.length > 0 && line.length < typical * 0.6 && /^[A-Z0-9§]/.test(line) && /[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(line)
      && !/[=∈∑ϕψσθµ⊤|{}\[\]]/.test(line) && /[A-Za-z0-9]$/.test(line);
  }
  function sentenceAround(idx, start, end) {
    const { raw, typicalLine } = idx;
    let a = start;
    while (a > 0 && start - a < 700) {
      const c = raw[a - 1];
      if (endsSentence(raw, a - 1) || (c === '\n' && blockBreakAt(raw, a - 1, typicalLine))) break;
      a--;
    }
    let b = end;
    while (b < raw.length && b - end < 700) {
      if (endsSentence(raw, b)) { b++; while (b < raw.length && /[\d”"’')\]]/.test(raw[b])) b++; break; }
      if (raw[b] === '\n' && blockBreakAt(raw, b, typicalLine)) break;
      b++;
    }
    if (a > 0 && /[.?!]/.test(raw[a - 1])) while (a < b && /[\d”"’')\]]/.test(raw[a])) a++;   // footnote mark of the previous sentence
    while (a < b && /\s/.test(raw[a])) a++;
    { const m = /^\d{1,2}(?=[A-Z][a-z])/.exec(raw.slice(a, a + 4)); if (m) a += m[0].length; }
    while (b > a && /\s/.test(raw[b - 1])) b--;
    return [a, b];
  }

  /** Whole sentences on a page that contain any of the phrases, as raw [start, end) ranges. */
  function sentencesOnPage(page, phrases) {
    const idx = page.index, out = [];
    for (const ph of phrases) {
      const needle = norm(ph);
      let at = idx.norm.indexOf(needle);
      while (at !== -1) {
        out.push(sentenceAround(idx, idx.normToRaw[at], idx.normToRaw[at + needle.length - 1] + 1));
        at = idx.norm.indexOf(needle, at + needle.length);
      }
    }
    out.sort((x, y) => x[0] - y[0]);
    return out.filter((r, i) => !i || r[0] >= out[i - 1][1] || (out[i - 1][1] = Math.max(out[i - 1][1], r[1]), false));
  }

  async function load(paper, key) {
    if (docKey === key) return loading;
    docKey = key;
    loading = (async () => {
      libReady();
      pagesEl.replaceChildren();
      pagesEl.scrollLeft = 0;
      pages = [];
      current = 1;
      statusEl.textContent = 'Loading paper…';
      doc = await pdfjsLib.getDocument(paper.pdf).promise;
      if (docKey !== key) return;
      // Pages are as wide as the reader allows (readable text); each page scrolls
      // vertically in its own slot, and slots sit side by side to turn pages left/right.
      for (let n = 1; n <= doc.numPages; n++) {
        if (docKey !== key) return;   // another paper was opened meanwhile
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        const strs = tc.items.map(i => i.str || '');
        const slot = document.createElement('div');
        slot.className = 'pdf-slot';
        slot.dataset.page = n;
        slot.setAttribute('aria-label', `Page ${n} of ${doc.numPages}`);
        const el = document.createElement('div');
        el.className = 'pdf-page';
        slot.append(el);
        pagesEl.append(slot);
        pages.push({ n, page, base, tc, slot, el, gen: 0, rendered: false, index: indexText(strs, tc.items), divs: [] });
      }
      layout();
      statusEl.textContent = '';
    })();
    return loading;
  }

  /** Size every page for the current zoom and (re)start lazy rendering. */
  function layout() {
    for (const p of pages) {
      const fit = Math.min(pagesEl.clientWidth - 64, MAX_FIT) / p.base.width;
      p.viewport = p.page.getViewport({ scale: Math.max(0.3, fit * zoom) });
      p.gen++;
      p.rendered = p.ready = false;
      p.strs = null; p.divs = [];
      p.el.replaceChildren();
      p.el.style.width = p.viewport.width + 'px';
      p.el.style.height = p.viewport.height + 'px';
      p.slot.style.width = Math.min(p.viewport.width + 16, pagesEl.clientWidth - 24) + 'px';
    }
    if (pages[0]) pagesEl.style.setProperty('--page-w', pages[0].slot.style.width);
    zoomLabel.textContent = Math.round(zoom * 100) + '%';
    zoomOut.disabled = zoom <= ZOOMS[0];
    zoomIn.disabled = zoom >= ZOOMS[ZOOMS.length - 1];
    observer?.disconnect();
    observer = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && render(pages[e.target.dataset.page - 1])), { root: pagesEl, rootMargin: '0px 1200px' });
    pages.forEach(p => observer.observe(p.slot));
  }

  async function render(p) {
    if (p.rendered) return p.rendering;
    p.rendered = true;
    const gen = p.gen;
    p.rendering = (async () => {
      const ratio = window.devicePixelRatio || 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(p.viewport.width * ratio);
      canvas.height = Math.floor(p.viewport.height * ratio);
      canvas.style.width = p.viewport.width + 'px';
      canvas.style.height = p.viewport.height + 'px';
      canvas.setAttribute('aria-hidden', 'true');
      const layer = document.createElement('div');
      layer.className = 'textLayer';
      layer.style.setProperty('--scale-factor', p.viewport.scale);
      p.el.append(canvas, layer);
      await p.page.render({ canvasContext: canvas.getContext('2d'), viewport: p.viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null }).promise;
      if (gen !== p.gen) return;      // zoom changed while drawing
      const textDivs = [], strs = [];
      await pdfjsLib.renderTextLayer({ textContentSource: p.tc, container: layer, viewport: p.viewport, textDivs, textContentItemsStr: strs }).promise;
      if (gen !== p.gen) return;
      p.divs = textDivs;
      p.strs = strs;
      p.ready = true;
      p.index = indexText(strs, tc_items(p, strs));   // re-index against the rendered spans, one-to-one with textDivs
      paint(p);
    })();
    return p.rendering;
  }

  const tc_items = (p, strs) => (p.tc.items.length === strs.length ? p.tc.items : null);

  /** Mark exactly the characters of each evidence sentence inside the text spans. */
  function paint(p) {
    if (!p.strs) return;                          // page still drawing; render() paints when done
    p.divs.forEach((d, i) => { if (d.querySelector('.hl')) d.textContent = p.strs[i]; });
    if (!active) return;
    const per = new Map();                       // div index -> [[from, to], ...]
    {
      evidenceOnPage(p).forEach(({ a, b, tone }, i) => {
        const ev = (active.base?.[p.n] ?? 0) + i;   // global evidence number (0-based)
        for (let k = a; k < b; k++) {
          const d = p.index.item[k];
          if (d < 0) continue;
          const o = p.index.off[k], r = per.get(d) || [];
          const last = r[r.length - 1];
          if (last && last[1] === o && last[2] === ev) last[1] = o + 1; else r.push([o, o + 1, ev, tone]);
          per.set(d, r);
        }
      });
    }
    per.forEach((ranges, d) => {
      const div = p.divs[d], text = p.strs[d];
      if (!div) return;
      div.replaceChildren();
      let pos = 0;
      for (const [a, b, ev, tone] of ranges) {
        if (a > pos) div.append(text.slice(pos, a));
        const m = document.createElement('span');
        m.className = 'hl t-' + tone;   // colour of the item's status
        m.dataset.ev = ev;
        m.textContent = text.slice(a, b);
        div.append(m);
        pos = b;
      }
      if (pos < text.length) div.append(text.slice(pos));
    });
  }

  /** Evidence sentences on a page for all active items, overlaps merged; each keeps
      the items it supports and takes its colour from the first of them. */
  function evidenceOnPage(p) {
    const found = [];
    for (const item of active.items) for (const [a, b] of sentencesOnPage(p, item.find)) found.push({ a, b, items: [item] });
    found.sort((x, y) => x.a - y.a);
    const out = [];
    for (const f of found) {
      const last = out[out.length - 1];
      if (last && f.a < last.b) { last.b = Math.max(last.b, f.b); if (!last.items.includes(f.items[0])) last.items.push(f.items[0]); }
      else out.push(f);
    }
    out.forEach(e => (e.tone = TONE[e.items[0].status] || 'part'));
    return out;
  }

  /** For verification: the evidence sentences an item highlights, per page. */
  async function evidence(paper, key, item) {
    await load(paper, key);
    return pages.flatMap(p => sentencesOnPage(p, item.find || []).map(([a, b]) => ({ page: p.n, text: p.index.raw.slice(a, b).replace(/\s+/g, ' ') })));
  }

  /** Pages on which an item's phrases occur. */
  const pagesFor = item => item.find ? pages.filter(p => sentencesOnPage(p, item.find).length).map(p => p.n) : [];

  /** Center page n in the strip (smoothly for nearby pages), then pulse its highlights. */
  async function jump(n, ev = null) {
    const p = pages[Math.min(Math.max(n, 1), pages.length) - 1];
    if (!p) return;
    pagesEl.scrollTo({ left: centerOf(p), behavior: Math.abs(p.n - current) <= 2 ? motion() : 'instant' });
    setCurrent(p.n);
    await render(p);
    const sel = ev == null ? '.hl' : `.hl[data-ev="${ev}"]`;
    const hl = p.el.querySelector(sel);
    if (hl) {   // bring the evidence sentence to the upper third of the visible page area
      const top = hl.getBoundingClientRect().top - p.slot.getBoundingClientRect().top + p.slot.scrollTop;
      p.slot.scrollTo({ top: Math.max(0, top - p.slot.clientHeight / 3), behavior: 'instant' });
    }
    p.el.querySelectorAll(sel).forEach(h => { h.classList.remove('pulse'); void h.offsetWidth; h.classList.add('pulse'); });
  }

  /** Tabs above the paper: one per evidence sentence, named by its page ("p. 7", "p. 7 · 2" for a second one). */
  const tabsEl = root.querySelector('.ev-tabs');
  function evidenceTabs() {
    tabsEl.replaceChildren();
    const perPage = {};
    active.list.forEach((e, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ev-tab';
      perPage[e.n] = (perPage[e.n] || 0) + 1;
      b.textContent = perPage[e.n] > 1 ? `p. ${e.n} · ${perPage[e.n]}` : `p. ${e.n}`;
      b.dataset.tone = e.tone;
      const names = e.items.map(i => i.name).join(', ');
      b.title = `${names} · page ${e.n}`;
      b.setAttribute('aria-label', `Evidence ${k + 1} of ${active.list.length}: ${names}, page ${e.n}`);
      b.onclick = () => goEvidence(k);
      tabsEl.append(b);
    });
  }
  function goEvidence(k) {
    tabsEl.querySelectorAll('.ev-tab').forEach((b, i) => b.toggleAttribute('aria-current', i === k));
    jump(active.list[k].n, k);
  }

  /** Smooth scrolling only when it can run (visible page, motion allowed). */
  const motion = () => (document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth');

  function setCurrent(n) {
    current = n;
    posEl.textContent = pages.length ? `Page ${n} of ${pages.length}` : '';
    prevBtn.disabled = n <= 1;
    nextBtn.disabled = n >= pages.length;
  }

  /** Track which page is centered while the user scrolls or swipes, and once the
      scrolling settles, center that page (a manual snap; CSS scroll-snap re-snaps
      to stale targets when pages finish drawing). */
  const centerOf = p => p.slot.offsetLeft - (pagesEl.clientWidth - p.slot.offsetWidth) / 2;
  let settle = null;
  pagesEl.addEventListener('scroll', () => {
    const mid = pagesEl.scrollLeft + pagesEl.clientWidth / 2;
    let best = current, dist = Infinity;
    for (const p of pages) {
      const d = Math.abs(p.slot.offsetLeft + p.slot.offsetWidth / 2 - mid);
      if (d < dist) { dist = d; best = p.n; }
    }
    if (best !== current) setCurrent(best);
    clearTimeout(settle);
    settle = setTimeout(() => {
      const p = pages[current - 1];
      if (p && Math.abs(centerOf(p) - pagesEl.scrollLeft) > 2) { pagesEl.scrollTo({ left: centerOf(p), behavior: motion() }); render(p); }
    }, 160);
  }, { passive: true });
  const zoomOut = root.querySelector('.zoom-out'), zoomIn = root.querySelector('.zoom-in'), zoomLabel = root.querySelector('.zoom-level');
  function setZoom(z) {
    if (!pages.length) return;
    const p = pages[current - 1], ratio = p.slot.scrollTop / Math.max(1, p.el.offsetHeight);   // keep the reading position
    zoom = z;
    layout();
    pagesEl.scrollTo({ left: centerOf(p), behavior: 'instant' });
    render(p).then(() => { p.slot.scrollTop = ratio * p.el.offsetHeight; });
  }
  zoomOut.addEventListener('click', () => setZoom([...ZOOMS].reverse().find(z => z < zoom) ?? zoom));
  zoomIn.addEventListener('click', () => setZoom(ZOOMS.find(z => z > zoom) ?? zoom));
  root.querySelector('.zoom-fit').addEventListener('click', () => setZoom(1));
  prevBtn.addEventListener('click', () => jump(current - 1));
  nextBtn.addEventListener('click', () => jump(current + 1));
  root.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); jump(current + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); jump(current - 1); }
    const slot = pages[current - 1]?.slot, step = { ArrowDown: 0.15, ArrowUp: -0.15, PageDown: 0.85, PageUp: -0.85 }[e.key];
    if (slot && step && !e.target.closest('.pdf-slot')) { e.preventDefault(); slot.scrollBy({ top: step * slot.clientHeight }); }
  });

  /** Item filter chips, one per item (toggle; none pressed = all evidence); items without a passage are disabled. */
  const filtersEl = root.querySelector('.ev-filters');
  function filterChips(group) {
    filtersEl.replaceChildren();
    const make = (label, item, enabled, tone) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ev-filter';
      if (tone) { const dot = document.createElement('span'); dot.className = 'dot'; dot.dataset.tone = tone; dot.setAttribute('aria-hidden', 'true'); b.append(dot); }
      b.append(label);
      b.setAttribute('aria-pressed', String(item === active.filter));
      if (!enabled) { b.disabled = true; b.title = 'Not described in the paper'; }
      b.onclick = () => { active.filter = active.filter === item ? null : item; rebuild(); };   // click again to show all
      filtersEl.append(b);
    };
    for (const item of group.items) make(item.name, item, !!item.find?.length, TONE[item.status] || 'part');
  }

  /** Recompute the evidence list for the current filter, repaint, and open evidence 1. */
  function rebuild() {
    active.items = active.filter ? [active.filter] : active.all;
    active.list = []; active.base = {};
    let k = 0;
    for (const p of pages) {
      active.base[p.n] = k;
      for (const e of evidenceOnPage(p)) { active.list.push({ n: p.n, ...e }); k++; }
    }
    filtersEl.querySelectorAll('.ev-filter').forEach((b, i) => b.setAttribute('aria-pressed', String(active.group.items[i] === active.filter)));
    pages.filter(p => p.ready).forEach(paint);
    evidenceTabs();
    if (active.list.length) goEvidence(0); else jump(current);
  }

  async function show(paper, key, group) {
    Drawer.open(root);   // a side panel: the cards stay visible beside the paper
    const all = group.items.filter(i => i.find?.length);
    active = { group, all, items: all, filter: all[0] || null, list: [], base: {} };   // open on the first characteristic with evidence
    tabsEl.replaceChildren();
    root.querySelector('.ev-for').textContent = group.name + ':';   // which card the evidence belongs to
    filterChips(group);
    const id = ++seq;
    try {
      await load(paper, key);
      if (id !== seq) return;
    } catch (e) {
      docKey = null;
      statusEl.textContent = 'The paper could not be displayed: ' + e.message;
      return;
    }
    rebuild();
  }

  function hide() { root.hidden = true; active = null; seq++; }

  return { show, hide, evidence };
})();
