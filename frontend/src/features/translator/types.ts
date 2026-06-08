export type TranslateResult = {
  kind: "term" | "text";
  chinese: string;
  ipa: string | null;
  part_of_speech: string | null;
};
