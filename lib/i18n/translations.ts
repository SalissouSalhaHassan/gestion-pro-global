export type Locale = "fr" | "ar" | "en";

export interface TranslationDict {
  [key: string]: {
    fr: string;
    ar: string;
    en: string;
  };
}

export const translations: TranslationDict = {
  // Brand & General
  brand_name: { fr: "GestionPro", ar: "جستيون برو", en: "GestionPro" },
  brand_tagline: { fr: "Enterprise 4K", ar: "المؤسسي 4K", en: "Enterprise 4K" },
  brand_subtitle: { fr: "Système de Gestion Commerciale", ar: "نظام إدارة الأعمال المتكامل", en: "Commercial Management System" },
  search_placeholder: { fr: "Recherche rapide (Ctrl + K)...", ar: "بحث سريع (Ctrl + K)...", en: "Quick search (Ctrl + K)..." },
  logout: { fr: "Se déconnecter", ar: "تسجيل الخروج", en: "Sign out" },
  logging_out: { fr: "Déconnexion...", ar: "جاري الخروج...", en: "Signing out..." },
  active_org: { fr: "Organisation", ar: "المؤسسة", en: "Organization" },
  trial_plan: { fr: "Essai 14j", ar: "تجربة 14 يوم", en: "14d Trial" },
  global_saas: { fr: "Global SaaS", ar: "سحابي عالمي", en: "Global SaaS" },

  // Navigation Items
  nav_dashboard: { fr: "Tableau de bord", ar: "لوحة التحكم", en: "Dashboard" },
  nav_pos: { fr: "Point de vente (POS)", ar: "نقطة البيع (الكاشير)", en: "Point of Sale (POS)" },
  nav_articles: { fr: "Articles", ar: "المنتجات والأصناف", en: "Products & Items" },
  nav_stock: { fr: "Gestion du Stock", ar: "إدارة المخزون", en: "Stock Management" },
  nav_valuation: { fr: "Valorisation Stock", ar: "تقييم المخزون المالي", en: "Stock Valuation" },
  nav_transits: { fr: "Suivi Transits", ar: "تتبع الشحنات والتحويلات", en: "Transit Tracking" },
  nav_inventory: { fr: "Jeu d'Inventaire", ar: "جرد المخزون", en: "Inventory Count" },
  nav_ciment: { fr: "Gestion Ciment", ar: "إدارة الأسمنت", en: "Cement Management" },
  nav_audit: { fr: "Journal d'Audit", ar: "سجل التدقيق والحركات", en: "Audit & Movements" },
  nav_clients: { fr: "Clients", ar: "العملاء", en: "Customers" },
  nav_loyalty: { fr: "Club Fidélité VIP", ar: "نادي الولاء وبطاقات VIP", en: "VIP Loyalty Club" },
  nav_suppliers: { fr: "Fournisseurs", ar: "الموردين", en: "Suppliers" },
  nav_invoices: { fr: "Factures", ar: "فواتير المبيعات", en: "Invoices" },
  nav_devis: { fr: "Devis & Proforma", ar: "عروض الأسعار (Devis)", en: "Quotations & Proforma" },
  nav_purchases: { fr: "Achats", ar: "فواتير المشتريات", en: "Purchases" },
  nav_bons_commande: { fr: "Bons de Commande", ar: "أوامر الشراء (PO)", en: "Purchase Orders" },
  nav_expenses: { fr: "Dépenses", ar: "المصروفات اليومية", en: "Expenses" },
  nav_cash_balance: { fr: "Bilan de Caisse", ar: "ميزان الصندوق والخزينة", en: "Cash Balance" },
  nav_profit_loss: { fr: "Pertes & Profits (P&L)", ar: "الأرباح والخسائر (P&L)", en: "Profit & Loss (P&L)" },
  nav_commissions: { fr: "Commissions Vendeurs", ar: "أهداف وعمولات الموظفين", en: "Sales Commissions" },
  nav_finance: { fr: "Gestion Financière", ar: "الإدارة المالية والتقارير", en: "Financial Reports" },
  nav_forex: { fr: "Forex & Devises", ar: "العملات والضرائب (Forex)", en: "Forex & Currencies" },
  nav_cheques: { fr: "Chèques & Effets", ar: "الشيكات والأوراق التجارية", en: "Checks & Commercial Papers" },
  nav_data_hub: { fr: "Export & Sauvegarde", ar: "التصدير والنسخ الاحتياطي", en: "Export & Backup" },
  nav_fraud_radar: { fr: "Radar Anti-Fraude", ar: "رادار الأمان ومكافحة التلاعب", en: "Anti-Fraud Radar" },
  nav_advances: { fr: "Dépôts & Avances", ar: "الودائع والدفعات المقدمة", en: "Deposits & Advances" },
  nav_loyers: { fr: "Gestion des Loyers", ar: "إدارة الإيجارات والعقارات", en: "Rent & Real Estate" },
  nav_vehicles: { fr: "Gestion des Véhicules", ar: "إدارة المركبات والأسطول", en: "Fleet & Vehicles" },
  nav_deliveries: { fr: "Tournées & Livraisons", ar: "دورات التوصيل والشحن", en: "Delivery & Dispatch" },
  nav_depots: { fr: "Gestion des Dépôts", ar: "إدارة المستودعات والفروع", en: "Warehouses & Branches" },
  nav_users: { fr: "Utilisateurs", ar: "المستخدمين والموظفين", en: "Users & Staff" },
  nav_permissions: { fr: "Permissions", ar: "الصلاحيات والأدوار", en: "Roles & Permissions" },
  nav_settings: { fr: "Paramètres", ar: "الإعدادات العامة", en: "System Settings" },
  nav_platform: { fr: "Gestion de la plateforme", ar: "إدارة المنصة والاشتراكات", en: "Platform Management" },
  nav_super_admin: { fr: "Tableau de bord Super Admin", ar: "لوحة تحكم السوبر أدمن", en: "Super Admin Dashboard" },
  nav_copilot: { fr: "Assistant IA Copilot", ar: "المساعد الذكي للأعمال (AI)", en: "AI Business Copilot" },
  nav_support: { fr: "Support & Assistance", ar: "الدعم الفني والمساعدة", en: "Help & Support" },

  // Actions
  action_add: { fr: "Ajouter", ar: "إضافة جديد", en: "Add New" },
  action_edit: { fr: "Modifier", ar: "تعديل", en: "Edit" },
  action_delete: { fr: "Supprimer", ar: "حذف", en: "Delete" },
  action_save: { fr: "Enregistrer", ar: "حفظ", en: "Save" },
  action_cancel: { fr: "Annuler", ar: "إلغاء", en: "Cancel" },
  action_print: { fr: "Imprimer", ar: "طباعة", en: "Print" },
  action_filter: { fr: "Filtrer", ar: "تصفية", en: "Filter" },
  action_export: { fr: "Exporter", ar: "تصدير", en: "Export" },
  action_close: { fr: "Fermer", ar: "إغلاق", en: "Close" },
  action_confirm: { fr: "Confirmer", ar: "تأكيد", en: "Confirm" },

  // Auth & Onboarding
  login_title: { fr: "Connexion sécurisée", ar: "تسجيل الدخول الآمن", en: "Secure Login" },
  login_identifier: { fr: "Identifiant ou E-mail", ar: "اسم المستخدم أو البريد", en: "Username or Email" },
  login_password: { fr: "Mot de passe", ar: "كلمة المرور", en: "Password" },
  login_submit: { fr: "Se connecter", ar: "دخول النظام", en: "Sign in" },
  login_remember: { fr: "Se souvenir de moi", ar: "تذكرني", en: "Remember me" },
  login_forgot: { fr: "Mot de passe oublié ?", ar: "نسيت كلمة المرور؟", en: "Forgot password?" },
  login_new_account: { fr: "Créer un Espace Entreprise (Essai gratuit)", ar: "إنشاء مساحة عمل للشركة (تجربة مجانية)", en: "Create Business Workspace (Free Trial)" },
  register_title: { fr: "Créer votre Espace Entreprise", ar: "إنشاء مساحة عمل جديدة لشركتك", en: "Create Your Business Workspace" },
  register_trial_badge: { fr: "Essai gratuit de 14 jours • Aucune carte requise", ar: "تجربة مجانية لمدة 14 يوماً • بدون بطاقة ائتمان", en: "14-Day Free Trial • No Credit Card Required" },
  register_company_name: { fr: "Nom de l’Entreprise / Société", ar: "اسم الشركة / المؤسسة", en: "Company / Business Name" },
  register_country: { fr: "Pays", ar: "الدولة", en: "Country" },
  register_currency: { fr: "Devise Principale", ar: "العملة الأساسية", en: "Primary Currency" },
  register_admin_user: { fr: "Identifiant Administrateur (Login)", ar: "اسم مستخدم المدير (تسجيل الدخول)", en: "Admin Username (Login)" },
  register_submit: { fr: "Créer mon compte & Démarrer l'essai", ar: "إنشاء الحساب وبدء التجربة المجانية", en: "Create Account & Start Trial" },
  register_already_have: { fr: "Vous avez déjà un compte ?", ar: "هل لديك حساب بالفعل؟", en: "Already have an account?" },

  // Languages
  lang_fr: { fr: "Français", ar: "الفرنسية", en: "French" },
  lang_ar: { fr: "العربية", ar: "العربية", en: "Arabic" },
  lang_en: { fr: "English", ar: "الإنجليزية", en: "English" },
};
