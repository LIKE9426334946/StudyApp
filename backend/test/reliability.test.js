const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createApp } = require("../src/app");

const example = (name, library = "Python") => ({ library, name, description: "说明", code: "print(1)", parameters: "", result: "1" });
async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "studyapp-reliability-"));
  const options = {
    dataFile: path.join(dir, "functions.json"),
    librariesFile: path.join(dir, "libraries.json"),
    directoriesFile: path.join(dir, "directories.json"),
    sessionsFile: path.join(dir, "sessions.json"),
    adminPassword: "test-only-password",
  };
  await fs.writeFile(options.dataFile, JSON.stringify([{ id: 1, ...example("legacy") }]));
  await fs.writeFile(options.librariesFile, JSON.stringify(["Python", "NumPy", "Empty"]));
  await fs.writeFile(options.directoriesFile, JSON.stringify([{ name: "Python", libraries: ["Python", "NumPy"] }, { name: "Empty directory", libraries: [] }, { name: "未分类", libraries: ["Empty"] }]));
  let server;
  let base;
  async function start() {
    server = createApp(options).listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() { await new Promise((resolve) => server.close(resolve)); }
  await start();
  t.after(async () => { await stop(); await fs.rm(dir, { recursive: true, force: true }); });
  let cookie = "";
  async function request(url, method = "GET", body, authenticated = true) {
    return fetch(`${base}${url}`, { method, headers: { ...(authenticated ? { cookie } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  }
  const login = await request("/api/auth/login", "POST", { username: "noart", password: options.adminPassword });
  cookie = login.headers.get("set-cookie").split(";")[0];
  await login.arrayBuffer();
  return { options, request, restart: async () => { await stop(); await start(); } };
}

test("parallel saves preserve every record; IDs survive deletion and restart without reuse", async (t) => {
  const f = await fixture(t);
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => f.request("/api/functions", "POST", example(`parallel-${i}`))));
  assert.deepEqual(results.map((r) => r.status), Array(12).fill(201));
  const created = await Promise.all(results.map((r) => r.json()));
  assert.equal(new Set(created.map((item) => item.id)).size, 12);
  const stored = await (await f.request("/api/functions")).json();
  assert.equal(stored.length, 13);
  assert.equal(stored[0].id, 1);
  const deleted = created.at(-1).id;
  assert.equal((await f.request(`/api/functions/${deleted}`, "DELETE")).status, 204);
  await f.restart();
  const next = await (await f.request("/api/functions", "POST", example("after-restart"))).json();
  assert.ok(!created.some((item) => item.id === next.id));
  assert.equal((await f.request(`/api/functions/${deleted}`, "PUT", example("stale-editor"))).status, 404);
  assert.equal((await f.request("/api/functions/1", "PUT", example("legacy-edited"))).status, 200);
});

test("import canonicalizes library names and never reuses imported numeric IDs", async (t) => {
  const { request } = await fixture(t);
  const response = await request("/api/functions/import?mode=append", "POST", [{ id: Number.MAX_VALUE, ...example("lowercase", "numpy") }]);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.functions.at(-1).library, "NumPy");
  assert.equal(typeof data.functions.at(-1).id, "string");
  assert.equal(new Set(data.functions.map((item) => item.id)).size, 2);
  const replaced = await (await request("/api/functions/import?mode=replace", "POST", [{ id: 1, ...example("replacement") }])).json();
  assert.notEqual(replaced.functions[0].id, 1);
  const previous = await (await request("/api/backup/previous")).json();
  assert.equal(previous.functions.length, 2);
});

test("complete backup restores empty libraries/directories, order and IDs; invalid backups do not write", async (t) => {
  const { request } = await fixture(t);
  assert.equal((await request("/api/backup", "GET", undefined, false)).status, 401);
  assert.equal((await request("/api/backup/restore", "POST", {}, false)).status, 401);
  assert.equal((await request("/api/backup/previous", "GET", undefined, false)).status, 401);
  const backup = await (await request("/api/backup")).json();
  await request("/api/functions", "POST", example("extra"));
  await request("/api/libraries/order", "PUT", { libraries: ["Empty", "NumPy", "Python"] });
  const beforeRestore = await (await request("/api/study-data")).json();
  const invalid = structuredClone(backup);
  invalid.directories[0].libraries.push("not-created");
  assert.equal((await request("/api/backup/restore", "POST", invalid)).status, 400);
  assert.deepEqual(await (await request("/api/study-data")).json(), beforeRestore);
  assert.equal((await request("/api/backup/restore", "POST", backup)).status, 200);
  const restored = await (await request("/api/study-data")).json();
  for (const field of ["functions", "libraries", "directories"]) assert.deepEqual(restored[field], backup[field]);
  const previous = await (await request("/api/backup/previous")).json();
  for (const field of ["functions", "libraries", "directories"]) assert.deepEqual(previous[field], beforeRestore[field]);
});

test("restart recovers an interrupted multi-file restore before serving any data", async (t) => {
  const f = await fixture(t);
  const snapshot = { functions: [{ id: 9, ...example("restored", "Other") }], libraries: ["Other"], directories: [{ name: "未分类", libraries: ["Other"] }] };
  await fs.writeFile(`${f.options.dataFile}.restore-journal.json`, JSON.stringify(snapshot));
  await fs.writeFile(f.options.dataFile, JSON.stringify(snapshot.functions));
  await f.restart();
  assert.deepEqual(await (await f.request("/api/study-data")).json(), snapshot);
  await assert.rejects(fs.access(`${f.options.dataFile}.restore-journal.json`), { code: "ENOENT" });
});

test("description markup remains exact in API storage and complete backup restore", async (t) => {
  const { request } = await fixture(t);
  const description = "这是`立方函数`，$y=a^3$。\n分数 $\\frac{a}{b}$";
  const created = await (await request("/api/functions", "POST", { ...example("formatted"), description })).json();
  assert.equal(created.description, description);
  const backup = await (await request("/api/backup")).json();
  assert.equal(backup.functions.find((item) => item.id === created.id).description, description);
  assert.equal((await request("/api/backup/restore", "POST", backup)).status, 200);
  const data = await (await request("/api/study-data")).json();
  assert.equal(data.functions.find((item) => item.id === created.id).description, description);
});
