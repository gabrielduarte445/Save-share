import { db } from "../../public/firebase-config.js";
import { protegerPagina } from "../shared/guarda.js";
import { mostrarToast, confirmarAcao } from "../shared/toast.js";
import { prepararImagem } from "../shared/imagem.js";
import { escaparHtml } from "../shared/html.js";
import {
    camposNovaSubmissao,
    mudouConteudo,
    parecerHtml,
    LIMITE_IMAGEM_BASE64
} from "../../servicos/verificacao.js";

import {
    collection,
    doc,
    updateDoc,
    writeBatch,
    query,
    where,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const MAX_FOTOS_LOTE = 3;

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

const campoFoto = document.getElementById("produto-foto");
const previewFoto = document.getElementById("preview-foto");
const botaoRemoverFoto = document.getElementById("btn-remover-foto");
const botaoChecarFoto = document.getElementById("btn-checar-foto");
const caixaParecerIA = document.getElementById("caixa-parecer-ia");

const campoMidiasInspecao = document.getElementById("midias-inspecao");
const containerPreviewsInspecao = document.getElementById("lista-previews-inspecao");

// Os checkboxes ficam escondidos na edição; sem isso o navegador bloqueia o
// envio ("campo obrigatório não focável"). A validação é feita abaixo, em JS.
formulario.noValidate = true;

let capaBase64 = null;        // foto principal pronta (nova ou já salva)
let inspecaoBase64 = [];      // novas fotos do lote (base64 reduzido)
let produtoEmEdicao = null;
let usuarioAtual = null;

const { usuario } = await protegerPagina({ tipos: ["comerciante"] });
usuarioAtual = usuario;

await carregarProdutos();

// ---------- LISTAGEM ----------

async function carregarProdutos() {
    listaProdutos.innerHTML = `<p class="empty-message">Carregando produtos...</p>`;
    mensagemVazia.style.display = "none";

    try {
        const consulta = query(
            collection(db, "produtos"),
            where("comerciante_id", "==", usuarioAtual.uid)
        );
        const resultado = await getDocs(consulta);

        if (resultado.empty) {
            listaProdutos.innerHTML = "";
            mensagemVazia.style.display = "block";
            return;
        }

        listaProdutos.innerHTML = "";

        resultado.docs.forEach((docSnap) => {
            listaProdutos.appendChild(criarCardProduto(docSnap.id, docSnap.data()));
        });

    } catch (erro) {
        console.error("Erro ao carregar produtos:", erro);
        listaProdutos.innerHTML = `<p class="empty-message">Não foi possível carregar seus produtos.</p>`;
    }
}

const TEXTO_STATUS = {
    pendente: "⏳ Aguardando aprovação",
    aprovado: "✓ Verificado",
    reprovado: "✕ Reprovado",
    legado: "Aguardando migração"
};

function criarCardProduto(id, produto) {
    const card = document.createElement("div");
    card.className = "card-produto";

    let classeEstoque = "estoque-disponivel";
    let textoEstoque = `Estoque: ${Number(produto.estoque) || 0} unidades`;

    if (produto.estoque === 0) {
        classeEstoque = "estoque-esgotado";
        textoEstoque = "Esgotado";
    } else if (produto.estoque <= 5) {
        classeEstoque = "estoque-baixo";
    }

    const status = produto.status_verificacao || "legado";

    const valorFormatado = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(produto.valor || 0);

    const motivo = status === "reprovado" && produto.observacao_admin
        ? `<p class="obs-reprovado">Motivo: ${escaparHtml(produto.observacao_admin)}</p>`
        : "";

    card.innerHTML = `
        <div class="imagem-produto">
            <span>Sem foto</span>
        </div>

        <div class="informacoes-produto">
            <span class="status-badge-card status-${escaparHtml(status)}">${escaparHtml(TEXTO_STATUS[status] || status)}</span>
            <h3>${escaparHtml(produto.nome)}</h3>
            <p class="preco">${escaparHtml(valorFormatado)}</p>
            <p class="estoque ${classeEstoque}">${escaparHtml(textoEstoque)}</p>
            ${motivo}
        </div>

        <div class="acoes">
            <button type="button" class="btn-editar">Editar</button>
            <button type="button" class="btn-excluir">Excluir</button>
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
    card.querySelector(".btn-excluir").addEventListener("click", () => excluirProduto(id, produto.nome));

    return card;
}

// ---------- FOTO PRINCIPAL ----------

function mostrarPreviewCapa(base64) {
    previewFoto.replaceChildren();

    if (base64) {
        const img = document.createElement("img");
        img.src = `data:image/jpeg;base64,${base64}`;
        img.alt = "Prévia da foto";
        previewFoto.appendChild(img);
        botaoRemoverFoto.style.display = "inline-block";
        if (botaoChecarFoto) botaoChecarFoto.style.display = "inline-block";
    } else {
        const texto = document.createElement("span");
        texto.textContent = "Sem foto";
        previewFoto.appendChild(texto);
        botaoRemoverFoto.style.display = "none";
        if (botaoChecarFoto) botaoChecarFoto.style.display = "none";
    }

    if (caixaParecerIA) caixaParecerIA.innerHTML = "";
}

campoFoto.addEventListener("change", async () => {
    const arquivo = campoFoto.files[0];
    if (!arquivo) return;

    try {
        const base64 = await prepararImagem(arquivo);

        if (base64.length > LIMITE_IMAGEM_BASE64) {
            mostrarToast("A foto ficou grande demais. Tente uma foto menor.", "erro");
            return;
        }

        capaBase64 = base64;
        mostrarPreviewCapa(capaBase64);
    } catch (erro) {
        console.error(erro);
        mostrarToast("Não foi possível carregar a foto.", "erro");
    } finally {
        campoFoto.value = "";
    }
});

botaoRemoverFoto.addEventListener("click", () => {
    capaBase64 = null;
    mostrarPreviewCapa(null);
});

// Pré-checagem opcional: orienta o comerciante, não grava nada.
// O parecer oficial é o que o admin gera na revisão.
if (botaoChecarFoto) {
    botaoChecarFoto.addEventListener("click", async () => {
        if (!capaBase64) {
            mostrarToast("Escolha a foto primeiro.", "erro");
            return;
        }

        botaoChecarFoto.disabled = true;
        botaoChecarFoto.textContent = "Analisando...";

        try {
            // import dinâmico: se a IA falhar, o resto da página continua funcionando
            const { analisarProdutoComIA, mensagemErroIA } = await import("../shared/ia.js");

            try {
                const parecer = await analisarProdutoComIA({
                    nome: campoNome.value,
                    descricao: campoDescricao.value,
                    imagemBase64: capaBase64
                });
                caixaParecerIA.innerHTML = parecerHtml(parecer);
            } catch (erro) {
                console.error(erro);
                mostrarToast(mensagemErroIA(erro), "erro");
            }
        } catch (erro) {
            console.error("Erro ao carregar o serviço de IA:", erro);
            mostrarToast("O serviço de IA não está disponível agora.", "erro");
        } finally {
            botaoChecarFoto.disabled = false;
            botaoChecarFoto.textContent = "Checar foto com IA";
        }
    });
}

// ---------- FOTOS DO LOTE (para o admin) ----------

function renderizarPreviewsInspecao() {
    containerPreviewsInspecao.replaceChildren();

    inspecaoBase64.forEach((base64, index) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "preview-inspecao-item";

        const img = document.createElement("img");
        img.src = `data:image/jpeg;base64,${base64}`;
        img.alt = `Foto do lote ${index + 1}`;
        itemDiv.appendChild(img);

        const btnRemover = document.createElement("button");
        btnRemover.type = "button";
        btnRemover.className = "btn-remover-inspecao";
        btnRemover.textContent = "×";
        btnRemover.addEventListener("click", () => {
            inspecaoBase64.splice(index, 1);
            renderizarPreviewsInspecao();
        });

        itemDiv.appendChild(btnRemover);
        containerPreviewsInspecao.appendChild(itemDiv);
    });
}

campoMidiasInspecao.addEventListener("change", async () => {
    const arquivos = Array.from(campoMidiasInspecao.files);
    campoMidiasInspecao.value = "";

    for (const arquivo of arquivos) {
        if (!arquivo.type.startsWith("image/")) {
            mostrarToast("Vídeos não são aceitos nesta versão. Envie fotos.", "erro");
            continue;
        }
        if (inspecaoBase64.length >= MAX_FOTOS_LOTE) {
            mostrarToast(`No máximo ${MAX_FOTOS_LOTE} fotos do lote.`, "erro");
            break;
        }

        try {
            const base64 = await prepararImagem(arquivo);
            if (base64.length > LIMITE_IMAGEM_BASE64) {
                mostrarToast("Uma das fotos ficou grande demais.", "erro");
                continue;
            }
            inspecaoBase64.push(base64);
        } catch (erro) {
            console.error(erro);
            mostrarToast("Não foi possível carregar uma das fotos.", "erro");
        }
    }

    renderizarPreviewsInspecao();
});

// ---------- MODAL ----------

function abrirModalNovo() {
    modalTitulo.textContent = "Adicionar Produto";
    campoId.value = "";
    formulario.reset();

    produtoEmEdicao = null;
    capaBase64 = null;
    inspecaoBase64 = [];

    mostrarPreviewCapa(null);
    renderizarPreviewsInspecao();

    blocoChecklist.style.display = "block";
    modal.style.display = "flex";
}

function abrirModalEdicao(id, produto) {
    modalTitulo.textContent = "Editar Produto";
    formulario.reset();

    produtoEmEdicao = { id, ...produto };
    campoId.value = id;
    campoNome.value = produto.nome || "";
    campoDescricao.value = produto.descricao || "";
    campoValor.value = produto.valor ?? "";
    campoEstoque.value = produto.estoque ?? "";

    capaBase64 = produto.imagem || null;
    inspecaoBase64 = [];

    mostrarPreviewCapa(capaBase64);
    renderizarPreviewsInspecao();

    // Produto antigo sem checklist precisa confirmar de novo para poder ser reenviado
    blocoChecklist.style.display = produto.checklist_consumivel ? "none" : "block";
    modal.style.display = "flex";
}

function fecharModal() {
    modal.style.display = "none";
    formulario.reset();
    produtoEmEdicao = null;
    capaBase64 = null;
    inspecaoBase64 = [];
    mostrarPreviewCapa(null);
    renderizarPreviewsInspecao();
}

botaoAdicionar.addEventListener("click", abrirModalNovo);
botaoFecharModal.addEventListener("click", fecharModal);
modal.addEventListener("click", (e) => { if (e.target === modal) fecharModal(); });

// ---------- SALVAR ----------

function checklistMarcado() {
    return checkMofo.checked && checkFuros.checked && checkOdor.checked
        && checkTextura.checked && checkConsumo.checked;
}

function montarChecklist() {
    return {
        confirmado_em: new Date().toISOString(),
        sem_mofo: checkMofo.checked,
        sem_furos: checkFuros.checked,
        sem_odor: checkOdor.checked,
        textura_ok: checkTextura.checked,
        proprio_para_consumo: checkConsumo.checked
    };
}

formulario.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nome = campoNome.value.trim();
    const descricao = campoDescricao.value.trim();
    const valor = parseFloat(campoValor.value);
    const estoque = parseInt(campoEstoque.value, 10);
    const idExistente = campoId.value;

    if (!nome || nome.length > 80 || isNaN(valor) || valor <= 0 || isNaN(estoque) || estoque < 0) {
        mostrarToast("Preencha nome, preço maior que zero e estoque corretamente.", "erro");
        return;
    }

    if (!capaBase64) {
        mostrarToast("A foto do produto é obrigatória.", "erro");
        return;
    }

    const precisaChecklist = !idExistente || !produtoEmEdicao?.checklist_consumivel;

    if (precisaChecklist && !checklistMarcado()) {
        mostrarToast("Confirme todos os itens da verificação de consumo.", "erro");
        return;
    }

    if (!idExistente && inspecaoBase64.length === 0) {
        mostrarToast("Anexe ao menos 1 foto do lote para a análise.", "erro");
        return;
    }

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    try {
        const lote = writeBatch(db);

        if (!idExistente) {
            // Produto novo: sempre entra "pendente", sem parecer
            const novoRef = doc(collection(db, "produtos"));

            lote.set(novoRef, {
                comerciante_id: usuarioAtual.uid,
                nome,
                descricao,
                valor,
                estoque,
                imagem: capaBase64,
                checklist_consumivel: montarChecklist(),
                criado_em: new Date().toISOString(),
                ...camposNovaSubmissao()
            });

            inspecaoBase64.forEach((base64, ordem) => {
                lote.set(doc(collection(novoRef, "inspecao")), {
                    imagem: base64,
                    ordem,
                    criado_em: serverTimestamp()
                });
            });

            await lote.commit();
            mostrarToast("Produto enviado para análise!", "sucesso");

        } else {
            const checklistFinal = precisaChecklist
                ? montarChecklist()
                : produtoEmEdicao.checklist_consumivel;

            const novo = { nome, descricao, imagem: capaBase64, checklist_consumivel: checklistFinal };
            const conteudoMudou = mudouConteudo(produtoEmEdicao, novo) || inspecaoBase64.length > 0;
            const ref = doc(db, "produtos", idExistente);

            if (conteudoMudou) {
                // Mudou o que o admin avalia: volta para análise e zera o parecer
                lote.update(ref, {
                    ...novo,
                    valor,
                    estoque,
                    atualizado_em: serverTimestamp(),
                    ...camposNovaSubmissao()
                });

                inspecaoBase64.forEach((base64, ordem) => {
                    lote.set(doc(collection(ref, "inspecao")), {
                        imagem: base64,
                        ordem,
                        criado_em: serverTimestamp()
                    });
                });

                await lote.commit();
                mostrarToast("Produto atualizado e reenviado para análise.", "sucesso");

            } else {
                // Só preço e/ou estoque: mantém o status atual
                await updateDoc(ref, { valor, estoque, atualizado_em: serverTimestamp() });
                mostrarToast("Preço e estoque atualizados.", "sucesso");
            }
        }

        fecharModal();
        await carregarProdutos();

    } catch (erro) {
        console.error("Erro ao salvar produto:", erro);
        mostrarToast("Não foi possível salvar o produto.", "erro");
    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar Produto";
    }
});

// ---------- EXCLUSÃO ----------

async function excluirProduto(id, nomeProduto) {
    // confirmarAcao aceita (mensagem) ou (titulo, mensagem): ver toast.js novo
    const confirmou = await confirmarAcao("Excluir produto", `Deseja remover "${nomeProduto}"?`);
    if (!confirmou) return;

    try {
        const lote = writeBatch(db);
        const refProduto = doc(db, "produtos", id);

        // O Firestore não apaga subcoleções sozinho
        const fotos = await getDocs(collection(refProduto, "inspecao"));
        fotos.forEach((f) => lote.delete(f.ref));
        lote.delete(refProduto);

        await lote.commit();
        mostrarToast("Produto excluído!", "sucesso");
        await carregarProdutos();
    } catch (erro) {
        console.error("Erro ao excluir produto:", erro);
        mostrarToast("Não foi possível excluir o produto.", "erro");
    }
}