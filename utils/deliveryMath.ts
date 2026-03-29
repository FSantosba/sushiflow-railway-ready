import * as turf from '@turf/turf';

// ── Tipagens ──────────────────────────────────────────────────────────────────
export interface Coordinate {
    lat: number;
    lng: number;
}

export interface DeliveryZone {
    id: string;
    name: string;
    fee: number;
    minOrder: number;
    color: string;
    coordinates?: Coordinate[];
}

// ── 1. Função de Geocoding (Endereço -> Coordenadas) ──────────────────────────
export const obterCoordenadasDoEndereco = async (
    enderecoCompleto: string,
    googleApiKey: string
): Promise<Coordinate | null> => {
    try {
        const enderecoFormatado = encodeURIComponent(enderecoCompleto);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${enderecoFormatado}&key=${googleApiKey}`;

        const resposta = await fetch(url);
        const dados = await resposta.json();

        // Verifica se o Google retornou um resultado válido
        if (dados.status === 'OK' && dados.results.length > 0) {
            const localizacao = dados.results[0].geometry.location;
            return {
                lat: localizacao.lat,
                lng: localizacao.lng
            };
        } else {
            console.error("Google Maps não encontrou o endereço:", dados.status);
            return null;
        }
    } catch (erro) {
        console.error("Erro na requisição de Geocoding:", erro);
        return null;
    }
};

// ── 2. Função Matemática (Verifica se Lat/Lng está dentro do Polígono) ────────
export const encontrarZonaDeEntrega = (
    latCliente: number,
    lngCliente: number,
    zonasCadastradas: DeliveryZone[]
): DeliveryZone | null => {

    // IMPORTANTE: O Turf.js exige a ordem [Longitude, Latitude]
    const pontoCliente = turf.point([lngCliente, latCliente]);

    for (const zona of zonasCadastradas) {
        // Ignora áreas que não formam um polígono válido (precisam de 3 pontos ou mais)
        if (!zona.coordinates || zona.coordinates.length < 3) continue;

        // Extrai os pontos desenhados no formato [lng, lat]
        const coordenadasTurf = zona.coordinates.map(ponto => [ponto.lng, ponto.lat]);

        // Para formar um polígono válido no Turf.js, o primeiro e o último ponto devem ser idênticos (fechar a forma)
        coordenadasTurf.push([...coordenadasTurf[0]]);

        const poligono = turf.polygon([coordenadasTurf]);

        // Verifica se o ponto do cliente está dentro desse polígono específico
        if (turf.booleanPointInPolygon(pontoCliente, poligono)) {
            return zona; // Retorna a zona correspondente e interrompe o loop
        }
    }

    return null; // Cliente fora de todas as áreas desenhadas
};

// ── 3. Fluxo Completo (Pronto para usar na tela de Carrinho/Checkout) ─────────
export const calcularViabilidadeDeEntrega = async (
    enderecoDigitado: string,
    zonasCadastradas: DeliveryZone[],
    googleApiKey: string,
    cidadePadrao: string = "Bragança Paulista"
): Promise<{ sucesso: boolean; zona?: DeliveryZone; mensagem: string }> => {

    // Concatena a cidade padrão para evitar que o Google ache a rua em outro estado
    const enderecoBusca = `${enderecoDigitado}, ${cidadePadrao} - SP, Brasil`;

    const coordenadas = await obterCoordenadasDoEndereco(enderecoBusca, googleApiKey);

    if (!coordenadas) {
        return {
            sucesso: false,
            mensagem: "Não conseguimos localizar este endereço no mapa. Verifique se o nome da rua e número estão corretos."
        };
    }

    const zonaEncontrada = encontrarZonaDeEntrega(coordenadas.lat, coordenadas.lng, zonasCadastradas);

    if (zonaEncontrada) {
        return {
            sucesso: true,
            zona: zonaEncontrada,
            mensagem: `Endereço dentro da área de cobertura: ${zonaEncontrada.name}`
        };
    } else {
        return {
            sucesso: false,
            mensagem: "Infelizmente, ainda não fazemos entregas nesta região."
        };
    }
};