from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from database import Base

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    
    # إذا كان العمود في قاعدة البيانات يسمى 'reference'، نربطه هكذا:
    ref_client = Column(String, name="reference", nullable=True) 
    
    nom = Column(String, index=True, nullable=False)
    
    # ⚠️ تصحيح هام: غالباً اسم العمود في الداتا بيز هو 'telephone'
    tel = Column(String, name="telephone") 
    
    # أضفت العنوان لأنه مهم في العرض
    adresse = Column(String, nullable=True)
    
    # الحذف الناعم (Soft Delete)
    is_deleted = Column(Boolean, default=False, name="is_deleted") 

    # --- العلاقات ---
    # ملاحظة: قم بإزالة علامة # أدناه فقط عندما تنشئ كلاس Facture
    # invoices = relationship("Facture", back_populates="client")