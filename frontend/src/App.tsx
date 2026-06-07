import { useRef, useState } from "react";

type TranslateResult = {
  kind: "term" | "text";
  chinese: string;
  ipa: string | null;
  part_of_speech: string | null;
};

function App() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const abortReasonRef = useRef<"clear" | "stop" | null>(null);

  const hasInput = Boolean(text.trim());
  const canClear = hasInput || Boolean(result) || Boolean(error) || loading;

  function cancelSpeech() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function abortTranslate(reason: "clear" | "stop") {
    if (!abortControllerRef.current) {
      return;
    }

    abortReasonRef.current = reason;
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
  }

  async function handleTranslate() {
    const input = text.trim();
    if (!input) {
      setError("请输入英文单词、短语或句子。");
      setResult(null);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: input })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail ?? "翻译失败，请稍后重试。");
      }

      setResult(await response.json());
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        if (abortReasonRef.current === "stop") {
          setError("已停止当前操作。");
        }
        return;
      }

      setResult(null);
      setError(err instanceof Error ? err.message : "翻译失败，请稍后重试。");
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      abortReasonRef.current = null;
      setLoading(false);
    }
  }

  function handleSpeak() {
    const input = text.trim();
    if (!input || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(input);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  function handleClear() {
    abortTranslate("clear");
    cancelSpeech();
    setText("");
    setResult(null);
    setError("");
    setLoading(false);
  }

  function handleStop() {
    abortTranslate("stop");
    cancelSpeech();
    setLoading(false);
  }

  return (
    <main className="page">
      <section className="translator">
        <h1>Quick Translator</h1>
        <p className="subtitle">输入英文，快速获得中文翻译。</p>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="输入英文单词、短语、句子或段落..."
          rows={7}
        />

        <div className="actions">
          <button onClick={handleTranslate} disabled={loading}>
            {loading ? "翻译中..." : "翻译"}
          </button>
          <button className="secondary" onClick={handleSpeak} disabled={!hasInput}>
            朗读
          </button>
          <button className="secondary" onClick={handleClear} disabled={!canClear}>
            清空
          </button>
          <button className="danger" onClick={handleStop} disabled={!loading && !hasInput}>
            停止
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="result">
          {result ? (
            result.kind === "term" ? (
              <>
                <div className="result-row">
                  <span>中文</span>
                  <strong>{result.chinese}</strong>
                </div>
                <div className="result-row">
                  <span>音标</span>
                  <strong>{result.ipa || "暂无"}</strong>
                </div>
                <div className="result-row">
                  <span>词性</span>
                  <strong>{result.part_of_speech || "暂无"}</strong>
                </div>
              </>
            ) : (
              <div className="paragraph-result">{result.chinese}</div>
            )
          ) : (
            <div className="empty">翻译结果会显示在这里。</div>
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
