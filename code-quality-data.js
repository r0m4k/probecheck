/* Code quality summary shown at the top of the Stage 2 code viewer ("show code and code quality summary").
   Written by hand from a review of the authors' code at commit 5d1c630; every effect stated was measured on our local rerun.
   Keep it to what was checked: do not add findings that were not tested. */

const CODE_QUALITY = {
  got: {
    counts: false,   // no count line next to the title
    groups: [
      { name: 'Bugs and errors', tone: 'ok', count: ['bug', 'bugs'],
        items: [
          { text: 'None found in the code that produced the results. The authors’ probe, data-split, and activation code ran unchanged in our rerun, and the probe’s accuracy matched the paper on all three claims.' }
        ] },
      { name: 'Choices that may affect the results', tone: 'part', count: ['choice that may affect results', 'choices that may affect results'],
        items: [
          { text: 'The train/test split seed is drawn at random and never saved, so the exact results from the paper cannot be recovered.' },
          { text: 'The LR probe uses fixed settings (1,000 full-batch steps, learning rate 0.001, weight decay 0.1). There is no separate validation split for tuning them or specified procedure in the paper for that.' }
        ] }
    ],
    // Added to "Next actions based on identified seams" once the reproduction results are in.
    next: [
      { title: 'Find the seed behind the paper’s results',
        why: 'The split seed was drawn at random (from 0 to 10,000) and never saved. Try seeds until the splits reproduce the paper’s numbers, then verify the results on that exact split.',
        action: { type: 'code', label: 'Show code' } },
      { title: 'Tune the probe’s hyperparameters',
        why: 'The probe is trained with fixed settings and no tuning procedure. Write a hyperparameter search over the learning rate, weight decay, and number of steps on a separate validation split, then rerun the experiment with the best settings.',
        action: { type: 'code', label: 'Show code' } }
    ]
  }
};
