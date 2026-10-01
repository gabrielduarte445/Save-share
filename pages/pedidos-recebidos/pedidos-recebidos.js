import { auth, db } from "/public/firebase-config.js";

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

        // 1. Identifica todos os IDs de clientes únicos para evitar requisições repetidas
        const clienteIds = [...new Set(pedidosOrdenados.map(doc => doc.data().cliente_id).filter(Boolean))];

        // 2. Busca todos os clientes em paralelo
        const cacheClientes = {};
        await Promise.all(
            clienteIds.map(async (clienteId) => {
                try {
                    const docCliente = await getDoc(doc(db, "usuarios", clienteId));
                    cacheClientes[clienteId] = docCliente.exists() ? (docCliente.data().nome || "Cliente") : "Cliente";
                } catch {
                    cacheClientes[clienteId] = "Cliente";
                }
            })
        );

        // 3. Renderiza a tela rapidamente com os dados prontos
        gridPedidos.innerHTML = "";

        for (const docSnap of pedidosOrdenados) {
            const pedido = docSnap.data();
            const nomeCliente = cacheClientes[pedido.cliente_id] || "Cliente";
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

    const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
    const itensHtml = itens.map((item) => {
        const preco = Number(item.preco) || 0;
        const qtd = Number(item.quantidade) || 0;
        const subtotal = (preco * qtd).toFixed(2);
        return `<li><span>${qtd}x ${item.nome || "Item"}</span><span>R$ ${subtotal}</span></li>`;
    }).join("");

    const totalFormatado = Number(pedido.valor_total || 0).toFixed(2);
    const card = document.createElement("div");
    card.className = "card-pedido";

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
            <span>R$ ${totalFormatado}</span>
        </div>

        ${podeEditar ? `
        <div class="status-controle">
            <label for="status-${id}">Status do pedido</label>
            <select class="select-status" id="status-${id}">
                <option value="aguardando_confirmacao" ${pedido.status === "aguardando_confirmacao" ? "selected" : ""}>Aguardando confirmação</option>
                <option value="preparo" ${pedido.status === "preparo" ? "selected" : ""}>Em preparo</option>
            </select>
        </div>
        ${pedido.status === "preparo" ? `
        <p class="codigo-retirada">
            Código de retirada: <strong>${pedido.codigo_retirada || "N/A"}</strong>
        </p>
        ` : ""}
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
    try {
        const refPedido = doc(db, "pedidos", pedidoId);
        await updateDoc(refPedido, { status: novoStatus });

        // Busca o pedido atualizado para re-renderizar
        const docAtualizado = await getDoc(refPedido);
        if (!docAtualizado.exists()) return;

        const pedidoAtualizado = docAtualizado.data();
        const nomeCliente = card.querySelector(".cliente-nome").textContent;
        
        const novoCard = criarCardPedido(pedidoId, pedidoAtualizado, nomeCliente);
        card.replaceWith(novoCard);

    } catch (erro) {
        console.error("Erro ao atualizar status:", erro);
        alert("Não foi possível atualizar o status. Tente novamente.");
    }
}