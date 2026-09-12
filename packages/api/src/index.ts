import { Article, ApiResponse } from '@gestion-pro/core';

export class GestionProApiClient {
  private baseUrl: string;
  private getToken: () => Promise<string | null>;

  constructor(options: { baseUrl: string; getToken: () => Promise<string | null> }) {
    this.baseUrl = options.baseUrl;
    this.getToken = options.getToken;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = await this.getToken();
    const headers = new Headers(options?.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Content-Type', 'application/json');

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async ping(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/ping');
  }

  async getArticles(): Promise<{ items: Article[]; role: string; depot: string }> {
    return this.request('/api/articles');
  }
}
