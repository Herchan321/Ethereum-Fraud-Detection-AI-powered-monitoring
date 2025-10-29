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
  type: 'connection_status' | 'message_received' | 'transaction' | 'pong';
  status?: 'connected' | 'ok';
  data?: Transaction;
}

// Configuration WebSocket - URLs candidates
const WEBSOCKET_CANDIDATES = [
  'ws://127.0.0.1:8765',  // Force IPv4
  'ws://localhost:8765',
];

const RECONNECT_DELAY = 2000; // 2 secondes
const MAX_BACKOFF = 30000; // Maximum 30 secondes
const BACKOFF_MULTIPLIER = 1.5;
const CONNECTION_TIMEOUT = 5000; // 5 secondes par tentative

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastTriedUrl, setLastTriedUrl] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isIntentionalClose = useRef(false);
  const isMountedRef = useRef(true);

  // Nettoyage complet
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    if (socketRef.current) {
      const ws = socketRef.current;
      socketRef.current = null;
      
      // Retirer les listeners
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        isIntentionalClose.current = true;
        try {
          ws.close(1000, "Cleanup");
        } catch (e) {
          console.error("Error closing WebSocket:", e);
        }
      }
    }
  }, []);

  // Fonction de connexion
  const connect = useCallback(() => {
    if (!isMountedRef.current) {
      console.log('Component unmounted, skipping connection');
      return;
    }

    // Éviter les connexions multiples
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      console.log('Already connected');
      return;
    }

    if (socketRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('Connection in progress');
      return;
    }

    cleanup();

    // Essayer chaque URL candidate
    let candidateIndex = 0;
    
    const tryNextCandidate = () => {
      if (candidateIndex >= WEBSOCKET_CANDIDATES.length) {
        console.error('❌ All WebSocket candidates failed');
        setError('Impossible de se connecter au serveur');
        setIsConnected(false);
        // Attempt HTTP fallback to populate recent transactions so UI isn't empty
        (async () => {
          try {
            const res = await fetch('http://127.0.0.1:8765/transactions?n=200');
            if (res.ok) {
              const json = await res.json();
              if (json && Array.isArray(json.transactions)) {
                setTransactions(json.transactions as Transaction[]);
                setError(null);
              }
            } else {
              console.warn('HTTP fallback /transactions returned', res.status);
            }
          } catch (e) {
            console.warn('HTTP fallback failed:', e);
          }
        })();
        
        // Planifier une nouvelle tentative
        if (isMountedRef.current && !isIntentionalClose.current) {
          reconnectAttempts.current += 1;
          const delay = Math.min(
            RECONNECT_DELAY * Math.pow(BACKOFF_MULTIPLIER, reconnectAttempts.current - 1),
            MAX_BACKOFF
          );
          console.log(`🔄 Retry in ${Math.ceil(delay / 1000)}s (attempt ${reconnectAttempts.current})`);
          setError(`Reconnexion dans ${Math.ceil(delay / 1000)}s...`);
          reconnectTimeoutRef.current = setTimeout(() => connect(), delay);
        }
        return;
      }

      const url = WEBSOCKET_CANDIDATES[candidateIndex];
  setLastTriedUrl(url);
      console.log(`[${new Date().toISOString()}] Connecting to: ${url} (attempt ${reconnectAttempts.current + 1})`);

      try {
        const ws = new WebSocket(url);
        let connectionTimeout: ReturnType<typeof setTimeout>;
        let settled = false;

        // Timeout de connexion
        connectionTimeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            console.warn(`⏱️ Connection timeout for ${url}`);
            try {
              ws.close();
            } catch (e) {}
            candidateIndex++;
            setLastError(`Timeout connecting to ${url}`);
            tryNextCandidate();
          }
        }, CONNECTION_TIMEOUT);

        ws.onopen = () => {
          if (settled) return;
          settled = true;
          clearTimeout(connectionTimeout);
          
          console.log(`✅ Connected to ${url}`);
          socketRef.current = ws;
          isIntentionalClose.current = false;
          setIsConnected(true);
          setError(null);
          reconnectAttempts.current = 0;

          // Configuration des handlers
          ws.onmessage = (event) => {
            try {
              const message: WebSocketMessage = JSON.parse(event.data);
              
              switch (message.type) {
                case 'connection_status':
                  if (message.status === 'connected') {
                    console.log('✅ Server confirmed connection');
                  }
                  break;
                  
                case 'transaction':
                  if (message.data) {
                    setTransactions(prev => {
                      const exists = prev.some(tx => tx.hash === message.data!.hash);
                      if (exists) return prev;
                      return [message.data!, ...prev].slice(0, 100);
                    });
                  }
                  break;
                  
                case 'pong':
                  // Keep-alive response
                  break;
                  
                default:
                  console.debug('Unknown message type:', message.type);
              }
            } catch (err) {
              console.error('Error parsing message:', err);
            }
          };

          ws.onclose = (event) => {
            console.log(`🔴 WebSocket closed - Code: ${event.code}, Clean: ${event.wasClean}`);
            setIsConnected(false);
            socketRef.current = null;

            if (isMountedRef.current && !isIntentionalClose.current && event.code !== 1000) {
              reconnectAttempts.current += 1;
              const delay = Math.min(
                RECONNECT_DELAY * Math.pow(BACKOFF_MULTIPLIER, reconnectAttempts.current - 1),
                MAX_BACKOFF
              );
              console.log(`🔄 Reconnecting in ${Math.ceil(delay / 1000)}s (attempt ${reconnectAttempts.current})`);
              setError(`Reconnexion dans ${Math.ceil(delay / 1000)}s...`);
              reconnectTimeoutRef.current = setTimeout(() => connect(), delay);
            }
          };

          ws.onerror = (event) => {
            console.error('❌ WebSocket error:', event);
            if (!settled) {
              settled = true;
              clearTimeout(connectionTimeout);
              candidateIndex++;
              const msg = event && (event as any).message ? (event as any).message : JSON.stringify(event);
              setLastError(`Error connecting to ${url}: ${msg}`);
              tryNextCandidate();
            }
          };
        };

        ws.onerror = (event) => {
          if (!settled) {
            settled = true;
            clearTimeout(connectionTimeout);
            console.warn(`❌ Failed to connect to ${url}`);
            try {
              ws.close();
            } catch (e) {}
            candidateIndex++;
            setLastError(`Failed to connect to ${url}`);
            tryNextCandidate();
          }
        };

      } catch (err) {
        console.error(`Exception creating WebSocket for ${url}:`, err);
        candidateIndex++;
        setLastError(String(err));
        tryNextCandidate();
      }
    };

    // Démarrer les tentatives
    tryNextCandidate();
  }, [cleanup]);

  // Fonction pour envoyer un message
  const sendMessage = useCallback((message: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify(message));
        return true;
      } catch (e) {
        console.error('Error sending message:', e);
        return false;
      }
    } else {
      console.warn('WebSocket not connected');
      setError('Non connecté');
      return false;
    }
  }, []);

  // Fonction de reconnexion manuelle
  const reconnect = useCallback(() => {
    console.log('🔄 Manual reconnection requested');
    reconnectAttempts.current = 0;
    cleanup();
    connect();
  }, [cleanup, connect]);

  // Effet pour la connexion initiale
  useEffect(() => {
    console.log('🚀 Initializing WebSocket');
    isMountedRef.current = true;
    
    // Petit délai pour laisser le composant se monter
    const initTimeout = setTimeout(() => {
      if (isMountedRef.current) {
        connect();
      }
    }, 100);

    // Cleanup au démontage
    return () => {
      console.log('🧹 Cleaning up WebSocket');
      isMountedRef.current = false;
      isIntentionalClose.current = true;
      clearTimeout(initTimeout);
      cleanup();
    };
  }, [connect, cleanup]);

  return {
    isConnected,
    transactions,
    error,
    lastTriedUrl,
    lastError,
    sendMessage,
    reconnect
  };
};