/**
 * Detecção de Ambiente (Local vs Cloud)
 * O sistema decide seu modo operacional observando o hostname.
 * - 'localhost' ou IPs de rede local (ex: 192.168.x.x) = Modo Local (Full Operation)
 * - Domínios públicos (ex: *.railway.app, *.vercel.app) = Modo Nuvem (Apenas Gestão)
 */

export function isCloudMode(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
  
  // IPs de rede local (192.168.x.x, 10.x.x.x, 172.16.x.x)
  if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
    return false;
  }
  
  // Se não for local, assumimos modo nuvem
  return true;
}
