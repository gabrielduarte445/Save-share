import { db } from "../../public/firebase-config.js";
import { protegerPagina } from "../shared/guarda.js";
import { mostrarToast, confirmarAcao } from "../shared/toast.js";
import { prepararImagem } from "../shared/imagem.js";
import { escaparHtml } from "../shared/html.js";
import {
    camposNovaSubmissao,
    mudouConteudo,
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

const ICONES_SVG = {
    relogio: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px; flex-shrink: 0;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    ampulheta: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; flex-shrink: 0;"><path d="M5 22h14"></path><path d="M5 2h14"></path><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"></path><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"></path></svg>`,
    check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; flex-shrink: 0;"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    fechar: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; flex-shrink: 0;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    alerta: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px; flex-shrink: 0;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    removerMini: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
};

const BADGE_STATUS = {
    pendente: { icone: ICONES_SVG.ampulheta, texto: "Em Análise" },
    aprovado: { icone: ICONES_SVG.check, texto: "Verificado" },
    reprovado: { icone: ICONES_SVG.fechar, texto: "Reprovado" },
    legado: { icone: "", texto: "Aguardando migração" }
};

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

const campoMidiasInspecao = document.getElementById("midias-inspecao");
const containerPreviewsInspecao = document.getElementById("lista-previews-inspecao");

formulario.noValidate = true;

let capaBase64 = null;
let inspecaoBase64 = [];
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

function calcularTempoRestanteComerciante(dataExpiracaoIso) {
    if (!dataExpiracaoIso) return { texto: "", expirado: false, tipoIcone: null };

    const agora = new Date();
    const dataExpira = new Date(dataExpiracaoIso);
    const diffMs = dataExpira - agora;

    if (diffMs <= 0) {
        return {
            texto: `A aprovação deste produto expirou em ${dataExpira.toLocaleDateString("pt-BR")}. Edite para reenviar.`,
            expirado: true,
            tipoIcone: "fechar"
        };
    }

    const horasTotais = Math.floor(diffMs / (1000 * 60 * 60));
    const dias = Math.floor(horasTotais / 24);
    const horasRestantes = horasTotais % 24;

    if (dias > 0) {
        return {
            texto: `Aprovação válida por mais ${dias} dia(s) e ${horasRestantes}h (expira em ${dataExpira.toLocaleDateString("pt-BR")})`,
            expirado: false,
            tipoIcone: "relogio"
        };
    }

    return {
        texto: `Aprovação expira hoje! Restam apenas ${horasRestantes} hora(s)`,
        expirado: false,
        tipoIcone: "alerta"
    };
}

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

    let status = produto.status_verificacao || "legado";
    let badgeInfo = BADGE_STATUS[status] || { icone: "", texto: status };
    let iconeBadge = badgeInfo.icone;
    let textoBadge = badgeInfo.texto;
    let classeBadge = `status-${status}`;
    let avisoExpirado = "";

    if (status === "aprovado" && produto.expira_em) {
        const infoValidade = calcularTempoRestanteComerciante(produto.expira_em);

        if (infoValidade.expirado) {
            iconeBadge = ICONES_SVG.fechar;
            textoBadge = "Validade Expirada";
            classeBadge = "status-expirado";
            avisoExpirado = `<p class="obs-expirado" style="color: #c62828; font-size: 12px; margin-top: 4px; font-weight: 500; display: flex; align-items: center;">
                ${ICONES_SVG.fechar}<span>${escaparHtml(infoValidade.texto)}</span>
            </p>`;
        } else {
            const iconeValidade = ICONES_SVG[infoValidade.tipoIcone] || "";
            const corValidade = infoValidade.tipoIcone === "relogio" ? "#2e7d32" : "#e65100";
            avisoExpirado = `<p class="obs-validade" style="color: ${corValidade}; font-size: 12px; margin-top: 4px; display: flex; align-items: center;">
                ${iconeValidade}<span>${escaparHtml(infoValidade.texto)}</span>
            </p>`;
        }
    }

    const valorFormatado = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(produto.valor || 0);

    const motivo = status === "reprovado" && produto.observacao_admin
        ? `<p class="obs-reprovado" style="color: #c62828; font-size: 13px; margin-top: 6px;"><strong>Motivo da reprovação:</strong> ${escaparHtml(produto.observacao_admin)}</p>`
        : "";

    const avisoPendente = status === "pendente"
        ? `<p class="obs-pendente" style="color: #1565c0; font-size: 12px; margin-top: 4px;">Este produto está na fila de análise da administração.</p>`
        : "";

    card.innerHTML = `
        <div class="imagem-produto">
            <span>Sem foto</span>
        </div>

        <div class="informacoes-produto">
            <span class="status-badge-card ${escaparHtml(classeBadge)}" style="display: inline-flex; align-items: center;">
                ${iconeBadge}${escaparHtml(textoBadge)}
            </span>
            <h3>${escaparHtml(produto.nome)}</h3>
            <p class="preco">${escaparHtml(valorFormatado)}</p>
            <p class="estoque ${classeEstoque}">${escaparHtml(textoEstoque)}</p>
            ${motivo}
            ${avisoPendente}
            ${avisoExpirado}
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

// ---------- FOTOS DO LOTE (INSPEÇÃO) ----------

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
        btnRemover.setAttribute("aria-label", "Remover foto");
        btnRemover.innerHTML = ICONES_SVG.removerMini;
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

function resetarCheckboxes() {
    if (checkMofo) checkMofo.checked = false;
    if (checkFuros) checkFuros.checked = false;
    if (checkOdor) checkOdor.checked = false;
    if (checkTextura) checkTextura.checked = false;
    if (checkConsumo) checkConsumo.checked = false;
}

function abrirModalNovo() {
    modalTitulo.textContent = "Adicionar Produto";
    campoId.value = "";
    formulario.reset();
    resetarCheckboxes();

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
    resetarCheckboxes();

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

    blocoChecklist.style.display = produto.checklist_consumivel ? "none" : "block";
    modal.style.display = "flex";
}

function fecharModal() {
    modal.style.display = "none";
    formulario.reset();
    resetarCheckboxes();
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
    const confirmou = await confirmarAcao("Excluir produto", `Deseja remover "${nomeProduto}"?`);
    if (!confirmou) return;

    try {
        const lote = writeBatch(db);
        const refProduto = doc(db, "produtos", id);

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