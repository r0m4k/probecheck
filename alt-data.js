/* Stage 2, part B: alternative hypotheses tested by the agent on newly generated data.
   Experiments: experiment/alt/ (PREDICTIONS.md was written before each dataset was generated).
   Probe under test: logistic regression trained on cities + neg_cities, LLaMA-2-7B, layer 13, ten random splits.
   Row numbers come from ALT_READINGS.scores (generated from the results); the paragraphs quote the same values.
   A hypothesis with several datasets ("parts") gets its verdict from the mean of their accuracies. */

const ALTS = {
  got: {
    control: 'control_cities',
    // Stage 2 additions to "Next steps based on identified seams" (Stage 1 steps come from app.js).
    next: [
      { title: 'Retrain the probe on more than English',
        why: 'Trained on English only, the probe is correct on 49.5–76.6% of statements in Bangla, Hindi, Chinese, and Japanese. Add statements in these languages to its training data and test it again.',
        action: { type: 'view', set: 'alt_lang_bn', label: 'See the statements' } },
      { title: 'Train it with negations that don’t use “not”',
        why: 'The probe is correct on 82.8% of statements that negate with “located outside”. Add other forms of negation, such as “outside” or “it is false that”, to its training data and test it again.',
        action: { type: 'view', set: 'alt_outside', label: 'See the statements' } },
      { title: 'Add places from the past to its training data',
        why: 'The probe is correct on 86.1% of statements about historical places, such as Leningrad in 1980. Add dated statements to its training data and test it again.',
        action: { type: 'view', set: 'alt_historical', label: 'See the statements' } }
    ],
    agent: [
      'Writing hypotheses and their predictions…',
      'Generating 2,056 new test statements…',
      'Extracting activations from LLaMA-2-7B…',
      'Reading the activations with the trained probe…',
      'Comparing the results with the predictions…'
    ],
    // Only hypotheses the tests confirmed or partly confirmed, most severe first (lowest accuracy first within a verdict).
    hypotheses: [
      { key: 'non_western', text: 'The probe may not work in non-Western languages', short: 'Non-Western languages',
        example: '東京は日本にあります。', gloss: 'Tokyo is in Japan.',
        parts: [
          { key: 'alt_lang_bn', name: 'Bangla' }, { key: 'alt_lang_hi', name: 'Hindi' },
          { key: 'alt_lang_zh', name: 'Chinese' }, { key: 'alt_lang_ja', name: 'Japanese' }
        ],
        explain: 'This hypothesis asks whether the probe, trained only on English statements, still recognizes true and false statements written entirely in other languages. The agent wrote 100 statements in each of Bangla, Hindi, Chinese and Japanese about the same 50 well-known cities, such as “東京は日本にあります。” (“Tokyo is in Japan.”) and “टोक्यो जापान में है।” On the original English statements the ten probes are right 99.1% of the time. In Chinese they were right 76.6% of the time and in Japanese 71.3%, while in Bangla (49.5%) and Hindi (55.2%) they did little or no better than chance. In Japanese the probe even reads some of the best-known facts, such as “Tokyo is in Japan”, as false. The probe potentially does not generalize to non-Western languages, so this hypothesis is confirmed.' },
      { key: 'alt_outside', text: 'The probe may recognize negation only through the word “not”', short: 'Negation without “not”',
        example: 'The city of Krasnodar is located outside South Africa.',
        explain: 'The paper fixes the probe’s failure on negated statements by adding statements with “not” to its training data. This hypothesis asks whether the fixed probe learned negation itself or only the word “not”. The agent rewrote all 1,496 city statements with “located outside” instead, so “The city of Krasnodar is located outside South Africa” is true and the word “not” never appears. The ten probes labelled 82.8% correctly on average (82.0% to 83.4%), well below the 98.0% they reach on negations written with “not”, and they missed true and false statements about equally often. The probe handles this unseen kind of negation only in part, so this hypothesis is partly confirmed.' },
      { key: 'alt_historical', text: 'The probe may not work for places from the past', short: 'Places from the past',
        example: 'In 1980, the city of Leningrad was in the Soviet Union.',
        explain: 'This hypothesis asks whether the probe only works for places as they are today. The agent wrote 31 statements about cities under their historical names and countries, such as “In 1980, the city of Leningrad was in the Soviet Union,” each with a false version. The ten probes labelled 86.1% correctly on average, between 82.3% and 90.3%: clearly below the 99.1% on present-day statements, but far above chance. Its mistakes include true statements such as “In 1955, the city of Stalingrad was in the Soviet Union” and false ones such as “In 1980, the city of Zagreb was in Pakistan.” The probe partly carries over to the past but becomes less reliable, so this hypothesis is partly confirmed.' }
    ]
  }
};
