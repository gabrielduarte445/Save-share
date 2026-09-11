import { auth, db } from "../../public/firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const listaProdutos = document.getElementById("lista-produtos");
const mensagemVazia = document.getElementById("mensagem-vazia");
const botaoAdicionar = document.getElementById("btn-adicionar-produto");

const modal = document.getElementById("modal-produto");
const modalTitulo = document.getElementById("modal-titulo");
const botaoFecharModal = document.getElementById("btn-fechar-modal");

const formulario = document.getElementById("form-produto");
const botaoSalvar = document.getElementById("btn-salvar-produto");

const campoId = document.getElementById("produto-id");
const campoNome = document.getElementById("produto-nome");
const campoDescricao = document.getElementById("produto-descricao");
const campoValor = document.getElementById("produto-valor");
const campoEstoque = document.getElementById("produto-estoque");

const checkMofo = document.getElementById("check-mofo");
const checkFuros = document.getElementById("check-furos");
const checkOdor = document.getElementById("check-odor");
const checkTextura = document.getElementById("check-textura");
const checkConsumo = document.getElementById("check-consumo");

let usuarioAtual = null;

// PROTEÇÃO DE ROTA + CARREGAMENTO INICIAL

onAuthStateChanged(auth, async (usuario) => {

    if (!usuario) {
        window.location.href = "/public/login.html";
        return;
    }

    usuarioAtual = usuario;

    await carregarProdutos();
});

// CARREGAR PRODUTOS DO COMERCIANTE LOGADO

async function carregarProdutos() {

    listaProdutos.innerHTML = `<p class="empty-message">Carregando produtos...</p>`;
    mensagemVazia.style.display = "none";

    try {
        const produtosRef = collection(db, "produtos");
        const consulta = query(produtosRef, where("comerciante_id", "==", usuarioAtual.uid));
        const resultado = await getDocs(consulta);

        if (resultado.empty) {
            listaProdutos.innerHTML = "";
            mensagemVazia.style.display = "block";
            return;
        }

        listaProdutos.innerHTML = "";
        mensagemVazia.style.display = "none";

        resultado.docs.forEach((docSnap) => {
            const produto = docSnap.data();
            const card = criarCardProduto(docSnap.id, produto);
            listaProdutos.appendChild(card);
        });

    } catch (erro) {
        console.error("Erro ao carregar produtos:", erro);
        listaProdutos.innerHTML = `<p class="empty-message">Não foi possível carregar seus produtos.</p>`;
    }
}


function criarCardProduto(id, produto) {

    const card = document.createElement("div");
    card.className = "card-produto";

    let classeEstoque = "estoque-disponivel";
    let textoEstoque = `Estoque: ${produto.estoque} unidades`;

    if (produto.estoque === 0) {
        classeEstoque = "estoque-esgotado";
        textoEstoque = "Esgotado";
    } else if (produto.estoque <= 5) {
        classeEstoque = "estoque-baixo";
    }

    card.innerHTML = `
        <div class="imagem-produto">
            <span>Imagem</span>
        </div>

        <div class="informacoes-produto">
            <h3>${produto.nome}</h3>
            <p class="preco">R$ ${Number(produto.valor).toFixed(2).replace(".", ",")}</p>
            <p class="estoque ${classeEstoque}">${textoEstoque}</p>
        </div>

        <div class="acoes">
            <button type="button" class="btn-editar" data-id="${id}">Editar</button>
            <button type="button" class="btn-excluir" data-id="${id}">Excluir</button>
        </div>
    `;

    card.querySelector(".btn-editar").addEventListener("click", () => abrirModalEdicao(id, produto));
    card.querySelector(".btn-excluir").addEventListener("click", () => excluirProduto(id));

    return card;
}



function abrirModalNovo() {
    modalTitulo.textContent = "Adicionar Produto";
    campoId.value = "";
    formulario.reset();
    modal.style.display = "flex";
}


function abrirModalEdicao(id, produto) {

    modalTitulo.textContent = "Editar Produto";

    campoId.value = id;
    campoNome.value = produto.nome || "";
    campoDescricao.value = produto.descricao || "";
    campoValor.value = produto.valor || "";
    campoEstoque.value = produto.estoque || "";

    if (produto.checklist_consumivel) {
        checkMofo.checked = !!produto.checklist_consumivel.sem_mofo;
        checkFuros.checked = !!produto.checklist_consumivel.sem_furos;
        checkOdor.checked = !!produto.checklist_consumivel.sem_odor;
        checkTextura.checked = !!produto.checklist_consumivel.textura_ok;
        checkConsumo.checked = !!produto.checklist_consumivel.proprio_para_consumo;
    }

    modal.style.display = "flex";
}


function fecharModal() {
    modal.style.display = "none";
    formulario.reset();
}


botaoAdicionar.addEventListener("click", abrirModalNovo);
botaoFecharModal.addEventListener("click", fecharModal);

modal.addEventListener("click", (event) => {
    if (event.target === modal) {
        fecharModal();
    }
});



formulario.addEventListener("submit", async (event) => {

    event.preventDefault();

    const nome = campoNome.value.trim();
    const descricao = campoDescricao.value.trim();
    const valor = parseFloat(campoValor.value);
    const estoque = parseInt(campoEstoque.value);
    const idExistente = campoId.value;

    if (!nome || isNaN(valor) || valor < 0 || isNaN(estoque) || estoque < 0) {
        alert("Preencha todos os campos corretamente.");
        return;
    }

    const checklistCompleto =
        checkMofo.checked &&
        checkFuros.checked &&
        checkOdor.checked &&
        checkTextura.checked &&
        checkConsumo.checked;

    if (!checklistCompleto) {
        alert("Confirme todos os itens da verificação de consumo antes de salvar.");
        return;
    }

    const dadosProduto = {
        comerciante_id: usuarioAtual.uid,
        nome: nome,
        descricao: descricao,
        valor: valor,
        estoque: estoque,
        checklist_consumivel: {
            sem_mofo: checkMofo.checked,
            sem_furos: checkFuros.checked,
            sem_odor: checkOdor.checked,
            textura_ok: checkTextura.checked,
            proprio_para_consumo: checkConsumo.checked
        }
    };

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    try {

        if (idExistente) {
            const refProduto = doc(db, "produtos", idExistente);
            await updateDoc(refProduto, dadosProduto);

        } else {
            dadosProduto.data_cadastro = new Date();
            const produtosRef = collection(db, "produtos");
            await addDoc(produtosRef, dadosProduto);
        }

        fecharModal();
        await carregarProdutos();

    } catch (erro) {
        console.error("Erro ao salvar produto:", erro);
        alert("Não foi possível salvar o produto. Tente novamente.");

    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar Produto";
    }
});


async function excluirProduto(id) {

    const confirmar = confirm("Tem certeza que deseja excluir este produto?");
    if (!confirmar) return;

    try {
        await deleteDoc(doc(db, "produtos", id));
        await carregarProdutos();

    } catch (erro) {
        console.error("Erro ao excluir produto:", erro);
        alert("Não foi possível excluir o produto.");
    }
}