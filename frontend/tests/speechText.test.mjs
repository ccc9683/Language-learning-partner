import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/shared/speechText.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { sanitizeSpeechText } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("清除 Markdown 标记和表情，同时保留文字、标点及链接文字", () => {
  assert.equal(sanitizeSpeechText("**Hello**, friend! 😊 👩🏽‍💻 [Read more](https://example.com)"), "Hello, friend! Read more");
  assert.equal(sanitizeSpeechText("## 今日练习\n- You're well-known! 🎉"), "今日练习 You're well-known!");
  assert.equal(sanitizeSpeechText("• Hello (friend) & welcome!"), "Hello friend welcome!");
});

test("处理纯符号、旗帜和数字表情，同时保留普通数字", () => {
  assert.equal(sanitizeSpeechText("** 🎉 🇨🇳 1️⃣ **"), "");
  assert.equal(sanitizeSpeechText("Lesson 1️⃣: 123 🌟"), "Lesson: 123");
  assert.equal(sanitizeSpeechText("![装饰](image.png)"), "");
});
