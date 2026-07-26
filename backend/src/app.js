const express = require("express");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_DATA_FILE = path.join(__dirname, "../data/functions.json");
const DEFAULT_LIBRARIES_FILE = path.join(__dirname, "../data/libraries.json");
const DEFAULT_SESSIONS_FILE = path.join(
  __dirname,
  "../data/admin-sessions.json",
);
const FRONTEND_DIST = path.resolve(__dirname, "../../frontend/dist");
const MAX_JSON_FILE_SIZE = 50 * 1024 * 1024;
const ADMIN_USERNAME = "noart";
const ADMIN_PASSWORD = "Suki-is-a-dummy";
const SESSION_COOKIE_NAME = "studyapp_admin_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFunction(input) {
  return {
    library: normalizeText(input.library),
    name: normalizeText(input.name),
    description: normalizeText(input.description),
    parameters: normalizeText(input.parameters),
    code: normalizeText(input.code),
    result: normalizeText(input.result),
  };
}

function validateFunction(item) {
  const missing = [];

  if (!item.library) missing.push("函数库");
  if (!item.name) missing.push("函数名称");
  if (!item.description) missing.push("函数介绍");
  if (!item.code) missing.push("代码示例");

  return missing;
}

function normalizeImportedFunctions(input) {
  if (!Array.isArray(input)) {
    const error = new Error("导入文件的顶层数据必须是数组");
    error.status = 400;
    throw error;
  }

  const largestImportedId = input.reduce((largestId, item) => {
    const id = Number(item?.id);
    return Number.isInteger(id) && id > largestId ? id : largestId;
  }, 0);
  const usedIds = new Set();
  let nextId = largestImportedId + 1;

  return input.map((inputItem, index) => {
    if (!inputItem || typeof inputItem !== "object" || Array.isArray(inputItem)) {
      const error = new Error(`第 ${index + 1} 条函数数据必须是对象`);
      error.status = 400;
      throw error;
    }

    const item = normalizeFunction(inputItem);
    const missing = validateFunction(item);

    if (missing.length > 0) {
      const error = new Error(
        `第 ${index + 1} 条函数数据缺少：${missing.join("、")}`,
      );
      error.status = 400;
      throw error;
    }

    const importedId = Number(inputItem.id);
    let id =
      Number.isInteger(importedId) && importedId > 0 && !usedIds.has(importedId)
        ? importedId
        : nextId++;

    while (usedIds.has(id)) {
      id = nextId++;
    }

    usedIds.add(id);
    return { id, ...item };
  });
}

async function readFunctions(dataFile) {
  const content = await fsp.readFile(dataFile, "utf8");
  const functions = JSON.parse(content);

  if (!Array.isArray(functions)) {
    throw new Error("functions.json 的顶层数据必须是数组");
  }

  return functions;
}

async function writeFunctions(dataFile, functions) {
  const tempFile = `${dataFile}.tmp`;
  await fsp.mkdir(path.dirname(dataFile), { recursive: true });
  await fsp.writeFile(tempFile, `${JSON.stringify(functions, null, 2)}\n`, "utf8");
  await fsp.rename(tempFile, dataFile);
}

async function writeLibraries(librariesFile, libraries) {
  const tempFile = `${librariesFile}.tmp`;
  await fsp.mkdir(path.dirname(librariesFile), { recursive: true });
  await fsp.writeFile(tempFile, `${JSON.stringify(libraries, null, 2)}\n`, "utf8");
  await fsp.rename(tempFile, librariesFile);
}

function uniqueLibraryNames(names) {
  const seen = new Set();

  return names.reduce((result, value) => {
    const name = normalizeText(value);
    const key = name.toLocaleLowerCase();

    if (name && !seen.has(key)) {
      seen.add(key);
      result.push(name);
    }

    return result;
  }, []);
}

