import { db } from "../../public/firebase-config.js";
import { protegerPagina } from "../shared/guarda.js";
import { mostrarToast } from "../shared/toast.js";
import { escaparHtml } from "../shared/html.js";
import {
    geocodificarEndereco,
    obterPosicaoAtual,
    distanciaKm,
    formatarDistancia,
    linkRota
} from "../shared/mapa.js";

import {
    collection,
    doc,
    updateDoc,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const FORMATO_CODIGO = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const listaDisponiveis = document.getElementById("lista-disponiveis");
const listaMinhasEntregas = document.getElementById("lista-minhas-entregas");
const btnMinhaPosicao = document.getElementById("btn-minha-posicao");

const COR_DISPONIVEL = "#2e7d32";
const COR_ENTREGA = "#1565c0";
const CENTRO_PADRAO = [-12.9714, -38.5014]; // Salvador

// Só entregador acessa esta tela; os outros tipos vão para a tela deles.
const { usuario } = await protegerPagina({ tipos: ["entregador"] });
const usuarioAtual = usuario;

// ---------- MAPA ----------

const L = window.L; // Leaflet, carregado por <script> no HTML
const mapa = L.map("mapa-entregas").setView(CENTRO_PADRAO, 12);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(mapa);

const camadaDisponiveis = L.layerGroup().addTo(mapa);
const camadaEntregas = L.layerGroup().addTo(mapa);
const camadaMinhaPosicao = L.layerGroup().addTo(mapa);

const marcadores = new Map();      // pedidoId -> marcador
const pontosPedidos = new Map();   // pedidoId -> { lat, lng, aproximado }
let minhaPosicao = null;
let temporizadorEnquadrar = null;

function enquadrarMapa() {
    clearTimeout(temporizadorEnquadrar);
    temporizadorEnquadrar = setTimeout(() => {
        const grupo = L.featureGroup([camadaDisponiveis, camadaEntregas, camadaMinhaPosicao]);
        const limites = grupo.getBounds();
        if (limites.isValid()) {
            mapa.fitBounds(limites, { padding: [40, 40], maxZoom: 15 });
        }
    }, 400);
}

function atualizarDistancias() {
    if (!minhaPosicao) return;

    document.querySelectorAll(".card-pedido[data-pedido-id]").forEach((card) => {
        const ponto = pontosPedidos.get(card.dataset.pedidoId);
        const alvo = card.querySelector(".pedido-distancia");
        if (!ponto || !alvo) return;

        const km = distanciaKm(minhaPosicao, ponto);
        alvo.textContent = `≈ ${formatarDistancia(km)} de você, em linha reta${ponto.aproximado ? " (local aproximado)" : ""}`;
    });
}

async function localizarEntregador() {
    btnMinhaPosicao.disabled = true;

    const posicao = await obterPosicaoAtual();
    btnMinhaPosicao.disabled = false;

    if (!posicao) {
        mostrarToast("Não consegui sua localização. Permita o acesso no navegador.", "erro");
        return;
    }

    minhaPosicao = posicao;
    camadaMinhaPosicao.clearLayers();

    L.circleMarker([posicao.lat, posicao.lng], {
        radius: 9, color: "#ffffff", weight: 3, fillColor: "#e65100", fillOpacity: 1
    }).bindPopup("Você está aqui").addTo(camadaMinhaPosicao);

    atualizarDistancias();
    enquadrarMapa();
}

btnMinhaPosicao.addEventListener("click", localizarEntregador);

// Cria o marcador do pedido depois de descobrir as coordenadas do endereço.
// aindaValido() evita desenhar resultado de uma atualização que já foi substituída.
async function posicionarPedido(pedidoId, pedido, card, camada, cor, aindaValido) {
    try {
        const ponto = await geocodificarEndereco(pedido.endereco_snapshot);
        if (!aindaValido()) return;

        const alvoDistancia = card.querySelector(".pedido-distancia");

        if (!ponto) {
            if (alvoDistancia) alvoDistancia.textContent = "Não consegui localizar este endereço no mapa.";
            return;
        }

        pontosPedidos.set(pedidoId, ponto);

        const e = pedido.endereco_snapshot;
        const popup = document.createElement("div");
        const valor = document.createElement("strong");
        valor.textContent = `R$ ${Number(pedido.valor_total).toFixed(2).replace(".", ",")}`;
        const endereco = document.createElement("div");
        endereco.textContent = `${e.logradouro || e.rua}, ${e.numero} - ${e.bairro}`;
        popup.append(valor, endereco);

        const marcador = L.circleMarker([ponto.lat, ponto.lng], {
            radius: 11, color: "#ffffff", weight: 3, fillColor: cor, fillOpacity: 0.95
        }).bindPopup(popup).addTo(camada);

        marcadores.set(pedidoId, marcador);

        const btnMapa = card.querySelector(".btn-ver-mapa");
        if (btnMapa) {
            btnMapa.hidden = false;
            btnMapa.addEventListener("click", () => {
                mapa.setView([ponto.lat, ponto.lng], 16);
                marcador.openPopup();
                document.getElementById("mapa-entregas").scrollIntoView({ behavior: "smooth", block: "center" });
            });
        }

        const linkDaRota = card.querySelector(".link-rota");
        if (linkDaRota) {
            linkDaRota.href = linkRota(ponto);
            linkDaRota.hidden = false;
        }

        atualizarDistancias();
        enquadrarMapa();

    } catch (erro) {
        console.warn("Não foi possível localizar o endereço:", erro);
        const alvo = card.querySelector(".pedido-distancia");
        if (alvo) alvo.textContent = "Mapa indisponível para este endereço agora.";
    }
}

// ---------- CARDS ----------

function textoEndereco(e) {
    return `${escaparHtml(e.logradouro || e.rua)}, ${escaparHtml(e.numero)} - ${escaparHtml(e.bairro)}, ${escaparHtml(e.cidade)}/${escaparHtml(e.estado)}`;
}

function textoItens(pedido) {
    return pedido.itens
        .map((item) => `${escaparHtml(item.quantidade)}x ${escaparHtml(item.nome)}`)
        .join(", ");
}

const valorFormatado = (pedido) => Number(pedido.valor_total).toFixed(2).replace(".", ",");

let tokenDisponiveis = 0;
let tokenEntregas = 0;

// ---------- PEDIDOS DISPONÍVEIS ----------

function escutarDisponiveis() {

    const consulta = query(
        collection(db, "pedidos"),
        where("status", "==", "preparo"),
        where("entregador_id", "==", null)
    );

    onSnapshot(consulta, (resultado) => {

        const token = ++tokenDisponiveis;
        camadaDisponiveis.clearLayers();

        if (resultado.empty) {
            listaDisponiveis.innerHTML = `<p class="empty-message">Nenhum pedido disponível no momento.</p>`;
            return;
        }

        listaDisponiveis.innerHTML = "";

        resultado.docs.forEach((docSnap) => {
            const pedido = docSnap.data();

            const card = document.createElement("div");
            card.className = "card-pedido";
            card.dataset.pedidoId = docSnap.id;
            card.innerHTML = `
                <p class="pedido-valor">R$ ${valorFormatado(pedido)}</p>
                <p class="pedido-endereco">📍 ${textoEndereco(pedido.endereco_snapshot)}</p>
                <p class="pedido-distancia">Localizando no mapa...</p>
                <p class="pedido-itens">${textoItens(pedido)}</p>
                <button type="button" class="btn-ver-mapa" hidden>Ver no mapa</button>
                <input type="text" class="input-codigo" placeholder="Código do estabelecimento (6 dígitos)" maxlength="6" autocapitalize="characters" autocomplete="off" spellcheck="false">
                <button type="button" class="btn-pegar-pedido">Confirmar retirada</button>
            `;

            card.querySelector(".btn-pegar-pedido").addEventListener("click", () => {
                const codigoDigitado = card.querySelector(".input-codigo").value.trim().toUpperCase();
                pegarPedido(docSnap.id, codigoDigitado);
            });

            listaDisponiveis.appendChild(card);

            posicionarPedido(docSnap.id, pedido, card, camadaDisponiveis, COR_DISPONIVEL,
                () => token === tokenDisponiveis);
        });

    }, (erro) => {
        console.error("Erro ao carregar pedidos disponíveis:", erro);
        listaDisponiveis.innerHTML = `<p class="empty-message">Erro ao carregar pedidos.</p>`;
    });
}

async function pegarPedido(pedidoId, codigoDigitado) {

    if (!FORMATO_CODIGO.test(codigoDigitado)) {
        mostrarToast("Digite o código de 6 dígitos informado pelo estabelecimento.", "erro");
        return;
    }

    try {
        await updateDoc(doc(db, "pedidos", pedidoId), {
            entregador_id: usuarioAtual.uid,
            status: "entrega",
            codigo_informado: codigoDigitado
        });

        mostrarToast("Retirada confirmada!", "sucesso");

    } catch (erro) {
        console.error("Erro ao pegar pedido:", erro);
        mostrarToast("Código incorreto ou pedido indisponível.", "erro");
    }
}

// ---------- MINHAS ENTREGAS ----------

function escutarMinhasEntregas() {

    const consulta = query(
        collection(db, "pedidos"),
        where("entregador_id", "==", usuarioAtual.uid),
        where("status", "==", "entrega")
    );

    onSnapshot(consulta, (resultado) => {

        const token = ++tokenEntregas;
        camadaEntregas.clearLayers();

        if (resultado.empty) {
            listaMinhasEntregas.innerHTML = `<p class="empty-message">Você não tem entregas em andamento.</p>`;
            return;
        }

        listaMinhasEntregas.innerHTML = "";

        resultado.docs.forEach((docSnap) => {
            const pedido = docSnap.data();

            const card = document.createElement("div");
            card.className = "card-pedido";
            card.dataset.pedidoId = docSnap.id;
            card.innerHTML = `
                <p class="pedido-valor">R$ ${valorFormatado(pedido)}</p>
                <p class="pedido-endereco">📍 ${textoEndereco(pedido.endereco_snapshot)}</p>
                <p class="pedido-distancia">Localizando no mapa...</p>
                <p class="pedido-itens">${textoItens(pedido)}</p>
                <button type="button" class="btn-ver-mapa" hidden>Ver no mapa</button>
                <a class="link-rota" target="_blank" rel="noopener noreferrer" hidden>Abrir rota no Google Maps</a>
                <input type="text" class="input-codigo" placeholder="Código do cliente (6 dígitos)" maxlength="6" autocapitalize="characters" autocomplete="off" spellcheck="false">
                <button type="button" class="btn-entregue">Confirmar entrega</button>
            `;

            card.querySelector(".btn-entregue").addEventListener("click", () => {
                const codigoDigitado = card.querySelector(".input-codigo").value.trim().toUpperCase();
                concluirEntrega(docSnap.id, codigoDigitado);
            });

            listaMinhasEntregas.appendChild(card);

            posicionarPedido(docSnap.id, pedido, card, camadaEntregas, COR_ENTREGA,
                () => token === tokenEntregas);
        });

    }, (erro) => {
        console.error("Erro ao carregar minhas entregas:", erro);
        listaMinhasEntregas.innerHTML = `<p class="empty-message">Erro ao carregar entregas.</p>`;
    });
}

async function concluirEntrega(pedidoId, codigoDigitado) {

    if (!FORMATO_CODIGO.test(codigoDigitado)) {
        mostrarToast("Digite o código de 6 dígitos informado pelo cliente.", "erro");
        return;
    }

    try {
        await updateDoc(doc(db, "pedidos", pedidoId), {
            status: "entregue",
            codigo_entrega_informado: codigoDigitado
        });

        mostrarToast("Entrega confirmada!", "sucesso");

    } catch (erro) {
        console.error("Erro ao concluir entrega:", erro);
        mostrarToast("Código incorreto.", "erro");
    }
}

// ---------- INÍCIO ----------

escutarDisponiveis();
escutarMinhasEntregas();
localizarEntregador();