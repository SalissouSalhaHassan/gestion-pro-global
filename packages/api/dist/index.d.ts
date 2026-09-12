import { Article } from '@gestion-pro/core';
export declare class GestionProApiClient {
    private baseUrl;
    private getToken;
    constructor(options: {
        baseUrl: string;
        getToken: () => Promise<string | null>;
    });
    private request;
    ping(): Promise<{
        message: string;
    }>;
    getArticles(): Promise<{
        items: Article[];
        role: string;
        depot: string;
    }>;
}
