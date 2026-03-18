// ================================================================
// SushiFlow — Google Maps Platform Service  (v2 — TSP via Directions API)
// ================================================================
// Configure em .env.local:  VITE_GOOGLE_MAPS_KEY=AIza...
//
// Fluxo com API habilitada:
//   1. Geocoding API → cada endereço vira { lat, lng }
//   2. Greedy clustering (Haversine) → agrupa pedidos próximos
//   3. Directions API (optimize:true) → Google resolve o TSP internamente
//      retornando a ordem ótima de paradas + distância + tempo reais
//
// Fallback sem API:
//   • Agrupa por bairro extraído do endereço (sem custo de API)
// ================================================================

export interface LatLng { lat: number; lng: number; }

export interface GeocodeResult {
    orderId: string;
    address: string;
    latLng: LatLng | null;
}

export interface RouteGroup {
    id: string;
    /** Bairro/região da primeira parada (ou descritivo gerado) */
    region: string;
    /** IDs dos pedidos, JÁ NA ORDEM ÓTIMA de entrega */
    orderIds: string[];
    /** Tempo total em minutos (real via API ou heurística) */
    estimatedMinutes: number;
    /** Distância total em km (real via API ou 0 no fallback) */
    totalDistanceKm: number;
    /** URL multi-parada Waze (1ª parada apenas — limitação do Waze) */
    wazeUrl: string;
    /** URL multi-parada Google Maps na ordem ótima */
    mapsUrl: string;
    /** true = otimizado pela API; false = heurística local */
    isApiOptimized: boolean;
}

// ── Lê a chave de forma segura ──────────────────────────────
const _env = (import.meta as unknown as Record<string, Record<string, string>>)['env'];
const API_KEY = _env?.['VITE_GOOGLE_MAPS_KEY'];

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const DIRECTION_URL = 'https://maps.googleapis.com/maps/api/directions/json';

// ── Utilitários ─────────────────────────────────────────────

export function isMapsApiConfigured(): boolean {
    return !!API_KEY && API_KEY !== 'YOUR_KEY_HERE';
}

/** Extrai o bairro/região de um endereço CSV (ex: "Rua X, 123, Bairro, Cidade") */
export function extractNeighborhood(address: string): string {
    if (!address) return 'Sem endereço';
    const parts = address.split(',').map(s => s.trim());
    if (parts.length >= 3) return parts[2];
    if (parts.length >= 2) return parts[1];
    return parts[0];
}

