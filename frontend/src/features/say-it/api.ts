import type { SayItRequest, SayItResponse } from "./types";

export const SAY_IT_ENDPOINT = "/api/say-it";

export async function submitSayIt(payload: SayItRequest): Promise<SayItResponse> {
  const response = await fetch(SAY_IT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? "Say it 请求失败，请稍后重试。");
  }

  return response.json();
}
