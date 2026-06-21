# AccountBuddy

一个基于 React + Supabase 的双人室友记账应用，支持账单录入、编辑、删除、月度统计和一键结算。

## 功能

- 前端直接连接 Supabase，无需单独部署 Express 后端
- Supabase Auth 登录保护账本
- Supabase Postgres 持久化存储账单数据
- 室友设置、支出增删改、结算、历史账单
- 月度筛选、分类统计、实时结余计算

## 本地启动

### 环境要求

- Node.js 24+

### 安装依赖

```bash
npm install
```

### 环境变量

复制 `.env.example` 为 `.env`，至少设置：

```bash
VITE_SUPABASE_URL=https://kayflowsmvhbbptcluos.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_SUPABASE_LOGIN_DOMAIN=account-buddy.local
```

### 开发模式

```bash
npm run dev
```

默认地址：

- 前端: `http://127.0.0.1:3000`

## Supabase 设置

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 用 service role key 创建登录用户：

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key npm run create:supabase-auth-user
```

默认会创建或更新：

```text
email: house@account-buddy.local
password: 260321
```

前端登录时仍然输入：

```text
用户名: house
密码: 260321
```

3. 如需从旧 SQLite 导入数据：

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key npm run migrate:supabase
```

## Netlify 部署

仓库包含 `netlify.toml`，Netlify 会执行 `npm run build` 并发布 `dist`。

Netlify 环境变量填写：

```bash
VITE_SUPABASE_URL=https://kayflowsmvhbbptcluos.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_SUPABASE_LOGIN_DOMAIN=account-buddy.local
```

不要在 Netlify 里填写 `SUPABASE_SERVICE_ROLE_KEY`。

## 测试

```bash
npm run lint
npm test
npm run build
```
