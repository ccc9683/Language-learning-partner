import { useEffect, useRef, useState } from "react";

import {
  clearPartnerHistory,
  clearPartnerMemory,
  getPartnerHistory,
  sendPartnerMessage
} from "../features/partner/api";
import type { PartnerMemory, PartnerMessage } from "../features/partner/types";
import { transcribeSpeech } from "../features/speech/api";
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  speakEnglish,
  stopSpeaking,
  type BrowserSpeechRecognition
} from "../shared/speech";

const DEFAULT_MEMORY: PartnerMemory = {
  name: "",
  level: "beginner",
  favorite_topics: [],
  style: "simple English"
};

function PartnerPage() {
  const [messages, setMessages] = useState<PartnerMessage[]>([]);
  const [memory, setMemory] = useState<PartnerMemory>(DEFAULT_MEMORY);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [uploadSpeechMode, setUploadSpeechMode] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<number | "latest" | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const recordingStoppedByUserRef = useRef(false);

  useEffect(() => {
    setSpeechSupported(isSpeechRecognitionSupported());
    void loadHistory();

    return () => {
      recognitionRef.current?.abort();
      stopUploadStream();
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    messageListRef.current?.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages]);

  async function loadHistory() {
    setLoadingHistory(true);
    setError("");

    try {
      const data = await getPartnerHistory();
      setMessages(data.messages);
      setMemory(data.memory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取聊天记录失败，请稍后重试。");
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleSend() {
    const message = inputText.trim();
    if (!message) {
      setError("请输入想练习的内容。");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await sendPartnerMessage(message);
      setInputText("");
      setMemory(response.updated_memory);
      await loadHistory();
      speakAssistantReply(response.reply, "latest");
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  async function handleClearHistory() {
    setError("");
    try {
      await clearPartnerHistory();
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "清空聊天失败，请稍后重试。");
    }
  }

  async function handleClearMemory() {
    setError("");
    try {
      const response = await clearPartnerMemory();
      setMemory(response.memory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "清空记忆失败，请稍后重试。");
    }
  }

  function startRecording() {
    if (isRecording || isTranscribing) {
      return;
    }

    if (uploadSpeechMode || !speechSupported) {
      void startUploadRecording();
      return;
    }

    const recognition = createSpeechRecognition({
      lang: "zh-CN",
      onResult: (transcript) => setInputText(transcript),
      onError: (speechError) => {
        setIsRecording(false);
        recognitionRef.current = null;
        if (recordingStoppedByUserRef.current && speechError === "aborted") {
          return;
        }

        if (speechError === "network") {
          setUploadSpeechMode(true);
        }

        setError(getSpeechErrorMessage(speechError));
      },
      onEnd: () => {
        setIsRecording(false);
        recognitionRef.current = null;
        recordingStoppedByUserRef.current = false;
      }
    });

    if (!recognition) {
      setSpeechSupported(false);
      return;
    }

    recognitionRef.current = recognition;
    recordingStoppedByUserRef.current = false;
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

    recordingStoppedByUserRef.current = true;

    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        finishUploadRecording();
      }
      setIsRecording(false);
      return;
    }

    try {
      recognitionRef.current?.stop();
    } catch {
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }

  async function startUploadRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      setError("当前浏览器不支持录音上传识别，请换 Chrome 或 Edge 重试。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        setError("录音失败，请检查麦克风权限后重试。");
        finishUploadRecording();
      };
      recorder.onstop = () => {
        void handleUploadRecordingComplete(recorder.mimeType || "audio/webm");
      };

      setError("");
      setIsRecording(true);
      recorder.start();
    } catch {
      setError("麦克风权限被拒绝，请在浏览器地址栏允许麦克风后重试。");
    }
  }

  async function handleUploadRecordingComplete(mimeType: string) {
    const chunks = audioChunksRef.current;
    finishUploadRecording();

    if (chunks.length === 0) {
      setError("没有录到声音，请靠近麦克风再试一次。");
      return;
    }

    setIsTranscribing(true);
    setError("");

    try {
      const audio = new Blob(chunks, { type: mimeType || "audio/webm" });
      const transcript = await transcribeSpeech(audio);
      if (!transcript) {
        setError("没有识别出文字，请再试一次。");
        return;
      }
      setInputText(transcript);
    } catch (err) {
      setError(err instanceof Error ? err.message : "语音上传识别失败，请稍后重试。");
    } finally {
      setIsTranscribing(false);
    }
  }

  function finishUploadRecording() {
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    stopUploadStream();
    setIsRecording(false);
  }

  function stopUploadStream() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  function speakAssistantReply(text: string, id: number | "latest") {
    setSpeakingMessageId(id);
    const started = speakEnglish(text, {
      onEnd: () => setSpeakingMessageId(null),
      onError: () => setSpeakingMessageId(null)
    });

    if (!started) {
      setSpeakingMessageId(null);
    }
  }

  return (
    <main className="page">
      <section className="translator partner-page">
        <h1>Partner</h1>
        <p className="subtitle">和耐心的英语练习朋友进行简单日常对话。</p>

        {error && <div className="error">{error}</div>}

        <div className="partner-memory" aria-label="Partner memory">
          <span>Level: {memory.level}</span>
          {memory.name && <span>Name: {memory.name}</span>}
          {memory.favorite_topics.length > 0 && (
            <span>Topics: {memory.favorite_topics.join(", ")}</span>
          )}
        </div>

        <div className="partner-chat" ref={messageListRef}>
          {loadingHistory ? (
            <div className="empty">加载聊天记录中...</div>
          ) : messages.length > 0 ? (
            messages.map((message) => (
              <div className={`chat-row ${message.role}`} key={message.id}>
                <div className="chat-bubble">
                  <p>{message.content}</p>
                  {message.role === "assistant" && (
                    <button
                      className="chat-speak-button"
                      onClick={() => speakAssistantReply(message.content, message.id)}
                      type="button"
                    >
                      {speakingMessageId === message.id ? "朗读中" : "朗读"}
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="empty">聊天记录会显示在这里。</div>
          )}
        </div>

        {!speechSupported && (
          <div className="notice">当前浏览器不支持语音识别，请使用 Chrome 或 Edge。</div>
        )}

        <div className="partner-input-area">
          <textarea
            className="translator-input"
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                void handleSend();
              }
            }}
            placeholder="Type or speak something..."
            rows={4}
          />
        </div>

        <div className="actions partner-actions">
          <button disabled={loading} onClick={handleSend} type="button">
            {loading ? "Sending..." : "Send"}
          </button>
          <button
            className="secondary"
            disabled={loading || isTranscribing}
            onClick={isRecording ? stopRecording : startRecording}
            type="button"
          >
            {getSpeechButtonText(isRecording, isTranscribing)}
          </button>
          <button className="secondary" onClick={handleClearHistory} type="button">
            Clear Chat
          </button>
          <button className="secondary" onClick={handleClearMemory} type="button">
            Clear Memory
          </button>
        </div>
      </section>
    </main>
  );
}

export default PartnerPage;

function getSpeechErrorMessage(error: string): string {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "麦克风权限被拒绝，请在浏览器地址栏允许麦克风后重试。";
  }

  if (error === "no-speech") {
    return "没有识别到语音，请靠近麦克风再试一次。";
  }

  if (error === "audio-capture") {
    return "没有检测到可用麦克风，请检查系统输入设备。";
  }

  if (error === "network") {
    return "浏览器语音识别服务网络不可用，已切换为录音上传识别。请再点一次“说话”。";
  }

  if (error === "aborted") {
    return "语音识别已中断，请再点一次“说话”重试。";
  }

  return `语音识别失败，请重试。错误：${error || "unknown"}`;
}

function getSpeechButtonText(isRecording: boolean, isTranscribing: boolean): string {
  if (isTranscribing) {
    return "识别中...";
  }

  if (isRecording) {
    return "停止录音";
  }

  return "🎤 说话";
}
