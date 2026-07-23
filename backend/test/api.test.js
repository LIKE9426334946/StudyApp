const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createApp } = require("../src/app");

test("函数 API 可以完成增删改查", async (t) => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "study-app-"));
  const dataFile = path.join(tempDirectory, "functions.json");

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

  const server = createApp({ dataFile }).listen(0, "127.0.0.1");
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
});
