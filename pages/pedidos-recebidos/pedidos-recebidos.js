import { auth, db } from "/public/firebase-config.js";
import { mostrarToast } from "/pages/shared/toast.js";
import { gerarCodigo } from "/pages/shared/codigo.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    query,
    where,
    getDocs,
    writeBatch
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

    // Comerciante só controla as duas primeiras etapas
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
        ${pedido.status === "preparo" ? `
        <p class="codigo-retirada">
            Código de retirada: <strong class="valor-codigo">...</strong>
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

    // Busca o código de retirada (somente o comerciante consegue ler)
    const elementoCodigo = card.querySelector(".valor-codigo");
    if (elementoCodigo) {
        getDoc(doc(db, "pedidos", id, "privado", "codigo"))
            .then((snap) => {
                elementoCodigo.textContent = snap.exists() ? snap.data().codigo : "indisponível";
            })
            .catch(() => { elementoCodigo.textContent = "indisponível"; });
    }

    return card;
}


async function atualizarStatus(pedidoId, novoStatus, card) {

    try {
        const refPedido = doc(db, "pedidos", pedidoId);
        const refCodigo = doc(db, "pedidos", pedidoId, "privado", "codigo");
        const lote = writeBatch(db);

        lote.update(refPedido, { status: novoStatus });

        // O código só é criado uma vez (as regras não permitem alterá-lo).
        if (novoStatus === "preparo") {
            const codigoExistente = await getDoc(refCodigo);
            if (!codigoExistente.exists()) {
                lote.set(refCodigo, { codigo: gerarCodigo() });
            }
        }

        await lote.commit();

        // Redesenha o card já com o novo status (e o código, se for o caso)
        const docAtualizado = await getDoc(refPedido);
        const nomeCliente = card.querySelector(".cliente-nome").textContent;
        card.replaceWith(criarCardPedido(pedidoId, docAtualizado.data(), nomeCliente));

    } catch (erro) {
        console.error("Erro ao atualizar status:", erro);
        mostrarToast("Não foi possível atualizar o status. Tente novamente.", "erro");
    }
}