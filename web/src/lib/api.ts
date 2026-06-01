import { useState } from 'react';

// For simplicity in Phase 1, using standard fetch API
export const api = {
  get: async (url: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  post: async (url: string, body?: any) => {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  put: async (url: string, body: any) => {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  delete: async (url: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
