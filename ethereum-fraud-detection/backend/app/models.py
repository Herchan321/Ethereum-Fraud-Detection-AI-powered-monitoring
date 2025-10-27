from sqlalchemy import Column, Integer, Float, String, DateTime, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

Base = declarative_base()

class Transaction(Base):
    __tablename__ = 'transactions'
    
    id = Column(Integer, primary_key=True)
    hash = Column(String, unique=True)
    from_address = Column(String)
    to_address = Column(String)
    value_eth = Column(Float)
    gas_price = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<Transaction {self.hash}>"

# Configuration
engine = create_engine('sqlite:///transactions.db')
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)