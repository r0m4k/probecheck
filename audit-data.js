/* Pre-saved reproducibility findings, one entry per paper.
   Status per item:
     "Reported"            stated in the paper
     "In code"             paper is silent, but the released code states it
     "Gated"               available on request (e.g. a model licence)
     "Partially reported"  stated, but incomplete
     "Not reported"        stated nowhere
     "Restricted"          stated, but not accessible (proprietary / unreleased)
   seam (per card): what reproduction expects vs. what the paper actually provides.
   required: true marks details a rerun cannot proceed without.
   ask: the question to put to the authors when the item is not fully reported.
   find: short phrases from the paper; the reader highlights each whole sentence
         that contains one. Items without `find` have no passage in the paper.
   Notes were checked against the paper text (and, where marked, the released
   code at github.com/saprmarks/geometry-of-truth). */

const AUDITS = {
  cc: {
    title: 'Constitutional Classifiers++',
    pdf: 'papers/cc.pdf', url: 'https://arxiv.org/abs/2601.04603',
    meta: 'Cunningham et al. · 2026 · arXiv:2601.04603',
    contact: { names: ['Hoagy Cunningham', 'Jerry Wei'], emails: ['hoagy@anthropic.com', 'jerry@anthropic.com'], source: 'p. 1, “Correspondence to” note' },
    groups: [
      { name: 'Model', icon: 'model',
        seam: { expected: "The probed model is identifiable and its weights can be accessed.", found: "Proprietary Claude Sonnet 4 / 4.5; no snapshot, precision, or access is given." },
        summary: 'Probes read proprietary Claude models; no snapshot, precision, or weight access is given.',
        items: [
          { name: 'Base model & version', ask: "Which Claude Sonnet 4 snapshot were the analysis probes trained on, and which Claude Sonnet 4.5 snapshot does the production probe use?", required: true, status: 'Partially reported',
            find: ['We train a linear probe on top of a Claude Sonnet 4', 'The linear probe uses activations from Claude Sonnet 4', 'is used to guard Claude Sonnet 4.5', 'the probe uses activations from that model'],
            note: 'The analysis probe reads Claude Sonnet 4 (§5.2); the production probe reads Claude Sonnet 4.5 (§6). No snapshot or version identifier is given.', ref: '§5.2; §6' },
          { name: 'Weights access', ask: "Is there any way for external researchers to obtain these activations, or an open model on which the probing results can be replicated?", required: true, status: 'Restricted',
            note: 'Claude Sonnet 4 and 4.5 are proprietary Anthropic models; the paper offers no weight access or open substitute.', ref: '§5.2; §6' },
          { name: 'Precision', ask: "In what numeric precision were activations extracted and the probe trained (e.g. bf16 or fp32)?", status: 'Not reported',
            note: 'No numeric precision (e.g. bf16, fp32) or quantization is stated for the model or the probe.', ref: 'Not found in the paper' }
        ] },
      { name: 'Data', icon: 'data',
        seam: { expected: "The training data and labels can be obtained or rebuilt.", found: "The synthetic data and the labelling classifier are unreleased; training-set size is missing." },
        summary: 'Training data and the labelling classifier are not released; training-set size is missing.',
        items: [
          { name: 'Probing dataset', ask: "Could you release the synthetic CBRN exchange dataset (or a representative sample), or describe its generation in enough detail to rebuild it?", required: true, status: 'Restricted',
            find: ['Both systems are trained on synthetic data following Sharma et al.', 'we employ the same training data as in the previous section'],
            note: 'Synthetic CBRN exchange data generated following Sharma et al. (2025); described only briefly and not released.', ref: '§3; §5.2' },
          { name: 'Concept & labels', ask: "Could you share the soft labels, or the constitution of the classifier that produced them, and explain how the soft-label targets were computed?", required: true, status: 'Partially reported',
            find: ['indicates the presence of harmful content requiring refusal', 'these labels are exchange-level labels', 'exchange-level soft labels produced by a Constitutional Classifier', 'either distilling with soft-labels or using hard labels'],
            note: 'Label 1 means harmful content requiring refusal, judged per exchange. Probe targets are soft labels from a Constitutional Classifier fine-tuned from Claude Sonnet 4, which is not released.', ref: '§5.1; §5.2, fn. 5' },
          { name: 'Splits & sizes', ask: "How many exchanges are in the full exchange dataset, how many were used for probe training (the ~25%), and what was the class balance?", status: 'Partially reported',
            find: ['train on ca. 25% of the full exchange dataset', 'comprising approximately 7,000 exchanges', 'never used for classifier training'],
            note: 'Training uses about 25% of an exchange dataset whose size is not given; testing uses ~7,000 red-team exchanges from red-teamers not used in training. Class balance is not given.', ref: '§5.2' },
          { name: 'Input format', ask: "What chat template or formatting was applied to exchanges before activations were extracted?", status: 'Partially reported',
            find: ['between a user and an AI assistant', 'maximum context length of 20K tokens'],
            note: 'Inputs are whole user–assistant exchanges, truncated to 20K tokens for the §5.2 analysis; the chat template and formatting are not given.', ref: '§5.1; §5.2' }
        ] },
      { name: 'Activation extraction', icon: 'extraction',
        seam: { expected: "The layers and the site inside each layer are stated.", found: "All layers and per-token reading are clear; the site within each layer is not." },
        summary: 'All layers and per-token reading are clear, but the site within each layer is not stated.',
        items: [
          { name: 'Probe location', ask: "Which activations are read at each layer: the residual stream, the attention output, or the MLP output, and before or after layer normalization?", required: true, status: 'Partially reported',
            find: ['to produce intermediate activations', 'For multi-layer probing, we concatenate activations', 'using concatenated activations across all layers', 'Our default probe uses all layers'],
            note: 'Layers: activations from all layers are concatenated by default. Site: only “intermediate activations” at each layer; residual stream vs. attention or MLP output is not stated.', ref: '§5.1, Eq. 1; §5.2' },
          { name: 'Token position', required: true, status: 'Reported',
            find: ['predict the exchange-level harmfulness at each token position', 'we average logits over a sliding window of M tokens during training', 'During inference, we use an exponential moving average'],
            note: 'A prediction at every token: logits are averaged over a 16-token sliding window in training and an exponential moving average at inference.', ref: '§5.1, Eqs. 1–2; §5.2' },
          { name: 'Preprocessing', ask: "Were activations centered, normalized, or otherwise transformed before probing?", status: 'Not reported',
            note: 'No centering, normalization, or dimensionality reduction of activations is described.', ref: 'Not found in the paper' }
        ] },
      { name: 'Probe training', icon: 'probe',
        seam: { expected: "Probe and optimization settings are fully specified.", found: "Probe form and loss are given; optimizer settings and seeds are missing." },
        summary: 'Probe form and loss are well specified; optimizer settings and seeds are missing.',
        items: [
          { name: 'Probe type', required: true, status: 'Reported',
            find: ['W and b are learnable parameters', 'We employ a softmax-weighted loss'],
            note: 'A linear probe with weights and bias and a sigmoid output, trained with a softmax-weighted per-token binary cross-entropy loss.', ref: '§5.1, Eqs. 1–4' },
          { name: 'Hyperparameters', ask: "Which optimizer, learning rate, number of epochs, batch size, regularization, and EMA decay were used?", required: true, status: 'Partially reported',
            find: ['For probe training, we use softmax temperature'],
            note: 'Softmax temperature τ = 1 and window M = 16 are given; optimizer, learning rate, epochs, batch size, regularization, and the EMA decay are not.', ref: '§5.2' },
          { name: 'Seeds & variance', ask: "How many training runs or seeds were used, and how much did the reported results vary across them?", status: 'Not reported',
            note: 'No seeds, repeated runs, error bars, or confidence intervals are reported.', ref: 'Not found in the paper' }
        ] }
    ]
  },

  got: {
    title: 'The Geometry of Truth',
    pdf: 'papers/got.pdf', url: 'https://arxiv.org/abs/2310.06824',
    meta: 'Marks & Tegmark · 2023 · arXiv:2310.06824',
    contact: { names: ['Samuel Marks'], emails: ['s.marks@northeastern.edu'], source: 'p. 1, author block' },
    groups: [
      { name: 'Model', icon: 'model',
        seam: { expected: "The exact checkpoint, precision, and access route are stated.", found: "LLaMA-2 sizes are named; checkpoints and precision appear only in code; weights need a licence." },
        summary: 'LLaMA-2 sizes are named; the code supplies the exact repos and precision. Weights need a licence request.',
        items: [
          { name: 'Base model & version', ask: "Were the base (not chat) LLaMA-2 checkpoints used, and which exact Hugging Face revisions?", required: true, status: 'Partially reported',
            find: ['Working with autoregressive transformers from the LLaMA-2 family', 'When visualizing LLaMA-2-13B and 70B representations', 'While MM underperforms LR and CCS for LLaMA-2-7B'],
            note: 'LLaMA-2 7B, 13B, and 70B are used. Base vs. chat and exact checkpoints are not stated; the code loads the meta-llama/Llama-2-*-hf repositories.', ref: '§1, §4, App. D; config.ini' },
          { name: 'Weights access', required: true, status: 'Gated',
            note: 'The paper does not say how to obtain weights; the code asks for your own LLaMA weights or a Hugging Face repo. LLaMA-2 on Hugging Face requires accepting Meta’s licence.', ref: 'README.md; config.ini' },
          { name: 'Precision', ask: "Is the bfloat16 setting in generate_acts.py the precision used for the reported results?", status: 'In code',
            note: 'The paper is silent. The code loads the model in bfloat16 when run locally and casts activations to float32 before probing.', ref: 'generate_acts.py; utils.py' }
        ] },
      { name: 'Data', icon: 'data',
        seam: { expected: "Datasets, labels, and splits are available.", found: "Datasets, labels, and the 80/20 split are described and released; balance is stated only for some." },
        summary: 'Datasets, construction, labels, and the 80/20 split are described and released.',
        items: [
          { name: 'Probing dataset', required: true, status: 'Reported',
            find: ['Our code, datasets, and an interactive dataexplorer are available', 'information about their construction is in App'],
            note: 'Curated, uncurated, and “likely” datasets with templates and row counts (Table 1) and construction details (App. H); released with the code.', ref: '§1, §2, Table 1, App. H' },
          { name: 'Concept & labels', required: true, status: 'Reported',
            find: ['to mean factuality', 'For each city, we generated one true statement and one false statement', 'went through the dataset by hand', 'labeled by humans as being true, false, or neither'],
            note: '“Truth” means the factuality of simple statements. Most labels follow from templates (one true and one false statement per city); sp_en_trans was hand-checked, and CommonClaim uses human labels.', ref: '§2, App. A, App. H' },
          { name: 'Splits & sizes', ask: "Could you confirm the class balance of each dataset, and which file versions match Table 1 (e.g. cities_cities_conj has 1,498 rows in the repository vs. 1,500 in Table 1)?", status: 'Partially reported',
            find: ['we train our probe on a random 80% split', 'we use the remaining 20% of the data', 'balanced between true and false statements', 'removing excess true statement to balance the dataset'],
            note: 'Row counts (Table 1) and a random 80/20 split are given; class balance is stated only for some datasets, and some released files differ slightly from Table 1 (e.g. cities_cities_conj: 1,498 vs. 1,500 rows).', ref: 'Table 1; §5.2; App. H' },
          { name: 'Input format', status: 'Reported',
            find: ['we do not prepend the statements with a few-shot prompt', 'We formed these statements from the template'],
            note: 'Bare templated statements (e.g. “The city of [city] is in [country].”) with no few-shot prompt; §5.2 extracts activations “as in §4”.', ref: '§4; §5.2; App. H' }
        ] },
      { name: 'Activation extraction', icon: 'extraction',
        seam: { expected: "Layer, site, and token position are stated for every model.", found: "Residual stream, final-period token, and centering are clear; the layer is given only for 13B." },
        summary: 'Residual stream, token position, and centering are clear; the layer is stated only for 13B in the text.',
        items: [
          { name: 'Probe location', ask: "Which probing layers were used for LLaMA-2-7B and 70B, and does \u201clayer 15\u201d for 13B refer to the output of the 15th block (layers[14] in the code)?", required: true, status: 'Partially reported',
            find: ['layer 15 residual stream activation', 'we will extract activations at the most-downstream hidden state'],
            note: 'Site: residual stream. Layer: the most downstream “group (b)” state from patching, numbered in the text only for 13B (layer 15). The code reads block outputs layers[13] (7B), [14] (13B), [27] (70B), counted from 0.', ref: '§3, §4, §5.2; config.ini' },
          { name: 'Token position', required: true, status: 'Reported',
            find: ['residual stream activation over the end-of-sentence punctuation token'],
            note: 'Activations over the end-of-sentence punctuation token (the final period); the code takes the last position of each statement.', ref: '§4, fn. 3; generate_acts.py' },
          { name: 'Preprocessing', status: 'Reported',
            find: ['we also center the activations by subtracting off their mean', 'we always center our data and use unbiased probes'],
            note: 'Activations are centered per dataset by subtracting the mean; no scaling is described (the code uses center=True, scale=False).', ref: '§4; §5.2, fn. 5; utils.py' }
        ] },
      { name: 'Probe training', icon: 'probe',
        seam: { expected: "Probe and optimization settings are fully specified.", found: "Probe types are defined; optimizer settings are only in code; no seeds or error bars." },
        summary: 'Probe types are defined; optimizer settings appear only in code, and seeds are not given.',
        items: [
          { name: 'Probe type', required: true, status: 'Reported',
            find: ['Our probing techniques are logistic regression', 'we always center our data and use unbiased probes', 'We call the probes'],
            note: 'Logistic regression, mass-mean probes (plain, and an IID version equivalent to LDA), and CCS; all probes have no bias term.', ref: '§5.1–5.2, fn. 5' },
          { name: 'Hyperparameters', ask: "Are the probes.py defaults (AdamW, lr 1e-3, weight decay 0.1, 1,000 full-batch steps) the settings behind the reported results?", required: true, status: 'In code',
            note: 'The paper gives none. The code trains LR and CCS with AdamW (lr 1e-3, weight decay 0.1) for 1,000 full-batch steps; mass-mean needs no optimizer.', ref: 'probes.py' },
          { name: 'Seeds & variance', ask: "Which random seeds were used for the 80/20 splits, and how much did accuracies vary across splits?", status: 'Not reported',
            note: 'One random 80/20 split; no seeds, repeated runs, or error bars are reported. The code draws a random seed when none is given.', ref: '§5.2–5.3; utils.py' }
        ] }
    ]
  }
};
