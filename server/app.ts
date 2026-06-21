import crypto from 'node:crypto';
import express from 'express';
import type { AppBootstrap, ExpenseDraft } from '../src/types.ts';
import { CATEGORIES } from '../src/types.ts';
import type { LedgerStore } from './db.ts';

// 安全检查配置
const SECURITY_CONFIG = {
  // 描述字段最大长度
  maxDescriptionLength: 100,
  // 最小金额（防止批量创建小额垃圾数据）
  minAmount: 0.1,
  // 速率限制：每分钟最大请求数
  maxRequestsPerMinute: 30,
  // 每小时最大请求数（更严格的限制）
  maxRequestsPerHour: 300,
  // 最大结算数量
  maxSettleCount: 1000,
  // 可疑模式（XSS、注入攻击等）
  suspiciousPatterns: [
    /<script/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /javascript:/i,
    /on\w+=/i,
    /on\w+\s*=/i,
    /data:text\/html/i,
    /data:application\/javascript/i,
    /\.\.\//,
    /\.\.\\/,
    /\/etc\/passwd/,
    /\/windows\/win\.ini/,
    /sleep\s*\(/i,
    /SELECT\s+.*FROM/i,
    /INSERT\s+INTO/i,
    /DELETE\s+FROM/i,
    /DROP\s+TABLE/i,
    /UNION\s+SELECT/i,
    /nslookup/i,
    /curl\s/i,
    /wget\s/i,
    /\$\{/,
    /\$\(/,
    /`.*`/,
    /gethostbyname/i,
    /bxss\.me/i,
    /assert\s*\(/i,
    /eval\s*\(/i,
    /exec\s*\(/i,
    /system\s*\(/i,
    /passthru\s*\(/i,
    /shell_exec/i,
    /proc_open/i,
    /popen/i,
    /<svg.*onload/i,
    /<img.*onerror/i,
    /<body.*onload/i,
  ],
};

// 增强的内存速率限制器
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private blockedClients: Map<string, number> = new Map();

  isAllowed(clientId: string): boolean {
    const now = Date.now();

    // 检查是否被临时封禁
    const blockedUntil = this.blockedClients.get(clientId);
    if (blockedUntil && now < blockedUntil) {
      return false;
    }
    if (blockedUntil) {
      this.blockedClients.delete(clientId);
    }

    const timestamps = this.requests.get(clientId) || [];

    // 检查每小时限制
    const hourWindowStart = now - 60 * 60 * 1000;
    const hourRequests = timestamps.filter(t => t > hourWindowStart);
    if (hourRequests.length >= SECURITY_CONFIG.maxRequestsPerHour) {
      // 临时封禁 10 分钟
      this.blockedClients.set(clientId, now + 10 * 60 * 1000);
      return false;
    }

    // 检查每分钟限制
    const minuteWindowStart = now - 60 * 1000;
    const validTimestamps = timestamps.filter(t => t > minuteWindowStart);

    if (validTimestamps.length >= SECURITY_CONFIG.maxRequestsPerMinute) {
      return false;
    }

    validTimestamps.push(now);
    this.requests.set(clientId, validTimestamps);
    return true;
  }

  getRetryAfter(clientId: string): number {
    const blockedUntil = this.blockedClients.get(clientId);
    if (blockedUntil) {
      return Math.ceil((blockedUntil - Date.now()) / 1000);
    }
    return 60;
  }
}

const rateLimiter = new RateLimiter();
const defaultAllowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];

function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS ?? defaultAllowedOrigins.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isValidDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

// 检查描述是否包含可疑内容
function containsSuspiciousContent(value: string): boolean {
  return SECURITY_CONFIG.suspiciousPatterns.some(pattern => pattern.test(value));
}

// 清理和验证描述字段
function sanitizeDescription(value: string): string {
  // 移除 HTML 标签
  let cleaned = value.replace(/<[^>]*>/g, '');
  // 移除控制字符
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
  // 移除多余的空格
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

function parseExpenseDraft(payload: unknown): ExpenseDraft {
  if (!payload || typeof payload !== 'object') {
    throw new Error('请求体格式错误');
  }

  const record = payload as Record<string, unknown>;
  let description = String(record.description ?? '').trim();
  const amount = Number(record.amount);
  const paidBy = String(record.paidBy ?? '').trim();
  const date = String(record.date ?? '').trim();
  const category = String(record.category ?? '').trim() as ExpenseDraft['category'];

  // 安全检查：描述长度
  if (description.length > SECURITY_CONFIG.maxDescriptionLength) {
    throw new Error(`支出描述不能超过 ${SECURITY_CONFIG.maxDescriptionLength} 个字符`);
  }

  // 安全检查：可疑内容检测
  if (containsSuspiciousContent(description)) {
    throw new Error('支出描述包含非法字符');
  }

  // 清理描述
  description = sanitizeDescription(description);

  if (!description) {
    throw new Error('支出描述不能为空');
  }

  // 安全检查：金额范围
  if (!Number.isFinite(amount) || amount < SECURITY_CONFIG.minAmount) {
    throw new Error(`金额必须大于等于 ${SECURITY_CONFIG.minAmount}`);
  }

  // 安全检查：金额上限（防止异常数据）
  if (amount > 1000000) {
    throw new Error('金额不能超过 1,000,000');
  }

  if (!paidBy) {
    throw new Error('付款人不能为空');
  }

  if (!isValidDateString(date)) {
    throw new Error('日期格式无效');
  }

  // 检查日期是否合理（不能是未来超过 1 年的日期）
  const expenseDate = new Date(date);
  const now = new Date();
  const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  if (expenseDate > oneYearFromNow) {
    throw new Error('日期不能是未来超过 1 年的日期');
  }

  if (!CATEGORIES.includes(category)) {
    throw new Error('支出分类无效');
  }

  return {
    description,
    amount,
    paidBy,
    date,
    category,
  };
}

export function createApp(store: LedgerStore) {
  const app = express();
  const sessions = new Set<string>();
  const allowedOrigins = getAllowedOrigins();

  // 安全中间件：添加安全响应头
  app.use((request, response, next) => {
    const origin = request.headers.origin;
    if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
    }
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('X-XSS-Protection', '1; mode=block');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.options('*', (_request, response) => {
    response.status(204).end();
  });

  // 增强的速率限制中间件
  app.use((request, response, next) => {
    // 获取客户端标识（优先使用 X-Forwarded-For，然后是 remoteAddress）
    const clientId = (request.headers['x-forwarded-for'] as string) ||
                     request.socket.remoteAddress ||
                     'unknown';

    if (!rateLimiter.isAllowed(clientId)) {
      const retryAfter = rateLimiter.getRetryAfter(clientId);
      response.status(429).json({
        message: '请求过于频繁，请稍后再试',
        retryAfter: retryAfter,
      });
      return;
    }
    next();
  });

  app.use(express.json({ limit: '10kb' })); // 限制请求体大小

  app.use('/api', (request, response, next) => {
    if (request.path === '/health' || request.path === '/login') {
      next();
      return;
    }

    const authorization = request.headers.authorization ?? '';
    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token || !sessions.has(token)) {
      response.status(401).json({ message: '登录已过期，请重新登录' });
      return;
    }

    next();
  });

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.get('/api/bootstrap', async (_request, response) => {
    try {
      const snapshot: AppBootstrap = {
        users: await store.getUsers(),
        expenses: await store.getExpenses(),
      };
      response.json(snapshot);
    } catch (error) {
      response.status(500).json({ message: error instanceof Error ? error.message : '加载数据失败' });
    }
  });

  app.get('/api/users', async (_request, response) => {
    try {
      response.json(await store.getUsers());
    } catch (error) {
      response.status(500).json({ message: error instanceof Error ? error.message : '加载用户失败' });
    }
  });

  app.put('/api/users/:id', async (request, response) => {
    try {
      const name = String((request.body as Record<string, unknown>)?.name ?? '').trim();
      if (!name) {
        response.status(400).json({ message: '用户名不能为空' });
        return;
      }

      const user = await store.updateUser(request.params.id, name);
      if (!user) {
        response.status(404).json({ message: '用户不存在' });
        return;
      }

      response.json(user);
    } catch (error) {
      response.status(400).json({ message: error instanceof Error ? error.message : '更新用户失败' });
    }
  });

  app.get('/api/expenses', async (_request, response) => {
    try {
      response.json(await store.getExpenses());
    } catch (error) {
      response.status(500).json({ message: error instanceof Error ? error.message : '加载支出失败' });
    }
  });

  app.post('/api/expenses', async (request, response) => {
    try {
      const expense = parseExpenseDraft(request.body);
      const createdExpense = await store.createExpense({
        ...expense,
        id: crypto.randomUUID(),
        settledAt: null,
      });

      response.status(201).json(createdExpense);
    } catch (error) {
      response.status(400).json({ message: error instanceof Error ? error.message : '创建支出失败' });
    }
  });

  app.put('/api/expenses/:id', async (request, response) => {
    try {
      const expense = parseExpenseDraft(request.body);
      const updatedExpense = await store.updateExpense(request.params.id, expense);
      if (!updatedExpense) {
        response.status(404).json({ message: '支出不存在' });
        return;
      }

      response.json(updatedExpense);
    } catch (error) {
      response.status(400).json({ message: error instanceof Error ? error.message : '更新支出失败' });
    }
  });

  app.delete('/api/expenses/:id', async (request, response) => {
    try {
      const deleted = await store.deleteExpense(request.params.id);
      if (!deleted) {
        response.status(404).json({ message: '支出不存在' });
        return;
      }

      response.status(204).end();
    } catch (error) {
      response.status(400).json({ message: error instanceof Error ? error.message : '删除支出失败' });
    }
  });

  app.post('/api/settlements', async (_request, response) => {
    try {
      const body = _request.body as { ids?: unknown } | undefined;
      const ids = Array.isArray(body?.ids)
        ? body.ids.filter((id): id is string => typeof id === 'string')
        : undefined;

      // 安全检查：限制结算数量
      if (ids && ids.length > SECURITY_CONFIG.maxSettleCount) {
        response.status(400).json({
          message: `一次最多只能结算 ${SECURITY_CONFIG.maxSettleCount} 笔账单`,
        });
        return;
      }

      // 安全检查：验证 ID 格式（UUID）
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (ids) {
        for (const id of ids) {
          if (!UUID_REGEX.test(id)) {
            response.status(400).json({ message: '账单 ID 格式无效' });
            return;
          }
        }
      }

      response.json(await store.settleUp(ids));
    } catch (error) {
      response.status(400).json({
        message: error instanceof Error ? error.message : '结算失败',
      });
    }
  });

  // 登录接口
  app.post('/api/login', async (request, response) => {
    try {
      const body = request.body as { username?: string; password?: string } | undefined;
      const username = String(body?.username ?? '').trim();
      const password = String(body?.password ?? '').trim();

      if (!username || !password) {
        response.status(400).json({ message: '用户名和密码不能为空' });
        return;
      }

      const user = await store.getUserByUsername(username);
      if (!user) {
        response.status(401).json({ message: '用户名或密码错误' });
        return;
      }

      const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
      if (user.passwordHash !== passwordHash) {
        response.status(401).json({ message: '用户名或密码错误' });
        return;
      }

      // 生成简单的 session token（生产环境应该使用 JWT）
      const token = crypto.randomBytes(32).toString('hex');
      sessions.add(token);
      
      response.json({
        token,
        user: { id: user.id, username: user.username },
      });
    } catch (error) {
      response.status(400).json({
        message: error instanceof Error ? error.message : '登录失败',
      });
    }
  });

  app.use('/api', (_request, response) => {
    response.status(404).json({ message: '接口不存在' });
  });

  return app;
}
