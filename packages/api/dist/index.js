"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GestionProApiClient = void 0;
class GestionProApiClient {
    baseUrl;
    getToken;
    constructor(options) {
        this.baseUrl = options.baseUrl;
        this.getToken = options.getToken;
    }
    async request(endpoint, options) {
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
    async ping() {
        return this.request('/api/ping');
    }
    async getArticles() {
        return this.request('/api/articles');
    }
}
exports.GestionProApiClient = GestionProApiClient;
