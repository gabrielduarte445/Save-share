// Helpers de mapa do SAVE-SHARE, 100% gratuitos e sem chave de API:
// - Mapa: Leaflet + tiles do OpenStreetMap (carregados no HTML da página)
// - Endereço -> coordenadas: Nominatim (OpenStreetMap)
//
// Política do Nominatim: no máximo 1 consulta por segundo e uso leve.
// Por isso as consultas entram numa fila com intervalo, e cada resultado
// fica guardado no navegador (localStorage) para não consultar de novo.

const CHAVE_CACHE = "save_share_geocache_v1";
const INTERVALO_MS = 1100;

function carregarCache() {
    try { return JSON.parse(localStorage.getItem(CHAVE_CACHE) || "{}"); } catch { return {}; }
}

const cache = carregarCache();

function salvarCache() {
    try { localStorage.setItem(CHAVE_CACHE, JSON.stringify(cache)); } catch { /* sem espaço: segue sem cache */ }
}

let filaAnterior = Promise.resolve();
let ultimaChamada = 0;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function consultarNominatim(texto) {
    const tarefa = filaAnterior.then(async () => {
        const espera = Math.max(0, ultimaChamada + INTERVALO_MS - Date.now());
        if (espera) await esperar(espera);
        ultimaChamada = Date.now();

        const url = "https://nominatim.openstreetmap.org/search"
            + "?format=jsonv2&limit=1&countrycodes=br&accept-language=pt-BR"
            + `&q=${encodeURIComponent(texto)}`;

        const resposta = await fetch(url, { headers: { Accept: "application/json" } });
        if (!resposta.ok) throw new Error(`geocode_${resposta.status}`);

        const lista = await resposta.json();
        return lista[0] ? { lat: Number(lista[0].lat), lng: Number(lista[0].lon) } : null;
    });

    filaAnterior = tarefa.catch(() => {});
    return tarefa;
}

/**
 * Converte o endereço do pedido em coordenadas.
 * Tenta endereço completo, depois sem número, depois só bairro e cidade
 * (nesse caso marca aproximado: true).
 * Devolve { lat, lng, aproximado } ou null se não achar.
 */
export async function geocodificarEndereco(endereco) {
    if (!endereco) return null;

    const logradouro = endereco.logradouro || endereco.rua;

    const tentativas = [
        [logradouro, endereco.numero, endereco.bairro, endereco.cidade, endereco.estado, "Brasil"],
        [logradouro, endereco.bairro, endereco.cidade, endereco.estado, "Brasil"],
        [endereco.bairro, endereco.cidade, endereco.estado, "Brasil"]
    ].map((partes) => partes.filter(Boolean).join(", "));

    for (let i = 0; i < tentativas.length; i++) {
        const texto = tentativas[i];
        if (!texto || texto === "Brasil") continue;

        let resultado = cache[texto];

        if (resultado === undefined) {
            resultado = await consultarNominatim(texto); // erro de rede não entra no cache
            cache[texto] = resultado;
            salvarCache();
        }

        if (resultado) return { ...resultado, aproximado: i > 0 };
    }

    return null;
}

/** Posição atual do entregador (pede permissão ao navegador). Devolve null se negar. */
export function obterPosicaoAtual() {
    return new Promise((resolve) => {
        if (!("geolocation" in navigator)) {
            resolve(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    });
}

/** Distância em linha reta (km), fórmula de haversine. */
export function distanciaKm(a, b) {
    const rad = (g) => (g * Math.PI) / 180;
    const R = 6371;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatarDistancia(km) {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1).replace(".", ",")} km`;
}

/** Link que abre a rota no Google Maps do celular/computador (não usa chave). */
export function linkRota(destino) {
    return `https://www.google.com/maps/dir/?api=1&destination=${destino.lat},${destino.lng}&travelmode=driving`;
}