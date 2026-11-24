/* ProbeCheck study flow: consent → seams (one at a time) → timed prototype session (think aloud)
   → open questions (answered aloud, recorded by the interviewers) → finish.
   Nothing is stored or sent: this page only guides the session. */

(() => {
  const $ = s => document.querySelector(s);
  const SCREENS = ['consent', 'seams', 'session', 'questions', 'done'];

  // Fill the editable study details into the consent text.
  document.querySelectorAll('[data-fill]').forEach(e => { e.textContent = STUDY[e.dataset.fill]; });

  function show(name, focus) {
    SCREENS.forEach(s => { $('#' + s).hidden = s !== name; });
    const at = SCREENS.indexOf(name);
    document.querySelectorAll('.study-steps li').forEach((li, i) => {
      li.classList.toggle('current', i === at);
      li.classList.toggle('done', i < at);
      i === at ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current');
    });
    document.body.dataset.screen = name;
    window.scrollTo(0, 0);
    if (focus) $(focus).focus({ preventScroll: true });
  }

  const dots = (box, n, at) => {
    box.replaceChildren(...Array.from({ length: n }, (_, i) => {
      const d = document.createElement('span');
      d.className = 'dot' + (i === at ? ' on' : i < at ? ' seen' : '');
      return d;
    }));
  };

  /* 1. Consent: both boxes must be ticked. */
  const go = $('#consentGo'), boxes = [$('#agreeStudy'), $('#agreeRecord')];
  const ready = () => boxes.every(b => b.checked);
  boxes.forEach(b => b.addEventListener('change', () => {
    go.setAttribute('aria-disabled', String(!ready()));
    if (ready()) $('#consentHint').textContent = '';
  }));
  go.addEventListener('click', () => {
    if (!ready()) { $('#consentHint').textContent = 'Please tick both boxes to continue.'; return; }
    seam = 0; renderSeam(); show('seams', '#seamTitle');
  });

  /* 2. Seams, one at a time. */
  let seam = 0;
  function renderSeam() {
    const s = STUDY.seams[seam], n = STUDY.seams.length;
    $('#seamCount').textContent = `Seam ${seam + 1} of ${n}`;
    $('#seamStage').textContent = `AI lifecycle stage: ${s.stage}`;
    $('#seamTitle').textContent = s.title;
    $('#seamExpected').textContent = s.expected;
    $('#seamReality').textContent = s.reality;
    dots($('#seamDots'), n, seam);
    $('#seamPrev').disabled = seam === 0;
    $('#seamNext').textContent = seam === n - 1 ? 'Start the prototype session →' : 'Next seam →';
  }
  $('#seamPrev').addEventListener('click', () => { if (seam > 0) { seam--; renderSeam(); $('#seamTitle').focus(); } });
  $('#seamNext').addEventListener('click', () => {
    if (seam < STUDY.seams.length - 1) { seam++; renderSeam(); $('#seamTitle').focus(); }
    else startSession();
  });

  /* 3. Timed prototype session. The prototype runs unchanged inside the frame. */
  let timer = 0, endsAt = 0;
  const fmt = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  function startSession() {
    $('#protoFrame').src = 'prototype.html';
    $('#timeUp').hidden = true;
    endsAt = Date.now() + STUDY.sessionMinutes * 60 * 1000;
    let lastMinute = null;
    const tick = () => {
      const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      $('#timer').textContent = fmt(left);
      $('#timer').classList.toggle('low', left <= 120);
      const minute = Math.ceil(left / 60);
      if (minute !== lastMinute && (minute <= 2 || minute % 5 === 0)) {
        $('#timerStatus').textContent = minute === 0 ? 'Time is up' : `${minute} minute${minute === 1 ? '' : 's'} left`;
        lastMinute = minute;
      }
      if (left === 0) { clearInterval(timer); $('#timeUp').hidden = false; $('#timeUpGo').focus(); }
    };
    clearInterval(timer);
    tick();
    timer = setInterval(tick, 1000);
    show('session');
  }
  function endSession() {
    clearInterval(timer);
    $('#protoFrame').src = 'about:blank';
    question = 0; renderQuestion(); show('questions', '#questionText');
  }
  $('#sessionDone').addEventListener('click', endSession);
  $('#timeUpGo').addEventListener('click', endSession);

  /* 4. Open questions, answered aloud. */
  let question = 0;
  function renderQuestion() {
    const q = STUDY.questions[question], n = STUDY.questions.length;
    const seamOf = q.seam != null ? ` · Seam ${q.seam + 1} of ${STUDY.seams.length}` : '';
    $('#questionCount').textContent = `Question ${question + 1} of ${n}${seamOf}`;
    $('#questionText').textContent = q.text;
    const box = $('#questionSeam');
    box.hidden = q.seam == null;
    if (q.seam != null) {   // same content and layout as the seam screens, below the question
      const s = STUDY.seams[q.seam];
      $('#qSeamStage').textContent = `AI lifecycle stage: ${s.stage}`;
      $('#qSeamTitle').textContent = s.title;
      $('#qSeamExpected').textContent = s.expected;
      $('#qSeamReality').textContent = s.reality;
    }
    dots($('#questionDots'), n, question);
    $('#questionPrev').disabled = question === 0;
    $('#questionNext').textContent = question === n - 1 ? 'Finish' : 'Next question →';
  }
  $('#questionPrev').addEventListener('click', () => { if (question > 0) { question--; renderQuestion(); $('#questionText').focus(); } });
  $('#questionNext').addEventListener('click', () => {
    if (question < STUDY.questions.length - 1) { question++; renderQuestion(); $('#questionText').focus(); }
    else show('done', '#doneTitle');
  });

  /* 5. Finish; the interviewer can reset the page for the next participant. */
  $('#restart').addEventListener('click', () => window.location.reload());

  show('consent');
})();
