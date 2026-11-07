import { apiJson, apiPath, jsonHeaders } from "../../shared/api";
import type { LearningItem, LearningItemCreate, LearningItemType } from "./types";

export const LEARNING_ITEMS_ENDPOINT = apiPath("/learning-items");

export async function createLearningItem(payload: LearningItemCreate): Promise<LearningItem> {
  return apiJson<LearningItem>("/learning-items", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
    fallbackError: "收藏失败，请稍后重试。"
  });
}

export async function fetchLearningItems(
  type: LearningItemType,
  limit = 50
): Promise<LearningItem[]> {
  const searchParams = new URLSearchParams({
    type,
    limit: String(limit)
  });
  return apiJson<LearningItem[]>(`/learning-items?${searchParams.toString()}`, {
    fallbackError: "读取收藏失败，请稍后重试。"
  });
}

export async function deleteLearningItem(id: number): Promise<void> {
  await apiJson<void>(`/learning-items/${id}`, {
    method: "DELETE",
    fallbackError: "删除失败，请稍后重试。"
  });
}

export async function fetchDueItems(): Promise<LearningItem[]> {
  return apiJson<LearningItem[]>("/learning-items/review", {
    fallbackError: "读取待复习内容失败，请稍后重试。"
  });
}

export type ReviewStats = { reviewed: number; remembered: number; item_counts: Record<string, number> };

export async function fetchTodayReviewStats(): Promise<ReviewStats> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
  return apiJson(`/learning-items/review/stats?${params}`, {
    fallbackError: "读取今日复习统计失败，请稍后重试。"
  });
}

export async function submitReview(id: number, remembered: boolean): Promise<LearningItem> {
  return apiJson<LearningItem>(`/learning-items/${id}/review`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ remembered }),
    fallbackError: "保存复习进度失败，请稍后重试。"
  });
}
