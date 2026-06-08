export type SayItResultType = "translation" | "correction" | "clarification" | "error";

export type SayItRequest = {
  text: string;
  pending_text?: string;
  clarification?: string;
};

export type SayItResponse = {
  type: SayItResultType;
  display_text: string;
  english_text: string;
  question: string;
  options: string[];
  explanation: string;
};
