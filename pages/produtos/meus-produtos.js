import { auth, db, storage } from "../../public/firebase-config.js";
import { protegerPagina } from "../shared/guarda.js";
import { mostrarToast, confirmarAcao } from "../shared/toast.js";
import { prepararImagem } from "../shared/imagem.js";

import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";
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

// ELEMENTOS DA DOM
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
const blocoChecklist = document.querySelector(".checklist-consumivel");

// Capa da Vitrine
const campoFoto = document.getElementById("produto-foto");
const previewFoto = document.getElementById("preview-foto");
const botaoRemoverFoto = document.getElementById("btn-remover-foto");

// Mídias de Inspeção (Fotos/Vídeos do Lote para o Admin)
const campoMidiasInspecao = document.getElementById("midias-inspecao");
const containerPreviewsInspecao = document.getElementById("lista-previews-inspecao");

let arquivoFotoSelecionado = null;    // File da Capa da Vitrine
let imagemAtualUrl = null;             // URL da Capa existente (edição)
let arquivosInspecao = [];            // Array de Files para inspeção (Fotos/Vídeos)
let usuarioAtual = null;

// PROTEÇÃO DE ROTA + CARREGAMENTO
const { usuario } = await protegerPagina({ tipos: ["comerciante"] });
usuarioAtual = usuario;

await carregarProdutos();

// BUSCAR PRODUTOS DO COMERCIANTE
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
            const card = criarCardProduto(docSnap.id, docSnap.data());
            listaProdutos.appendChild(card);
        });

    } catch (erro) {
        console.error("Erro ao carregar produtos:", erro);
        listaProdutos.innerHTML = `<p class="empty-message">Não foi possível carregar seus produtos.</p>`;
    }
}

// CRIAR CARD DO PRODUTO NA LISTA DO COMERCIANTE
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

    const status = produto.status_verificacao || "aprovado";
    const statusTexto = {
        pendente: "⏳ Aguardando Aprovação",
        aprovado: "✓ Aprovado",
        rejeitado: "✕ Rejeitado"
    };

    const valorFormatado = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(produto.valor || 0);

    card.innerHTML = `
        <div class="imagem-produto">
            <span>Sem capa</span>
        </div>

        <div class="informacoes-produto">
            <span class="status-badge-card status-${status}">${statusTexto[status]}</span>
            <h3>${produto.nome}</h3>
            <p class="preco">${valorFormatado}</p>
            <p class="estoque ${classeEstoque}">${textoEstoque}</p>
        </div>

        <div class="acoes">
            <button type="button" class="btn-editar">Editar</button>
            <button type="button" class="btn-excluir">Excluir</button>
        </div>
    `;

    // Renderiza a Capa da Vitrine
    const urlFoto = produto.foto_url || (produto.imagem ? `data:image/jpeg;base64,${produto.imagem}` : null);
    if (urlFoto) {
        const img = document.createElement("img");
        img.src = urlFoto;
        img.alt = produto.nome;
        img.loading = "lazy";
        card.querySelector(".imagem-produto").replaceChildren(img);
    }

    card.querySelector(".btn-editar").addEventListener("click", () => abrirModalEdicao(id, produto));
    card.querySelector(".btn-excluir").addEventListener("click", () => excluirProduto(id, produto.nome));

    return card;
}

// UPLOADS PARA O FIREBASE STORAGE

// Upload da Capa Comercial
async function uploadFotoCapa(arquivo) {
    if (!arquivo) return null;
    const caminhoRef = ref(storage, `produtos/${usuarioAtual.uid}/${Date.now()}_capa_${arquivo.name}`);
    const snapshot = await uploadBytes(caminhoRef, arquivo);
    return await getDownloadURL(snapshot.ref);
}

