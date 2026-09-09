# StudyApp 部署说明

本文对应当前 `main` 分支，使用 Ubuntu、root 用户和 Node.js + Nginx + systemd 部署。
前端构建后由 Express 提供页面和 API，数据保存在服务器 JSON 文件中，只运行一个 Node.js 服务实例。

## 部署配置

| 项目 | 配置 |
| --- | --- |
| 项目目录 | `/opt/StudyApp` |
| Git 分支 | `main` |
| 公网访问地址 | `http://服务器IP:16000/` |
| Nginx 对外监听 | `16000` |
| Node.js 内部监听 | `127.0.0.1:3000` |
| systemd 服务 | `StudyApp.service` |
| 服务配置文件 | `/etc/systemd/system/StudyApp.service` |
| Nginx 配置文件 | `/etc/nginx/sites-available/StudyApp` |
| 管理账号配置 | `/opt/StudyApp/backend/.env` |

请求通过 Nginx 的 `16000` 端口转发到 `127.0.0.1:3000`。Node.js 仅监听本机地址。
部署模板在 [deploy/StudyApp.service](deploy/StudyApp.service) 和
[deploy/StudyApp.nginx.conf](deploy/StudyApp.nginx.conf) 中，包含自动重启、代理请求头和 WebSocket 转发配置。

## 首次部署

### 1. 安装运行环境

以下命令全部以 root 执行。当前依赖要求 Node.js 至少为 `22.12.0`，本部署使用 Node.js 22，
仓库的 `.nvmrc` 与之保持一致。已有符合要求的 Node.js 22 或 24 时，可跳过 Node.js 安装。

```bash
apt update
apt install -y git curl ca-certificates nginx nano
```

按照 [NodeSource 安装说明](https://github.com/nodesource/distributions/blob/master/DEV_README.md#installation-instructions-deb)安装 Node.js 22：

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/studyapp-nodesource-setup.sh
bash /tmp/studyapp-nodesource-setup.sh
apt install -y nodejs
```

确认 npm 和 systemd 使用的 Node.js 均已安装：

```bash
node -v
npm -v
/usr/bin/node -v
```

服务模板使用 `/usr/bin/node`。如果 Node.js 安装在其他位置，将
`deploy/StudyApp.service` 的 `ExecStart` 中解释器路径改为该可执行文件的绝对路径，再安装服务。

### 2. 获取源码并构建

```bash
mkdir -p /opt/StudyApp
git clone --branch main https://github.com/LIKE9426334946/StudyApp.git /opt/StudyApp
cd /opt/StudyApp
npm run setup
npm run build
```

`npm run setup` 根据锁文件安装前后端依赖；`npm run build` 生成 `frontend/dist`。
后续启动 Express 即可提供完整网站，生产部署无需启动 Vite 开发服务器。
目录中已有仓库时，使用下方“更新部署”步骤。

### 3. 设置管理账号

```bash
cd /opt/StudyApp
touch backend/.env
chmod 600 backend/.env
nano backend/.env
```

填写以下内容，并将密码替换成你自己的密码：

```ini
STUDYAPP_ADMIN_USERNAME=noart
STUDYAPP_ADMIN_PASSWORD='请替换为你的管理密码'
```

此文件由 systemd 的 `EnvironmentFile` 读取，已被 Git 忽略。该文件只填写账号配置，
不要另外设置 `HOST` 或 `PORT`，以免覆盖服务模板中的 `127.0.0.1:3000`。
手机学习页直接访问；电脑端点击“管理”，使用这里设置的账号登录。

### 4. 安装并启动 systemd 服务

```bash
cd /opt/StudyApp
cp deploy/StudyApp.service /etc/systemd/system/StudyApp.service
systemctl daemon-reload
systemctl enable --now StudyApp
systemctl status StudyApp --no-pager
```

服务以 root 运行，工作目录为 `/opt/StudyApp`，设置 `NODE_ENV=production`、
`HOST=127.0.0.1`、`PORT=3000`，开机自启，异常退出后自动重启。

### 5. 安装并启用 Nginx 配置

```bash
cd /opt/StudyApp
cp deploy/StudyApp.nginx.conf /etc/nginx/sites-available/StudyApp
ln -sfn /etc/nginx/sites-available/StudyApp /etc/nginx/sites-enabled/StudyApp
nginx -t
systemctl enable --now nginx
systemctl reload nginx
```

确认 `nginx -t` 通过后再启动或重载。`16000` 端口只启用一份 StudyApp 配置；
如果该端口已有 StudyApp 的 Nginx 配置，请替换对应配置，避免重复启用。

在云服务器安全组中放行入站 TCP `16000`。如果服务器已启用 UFW，再执行：

```bash
ufw allow 16000/tcp
```

### 6. 检查访问

在服务器上分别检查 Node.js 和 Nginx：

```bash
curl --fail http://127.0.0.1:3000/api/health
curl --fail http://127.0.0.1:16000/api/health
```

两次都应返回包含 `"ok":true` 的 JSON。然后在电脑或手机浏览器访问：

```text
http://服务器IP:16000/
```

## 更新部署

更新前在管理页面下载“完整备份”，保留当前函数、函数库、目录和排序。
按顺序执行以下命令；某一步报错时先处理该错误，再继续下一步：

```bash
cd /opt/StudyApp
git pull --ff-only origin main
npm run setup
npm run build
cp deploy/StudyApp.service /etc/systemd/system/StudyApp.service
cp deploy/StudyApp.nginx.conf /etc/nginx/sites-available/StudyApp
ln -sfn /etc/nginx/sites-available/StudyApp /etc/nginx/sites-enabled/StudyApp
nginx -t
systemctl daemon-reload
systemctl restart StudyApp
systemctl reload nginx
curl --fail http://127.0.0.1:16000/api/health
```

保留 `backend/.env` 中的管理账号配置。如果使用了自定义 Node.js 绝对路径，
复制服务模板前同步该路径。遇到 `git pull` 的数据文件冲突时，先保留 `backend/data`，
处理冲突后再继续，不要用仓库中的示例数据覆盖自己的学习内容。

部署完成后重新加载网页。手机端目录中的“刷新”用于同步服务器学习内容；
不点击时会继续使用本机保存的内容。

## 数据与备份

| 文件 | 内容 |
| --- | --- |
| `backend/data/functions.json` | 函数、介绍、参数、代码与运行结果 |
| `backend/data/libraries.json` | 函数库及顺序 |
| `backend/data/directories.json` | 目录、函数库归属及顺序 |
| `backend/data/admin-sessions.json` | 管理登录会话，由运行中的服务生成 |

管理页面的“完整备份”可以下载和恢复学习内容，保持函数 ID、目录和排序。
点击“下载完整备份”后，文件由浏览器保存到当前电脑的下载目录，或浏览器询问的保存位置。
导出内容在内存中生成，服务器不会保存导出文件；恢复和覆盖导入也不会额外保留恢复前备份。
需要保留现有内容时，请在恢复或覆盖导入前先下载完整备份。
浏览器收藏与复习标记保存在各设备本地，不包含在服务器完整备份中。
管理账号配置保存在 `backend/.env`，重新部署时需要单独保留该文件。

## 日常管理

按需要单独执行以下命令：

```bash
systemctl status StudyApp --no-pager
systemctl restart StudyApp
systemctl stop StudyApp
journalctl -u StudyApp -n 100 --no-pager
nginx -t
```

需要检查代码时，在 `/opt/StudyApp` 执行 `npm test`。测试使用临时数据和模拟浏览器存储，
不会修改正式学习资料。
