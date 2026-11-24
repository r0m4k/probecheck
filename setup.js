/* Stage 2 entry: "Next stage" asks the user to confirm the downloads, replays the download
   (no files are fetched in this prototype), then moves on to Stage 2. */

const Setup = (() => {
  const dlg = $('#getDialog'), list = $('#getList'), confirmBtn = $('#getConfirm'), cancelBtn = $('#getCancel');
  const statusEl = $('#getStatus'), view = $('#stage2View');
  let key = null, token = 0;
  const downloaded = {};   // papers whose components were already downloaded in this session

  const fmt = b => b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : Math.round(b / 1e3) + ' KB';

  function row(c) {
    const li = el('li', 'get-item');
    li.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[c.icon]}</svg>`;
    const text = el('span', 'get-text');
    text.append(el('strong', null, c.name), el('span', 'muted', `${c.what} · ${c.from}`));
    const size = el('span', 'get-size', c.size);
    const prog = el('span', 'get-progress');
    prog.setAttribute('role', 'progressbar');
    prog.setAttribute('aria-label', `${c.name} download`);
    prog.setAttribute('aria-valuemin', '0'); prog.setAttribute('aria-valuemax', '100'); prog.setAttribute('aria-valuenow', '0');
    prog.append(el('span', 'bar'));
    li.append(text, size, prog);
    c.li = li;
    return li;
  }

  function ask(k) {
    key = k; token++;
    const cfg = SETUPS[k], total = cfg.components.reduce((n, c) => n + c.bytes, 0);
    list.replaceChildren(...cfg.components.map(row));
    $('#getTotal').textContent = `Total: ${fmt(total)}`;
    statusEl.textContent = '';
    dlg.classList.remove('downloading');
    $('#getTitle').textContent = 'Download the experiment components?';
    confirmBtn.hidden = false;
    cancelBtn.hidden = false;
    confirmBtn.textContent = `Download ${fmt(total)}`;
    dlg.showModal();
    confirmBtn.focus();
  }

  /** Replayed download: all components start at once and fill continuously (every display frame), with a
      gentle wave in speed like a real download; small files finish first, the model last. Nothing is fetched. */
  async function fetchOne(c, id) {
    const bar = c.li.querySelector('.bar'), prog = c.li.querySelector('.get-progress'), size = c.li.querySelector('.get-size');
    c.li.classList.add('active');
    const total = c.bytes > 1e9 ? 4200 : c.bytes > 1e5 ? 1400 : 900;   // replay length in ms
    const phase = Math.random() * Math.PI;                                 // each bar waves differently
    let lastPct = -1, alive = true;
    await tween(total, u => {
      if (!alive || id !== token) { alive = false; return; }
      // Monotonic progress whose speed swings between about 0.4x and 1.6x of the average.
      const p = Math.min(1, Math.max(0, u - 0.6 / (4 * Math.PI) * (Math.sin(4 * Math.PI * u + phase) - Math.sin(phase))));
      bar.style.width = (p * 100).toFixed(2) + '%';
      const pct = Math.round(p * 100);
      if (pct !== lastPct) { prog.setAttribute('aria-valuenow', String(pct)); lastPct = pct; }
      size.textContent = `${fmt(c.bytes * p)} / ${c.size}`;
    });
    if (!alive || id !== token) return false;
    bar.style.width = '100%';
    c.li.classList.replace('active', 'done');
    size.textContent = `${c.size} ✓`;
    return true;
  }

  async function download() {
    const id = ++token, cfg = SETUPS[key];
    confirmBtn.hidden = true;
    dlg.classList.add('downloading');
    $('#getTitle').textContent = 'Downloading the experiment components';
    cancelBtn.focus();
    let left = cfg.components.length;
    statusEl.textContent = `Downloading ${left} components…`;
    const results = await Promise.all(cfg.components.map(c => fetchOne(c, id).then(ok => {
      if (ok && --left) statusEl.textContent = `${c.name} downloaded · ${left} still downloading…`;
      return ok;
    })));
    if (id !== token || results.includes(false)) return;
    downloaded[key] = true;
    statusEl.textContent = 'All components downloaded.';
    cancelBtn.hidden = true;   // nothing left to cancel
    await wait(550);
    if (id !== token) return;
    dlg.close();
    enter(cfg);
  }

  function enter(cfg) {
    Drawer.close();
    audit.hidden = true;
    $('#s2Title').textContent = AUDITS[key].title;
    view.hidden = false;
    setStep(3);
    $('#s2Title').focus({ preventScroll: true });
    // Replay the saved rerun (rerun.js). If its scripts failed to load, say so instead of leaving the panel blank.
    try { Rerun.show(key).catch(showStage2Error); }
    catch (err) { showStage2Error(err); }
  }

  function showStage2Error(err) {
    console.error(err);
    const box = $('#claims');
    box.replaceChildren(el('li', 'claim-error', 'The rerun results could not be loaded. Reload the page (Cmd/Ctrl + Shift + R) and try again.'));
  }

  function abort() {   // Cancel or Escape; also stops a running download
    token++;
    if (dlg.open) dlg.close();
  }

  confirmBtn.addEventListener('click', download);
  cancelBtn.addEventListener('click', abort);
  dlg.addEventListener('cancel', abort);
  function back() {
    Rerun.stop();
    Drawer.close();
    view.hidden = true;
    audit.hidden = false;
    setStep(2);
    $('#headNext').focus({ preventScroll: true });
  }

  return { open: ask, back };
})();
