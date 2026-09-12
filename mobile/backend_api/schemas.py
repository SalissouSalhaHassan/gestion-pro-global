# في backend_api/schemas.py
from pydantic import BaseModel
from typing import List, Optional

class ClientBase(BaseModel):
    id: int
    nom: str
    tel: Optional[str] = None  # لاحظ: استخدمنا tel ليطابق الموديل
    adresse: Optional[str] = None
    ref_client: Optional[str] = None

    class Config:
        from_attributes = True
# --- الموديلات السابقة (لا تحذفها) ---
class UserLogin(BaseModel):
    username: str
    password: str

# --- الموديلات الجديدة للفواتير (أضف هذا) ---

# هذا يمثل منتجاً واحداً داخل الفاتورة
class InvoiceItemSchema(BaseModel):
    article_id: int
    quantity: int
    price: float # سعر البيع

# هذا يمثل الفاتورة الكاملة التي سيرسلها الهاتف
class InvoiceCreateSchema(BaseModel):
    client_id: int
    items: List[InvoiceItemSchema] # قائمة المنتجات
    total_amount: float # المبلغ الإجمالي