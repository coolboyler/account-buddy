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
