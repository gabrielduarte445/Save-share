import { auth, db } from "/public/firebase-config.js";
import { mostrarToast } from "/pages/shared/toast.js";

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

const FORMATO_CODIGO = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
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
                <input type="text" class="input-codigo" placeholder="${placeholder}" maxlength="6" autocapitalize="characters" autocomplete="off" spellcheck="false">
                <button type="button" class="btn-pegar-pedido">Confirmar retirada</button>
            `;

            card.querySelector(".btn-pegar-pedido").addEventListener("click", () => {
                const codigoDigitado = card.querySelector(".input-codigo").value.trim().toUpperCase();
                pegarPedido(docSnap.id, codigoDigitado);
            });

            listaDisponiveis.appendChild(card);
        });

    }, (erro) => {
        console.error("Erro ao carregar pedidos disponíveis:", erro);
        listaDisponiveis.innerHTML = `<p class="empty-message">Erro ao carregar pedidos.</p>`;
    });
}


async function pegarPedido(pedidoId, codigoDigitado) {

    if (!/^\d{6}$/.test(codigoDigitado)) {
        mostrarToast("Digite o código de 6 dígitos informado pelo estabelecimento.", "erro");
        return;
    }

    try {
        const refPedido = doc(db, "pedidos", pedidoId);
        await updateDoc(refPedido, {
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
                <input type="text" class="input-codigo" placeholder="Código do cliente (6 dígitos)" maxlength="6" inputmode="numeric">
                <button type="button" class="btn-entregue">Confirmar entrega</button>
            `;

            card.querySelector(".btn-entregue").addEventListener("click", () => {
                const codigoDigitado = card.querySelector(".input-codigo").value.trim();
                concluirEntrega(docSnap.id, codigoDigitado);
            });

            listaMinhasEntregas.appendChild(card);
        });

    }, (erro) => {
        console.error("Erro ao carregar minhas entregas:", erro);
        listaMinhasEntregas.innerHTML = `<p class="empty-message">Erro ao carregar entregas.</p>`;
    });
}


async function concluirEntrega(pedidoId, codigoDigitado) {

    if (!/^\d{6}$/.test(codigoDigitado)) {
        mostrarToast("Digite o código de 6 dígitos informado pelo cliente.", "erro");
        return;
    }

    try {
        const refPedido = doc(db, "pedidos", pedidoId);
        await updateDoc(refPedido, {
            status: "entregue",
            codigo_entrega_informado: codigoDigitado
        });

        mostrarToast("Entrega confirmada!", "sucesso");

    } catch (erro) {
        console.error("Erro ao concluir entrega:", erro);
        mostrarToast("Código incorreto.", "erro");
    }
}