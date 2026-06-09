import { useEffect, useState } from "react";

import { deleteLearningItem, fetchLearningItems } from "../features/learning-book/api";
import type { LearningItem, LearningItemType } from "../features/learning-book/types";

function LearningBookPage() {
  const [activeType, setActiveType] = useState<LearningItemType>("word");
  const [items, setItems] = useState<LearningItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadItems(activeType);
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

  function speak(text: string) {
    const englishText = text.trim();
    if (!englishText || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(englishText);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
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
        </div>

        {error && <div className="error">{error}</div>}

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
      </section>
    </main>
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
  return (
    <article className="book-card">
      <div className="book-card-main">
        <h2>{item.source_text}</h2>
        {item.phonetic && <p>{item.phonetic}</p>}
        {item.part_of_speech && <p>{item.part_of_speech}</p>}
        {item.meaning && <p>{item.meaning}</p>}
      </div>
      <div className="book-card-actions">
        <button className="secondary compact" onClick={() => onSpeak(item.source_text)} type="button">
          朗读
        </button>
        <button className="danger compact" onClick={() => onDelete(item.id)} type="button">
          删除
        </button>
      </div>
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
  const englishText = item.target_text || "";

  return (
    <article className="book-card">
      <div className="book-card-main">
        <h2>{item.source_text}</h2>
        {englishText && <p>{englishText}</p>}
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
    </article>
  );
}

export default LearningBookPage;
