import type { LearningItem, LearningItemCreate, LearningItemType } from "./types";

export const LEARNING_ITEMS_ENDPOINT = "/api/learning-items";

export async function createLearningItem(payload: LearningItemCreate): Promise<LearningItem> {
  const response = await fetch(LEARNING_ITEMS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? "收藏失败，请稍后重试。");
  }

  return response.json();
}

export async function fetchLearningItems(
  type: LearningItemType,
  limit = 50
): Promise<LearningItem[]> {
  const searchParams = new URLSearchParams({
    type,
    limit: String(limit)
  });
  const response = await fetch(`${LEARNING_ITEMS_ENDPOINT}?${searchParams.toString()}`);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? "读取收藏失败，请稍后重试。");
  }

  return response.json();
}

export async function deleteLearningItem(id: number): Promise<void> {
  const response = await fetch(`${LEARNING_ITEMS_ENDPOINT}/${id}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? "删除失败，请稍后重试。");
  }
}
