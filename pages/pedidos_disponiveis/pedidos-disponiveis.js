import { auth, db } from "/public/firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    doc,
    updateDoc,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const listaDisponiveis = document.getElementById("lista-disponiveis");
const listaMinhasEntregas = document.getElementById("lista-minhas-entregas");

let usuarioAtual = null;


onAuthStateChanged(auth, (usuario) => {

    if (!usuario) {
        window.location.href = "/public/login.html";
        return;
    }

    usuarioAtual = usuario;
    escutarDisponiveis();
    escutarMinhasEntregas();
});


function escutarDisponiveis() {

    const pedidosRef = collection(db, "pedidos");
    const consulta = query(
        pedidosRef,
        where("status", "==", "preparo"),
        where("entregador_id", "==", null)
    );

    onSnapshot(consulta, (resultado) => {

        if (resultado.empty) {
            listaDisponiveis.innerHTML = `<p class="empty-message">Nenhum pedido disponível no momento.</p>`;
            return;
        }

        listaDisponiveis.innerHTML = "";

        resultado.docs.forEach((docSnap) => {
            const pedido = docSnap.data();
            const itensTexto = pedido.itens.map((item) => `${item.quantidade}x ${item.nome}`).join(", ");

            const card = document.createElement("div");
            card.className = "card-pedido";
            card.innerHTML = `
                <p class="pedido-valor">R$ ${Number(pedido.valor_total).toFixed(2)}</p>
                <p class="pedido-endereco">
                    📍 ${pedido.endereco_snapshot.logradouro}, ${pedido.endereco_snapshot.numero} -
                    ${pedido.endereco_snapshot.bairro}, ${pedido.endereco_snapshot.cidade}/${pedido.endereco_snapshot.estado}
                </p>
                <p class="pedido-itens">${itensTexto}</p>
                <button type="button" class="btn-pegar-pedido">Pegar este pedido</button>
            `;

            card.querySelector(".btn-pegar-pedido").addEventListener("click", () => pegarPedido(docSnap.id));
            listaDisponiveis.appendChild(card);
        });

    }, (erro) => {
        console.error("Erro ao carregar pedidos disponíveis:", erro);
        listaDisponiveis.innerHTML = `<p class="empty-message">Erro ao carregar pedidos.</p>`;
    });
}


async function pegarPedido(pedidoId) {

    try {
        const refPedido = doc(db, "pedidos", pedidoId);
        await updateDoc(refPedido, {
            entregador_id: usuarioAtual.uid,
            status: "entrega"
        });

    } catch (erro) {
        console.error("Erro ao pegar pedido:", erro);
        alert("Não foi possível pegar este pedido. Talvez outro entregador já tenha pegado.");
    }
}


function escutarMinhasEntregas() {

    const pedidosRef = collection(db, "pedidos");
    const consulta = query(
        pedidosRef,
        where("entregador_id", "==", usuarioAtual.uid),
        where("status", "==", "entrega")
    );

    onSnapshot(consulta, (resultado) => {

        if (resultado.empty) {
            listaMinhasEntregas.innerHTML = `<p class="empty-message">Você não tem entregas em andamento.</p>`;
            return;
        }

        listaMinhasEntregas.innerHTML = "";

        resultado.docs.forEach((docSnap) => {
            const pedido = docSnap.data();
            const itensTexto = pedido.itens.map((item) => `${item.quantidade}x ${item.nome}`).join(", ");

            const card = document.createElement("div");
            card.className = "card-pedido";
            card.innerHTML = `
                <p class="pedido-valor">R$ ${Number(pedido.valor_total).toFixed(2)}</p>
                <p class="pedido-endereco">
                    📍 ${pedido.endereco_snapshot.logradouro}, ${pedido.endereco_snapshot.numero} -
                    ${pedido.endereco_snapshot.bairro}, ${pedido.endereco_snapshot.cidade}/${pedido.endereco_snapshot.estado}
                </p>
                <p class="pedido-itens">${itensTexto}</p>
                <button type="button" class="btn-entregue">Marcar como entregue</button>
            `;

            card.querySelector(".btn-entregue").addEventListener("click", () => marcarEntregue(docSnap.id));
            listaMinhasEntregas.appendChild(card);
        });

    }, (erro) => {
        console.error("Erro ao carregar minhas entregas:", erro);
        listaMinhasEntregas.innerHTML = `<p class="empty-message">Erro ao carregar entregas.</p>`;
    });
}


async function marcarEntregue(pedidoId) {

    const confirmar = confirm("Confirma que este pedido foi entregue?");
    if (!confirmar) return;

    try {
        const refPedido = doc(db, "pedidos", pedidoId);
        await updateDoc(refPedido, { status: "entregue" });

    } catch (erro) {
        console.error("Erro ao marcar como entregue:", erro);
        alert("Não foi possível atualizar o pedido.");
    }
}