async function readStoredLibraries(librariesFile) {
  try {
    const content = await fsp.readFile(librariesFile, "utf8");
    const libraries = JSON.parse(content);

    if (!Array.isArray(libraries)) {
      throw new Error("libraries.json 的顶层数据必须是数组");
    }

    return uniqueLibraryNames(libraries);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function readLibraries(librariesFile, dataFile) {
  const [storedLibraries, functions] = await Promise.all([
    readStoredLibraries(librariesFile),
    readFunctions(dataFile),
  ]);
  const libraries = uniqueLibraryNames([
    ...storedLibraries,
    ...functions.map((item) => item.library),
  ]);

  if (JSON.stringify(libraries) !== JSON.stringify(storedLibraries)) {
    await writeLibraries(librariesFile, libraries);
  }

  return libraries;
}

function findLibrary(libraries, requestedName) {
  const key = normalizeText(requestedName).toLocaleLowerCase();
  return libraries.find((name) => name.toLocaleLowerCase() === key);
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value)).digest();
}

function safeEqual(value, expected) {
  return crypto.timingSafeEqual(hashValue(value), hashValue(expected));
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, part) => {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex === -1) {
      return cookies;
    }

    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();

    if (!name) {
      return cookies;
    }

    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }

    return cookies;
  }, {});
}

