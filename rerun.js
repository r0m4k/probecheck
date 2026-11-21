/* Stage 2, part A: replay the saved rerun (pipeline steps one after another), then show
   claim-level verdicts; "explain" opens what the paper reported vs. what the rerun found.
   All numbers come from rerun-data.js; the animation only replays them. */

const Rerun = (() => {
  const pipe = $('#pipeline'), claimsEl = $('#claims'), status = $('#s2Status'), codeBtn = $('#resCode');
  const ICON_FLASK = '<path d="M9 3h6"/><path d="M10 3v6.2L4.6 18.4A1.7 1.7 0 0 0 6.1 21h11.8a1.7 1.7 0 0 0 1.5-2.6L14 9.2V3"/><path d="M7.2 15h9.6"/>';
  const ICON_COMPARE = '<path d="M12 4v16M5 20h14"/><path d="M4 9h6l-3-5zM14 9h6l-3-5z"/><path d="M4 9a3 3 0 0 0 6 0M14 9a3 3 0 0 0 6 0"/>';
  let token = 0;

  function stepFor(s) {
    const li = el('li', 'pipe-step');
    li.dataset.state = 'waiting';
    li.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${s.icon === 'compare' ? ICON_COMPARE : s.icon === 'flask' ? ICON_FLASK : ICONS[s.icon]}</svg>`;
    const text = el('span', 'pipe-text');
    text.append(el('strong', null, s.name));
    li.append(text, el('span', 'pipe-state', 'Waiting'));
    return li;
  }

  function claimRow(c, i) {
    const li = el('li', 'claim');
    const top = el('div', 'claim-top');
    top.append(el('span', 'claim-text', c.text), el('span', 'chip ' + c.verdict, c.label));
    const nums = el('div', 'claim-nums');
    nums.append(el('span', null, 'Paper '), el('b', null, c.paper), el('span', 'sep', ' · '), el('span', null, 'Rerun '), el('b', null, c.rerun));
    li.append(top, nums);
    if (c.explain) {
      // "explain": paper vs. rerun, shown in place; one explanation open at a time.
      const btn = el('button', 'comp-evidence claim-explain-btn', 'explain');
      btn.type = 'button';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', 'explain' + i);
      btn.setAttribute('aria-label', `Explain: ${c.text}`);
      const box = el('div', 'claim-explain');
      box.id = 'explain' + i; box.hidden = true;
      box.append(el('p', 'explain-text', c.explain));
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') !== 'true';
        claimsEl.querySelectorAll('.claim-explain-btn').forEach(b => {
          b.setAttribute('aria-expanded', 'false');
          $('#' + b.getAttribute('aria-controls')).hidden = true;
        });
        btn.setAttribute('aria-expanded', String(open));
        box.hidden = !open;
        if (open) box.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      });
      const links = el('span', 'claim-links');
      links.append(btn);
      li.append(links, box);
    }
    return li;
  }

  /** Gray placeholder rows, pulsing, one per claim, until the rerun results are in. */
  function loadingRows(n) {
    const rows = [];
    for (let k = 0; k < n; k++) {
      const li = el('li', 'claim claim-loading');
      li.setAttribute('aria-hidden', 'true');
      li.append(el('span', 'bar bar-text'), el('span', 'bar bar-chip'), el('span', 'bar bar-nums'));
      li.style.animationDelay = `${k * 0.15}s`;
      rows.push(li);
    }
    const note = el('li', 'claims-wait', 'Waiting for the rerun to finish…');
    return [note, ...rows];
  }

  async function show(key) {
    const r = RERUNS[key], id = ++token;
    if (!r) throw new Error(`No saved rerun for ${key}`);
    skipAnim = !!seen.rerun[key];   // seen before: show the results at once
    showSkip('#skip2', !skipAnim);
    pipe.replaceChildren(...r.pipeline.map(stepFor));
    claimsEl.replaceChildren(...loadingRows(r.claims.length));   // placeholder while the rerun replays
    if (typeof Alt !== 'undefined') Alt.wait(key);   // the hypotheses panel waits for the reproduction
    $('#resSum').textContent = '';
    codeBtn.hidden = true;
    codeBtn.setAttribute('aria-pressed', 'false');

    const steps = [...pipe.children];
    for (const [i, s] of r.pipeline.entries()) {
      if (s.alt) continue;   // the hypothesis tests run afterwards (alt.js)
      const li = steps[i], st = li.querySelector('.pipe-state');
      li.dataset.state = 'running';
      status.textContent = `${s.name}…`;
      if (s.count) {   // a counter that ticks up to the real size of the run
        const ticks = 12;
        for (let k = 1; k <= ticks; k++) {
          await wait(s.ms / ticks);
          if (id !== token) return;
          const n = Math.round(s.count * k / ticks);
          st.textContent = s.run === 'split' ? `Split ${n} of ${s.count}` : `${n.toLocaleString('en-US')} ${s.run}`;
        }
      } else {
        st.textContent = s.run;
        await wait(s.ms);
        if (id !== token) return;
      }
      li.dataset.state = 'done';
      st.textContent = 'Done';
    }

    claimsEl.replaceChildren();
    for (const [i, c] of r.claims.entries()) {
      await wait(260);
      if (id !== token) return;
      claimsEl.append(claimRow(c, i));
    }
    const reproduced = r.claims.filter(c => c.verdict === 'ok').length, unstable = r.claims.length - reproduced;
    $('#resSum').textContent = `${reproduced} of ${r.claims.length} claims reproduced${unstable ? ` · ${unstable} unstable` : ''}`;
    codeBtn.hidden = !CODE[key];
    codeBtn.onclick = () => { codeBtn.setAttribute('aria-pressed', 'true'); CodeView.show(key, r.claims); };
    status.textContent = `Rerun complete: ${reproduced} of ${r.claims.length} claims reproduced${unstable ? `, ${unstable} unstable across random splits` : ''}.`;
    if (typeof Alt !== 'undefined') Alt.run(key);    // then the agent's alternative-hypothesis tests
  }

  return { show, stop: () => { token++; skipAnim = false; showSkip('#skip2', false); if (typeof Alt !== 'undefined') Alt.stop(); } };
})();
