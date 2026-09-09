import assert from "node:assert/strict";
import { before, after, beforeEach, afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { copyText } from "../src/clipboard.js";

let vite, StudyView, App, dom, root, container;
const data = {
  functions: [{ id: 1, library: "Python", name: "python_sample()", description: "Python", code: "print(1)" }, { id: 2, library: "NumPy", name: "numpy_sample()", description: "NumPy", code: "np.array([1])" }],
  libraries: ["Python", "NumPy"],
  directories: [{ name: "Python", libraries: ["Python", "NumPy"] }, { name: "未分类", libraries: [] }],
  refreshedAt: "2026-09-09T01:00:00Z",
};
before(async () => {
  vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  StudyView = (await vite.ssrLoadModule("/src/components/StudyView.jsx")).default;
  App = (await vite.ssrLoadModule("/src/App.jsx")).default;
});
after(async () => { await vite.close(); });
beforeEach(() => {
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://studyapp.test/" });
  for (const key of ["window", "document", "navigator", "localStorage", "Event"]) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key], writable: true });
  globalThis.indexedDB = undefined;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.getElementById("root");
  root = createRoot(container);
});
afterEach(async () => { await act(() => root.unmount()); dom.window.close(); });
const click = async (element) => { assert.ok(element, "expected button exists"); await act(async () => { element.click(); }); };
const buttonText = (scope, text) => [...scope.querySelectorAll("button")].find((button) => button.textContent.trim() === text);

async function renderStudy(extra = {}) {
  await act(() => root.render(createElement(StudyView, { ...data, favorites: new Set([2]), onToggleFavorite() {}, onRefresh: async () => ({ ...data, cacheSaved: true }), refreshing: false, ...extra })));
}

test("mobile favorites escape the selected library and the catalog back level is preserved", async () => {
  await renderStudy();
  await click(buttonText(container.querySelector(".mobile-bottom-nav"), "目录"));
  const catalog = () => container.querySelector(".mobile-catalog");
  await click([...catalog().querySelectorAll(".mobile-catalog-list > button")].find((button) => button.querySelector("strong")?.textContent === "Python"));
  await click([...catalog().querySelectorAll(".mobile-catalog-library-open")].find((button) => button.textContent.includes("Python")));
  await click([...catalog().querySelectorAll(".mobile-catalog-list > button")].find((button) => button.textContent.includes("python_sample")));
  assert.equal(container.querySelector(".mobile-function-hero h1").textContent, "python_sample()");
  await click(container.querySelector('[aria-label="返回上一层"]'));
  assert.equal(catalog().querySelector("h2").textContent, "Python");
  assert.ok(catalog().textContent.includes("python_sample()"));
  await click(buttonText(catalog(), "完成"));
  await click(buttonText(container.querySelector(".mobile-bottom-nav"), "收藏"));
  assert.equal(container.querySelector(".mobile-function-hero h1").textContent, "numpy_sample()");
});

test("HTTP copy uses the selection fallback, cleans up and reports failure", async () => {
  let copied;
  document.execCommand = (command) => { assert.equal(command, "copy"); copied = document.querySelector("textarea").value; return true; };
  await copyText("hello HTTP");
  assert.equal(copied, "hello HTTP");
  assert.equal(document.querySelector("textarea"), null);
  await renderStudy();
  document.execCommand = () => false;
  await click(container.querySelector('[aria-label="显示函数详情"]'));
  await click(buttonText(container.querySelector(".mobile-code-section"), "▢ 复制"));
  assert.match(container.querySelector(".copy-error").textContent, /手动复制/);
  assert.equal(document.querySelector("textarea"), null);
});

test("App opens cached content without fetching updates until refresh and warns on failed persistence", async () => {
  localStorage.setItem("studyapp:study-data:v1", JSON.stringify(data));
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(url);
    if (url === "api/auth/session") return new Response('{}', { status: 401 });
    assert.equal(url, "api/study-data");
    return new Response(JSON.stringify({ ...data, functions: [{ ...data.functions[0], name: "latest_from_server()" }] }), { status: 200 });
  };
  await act(async () => root.render(createElement(App)));
  assert.deepEqual(requests, ["api/auth/session"]);
  assert.ok(container.textContent.includes("python_sample()"));
  assert.ok(container.textContent.includes("上次刷新："));
  const original = dom.window.Storage.prototype.setItem;
  dom.window.Storage.prototype.setItem = () => { throw new Error("QuotaExceededError"); };
  try {
    await click(buttonText(container, "刷新内容"));
    assert.ok(container.textContent.includes("latest_from_server()"));
    assert.match(container.querySelector(".cache-warning").textContent, /无法保存离线缓存/);
    assert.equal(JSON.parse(localStorage.getItem("studyapp:study-data:v1")).functions[0].name, "python_sample()");
  } finally { dom.window.Storage.prototype.setItem = original; }
});
