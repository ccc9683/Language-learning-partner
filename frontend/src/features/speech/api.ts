export const SPEECH_TRANSCRIBE_ENDPOINT = "/api/speech/transcribe";

export async function transcribeSpeech(audio: Blob): Promise<string> {
  const response = await fetch(SPEECH_TRANSCRIBE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": audio.type || "audio/webm"
    },
    body: audio
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail ?? "语音上传识别失败，请稍后重试。");
  }

  const data = (await response.json()) as { text?: string };
  return data.text?.trim() ?? "";
}
