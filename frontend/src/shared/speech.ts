export type BrowserSpeechRecognitionEvent = Event & {
  results: {
    length: number;
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

export type BrowserSpeechRecognitionErrorEvent = Event & {
  error?: string;
};

export type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionOptions = {
  lang?: string;
  onResult: (transcript: string) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
};

type SpeakOptions = {
  rate?: number;
  onEnd?: () => void;
  onError?: () => void;
};

export function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  const speechWindow = window as Window & {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getSpeechRecognitionConstructor());
}

export function createSpeechRecognition({
  lang = "zh-CN",
  onResult,
  onError,
  onEnd
}: SpeechRecognitionOptions): BrowserSpeechRecognition | null {
  const SpeechRecognition = getSpeechRecognitionConstructor();
  if (!SpeechRecognition) {
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const lastResult = event.results[event.results.length - 1];
    const transcript = lastResult?.[0]?.transcript?.trim();
    if (transcript) {
      onResult(transcript);
    }
  };
  recognition.onerror = (event) => {
    onError?.(event.error ?? "unknown");
  };
  recognition.onend = () => {
    onEnd?.();
  };

  return recognition;
}

export function speakEnglish(text: string, options: SpeakOptions = {}): boolean {
  const englishText = text.trim();
  if (!englishText || !("speechSynthesis" in window)) {
    return false;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(englishText);
  utterance.lang = "en-US";
  utterance.rate = options.rate ?? 0.95;
  utterance.onend = () => options.onEnd?.();
  utterance.onerror = () => options.onError?.();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
