import { auth, db } from "../../public/firebase-config.js";
import { protegerPagina } from "../shared/guarda.js";
import { mostrarToast, confirmarAcao } from "../shared/toast.js";
import { prepararImagem } from "../shared/imagem.js";

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

const campoFoto = document.getElementById("produto-foto");
const previewFoto = document.getElementById("preview-foto");
const botaoRemoverFoto = document.getElementById("btn-remover-foto");

let imagemAtual = null;   // base64 do JPEG, ou null

let usuarioAtual = null;

// PROTEÇÃO DE ROTA + CARREGAMENTO INICIAL
const { usuario } = await protegerPagina({ tipos: ["comerciante"] });
usuarioAtual = usuario;

await carregarProdutos();

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

    if (produto.imagem) {
        const img = document.createElement("img");
        img.src = `data:image/jpeg;base64,${produto.imagem}`;
        img.alt = produto.nome;
        img.loading = "lazy";
        card.querySelector(".imagem-produto").replaceChildren(img);
    }

    card.querySelector(".btn-editar").addEventListener("click", () => abrirModalEdicao(id, produto));
    card.querySelector(".btn-excluir").addEventListener("click", () => excluirProduto(id));

    return card;
}

function mostrarPreview(base64) {

    previewFoto.replaceChildren();

    if (base64) {
        const img = document.createElement("img");
        img.src = `data:image/jpeg;base64,${base64}`;
        img.alt = "Prévia da foto do produto";
        previewFoto.appendChild(img);
        botaoRemoverFoto.style.display = "inline-block";
    } else {
        const texto = document.createElement("span");
        texto.textContent = "Sem foto";
        previewFoto.appendChild(texto);
        botaoRemoverFoto.style.display = "none";
    }
}


campoFoto.addEventListener("change", async () => {

    const arquivo = campoFoto.files[0];
    if (!arquivo) return;

    try {
        imagemAtual = await prepararImagem(arquivo);
        mostrarPreview(imagemAtual);

    } catch (erro) {
        const mensagens = {
            "tipo-invalido": "Use uma imagem JPG, PNG ou WebP.",
            "arquivo-grande": "A imagem é muito grande (máximo de 10 MB).",
            "imagem-invalida": "Não foi possível abrir essa imagem.",
            "nao-reduziu": "Não foi possível reduzir essa imagem. Tente outra."
        };
        mostrarToast(mensagens[erro.message] || "Não foi possível usar essa imagem.", "erro");

    } finally {
        campoFoto.value = "";
    }
});


botaoRemoverFoto.addEventListener("click", () => {
    imagemAtual = null;
    mostrarPreview(null);
});

function abrirModalNovo() {
    modalTitulo.textContent = "Adicionar Produto";
    campoId.value = "";
    formulario.reset();
    imagemAtual = null;
    mostrarPreview(null);
    modal.style.display = "flex";
}


function abrirModalEdicao(id, produto) {

    modalTitulo.textContent = "Editar Produto";

    campoId.value = id;
    campoNome.value = produto.nome || "";
    campoDescricao.value = produto.descricao || "";
    campoValor.value = produto.valor || "";
    campoEstoque.value = produto.estoque || "";

    imagemAtual = produto.imagem || null;
    mostrarPreview(imagemAtual);

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
    imagemAtual = null;
    mostrarPreview(null);
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
        mostrarToast("Preencha todos os campos corretamente.", "erro");
        return;
    }

    const checklistCompleto =
        checkMofo.checked &&
        checkFuros.checked &&
        checkOdor.checked &&
        checkTextura.checked &&
        checkConsumo.checked;

    if (!checklistCompleto) {
        mostrarToast("Confirme todos os itens da verificação de consumo antes de salvar.", "erro");
        return;
    }

    const dadosProduto = {
        comerciante_id: usuarioAtual.uid,
        nome: nome,
        descricao: descricao,
        valor: valor,
        estoque: estoque,
        imagem: imagemAtual,
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
            const produtoRef = doc(db, "produtos", idExistente);
            await updateDoc(produtoRef, dadosProduto);
            mostrarToast("Produto atualizado com sucesso!", "sucesso");
        } else {
            const produtosRef = collection(db, "produtos");
            await addDoc(produtosRef, dadosProduto);
            mostrarToast("Produto cadastrado com sucesso!", "sucesso");
        }

        fecharModal();
        await carregarProdutos();

    } catch (erro) {
        console.error("Erro ao salvar produto:", erro);
        mostrarToast("Não foi possível salvar o produto.", "erro");
    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar";
    }
});