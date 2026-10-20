// Helpers da verificação de produtos (camadas 2 e 3), usados pelo comerciante,
// pelo admin e pela home.

import { escaparHtml } from "../pages/shared/html.js";

export const STATUS = Object.freeze({
    PENDENTE: "pendente",
    APROVADO: "aprovado",
    REPROVADO: "reprovado"
});

export const ROTULOS_STATUS = {
    pendente: "Em análise",
    aprovado: "Verificado",
    reprovado: "Reprovado",
    legado: "Sem status"
};

export const ROTULOS_VEREDITO = {
    consumivel: "Parece próprio para consumo",
    duvida: "Dúvida: precisa de olhar humano",
    improprio: "Sinais de impropriedade",
    imagem_invalida: "Imagem inadequada"
};

// Tamanho máximo do base64 da foto (o documento do Firestore tem limite de 1 MiB).
// Precisa bater com a regra do Firestore (imagem.size() < 800000).
export const LIMITE_IMAGEM_BASE64 = 750000;

// Campos que TODO produto novo (ou com conteúdo alterado) precisa levar.
// As regras do Firestore exigem exatamente isto.
export function camposNovaSubmissao() {
    return {
        status_verificacao: STATUS.PENDENTE,
        parecer_ia: null,
        verificado_por: null,
        verificado_em: null,
        observacao_admin: null
    };
}

// true se o comerciante alterou algo que muda a verificação.
// Só preço e estoque podem mudar sem voltar para análise.
export function mudouConteudo(antigo, novo) {
    const textos = ["nome", "descricao", "imagem"];
    if (textos.some((k) => (antigo[k] || "") !== (novo[k] || ""))) return true;

    return JSON.stringify(antigo.checklist_consumivel ?? null)
        !== JSON.stringify(novo.checklist_consumivel ?? null);
}

export function seloStatusHtml(produto) {
    const status = produto.status_verificacao || "legado";
    const rotulo = ROTULOS_STATUS[status] || status;
    return `<span class="selo-verificacao selo-${escaparHtml(status)}">${escaparHtml(rotulo)}</span>`;
}

export function parecerHtml(parecer) {
    if (!parecer) {
        return `<p class="ia-vazio">Sem parecer da IA ainda.</p>`;
    }

    const rotulo = ROTULOS_VEREDITO[parecer.veredito] || parecer.veredito;
    const confianca = Math.round((Number(parecer.confianca) || 0) * 100);
    const itens = (lista) => (lista || []).map((t) => `<li>${escaparHtml(t)}</li>`).join("");

    return `
        <div class="ia-box ia-${escaparHtml(parecer.veredito)}">
            <p class="ia-titulo">${escaparHtml(rotulo)} <small>(confiança ${confianca}%)</small></p>
            <p class="ia-alimento">Identificado: ${escaparHtml(parecer.alimento_identificado || "—")}
                ${parecer.coerente_com_cadastro === false ? " · <strong>não bate com o nome cadastrado</strong>" : ""}</p>
            <p class="ia-resumo">${escaparHtml(parecer.resumo || "")}</p>
            ${parecer.sinais_positivos?.length ? `<p class="ia-sub">Pontos positivos</p><ul>${itens(parecer.sinais_positivos)}</ul>` : ""}
            ${parecer.sinais_de_alerta?.length ? `<p class="ia-sub">Sinais de alerta</p><ul>${itens(parecer.sinais_de_alerta)}</ul>` : ""}
            <p class="ia-rodape">Apoio automático. A decisão final é do administrador.</p>
        </div>`;
}