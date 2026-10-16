import { auth, db } from "../../public/firebase-config.js";
import { protegerPagina } from "../shared/guarda.js";

import {
    collection,
    doc,
    getDoc,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const container = document.getElementById("pedidos-container");

const STATUS_INFO = {
    aguardando_confirmacao: { classe: "aguardando", texto: "Aguardando confirmação" },
    preparo:  { classe: "preparo",  texto: "Em preparo" },
    entrega:  { classe: "entrega",  texto: "Saiu para entrega" },
    entregue: { classe: "entregue", texto: "Entregue" }
};

const cacheLojas = {};


const { usuario } = await protegerPagina({ tipos: ["cliente"] });
const usuarioAtual = usuario;

escutarPedidos();


function escutarPedidos() {
    const pedidosRef = collection(db, "pedidos");
    const consulta = query(pedidosRef, where("cliente_id", "===", usuarioAtual.uid));

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

        const cards = [];

        for (const docSnap of pedidosOrdenados) {
            cards.push(await criarCardPedido(docSnap.id, docSnap.data()));
        }

        container.innerHTML = "";
        cards.forEach((card) => container.appendChild(card));

    }, (erro) => {
        console.error("Erro ao escutar pedidos:", erro);
        container.innerHTML = `<p class="empty-message">Não foi possível carregar seus pedidos.</p>`;
    });
}


async function criarCardPedido(id, pedido) {
    const statusInfo = STATUS_INFO[pedido.status] || STATUS_INFO.aguardando_confirmacao;

    const dataFormatada = pedido.data_hora_pedido?.toDate
        ? pedido.data_hora_pedido.toDate().toLocaleDateString("pt-BR")
        : "";

    const itensTexto = pedido.itens.map((item) => `${item.quantidade}x ${item.nome}`).join(", ");

    let nomeLoja = cacheLojas[pedido.comerciante_id];

    if (!nomeLoja) {
        try {
            const refLoja = doc(db, "lojas", pedido.comerciante_id);
            const docLoja = await getDoc(refLoja);
            nomeLoja = docLoja.exists() ? (docLoja.data().nome_loja || "Loja") : "Loja";
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

        ${pedido.status === "entrega" ? `
        <p class="codigo-entrega">
            Informe este código ao entregador: <strong class="valor-codigo-entrega">...</strong>
        </p>
        ` : ""}
    `;

    // Busca o código de entrega (somente o cliente dono do pedido consegue ler)
    const elementoCodigo = card.querySelector(".valor-codigo-entrega");
    if (elementoCodigo) {
        getDoc(doc(db, "pedidos", id, "privado", "codigo_entrega"))
            .then((snap) => {
                elementoCodigo.textContent = snap.exists() ? snap.data().codigo : "indisponível";
            })
            .catch(() => { elementoCodigo.textContent = "indisponível"; });
    }

    return card;
}