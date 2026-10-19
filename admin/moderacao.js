import { db } from "/public/firebase-config.js";
import { protegerPagina } from "../shared/guarda.js";
import { mostrarToast, confirmarAcao } from "../shared/toast.js";
import { analisarImagemProduto } from "../servicos/analise-ia.js";

import {
    collection,
    doc,
    updateDoc,
    query,
    where,
    onSnapshot
} from "[https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js](https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js)";

const GEMINI_API_KEY = window.ENV?.GEMINI_API_KEY || "";

const listaPendentes = document.getElementById("lista-pendentes");
const mensagemVazia = document.getElementById("mensagem-vazia-admin");
const contadorPendentes = document.getElementById("contador-pendentes");

await protegerPagina({ permitirAdmin: true });

escutarProdutosPendentes();

function escutarProdutosPendentes() {
    const produtosRef = collection(db, "produtos");
    const consulta = query(produtosRef, where("status_verificacao", "==", "pendente"));

    onSnapshot(consulta, (snapshot) => {
        if (contadorPendentes) contadorPendentes.textContent = snapshot.size;

        if (snapshot.empty) {
            listaPendentes.innerHTML = "";
            if (mensagemVazia) mensagemVazia.style.display = "block";
            return;
        }

        if (mensagemVazia) mensagemVazia.style.display = "none";
        listaPendentes.innerHTML = "";

        snapshot.docs.forEach((docSnap) => {
            const produto = docSnap.data();
            const card = criarCardModeracao(docSnap.id, produto);
            listaPendentes.appendChild(card);
        });
    });
}

function criarCardModeracao(id, produto) {
    const card = document.createElement("article");
    card.className = "card-moderacao";

    const parecerIA = produto.parecer_ia || null;
    let htmlIA = "";

    if (parecerIA) {
        const corClasse = parecerIA.diagnostico === "provável bom estado" ? "ia-sucesso" : "ia-alerta";
        htmlIA = `
            <div class="bloco-ia ${corClasse}">
                <strong>🤖 Diagnóstico IA:</strong> ${parecerIA.diagnostico}
                <p>${parecerIA.motivo}</p>
            </div>
        `;
    } else {
        htmlIA = `
            <div class="bloco-ia sem-analise">
                <button type="button" class="btn-analisar-ia">🤖 Executar Parecer da IA</button>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="card-detalhes">
            <h3>${produto.nome}</h3>
            <p>${produto.descricao || ""}</p>
        </div>
        <div class="card-ia-secao">
            ${htmlIA}
        </div>
        <div class="card-acoes">
            <button type="button" class="btn-aprovar">✓ Aprovar</button>
            <button type="button" class="btn-rejeitar">✕ Rejeitar</button>
        </div>
    `;

    const btnAnalisar = card.querySelector(".btn-analisar-ia");
    if (btnAnalisar) {
        btnAnalisar.addEventListener("click", () => processarAnaliseIA(id, produto, btnAnalisar));
    }

    return card;
}


async function processarAnaliseIA(idProduto, produto, btnElemento) {
    if (!GEMINI_API_KEY) {
        mostrarToast("Chave da API Gemini não foi configurada no env.js", "erro");
        return;
    }

    btnElemento.disabled = true;
    btnElemento.textContent = "🤖 Analisando imagem...";

    const fotoInspecao = produto.midias_inspecao?.find(m => m.tipo === "imagem")?.url || produto.foto_url;

    if (!fotoInspecao) {
        mostrarToast("Nenhuma foto disponível para análise.", "erro");
        btnElemento.disabled = false;
        btnElemento.textContent = "🤖 Executar Parecer da IA";
        return;
    }

    try {
  
        let base64Image = fotoInspecao;
        if (fotoInspecao.startsWith("http")) {
            const res = await fetch(fotoInspecao);
            const blob = await res.blob();
            base64Image = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        }

        const resultadoIA = await analisarImagemProduto(base64Image, GEMINI_API_KEY);

        // 4. Salva o resultado no documento do produto no Firestore
        await updateDoc(doc(db, "produtos", idProduto), {
            parecer_ia: {
                diagnostico: resultadoIA.diagnostico,
                motivo: resultadoIA.motivo,
                analisado_em: new Date().toISOString()
            }
        });

        mostrarToast("Parecer da IA atualizado!", "sucesso");

    } catch (erro) {
        console.error("Falha ao rodar IA:", erro);
        mostrarToast("Erro ao processar análise da IA.", "erro");
        btnElemento.disabled = false;
        btnElemento.textContent = "🤖 Tentar Novamente";
    }
}