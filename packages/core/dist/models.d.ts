export interface Article {
    id: number;
    reference: string;
    designation: string;
    code_barre?: string;
    p_achat_ht: number;
    p_vente_ttc: number;
    unite: string;
    categorie_id?: number | null;
    is_deleted: boolean;
    created_at?: string;
}
export interface Depot {
    id: number;
    nom: string;
    adresse?: string;
    is_active: boolean;
}
export interface ApiResponse<T> {
    data?: T;
    error?: string;
}
