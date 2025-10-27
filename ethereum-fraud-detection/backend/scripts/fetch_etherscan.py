import os
from pathlib import Path
from dotenv import load_dotenv

# charger configuration/.env automatiquement si présent
repo_root = Path(__file__).resolve().parents[2]  # .../ethereum-fraud-detection
dotenv_path = repo_root / "configuration" / ".env"
if dotenv_path.exists():
    load_dotenv(dotenv_path)