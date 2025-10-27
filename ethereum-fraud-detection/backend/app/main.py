from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
from .ml_inference import predict_wallet
from .database import init_db, save_prediction

app = FastAPI()

class PredictRequest(BaseModel):
    wallet: str

@app.on_event("startup")
async def startup_event():
    init_db()

@app.post('/predict')
async def predict(req: PredictRequest):
    try:
        result = predict_wallet(req.wallet)
        save_prediction(result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
