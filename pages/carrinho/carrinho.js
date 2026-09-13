import { auth, db } from "../../public/firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const listaElemento = document.getElementById("lista-itens");
const resumoElemento = document.getElementById("resumo-carrinho");
const valorTotalElemento = document.getElementById("valor-total");
const botaoFinalizar = document.getElementById("btn-finalizar");

let usuarioAtual = null;
let itensCarrinho = [];


onAuthStateChanged(auth, async (usuario) => {

    if (!usuario) {
        window.location.href = "login.html";
        return;
    }

    usuarioAtual = usuario;
    await carregarCarrinho();
});


async function carregarCarrinho() {

    try {
        const refCarrinho = doc(db, "carrinhos", usuarioAtual.uid);
        const docCarrinho = await getDoc(refCarrinho);

        itensCarrinho = docCarrinho.exists() ? (docCarrinho.data().itens || []) : [];

        renderizarCarrinho();

    } catch (erro) {
        console.error("Erro ao carregar carrinho:", erro);
        listaElemento.innerHTML = `<p class="empty-message">Erro ao carregar o carrinho.</p>`;
    }
}


function renderizarCarrinho() {

    if (itensCarrinho.length === 0) {
        listaElemento.innerHTML = `<p class="empty-message">Seu carrinho está vazio.</p>`;
        resumoElemento.style.display = "none";
        botaoFinalizar.style.display = "none";
        return;
    }

    listaElemento.innerHTML = "";

    itensCarrinho.forEach((item, index) => {

        if (item.selecionado === undefined) {
            item.selecionado = true;
        }

        const subtotal = item.preco * item.quantidade;

        const linha = document.createElement("div");
        linha.className = "item-carrinho";
        linha.innerHTML = `
            <input type="checkbox" class="item-checkbox" data-index="${index}" ${item.selecionado ? "checked" : ""}>

            <div class="item-info">
                <p class="item-nome">${item.nome}</p>
                <p class="item-detalhe">Qtd: ${item.quantidade} × R$ ${item.preco.toFixed(2)}</p>
            </div>

            <div class="item-acoes">
                <span class="item-subtotal">R$ ${subtotal.toFixed(2)}</span>
                <button type="button" class="btn-carrinho-excluir" data-index="${index}">Remover</button>
            </div>
        `;

        linha.querySelector(".item-checkbox").addEventListener("change", (evento) => {
            alternarSelecao(index, evento.target.checked);
        });

        linha.querySelector("button").addEventListener("click", () => removerItem(index));

        listaElemento.appendChild(linha);
    });

    atualizarTotal();
    resumoElemento.style.display = "block";
    botaoFinalizar.style.display = "block";
}


function atualizarTotal() {

    const total = itensCarrinho
        .filter((item) => item.selecionado)
        .reduce((soma, item) => soma + (item.preco * item.quantidade), 0);

    valorTotalElemento.textContent = `R$ ${total.toFixed(2)}`;

    const algumSelecionado = itensCarrinho.some((item) => item.selecionado);
    botaoFinalizar.disabled = !algumSelecionado;
}


async function salvarCarrinho() {

    const refCarrinho = doc(db, "carrinhos", usuarioAtual.uid);
    await setDoc(refCarrinho, {
        itens: itensCarrinho,
        atualizado_em: new Date()
    });
}


async function alternarSelecao(index, selecionado) {

    itensCarrinho[index].selecionado = selecionado;
    atualizarTotal();

    try {
        await salvarCarrinho();
    } catch (erro) {
        console.error("Erro ao salvar seleção:", erro);
    }
}


async function removerItem(index) {

    itensCarrinho.splice(index, 1);

    try {
        await salvarCarrinho();
        renderizarCarrinho();
    } catch (erro) {
        console.error("Erro ao remover item:", erro);
        alert("Não foi possível remover o item.");
    }
}


botaoFinalizar.addEventListener("click", () => {

    const itensSelecionados = itensCarrinho.filter((item) => item.selecionado);

    if (itensSelecionados.length === 0) {
        alert("Selecione ao menos um item para finalizar o pedido.");
        return;
    }

    // Checkout (endereço + criação do pedido) vem na próxima etapa
    alert("Próximo passo: checkout com endereço (ainda não implementado).");
});