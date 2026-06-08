import { useEffect, useRef, useState } from "react";

import { submitSayIt } from "../features/say-it/api";
import type { SayItResponse } from "../features/say-it/types";

type BrowserSpeechRecognitionEvent = Event & {
  results: {
    length: number;
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  const speechWindow = window as Window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function SayItPage() {
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState<SayItResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingText, setPendingText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognitionConstructor()));

    return () => {
      recognitionRef.current?.abort();
      stopSpeaking();
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

    try {
      const response = await submitSayIt({
        text: trimmed,
        pending_text: pendingText || undefined,
        clarification
      });

      setResult(response);
      setPendingText(response.type === "clarification" ? trimmed : "");

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
    setInputText(option);
    void sendRequest(option, option);
  }

  function startRecording() {
    if (!speechSupported || isRecording) {
      return;
    }

    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult?.[0]?.transcript?.trim();
      if (transcript) {
        setInputText(transcript);
      }
    };
    recognition.onerror = () => {
      setIsRecording(false);
      setError("语音识别失败，请重试。");
    };
    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

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
    if (!englishText || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(englishText);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }

  return (
    <main className="page">
      <section className="translator say-it">
        <h1>Say it</h1>
        <p className="subtitle">输入中文获得自然英文表达，或输入英文进行纠错。</p>

        <textarea
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          placeholder="例如：我想去超市买东西 / I want to going to the store"
          rows={6}
        />

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
                <div className="result-row">
                  <span>英文</span>
                  <strong>{result.english_text}</strong>
                </div>
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
