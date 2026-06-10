import type {
  PartnerChatResponse,
  PartnerClearMemoryResponse,
  PartnerHistoryResponse
} from "./types";

export const PARTNER_ENDPOINT = "/api/partner";

export async function getPartnerHistory(limit = 30): Promise<PartnerHistoryResponse> {
  const searchParams = new URLSearchParams({ limit: String(limit) });
  const response = await fetch(`${PARTNER_ENDPOINT}/history?${searchParams.toString()}`);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? "读取聊天记录失败，请稍后重试。");
  }

  return response.json();
}

export async function sendPartnerMessage(message: string): Promise<PartnerChatResponse> {
  const response = await fetch(`${PARTNER_ENDPOINT}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? "发送失败，请稍后重试。");
  }

  return response.json();
}

export async function clearPartnerHistory(): Promise<void> {
  const response = await fetch(`${PARTNER_ENDPOINT}/clear-history`, {
    method: "POST"
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? "清空聊天失败，请稍后重试。");
  }
}

export async function clearPartnerMemory(): Promise<PartnerClearMemoryResponse> {
  const response = await fetch(`${PARTNER_ENDPOINT}/clear-memory`, {
    method: "POST"
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? "清空记忆失败，请稍后重试。");
  }

  return response.json();
}
