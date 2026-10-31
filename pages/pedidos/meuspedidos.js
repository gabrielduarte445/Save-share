import { db } from "../../public/firebase-config.js";
import { protegerPagina } from "../shared/guarda.js";
import { escaparHtml } from "../shared/html.js";

import {
    collection,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const containerPedidos = document.getElementById("grid-pedidos") || document.getElementById("lista-pedidos");

// Proteger a página apenas para o tipo cliente
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

        // Ordenar os pedidos do mais recente para o mais antigo
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
        containerPedidos.innerHTML = `<p class="empty-message">Erro ao carregar seus pedidos.</p>`;
    });
}

function criarCardPedido(id, pedido) {
    const card = document.createElement("div");
    card.className = "card-pedido";

    // Formatação da data do pedido
    const dataObj = pedido.data_hora_pedido?.toDate ? pedido.data_hora_pedido.toDate() : null;
    const dataFormatada = dataObj 
        ? dataObj.toLocaleDateString("pt-BR") 
        : "Data indisponível";

    // Mapeamento de status para exibição
    const labelsStatus = {
        aguardando_confirmacao: "Aguardando confirmação",
        preparo: "Em preparo",
        entrega: "Saiu para entrega",
        entregue: "Entregue"
    };

    const statusTexto = labelsStatus[pedido.status] || pedido.status;

    // Formatação da lista de itens
    const itensTexto = (pedido.itens || []).map((item) => {
        return `${escaparHtml(item.quantidade)}x ${escaparHtml(item.nome)}`;
    }).join(", ");

    const valorTotal = Number(pedido.valor_total || 0).toFixed(2).replace(".", ",");

    // LER O CÓDIGO DIRETO DA RAIZ DO DOCUMENTO (codigo_entrega)
    const codigoEntrega = pedido.codigo_entrega;
    const deveExibirCodigo = (pedido.status === "preparo" || pedido.status === "entrega") && codigoEntrega;

    const blocoCodigoHtml = deveExibirCodigo ? `
        <div class="codigo-retirada" style="margin-top: 12px; background-color: #e3f0fd; color: #1565c0; border: 1px solid #bbdefb; border-radius: 8px; padding: 12px; text-align: center;">
            <span style="font-size: 13px; font-weight: 600;">Informe este código ao entregador:</span><br>
            <strong style="font-size: 22px; letter-spacing: 4px; color: #0d47a1;">${escaparHtml(codigoEntrega)}</strong>
        </div>
    ` : "";

    card.innerHTML = `
        <div class="card-pedido-topo">
            <div>
                <div class="cliente-nome">Pedido</div>
                <div class="pedido-data">Data: ${dataFormatada}</div>
            </div>
            <span class="status-badge status-${escaparHtml(pedido.status)}">
                ${escaparHtml(statusTexto)}
            </span>
        </div>

        <div class="card-pedido-itens">
            <p><strong>Itens:</strong> ${itensTexto || "Nenhum item"}</p>
            <p><strong>Loja:</strong> ${escaparHtml(pedido.nome_loja || "Estabelecimento")}</p>
        </div>

        <div class="pedido-total">
            <span>Total:</span>
            <span>R$ ${valorTotal}</span>
        </div>

        ${blocoCodigoHtml}
    `;

    return card;
}