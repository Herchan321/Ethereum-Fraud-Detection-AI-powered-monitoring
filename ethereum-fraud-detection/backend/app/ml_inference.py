import joblib
import numpy as np
from typing import Dict
from .etherscan import fetch_all_txs

MODEL_PATH = 'model/fraud_model.pkl'

# simple stub: load artifact if exists otherwise random
try:
    model = joblib.load(MODEL_PATH)
except Exception:
    model = None


def compute_features_for_wallet(wallet: str) -> Dict:
    """Placeholder feature computation using synthetic values"""
    # in real impl: query blockchain txs from blockchain.py and compute
    features = {
        'tx_count_24h': 100,
        'sum_value_24h': 50.0,
        'unique_counterparties_24h': 20,
        'avg_value_24h': 0.5,
        'avg_gas_price': 50
    }
    return features


def normalize_features(d: Dict) -> np.ndarray:
    arr = np.array([d['tx_count_24h'], d['sum_value_24h'], d['unique_counterparties_24h'], d['avg_value_24h'], d['avg_gas_price']], dtype=float)
    return arr.reshape(1, -1)


def predict_wallet(wallet: str) -> Dict:
    features = compute_features_for_wallet(wallet)
    X = normalize_features(features)

    if model is None:
        # random score for POC
        score = float(np.random.rand())
        model_version = 'stub-rand'
    else:
        score = float(model.decision_function(X)[0])
        model_version = 'isoforest-v0.1'
        # normalize decision function to [0,1]
        score = 1 / (1 + np.exp(-score))

    explain = {
        'top_features': [
            {'feature': 'tx_count_24h', 'value': features['tx_count_24h'], 'zscore': 3.2},
            {'feature': 'sum_value_24h', 'value': features['sum_value_24h'], 'zscore': 2.7}
        ]
    }

    return {
        'wallet': wallet,
        'score': score,
        'is_suspicious': score > 0.8,
        'model_version': model_version,
        'features': features,
        'explain': explain
    }


def predict_from_address(address: str):
    txs = fetch_all_txs(address)
    # ensuite extraire features à l'aide de feature_engineering.extract_features_from_etherscan_txs
    features = extract_features_from_etherscan_txs(address, txs)
    return predict_from_features(features)
