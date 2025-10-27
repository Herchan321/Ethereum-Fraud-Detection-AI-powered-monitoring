import { useState, useEffect, useCallback, useRef } from 'react';

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value_eth: number;
  gas_price: number;
  classification: 'LEGITIMATE' | 'SUSPICIOUS' | 'UNKNOWN' | 'ERROR';
  timestamp: string;
  features: Record<string, number>;
}

interface WebSocketMessage {
  type: 'connection_status' | 'message_received' | 'transaction';
  status?: 'connected' | 'ok';
  data?: Transaction;
}

// Configuration de la connexion WebSocket
const getWebSocketURL = () => {
  const hostname = window.location.hostname;
  // Priorité : même domaine > localhost > 127.0.0.1
  const urls = [
    `ws://${hostname}:8765`,
    'ws://localhost:8765',
    'ws://127.0.0.1:8765'
  ];
  return urls[0];
};

const WEBSOCKET_URL = getWebSocketURL();
const RECONNECT_DELAY = 1000; // 1 seconde de délai initial
const MAX_BACKOFF = 30000; // Maximum 30 secondes
const BACKOFF_MULTIPLIER = 1.5;

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Refs pour éviter les re-renders
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isIntentionalClose = useRef(false);

  // Fonction pour nettoyer la connexion existante
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    if (socketRef.current) {
      // Retirer les event listeners pour éviter les fuites mémoire
      socketRef.current.onopen = null;
      socketRef.current.onclose = null;
      socketRef.current.onerror = null;
      socketRef.current.onmessage = null;
      
      if (socketRef.current.readyState === WebSocket.OPEN || 
          socketRef.current.readyState === WebSocket.CONNECTING) {
        isIntentionalClose.current = true;
        socketRef.current.close(1000, "Cleanup");
      }
      
      socketRef.current = null;
    }
  }, []);

  // Fonction de connexion
  const connect = useCallback(() => {
    // Éviter les connexions multiples
    if (socketRef.current?.readyState === WebSocket.OPEN || 
        socketRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket déjà connecté ou en cours de connexion');
      return;
    }

    // Nettoyer avant de créer une nouvelle connexion
    cleanup();

    try {
      console.log(`[${new Date().toISOString()}] Connexion à: ${WEBSOCKET_URL} (tentative ${reconnectAttempts.current + 1})`);
      
      const ws = new WebSocket(WEBSOCKET_URL);
      socketRef.current = ws;
      isIntentionalClose.current = false;

      ws.onopen = () => {
        console.log('✅ WebSocket connecté');
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      ws.onclose = (event) => {
        console.log(`❌ WebSocket fermé - Code: ${event.code}, Clean: ${event.wasClean}`);
        setIsConnected(false);
        socketRef.current = null;
        
        // Ne reconnecter que si ce n'est pas une fermeture intentionnelle
        if (!isIntentionalClose.current && event.code !== 1000) {
          reconnectAttempts.current += 1;
          
          // Calculer le délai avec backoff exponentiel
          const delay = Math.min(
            RECONNECT_DELAY * Math.pow(BACKOFF_MULTIPLIER, reconnectAttempts.current - 1),
            MAX_BACKOFF
          );
          
          const delaySeconds = Math.ceil(delay / 1000);
          console.log(`🔄 Reconnexion dans ${delaySeconds}s (tentative ${reconnectAttempts.current})`);
          setError(`Reconnexion dans ${delaySeconds}s...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (event) => {
        console.error('❌ Erreur WebSocket:', event);
        setError('Erreur de connexion');
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'connection_status':
              if (message.status === 'connected') {
                console.log('✅ Connexion confirmée par le serveur');
                setError(null);
              }
              break;
              
            case 'transaction':
              if (message.data) {
                setTransactions(prev => {
                  // Éviter les doublons
                  const exists = prev.some(tx => tx.hash === message.data!.hash);
                  if (exists) return prev;
                  
                  // Garder seulement les 100 dernières
                  return [message.data!, ...prev].slice(0, 100);
                });
              }
              break;
              
            case 'message_received':
              // Message acknowledgement
              break;
              
            default:
              console.warn('Type de message inconnu:', message.type);
          }
        } catch (err) {
          console.error('Erreur parsing message:', err);
        }
      };

    } catch (err) {
      console.error('Erreur création WebSocket:', err);
      setError('Impossible de créer la connexion');
    }
  }, [cleanup]);

  // Fonction pour envoyer un message
  const sendMessage = useCallback((message: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      return true;
    } else {
      console.warn('WebSocket non connecté');
      setError('Non connecté');
      return false;
    }
  }, []);

  // Fonction de reconnexion manuelle
  const reconnect = useCallback(() => {
    console.log('🔄 Reconnexion manuelle demandée');
    reconnectAttempts.current = 0;
    cleanup();
    connect();
  }, [cleanup, connect]);

  // Effet pour la connexion initiale
  useEffect(() => {
    console.log('🚀 Initialisation du WebSocket');
    connect();

    // Cleanup au démontage du composant
    return () => {
      console.log('🧹 Nettoyage du WebSocket');
      isIntentionalClose.current = true;
      cleanup();
    };
  }, []); // Dépendances vides = s'exécute une seule fois

  return {
    isConnected,
    transactions,
    error,
    sendMessage,
    reconnect
  };
};