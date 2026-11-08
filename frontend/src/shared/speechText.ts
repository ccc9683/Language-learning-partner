/** Prepare displayed text for speech without changing the displayed content. */
export function sanitizeSpeechText(text: string): string {
  const clean = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[0-9#*]\uFE0F?\u20E3/gu, " ")
    .replace(/[\p{S}\u200D\uFE0E\uFE0F]/gu, " ")
    .replace(/[*_~`#|]/g, "")
    .replace(/^\s*[-+>]\s+/gm, "")
    .replace(/[\\/@^=<>&%\[\]{}()•●▪◦※]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?，。！？；：])/g, "$1")
    .trim();

  return /[\p{L}\p{N}]/u.test(clean) ? clean : "";
}
