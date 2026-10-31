import { db } from "../../public/firebase-config.js";
import { protegerPagina } from "../shared/guarda.js";
import { escaparHtml } from "../shared/html.js";

import {
    collection,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const containerPedidos = document.getElementById("pedidos-container");

const { usuario } = await protegerPagina({ tipos: ["cliente"] });
const usuarioAtual = usuario;

escutarMeusPedidos();

function escutarMeusPedidos() {
    if (!containerPedidos) return;

    containerPedidos.innerHTML = `<p class="empty-message">Carregando seus pedidos...</p>`;

    const consulta = query(
        collection(db, "pedidos"),
        where("cliente_id", "==", usuarioAtual.uid)
    );

    onSnapshot(consulta, (snapshot) => {
        if (snapshot.empty) {
            containerPedidos.innerHTML = `<p class="empty-message">Você ainda não realizou nenhum pedido.</p>`;
            return;
        }

        containerPedidos.innerHTML = "";

        const docsOrdenados = snapshot.docs.sort((a, b) => {
            const dataA = a.data().data_hora_pedido?.toDate?.() || new Date(0);
            const dataB = b.data().data_hora_pedido?.toDate?.() || new Date(0);
            return dataB - dataA;
        });

        docsOrdenados.forEach((docSnap) => {
            const pedido = docSnap.data();
            const card = criarCardPedido(docSnap.id, pedido);
            containerPedidos.appendChild(card);
        });

    }, (erro) => {
        console.error("Erro ao carregar pedidos do cliente:", erro);
        containerPedidos.innerHTML = `<p class="empty-message">Não foi possível carregar seus pedidos.</p>`;
    });
}

function criarCardPedido(id, pedido) {
    const card = document.createElement("div");
    card.className = "pedido-card";

    const dataObj = pedido.data_hora_pedido?.toDate ? pedido.data_hora_pedido.toDate() : null;
    const dataFormatada = dataObj 
        ? dataObj.toLocaleDateString("pt-BR") 
        : "";

    const MAPPING_STATUS = {
        aguardando_confirmacao: { classe: "aguardando", texto: "Aguardando confirmação" },
        preparo: { classe: "preparo", texto: "Em preparo" },
        entrega: { classe: "entrega", texto: "Saiu para entrega" },
        entregue: { classe: "entregue", texto: "Entregue" }
    };

    const statusAtual = MAPPING_STATUS[pedido.status] || { 
        classe: "aguardando", 
        texto: pedido.status 
    };

    const itensTexto = (pedido.itens || []).map((item) => {
        return `${escaparHtml(item.quantidade)}x ${escaparHtml(item.nome)}`;
    }).join(", ");

    const valorTotal = Number(pedido.valor_total || 0).toFixed(2).replace(".", ",");
    
    const codigoEntrega = pedido.codigo_entrega;
    const deveExibirCodigo = (pedido.status === "preparo" || pedido.status === "entrega") && codigoEntrega;

    card.innerHTML = `
        <div class="pedido-topo">
            <h2>Pedido</h2>
            <span class="status ${statusAtual.classe}">${escaparHtml(statusAtual.texto)}</span>
        </div>

        <div class="pedido-info">
            ${dataFormatada ? `<p><strong>Data:</strong> ${dataFormatada}</p>` : ''}
            <p><strong>Itens:</strong> ${itensTexto || "Nenhum item"}</p>
            <p><strong>Loja:</strong> ${escaparHtml(pedido.nome_loja || "Hortifruti dantas")}</p>
            <p class="pedido-valor"><strong>Total:</strong> R$ ${valorTotal}</p>
        </div>

        ${deveExibirCodigo ? `
            <div class="codigo-entrega">
                Informe este código ao entregador: <strong>${escaparHtml(codigoEntrega)}</strong>
            </div>
        ` : ''}
    `;

    return card;
}