// Upload Múltiplo de Mídias para Análise do Admin (Fotos/Vídeos)
async function uploadMidiasInspecao(arquivos) {
    const mídiasEnviadas = [];
    for (const arquivo of arquivos) {
        const timestamp = Date.now();
        const nomeLimpo = arquivo.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const caminhoRef = ref(storage, `inspecao/${usuarioAtual.uid}/${timestamp}_${nomeLimpo}`);
        
        const snapshot = await uploadBytes(caminhoRef, arquivo);
        const url = await getDownloadURL(snapshot.ref);
        
        mídiasEnviadas.push({
            url: url,
            tipo: arquivo.type.startsWith("video/") ? "video" : "imagem",
            nome: arquivo.name
        });
    }
    return mídiasEnviadas;
}

// GERENCIAMENTO DAS PRÉVIAS

// Prévia da Capa
function mostrarPreviewCapa(src) {
    previewFoto.replaceChildren();

    if (src) {
        const img = document.createElement("img");
        img.src = src;
        img.alt = "Prévia da capa";
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
        arquivoFotoSelecionado = arquivo;
        const base64Preview = await prepararImagem(arquivo);
        mostrarPreviewCapa(`data:image/jpeg;base64,${base64Preview}`);
    } catch (erro) {
        mostrarToast("Não foi possível carregar a foto de capa.", "erro");
        arquivoFotoSelecionado = null;
    } finally {
        campoFoto.value = "";
    }
});

botaoRemoverFoto.addEventListener("click", () => {
    arquivoFotoSelecionado = null;
    imagemAtualUrl = null;
    mostrarPreviewCapa(null);
});

// Prévias das Mídias de Inspeção (Admin)
if (campoMidiasInspecao) {
    campoMidiasInspecao.addEventListener("change", () => {
        const novosArquivos = Array.from(campoMidiasInspecao.files);
        arquivosInspecao = [...arquivosInspecao, ...novosArquivos];
        renderizarPreviewsInspecao();
        campoMidiasInspecao.value = "";
    });
}

function renderizarPreviewsInspecao() {
    if (!containerPreviewsInspecao) return;
    containerPreviewsInspecao.replaceChildren();

    arquivosInspecao.forEach((file, index) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "preview-inspecao-item";

        const urlTemp = URL.createObjectURL(file);

        if (file.type.startsWith("video/")) {
            const video = document.createElement("video");
            video.src = urlTemp;
            video.muted = true;
            itemDiv.appendChild(video);
        } else {
            const img = document.createElement("img");
            img.src = urlTemp;
            itemDiv.appendChild(img);
        }

        const btnRemover = document.createElement("button");
        btnRemover.type = "button";
        btnRemover.className = "btn-remover-inspecao";
        btnRemover.innerHTML = "&times;";
        btnRemover.addEventListener("click", () => {
            arquivosInspecao.splice(index, 1);
            renderizarPreviewsInspecao();
        });

        itemDiv.appendChild(btnRemover);
        containerPreviewsInspecao.appendChild(itemDiv);
    });
}

// ABRIR / FECHAR MODAL
function abrirModalNovo() {
    modalTitulo.textContent = "Adicionar Produto";
    campoId.value = "";
    formulario.reset();
    
    arquivoFotoSelecionado = null;
    imagemAtualUrl = null;
    arquivosInspecao = [];
    
    mostrarPreviewCapa(null);
    renderizarPreviewsInspecao();

    if (blocoChecklist) blocoChecklist.style.display = "block";
    modal.style.display = "flex";
}

function abrirModalEdicao(id, produto) {
    modalTitulo.textContent = "Editar Produto";

    campoId.value = id;
    campoNome.value = produto.nome || "";
    campoDescricao.value = produto.descricao || "";
    campoValor.value = produto.valor || "";
    campoEstoque.value = produto.estoque || "";

    arquivoFotoSelecionado = null;
    imagemAtualUrl = produto.foto_url || null;
    arquivosInspecao = [];

    mostrarPreviewCapa(imagemAtualUrl || (produto.imagem ? `data:image/jpeg;base64,${produto.imagem}` : null));
    renderizarPreviewsInspecao();

    if (blocoChecklist) blocoChecklist.style.display = "none";
    modal.style.display = "flex";
}

