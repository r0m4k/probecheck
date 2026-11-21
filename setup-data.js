/* Stage 2 entry: what has to be downloaded before the experiment can be reproduced.
   Sources, revisions, and sizes were read from the Hugging Face and GitHub APIs on 21 Nov 2026
   (meta-llama/Llama-2-7b-hf @ 01c7f73; saprmarks/geometry-of-truth @ 5d1c630).
   Only papers that pass Stage 1 have an entry. */

const SETUPS = {
  got: {
    components: [
      { name: 'Model', icon: 'model', what: 'LLaMA-2-7B', from: 'Hugging Face', bytes: 13477e6, size: '13.5 GB' },
      { name: 'Dataset', icon: 'data', what: 'True/false statement datasets', from: 'GitHub', bytes: 443e3, size: '443 KB' },
      { name: 'Probe training code', icon: 'probe', what: 'From the authors’ repository', from: 'GitHub', bytes: 14.1e3, size: '14 KB' }
    ]
  }
};
