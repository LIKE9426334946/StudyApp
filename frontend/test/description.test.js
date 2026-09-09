import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDescription } from "../src/description.js";

test("single markers support repeated expressions and retain ordinary line breaks", () => {
  const parts = parseDescription("首行\n`重点`与$x^2$、$y=a^3$。");
  assert.deepEqual(parts.map((part) => part.type), ["text", "bold", "text", "math", "text", "math", "text"]);
  assert.equal(parts[0].value, "首行\n");
  assert.equal(parts[1].value, "重点");
  assert.equal(parts[5].value, "y=a^3");
});

test("unmatched, repeated and escaped markers remain literal", () => {
  const source = "普通文本\n$$原样$$ ``原样``，未闭合 $ 和反斜线 \\frac";
  assert.deepEqual(parseDescription(source), [{ type: "text", value: source }]);
  assert.deepEqual(parseDescription("转义 \\$ 和 \\`"), [{ type: "text", value: "转义 $ 和 `" }]);
  assert.deepEqual(parseDescription("未闭合 `文字"), [{ type: "text", value: "未闭合 `文字" }]);
});

test("LaTeX backslashes and escaped dollar signs survive parsing", () => {
  const parts = parseDescription("$\\frac{a}{b}$，$\\text{price \\$5}$");
  assert.equal(parts[0].value, "\\frac{a}{b}");
  assert.equal(parts[2].value, "\\text{price \\$5}");
});
