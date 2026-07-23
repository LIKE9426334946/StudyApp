const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createApp } = require("../src/app");

test("函数和函数库 API 可以完成管理与导入导出", async (t) => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "study-app-"));
  const dataFile = path.join(tempDirectory, "functions.json");
  const librariesFile = path.join(tempDirectory, "libraries.json");

  await fs.writeFile(
    dataFile,
    JSON.stringify([
      {
        id: 1,
        library: "JavaScript",
        name: "Array.map()",
        description: "返回新数组",
        parameters: "callback",
        code: "[1, 2].map(x => x * 2)",
        result: "[2, 4]",
      },
    ]),
    "utf8",
  );
  await fs.writeFile(librariesFile, JSON.stringify(["JavaScript"]), "utf8");

  const server = createApp({ dataFile, librariesFile }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await fs.rm(tempDirectory, { recursive: true, force: true });
  });

  const listResponse = await fetch(`${baseUrl}/api/functions`);
  assert.equal(listResponse.status, 200);
  assert.equal((await listResponse.json()).length, 1);

  const librariesResponse = await fetch(`${baseUrl}/api/libraries`);
  assert.equal(librariesResponse.status, 200);
  assert.deepEqual(await librariesResponse.json(), ["JavaScript"]);

  const unknownLibraryResponse = await fetch(`${baseUrl}/api/functions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      library: "不存在",
      name: "unknown()",
      description: "测试不存在的函数库",
      code: "unknown()",
    }),
  });
  assert.equal(unknownLibraryResponse.status, 400);

  const createLibraryResponse = await fetch(`${baseUrl}/api/libraries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Python" }),
  });
  assert.equal(createLibraryResponse.status, 201);
  assert.deepEqual(await createLibraryResponse.json(), { name: "Python" });

  const duplicateLibraryResponse = await fetch(`${baseUrl}/api/libraries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "python" }),
  });
  assert.equal(duplicateLibraryResponse.status, 409);

  const createEmptyLibraryResponse = await fetch(`${baseUrl}/api/libraries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Rust" }),
  });
  assert.equal(createEmptyLibraryResponse.status, 201);

  const deleteEmptyLibraryResponse = await fetch(
    `${baseUrl}/api/libraries/${encodeURIComponent("Rust")}`,
    { method: "DELETE" },
  );
  assert.equal(deleteEmptyLibraryResponse.status, 204);

  const pageResponse = await fetch(baseUrl);
  assert.equal(pageResponse.status, 200);
  assert.match(await pageResponse.text(), /<div id="root"><\/div>/);

  const createResponse = await fetch(`${baseUrl}/api/functions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      library: "Python",
      name: "len()",
      description: "返回对象长度",
      parameters: "object",
      code: "len([1, 2, 3])",
      result: "3",
    }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  assert.equal(created.id, 2);

  const updateResponse = await fetch(`${baseUrl}/api/functions/2`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...created,
      description: "返回容器中的项目数量",
    }),
  });
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json()).description, "返回容器中的项目数量");

  const deleteResponse = await fetch(`${baseUrl}/api/functions/1`, {
    method: "DELETE",
  });
  assert.equal(deleteResponse.status, 204);

  const finalResponse = await fetch(`${baseUrl}/api/functions`);
  const finalItems = await finalResponse.json();
  assert.deepEqual(finalItems.map((item) => item.id), [2]);

  const exportResponse = await fetch(`${baseUrl}/api/functions/export`);
  assert.equal(exportResponse.status, 200);
  assert.match(
    exportResponse.headers.get("content-disposition"),
    /attachment; filename="functions\.json"/,
  );
  assert.deepEqual(
    (await exportResponse.json()).map((item) => item.id),
    [2],
  );

  const invalidImportResponse = await fetch(`${baseUrl}/api/functions/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ functions: [] }),
  });
  assert.equal(invalidImportResponse.status, 400);
  assert.match(
    (await invalidImportResponse.json()).message,
    /顶层数据必须是数组/,
  );

  const unchangedResponse = await fetch(`${baseUrl}/api/functions`);
  assert.deepEqual(
    (await unchangedResponse.json()).map((item) => item.id),
    [2],
  );

  const invalidModeResponse = await fetch(
    `${baseUrl}/api/functions/import?mode=invalid`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    },
  );
  assert.equal(invalidModeResponse.status, 400);

  const appendImportResponse = await fetch(
    `${baseUrl}/api/functions/import?mode=append`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          id: 2,
          library: "NumPy",
          name: "numpy.sum()",
          description: "计算元素总和",
          parameters: "array",
          code: "np.sum([1, 2, 3])",
          result: "6",
        },
      ]),
    },
  );
  assert.equal(appendImportResponse.status, 200);
  const appendImportResult = await appendImportResponse.json();
  assert.equal(appendImportResult.mode, "append");
  assert.equal(appendImportResult.importedCount, 1);
  assert.equal(appendImportResult.count, 2);
  assert.deepEqual(
    appendImportResult.functions.map((item) => item.id),
    [2, 3],
  );

  const importResponse = await fetch(
    `${baseUrl}/api/functions/import?mode=replace`,
    {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      {
        id: 7,
        library: "Python",
        name: "len()",
        description: "返回对象长度",
        parameters: "object",
        code: "len([1, 2, 3])",
        result: "3",
      },
      {
        id: 7,
        library: "NumPy",
        name: "numpy.mean()",
        description: "计算平均值",
        parameters: "array",
        code: "np.mean([1, 2, 3])",
        result: "2.0",
      },
    ]),
    },
  );
  assert.equal(importResponse.status, 200);
  const importResult = await importResponse.json();
  assert.equal(importResult.mode, "replace");
  assert.equal(importResult.importedCount, 2);
  assert.equal(importResult.count, 2);
  assert.deepEqual(
    importResult.functions.map((item) => item.id),
    [7, 8],
  );

  const importedListResponse = await fetch(`${baseUrl}/api/functions`);
  const importedItems = await importedListResponse.json();
  assert.deepEqual(
    importedItems.map((item) => item.name),
    ["len()", "numpy.mean()"],
  );

  const importedLibrariesResponse = await fetch(`${baseUrl}/api/libraries`);
  assert.deepEqual(await importedLibrariesResponse.json(), [
    "JavaScript",
    "Python",
    "NumPy",
  ]);

  const deleteUsedLibraryResponse = await fetch(
    `${baseUrl}/api/libraries/${encodeURIComponent("Python")}`,
    { method: "DELETE" },
  );
  assert.equal(deleteUsedLibraryResponse.status, 409);
  assert.match(
    (await deleteUsedLibraryResponse.json()).message,
    /还有函数/,
  );

  const deleteUnusedLibraryResponse = await fetch(
    `${baseUrl}/api/libraries/${encodeURIComponent("JavaScript")}`,
    { method: "DELETE" },
  );
  assert.equal(deleteUnusedLibraryResponse.status, 204);
});
