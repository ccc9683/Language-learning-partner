export type LearningItemType = "word" | "sentence";

export type LearningItem = {
  id: number;
  type: LearningItemType;
  source_text: string;
  target_text: string | null;
  phonetic: string | null;
  part_of_speech: string | null;
  meaning: string | null;
  detail_json: string | null;
  note: string | null;
  favorite: number;
  review_count: number;
  last_reviewed_at: string | null;
  unique_key: string;
  created_at: string;
  updated_at: string;
};

export type LearningItemCreate = {
  type: LearningItemType;
  source_text: string;
  target_text?: string | null;
  phonetic?: string | null;
  part_of_speech?: string | null;
  meaning?: string | null;
  detail_json?: string | null;
  note?: string | null;
};
