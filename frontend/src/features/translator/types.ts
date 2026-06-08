export type TranslateDetail = {
  headword: string;
  pos: string | null;
  meanings: string[];
  usages: Array<{
    pattern: string;
    example_en: string;
    example_zh: string;
  }>;
  synonyms: string[];
  common_mistakes: Array<{
    wrong: string;
    correct: string;
    note: string;
  }>;
};

export type TranslateResult = {
  kind: "term" | "text";
  chinese: string;
  ipa: string | null;
  part_of_speech: string | null;
  detail?: TranslateDetail | null;
};
