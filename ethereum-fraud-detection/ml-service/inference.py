import joblib
import json
import sys

MODEL_PATH = 'model/fraud_model.pkl'

try:
    model = joblib.load(MODEL_PATH)
except Exception:
    model = None

def compute_features_for_wallet(wallet: str) -> Dict:
    try:
        from .etherscan import features_for_wallet
        # Assurez-vous d'ajouter la variable d'environnement ETHERSCAN_API_KEY ou de la lire ici
        import os
        api_key = os.getenv("ETHERSCAN_API_KEY", "")
        if api_key:
            return features_for_wallet(wallet, api_key)
    except Exception:
        pass

    # ...existing code...
    features = {
        'tx_count_24h': 100,
        'sum_value_24h': 50.0,
        'unique_counterparties_24h': 20,
        'avg_value_24h': 0.5,
        'avg_gas_price': 50
    }
    return features

if __name__ == '__main__':
    wallet = sys.argv[1] if len(sys.argv) > 1 else '0x000'
    # simple stub
    print(json.dumps({'wallet': wallet, 'score': 0.5}))
