import { auth, db } from "/public/firebase-config.js";
import { mostrarToast, confirmarAcao } from "../shared/toast.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    updateDoc,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const gridPedidos = document.getElementById("grid-pedidos");

let usuarioAtual = null;

// O comerciante só controla estas duas etapas — o restante é
// responsabilidade do Entregador.
const STATUS_INFO = {
    aguardando_confirmacao: { classe: "status-aguardando", texto: "Aguardando confirmação" },
    preparo:  { classe: "status-preparo",  texto: "Em preparo" },
    entrega:  { classe: "status-entrega",  texto: "Saiu para entrega" },
    entregue: { classe: "status-entregue", texto: "Entregue" }
};


onAuthStateChanged(auth, async (usuario) => {

    if (!usuario) {
        window.location.href = "/public/login.html";
        return;
    }

    usuarioAtual = usuario;
    await carregarPedidos();
});


async function carregarPedidos() {

    gridPedidos.innerHTML = `<p class="empty-message">Carregando pedidos...</p>`;

    try {
        const pedidosRef = collection(db, "pedidos");
        const consulta = query(pedidosRef, where("comerciante_id", "==", usuarioAtual.uid));
        const resultado = await getDocs(consulta);

        if (resultado.empty) {
            gridPedidos.innerHTML = `<p class="empty-message">Você ainda não recebeu nenhum pedido.</p>`;
            return;
        }

        const pedidosOrdenados = resultado.docs.sort((a, b) => {
            const dataA = a.data().data_hora_pedido?.toDate?.() || new Date(0);
            const dataB = b.data().data_hora_pedido?.toDate?.() || new Date(0);
            return dataB - dataA;
        });

        gridPedidos.innerHTML = "";

        const cacheClientes = {};

        for (const docSnap of pedidosOrdenados) {
            const pedido = docSnap.data();

            let nomeCliente = cacheClientes[pedido.cliente_id];

            if (!nomeCliente) {
                try {
                    const refCliente = doc(db, "usuarios", pedido.cliente_id);
                    const docCliente = await getDoc(refCliente);
                    nomeCliente = docCliente.exists() ? (docCliente.data().nome || "Cliente") : "Cliente";
                } catch {
                    nomeCliente = "Cliente";
                }
                cacheClientes[pedido.cliente_id] = nomeCliente;
            }

            const card = criarCardPedido(docSnap.id, pedido, nomeCliente);
            gridPedidos.appendChild(card);
        }

    } catch (erro) {
        console.error("Erro ao carregar pedidos:", erro);
        gridPedidos.innerHTML = `<p class="empty-message">Não foi possível carregar os pedidos.</p>`;
    }
}


function criarCardPedido(id, pedido, nomeCliente) {

    const statusAtual = STATUS_INFO[pedido.status] || STATUS_INFO.aguardando_confirmacao;

    const dataFormatada = pedido.data_hora_pedido?.toDate
        ? pedido.data_hora_pedido.toDate().toLocaleString("pt-BR", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit"
          })
        : "";

    const itensHtml = pedido.itens.map((item) => {
        const subtotal = (item.preco * item.quantidade).toFixed(2);
        return `<li><span>${item.quantidade}x ${item.nome}</span><span>R$ ${subtotal}</span></li>`;
    }).join("");

    const card = document.createElement("div");
    card.className = "card-pedido";

    // Comerciante só pode escolher entre as duas primeiras etapas
    const podeEditar = pedido.status === "aguardando_confirmacao" || pedido.status === "preparo";

    card.innerHTML = `
        <div class="card-pedido-topo">
            <div>
                <div class="cliente-nome">${nomeCliente}</div>
                <div class="pedido-data">${dataFormatada}</div>
            </div>
            <span class="status-badge ${statusAtual.classe}">${statusAtual.texto}</span>
        </div>

        <div class="card-pedido-itens">
            Itens do pedido:
            <ul>${itensHtml}</ul>
        </div>

        <div class="pedido-total">
            <span>Total</span>
            <span>R$ ${Number(pedido.valor_total).toFixed(2)}</span>
        </div>

        ${podeEditar ? `
        <div class="status-controle">
            <label for="status-${id}">Status do pedido</label>
            <select class="select-status" id="status-${id}">
                <option value="aguardando_confirmacao" ${pedido.status === "aguardando_confirmacao" ? "selected" : ""}>Aguardando confirmação</option>
                <option value="preparo" ${pedido.status === "preparo" ? "selected" : ""}>Em preparo</option>
            </select>
        </div>
        ` : `
        <p style="font-size:13px; color:#888888;">Este pedido já está com o entregador.</p>
        `}
    `;

    const select = card.querySelector(".select-status");
    if (select) {
        select.addEventListener("change", (evento) => {
            atualizarStatus(id, evento.target.value, card);
        });
    }

    return card;
}


async function atualizarStatus(pedidoId, novoStatus, card) {

    const badge = card.querySelector(".status-badge");
    const info = STATUS_INFO[novoStatus];

    try {
        const refPedido = doc(db, "pedidos", pedidoId);
        await updateDoc(refPedido, { status: novoStatus });

        badge.classList.remove("status-aguardando", "status-preparo", "status-entrega", "status-entregue");
        badge.classList.add(info.classe);
        badge.textContent = info.texto;

    } catch (erro) {
        console.error("Erro ao atualizar status:", erro);
        mostrarToast("Não foi possível atualizar o status. Tente novamente.","erro");
    }
}