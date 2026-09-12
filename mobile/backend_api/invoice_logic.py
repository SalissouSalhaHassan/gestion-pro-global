# backend_api/main.py
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import text # مهم لتنفيذ استعلامات SQL المباشرة
from datetime import timedelta
from typing import List

# استيراد ملفات المشروع
import app_models as models
import api_schemas as schemas
import database
import auth

# استيراد منطق الفواتير الجديد
from invoice_logic import InvoiceLogic

app = FastAPI(title="Gestion Pro API")

# تهيئة منطق الفواتير
invoice_system = InvoiceLogic()

# ============================================================
# 1. المصادقة وتسجيل الدخول (Authentication)
# ============================================================
@app.post("/login", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nom d'utilisateur ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

# ============================================================
# 2. لوحة التحكم (Dashboard)
# ============================================================
@app.get("/dashboard-summary")
def get_dashboard_summary(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    try:
        # استخدام text() لتنفيذ SQL خام بأمان
        clients_count = db.execute(text("SELECT COUNT(*) FROM clients")).scalar() or 0
        articles_count = db.execute(text("SELECT COUNT(*) FROM articles")).scalar() or 0
        # نفترض أن اسم الجدول factures
        sales_today = db.execute(
            text("SELECT COALESCE(SUM(total_ttc), 0) FROM factures WHERE date_facture = CURRENT_DATE")
        ).scalar() or 0.0
    except Exception as e:
        print(f"Dashboard Error: {e}")
        clients_count = 0
        articles_count = 0
        sales_today = 0.0

    return {
        "user_name": current_user.full_name or current_user.username,
        "clients_count": clients_count,
        "articles_count": articles_count,
        "sales_today": sales_today
    }

# ============================================================
# 3. بيانات للتطبيق (Data for Mobile App)
# ============================================================

# أ) جلب قائمة العملاء
@app.get("/clients", response_model=List[schemas.ClientResponse])
def get_all_clients(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    try:
        # نجلب البيانات ونقوم بتعيين القيم الافتراضية للقيم الفارغة (NULL)
        result = db.execute(text("SELECT id, nom, COALESCE(telephone, '') as telephone, COALESCE(adresse, '') as adresse, COALESCE(solde, 0) as solde FROM clients ORDER BY nom"))
        # تحويل النتائج إلى قائمة من القواميس
        clients = []
        for row in result:
            # طريقة الوصول للبيانات في SQLAlchemy الحديثة تعتمد على ._mapping أو المؤشرات
            clients.append({
                "id": row.id,
                "nom": row.nom,
                "telephone": row.telephone,
                "adresse": row.adresse,
                "solde": row.solde
            })
        return clients
    except Exception as e:
        print(f"Error fetching clients: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors du chargement des clients")

# ب) جلب قائمة المنتجات (مع الكمية)
@app.get("/articles", response_model=List[schemas.ArticleResponse])
def get_all_articles(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(database.get_db)):
    try:
        # استعلام يجمع بين جدول المقالات وجدول المخزون لحساب الكمية الإجمالية
        sql = """
            SELECT a.id, a.reference, a.designation, a.p_vente_ht, 
                   COALESCE(SUM(s.quantite), 0) as total_qty
            FROM articles a 
            LEFT JOIN stocks s ON a.id = s.article_id 
            GROUP BY a.id, a.reference, a.designation, a.p_vente_ht
            ORDER BY a.designation
        """
        result = db.execute(text(sql))
        
        articles = []
        for row in result:
            articles.append({
                "id": row.id,
                "reference": row.reference,
                "designation": row.designation,
                "prix_vente": row.p_vente_ht,
                "quantite": row.total_qty
            })
        return articles
    except Exception as e:
        print(f"Error fetching articles: {e}")
        raise HTTPException(status_code=500, detail="Erreur lors du chargement des articles")

# ============================================================
# 4. عمليات الفواتير (Invoicing)
# ============================================================
@app.post("/invoices")
def create_new_invoice(
    invoice: schemas.InvoiceCreateSchema,
    current_user: models.User = Depends(auth.get_current_user)
):
    # نستخدم InvoiceLogic الذي أنشأناه سابقاً
    # نمرر اسم المستخدم الحالي ليتم تسجيله كبائع
    success, message = invoice_system.create_invoice(
        client_id=invoice.client_id,
        items=invoice.items,
        total_amount=invoice.total_amount,
        user_name=current_user.username
    )
    
    if success:
        return {"status": "success", "message": "Facture créée avec succès"}
    else:
        raise HTTPException(status_code=400, detail=message)