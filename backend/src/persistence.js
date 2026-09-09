const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

async function writeJson(file, value) {
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(temp, file);
  } finally {
    await fs.rm(temp, { force: true });
  }
}

// Serialize complete request handlers, including GET handlers that migrate JSON.
// Await handler completion even when the client disconnects during a write.
function queuedRoutes(app, beforeRequest = async () => {}) {
  let tail = Promise.resolve();
  return Object.fromEntries(["get", "post", "put", "delete"].map((method) => [
    method,
    (route, ...handlers) => app[method](route, (req, res, next) => {
      const task = tail.then(async () => {
        await beforeRequest();
        for (const handler of handlers) {
          let advance = false;
          let failure;
          await handler(req, res, (error) => { advance = true; failure = error; });
          if (failure) throw failure;
          if (!advance) return;
        }
        next();
      });
      tail = task.catch(() => {});
      task.catch(next);
    }),
  ]));
}

// A complete journal lets the next request / process restart finish a restore
// after an interrupted multi-file write. File paths always come from the server.
function snapshotStore(files, journalFile) {
  async function recover() {
    let snapshot;
    try {
      snapshot = JSON.parse(await fs.readFile(journalFile, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const [key, file] of Object.entries(files)) {
      if (!Array.isArray(snapshot[key])) throw new Error("恢复日志格式无效");
      await writeJson(file, snapshot[key]);
    }
    await fs.rm(journalFile);
  }
  return {
    recover,
    async commit(snapshot) {
      await writeJson(journalFile, snapshot);
      await recover();
    },
  };
}

module.exports = { writeJson, queuedRoutes, snapshotStore };
