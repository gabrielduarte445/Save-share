import { auth, db } from "../public/firebase-config.js";
import { protegerPagina } from "../pages/shared/guarda.js";
import { mostrarToast } from "../pages/shared/toast.js";
import { escaparHtml } from "../pages/shared/html.js";
import {
    analisarProdutoComIA,
    mensagemErroIA,
    temChaveIA,
    salvarChaveIA,
    removerChaveIA
} from "../servicos/ia.js";
import { STATUS, ROTULOS_STATUS, parecerHtml } from "../servicos/verificacao.js";
import {
    collection,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

const { usuario, dados } = await protegerPagina({ tipos: ["admin"] });

const elNome = document.getElementById("adm-nome");
const elLista = document.getElementById("adm-lista");
const elLegado = document.getElementById("adm-legado");
const elLegadoQtd = document.getElementById("adm-legado-qtd");
const btnMigrar = document.getElementById("btn-migrar-legado");
const btnSair = document.getElementById("btn-sair");
const abas = document.querySelectorAll(".adm-aba");

elNome.textContent = dados?.nome || "Administrador";

let produtos = [];
let abaAtual = STATUS.PENDENTE;
const cacheLojas = {};

// Ajuste o segundo argumento se o seu mostrarToast usar outro formato de "tipo".
function aviso(mensagem, tipo = "sucesso") {
    mostrarToast(mensagem, tipo);
}

function statusDe(produto) {
    return produto.status_verificacao || "legado";
}

async function nomeDaLoja(id) {
    if (!id) return "Loja";
    if (cacheLojas[id]) return cacheLojas[id];

    try {
        const snap = await getDoc(doc(db, "lojas", id));
        cacheLojas[id] = snap.exists() ? (snap.data().nome_loja || "Loja") : "Loja";
    } catch {
        cacheLojas[id] = "Loja";
    }
    return cacheLojas[id];
}

// O formato de checklist_consumivel pode ser objeto {chave: true/false}
// ou lista. Este leitor aceita os dois; ajuste se o seu for diferente.
function itensChecklist(checklist) {
    if (!checklist) return [];

    if (Array.isArray(checklist)) {
        return checklist.map((item, i) => {
            if (typeof item === "string") return { rotulo: item, ok: true };
            return {
                rotulo: item.rotulo || item.item || `Item ${i + 1}`,
                ok: (item.marcado ?? item.ok ?? true) === true
            };
        });
    }

    const ROTULOS = {
        sem_mofo: "Sem mofo, fungos ou podridão",
        sem_furos: "Sem furos, cortes ou perfurações",
        sem_odor: "Sem odor estranho ou fermentado",
        textura_ok: "Coloração e textura dentro do esperado",
        proprio_para_consumo: "Declara próprio para consumo"
    };

    // Só campos booleanos entram (confirmado_em é data, não item)
    return Object.entries(checklist)
        .filter(([, valor]) => typeof valor === "boolean")
        .map(([chave, valor]) => ({
            rotulo: ROTULOS[chave] || chave.replace(/_/g, " "),
            ok: valor === true
        }));
}

// Fotos do lote ficam na subcoleção produtos/{id}/inspecao (só admin e dono leem)
async function carregarFotosLote(card, botao) {
    const destino = card.querySelector(".adm-inspecao-fotos");
    botao.disabled = true;
    botao.textContent = "Carregando fotos...";

    try {
        const snap = await getDocs(collection(db, "produtos", card.dataset.id, "inspecao"));

        if (snap.empty) {
            destino.innerHTML = `<p class="adm-nota">O comerciante não enviou fotos do lote.</p>`;
        } else {
            const fotos = snap.docs
                .map((d) => d.data())
                .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

            destino.replaceChildren(...fotos.map((f, i) => {
                const img = document.createElement("img");
                img.src = `data:image/jpeg;base64,${f.imagem}`;
                img.alt = `Foto do lote ${i + 1}`;
                img.loading = "lazy";
                return img;
            }));
        }

        botao.remove();
    } catch (erro) {
        console.error("Erro ao carregar fotos do lote:", erro);
        aviso("Não foi possível carregar as fotos do lote.", "erro");
        botao.disabled = false;
        botao.textContent = "Ver fotos do lote";
    }
}

async function carregar() {
    elLista.innerHTML = `<p class="adm-vazio">Carregando...</p>`;

    try {
        const snap = await getDocs(collection(db, "produtos"));
        produtos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const ids = [...new Set(produtos.map((p) => p.comerciante_id))];
        await Promise.all(ids.map(nomeDaLoja));

        renderizar();
    } catch (erro) {
        console.error("Erro ao carregar produtos:", erro);
        elLista.innerHTML = `<p class="adm-vazio">Não foi possível carregar os produtos. Confira se seu usuário é admin e se as regras foram publicadas.</p>`;
    }
}

function atualizarContadores() {
    const conta = (s) => produtos.filter((p) => statusDe(p) === s).length;

    document.getElementById("cont-pendente").textContent = conta(STATUS.PENDENTE);
    document.getElementById("cont-aprovado").textContent = conta(STATUS.APROVADO);
    document.getElementById("cont-reprovado").textContent = conta(STATUS.REPROVADO);

    const legados = conta("legado");
    elLegado.hidden = legados === 0;
    elLegadoQtd.textContent = legados;
}

function acoesHtml(p, status) {
    if (status === STATUS.PENDENTE) {
        return `
            <div class="adm-acoes">
                <button type="button" class="adm-btn adm-btn-ia" data-acao="ia" ${p.imagem ? "" : "disabled"}>
                    ${p.parecer_ia ? "Analisar de novo com IA" : "Analisar com IA"}
                </button>
                <textarea class="adm-obs" maxlength="300"
                    placeholder="Observação para o comerciante (obrigatória para reprovar)"></textarea>
                <div class="adm-linha-botoes">
                    <button type="button" class="adm-btn adm-btn-aprovar" data-acao="aprovar">Aprovar</button>
                    <button type="button" class="adm-btn adm-btn-reprovar" data-acao="reprovar">Reprovar</button>
                </div>
            </div>`;
    }

    return `
        <div class="adm-acoes">
            <p class="adm-decisao"><strong>${escaparHtml(ROTULOS_STATUS[status] || status)}</strong>
                ${p.observacao_admin ? ` · ${escaparHtml(p.observacao_admin)}` : ""}</p>
            <div class="adm-linha-botoes">
                <button type="button" class="adm-btn adm-btn-neutro" data-acao="reabrir">Reabrir (voltar para pendente)</button>
            </div>
        </div>`;
}

function criarCartao(p) {
    const status = statusDe(p);
    const card = document.createElement("article");
    card.className = "adm-card";
    card.dataset.id = p.id;

    const itens = itensChecklist(p.checklist_consumivel)
        .map((i) => `<li class="${i.ok ? "ok" : "falta"}">${i.ok ? "✓" : "✗"} ${escaparHtml(i.rotulo)}</li>`)
        .join("");

    const preco = Number(p.valor).toFixed(2).replace(".", ",");

    card.innerHTML = `
        <div class="adm-foto"><span>Sem foto</span></div>
        <div class="adm-corpo">
            <h3>${escaparHtml(p.nome)}</h3>
            <p class="adm-meta">${escaparHtml(cacheLojas[p.comerciante_id] || "Loja")} · R$ ${preco} · estoque ${Number(p.estoque) || 0}</p>
            <p class="adm-desc">${escaparHtml(p.descricao || "Sem descrição")}</p>
            <h4>Checklist do comerciante</h4>
            <ul class="adm-check">${itens || "<li>Sem checklist</li>"}</ul>
            <h4>Fotos do lote</h4>
            <button type="button" class="adm-btn adm-btn-neutro" data-acao="inspecao">Ver fotos do lote</button>
            <div class="adm-inspecao-fotos"></div>
            <h4>Parecer da IA</h4>
            <div class="adm-parecer">${parecerHtml(p.parecer_ia)}</div>
            ${acoesHtml(p, status)}
        </div>`;

    if (p.imagem) {
        const img = document.createElement("img");
        img.src = `data:image/jpeg;base64,${p.imagem}`;
        img.alt = p.nome || "Produto";
        img.loading = "lazy";
        card.querySelector(".adm-foto").replaceChildren(img);
    }

    return card;
}

function renderizar() {
    atualizarContadores();
    abas.forEach((a) => a.classList.toggle("ativa", a.dataset.aba === abaAtual));

    if (abaAtual === "ia") {
        renderDesempenho();
        return;
    }

    const lista = produtos
        .filter((p) => statusDe(p) === abaAtual)
        .sort((a, b) => (b.atualizado_em?.seconds || 0) - (a.atualizado_em?.seconds || 0));

    if (lista.length === 0) {
        elLista.innerHTML = `<p class="adm-vazio">Nenhum produto nesta aba.</p>`;
        return;
    }

    elLista.replaceChildren(...lista.map(criarCartao));
}

// ---------- Desempenho da IA (concordância com a decisão humana) ----------

function renderDesempenho() {
    const decididos = produtos.filter((p) =>
        p.parecer_ia && [STATUS.APROVADO, STATUS.REPROVADO].includes(p.status_verificacao)
    );

    const vereditos = ["consumivel", "duvida", "improprio", "imagem_invalida"];
    const rotulos = {
        consumivel: "Próprio",
        duvida: "Dúvida",
        improprio: "Impróprio",
        imagem_invalida: "Imagem inválida"
    };

    const cont = {};
    vereditos.forEach((v) => { cont[v] = { aprovado: 0, reprovado: 0 }; });
    decididos.forEach((p) => {
        const linha = cont[p.parecer_ia.veredito];
        if (linha) linha[p.status_verificacao]++;
    });

    const concordantes = cont.consumivel.aprovado + cont.improprio.reprovado + cont.imagem_invalida.reprovado;
    const falsoAprovado = cont.consumivel.reprovado;
    const falsoReprovado = cont.improprio.aprovado + cont.imagem_invalida.aprovado;
    const duvidas = cont.duvida.aprovado + cont.duvida.reprovado;
    const conclusivos = decididos.length - duvidas;
    const taxa = conclusivos > 0 ? Math.round((concordantes / conclusivos) * 100) + "%" : "—";

    const metrica = (valor, texto) =>
        `<div class="adm-metrica"><strong>${escaparHtml(String(valor))}</strong><span>${escaparHtml(texto)}</span></div>`;

    const linhas = vereditos.map((v) => `
        <tr>
            <td>${rotulos[v]}</td>
            <td>${cont[v].aprovado}</td>
            <td>${cont[v].reprovado}</td>
        </tr>`).join("");

    elLista.innerHTML = `
        <div class="adm-resumo-ia">
            ${metrica(decididos.length, "produtos com parecer e decisão")}
            ${metrica(taxa, "concordância (sem contar dúvidas)")}
            ${metrica(falsoAprovado, "IA disse próprio, admin reprovou")}
            ${metrica(falsoReprovado, "IA barrou, admin aprovou")}
            ${metrica(duvidas, "pareceres em dúvida")}
        </div>
        <table class="adm-tabela">
            <thead><tr><th>Veredito da IA</th><th>Admin aprovou</th><th>Admin reprovou</th></tr></thead>
            <tbody>${linhas}</tbody>
        </table>
        <p class="adm-nota">O erro mais grave é "IA disse próprio, admin reprovou": é o caso em que um
            produto ruim passaria se a decisão dependesse só da IA. Por isso a decisão final é humana.</p>`;
}


// ---------- Chave gratuita da IA (fica só neste navegador) ----------

const elIaStatus = document.getElementById("adm-ia-status");
const elIaForm = document.getElementById("adm-ia-form");
const elIaInput = document.getElementById("adm-chave-ia");
const btnSalvarChave = document.getElementById("btn-salvar-chave");
const btnRemoverChave = document.getElementById("btn-remover-chave");

function atualizarConfigIA() {
    const tem = temChaveIA();
    elIaStatus.textContent = tem
        ? "IA ativa neste navegador (chave guardada só aqui)."
        : "IA desligada: gere uma chave gratuita em aistudio.google.com/apikey e cole abaixo. Sem a chave, você ainda pode aprovar e reprovar normalmente.";
    elIaForm.hidden = tem;
    btnRemoverChave.hidden = !tem;
}

btnSalvarChave.addEventListener("click", () => {
    try {
        salvarChaveIA(elIaInput.value);
        elIaInput.value = "";
        aviso("Chave salva neste navegador.");
    } catch {
        aviso("Essa chave não parece válida. Copie de novo do Google AI Studio.", "erro");
    }
    atualizarConfigIA();
});

btnRemoverChave.addEventListener("click", () => {
    removerChaveIA();
    atualizarConfigIA();
});

atualizarConfigIA();

// ---------- Ações ----------

async function executarIA(p, botao) {
    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = "Analisando...";

    try {
        const analise = await analisarProdutoComIA({
            nome: p.nome,
            descricao: p.descricao,
            imagemBase64: p.imagem
        });

        await updateDoc(doc(db, "produtos", p.id), {
            parecer_ia: { ...analise, analisado_em: serverTimestamp(), analisado_por: usuario.uid },
            atualizado_em: serverTimestamp()
        });

        p.parecer_ia = { ...analise, analisado_em: new Date(), analisado_por: usuario.uid };
        renderizar();
    } catch (erro) {
        console.error("Erro na análise de IA:", erro);
        aviso(mensagemErroIA(erro), "erro");
        botao.disabled = false;
        botao.textContent = textoOriginal;
    }
}

async function decidir(p, status, observacao, botao) {
    const obs = observacao.trim();

    if (status === STATUS.REPROVADO && obs.length < 5) {
        aviso("Explique o motivo da reprovação (mínimo de 5 caracteres).", "erro");
        return;
    }

    botao.disabled = true;

    try {
        await updateDoc(doc(db, "produtos", p.id), {
            status_verificacao: status,
            observacao_admin: obs || null,
            verificado_por: usuario.uid,
            verificado_em: serverTimestamp(),
            atualizado_em: serverTimestamp()
        });

        Object.assign(p, {
            status_verificacao: status,
            observacao_admin: obs || null,
            verificado_por: usuario.uid,
            atualizado_em: { seconds: Math.floor(Date.now() / 1000) }
        });

        aviso(status === STATUS.APROVADO ? "Produto aprovado." : "Produto reprovado.");
        renderizar();
    } catch (erro) {
        console.error("Erro ao registrar decisão:", erro);
        aviso("Não foi possível registrar a decisão.", "erro");
        botao.disabled = false;
    }
}

async function reabrir(p, botao) {
    botao.disabled = true;

    try {
        await updateDoc(doc(db, "produtos", p.id), {
            status_verificacao: STATUS.PENDENTE,
            observacao_admin: null,
            verificado_por: null,
            verificado_em: null,
            atualizado_em: serverTimestamp()
        });

        Object.assign(p, {
            status_verificacao: STATUS.PENDENTE,
            observacao_admin: null,
            verificado_por: null,
            atualizado_em: { seconds: Math.floor(Date.now() / 1000) }
        });

        renderizar();
    } catch (erro) {
        console.error("Erro ao reabrir:", erro);
        aviso("Não foi possível reabrir o produto.", "erro");
        botao.disabled = false;
    }
}

elLista.addEventListener("click", async (evento) => {
    const botao = evento.target.closest("button[data-acao]");
    if (!botao) return;

    const card = botao.closest(".adm-card");
    const produto = produtos.find((p) => p.id === card?.dataset.id);
    if (!produto) return;

    const obs = card.querySelector(".adm-obs")?.value || "";

    switch (botao.dataset.acao) {
        case "inspecao": return carregarFotosLote(card, botao);
        case "ia": return executarIA(produto, botao);
        case "aprovar": return decidir(produto, STATUS.APROVADO, obs, botao);
        case "reprovar": return decidir(produto, STATUS.REPROVADO, obs, botao);
        case "reabrir": return reabrir(produto, botao);
    }
});

abas.forEach((aba) => {
    aba.addEventListener("click", () => {
        abaAtual = aba.dataset.aba;
        renderizar();
    });
});

// Migração dos produtos antigos (sem status): confirma com um segundo clique.
let confirmandoMigracao = false;

btnMigrar.addEventListener("click", async () => {
    if (!confirmandoMigracao) {
        confirmandoMigracao = true;
        btnMigrar.textContent = "Clique de novo para confirmar";
        setTimeout(() => {
            confirmandoMigracao = false;
            btnMigrar.textContent = "Aprovar todos como legado";
        }, 5000);
        return;
    }

    confirmandoMigracao = false;
    btnMigrar.disabled = true;

    const legados = produtos.filter((p) => !p.status_verificacao);
    let feitos = 0;

    for (const p of legados) {
        try {
            await updateDoc(doc(db, "produtos", p.id), {
                status_verificacao: STATUS.APROVADO,
                observacao_admin: "Cadastrado antes da verificação",
                verificado_por: usuario.uid,
                verificado_em: serverTimestamp(),
                atualizado_em: serverTimestamp()
            });
            feitos++;
        } catch (erro) {
            console.error("Erro ao migrar", p.id, erro);
        }
    }

    aviso(`${feitos} de ${legados.length} produto(s) migrado(s).`);
    btnMigrar.disabled = false;
    btnMigrar.textContent = "Aprovar todos como legado";
    await carregar();
});

btnSair.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/public/login.html";
});

await carregar();