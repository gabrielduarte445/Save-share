import { auth, db } from "../../public/firebase-config.js";
import { mostrarToast } from "../shared/toast.js";
import { gerarCodigo } from "../shared/codigo.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const resumoElemento = document.getElementById("resumo-pedido");
const botaoConfirmar = document.getElementById("btn-confirmar-pagamento");

let usuarioAtual = null;
let todosItensCarrinho = [];
let itensSelecionados = [];
let enderecoEscolhido = null;


onAuthStateChanged(auth, async (usuario) => {

    if (!usuario) {
        window.location.href = "/public/login.html";
        return;
    }

    usuarioAtual = usuario;
    await carregarResumo();
});


async function carregarResumo() {

    try {
        const refCarrinho = doc(db, "carrinhos", usuarioAtual.uid);
        const docCarrinho = await getDoc(refCarrinho);

        todosItensCarrinho = docCarrinho.exists() ? (docCarrinho.data().itens || []) : [];
        itensSelecionados = todosItensCarrinho.filter((item) => item.selecionado);

        if (itensSelecionados.length === 0) {
            resumoElemento.innerHTML = `<p class="empty-message">Nenhum item selecionado. Volte ao carrinho.</p>`;
            botaoConfirmar.disabled = true;
            return;
        }

        const enderecosRef = collection(db, "enderecos");
        const consulta = query(enderecosRef, where("usuario_id", "==", usuarioAtual.uid));
        const resultado = await getDocs(consulta);

        if (resultado.empty) {
            resumoElemento.innerHTML = `<p class="empty-message">Nenhum endereço cadastrado. Volte ao carrinho.</p>`;
            botaoConfirmar.disabled = true;
            return;
        }

        let escolhido = resultado.docs.find((d) => d.data().padrao);
        if (!escolhido) {
            escolhido = resultado.docs[0];
        }

        enderecoEscolhido = { id: escolhido.id, ...escolhido.data() };

        renderizarResumo();

    } catch (erro) {
        console.error("Erro ao carregar resumo:", erro);
        resumoElemento.innerHTML = `<p class="empty-message">Erro ao carregar o resumo do pedido.</p>`;
        botaoConfirmar.disabled = true;
    }
}


function renderizarResumo() {

    let html = "";

    itensSelecionados.forEach((item) => {
        const subtotal = item.preco * item.quantidade;
        html += `
            <div class="resumo-item">
                <span>${item.quantidade}x ${item.nome}</span>
                <span>R$ ${subtotal.toFixed(2)}</span>
            </div>
        `;
    });

    const total = itensSelecionados.reduce(
        (soma, item) => soma + (item.preco * item.quantidade), 0
    );

    html += `
        <div class="resumo-total">
            <span>Total</span>
            <span>R$ ${total.toFixed(2)}</span>
        </div>
        <p class="resumo-endereco">
             ${enderecoEscolhido.logradouro}, ${enderecoEscolhido.numero} - ${enderecoEscolhido.bairro}, ${enderecoEscolhido.cidade}/${enderecoEscolhido.estado}
        </p>
    `;

    resumoElemento.innerHTML = html;
}


botaoConfirmar.addEventListener("click", async () => {

    if (itensSelecionados.length === 0 || !enderecoEscolhido) {
        mostrarToast("Não foi possível processar o pagamento. Volte ao carrinho.", "erro");
        return;
    }

    const formaPagamento = document.querySelector('input[name="forma_pagamento"]:checked').value;

    botaoConfirmar.disabled = true;
    botaoConfirmar.textContent = "Processando...";

    try {

        const valorTotal = itensSelecionados.reduce(
            (soma, item) => soma + (item.preco * item.quantidade), 0
        );

        // ⚠️ LIMITAÇÃO CONHECIDA — REVISAR DEPOIS:
        // Assumimos que todos os itens do carrinho são do MESMO comerciante.
        // Solução futura: agrupar itensSelecionados por comerciante_id e criar
        // um pedido para cada grupo (um por loja).
        const comercianteId = itensSelecionados[0].comerciante_id;

        const pedidoRef = doc(collection(db, "pedidos"));
        const refCarrinho = doc(db, "carrinhos", usuarioAtual.uid);
        const itensRestantes = todosItensCarrinho.filter((item) => !item.selecionado);

        // Tudo em um único lote: ou grava tudo, ou não grava nada.
        const lote = writeBatch(db);

        lote.set(pedidoRef, {
            cliente_id: usuarioAtual.uid,
            comerciante_id: comercianteId,
            entregador_id: null,
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
            forma_pagamento: formaPagamento,
            data_hora_pedido: new Date(),
            valor_total: valorTotal,
            tipo_entrega: "entrega",
            status: "aguardando_confirmacao"
        });

        // Código de entrega: só o cliente (dono) consegue lê-lo depois.
        lote.set(doc(db, "pedidos", pedidoRef.id, "privado", "codigo_entrega"), {
            codigo: gerarCodigo()
        });

        if (itensRestantes.length === 0) {
            lote.delete(refCarrinho);
        } else {
            lote.set(refCarrinho, { itens: itensRestantes, atualizado_em: new Date() });
        }

        await lote.commit();

        mostrarToast("Pagamento confirmado! Seu pedido foi realizado.", "sucesso");

        setTimeout(() => {
            window.location.href = "/public/meus-pedidos.html";
        }, 1200);

    } catch (erro) {
        console.error("Erro ao processar pagamento:", erro);
        mostrarToast("Não foi possível processar o pagamento. Tente novamente.", "erro");
        botaoConfirmar.disabled = false;
        botaoConfirmar.textContent = "Confirmar Pagamento";
    }
});