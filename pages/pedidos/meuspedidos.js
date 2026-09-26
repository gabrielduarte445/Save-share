import { auth, db } from "/public/firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const container = document.getElementById("pedidos-container");

let usuarioAtual = null;

const STATUS_INFO = {
    aguardando_confirmacao: { classe: "aguardando", texto: "Aguardando confirmação" },
    preparo:  { classe: "preparo",  texto: "Em preparo" },
    entrega:  { classe: "entrega",  texto: "Saiu para entrega" },
    entregue: { classe: "entregue", texto: "Entregue" }
};

const cacheLojas = {};


onAuthStateChanged(auth, (usuario) => {

    if (!usuario) {
        window.location.href = "/public/login.html";
        return;
    }

    usuarioAtual = usuario;
    escutarPedidos();
});


function escutarPedidos() {

    const pedidosRef = collection(db, "pedidos");
    const consulta = query(pedidosRef, where("cliente_id", "==", usuarioAtual.uid));

    // onSnapshot mantém uma conexão aberta: este bloco roda de novo,
    // automaticamente, toda vez que qualquer pedido do cliente mudar
    // no Firestore — seja por ação do comerciante ou do entregador.
    onSnapshot(consulta, async (resultado) => {

        if (resultado.empty) {
            container.innerHTML = `<p class="empty-message">Você ainda não fez nenhum pedido.</p>`;
            return;
        }

        const pedidosOrdenados = resultado.docs.sort((a, b) => {
            const dataA = a.data().data_hora_pedido?.toDate?.() || new Date(0);
            const dataB = b.data().data_hora_pedido?.toDate?.() || new Date(0);
            return dataB - dataA;
        });

        container.innerHTML = "";

        for (const docSnap of pedidosOrdenados) {
            const pedido = docSnap.data();
            const card = await criarCardPedido(pedido);
            container.appendChild(card);
        }

    }, (erro) => {
        console.error("Erro ao escutar pedidos:", erro);
        container.innerHTML = `<p class="empty-message">Não foi possível carregar seus pedidos.</p>`;
    });
}


async function criarCardPedido(pedido) {

    const statusInfo = STATUS_INFO[pedido.status] || STATUS_INFO.aguardando_confirmacao;

    const dataFormatada = pedido.data_hora_pedido?.toDate
        ? pedido.data_hora_pedido.toDate().toLocaleDateString("pt-BR")
        : "";

    const itensTexto = pedido.itens.map((item) => `${item.quantidade}x ${item.nome}`).join(", ");

    // Busca o nome da loja (com cache)
    let nomeLoja = cacheLojas[pedido.comerciante_id];

    if (!nomeLoja) {
        try {
            const refComerciante = doc(db, "usuarios", pedido.comerciante_id);
            const docComerciante = await getDoc(refComerciante);
            nomeLoja = docComerciante.exists() ? (docComerciante.data().nome_loja || "Loja") : "Loja";
        } catch {
            nomeLoja = "Loja";
        }
        cacheLojas[pedido.comerciante_id] = nomeLoja;
    }

    const card = document.createElement("div");
    card.className = "pedido-card";

    card.innerHTML = `
        <div class="pedido-topo">
            <h2>Pedido</h2>
            <span class="status ${statusInfo.classe}">${statusInfo.texto}</span>
        </div>

        <div class="pedido-info">
            <p><strong>Data:</strong> ${dataFormatada}</p>
            <p><strong>Itens:</strong> ${itensTexto}</p>
            <p><strong>Loja:</strong> ${nomeLoja}</p>
            <p class="pedido-valor"><strong>Total:</strong> R$ ${Number(pedido.valor_total).toFixed(2)}</p>
        </div>
    `;

    return card;
}