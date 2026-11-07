import { useEffect, useState } from "react";

import { deleteLearningItem, fetchDueItems, fetchLearningItems, fetchTodayReviewStats, submitReview } from "../features/learning-book/api";
import type { ReviewStats } from "../features/learning-book/api";
import type { LearningItem, LearningItemType } from "../features/learning-book/types";
import TranslateDetailPanel from "../features/translator/TranslateDetailPanel";
import { translateText } from "../features/translator/api";
import type { TranslateDetail } from "../features/translator/types";
import { speakEnglish } from "../shared/speech";

function LearningBookPage() {
  const [activeType, setActiveType] = useState<LearningItemType | "review">("word");
  const [items, setItems] = useState<LearningItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (activeType !== "review") {
      void loadItems(activeType);
    }
  }, [activeType]);

  async function loadItems(type: LearningItemType) {
    setLoading(true);
    setError("");

    try {
      setItems(await fetchLearningItems(type));
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取收藏失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    setError("");

    try {
      await deleteLearningItem(id);
      setItems((currentItems) => currentItems.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败，请稍后重试。");
    }
  }

  async function speak(text: string) {
    const result = await speakEnglish(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError("");
  }

  return (
    <main className="page">
      <section className="translator">
        <h1>Learning Book</h1>
        <p className="subtitle">统一查看已收藏的单词和句子。</p>

        <div className="book-tabs" role="tablist" aria-label="Learning book type">
          <button
            className={activeType === "word" ? "book-tab active" : "book-tab"}
            onClick={() => setActiveType("word")}
            type="button"
          >
            Words
          </button>
          <button
            className={activeType === "sentence" ? "book-tab active" : "book-tab"}
            onClick={() => setActiveType("sentence")}
            type="button"
          >
            Sentences
          </button>
          <button
            className={activeType === "review" ? "book-tab active" : "book-tab"}
            onClick={() => setActiveType("review")}
            type="button"
          >
            Review
          </button>
        </div>

        {activeType !== "review" && error && <div className="error">{error}</div>}

        {activeType === "review" ? <ReviewPanel /> : (
        <div className="book-list">
          {loading ? (
            <div className="empty">加载中...</div>
          ) : items.length > 0 ? (
            items.map((item) =>
              item.type === "word" ? (
                <WordCard item={item} key={item.id} onDelete={handleDelete} onSpeak={speak} />
              ) : (
                <SentenceCard item={item} key={item.id} onDelete={handleDelete} onSpeak={speak} />
              )
            )
          ) : (
            <div className="empty">暂无收藏内容。</div>
          )}
        </div>
        )}
      </section>
    </main>
  );
}

function ReviewPanel() {
  const [items, setItems] = useState<LearningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState("");

  async function loadDue() {
    try {
      const [dueItems, todayStats] = await Promise.all([fetchDueItems(), fetchTodayReviewStats()]);
      setItems(dueItems);
      setStats(todayStats);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取待复习内容失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadDue(); }, []);

  async function handleReview(remembered: boolean) {
    if (!items[0] || saving) return;
    setSaving(true);
    setError("");
    try {
      await submitReview(items[0].id, remembered);
      setItems([]);
      setRevealed(false);
      await loadDue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存复习进度失败。");
    } finally {
      setSaving(false);
    }
  }

  async function handleSpeakWord(word: string) {
    setError("");
    const result = await speakEnglish(word, { onError: setError });
    if (!result.ok) setError(result.error);
  }

  const item = items[0];
  return (
    <div className="review-panel">
      <p className="review-hint">先回忆答案，再选择是否记住。记住后间隔逐渐延长；再练习的内容 1 天后出现。</p>
      {!item && stats && <p className="review-progress" aria-live="polite">今日复习 {stats.reviewed} 条 · 记住 {stats.remembered} 条，加油！给大脑充电！</p>}
      {error && <div className="error">{error}</div>}
      {loading ? <div className="empty">加载中...</div> : item ? (
        <article className="review-card" key={item.id}>
          <span className="book-added-date">{item.type === "word" ? "单词" : "句子"} · 本批剩余 {items.length} 条</span>
          {stats && <p className="review-progress" aria-live="polite">今日复习 {stats.reviewed} 条 · 记住 {stats.remembered} 条，加油！给大脑充电！</p>}
          <div className="review-prompt">
            <h2>{item.source_text}</h2>
            {item.type === "word" && (
              <>
                <button
                  aria-label={`朗读 ${item.source_text}`}
                  className="review-speak"
                  onClick={() => void handleSpeakWord(item.source_text)}
                  title="朗读单词"
                  type="button"
                >
                  🔊
                </button>
                <span className="review-word-count">今天我们相遇{stats?.item_counts?.[item.id] ?? 0}次了，多见几次我们就越发熟识了。</span>
              </>
            )}
          </div>
          {revealed ? (
            <>
              {item.type === "word" && <p>音标：{item.phonetic || "暂无音标"}</p>}
              <p>{(item.type === "word" ? item.meaning : item.target_text) || "暂无答案"}</p>
              <div className="review-actions">
                <button className="secondary" disabled={saving} onClick={() => void handleReview(false)} type="button">再练习</button>
                <button disabled={saving} onClick={() => void handleReview(true)} type="button">记住了</button>
              </div>
            </>
          ) : (
            <button onClick={() => setRevealed(true)} type="button">显示答案</button>
          )}
        </article>
      ) : !error ? <div className="empty">目前没有待复习的内容。</div> : (
        <button className="secondary" onClick={() => { setLoading(true); void loadDue(); }} type="button">重试</button>
      )}
    </div>
  );
}

function WordCard({
  item,
  onDelete,
  onSpeak
}: {
  item: LearningItem;
  onDelete: (id: number) => void;
  onSpeak: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<TranslateDetail | null>(() => parseStoredDetail(item));
  const [detailPhonetic, setDetailPhonetic] = useState<string | null>(item.phonetic);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [meaningVisible, setMeaningVisible] = useState(false);

  async function handleToggleMore() {
    if (expanded) {
      setExpanded(false);
      return;
    }

    const savedDetail = detail ?? parseStoredDetail(item);
    if (savedDetail) {
      setDetail(savedDetail);
      setExpanded(true);
      return;
    }

    setLoadingDetail(true);
    setDetailError("");

    try {
      // Older favorites may only have a simple meaning. There is no update API yet,
      // so fetched detail is displayed in memory only for this page session.
      const fetched = await fetchWordDetail(item.source_text);
      setDetail(fetched.detail);
      setDetailPhonetic(fetched.phonetic || item.phonetic);
    } catch {
      setDetail(buildFallbackDetail(item));
      setDetailError("暂时只能显示已保存的基础信息。");
    } finally {
      setLoadingDetail(false);
      setExpanded(true);
    }
  }

  return (
    <article className="book-card book-card-word">
      <div className="word-card-top">
        <div className="word-card-main">
          <h2>{item.source_text}</h2>
          {item.phonetic && <span>{item.phonetic}</span>}
          {item.part_of_speech && <span>{item.part_of_speech}</span>}
        </div>
        <div className="book-card-actions">
          <button
            className="secondary compact meaning-toggle"
            onClick={() => setMeaningVisible((visible) => !visible)}
            type="button"
          >
            {meaningVisible ? "隐藏中文" : "显示中文"}
          </button>
          <button
            className="secondary compact"
            disabled={loadingDetail}
            onClick={handleToggleMore}
            type="button"
          >
            {expanded ? "less" : loadingDetail ? "..." : "more"}
          </button>
          <button className="secondary compact" onClick={() => onSpeak(item.source_text)} type="button">
            朗读
          </button>
          <button className="danger compact" onClick={() => onDelete(item.id)} type="button">
            删除
          </button>
        </div>
      </div>
      <div className="word-meaning-row">
        {meaningVisible && item.meaning && <p>{item.meaning}</p>}
        {meaningVisible && !item.meaning && <p>暂无中文释义</p>}
      </div>
      {expanded && detail && (
        <div className="book-card-detail">
          <TranslateDetailPanel detail={detail} phonetic={detailPhonetic} />
          {detailError && <div className="favorite-notice">{detailError}</div>}
        </div>
      )}
      <AddedDate createdAt={item.created_at} />
    </article>
  );
}

function SentenceCard({
  item,
  onDelete,
  onSpeak
}: {
  item: LearningItem;
  onDelete: (id: number) => void;
  onSpeak: (text: string) => void;
}) {
  let fromTranslator = false;
  try {
    fromTranslator = JSON.parse(item.detail_json || "null")?.origin === "translator";
  } catch {
    // Older items may not have structured metadata.
  }
  const englishText = (fromTranslator ? item.source_text : item.target_text) || "";

  return (
    <article className="book-card">
      <div className="book-card-main">
        <h2>{item.source_text}</h2>
        {item.target_text && <p>{item.target_text}</p>}
      </div>
      <div className="book-card-actions">
        <button
          className="secondary compact"
          disabled={!englishText}
          onClick={() => onSpeak(englishText)}
          type="button"
        >
          朗读英文
        </button>
        <button className="danger compact" onClick={() => onDelete(item.id)} type="button">
          删除
        </button>
      </div>
      <AddedDate createdAt={item.created_at} />
    </article>
  );
}

function AddedDate({ createdAt }: { createdAt: string }) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return <span className="book-added-date">添加日期未知</span>;
  }

  const today = new Date();
  const calendarDay = (value: Date) =>
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const daysAgo = Math.round((calendarDay(today) - calendarDay(date)) / 86400000);
  const relative = daysAgo === 0 ? "今天" : daysAgo === 1 ? "昨天" :
    daysAgo > 1 && daysAgo < 30 ? `${daysAgo} 天前` : "";
  const formatted = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);

  return (
    <time className="book-added-date" dateTime={createdAt}>
      {relative ? `${relative}添加 · ${formatted}` : `添加于 ${formatted}`}
    </time>
  );
}

