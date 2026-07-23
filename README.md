# StudyApp

一个个人使用的代码函数学习网站 MVP。

- 手机端学习页：查看函数名称、展开解释和代码、切换学习卡片、搜索和筛选、浏览器本地收藏。
- 电脑端管理页：添加、修改、删除和查看函数。
- 数据保存：`backend/data/functions.json`。
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

测试会在临时 JSON 文件上验证函数数据的增删改查，不会修改正式数据。

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
| `GET` | `/api/functions` | 获取函数列表 |
| `POST` | `/api/functions` | 添加函数 |
| `PUT` | `/api/functions/:id` | 修改函数 |
| `DELETE` | `/api/functions/:id` | 删除函数 |

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

- 没有登录和权限系统。
- 管理接口也没有身份验证。
- JSON 文件适合个人、低并发使用，不适合多用户同时修改。
- 收藏只保存在当前浏览器的 `localStorage` 中。

如果直接部署到公网，任何能访问该地址的人都能打开管理页和修改函数数据。增加登录系统之前，建议只在可信网络或个人环境中使用。

