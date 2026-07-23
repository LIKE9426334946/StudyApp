const express = require("express");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_DATA_FILE = path.join(__dirname, "../data/functions.json");
const FRONTEND_DIST = path.resolve(__dirname, "../../frontend/dist");

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFunction(input) {
  return {
    library: normalizeText(input.library) || "其他",
    name: normalizeText(input.name),
    description: normalizeText(input.description),
    parameters: normalizeText(input.parameters),
    code: normalizeText(input.code),
    result: normalizeText(input.result),
  };
}

function validateFunction(item) {
  const missing = [];

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

  if (input.length > 5000) {
    const error = new Error("一次最多导入 5000 个函数");
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

function createApp(options = {}) {
  const dataFile = options.dataFile || process.env.DATA_FILE || DEFAULT_DATA_FILE;
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      service: "StudyApp API",
      time: new Date().toISOString(),
    });
  });

  app.get("/api/functions", async (req, res, next) => {
    try {
      const functions = await readFunctions(dataFile);
      res.json(functions);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/functions/export", async (req, res, next) => {
    try {
      const functions = await readFunctions(dataFile);
      res.attachment("functions.json");
      res.type("application/json");
      return res.send(`${JSON.stringify(functions, null, 2)}\n`);
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/functions/import", async (req, res, next) => {
    try {
      const functions = normalizeImportedFunctions(req.body);
      await writeFunctions(dataFile, functions);

      return res.json({
        message: `成功导入 ${functions.length} 个函数`,
        count: functions.length,
        functions,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/functions", async (req, res, next) => {
    try {
      const item = normalizeFunction(req.body);
      const missing = validateFunction(item);

      if (missing.length > 0) {
        return res.status(400).json({
          message: `请填写：${missing.join("、")}`,
        });
      }

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

  app.put("/api/functions/:id", async (req, res, next) => {
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

  app.delete("/api/functions/:id", async (req, res, next) => {
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
  normalizeImportedFunctions,
  normalizeFunction,
};
