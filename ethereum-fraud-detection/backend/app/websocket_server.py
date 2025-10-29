import os
import sys
import json
import pandas as pd
import datetime
import logging
import joblib
import asyncio
import websockets
from web3 import Web3
import socket
import warnings
import urllib.parse

# Add the app directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.dirname(current_dir)
if app_dir not in sys.path:
    sys.path.append(app_dir)

# Import after path setup
from app.models import Session, Transaction
from app.feature_extraction import compute_wallet_features
from sqlalchemy.exc import IntegrityError

# WebSocket configuration
# Use 'localhost' instead of '127.0.0.1' to accept both IPv4 and IPv6
WEBSOCKET_HOST = 'localhost'  # ← CHANGÉ: accepte IPv4 et IPv6
WEBSOCKET_PORT = 8765
MAX_CONNECTIONS = 100

# Store connected clients
connected_clients = {}

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Suppress warnings
warnings.filterwarnings('ignore', category=UserWarning)
warnings.filterwarnings('ignore', module='sklearn')
warnings.filterwarnings('ignore', module='xgboost')


def is_port_in_use(port: int) -> bool:
    """Check if a port is already in use"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((WEBSOCKET_HOST, port))
        sock.close()
        return False
    except socket.error as e:
        logger.error(f"Port {port} check error: {str(e)}")
        try:
            sock.close()
        except:
            pass
        return True

# Initialize Web3
ALCHEMY_WS = os.getenv('ALCHEMY_WS', "wss://eth-mainnet.g.alchemy.com/v2/Ef1v-4uGjH1wd-LkT9Mti")
w3 = Web3(Web3.LegacyWebSocketProvider(ALCHEMY_WS))

# Load the trained model
model = None
preprocessor = None
model_package = None

try:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    MODEL_PATH = os.path.normpath(os.path.join(script_dir, '..', 'model', 'fraud_detection_model.pkl'))
    logger.info(f"🔍 Model path: {MODEL_PATH}")

    if not os.path.isfile(MODEL_PATH):
        parent_dir = os.path.dirname(os.path.dirname(script_dir))
        alternative_path = os.path.join(parent_dir, 'model', 'fraud_detection_model.pkl')
        logger.info(f"🔍 Trying alternative: {alternative_path}")
        
        if os.path.isfile(alternative_path):
            MODEL_PATH = alternative_path
            logger.info(f"✅ Model found at: {MODEL_PATH}")
        else:
            raise FileNotFoundError(f"Model not found in {MODEL_PATH} or {alternative_path}")

    logger.info(f"📂 Loading model from: {MODEL_PATH}")
    with open(MODEL_PATH, 'rb') as f:
        model_package = joblib.load(f)
    
    model = model_package.get('model')
    preprocessor = model_package.get('preprocessor')
    
    if model and preprocessor:
        logger.info("✅ Model and preprocessor loaded successfully")
        logger.info(f"📊 Model type: {type(model).__name__}")
    else:
        logger.error("❌ Model package missing required components")
        model = None
        preprocessor = None
        
except Exception as e:
    logger.error(f"❌ Error loading model: {str(e)}")
    logger.warning("⚠️ Server will use rule-based classification")


def save_to_database(tx_data):
    """Save transaction to database"""
    session = None
    try:
        session = Session()
        
        # Check if transaction already exists
        existing = session.query(Transaction).filter_by(hash=tx_data['hash']).first()
        if existing:
            logger.debug(f"Transaction {tx_data['hash'][:16]}... already in DB")
            return True
        
        # Create new transaction record
        tx_row = Transaction(
            hash=tx_data['hash'],
            from_address=tx_data['from'],
            to_address=tx_data['to'],
            value_eth=tx_data['value_eth'],
            gas_price=tx_data['gas_price'],
            timestamp=datetime.datetime.fromisoformat(tx_data['timestamp'])
        )
        
        session.add(tx_row)
        session.commit()
        logger.info(f"💾 Saved transaction {tx_data['hash'][:16]}... to DB")
        return True
        
    except IntegrityError:
        logger.warning(f"Transaction {tx_data['hash'][:16]}... duplicate - skipping")
        if session:
            session.rollback()
        return False
        
    except Exception as e:
        logger.error(f"❌ Failed to save to DB: {str(e)}")
        if session:
            session.rollback()
        return False
        
    finally:
        if session:
            session.close()


def process_request(path, request_headers):
    """HTTP handler - disabled to avoid conflicts with WebSocket handshake"""
    # Always return None to let websockets handle all connections
    return None


def extract_features(tx):
    """Extract relevant features for fraud detection"""
    logger.debug(f"Processing transaction: {tx.get('hash', '').hex()[:16]}...")
    
    from_features = compute_wallet_features(tx.get('from', ''))
    to_features = compute_wallet_features(tx.get('to', ''))
    
    # Combine features
    return {k: max(from_features.get(k, 0), to_features.get(k, 0)) 
            for k in from_features.keys()}


def classify_transaction(features):
    """Classify transaction as legitimate or suspicious"""
    if model is None or preprocessor is None:
        # Rule-based fallback
        suspicious_indicators = [
            features.get('time_diff_first_last_received', 0) < 300,
            features.get('total_tx_sent', 0) > 50,
            features.get('value_volatility', 0) > 0.7,
            features.get('value_anomaly', 0) == 1,
            features.get('frequency_anomaly', 0) == 1
        ]
        
        is_suspicious = sum(suspicious_indicators) >= 2
        return "SUSPICIOUS" if is_suspicious else "LEGITIMATE"

    try:
        feature_df = pd.DataFrame([features])
        
        # Ensure columns match training data
        if 'features' in model_package:
            expected_features = model_package['features']
            feature_df = feature_df.reindex(columns=expected_features, fill_value=0)
        
        # Preprocess and predict
        X = preprocessor.transform(feature_df)
        prediction = model.predict(X)[0]
        probability = model.predict_proba(X)[0][1]
        
        return "SUSPICIOUS" if probability > 0.7 else "LEGITIMATE"
    
    except Exception as e:
        logger.error(f"Classification error: {str(e)}")
        suspicious_indicators = [
            features.get('time_diff_first_last_received', 0) < 300,
            features.get('total_tx_sent', 0) > 50,
        ]
        return "SUSPICIOUS" if sum(suspicious_indicators) >= 1 else "LEGITIMATE"


def handle_transaction(tx):
    """Process and classify new transactions"""
    if not tx:
        return None
        
    try:
        # Extract features
        features = extract_features(tx)
        
        # Classify transaction
        classification = classify_transaction(features)
        
        # Prepare transaction data
        tx_data = {
            'hash': tx.get('hash', '').hex(),
            'from': tx.get('from', ''),
            'to': tx.get('to', ''),
            'value_eth': float(tx.get('value', 0)) / 1e18,
            'gas_price': float(tx.get('gasPrice', 0)),
            'classification': classification,
            'timestamp': datetime.datetime.now().isoformat(),
            'features': features
        }
        
        # Log classification
        emoji = "⚠️" if classification == "SUSPICIOUS" else "✅"
        logger.info(f"{emoji} {classification}: {tx_data['hash'][:16]}... ({tx_data['value_eth']:.4f} ETH)")
        
        # Save to database
        save_to_database(tx_data)
        
        return tx_data
        
    except Exception as e:
        logger.error(f"Error handling transaction: {str(e)}")
        return None


async def handle_client(websocket):
    """Handle WebSocket client connection"""
    client_info = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
    
    try:
        # Check connection limit
        if len(connected_clients) >= MAX_CONNECTIONS:
            logger.warning(f"🚫 Connection limit reached. Rejecting {client_info}")
            await websocket.send(json.dumps({
                'type': 'error',
                'message': 'Server at maximum capacity. Please try again later.'
            }))
            await websocket.close()
            return
        
        logger.info(f"🔗 New connection from {client_info}")
        connected_clients[websocket] = {
            'connected_at': datetime.datetime.now(),
            'address': client_info
        }
        logger.info(f"👥 Total clients: {len(connected_clients)}")
        
        # Send connection success
        await websocket.send(json.dumps({
            'type': 'connection_status',
            'status': 'connected',
            'message': 'Connected to fraud detection server',
            'server_time': datetime.datetime.now().isoformat()
        }))
        
        # Keep connection alive
        async for message in websocket:
            try:
                data = json.loads(message)
                
                if data.get('type') == 'ping':
                    await websocket.send(json.dumps({
                        'type': 'pong',
                        'timestamp': datetime.datetime.now().isoformat()
                    }))
                else:
                    await websocket.send(json.dumps({
                        'type': 'message_received',
                        'status': 'ok'
                    }))
                
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON from {client_info}")
            except Exception as e:
                logger.error(f"Error processing message from {client_info}: {str(e)}")
            
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"✅ Client {client_info} disconnected normally")
    except Exception as e:
        logger.error(f"❌ Error with client {client_info}: {str(e)}")
    finally:
        if websocket in connected_clients:
            del connected_clients[websocket]
            logger.info(f"🧹 Removed client. Remaining: {len(connected_clients)}")


async def broadcast_transaction(tx_data):
    """Broadcast transaction to all connected clients"""
    if not connected_clients:
        return
    
    message = json.dumps({
        'type': 'transaction',
        'data': tx_data
    })
    
    # Send to all clients
    disconnected = []
    for client in list(connected_clients.keys()):
        try:
            await client.send(message)
        except websockets.exceptions.ConnectionClosed:
            disconnected.append(client)
        except Exception as e:
            logger.error(f"Error broadcasting: {str(e)}")
            disconnected.append(client)
    
    # Clean up disconnected clients
    for client in disconnected:
        if client in connected_clients:
            del connected_clients[client]
    
    if disconnected:
        logger.info(f"🧹 Cleaned up {len(disconnected)} disconnected clients")


async def monitor_transactions():
    """Monitor blockchain transactions"""
    logger.info("🔍 Starting transaction monitoring...")
    tx_filter = w3.eth.filter("pending")
    
    processed_count = 0
    suspicious_count = 0
    
    while True:
        try:
            for tx_hash in tx_filter.get_new_entries():
                try:
                    tx = w3.eth.get_transaction(tx_hash)
                    tx_data = handle_transaction(tx)
                    
                    if tx_data:
                        processed_count += 1
                        if tx_data['classification'] == 'SUSPICIOUS':
                            suspicious_count += 1
                        
                        # Broadcast to clients
                        await broadcast_transaction(tx_data)
                        
                        # Log stats every 100 transactions
                        if processed_count % 100 == 0:
                            fraud_rate = (suspicious_count / processed_count) * 100
                            logger.info(f"📊 Processed: {processed_count} | Suspicious: {suspicious_count} ({fraud_rate:.1f}%) | Clients: {len(connected_clients)}")
                            
                except Exception as e:
                    logger.error(f"Error processing tx {tx_hash}: {str(e)}")
                    
        except Exception as e:
            logger.error(f"Error in monitoring: {str(e)}")
        
        await asyncio.sleep(0.1)


async def main():
    """Start WebSocket server and transaction monitoring"""
    try:
        if is_port_in_use(WEBSOCKET_PORT):
            logger.error(f"❌ Port {WEBSOCKET_PORT} is already in use!")
            await asyncio.sleep(2)
            if is_port_in_use(WEBSOCKET_PORT):
                logger.error("Port still in use. Check for other instances.")
                sys.exit(1)

        logger.info("=" * 60)
        logger.info("🚀 Starting Ethereum Fraud Detection Server")
        logger.info("=" * 60)
        logger.info(f"📡 Host: {WEBSOCKET_HOST}")
        logger.info(f"🔌 Port: {WEBSOCKET_PORT}")
        logger.info(f"👥 Max connections: {MAX_CONNECTIONS}")
        logger.info(f"🤖 ML Model: {'Loaded ✅' if model else 'Rule-based ⚠️'}")

        # Start WebSocket server (without process_request to avoid conflicts)
        server = await websockets.serve(
            handle_client,
            WEBSOCKET_HOST,
            WEBSOCKET_PORT,
            ping_interval=20,
            ping_timeout=10,
            max_size=10_000_000
        )
        
        logger.info(f"✅ Server started at ws://{WEBSOCKET_HOST}:{WEBSOCKET_PORT}")
        logger.info("=" * 60)
        
        # Start transaction monitoring
        monitor_task = asyncio.create_task(monitor_transactions())
        
        try:
            await asyncio.Future()
        except KeyboardInterrupt:
            logger.info("\n🛑 Shutting down gracefully...")
        finally:
            server.close()
            await server.wait_closed()
            monitor_task.cancel()
            logger.info("✅ Server stopped")
            
    except Exception as e:
        logger.error(f"❌ Failed to start server: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server crashed: {str(e)}")
        sys.exit(1)