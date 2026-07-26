# StudyApp
# 运行在3000端口

一个个人使用的代码函数学习网站 MVP。

- 手机端学习页：查看函数名称、展开解释和代码、切换学习卡片、搜索和筛选、浏览器本地收藏。
- 电脑端管理页：使用固定账号登录后，添加、修改、删除、查看函数，管理函数库，以及导入和导出 JSON 数据。
- 数据保存：函数位于 `backend/data/functions.json`，函数库位于 `backend/data/libraries.json`。
- 技术栈：React + Vite、Node.js + Express。

## 项目结构

```text
StudyApp/
├── frontend/                 # React 前端
│   ├── src/
│   │   ├── components/
│   │   ├── App.jsx
│   │   └── styles.css
│   └── package.json
├── backend/                  # Express 后端
│   ├── data/functions.json   # 函数数据
│   ├── data/libraries.json   # 函数库列表
│   ├── src/app.js
│   ├── test/api.test.js
│   └── server.js
└── package.json
```

## 环境要求

- Node.js 20.19 或更高版本
- npm 10 或更高版本

查看版本：

```bash
node -v
npm -v
```

## 第一次安装

在项目根目录执行：

```bash
npm run setup
```

该命令会分别安装前端和后端依赖。

## 本地开发

打开第一个终端，启动后端：

```bash
npm run dev --prefix backend
```

后端地址：

```text
http://127.0.0.1:3000
```

打开第二个终端，启动前端：

```bash
npm run dev --prefix frontend
```

浏览器访问：

```text
http://127.0.0.1:5173
```

Vite 会把 `/api` 请求代理到 `127.0.0.1:3000`。

## 运行测试

```bash
npm test
```

测试会在临时 JSON 文件上验证函数和函数库管理以及导入导出，不会修改正式数据。

## 生产构建

先构建前端：

```bash
npm run build
```

然后启动后端：

```bash
npm start
```

构建完成后，Express 会同时提供 API 和前端静态页面，因此只需要启动一个
Node.js 进程。访问：

```text
http://127.0.0.1:3000
```

可通过环境变量修改监听地址和端口：

```bash
HOST=127.0.0.1 PORT=3000 npm start
```

## API

| 方法 | 地址 | 用途 |
| --- | --- | --- |
| `GET` | `/api/health` | 健康检查 |
| `POST` | `/api/auth/login` | 登录固定管理账号 |
| `GET` | `/api/auth/session` | 检查当前登录状态 |
| `POST` | `/api/auth/logout` | 退出当前管理账号 |
| `GET` | `/api/functions` | 获取函数列表 |
| `GET` | `/api/functions/export` | 登录后下载 `functions.json` |
| `POST` | `/api/functions/import?mode=append` | 登录后保留现有数据并新增导入 |
| `POST` | `/api/functions/import?mode=replace` | 登录后覆盖导入全部函数 |
| `POST` | `/api/functions` | 登录后添加函数 |
| `PUT` | `/api/functions/:id` | 登录后修改函数 |
| `DELETE` | `/api/functions/:id` | 登录后删除函数 |
| `GET` | `/api/libraries` | 获取函数库列表 |
| `POST` | `/api/libraries` | 登录后新增函数库 |
| `DELETE` | `/api/libraries/:name` | 登录后删除空函数库 |

管理界面只支持项目内置的一个固定账号，不提供注册或创建账号功能。登录成功后，
服务器通过 `HttpOnly` Cookie 保存会话，有效期为 30 天。会话数据会自动写入
`backend/data/admin-sessions.json`；该运行时文件已加入 `.gitignore`，不会提交
到 Git 仓库。

管理页面中的“导出 functions.json”可以下载当前数据备份。导入时可以选择
“新增到现有数据”或“覆盖现有数据”：新增模式会保留原有函数并为导入函数
重新分配 ID，覆盖模式会替换服务器上的全部函数。两种方式都会先检查 JSON
格式并要求确认。导入文件必须是 JSON 数组，导入和导出的单个
`functions.json` 文件最大为 50MB。

函数库在管理页面中单独新增和删除。添加或修改函数时必须由用户从已有函数库
中选择，新增函数后会保留本次选择，不会自动切换到其他库。仍然包含函数的
函数库不能删除，需要先修改这些函数的所属库或删除函数。导入
`functions.json` 时，文件中出现的新函数库会自动加入库列表。

## 部署到现有 Nginx

假设项目放在：

```text
/opt/StudyApp
```

安装和构建：

```bash
cd /opt/StudyApp
npm run setup
npm run build
```

创建 systemd 服务：

```bash
sudo nano /etc/systemd/system/studyapp.service
```

内容：

```ini
[Unit]
Description=StudyApp Node.js service
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/StudyApp
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now studyapp
sudo systemctl status studyapp --no-pager
```

因为管理页会修改 `functions.json`，需要允许服务用户写入数据目录：

```bash
sudo chown -R www-data:www-data /opt/StudyApp/backend/data
sudo chmod 750 /opt/StudyApp/backend/data
sudo chmod 640 /opt/StudyApp/backend/data/functions.json
```

Nginx 中的 `/blog` 配置：

```nginx
location = /blog {
    return 301 /blog/;
}

location ^~ /blog/ {
    client_max_body_size 50m;
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
}
```

检查并重新加载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

公网访问：

```text
http://62.234.33.110:16010/blog/
```

## 当前版本限制

这是第一版 MVP：

- 只有一个固定管理账号，不支持注册、多账号或分级权限。
- JSON 文件适合个人、低并发使用，不适合多用户同时修改。
- 收藏只保存在当前浏览器的 `localStorage` 中。
