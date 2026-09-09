import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { IDBFactory } from "fake-indexeddb";
import { loadFavorites, loadStudyData, saveFavorites, saveReviewedLibraries, saveStudyData } from "../src/storage.js";

let local;
const snapshot = (refreshedAt = "2026-09-09T01:00:00Z") => ({ functions: [{ id: 1, name: "legacy" }], libraries: ["Python"], directories: [], refreshedAt });
beforeEach(() => {
  local = new Map();
  globalThis.indexedDB = new IDBFactory();
  globalThis.localStorage = { getItem: (key) => local.get(key) ?? null, setItem: (key, value) => local.set(key, value), removeItem: (key) => local.delete(key) };
});

test("legacy cache migrates with favorites preserved, and timestamps persist", async () => {
  localStorage.setItem("studyapp:study-data:v1", JSON.stringify(snapshot()));
  localStorage.setItem("studyapp:favorites", JSON.stringify([1, "2", "8bc24781-ae50-4624-9783-ea965db68f96"]));
  assert.deepEqual(await loadStudyData(), snapshot());
  assert.equal(localStorage.getItem("studyapp:study-data:v1"), null);
  assert.deepEqual([...loadFavorites()], [1, 2, "8bc24781-ae50-4624-9783-ea965db68f96"]);
  const latest = snapshot("2026-09-10T02:00:00Z");
  assert.equal(await saveStudyData(latest), true);
  assert.deepEqual(await loadStudyData(), latest);
});

test("large content persists in IndexedDB even when localStorage has no space", async () => {
  localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
  const data = snapshot();
  data.functions[0].code = "x".repeat(6 * 1024 * 1024);
  assert.equal(await saveStudyData(data), true);
  assert.deepEqual(await loadStudyData(), data);
});

test("newer fallback cache wins after IndexedDB temporarily fails", async () => {
  const database = indexedDB;
  await saveStudyData(snapshot());
  globalThis.indexedDB = undefined;
  const latest = snapshot("2026-09-11T02:00:00Z");
  assert.equal(await saveStudyData(latest), true);
  globalThis.indexedDB = database;
  assert.deepEqual(await loadStudyData(), latest);
  assert.equal(localStorage.getItem("studyapp:study-data:v1"), null);
});

test("storage failures are reported without erasing the previous cache or throwing on marks", async () => {
  globalThis.indexedDB = undefined;
  localStorage.setItem("studyapp:study-data:v1", JSON.stringify(snapshot()));
  localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.equal(await saveStudyData(snapshot("2026-09-12T02:00:00Z")), false);
  assert.deepEqual(await loadStudyData(), snapshot());
  assert.equal(saveFavorites(new Set([1])), false);
  assert.equal(saveReviewedLibraries(new Set(["Python"])), false);
});
