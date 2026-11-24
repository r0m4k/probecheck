/* ProbeCheck study: everything a participant sees, in one place so it is easy to edit. */

const STUDY = {
  sessionMinutes: 15,
  totalMinutes: '30',

  // The seams participants review before using the prototype, one at a time,
  // in the order of the AI lifecycle: data collection & creation, model training, model testing.
  seams: [
    { stage: 'Data collection & creation',
      title: 'Training dataset sufficiently reflects the concept you are probing for',
      expected: 'The training dataset purely reflects the concept the probe is meant to detect.',
      reality: 'The activations may also reflect other concepts that the dataset does not test for, so the probe may learn those instead.' },
    { stage: 'Data collection & creation',
      title: 'The training and test sets may overlap or be too similar, so the probe is never tested in a sufficient manner',
      expected: 'The test shows whether the probe picks up the concept itself.',
      reality: 'The test set may share examples with the training set (data leakage), or come from the same distribution, so it shares the same confounds.' },
    { stage: 'Model training',
      title: 'The code behind the results may contain bugs',
      expected: 'The released code is correct and is the exact code that produced the reported results.',
      reality: 'The code may contain neglected bugs, errors, or mistakes.' },
    { stage: 'Model training',
      title: 'How the method is described may not match how it was run',
      expected: 'The written description of the method matches the training procedure that was actually used.',
      reality: 'The description is simplified, ambiguous, or incomplete, or significantly differs from the provided codebase.' },
    { stage: 'Model testing',
      title: 'Experimental decisions are buried or omitted in the paper',
      expected: 'Every decision needed to rerun the experiment, such as the layer, the token position, the data splits, and the hyperparameters, is stated clearly.',
      reality: 'These decisions are scattered across sections, footnotes, and appendices, or left out, so testing the model becomes infeasible.' }
  ],

  // Asked aloud after the session; the participant answers in their own words while being recorded.
  // First an overall impression, then one question per seam (in the order above, shown with the seam), then open feedback.
  questions: [
    { text: 'What is your overall impression of ProbeCheck, and how helpful could it be to researchers who work with linear probes?' },
    { seam: 0, text: 'How well does ProbeCheck address this seam? To what degree does it give you clear actions to act on it? What could be improved?' },
    { seam: 1, text: 'How well does ProbeCheck address this seam? To what degree does it give you clear actions to act on it? What could be improved?' },
    { seam: 2, text: 'How well does ProbeCheck address this seam? To what degree does it give you clear actions to act on it? What could be improved?' },
    { seam: 3, text: 'How well does ProbeCheck address this seam? To what degree does it give you clear actions to act on it? What could be improved?' },
    { seam: 4, text: 'How well does ProbeCheck address this seam? To what degree does it give you clear actions to act on it? What could be improved?' },
    { text: 'Is there any other feedback you would like to share?' }
  ]
};
