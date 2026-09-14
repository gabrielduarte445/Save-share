import { auth, db } from "../../public/firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
    addDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const listaElemento = document.getElementById("lista-itens");
const resumoElemento = document.getElementById("resumo-carrinho");
const valorTotalElemento = document.getElementById("valor-total");
const botaoFinalizar = document.getElementById("btn-finalizar");
const enderecoCheckout = document.getElementById("endereco-checkout");
const enderecoComElemento = document.getElementById("endereco-checkout-com");
const enderecoSemElemento = document.getElementById("endereco-checkout-sem");
const enderecoSelecionadoTexto = document.getElementById("endereco-selecionado-texto");
const botaoTrocarEndereco = document.getElementById("btn-trocar-endereco");
const botaoAddEndereco = document.getElementById("btn-add-endereco");

let enderecoEscolhido = null;
let usuarioAtual = null;
let itensCarrinho = [];


onAuthStateChanged(auth, async (usuario) => {

    if (!usuario) {
        window.location.href = "login.html";
        return;
    }

    usuarioAtual = usuario;
    await carregarCarrinho();
    await carregarEndereco();
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
async function carregarEndereco() {

    try {
        const enderecosRef = collection(db, "enderecos");
        const consulta = query(enderecosRef, where("usuario_id", "==", usuarioAtual.uid));
        const resultado = await getDocs(consulta);

        if (resultado.empty) {
            mostrarSemEndereco();
            return;
        }

        let escolhido = resultado.docs.find((d) => d.data().padrao);
        if (!escolhido) {
            escolhido = resultado.docs[0];
        }

        enderecoEscolhido = { id: escolhido.id, ...escolhido.data() };
        mostrarComEndereco(enderecoEscolhido);

    } catch (erro) {
        console.error("Erro ao carregar endereço:", erro);
        mostrarSemEndereco();
    }
}


function mostrarComEndereco(endereco) {
    enderecoCheckout.style.display = "block";
    enderecoComElemento.style.display = "block";
    enderecoSemElemento.style.display = "none";

    enderecoSelecionadoTexto.textContent =
        `${endereco.logradouro}, ${endereco.numero} - ${endereco.bairro}, ${endereco.cidade}/${endereco.estado}`;
}


function mostrarSemEndereco() {
    enderecoCheckout.style.display = "block";
    enderecoComElemento.style.display = "none";
    enderecoSemElemento.style.display = "block";

    enderecoEscolhido = null;
}


botaoAddEndereco.addEventListener("click", () => {
    window.location.href = "/cadastro_clienteendereco.html?retorno=checkout";
});

botaoTrocarEndereco.addEventListener("click", () => {
    window.location.href = "/meus-enderecos.html?retorno=checkout";
});

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
        return
    };

// Simplificação inicial: assume que todos os itens são do mesmo comerciante
        const comercianteId = itensSelecionados[0].comerciante_id;

        const pedidosRef = collection(db, "pedidos");
        await addDoc(pedidosRef,{
            cliente_id: usuarioAtual.uid,
            comerciante_id: comercianteId,
            itens: itensSelecionados,
            endereco_id: enderecoEscolhido.id,
            endereco_snapshot: {
                logradouro: enderecoEscolhido.logradouro,
                numero: enderecoEscolhido.numero,
                bairro: enderecoEscolhido.bairro,
                cidade: enderecoEscolhido.cidade,
                estado: enderecoEscolhido.estado,
                cep: enderecoEscolhido.cep
            },
            data_hora_pedido: new Date(),
            valor_total: valorTotal,
            tipo_entrega: "entrega",
            status: "postado"
        });

        // Remove do carrinho só os itens que foram comprados
        itensCarrinho = itensCarrinho.filter((item) => !item.selecionado);

        const refCarrinho = doc(db, "carrinhos", usuarioAtual.uid);
        if (itensCarrinho.length === 0) {
            await deleteDoc(refCarrinho);
        } else {
            await setDoc(refCarrinho, { itens: itensCarrinho, atualizado_em: new Date() });
        }

        alert("Pedido realizado com sucesso!");
        window.location.href = "/home.html";

    } catch(erro) {
        console.error("Erro ao finalizar pedido:",erro);
        alert("Não foi possível finalizar o pedido. Tente novamente.");
        botaoFinalizar.disabled = false;
        botaoFinalizar.textContent = "Finalizar Pedido";
    }
    //erro na linha 263 no catch(ainda nao diagnosticado)