async function fetchWordDetail(sourceText: string): Promise<{
  detail: TranslateDetail;
  phonetic: string | null;
}> {
  const result = await translateText(sourceText);
  if (result.kind !== "term" || !result.detail) {
    throw new Error("Translate detail is unavailable.");
  }

  return {
    detail: result.detail,
    phonetic: result.ipa
  };
}

function parseStoredDetail(item: LearningItem): TranslateDetail | null {
  if (!item.detail_json) {
    return null;
  }

  try {
    const parsed = JSON.parse(item.detail_json) as unknown;
    return normalizeDetail(parsed, item);
  } catch {
    return null;
  }
}

function normalizeDetail(value: unknown, item: LearningItem): TranslateDetail | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const detail = value as Record<string, unknown>;
  const headword = readString(detail.headword) || item.source_text;
  if (!headword) {
    return null;
  }

  return {
    headword,
    pos: readString(detail.pos) || item.part_of_speech,
    meanings: readStringArray(detail.meanings, splitMeanings(item.meaning)),
    usages: readUsageArray(detail.usages),
    synonyms: readStringArray(detail.synonyms),
    common_mistakes: readMistakeArray(detail.common_mistakes)
  };
}

function buildFallbackDetail(item: LearningItem): TranslateDetail {
  return {
    headword: item.source_text,
    pos: item.part_of_speech,
    meanings: splitMeanings(item.meaning),
    usages: [],
    synonyms: [],
    common_mistakes: []
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const items = value.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim())
  );
  return items.length > 0 ? items : fallback;
}

function readUsageArray(value: unknown): TranslateDetail["usages"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((usage) => {
    if (!usage || typeof usage !== "object") {
      return [];
    }

    const usageData = usage as Record<string, unknown>;
    const pattern = readString(usageData.pattern);
    const exampleEn = readString(usageData.example_en);
    const exampleZh = readString(usageData.example_zh);
    if (!pattern || !exampleEn || !exampleZh) {
      return [];
    }

    return [{ pattern, example_en: exampleEn, example_zh: exampleZh }];
  });
}

function readMistakeArray(value: unknown): TranslateDetail["common_mistakes"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((mistake) => {
    if (!mistake || typeof mistake !== "object") {
      return [];
    }

    const mistakeData = mistake as Record<string, unknown>;
    const wrong = readString(mistakeData.wrong);
    const correct = readString(mistakeData.correct);
    const note = readString(mistakeData.note);
    if (!wrong || !correct || !note) {
      return [];
    }

    return [{ wrong, correct, note }];
  });
}

function splitMeanings(meaning: string | null): string[] {
  if (!meaning) {
    return [];
  }

  return meaning
    .split(/[,，;；、\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default LearningBookPage;
