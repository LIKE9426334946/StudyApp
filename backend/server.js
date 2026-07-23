const { createApp } = require("./src/app");

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const app = createApp();

const server = app.listen(port, host, () => {
  console.log(`StudyApp 已启动：http://${host}:${port}`);
});

server.on("error", (error) => {
  console.error("StudyApp 启动失败：", error.message);
  process.exit(1);
});

