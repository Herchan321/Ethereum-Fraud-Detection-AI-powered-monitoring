# Ethereum Fraud Detection — AI-powered monitoring (POC)

A polished proof-of-concept for real-time, AI-assisted Ethereum transaction monitoring and fraud detection.
This project demonstrates an end-to-end pipeline: blockchain ingestion, feature extraction, ML inference
and a live dashboard showing flagged transactions.

Key highlights
- Real-time monitoring of pending Ethereum transactions via a WebSocket provider (Alchemy).
- A trained fraud detection model (XGBoost + scikit-learn preprocessing) used to classify transactions.
- Lightweight backend that broadcasts classified transactions over WebSocket to a React dashboard.
- Local persistence using SQLite (easy to upgrade to Postgres via `DATABASE_URL`).

Project layout
- `backend/` — Python server (async WebSocket transaction monitor + ML inference).
	- `app/websocket_server.py` — main server: loads model, monitors blockchain, broadcasts transactions.
	- `app/models.py` — SQLAlchemy models (SQLite by default: `transactions.db`).
	- `model/` — stored model artifact: `fraud_detection_model.pkl`.
- `frontend/` — React + Vite dashboard (real-time UI components, WebSocket client hook).
- `ml-service/` — training & inference notebook and helpers; `model_info.json` documents model metadata.
- `configuration/` — example env files and docker-compose for local deployment.

Why this project is valuable
- Shows how to combine Web3 streaming, feature engineering and ML inference in a resilient service.
- Practical fallback behaviours: rule-based classification when the model is unavailable.
- Designed to be extended: swap model artifacts, persist to a managed DB, or plug into alerting.

Requirements & recommendations
- Development tested on Windows 10/11 with PowerShell. For reproducible environments we recommend Python 3.11 (3.13 may cause build issues for some compiled packages).
- Backend uses a virtual environment. The backend `requirements.txt` contains pinned core packages (web3, joblib, scikit-learn, xgboost, websockets).

Quickstart — Local development (recommended)

1) Backend setup (PowerShell)

```powershell
cd "C:\Users\<you>\Desktop\ai-powewred-blockchain-fraud-detection\ethereum-fraud-detection\backend"
# Create a venv with Python 3.11 (recommended)
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

2) Configure environment
- Copy `.env.example` from `configuration/` or `backend/configuration` (if present) to `.env` and set:
	- `ALCHEMY_WS` — your Alchemy WebSocket URL (or another Ethereum node provider)
	- `DATABASE_URL` — optional Postgres URL; if omitted the app will use local SQLite `transactions.db`.

3) Run the backend

```powershell
# From backend folder, with venv activated
python -m app.websocket_server
```

The server will load the model at `backend/model/fraud_detection_model.pkl`. If some packages differ
between your environment and the one used to generate the pickled model, you may see warnings — the app
will still run but consider pinning `scikit-learn==1.6.1` and `xgboost` (or re-exporting the model as explained below).

4) Frontend (run in a separate terminal)

```powershell
cd "c:\Users\<you>\Desktop\ai-powewred-blockchain-fraud-detection\ethereum-fraud-detection\frontend"
# Using npm or bun/yarn depending on your setup
npm install
npm run dev
```

Open the dashboard at the local Vite URL (usually http://localhost:5173). The UI connects to the backend WebSocket
and displays live transactions, risk badges and summary stats.

Model compatibility notes
- The stored artifact (`fraud_detection_model.pkl`) contains a scikit-learn preprocessing pipeline and an XGBoost model.
	- If you trained the model in a different environment, best practice is to re-export the XGBoost booster using:

```python
# in the training environment where the model was originally trained
booster = model.get_booster()  # if using xgboost sklearn wrapper
booster.save_model('fraud_detection_model.bst')
# Save the preprocessor separately
joblib.dump(preprocessor, 'preprocessor.pkl')
```

Then load these explicitly in the server to avoid pickle compatibility issues.

Persistence & database
- The project ships with a simple `SQLAlchemy` model that uses SQLite by default (`backend/app/models.py`).
- To use Postgres (recommended for production): set `DATABASE_URL` in your `.env` and update `app/models.py` or use `app/database.py`.
- The backend will persist classified transactions to `transactions.db` (or your configured DB). The UI reads real-time updates via WebSocket.

Extending the system
- Replace the model: drop a new `fraud_detection_model.pkl` into `backend/model/` and restart the server.
- Add a `Prediction` table to store model scores and explanations, or wire `app.database.save_prediction` to a central analytics DB.
- Add authentication and role-based access to the dashboard for secured deployments.

Troubleshooting
- If the model load raises `ModuleNotFoundError: xgboost` — ensure `xgboost` is installed in the active venv: `pip install xgboost`.
- If `scikit-learn` raises `InconsistentVersionWarning`, either pin the runtime scikit-learn version to the training version (`1.6.1`) or re-export the model using the newer library.
- If pandas or other packages fail to build on Windows/Python 3.13, switch to Python 3.11 or install prebuilt wheels.

Credits & acknowledgements
- Built using: web3.py, XGBoost, scikit-learn, SQLAlchemy, React + Vite.
- The model training notebook and metadata are in `ml-service/`.

Contribution
- Contributions, issues and pull requests are welcome. Please open an issue describing the change you propose and target the `develop` branch.

License
- This project is released under the MIT License. See `LICENSE` (if present) or add one for your needs.

Enjoy — and if you want, I can also prepare a one-click Docker deployment and a Postgres migration script to store predictions with scores.
