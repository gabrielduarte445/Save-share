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
    getDoc,
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

const { usuario } = await protegerPagina({ tipos: ["entregador"] });

const usuarioAtual = usuario;
const cacheLojas = new Map();

// ---------- MAPA ----------

const L = window.L;
const mapa = L.map("mapa-entregas").setView(CENTRO_PADRAO, 12);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(mapa);

const camadaDisponiveis = L.layerGroup().addTo(mapa);
const camadaEntregas = L.layerGroup().addTo(mapa);
const camadaMinhaPosicao = L.layerGroup().addTo(mapa);

const marcadores = new Map();
const pontosPedidos = new Map();
let minhaPosicao = null;
let temporizadorEnquadrar = null;

// FUNÇÃO ENQUADRAR MAPA CORRIGIDA (Varre as camadas ativas sem dar erro)
function enquadrarMapa() {
    clearTimeout(temporizadorEnquadrar);
    
    temporizadorEnquadrar = setTimeout(() => {
        const marcadoresValidos = [];
        
        // Coleta marcadores válidos das camadas do mapa
        [camadaDisponiveis, camadaEntregas, camadaMinhaPosicao].forEach((camada) => {
            camada.eachLayer((layer) => {
                if (layer && typeof layer.getLatLng === 'function') {
                    marcadoresValidos.push(layer);
                }
            });
        });

        if (marcadoresValidos.length > 0) {
            const bounds = L.featureGroup(marcadoresValidos).getBounds();
            if (bounds.isValid()) {
                mapa.fitBounds(bounds, { padding: [50, 50] });
            }
        }
    }, 100);
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
    if (btnMinhaPosicao) btnMinhaPosicao.disabled = true;

    const posicao = await obterPosicaoAtual();
    if (btnMinhaPosicao) btnMinhaPosicao.disabled = false;

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

if (btnMinhaPosicao) {
    btnMinhaPosicao.addEventListener("click", localizarEntregador);
}

async function obterDadosLoja(comercianteId) {
    if (cacheLojas.has(comercianteId)) {
        return cacheLojas.get(comercianteId);
    }

    try {
        const refLoja = doc(db, "lojas", comercianteId);
        let snapLoja = await getDoc(refLoja);

        if (!snapLoja.exists()) {
            const refUsuario = doc(db, "usuarios", comercianteId);
            snapLoja = await getDoc(refUsuario);
        }

        if (snapLoja.exists()) {
            const dados = snapLoja.data();
            const informacoesLoja = {
                nome: dados.nome_loja || dados.nome || "Loja",
                endereco: dados.endereco || dados.endereco_loja || {
                    logradouro: dados.logradouro || "Endereço da Loja",
                    numero: dados.numero || "",
                    bairro: dados.bairro || "",
                    cidade: dados.cidade || "",
                    estado: dados.estado || ""
                }
            };
            cacheLojas.set(comercianteId, informacoesLoja);
            return informacoesLoja;
        }
    } catch (erro) {
        console.warn("Erro ao buscar dados da loja:", erro);
    }

    const lojaPadrao = {
        nome: "Loja",
        endereco: { logradouro: "Consultar no estabelecimento", numero: "", bairro: "", cidade: "", estado: "" }
    };
    cacheLojas.set(comercianteId, lojaPadrao);
    return lojaPadrao;
}

async function posicionarPedido(pedidoId, enderecoParaGeocodificar, card, camada, cor, aindaValido) {
    try {
        const ponto = await geocodificarEndereco(enderecoParaGeocodificar);
        if (!aindaValido()) return;

        const alvoDistancia = card.querySelector(".pedido-distancia");

        if (!ponto) {
            if (alvoDistancia) alvoDistancia.textContent = "Não consegui localizar este endereço no mapa.";
            return;
        }

        pontosPedidos.set(pedidoId, ponto);

        const e = enderecoParaGeocodificar;
        const popup = document.createElement("div");
        const endereco = document.createElement("div");
        endereco.textContent = `${e.logradouro || e.rua || ""}, ${e.numero || ""} ${e.bairro || ""}`;
        popup.append(endereco);

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

// ---------- FORMATAÇÃO DE TEXTO ----------

function textoEndereco(e) {
    if (!e) return "Endereço não informado";
    const logradouro = e.logradouro || e.rua || "";
    const numero = e.numero ? `, ${e.numero}` : "";
    const bairro = e.bairro ? ` - ${e.bairro}` : "";
    const cidade = e.cidade ? `, ${e.cidade}` : "";
    const estado = e.estado ? `/${e.estado}` : "";
    return `${escaparHtml(logradouro)}${escaparHtml(numero)}${escaparHtml(bairro)}${escaparHtml(cidade)}${escaparHtml(estado)}`;
}

function textoItens(pedido) {
    return (pedido.itens || [])
        .map((item) => `${escaparHtml(item.quantidade)}x ${escaparHtml(item.nome)}`)
        .join(", ");
}

const valorFormatado = (pedido) => Number(pedido.valor_total || 0).toFixed(2).replace(".", ",");

let tokenDisponiveis = 0;
let tokenEntregas = 0;

// ---------- PEDIDOS DISPONÍVEIS ----------

function escutarDisponiveis() {
    const consulta = query(
        collection(db, "pedidos"),
        where("status", "==", "preparo"),
        where("entregador_id", "==", null)
    );

    onSnapshot(consulta, async (resultado) => {
        const token = ++tokenDisponiveis;
        camadaDisponiveis.clearLayers();

        if (resultado.empty) {
            if (listaDisponiveis) listaDisponiveis.innerHTML = `<p class="empty-message">Nenhum pedido disponível no momento.</p>`;
            return;
        }

        if (listaDisponiveis) listaDisponiveis.innerHTML = "";

        for (const docSnap of resultado.docs) {
            const pedido = docSnap.data();
            const dadosLoja = await obterDadosLoja(pedido.comerciante_id);

            const card = document.createElement("div");
            card.className = "card-pedido";
            card.dataset.pedidoId = docSnap.id;
            card.innerHTML = `
                <p class="pedido-valor">R$ ${valorFormatado(pedido)}</p>
                <p class="pedido-endereco">🏢 <strong>Retirada (Loja):</strong> ${escaparHtml(dadosLoja.nome)}<br>${textoEndereco(dadosLoja.endereco)}</p>
                <p class="pedido-endereco">🏠 <strong>Entrega (Cliente):</strong> ${textoEndereco(pedido.endereco_snapshot)}</p>
                <p class="pedido-distancia">Localizando no mapa...</p>
                <p class="pedido-itens">${textoItens(pedido)}</p>
                <button type="button" class="btn-ver-mapa" hidden>Ver loja no mapa</button>
                <input type="text" class="input-codigo" placeholder="Código da loja (6 dígitos)" maxlength="6" autocapitalize="characters" autocomplete="off" spellcheck="false">
                <button type="button" class="btn-pegar-pedido">Confirmar retirada</button>
            `;

            card.querySelector(".btn-pegar-pedido").addEventListener("click", () => {
                const codigoDigitado = card.querySelector(".input-codigo").value.trim().toUpperCase();
                pegarPedido(docSnap.id, codigoDigitado, pedido.codigo_retirada);
            });

            if (listaDisponiveis) listaDisponiveis.appendChild(card);

            posicionarPedido(docSnap.id, dadosLoja.endereco, card, camadaDisponiveis, COR_DISPONIVEL,
                () => token === tokenDisponiveis);
        }

    }, (erro) => {
        console.error("Erro ao carregar pedidos disponíveis:", erro);
        if (listaDisponiveis) listaDisponiveis.innerHTML = `<p class="empty-message">Erro ao carregar pedidos.</p>`;
    });
}

async function pegarPedido(pedidoId, codigoDigitado, codigoRetiradaEsperado) {
    if (!FORMATO_CODIGO.test(codigoDigitado)) {
        mostrarToast("Digite o código de 6 dígitos informado pelo estabelecimento.", "erro");
        return;
    }

    if (codigoRetiradaEsperado && codigoDigitado !== codigoRetiradaEsperado) {
        mostrarToast("Código do estabelecimento incorreto.", "erro");
        return;
    }

    try {
        await updateDoc(doc(db, "pedidos", pedidoId), {
            entregador_id: usuarioAtual.uid,
            status: "entrega",
            codigo_retirada_informado: codigoDigitado
        });

        mostrarToast("Retirada confirmada!", "sucesso");

    } catch (erro) {
        console.error("Erro ao pegar pedido:", erro);
        mostrarToast("Não foi possível confirmar a retirada.", "erro");
    }
}

// ---------- MINHAS ENTREGAS ----------

function escutarMinhasEntregas() {
    const consulta = query(
        collection(db, "pedidos"),
        where("entregador_id", "==", usuarioAtual.uid),
        where("status", "==", "entrega")
    );

    onSnapshot(consulta, async (resultado) => {
        const token = ++tokenEntregas;
        camadaEntregas.clearLayers();

        if (resultado.empty) {
            if (listaMinhasEntregas) listaMinhasEntregas.innerHTML = `<p class="empty-message">Você não tem entregas em andamento.</p>`;
            return;
        }

        if (listaMinhasEntregas) listaMinhasEntregas.innerHTML = "";

        for (const docSnap of resultado.docs) {
            const pedido = docSnap.data();
            const dadosLoja = await obterDadosLoja(pedido.comerciante_id);

            const card = document.createElement("div");
            card.className = "card-pedido";
            card.dataset.pedidoId = docSnap.id;
            card.innerHTML = `
                <p class="pedido-valor">R$ ${valorFormatado(pedido)}</p>
                <p class="pedido-endereco">📍 <strong>Entregar em:</strong> ${textoEndereco(pedido.endereco_snapshot)}</p>
                <p class="pedido-endereco" style="font-size:12px; color:#777;">Retirado em: ${escaparHtml(dadosLoja.nome)}</p>
                <p class="pedido-distancia">Localizando no mapa...</p>
                <p class="pedido-itens">${textoItens(pedido)}</p>
                <button type="button" class="btn-ver-mapa" hidden>Ver no mapa</button>
                <a class="link-rota" target="_blank" rel="noopener noreferrer" hidden>Abrir rota no Google Maps</a>
                <input type="text" class="input-codigo" placeholder="Código do cliente (6 dígitos)" maxlength="6" autocapitalize="characters" autocomplete="off" spellcheck="false">
                <button type="button" class="btn-entregue">Confirmar entrega</button>
            `;

            card.querySelector(".btn-entregue").addEventListener("click", () => {
                const codigoDigitado = card.querySelector(".input-codigo").value.trim().toUpperCase();
                concluirEntrega(docSnap.id, codigoDigitado, pedido.codigo_entrega);
            });

            if (listaMinhasEntregas) listaMinhasEntregas.appendChild(card);

            posicionarPedido(docSnap.id, pedido.endereco_snapshot, card, camadaEntregas, COR_ENTREGA,
                () => token === tokenEntregas);
        }

    }, (erro) => {
        console.error("Erro ao carregar minhas entregas:", erro);
        if (listaMinhasEntregas) listaMinhasEntregas.innerHTML = `<p class="empty-message">Erro ao carregar entregas.</p>`;
    });
}

async function concluirEntrega(pedidoId, codigoDigitado, codigoEntregaEsperado) {
    if (!FORMATO_CODIGO.test(codigoDigitado)) {
        mostrarToast("Digite o código de 6 dígitos informado pelo cliente.", "erro");
        return;
    }

    if (codigoEntregaEsperado && codigoDigitado !== codigoEntregaEsperado) {
        mostrarToast("Código do cliente incorreto.", "erro");
        return;
    }

    try {
        await updateDoc(doc(db, "pedidos", pedidoId), {
            status: "entregue",
            codigo_entrega_informado: codigoDigitado
        });

        mostrarToast("Entrega confirmada com sucesso!", "sucesso");

    } catch (erro) {
        console.error("Erro ao concluir entrega:", erro);
        mostrarToast("Erro ao confirmar a entrega.", "erro");
    }
}

// ---------- INÍCIO ----------

escutarDisponiveis();
escutarMinhasEntregas();
localizarEntregador();