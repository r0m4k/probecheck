# ProbeCheck

**Live site:** https://r0m4k.github.io/probecheck/

ProbeCheck reveals the *seams* in linear probe experiments: the gaps between what an experiment reports and what can
actually be checked. It shows what is missing to rerun an experiment, reruns it to see whether the results hold, and tests
alternative hypotheses on new data to see whether the probe detects what the paper claims. A research prototype for
mechanistic interpretability researchers, built on Seamful XAI (Ehsan et al., 2024).

The site is static and self-contained: every result is pre-computed and stored in the JavaScript data files, and the
animations replay those results. Nothing is computed or fetched at runtime.

## Where the results come from
- **Stage 1 (reproducibility):** a review of each paper and its released code (`audit-data.js`).
- **Stage 2 (rerun):** LLaMA-2-7B (`meta-llama/Llama-2-7b-hf` @ `01c7f73`), layer 13, logistic-regression probes trained
  with the authors' code (`saprmarks/geometry-of-truth` @ `5d1c630`) over 10 random 80/20 splits (`rerun-data.js`).
- **Alternative hypotheses:** new test statements generated for each hypothesis and read by the same trained probes at the
  last token, as in the paper (`alt-data.js`, `alt-readings.js`). Predictions and the decision rule were written down
  before each test was run.

## Papers and credits
The two papers in `papers/` are redistributed under their CC BY 4.0 licences:
- Cunningham et al., *Constitutional Classifiers++*, arXiv:2601.04603 (2026). https://arxiv.org/abs/2601.04603
- Marks & Tegmark, *The Geometry of Truth: Emergent Linear Structure in Large Language Model Representations of True/False Datasets*,
  arXiv:2310.06824 (COLM 2024). https://arxiv.org/abs/2310.06824

Code excerpts shown by "show code" and the city statements come from https://github.com/saprmarks/geometry-of-truth
(commit `5d1c630`); credit to its authors. The PDF viewer uses pdf.js 3.11.174 (Apache 2.0), bundled in `vendor/`.
Seams: Ehsan, Liao, Passi, Riedl & Daumé III, *Seamful XAI: Operationalizing Seamful Design in Explainable AI*, arXiv:2211.06753.

## Run locally
Open a terminal in this folder and run `python3 -m http.server`, then visit http://localhost:8000/.
