"""
etherscan_v2.py
---------------
Version migrée vers l'API Etherscan V2 (2025).
Permet de récupérer les transactions d'une adresse Ethereum (Mainnet ou Sepolia).
"""

import os
import time
import json
import requests
from typing import List, Dict
from pathlib import Path

# Load .env configuration
try:
    from dotenv import load_dotenv
    repo_root = Path(__file__).resolve().parents[2]
    dotenv_path = repo_root / "configuration" / ".env"
    if dotenv_path.exists():
        load_dotenv(dotenv_path)
except Exception:
    pass

# API Configuration
ETHERSCAN_V2_BASE = "https://api.etherscan.io/api"  # Remove /v2 since it's not supported
ETHERSCAN_ENDPOINTS = {
    "transactions": "/account/txlist",  # Updated endpoint path
    "internal": "/account/txlistinternal",
    "erc20": "/account/tokentx"
}
ETHERSCAN_API_KEY = "3HTXPGFXRNVMSGYNBDW617YPRAXFPYZHZ5"
ALCHEMY_KEY = "Ef1v-4uGjH1wd-LkT9Mti"  # your_alchemy_api_key
ALCHEMY_URLS = {
    "mainnet": "https://eth-mainnet.g.alchemy.com/v2/",
    "sepolia": "https://eth-sepolia.g.alchemy.com/v2/"
}

CHAIN_IDS = {"mainnet": 1, "sepolia": 11155111}
PAGE_SIZE = 100
THROTTLE_SEC = 0.25
MAX_RETRIES = 5

def fetch_etherscan_v2(address: str, chain: str = "mainnet") -> List[Dict]:
    """
    Fetch using correct Etherscan V2 endpoint structure
    """
    chain_id = CHAIN_IDS.get(chain.lower())
    
    # Correct V2 endpoint structure
    url = f"{ETHERSCAN_V2_BASE}/transactions"  # Changed from account/txlist
    params = {
        "address": address,
        "chain": chain_id,
        "apikey": ETHERSCAN_API_KEY
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            if data.get("status") == "1":
                return data.get("result", [])
            print(f"[WARN] Etherscan V2 error: status={data.get('status')}, message={data.get('message')}")
            return []
        except Exception as e:
            print(f"[WARN] Attempt {attempt}/{MAX_RETRIES} failed (Etherscan V2): {str(e)}")
            if attempt == MAX_RETRIES:
                return []
            time.sleep(attempt * 1.5)
    return []

def fetch_alchemy(address: str, chain: str = "mainnet") -> List[Dict]:
    """
    Fallback to Alchemy if Etherscan fails
    """
    if not ALCHEMY_KEY:
        raise ValueError("ALCHEMY_API_KEY not set for fallback")

    url = ALCHEMY_URLS.get(chain.lower(), ALCHEMY_URLS["mainnet"]) + ALCHEMY_KEY
    
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "alchemy_getAssetTransfers",
        "params": [{
            "fromBlock": "0x0",
            "toBlock": "latest",
            "toAddress": address,
            "category": ["external", "internal", "erc20"]
        }]
    }

    print(f"[INFO] Using Alchemy fallback for {chain}...")
    response = requests.post(url, json=payload)
    data = response.json()
    
    if "result" in data and "transfers" in data["result"]:
        return data["result"]["transfers"]
    return []

def fetch_transactions(address: str, chain: str = "mainnet") -> List[Dict]:
    """
    Try Etherscan V2 first, fallback to Alchemy if needed
    """
    # Try Etherscan V2
    txs = fetch_etherscan_v2(address, chain)
    if txs:
        return txs
        
    # Fallback to Alchemy
    print("[INFO] Etherscan V2 failed, trying Alchemy...")
    return fetch_alchemy(address, chain)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--address", "-a", required=True)
    parser.add_argument("--chain", choices=list(CHAIN_IDS.keys()), default="mainnet")
    parser.add_argument("--out", "-o", help="Output JSON file")
    args = parser.parse_args()

    try:
        txs = fetch_transactions(args.address, args.chain)
        print(f"[SUCCESS] Retrieved {len(txs)} transactions")

        if args.out and txs:
            os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
            with open(args.out, "w") as f:
                json.dump(txs, f, indent=2)
            print(f"[INFO] Saved to {args.out}")

    except Exception as e:
        print(f"[ERROR] {str(e)}")
        exit(1)