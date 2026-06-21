# AccountBuddy

一个基于 React + Express + SQLite 的双人室友记账应用，支持账单录入、编辑、删除、月度统计、CSV 导出和一键结算。

## 功能

- SQLite 持久化存储，首次启动自动建库并写入默认室友
- 前后端完整联动：室友设置、支出增删改、结算、导出
- 月度筛选、分类统计、实时结余计算
- 自动化测试覆盖核心后端接口和主要前端交互

## 本地启动

### 环境要求

- Node.js 24+

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

默认地址：

- 前端: `http://127.0.0.1:3000`
- 后端: `http://127.0.0.1:3001`

### 生产构建

```bash
npm run build
npm run start
```

## 测试

```bash
npm run lint
npm test
```

## 数据库

- 默认数据库文件: `data/accountbuddy.sqlite`
- 可通过环境变量 `DB_PATH` 覆盖数据库路径

## Supabase 云数据库

后端会优先使用 Supabase；未设置 Supabase 环境变量时继续使用本地 SQLite。

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 设置环境变量：

```bash
SUPABASE_PROJECT_ID=kayflowsmvhbbptcluos
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

服务端部署更推荐设置 `SUPABASE_SERVICE_ROLE_KEY`，并只放在后端环境变量里，不要暴露到前端。

3. 导入现有 SQLite 数据：

```bash
npm run migrate:supabase
```

4. 启动后端：

```bash
npm run start
```

## Netlify 前端部署

仓库包含 `netlify.toml`，Netlify 会执行 `npm run build` 并发布 `dist`。

如果后端不和前端同域部署，需要在 Netlify 设置：

```bash
VITE_API_BASE_URL=https://your-api.example.com
```

后端环境变量 `ALLOWED_ORIGINS` 也要包含 Netlify 域名，例如：

```bash
ALLOWED_ORIGINS=https://your-site.netlify.app
```