function getSessionToken(req) {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME] || "";
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function readSessions(sessionsFile) {
  try {
    const content = await fsp.readFile(sessionsFile, "utf8");
    const sessions = JSON.parse(content);

    if (!Array.isArray(sessions)) {
      throw new Error("admin-sessions.json 的顶层数据必须是数组");
    }

    return sessions;
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeSessions(sessionsFile, sessions) {
  const tempFile = `${sessionsFile}.tmp`;
  await fsp.mkdir(path.dirname(sessionsFile), { recursive: true });
  await fsp.writeFile(
    tempFile,
    `${JSON.stringify(sessions, null, 2)}\n`,
    "utf8",
  );
  await fsp.rename(tempFile, sessionsFile);
}

function activeSessions(sessions, now = Date.now()) {
  return sessions.filter(
    (session) =>
      typeof session?.tokenHash === "string" &&
      Number.isFinite(Date.parse(session.expiresAt)) &&
      Date.parse(session.expiresAt) > now,
  );
}

function sessionCookie(token, req, maxAgeSeconds) {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
  ];
  const forwardedProtocol = req.get("x-forwarded-proto");

  if (req.secure || forwardedProtocol === "https") {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

function createApp(options = {}) {
  const dataFile = options.dataFile || process.env.DATA_FILE || DEFAULT_DATA_FILE;
  const librariesFile =
    options.librariesFile || process.env.LIBRARIES_FILE || DEFAULT_LIBRARIES_FILE;
  const sessionsFile =
    options.sessionsFile || process.env.SESSIONS_FILE || DEFAULT_SESSIONS_FILE;
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: MAX_JSON_FILE_SIZE }));

  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      service: "StudyApp API",
      time: new Date().toISOString(),
    });
  });

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      res.set("Cache-Control", "no-store");
      const username = normalizeText(req.body?.username);
      const password =
        typeof req.body?.password === "string" ? req.body.password : "";

      if (
        !safeEqual(username, ADMIN_USERNAME) ||
        !safeEqual(password, ADMIN_PASSWORD)
      ) {
        return res.status(401).json({ message: "用户名或密码错误" });
      }

      const now = Date.now();
      const token = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(now + SESSION_DURATION_MS).toISOString();
      const sessions = activeSessions(await readSessions(sessionsFile), now);

      sessions.push({
        tokenHash: hashSessionToken(token),
        expiresAt,
      });
      await writeSessions(sessionsFile, sessions);

      res.set(
        "Set-Cookie",
        sessionCookie(token, req, SESSION_DURATION_MS / 1000),
      );
      return res.json({
        authenticated: true,
        username: ADMIN_USERNAME,
        expiresAt,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/auth/session", async (req, res, next) => {
    try {
      res.set("Cache-Control", "no-store");
      const token = getSessionToken(req);

      if (!token) {
        return res.status(401).json({ message: "请先登录管理账号" });
      }

      const now = Date.now();
      const sessions = await readSessions(sessionsFile);
      const currentTokenHash = hashSessionToken(token);
      const session = sessions.find(
        (item) =>
          item.tokenHash === currentTokenHash &&
          Date.parse(item.expiresAt) > now,
      );
      const currentSessions = activeSessions(sessions, now);

      if (currentSessions.length !== sessions.length) {
        await writeSessions(sessionsFile, currentSessions);
      }

      if (!session) {
        res.set("Set-Cookie", sessionCookie("", req, 0));
        return res.status(401).json({ message: "登录已过期，请重新登录" });
      }

      return res.json({
        authenticated: true,
        username: ADMIN_USERNAME,
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/auth/logout", async (req, res, next) => {
    try {
      res.set("Cache-Control", "no-store");
      const token = getSessionToken(req);
      const currentTokenHash = token ? hashSessionToken(token) : "";
      const sessions = activeSessions(await readSessions(sessionsFile)).filter(
        (session) => session.tokenHash !== currentTokenHash,
      );

      await writeSessions(sessionsFile, sessions);
      res.set("Set-Cookie", sessionCookie("", req, 0));
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  async function requireAdmin(req, res, next) {
    try {
      const token = getSessionToken(req);

      if (!token) {
        return res.status(401).json({ message: "请先登录管理账号" });
      }

      const now = Date.now();
      const sessions = await readSessions(sessionsFile);
      const currentSessions = activeSessions(sessions, now);
      const authenticated = currentSessions.some(
        (session) => session.tokenHash === hashSessionToken(token),
      );

      if (currentSessions.length !== sessions.length) {
        await writeSessions(sessionsFile, currentSessions);
      }

      if (!authenticated) {
        res.set("Set-Cookie", sessionCookie("", req, 0));
        return res.status(401).json({ message: "登录已过期，请重新登录" });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  }

  app.get("/api/functions", async (req, res, next) => {
    try {
      const functions = await readFunctions(dataFile);
      res.json(functions);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/functions/export", requireAdmin, async (req, res, next) => {
    try {
      const functions = await readFunctions(dataFile);
      const content = `${JSON.stringify(functions, null, 2)}\n`;

      if (Buffer.byteLength(content, "utf8") > MAX_JSON_FILE_SIZE) {
        return res.status(413).json({
          message: "functions.json 超过 50MB，无法导出",
        });
      }

      res.attachment("functions.json");
      res.type("application/json");
      return res.send(content);
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/functions/import", requireAdmin, async (req, res, next) => {
    try {
      const mode = normalizeText(req.query.mode) || "replace";

      if (!["append", "replace"].includes(mode)) {
        return res.status(400).json({
          message: "导入方式必须是 append 或 replace",
        });
      }

      const importedFunctions = normalizeImportedFunctions(req.body);
      let functions = importedFunctions;

      if (mode === "append") {
        const existingFunctions = await readFunctions(dataFile);

        let nextId =
          existingFunctions.reduce(
            (maxId, current) => Math.max(maxId, Number(current.id) || 0),
            0,
          ) + 1;
        const appendedFunctions = importedFunctions.map((item) => ({
          ...item,
          id: nextId++,
        }));

        functions = [...existingFunctions, ...appendedFunctions];
      }

      await writeFunctions(dataFile, functions);
      await readLibraries(librariesFile, dataFile);

      return res.json({
        message:
          mode === "append"
            ? `成功新增导入 ${importedFunctions.length} 个函数`
            : `成功覆盖导入 ${importedFunctions.length} 个函数`,
        mode,
        importedCount: importedFunctions.length,
        count: functions.length,
        functions,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/functions", requireAdmin, async (req, res, next) => {
    try {
      const item = normalizeFunction(req.body);
      const missing = validateFunction(item);

      if (missing.length > 0) {
        return res.status(400).json({
          message: `请填写：${missing.join("、")}`,
        });
      }

      const libraries = await readLibraries(librariesFile, dataFile);
      const library = findLibrary(libraries, item.library);

      if (!library) {
        return res.status(400).json({
          message: "请选择已经创建的函数库",
        });
      }

      item.library = library;
      const functions = await readFunctions(dataFile);
      const nextId =
        functions.reduce((maxId, current) => Math.max(maxId, Number(current.id) || 0), 0) + 1;
      const created = { id: nextId, ...item };

      functions.push(created);
      await writeFunctions(dataFile, functions);

      return res.status(201).json(created);
    } catch (error) {
      return next(error);
    }
  });

  app.put("/api/functions/:id", requireAdmin, async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "函数 ID 无效" });
      }

      const item = normalizeFunction(req.body);
      const missing = validateFunction(item);

      if (missing.length > 0) {
        return res.status(400).json({
          message: `请填写：${missing.join("、")}`,
        });
      }

      const libraries = await readLibraries(librariesFile, dataFile);
      const library = findLibrary(libraries, item.library);

      if (!library) {
        return res.status(400).json({
          message: "请选择已经创建的函数库",
        });
      }

      item.library = library;
      const functions = await readFunctions(dataFile);
      const index = functions.findIndex((current) => Number(current.id) === id);

      if (index === -1) {
        return res.status(404).json({ message: "没有找到这个函数" });
      }

      const updated = { id, ...item };
      functions[index] = updated;
      await writeFunctions(dataFile, functions);

      return res.json(updated);
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/functions/:id", requireAdmin, async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "函数 ID 无效" });
      }

      const functions = await readFunctions(dataFile);
      const remaining = functions.filter((current) => Number(current.id) !== id);

      if (remaining.length === functions.length) {
        return res.status(404).json({ message: "没有找到这个函数" });
      }

      await writeFunctions(dataFile, remaining);
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/libraries", async (req, res, next) => {
    try {
      const libraries = await readLibraries(librariesFile, dataFile);
      return res.json(libraries);
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/libraries", requireAdmin, async (req, res, next) => {
    try {
      const name = normalizeText(req.body?.name);

      if (!name) {
        return res.status(400).json({ message: "请输入函数库名称" });
      }

      if (name.length > 50) {
        return res.status(400).json({ message: "函数库名称不能超过 50 个字符" });
      }

      const libraries = await readLibraries(librariesFile, dataFile);

      if (findLibrary(libraries, name)) {
        return res.status(409).json({ message: "这个函数库已经存在" });
      }

      libraries.push(name);
      await writeLibraries(librariesFile, libraries);
      return res.status(201).json({ name });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/libraries/:name", requireAdmin, async (req, res, next) => {
    try {
      const libraries = await readLibraries(librariesFile, dataFile);
      const library = findLibrary(libraries, req.params.name);

      if (!library) {
        return res.status(404).json({ message: "没有找到这个函数库" });
      }

      const functions = await readFunctions(dataFile);
      const isInUse = functions.some(
        (item) =>
          normalizeText(item.library).toLocaleLowerCase() ===
          library.toLocaleLowerCase(),
      );

      if (isInUse) {
        return res.status(409).json({
          message: `“${library}”中还有函数，请先移动或删除这些函数`,
        });
      }

      const remaining = libraries.filter((name) => name !== library);
      await writeLibraries(librariesFile, remaining);
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  if (fs.existsSync(FRONTEND_DIST)) {
    app.use(express.static(FRONTEND_DIST));

    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api/")) {
        return res.sendFile(path.join(FRONTEND_DIST, "index.html"));
      }

      return next();
    });
  }

  app.use("/api", (req, res) => {
    res.status(404).json({ message: "API 地址不存在" });
  });

  app.use((error, req, res, next) => {
    if (error.status === 413 || error.type === "entity.too.large") {
      return res.status(413).json({ message: "JSON 文件不能超过 50MB" });
    }

    if (error instanceof SyntaxError && "body" in error) {
      return res.status(400).json({ message: "请求中的 JSON 格式不正确" });
    }

    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error(error);

    return res.status(500).json({
      message: "服务器处理请求时发生错误",
    });
  });

  return app;
}

module.exports = {
  createApp,
  findLibrary,
  normalizeImportedFunctions,
  normalizeFunction,
  uniqueLibraryNames,
};