function fecharModal() {
    modal.style.display = "none";
    formulario.reset();
    arquivoFotoSelecionado = null;
    imagemAtualUrl = null;
    arquivosInspecao = [];
    mostrarPreviewCapa(null);
    renderizarPreviewsInspecao();
}

botaoAdicionar.addEventListener("click", abrirModalNovo);
botaoFecharModal.addEventListener("click", fecharModal);
modal.addEventListener("click", (e) => { if (e.target === modal) fecharModal(); });

// SUBMIT DO FORMULÁRIO DE PRODUTO
formulario.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nome = campoNome.value.trim();
    const descricao = campoDescricao.value.trim();
    const valor = parseFloat(campoValor.value);
    const estoque = parseInt(campoEstoque.value, 10);
    const idExistente = campoId.value;

    if (!nome || isNaN(valor) || valor < 0 || isNaN(estoque) || estoque < 0) {
        mostrarToast("Preencha todos os campos corretamente.", "erro");
        return;
    }

    // Validação do Checklist e Mídias de Inspeção para novos cadastros
    if (!idExistente) {
        const checklistValido =
            checkMofo.checked &&
            checkFuros.checked &&
            checkOdor.checked &&
            checkTextura.checked &&
            checkConsumo.checked;

        if (!checklistValido) {
            mostrarToast("Confirme todos os itens da verificação de consumo.", "erro");
            return;
        }

        if (arquivosInspecao.length === 0) {
            mostrarToast("Anexe ao menos 1 foto ou vídeo do lote para análise do Admin.", "erro");
            return;
        }
    }

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Enviando mídias e salvando...";

    try {
        // 1. Upload da Capa (Vitrine do cliente)
        let fotoCapaFinal = imagemAtualUrl;
        if (arquivoFotoSelecionado) {
            fotoCapaFinal = await uploadFotoCapa(arquivoFotoSelecionado);
        }

        // 2. Upload das Mídias de Inspeção (Exclusivas do Admin)
        let midiasInspecaoFinal = [];
        if (arquivosInspecao.length > 0) {
            midiasInspecaoFinal = await uploadMidiasInspecao(arquivosInspecao);
        }

        const dadosProduto = {
            comerciante_id: usuarioAtual.uid,
            nome: nome,
            descricao: descricao,
            valor: valor,
            estoque: estoque,
            foto_url: fotoCapaFinal
        };

        if (!idExistente) {
            dadosProduto.status_verificacao = "pendente";
            dadosProduto.midias_inspecao = midiasInspecaoFinal;
            dadosProduto.checklist_consumivel = {
                confirmado_em: new Date().toISOString(),
                sem_mofo: checkMofo.checked,
                sem_furos: checkFuros.checked,
                sem_odor: checkOdor.checked,
                textura_ok: checkTextura.checked,
                proprio_para_consumo: checkConsumo.checked
            };
            dadosProduto.criado_em = new Date().toISOString();

            await addDoc(collection(db, "produtos"), dadosProduto);
            mostrarToast("Produto e mídias de inspeção enviados para análise!", "sucesso");
        } else {
            await updateDoc(doc(db, "produtos", idExistente), dadosProduto);
            mostrarToast("Produto atualizado com sucesso!", "sucesso");
        }

        fecharModal();
        await carregarProdutos();

    } catch (erro) {
        console.error("Erro ao salvar produto:", erro);
        mostrarToast("Não foi possível salvar o produto e suas mídias.", "erro");
    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar Produto";
    }
});

// EXCLUSÃO DE PRODUTO
async function excluirProduto(id, nomeProduto) {
    const confirmou = await confirmarAcao("Excluir Produto", `Deseja remover "${nomeProduto}"?`);
    if (!confirmou) return;

    try {
        await deleteDoc(doc(db, "produtos", id));
        mostrarToast("Produto excluído!", "sucesso");
        await carregarProdutos();
    } catch (erro) {
        console.error("Erro ao excluir produto:", erro);
        mostrarToast("Não foi possível excluir o produto.", "erro");
    }
}