function haversineKm(a: LatLng, b: LatLng): number {
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function toRad(d: number) { return d * Math.PI / 180; }

// ── Geocoding ────────────────────────────────────────────────

export async function geocodeAddresses(
    orders: { id: string; address: string }[]
): Promise<GeocodeResult[]> {
    if (!isMapsApiConfigured()) {
        return orders.map(o => ({ orderId: o.id, address: o.address, latLng: null }));
    }
    return Promise.all(orders.map(async (o): Promise<GeocodeResult> => {
        try {
            const url = `${GEOCODE_URL}?address=${encodeURIComponent(o.address)}&key=${API_KEY}&language=pt-BR&region=BR&components=country:BR`;
            const data = await fetch(url).then(r => r.json());
            if (data.status === 'OK') {
                return { orderId: o.id, address: o.address, latLng: data.results[0].geometry.location };
            }
        } catch (e) {
            console.error('[MapsService] geocoding error:', e);
        }
        return { orderId: o.id, address: o.address, latLng: null };
    }));
}

// ── TSP via Google Directions API ───────────────────────────

/**
 * Chama a Directions API com `optimize:true` nos waypoints.
 * O Google resolve o TSP internamente e devolve:
 *   - waypoint_order: array com os índices reordenados
 *   - distância total em metros
 *   - duração total em segundos
 *
 * Retorna os pedidos na sequência ótima + métricas reais.
 */
async function optimizeWithDirectionsAPI(
    addresses: string[],
    orderIds: string[]
): Promise<{
    optimizedOrderIds: string[];
    totalDistanceKm: number;
    estimatedMinutes: number;
    mapsUrl: string;
    wazeUrl: string;
}> {
    if (addresses.length === 0) {
        return { optimizedOrderIds: [], totalDistanceKm: 0, estimatedMinutes: 0, mapsUrl: '', wazeUrl: '' };
    }

    // Com 1 parada não há o que otimizar
    if (addresses.length === 1) {
        return {
            optimizedOrderIds: orderIds,
            totalDistanceKm: 0,
            estimatedMinutes: 12,
            wazeUrl: buildWazeMultiStopUrl(addresses),
            mapsUrl: buildMapsMultiStopUrl(addresses),
        };
    }

    const origin = encodeURIComponent(addresses[0]);
    const destination = encodeURIComponent(addresses[addresses.length - 1]);

    // Waypoints intermediários com prefixo optimize:true para o Google resolver o TSP
    const middleAddresses = addresses.slice(1, -1);
    const waypointsParam = middleAddresses.length > 0
        ? `optimize:true|${middleAddresses.map(a => encodeURIComponent(a)).join('|')}`
        : '';

    const url = `${DIRECTION_URL}?origin=${origin}&destination=${destination}${waypointsParam ? `&waypoints=${waypointsParam}` : ''}&key=${API_KEY}&language=pt-BR&region=BR&mode=driving`;

    try {
        const data = await fetch(url).then(r => r.json());

        if (data.status !== 'OK' || !data.routes?.length) {
            console.warn('[MapsService] Directions API status:', data.status);
            throw new Error('directions_failed');
        }

        const route = data.routes[0];

        // waypoint_order contém os índices dos INTERMEDIÁRIOS reordenados
        // Ex: [1, 0] significa que o 2º waypoint vem antes do 1º
        const waypointOrder: number[] = route.waypoint_order ?? [];

        // Reconstrói a sequência completa: orig → intermediários reordenados → destino
        const reorderedAddresses = [
            addresses[0],
            ...waypointOrder.map(i => middleAddresses[i]),
            addresses[addresses.length - 1],
        ];

        // Reconstrói a sequência de IDs correspondente
        const origId = orderIds[0];
        const destId = orderIds[orderIds.length - 1];
        const midIds = orderIds.slice(1, -1);
        const optimizedOrderIds = [
            origId,
            ...waypointOrder.map(i => midIds[i]),
            destId,
        ];

        // Soma distância e tempo de todas as legs
        const legs = route.legs as { distance: { value: number }; duration: { value: number } }[];
        const totalDistanceM = legs.reduce((s, l) => s + l.distance.value, 0);
        const totalDurationSec = legs.reduce((s, l) => s + l.duration.value, 0);

        return {
            optimizedOrderIds,
            totalDistanceKm: +(totalDistanceM / 1000).toFixed(1),
            estimatedMinutes: Math.ceil(totalDurationSec / 60),
            wazeUrl: buildWazeMultiStopUrl(reorderedAddresses),
            mapsUrl: buildMapsMultiStopUrl(reorderedAddresses),
        };
    } catch {
        // Fallback heurístico se a API falhar
        console.warn('[MapsService] Directions API falhou, usando heurística.');
        return {
            optimizedOrderIds: orderIds,
            totalDistanceKm: 0,
            estimatedMinutes: addresses.length * 12,
            wazeUrl: buildWazeMultiStopUrl(addresses),
            mapsUrl: buildMapsMultiStopUrl(addresses),
        };
    }
}

// ── buildOptimizedRoutes — ponto de entrada principal ────────

/**
 * Constrói rotas otimizadas para o motoboy.
 *
 * Pipeline com API:
 *   Geocoding → Greedy clustering (8 km) → TSP Directions API por cluster
 *
 * Pipeline sem API (fallback):
 *   Agrupamento por bairro extraído do endereço
 */
export async function buildOptimizedRoutes(
    orders: { id: string; address: string; customer: string }[],
    maxPerRoute = 3
): Promise<RouteGroup[]> {
    if (orders.length === 0) return [];

    if (!isMapsApiConfigured()) {
        return buildRoutesByNeighborhood(orders, maxPerRoute);
    }

    // ── PASSO 1: Geocodificar todos os endereços ──────────────
    const geocoded = await geocodeAddresses(orders.map(o => ({ id: o.id, address: o.address })));
    const withCoords = geocoded.filter(g => g.latLng !== null);
    const withoutCoords = orders.filter(o => !withCoords.find(g => g.orderId === o.id));

    // ── PASSO 2: Greedy clustering por distância Haversine ───
    const clusters: GeocodeResult[][] = [];
    const remaining = [...withCoords];

    while (remaining.length > 0) {
        const seed = remaining.shift()!;
        const cluster = [seed];

        while (cluster.length < maxPerRoute && remaining.length > 0) {
            // Encontra o pedido mais próximo de QUALQUER ponto já no cluster
            let bestIdx = -1;
            let bestDist = Infinity;

            for (let i = 0; i < remaining.length; i++) {
                // Distância ao ponto mais próximo do cluster (não só ao seed)
                const minDist = Math.min(...cluster.map(c => haversineKm(c.latLng!, remaining[i].latLng!)));
                if (minDist < bestDist) {
                    bestDist = minDist;
                    bestIdx = i;
                }
            }

            // Inclui se estiver a menos de 10 km de algum ponto do cluster
            if (bestIdx !== -1 && bestDist <= 10) {
                cluster.push(remaining.splice(bestIdx, 1)[0]);
            } else {
                break;
            }
        }
        clusters.push(cluster);
    }

    // ── PASSO 3: TSP via Directions API em cada cluster ──────
    const groups: RouteGroup[] = [];
    let routeIdx = 1;

    for (const cluster of clusters) {
        const clusterOrders = cluster.map(g => orders.find(o => o.id === g.orderId)!);
        const addresses = clusterOrders.map(o => o.address);
        const ids = clusterOrders.map(o => o.id);

        const { optimizedOrderIds, totalDistanceKm, estimatedMinutes, wazeUrl, mapsUrl } =
            await optimizeWithDirectionsAPI(addresses, ids);

        // Usa os bairros das paradas reordenadas para montar o label da região
        const orderedAddresses = optimizedOrderIds.map(
            id => orders.find(o => o.id === id)!.address
        );
        const regions = [...new Set(orderedAddresses.map(extractNeighborhood))];
        const regionLabel = regions.slice(0, 2).join(' → ') + (regions.length > 2 ? ' +' : '');

        groups.push({
            id: `R${String(routeIdx).padStart(3, '0')}`,
            region: regionLabel,
            orderIds: optimizedOrderIds,
            estimatedMinutes,
            totalDistanceKm,
            wazeUrl,
            mapsUrl,
            isApiOptimized: true,
        });
        routeIdx++;
    }

    // Pedidos que falharam no geocoding → fallback por bairro
    if (withoutCoords.length > 0) {
        const fallback = buildRoutesByNeighborhood(withoutCoords, maxPerRoute);
        fallback.forEach(f => {
            f.id = `R${String(routeIdx).padStart(3, '0')}`;
            groups.push(f);
            routeIdx++;
        });
    }

    return groups;
}

// ── Fallback: agrupamento por bairro ────────────────────────

function buildRoutesByNeighborhood(
    orders: { id: string; address: string; customer: string }[],
    maxPerRoute: number
): RouteGroup[] {
    const byNeighborhood = new Map<string, typeof orders>();
    for (const o of orders) {
        const n = extractNeighborhood(o.address);
        if (!byNeighborhood.has(n)) byNeighborhood.set(n, []);
        byNeighborhood.get(n)!.push(o);
    }

    const groups: RouteGroup[] = [];
    let routeIdx = 1;

    // Se não há bairros distintos (endereços vazios), agrupamento simples
    if (byNeighborhood.size === 0 || (byNeighborhood.size === 1 && byNeighborhood.has('Sem endereço'))) {
        for (let i = 0; i < orders.length; i += maxPerRoute) {
            const slice = orders.slice(i, i + maxPerRoute);
            groups.push({
                id: `R${String(routeIdx).padStart(3, '0')}`,
                region: 'Região Central',
                orderIds: slice.map(o => o.id),
                estimatedMinutes: slice.length * 15,
                totalDistanceKm: 0,
                wazeUrl: buildWazeMultiStopUrl(slice.map(o => o.address)),
                mapsUrl: buildMapsMultiStopUrl(slice.map(o => o.address)),
                isApiOptimized: false,
            });
            routeIdx++;
        }
        return groups;
    }

    for (const [neighborhood, neighborhoodOrders] of byNeighborhood) {
        for (let i = 0; i < neighborhoodOrders.length; i += maxPerRoute) {
            const slice = neighborhoodOrders.slice(i, i + maxPerRoute);
            groups.push({
                id: `R${String(routeIdx).padStart(3, '0')}`,
                region: neighborhood,
                orderIds: slice.map(o => o.id),
                estimatedMinutes: slice.length * 15,
                totalDistanceKm: 0,
                wazeUrl: buildWazeMultiStopUrl(slice.map(o => o.address)),
                mapsUrl: buildMapsMultiStopUrl(slice.map(o => o.address)),
                isApiOptimized: false,
            });
            routeIdx++;
        }
    }
    return groups;
}

// ── URLs multi-parada ────────────────────────────────────────

/** Waze abre só a primeira parada (limitação do app — sem rotas multi-stop via URL) */
export function buildWazeMultiStopUrl(addresses: string[]): string {
    if (!addresses.length) return '';
    return `https://waze.com/ul?q=${encodeURIComponent(addresses[0])}&navigate=yes`;
}

/** Google Maps suporta até 8 waypoints encadeados na URL */
export function buildMapsMultiStopUrl(addresses: string[]): string {
    if (!addresses.length) return '';
    if (addresses.length === 1) return `https://maps.google.com/?q=${encodeURIComponent(addresses[0])}`;
    const origin = encodeURIComponent(addresses[0]);
    const dest = encodeURIComponent(addresses[addresses.length - 1]);
    const waypoints = addresses.slice(1, -1).map(a => encodeURIComponent(a)).join('|');
    const base = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
    return waypoints ? `${base}&waypoints=${waypoints}` : base;
}

// ── Lógica Descentralizada de Cálculo de Entrega (Motoboy) ──

/**
 * Calcula a taxa de entrega do motoboy baseada na distância real.
 * Fórmula: (Distância + 10% de margem de erro) * ValorFixoPorKm + BaseFixa
 * Isso garante um repasse justo de 100% para o motoboy.
 * 
 * @param originAddress Endereço completo do Restaurante
 * @param destAddress Endereço completo do Cliente 
 * @param ratePerKm Valor fixo por KM (default: R$ 1.50)
 * @param fixedBase Base fixa da entrega (default: R$ 3.00)
 */
export async function calculateFairDeliveryFee(
    originAddress: string,
    destAddress: string,
    ratePerKm: number = 1.50,
    fixedBase: number = 3.00
): Promise<{ distanceKm: number; fee: number; estimatedMinutes: number }> {
    // Tenta usar a API do Google para distância real
    if (isMapsApiConfigured()) {
        try {
            const url = `${DIRECTION_URL}?origin=${encodeURIComponent(originAddress)}&destination=${encodeURIComponent(destAddress)}&key=${API_KEY}&language=pt-BR&region=BR&mode=driving`;
            const data = await fetch(url).then(r => r.json());
            
            if (data.status === 'OK' && data.routes?.length) {
                const leg = data.routes[0].legs[0];
                const realDistKm = leg.distance.value / 1000;
                const estimatedMinutes = Math.ceil(leg.duration.value / 60);
                
                // Adiciona 10% de margem de erro na distância da rota calculada
                const distWithMargin = realDistKm * 1.10;
                
                // Fórmula de precificação (Exato como proposto)
                const fee = (distWithMargin * ratePerKm) + fixedBase;
                
                return {
                    distanceKm: realDistKm, // Retorna a real pra auditoria
                    fee: Math.max(fee, fixedBase), // Garante no mínimo a base fixa no repasse
                    estimatedMinutes
                };
            }
        } catch (e) {
            console.error('[MapsService] API de Direções falhou em calculateFairDeliveryFee. Usando via fallback (Haversine)...', e);
        }
    }
    
    // Fallback: Haversine se a Direction API não estiver configurada ou falhar
    const originGeo = await geocodeAddresses([{ id: 'rest_0', address: originAddress }]);
    const destGeo = await geocodeAddresses([{ id: 'dest_0', address: destAddress }]);
    
    let distKm = 5; // Default fallback se até o geocoding falhar
    
    if (originGeo[0]?.latLng && destGeo[0]?.latLng) {
        distKm = haversineKm(originGeo[0].latLng, destGeo[0].latLng);
        // Distância Haversine é linha reta ("as the crow flies"), vias urbanas costumam ser ~35% maiores na prática
        distKm = distKm * 1.35; 
    }
    
    // Adiciona 10% de margem de erro na distância ajustada
    const distWithMargin = distKm * 1.10;
    const fee = (distWithMargin * ratePerKm) + fixedBase;
    
    return {
        distanceKm: distKm,
        fee: Math.max(fee, fixedBase),
        estimatedMinutes: Math.ceil(distKm * 3.5) // Estimativa leve de ~3.5 min/km em ambiente urbano
    };
}

