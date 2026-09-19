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

async function filesInDataDirectory(options) {
  const dir = path.dirname(options.dataFile);
  const names = (await fs.readdir(dir)).sort();
  return Object.fromEntries(await Promise.all(names.map(async (name) => [name, await fs.readFile(path.join(dir, name), "utf8")])));
}

async function assertOnlyDataFiles(options) {
  assert.deepEqual(Object.keys(await filesInDataDirectory(options)), ["directories.json", "functions.json", "libraries.json", "sessions.json"]);
}

test("complete backup downloads an attachment without creating or changing server files", async (t) => {
  const { options, request } = await fixture(t);
  for (const missingCatalog of [false, true]) {
    if (missingCatalog) {
      await fs.unlink(options.librariesFile);
      await fs.unlink(options.directoriesFile);
    }
    const before = await filesInDataDirectory(options);
    const response = await request("/api/backup");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-disposition"), /attachment;.*StudyApp-backup\.json/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-accel-buffering"), "no");
    const backup = await response.json();
    assert.equal(backup.format, "StudyApp-backup");
    assert.equal(backup.functions[0].id, 1);
    assert.ok(backup.libraries.includes("Python"));
    assert.ok(backup.directories.some((directory) => directory.libraries.includes("Python")));
    assert.deepEqual(await filesInDataDirectory(options), before);
  }
});

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

test("insertions before numeric and UUID IDs persist in list, study data and backups", async (t) => {
  const { request, options, restart } = await fixture(t);
  async function add(name, extra = {}) {
    const response = await request("/api/functions", "POST", { ...example(name), ...extra });
    assert.equal(response.status, 201);
    return response.json();
  }
  const otherLibrary = await add("array", { library: "NumPy" });
  const anchor = await add("dpkg");
  const tail = await add("chmod");
  const first = await add("first", { beforeId: 1 });
  const inserted = await add("new-command", { beforeId: anchor.id });
  const appended = await add("last");
  const expectedIds = [first.id, 1, otherLibrary.id, inserted.id, anchor.id, tail.id, appended.id];
  const functions = await (await request("/api/functions")).json();
  assert.deepEqual(functions.map((item) => item.id), expectedIds);
  assert.deepEqual(functions.filter((item) => item.library === "Python").map((item) => item.name), ["first", "legacy", "new-command", "dpkg", "chmod", "last"]);
  assert.ok(functions.every((item) => !Object.hasOwn(item, "beforeId")));
  assert.deepEqual(JSON.parse(await fs.readFile(options.dataFile, "utf8")), functions);
  await restart();
  assert.deepEqual((await (await request("/api/study-data")).json()).functions, functions);
  const backup = await (await request("/api/backup")).json();
  assert.deepEqual(backup.functions, functions);
  await add("temporary");
  assert.equal((await request("/api/backup/restore", "POST", backup)).status, 200);
  assert.deepEqual((await (await request("/api/study-data")).json()).functions, functions);
});

test("invalid or stale insertion targets never append or change stored functions", async (t) => {
  const { request, options } = await fixture(t);
  const deleted = await (await request("/api/functions", "POST", example("deleted"))).json();
  await request(`/api/functions/${deleted.id}`, "DELETE");
  const before = await filesInDataDirectory(options);
  for (const [extra, status] of [
    [{ beforeId: {} }, 400],
    [{ beforeId: "invalid" }, 400],
    [{ beforeId: deleted.id }, 404],
    [{ beforeId: 999 }, 404],
    [{ beforeId: 1, library: "NumPy" }, 409],
  ]) {
    const response = await request("/api/functions", "POST", { ...example("invalid-insert"), ...extra });
    assert.equal(response.status, status);
    assert.match((await response.json()).message, /插入位置|目标函数/);
    assert.deepEqual(await filesInDataDirectory(options), before);
  }
});

test("concurrent insertions keep every new function before the same target", async (t) => {
  const { request } = await fixture(t);
  const responses = await Promise.all(Array.from({ length: 5 }, (_, i) => request("/api/functions", "POST", { ...example(`insert-${i}`), beforeId: 1 })));
  assert.ok(responses.every((response) => response.status === 201));
  const created = await Promise.all(responses.map((response) => response.json()));
  const functions = await (await request("/api/functions")).json();
  assert.equal(functions.at(-1).id, 1);
  assert.equal(functions.length, 6);
  assert.deepEqual(new Set(functions.slice(0, -1).map((item) => item.id)), new Set(created.map((item) => item.id)));
});

test("import canonicalizes library names and never reuses imported numeric IDs", async (t) => {
  const { request, options } = await fixture(t);
  const response = await request("/api/functions/import?mode=append", "POST", [{ id: Number.MAX_VALUE, ...example("lowercase", "numpy") }]);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.functions.at(-1).library, "NumPy");
  assert.equal(typeof data.functions.at(-1).id, "string");
  assert.equal(new Set(data.functions.map((item) => item.id)).size, 2);
  const replaced = await (await request("/api/functions/import?mode=replace", "POST", [{ id: 1, ...example("replacement") }])).json();
  assert.notEqual(replaced.functions[0].id, 1);
  await assertOnlyDataFiles(options);
});

test("complete backup restores empty libraries/directories, order and IDs; invalid backups do not write", async (t) => {
  const { request, options } = await fixture(t);
  assert.equal((await request("/api/backup", "GET", undefined, false)).status, 401);
  assert.equal((await request("/api/backup/restore", "POST", {}, false)).status, 401);
  assert.equal((await request("/api/backup/previous", "GET", undefined, false)).status, 401);
  assert.equal((await request("/api/backup/previous")).status, 410);
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
  await assertOnlyDataFiles(options);
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
