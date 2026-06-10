import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

import { createLearningItem } from "../features/learning-book/api";
import { submitSayIt } from "../features/say-it/api";
import type { SayItResponse } from "../features/say-it/types";
import {
  addInputHistory,
  loadInputHistory,
  removeInputHistory
} from "../shared/inputHistory";
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  speakEnglish,
  stopSpeaking as stopBrowserSpeaking,
  type BrowserSpeechRecognition
} from "../shared/speech";

const SAY_IT_INPUT_HISTORY_STORAGE_KEY = "llp_say_it_input_history";

type ClarificationState = {
  originalText: string;
  ambiguousText: string;
  options: string[];
};

function SayItPage() {
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState<SayItResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clarificationState, setClarificationState] = useState<ClarificationState | null>(null);
  const [lastSentenceSourceText, setLastSentenceSourceText] = useState("");
  const [sentenceSaved, setSentenceSaved] = useState(false);
  const [savingSentence, setSavingSentence] = useState(false);
  const [favoriteNotice, setFavoriteNotice] = useState("");
  const [inputHistory, setInputHistory] = useState<string[]>(() =>
    loadInputHistory(SAY_IT_INPUT_HISTORY_STORAGE_KEY)
  );
  const [historyMenuOpen, setHistoryMenuOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const inputAreaRef = useRef<HTMLDivElement | null>(null);

  const showHistoryButton = inputFocused || historyMenuOpen;

  useEffect(() => {
    setSpeechSupported(isSpeechRecognitionSupported());

    return () => {
      recognitionRef.current?.abort();
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    function handleDocumentPointerDown(event: PointerEvent) {
      if (!inputAreaRef.current?.contains(event.target as Node)) {
        setHistoryMenuOpen(false);
        setInputFocused(false);
      }
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, []);

  async function sendRequest(text: string, clarification?: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("请输入中文或英文。");
      return;
    }

    setLoading(true);
    setError("");
    setSentenceSaved(false);
    setFavoriteNotice("");

    try {
      const pendingText = clarification ? clarificationState?.originalText : "";
      const response = await submitSayIt({
        text: trimmed,
        pending_text: pendingText || undefined,
        clarification
      });

      setResult(response);
      setClarificationState(
        response.type === "clarification"
          ? {
              originalText: response.original_text || trimmed,
              ambiguousText: response.ambiguous_text || "",
              options: response.options
            }
          : null
      );
      setLastSentenceSourceText(response.english_text ? trimmed : "");

      if (!clarification) {
        setInputHistory(addInputHistory(SAY_IT_INPUT_HISTORY_STORAGE_KEY, trimmed));
      }

      if (response.english_text) {
        speak(response.english_text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Say it 请求失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  function handleSend() {
    void sendRequest(inputText);
  }

  function handleClarification(option: string) {
    const correctedText = buildClarifiedText(clarificationState, option);
    setInputText(correctedText);
    void sendRequest(correctedText, option);
  }

  function handleSelectHistory(historyItem: string) {
    setInputText(historyItem);
    setHistoryMenuOpen(false);
    setInputFocused(true);
  }

  function handleRemoveHistory(event: MouseEvent<HTMLButtonElement>, historyItem: string) {
    event.stopPropagation();
    setInputHistory(removeInputHistory(SAY_IT_INPUT_HISTORY_STORAGE_KEY, historyItem));
  }

  async function handleSaveSentence() {
    const englishText = result?.english_text?.trim();
    const sourceText = (lastSentenceSourceText || inputText).trim();
    if (!englishText || !sourceText) {
      return;
    }

    setSavingSentence(true);
    setFavoriteNotice("");

    try {
      await createLearningItem({
        type: "sentence",
        source_text: sourceText,
        target_text: englishText
      });
      setSentenceSaved(true);
      setFavoriteNotice("已收藏到 Learning Book。");
    } catch (err) {
      setFavoriteNotice(err instanceof Error ? err.message : "收藏失败，请稍后重试。");
    } finally {
      setSavingSentence(false);
    }
  }

  function startRecording() {
    if (!speechSupported || isRecording) {
      return;
    }

    const recognition = createSpeechRecognition({
      lang: "zh-CN",
      onResult: (transcript) => setInputText(transcript),
      onError: () => {
        setIsRecording(false);
        setError("语音识别失败，请重试。");
      },
      onEnd: () => {
        setIsRecording(false);
        recognitionRef.current = null;
      }
    });

    if (!recognition) {
      setSpeechSupported(false);
      return;
    }

    recognitionRef.current = recognition;
    setError("");
    setIsRecording(true);

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsRecording(false);
      setError("语音识别启动失败，请重试。");
    }
  }

  function stopRecording() {
    if (!isRecording) {
      return;
    }

    try {
      recognitionRef.current?.stop();
    } catch {
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }

  function speak(text = result?.english_text ?? "") {
    const englishText = text.trim();
    if (!englishText) {
      return;
    }

    setIsSpeaking(true);
    const started = speakEnglish(englishText, {
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false)
    });
    if (!started) {
      setIsSpeaking(false);
    }
  }

  function stopSpeaking() {
    stopBrowserSpeaking();
    setIsSpeaking(false);
  }

  return (
    <main className="page">
      <section className="translator say-it">
        <h1>Say it</h1>
        <p className="subtitle">输入中文获得自然英文表达，或输入英文进行纠错。</p>

        <div className="translator-input-area" ref={inputAreaRef}>
          <textarea
            className="translator-input"
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            onFocus={() => setInputFocused(true)}
            placeholder="例如：我想去超市买东西 / I want to going to the store"
            rows={6}
          />

          {showHistoryButton && (
            <button
              aria-expanded={historyMenuOpen}
              aria-label="打开输入历史"
              className="history-toggle"
              onClick={() => setHistoryMenuOpen((open) => !open)}
              type="button"
            >
              ▼
            </button>
          )}

          {historyMenuOpen && (
            <div className="history-menu">
              {inputHistory.length > 0 ? (
                inputHistory.map((historyItem) => (
                  <div className="history-row" key={historyItem}>
                    <button
                      className="history-item"
                      onClick={() => handleSelectHistory(historyItem)}
                      type="button"
                    >
                      {historyItem}
                    </button>
                    <button
                      aria-label={`删除历史记录 ${historyItem}`}
                      className="history-remove"
                      onClick={(event) => handleRemoveHistory(event, historyItem)}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ))
              ) : (
                <div className="history-empty">暂无历史记录</div>
              )}
            </div>
          )}
        </div>

        {!speechSupported && (
          <div className="notice">当前浏览器不支持语音识别，请使用 Chrome 或 Edge。</div>
        )}

        <div className="actions">
          <button onClick={handleSend} disabled={loading}>
            {loading ? "处理中..." : "发送"}
          </button>
          <button
            className="secondary"
            disabled={!speechSupported || loading}
            onMouseDown={startRecording}
            onMouseLeave={stopRecording}
            onMouseUp={stopRecording}
            onTouchEnd={stopRecording}
            onTouchStart={(event) => {
              event.preventDefault();
              startRecording();
            }}
            type="button"
          >
            {isRecording ? "停止录音" : "🎤 开始录音"}
          </button>
          <button
            className="secondary"
            disabled={!result?.english_text}
            onClick={() => speak()}
            type="button"
          >
            🔊 朗读
          </button>
          <button
            className="danger"
            disabled={!isSpeaking}
            onClick={stopSpeaking}
            type="button"
          >
            ⏹ 停止
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="result say-it-result">
          {result ? (
            <>
              {result.display_text && <div className="paragraph-result">{result.display_text}</div>}

              {result.question && (
                <div className="clarification">
                  <strong>{result.question}</strong>
                  <div className="option-list">
                    {result.options.map((option) => (
                      <button
                        className="secondary"
                        disabled={loading}
                        key={option}
                        onClick={() => handleClarification(option)}
                        type="button"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {result.english_text && (
                <>
                  <div className="result-row">
                    <span>英文</span>
                    <strong>{result.english_text}</strong>
                  </div>
                  <div className="favorite-actions">
                    <button
                      className="favorite-button"
                      disabled={savingSentence}
                      onClick={handleSaveSentence}
                      type="button"
                    >
                      {sentenceSaved ? "★ 已收藏" : savingSentence ? "收藏中..." : "☆ 收藏句子"}
                    </button>
                  </div>
                  {favoriteNotice && <div className="favorite-notice">{favoriteNotice}</div>}
                </>
              )}

              {result.explanation && (
                <div className="result-row">
                  <span>说明</span>
                  <strong>{result.explanation}</strong>
                </div>
              )}
            </>
          ) : (
            <div className="empty">Say it 的结果会显示在这里。</div>
          )}
        </div>
      </section>
    </main>
  );
}

export default SayItPage;

function buildClarifiedText(state: ClarificationState | null, selectedOption: string): string {
  if (!state) {
    return selectedOption;
  }

  if (state.ambiguousText && state.originalText.includes(state.ambiguousText)) {
    return state.originalText.replace(state.ambiguousText, selectedOption);
  }

  return state.originalText;
}
