import os
import shutil
import logging

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def ensure_model_exists():
    try:
        # Chemins source et destination
        script_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(os.path.dirname(script_dir))
        ml_service_dir = os.path.join(backend_dir, '..', 'ml-service')
        
        source_path = os.path.join(ml_service_dir, 'fraud_detection_model.pkl')
        dest_path = os.path.join(backend_dir, 'model', 'fraud_detection_model.pkl')
        
        # Créer le dossier destination si nécessaire
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        
        # Vérifier si le modèle existe déjà
        if os.path.exists(dest_path):
            logger.info(f"✅ Model already exists at: {dest_path}")
            return True
            
        # Vérifier si le fichier source existe
        if not os.path.exists(source_path):
            logger.error(f"Model file not found at: {source_path}")
            # Try looking in notebook directory for newly created model
            notebook_path = os.path.join(ml_service_dir, 'fraud_detection_model.pkl')
            if os.path.exists(notebook_path):
                shutil.copy2(notebook_path, dest_path)
                logger.info(f"✅ Model copied successfully from notebook directory to: {dest_path}")
                return True
            return False
            
        # Copier le fichier
        shutil.copy2(source_path, dest_path)
        logger.info(f"✅ Model copied successfully to: {dest_path}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error copying model: {str(e)}")
        return False

if __name__ == "__main__":
    ensure_model_exists()