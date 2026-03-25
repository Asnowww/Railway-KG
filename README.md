# KG Frontend

知识图谱前端项目，基于 `Next.js 15` 构建。当前实际可运行应用位于 `starter-kit/`，核心页面为知识图谱工作台：

- 首页：`/`
- KG 工作台：`/workbench`

## 项目结构

```text
shadboard/
├─ starter-kit/     # 当前实际部署与开发使用的前端应用
├─ full-kit/        # 备用/扩展模板
└─ README.md
```

## 环境要求

- Node.js `>= 22`
- pnpm `>= 10`

推荐版本：

- Node.js `22.x`
- pnpm `10.8.1`

## 本地开发

### 1. 安装依赖

```bash
cd starter-kit
corepack enable
corepack prepare pnpm@10.8.1 --activate
pnpm install
```

### 2. 配置环境变量

在 `starter-kit/.env` 中配置：

```env
BASE_URL=http://localhost:3000
HOME_PATHNAME=/dashboards/analytics
```

### 3. 启动开发环境

```bash
pnpm dev
```

默认访问：

- `http://localhost:3000/`
- `http://localhost:3000/workbench`

### 4. 生产构建

```bash
pnpm build
pnpm start
```

## 服务器部署

以下流程适用于 Ubuntu 22.04 + nginx 反向代理。

### 1. 安装 Node.js 与 pnpm

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg build-essential
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
corepack enable
corepack prepare pnpm@10.8.1 --activate
```

### 2. 上传代码到服务器

建议将项目部署到：

```text
/opt/kg-frontend
```

上传后进入目录：

```bash
cd /opt/kg-frontend
pnpm install --frozen-lockfile
pnpm build
```

### 3. 配置环境变量

服务器上的 `.env` 示例：

```env
BASE_URL=http://154.40.47.170
HOME_PATHNAME=/dashboards/analytics
```

### 4. 配置 systemd

创建 `/etc/systemd/system/kg-frontend.service`：

```ini
[Unit]
Description=KG Frontend Next.js App
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/kg-frontend
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npx next start -p 3000
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
systemctl daemon-reload
systemctl enable --now kg-frontend
systemctl restart kg-frontend
systemctl status kg-frontend
```

### 5. 配置 nginx 反向代理

创建 nginx 站点配置，例如：

```nginx
server {
    listen 80 default_server;
    server_name 154.40.47.170 _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

测试并重载 nginx：

```bash
nginx -t
systemctl reload nginx
```

## 如何查看 KG 图

### 打开工作台

在浏览器访问：

```text
/workbench
```

例如：

- 本地：`http://localhost:3000/workbench`
- 服务器：`http://154.40.47.170/workbench`

### 基本查看方式

- 单击节点：选中当前实体，右侧面板会显示详情
- 单击连线：查看关系详情
- 双击节点：展开该节点的相邻实体
- 双击空白区域：重置当前展开状态
- 拖拽节点：调整图中节点位置
- 鼠标滚轮或画布控件：缩放图谱

## KG 图操作小提示

- 顶部的“病害”和“跳数”输入框支持手动输入，也支持右侧上下调整按钮。
- 这两个输入框现在允许清空；空值会按 `0` 处理。
- “总数量”可通过滑杆或右侧数字框调整。
- 顶部的实体类型标签可点击开关显示。
- 点击某个标签后，对应实体类型会在图中显示或隐藏。
- 如果想只看某几类实体，可以把其他标签关闭。
- 上方搜索框可快速定位实体，按回车可直接跳转到匹配结果。
- 右侧详情区会根据当前选中的节点或边自动切换内容。

## 常用运维命令

```bash
systemctl restart kg-frontend
systemctl status kg-frontend
journalctl -u kg-frontend -n 100 --no-pager
nginx -t
systemctl reload nginx
```

## 构建检查

在提交或部署前，建议至少执行：

```bash
cd starter-kit
corepack pnpm build
```

如果构建通过，通常说明生产包可以正常生成。
