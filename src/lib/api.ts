import type { AppBootstrap, Expense, ExpenseDraft, User } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  let message = '请求失败';
  try {
    const payload = (await response.json()) as { message?: string };
    if (payload?.message) {
      message = payload.message;
    }
  } catch {
    // Ignore response parsing failures and surface the generic error above.
  }

  throw new ApiError(message, response.status);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  return parseResponse<T>(response);
}

export function getBootstrap() {
  return request<AppBootstrap>('/api/bootstrap');
}

export function createExpense(expense: ExpenseDraft) {
  return request<Expense>('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(expense),
  });
}

export function updateExpense(expense: Expense) {
  return request<Expense>(`/api/expenses/${expense.id}`, {
    method: 'PUT',
    body: JSON.stringify(expense),
  });
}

export function deleteExpense(id: string) {
  return request<void>(`/api/expenses/${id}`, {
    method: 'DELETE',
  });
}

export function updateUser(id: string, name: string) {
  return request<User>(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export function settleUp(ids?: string[]) {
  return request<{ clearedCount: number; settledAt: string | null }>('/api/settlements', {
    method: 'POST',
    body: JSON.stringify(ids && ids.length > 0 ? { ids } : {}),
  });
}

export function login(username: string, password: string) {
  return request<{ token: string; user: { id: string; username: string } }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}
