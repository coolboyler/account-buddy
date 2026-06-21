// @vitest-environment node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { createLedgerStore } from './db.ts';

interface TestContext {
  baseUrl: string;
  cleanup(): Promise<void>;
}

async function createTestContext(): Promise<TestContext> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'accountbuddy-'));
  const store = createLedgerStore(path.join(tempDir, 'test.sqlite'));
  const app = createApp(store);
  const server = await new Promise<Server>((resolve) => {
    const nextServer = app.listen(0, '127.0.0.1', () => resolve(nextServer));
  });

  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async cleanup() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      store.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

async function login(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'house', password: '260321' }),
  });
  expect(response.status).toBe(200);
  const payload = await readJson<{ token: string }>(response);
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${payload.token}`,
  };
}

describe('ledger API', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const cleanup = cleanups.pop();
      if (cleanup) {
        await cleanup();
      }
    }
  });

  it('supports the full ledger lifecycle against SQLite', async () => {
    const context = await createTestContext();
    cleanups.push(context.cleanup);

    const unauthorizedBootstrapResponse = await fetch(`${context.baseUrl}/api/bootstrap`);
    expect(unauthorizedBootstrapResponse.status).toBe(401);

    const headers = await login(context.baseUrl);

    const bootstrapResponse = await fetch(`${context.baseUrl}/api/bootstrap`, { headers });
    expect(bootstrapResponse.status).toBe(200);
    const bootstrap = await readJson<{ users: Array<{ id: string; name: string }>; expenses: unknown[] }>(bootstrapResponse);
    expect(bootstrap.users).toEqual([
      { id: '1', name: '室友 A' },
      { id: '2', name: '室友 B' },
    ]);
    expect(bootstrap.expenses).toEqual([]);

    const renameResponse = await fetch(`${context.baseUrl}/api/users/1`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: '阿明' }),
    });
    expect(renameResponse.status).toBe(200);
    expect(await readJson<{ id: string; name: string }>(renameResponse)).toEqual({ id: '1', name: '阿明' });

    const createResponse = await fetch(`${context.baseUrl}/api/expenses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        description: '买菜',
        amount: 88.5,
        paidBy: '1',
        date: '2026-03-21',
        category: '餐饮',
      }),
    });
    expect(createResponse.status).toBe(201);
    const createdExpense = await readJson<{ id: string; description: string; amount: number; settledAt: string | null }>(createResponse);
    expect(createdExpense.description).toBe('买菜');
    expect(createdExpense.amount).toBe(88.5);
    expect(createdExpense.settledAt).toBeNull();

    const updateResponse = await fetch(`${context.baseUrl}/api/expenses/${createdExpense.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        description: '买菜和水果',
        amount: 96,
        paidBy: '2',
        date: '2026-03-22',
        category: '购物',
      }),
    });
    expect(updateResponse.status).toBe(200);
    expect(await readJson<{ description: string; paidBy: string }>(updateResponse)).toMatchObject({
      description: '买菜和水果',
      paidBy: '2',
    });

    const listResponse = await fetch(`${context.baseUrl}/api/expenses`, { headers });
    expect(listResponse.status).toBe(200);
    expect(await readJson<Array<{ description: string; category: string }>>(listResponse)).toEqual([
      expect.objectContaining({
        description: '买菜和水果',
        category: '购物',
      }),
    ]);

    const deleteResponse = await fetch(`${context.baseUrl}/api/expenses/${createdExpense.id}`, {
      method: 'DELETE',
      headers,
    });
    expect(deleteResponse.status).toBe(204);

    const recreateResponse = await fetch(`${context.baseUrl}/api/expenses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        description: '房租',
        amount: 3200,
        paidBy: '1',
        date: '2026-03-25',
        category: '居住',
      }),
    });
    expect(recreateResponse.status).toBe(201);
    const recreatedExpense = await readJson<{ id: string }>(recreateResponse);

    const secondExpenseResponse = await fetch(`${context.baseUrl}/api/expenses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        description: '电费',
        amount: 300,
        paidBy: '2',
        date: '2026-03-26',
        category: '居住',
      }),
    });
    expect(secondExpenseResponse.status).toBe(201);

    const settleResponse = await fetch(`${context.baseUrl}/api/settlements`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ids: [recreatedExpense.id] }),
    });
    expect(settleResponse.status).toBe(200);
    const settlement = await readJson<{ clearedCount: number; settledAt: string | null }>(settleResponse);
    expect(settlement.clearedCount).toBe(1);
    expect(settlement.settledAt).not.toBeNull();

    const finalBootstrapResponse = await fetch(`${context.baseUrl}/api/bootstrap`, { headers });
    const finalBootstrap = await readJson<{
      users: Array<{ id: string; name: string }>;
      expenses: Array<{ description: string; settledAt: string | null }>;
    }>(finalBootstrapResponse);
    expect(finalBootstrap.users[0]).toEqual({ id: '1', name: '阿明' });
    expect(finalBootstrap.expenses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: '房租',
          settledAt: settlement.settledAt,
        }),
        expect.objectContaining({
          description: '电费',
          settledAt: null,
        }),
      ]),
    );
  });
});
