export type PartnerRole = "user" | "assistant";

export type PartnerMessage = {
  id: number;
  role: PartnerRole;
  content: string;
  created_at: string;
};

export type PartnerMemory = {
  name: string;
  level: string;
  favorite_topics: string[];
  style: string;
};

export type PartnerHistoryResponse = {
  messages: PartnerMessage[];
  memory: PartnerMemory;
};

export type PartnerChatResponse = {
  reply: string;
  updated_memory: PartnerMemory;
};

export type PartnerClearMemoryResponse = {
  ok: boolean;
  memory: PartnerMemory;
};
