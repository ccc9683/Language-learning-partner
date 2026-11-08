import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const load = code => import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const sanitizer = await load(compile(fs.readFileSync(new URL("../src/shared/speechText.ts", import.meta.url), "utf8")));
globalThis.__speechTestSanitize = sanitizer.sanitizeSpeechText;
let source = fs.readFileSync(new URL("../src/shared/speech.ts", import.meta.url), "utf8");
const native = source.includes('import { Capacitor }');
source = source.replace('import { sanitizeSpeechText } from "./speechText";', 'const sanitizeSpeechText = globalThis.__speechTestSanitize;');
source = source.replace('import { Capacitor } from "@capacitor/core";', 'const Capacitor = globalThis.__speechTestCapacitor;');
source = source.replace('import { TextToSpeech } from "@capacitor-community/text-to-speech";', 'const TextToSpeech = globalThis.__speechTestNative;');
let spoken = [];
globalThis.__speechTestCapacitor = { isNativePlatform: () => native };
globalThis.__speechTestNative = { speak: async ({text}) => spoken.push(text), stop: async () => {} };
globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
globalThis.window = { speechSynthesis: { cancel() {}, getVoices: () => [{lang:"en-US"}], speak: utterance => spoken.push(utterance.text) } };
const { speakEnglish } = await load(compile(source));

test("送入语音引擎的是清理后的文字", async () => {
  spoken = [];
  assert.equal((await speakEnglish("**Hello** 😊, world!" )).ok, true);
  assert.deepEqual(spoken, ["Hello, world!"]);
  assert.equal((await speakEnglish("⭐ ** 🎉")).ok, false);
  assert.equal(spoken.length, 1);
});
