
from datetime import datetime, timedelta
from typing import Dict
import logging
import numpy as np
from sqlalchemy import func
from app.models import Session, Transaction

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Liste exacte des features utilisées par le modèle XGBoost
REQUIRED_FEATURES = [
    'Month', 'Day', 'Hour', 'time_diff_first_last_received',
    'total_tx_sent', 'total_tx_sent_unique', 'mean_value_received',
    'total_received', 'value_volatility', 'tx_volatility',
    'send_receive_imbalance', 'unique_behavior_ratio', 'is_weekend',
    'is_night', 'is_business_hours', 'value_category', 'value_anomaly',
    'frequency_anomaly'
]

logger = logging.getLogger(__name__)

def get_recent_transactions(wallet_address: str, hours: int = 24) -> list:
    """
    Récupère toutes les transactions récentes pour une adresse donnée
    """
    session = Session()
    try:
        start_time = datetime.utcnow() - timedelta(hours=hours)
        transactions = session.query(Transaction).filter(
            ((Transaction.from_address == wallet_address) | 
             (Transaction.to_address == wallet_address)) &
            (Transaction.timestamp >= start_time)
        ).all()
        return transactions
    finally:
        session.close()

def compute_wallet_features(wallet_address: str, lookback_hours: int = 24) -> Dict:
    """
    Calcule les mêmes features que dans le modèle ML pour une adresse
    """
    try:
        # 1. Récupérer l'historique récent des transactions
        transactions = get_recent_transactions(wallet_address, lookback_hours)
        
        # 2. Séparer les transactions envoyées et reçues
        sent_txs = [tx for tx in transactions if tx.from_address == wallet_address]
        received_txs = [tx for tx in transactions if tx.to_address == wallet_address]
        
        # 3. Features de base des transactions
        total_tx_sent = len(sent_txs)
        total_received = sum(tx.value_eth for tx in received_txs)
        total_sent = sum(tx.value_eth for tx in sent_txs)
        
        # 4. Contreparties uniques (comme dans le ML)
        unique_counterparties = len(set(
            [tx.to_address for tx in sent_txs] +
            [tx.from_address for tx in received_txs]
        ))
        
        # 5. Features temporelles
        now = datetime.utcnow()
        if received_txs:
            timestamps = [tx.timestamp for tx in received_txs]  # Only consider received transactions
            time_diff = (max(timestamps) - min(timestamps)).total_seconds() / 3600 if len(timestamps) > 1 else 0
        else:
            time_diff = 0
            
        # 6. Calcul des moyennes et volatilités (spécifique aux transactions reçues)
        if received_txs:
            received_values = [tx.value_eth for tx in received_txs]
            mean_value_received = np.mean(received_values)
            value_std = np.std(received_values) if len(received_values) > 1 else 0
            value_volatility = value_std / (mean_value_received + 1e-8)
        else:
            mean_value_received = 0
            value_volatility = 0
        
        # 7. Features de comportement (identiques au ML)
        tx_volatility = total_tx_sent / (time_diff + 1)
        total_volume = total_sent + total_received
        send_receive_imbalance = (total_sent - total_received) / (total_volume + 1)
        unique_behavior_ratio = unique_counterparties / (total_tx_sent + 1)
        
        # 8. Catégorisation des valeurs (basée sur les transactions reçues)
        if mean_value_received == 0:
            value_category = 0
        elif mean_value_received <= 0.01:
            value_category = 1
        elif mean_value_received <= 0.1:
            value_category = 2
        elif mean_value_received <= 1:
            value_category = 3
        elif mean_value_received <= 10:
            value_category = 4
        else:
            value_category = 5
            
        # 9. Features temporelles contextuelles
        is_weekend = 1 if now.weekday() >= 5 else 0
        is_night = 1 if (now.hour >= 22 or now.hour <= 6) else 0
        is_business_hours = 1 if (9 <= now.hour <= 17) else 0
        
        # 10. Features d'anomalie
        value_anomaly = 1 if mean_value_received > 10 else 0  # Basé sur les transactions reçues
        frequency_anomaly = 1 if total_tx_sent > 100 else 0
        
        # Retourner exactement les mêmes features que le modèle ML
        features = {
            'Month': now.month,
            'Day': now.day,
            'Hour': now.hour,
            'time_diff_first_last_received': time_diff,
            'total_tx_sent': total_tx_sent,
            'total_tx_sent_unique': unique_counterparties,
            'mean_value_received': mean_value_received,
            'total_received': total_received,
            'value_volatility': value_volatility,
            'tx_volatility': tx_volatility,
            'send_receive_imbalance': send_receive_imbalance,
            'unique_behavior_ratio': unique_behavior_ratio,
            'is_weekend': is_weekend,
            'is_night': is_night,
            'is_business_hours': is_business_hours,
            'value_category': value_category,
            'value_anomaly': value_anomaly,
            'frequency_anomaly': frequency_anomaly
        }
        
        # Vérifier que toutes les features requises sont présentes
        assert all(feature in features for feature in REQUIRED_FEATURES), "Missing required features"
        return features

    except Exception as e:
        logger.error(f"Error computing features for {wallet_address}: {str(e)}")
        # En cas d'erreur, retourner des valeurs par défaut sécurisées
        return {
            'Month': datetime.utcnow().month,
            'Day': datetime.utcnow().day,
            'Hour': datetime.utcnow().hour,
            'time_diff_first_last_received': 0,
            'total_tx_sent': 0,
            'total_tx_sent_unique': 0,
            'mean_value_received': 0,
            'total_received': 0,
            'value_volatility': 0,
            'tx_volatility': 0,
            'send_receive_imbalance': 0,
            'unique_behavior_ratio': 0,
            'is_weekend': 1 if datetime.utcnow().weekday() >= 5 else 0,
            'is_night': 1 if (datetime.utcnow().hour >= 22 or datetime.utcnow().hour <= 6) else 0,
            'is_business_hours': 1 if (9 <= datetime.utcnow().hour <= 17) else 0,
            'value_category': 0,
            'value_anomaly': 0,
            'frequency_anomaly': 0
        }