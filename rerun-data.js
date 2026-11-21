/* Stage 2, part A: results of the real rerun, replayed in the page.
   Source: experiment/results_cities_7b.json (rerun_cities.py, 21 Nov 2026): LLaMA-2-7B, layer 13,
   10 random 80/20 splits (seeds 0-9). Paper values read from Fig. 11 (App. D) of Marks & Tegmark.
   Scope: logistic-regression (LR) probes only; the paper also reports mass-mean and CCS probes,
   which the rerun computed but the page does not show. Accuracies in %. Nothing here is estimated. */

const RERUNS = {
  got: {
    provenance: 'Local run, 21 Nov 2026 · LLaMA-2-7B, layer 13 · logistic-regression probe · 10 random splits · vs. Fig. 11',
    pipeline: [
      { name: 'Load model', icon: 'model', run: 'Loading 13.5 GB of weights…', ms: 1100 },
      { name: 'Extract activations', icon: 'extraction', run: 'Extracting…', ms: 1800 },
      { name: 'Train the probe', icon: 'probe', run: 'split', count: 10, ms: 1600 },
      { name: 'Compare with the paper', icon: 'compare', run: 'Comparing…', ms: 700 },
      { name: 'Test alternative hypotheses', icon: 'flask', run: 'Testing…', alt: true }   // run by alt.js after the results
    ],
    // Claim-level verdicts; each cites the table rows it rests on. A claim is reproduced if the paper's
    // value lies within the rerun's range over 10 splits, ± 3 points (the figure gives whole numbers, no spread).
    claims: [
      { text: 'The probe separates true from false city statements',
        paper: '99%', rerun: '99.1–99.5%', verdict: 'ok', label: 'Reproduced',
        rows: [0, 2],
        explain: 'In the paper, a probe trained to tell true from false city statements, such as “The city of Tokyo is in Japan,” labels 99% of new statements correctly, whether it learns from ordinary statements alone or from ordinary and negated statements together. This means the model’s internal activations carry a clear, simple signal that separates true from false statements of this kind. In our rerun, the probe was trained from scratch ten times, each time on a different random 80% of the statements, and tested on the remaining 20%. On average it labelled 99.5% of unseen statements correctly when trained on ordinary statements (99.0% to 100% across the ten runs) and 99.1% with negations added (98.3% to 99.7%). The paper’s 99% falls inside both ranges, so the result holds up.' },
      { text: 'Trained on cities, it flips on negations',
        paper: '0%', rerun: '0.4% (0.2–0.6)', verdict: 'ok', label: 'Reproduced',
        rows: [1],
        explain: 'In the paper, a probe trained only on ordinary city statements gets 0% of negated statements right, such as “The city of Tokyo is not in Japan.” A score of 0% is not random guessing, which would land near 50%: the probe gives the opposite answer almost every time. This means that what the probe learned from ordinary statements is not a general sense of “true”; on negated statements it points the wrong way. In our rerun, the probe trained the same way was tested on all 1,496 negated statements and scored 0.4% on average, between 0.2% and 0.6% across the ten runs. That is the same near-total flip the paper reports, so the result holds up.' },
      { text: 'Adding negations to training fixes it',
        paper: '97%', rerun: '98.0% (97.3–99.0)', verdict: 'ok', label: 'Reproduced',
        rows: [3],
        explain: 'In the paper, training the probe on ordinary and negated statements together fixes this: it then gets 97% of new negated statements right. The authors take this as evidence that learning from statements together with their opposites stops the probe from relying on features that only happen to match truth in one kind of sentence. In our rerun, the probe trained on both kinds of statements scored 98.0% on unseen negated statements on average, between 97.3% and 99.0% across the ten runs. That is about one point higher than the paper; the paper’s 97% sits 0.3 points below our lowest run, a gap small enough to come from different hardware or random splits, so the result holds up.' }
    ],
    // Every compared value: training data, test data, paper, rerun mean, sd, min, max.
    table: [
      ['cities', 'cities', 99, 99.5, 0.3, 99.0, 100.0],
      ['cities', 'neg_cities', 0, 0.4, 0.1, 0.2, 0.6],
      ['cities + neg_cities', 'cities', 99, 99.1, 0.4, 98.3, 99.7],
      ['cities + neg_cities', 'neg_cities', 97, 98.0, 0.6, 97.3, 99.0]
    ]
  }
};
