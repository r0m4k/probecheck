/* Data quality summary shown at the top of the Stage 2 activation viewer ("show activations and data
   quality summary"). Every number comes from experiment/alt/data_quality_check.py (results in
   data_quality_check.json): training data cities + neg_cities, splits rebuilt exactly as the authors'
   DataManager makes them, averaged over the 10 seeds of the rerun. */

const DATA_QUALITY = {
  got: {
    counts: false,   // no count line next to the title
    groups: [
      { name: 'Bugs and errors', tone: 'ok', countText: 'no leakage',
        items: [
          { text: 'No leakage found. None of the 2,992 training statements is duplicated, and no test statement also appears in training.' },
          { text: 'Each statement and its negation, such as “The city of Krasnodar is in Russia.” and “The city of Krasnodar is not in Russia.”, always land on the same side of the split, so a test statement’s negation is never in training.' }
        ] },
      { name: 'How similar the test and training data are', tone: 'part', countText: 'test data close to training data',
        items: [
          { text: 'The held-out test uses the same two sentence templates as training: “The city of X is in Y.” and “The city of X is not in Y.”' },
          { text: '78.1% of test statements name a city that also appears in training (each city has one true and one false statement), and 98.2% name a country that does.' },
          { text: 'So the held-out test is in distribution: a high score on it cannot show that the probe works on statements built differently.' }
        ] },
      { name: 'Concepts absent from the training data', tone: 'miss', countText: '3 alternative hypotheses tested',
        items: [
          { text: 'Other languages and scripts: all 2,992 training statements are in English, and none uses a non-Latin script.' },
          { text: 'Negation without “not”: “not” is the only negation word in the training data.' },
          { text: 'Places from the past: no training statement contains a date or a year.' }
        ] }
    ]
  }
};
