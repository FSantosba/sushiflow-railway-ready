/**
 * ServerContext — Comunicação com o Servidor Local (SushiFlow Local Server)
 * 
 * Responsabilidades:
 * - Detectar se o servidor local está online (ping a cada 5s)
 * - Enviar pedidos e receber eventos em tempo real via Socket.IO
 * - Fila offline: salvar pedidos em localStorage quando servidor indisponível
 * - Sincronizar a fila ao reconectar
 */
import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef
} from 'react';
import { io, Socket } from 'socket.io-client';
import { isCloudMode } from '../utils/env';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface PrinterConfig {
  key: string;
  label: string;
  type: string;
  mode: 'usb' | 'network';
  interface: string;
}

interface ServerConfig {
  RESTAURANT_NAME: string;
  PRINTER_KITCHEN_TYPE: string;
  PRINTER_KITCHEN_MODE: string;
  PRINTER_KITCHEN_INTERFACE: string;
  PRINTER_BAR_TYPE: string;
  PRINTER_BAR_MODE: string;
  PRINTER_BAR_INTERFACE: string;
  PRINT_WIDTH: string;
  SERVICE_FEE_PCT: string;
  [key: string]: string;
}

interface OrderPayload {
  mesaId: string;
  garcom?: string;
  items: Array<{
    id: string;
    menuItemId: string;
    name: string;
    price: number;
    qty: number;
    notes?: string;
    createdAt: number;
  }>;
}

interface QueuedOrder extends OrderPayload {
  queuedAt: number;
  retries: number;
}

interface ServerContextData {
  serverUrl: string;
  setServerUrl: (url: string) => void;
  isOnline: boolean;
  isConfigured: boolean;
  pendingQueueCount: number;
  serverConfig: Partial<ServerConfig>;
  sendOrder: (payload: OrderPayload) => Promise<{ ok: boolean; print?: { ok: boolean } }>;
  updateServerConfig: (updates: Partial<ServerConfig>) => Promise<boolean>;
  printTest: (printerKey: string) => Promise<{ ok: boolean; error?: string }>;
  pingServer: () => Promise<boolean>;
}

const DEFAULT_URL_KEY = '@sushiflow:serverUrl';
const QUEUE_KEY       = '@sushiflow:offlineQueue';

const ServerContext = createContext<ServerContextData>({} as ServerContextData);

export const ServerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [serverUrl, _setServerUrl] = useState<string>(() => {
    if (isCloudMode()) return '';
    let url = localStorage.getItem(DEFAULT_URL_KEY) || 'http://localhost:3001';
    // Auto-correção para garantir que o antigo porto 3000 migre pro 3001
    if (url.includes('localhost:3000') || url.includes('127.0.0.1:3000')) {
        url = url.replace(':3000', ':3001');
        localStorage.setItem(DEFAULT_URL_KEY, url);
    }
    return url;
  });
  const [isOnline, setIsOnline]   = useState(false);
  const [serverConfig, setServerConfig] = useState<Partial<ServerConfig>>({});
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const isConfigured = serverUrl.trim().length > 0;

  // ─── Persistir URL ─────────────────────────────────────────────────────────
  const setServerUrl = useCallback((url: string) => {
    _setServerUrl(url);
    localStorage.setItem(DEFAULT_URL_KEY, url);
  }, []);

  // ─── Ping / Health Check ───────────────────────────────────────────────────
  const pingServer = useCallback(async (): Promise<boolean> => {
    if (!serverUrl) return false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${serverUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      const online = res.ok;
      setIsOnline(online);
      if (online) loadServerConfig();
      return online;
    } catch {
      setIsOnline(false);
      return false;
    }
  }, [serverUrl]);

  // ─── Carregar config do servidor ──────────────────────────────────────────
  const loadServerConfig = useCallback(async () => {
    try {
      const res = await fetch(`${serverUrl}/api/config`);
      if (res.ok) setServerConfig(await res.json());
    } catch {}
  }, [serverUrl]);

  // ─── Socket.IO ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOnline || !serverUrl) return;

    const socket = io(serverUrl, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => console.log('[WS] Conectado ao servidor local'));
    socket.on('disconnect', () => setIsOnline(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isOnline, serverUrl]);

  // ─── Ping interval ────────────────────────────────────────────────────────
  useEffect(() => {
    pingServer();
    pingIntervalRef.current = setInterval(pingServer, 5000);
    return () => clearInterval(pingIntervalRef.current);
  }, [pingServer]);

  // ─── Fila offline ─────────────────────────────────────────────────────────
  const readQueue = (): QueuedOrder[] => {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
  };
  const writeQueue = (q: QueuedOrder[]) => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    setPendingQueueCount(q.length);
  };

  // Inicializar contagem da fila
  useEffect(() => {
    setPendingQueueCount(readQueue().length);
  }, []);

  // Sincronizar fila ao ficar online
  useEffect(() => {
    if (!isOnline) return;
    const queue = readQueue();
    if (queue.length === 0) return;

    console.log(`[SYNC] Sincronizando ${queue.length} pedidos offline...`);
    (async () => {
      const remaining: QueuedOrder[] = [];
      for (const order of queue) {
        try {
          const res = await fetch(`${serverUrl}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(order),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          console.log(`[SYNC] ✅ Mesa ${order.mesaId} sincronizada`);
        } catch (e) {
          console.warn(`[SYNC] ❌ Falha ao sincronizar Mesa ${order.mesaId}:`, e);
          remaining.push({ ...order, retries: order.retries + 1 });
        }
      }
      writeQueue(remaining);
    })();
  }, [isOnline]);

  // ─── Enviar pedido (online ou enfileirar offline) ─────────────────────────
  const sendOrder = useCallback(async (payload: OrderPayload) => {
    if (isOnline) {
      try {
        const res = await fetch(`${serverUrl}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        return { ok: res.ok, ...data };
      } catch (e) {
        // Caiu — enfileirar
        console.warn('[ORDER] Servidor indisponível, enfileirando pedido offline.');
      }
    }

    // Offline fallback
    const queue = readQueue();
    queue.push({ ...payload, queuedAt: Date.now(), retries: 0 });
    writeQueue(queue);
    return { ok: true, queued: true, print: { ok: false, queued: true } };
  }, [isOnline, serverUrl]);

  // ─── Atualizar configuração do servidor ───────────────────────────────────
  const updateServerConfig = useCallback(async (updates: Partial<ServerConfig>): Promise<boolean> => {
    try {
      const res = await fetch(`${serverUrl}/api/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setServerConfig(prev => ({ ...prev, ...updates }));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [serverUrl]);

  // ─── Imprimir página de teste ─────────────────────────────────────────────
  const printTest = useCallback(async (printerKey: string) => {
    try {
      const res = await fetch(`${serverUrl}/api/print/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printer: printerKey }),
      });
      return await res.json();
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }, [serverUrl]);

  return (
    <ServerContext.Provider value={{
      serverUrl, setServerUrl,
      isOnline, isConfigured,
      pendingQueueCount,
      serverConfig,
      sendOrder,
      updateServerConfig,
      printTest,
      pingServer,
    }}>
      {children}
    </ServerContext.Provider>
  );
};

export const useServer = () => useContext(ServerContext);
