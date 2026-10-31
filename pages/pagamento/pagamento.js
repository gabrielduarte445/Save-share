import { auth, db } from "../../public/firebase-config.js";
import { mostrarToast } from "../shared/toast.js";
import { gerarCodigo } from "../shared/codigo.js";
import { protegerPagina } from "../shared/guarda.js";

import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const resumoElemento = document.getElementById("resumo-pedido");
const botaoConfirmar = document.getElementById("btn-confirmar-pagamento");

let usuarioAtual = null;
let todosItensCarrinho = [];
let itensSelecionados = [];
let enderecoEscolhido = null;

const { usuario } = await protegerPagina({ tipos: ["cliente"] });
usuarioAtual = usuario;
await carregarResumo();


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
        const preco = Number(item.preco || item.valor || 0);
        const subtotal = preco * item.quantidade;
        html += `
            <div class="resumo-item">
                <span>${item.quantidade}x ${item.nome}</span>
                <span>R$ ${subtotal.toFixed(2).replace(".", ",")}</span>
            </div>
        `;
    });

    const total = itensSelecionados.reduce(
        (soma, item) => soma + (Number(item.preco || item.valor || 0) * item.quantidade), 0
    );

    html += `
        <div class="resumo-total">
            <span>Total</span>
            <span>R$ ${total.toFixed(2).replace(".", ",")}</span>
        </div>
        <p class="resumo-endereco">
            ${enderecoEscolhido.logradouro}, ${enderecoEscolhido.numero}<br>
            ${enderecoEscolhido.bairro}, ${enderecoEscolhido.cidade}/${enderecoEscolhido.estado}
        </p>
    `;

    resumoElemento.innerHTML = html;
}


botaoConfirmar.addEventListener("click", async () => {

    if (itensSelecionados.length === 0 || !enderecoEscolhido) {
        mostrarToast("Não foi possível processar o pagamento. Volte ao carrinho.", "erro");
        return;
    }

    const inputPagamento = document.querySelector('input[name="forma_pagamento"]:checked');
    const formaPagamento = inputPagamento ? inputPagamento.value : "pix";

    botaoConfirmar.disabled = true;
    botaoConfirmar.textContent = "Processando...";

    try {
        const valorTotal = itensSelecionados.reduce(
            (soma, item) => soma + (Number(item.preco || item.valor || 0) * item.quantidade), 0
        );

        const comercianteId = itensSelecionados[0].comerciante_id;
        const pedidoRef = doc(collection(db, "pedidos"));
        const refCarrinho = doc(db, "carrinhos", usuarioAtual.uid);
        const itensRestantes = todosItensCarrinho.filter((item) => !item.selecionado);

        
        await runTransaction(db, async (transaction) => {

            // 1. LEITURA E VERIFICAÇÃO DE ESTOQUE
            const leiturasEstoque = await Promise.all(
                itensSelecionados.map((item) => {
                    const idProduto = item.produto_id || item.id;
                    const refProd = doc(db, "produtos", idProduto);
                    return transaction.get(refProd);
                })
            );
            
            leiturasEstoque.forEach((docSnap, idx) => {
                const item = itensSelecionados[idx];
                if (!docSnap.exists()) {
                    throw new Error(`O produto "${item.nome}" não está mais disponível.`);
                }
                const estoqueAtual = docSnap.data().estoque || 0;
                if (estoqueAtual < item.quantidade) {
                    throw new Error(`Estoque insuficiente para "${item.nome}". Restantes: ${estoqueAtual}`);
                }
            });

            // 2. ABATE DE ESTOQUE
            leiturasEstoque.forEach((docSnap, idx) => {
                const item = itensSelecionados[idx];
                const refProd = docSnap.ref;
                const novoEstoque = docSnap.data().estoque - item.quantidade;
                transaction.update(refProd, { estoque: novoEstoque });
            });

            // 3. GRAVAÇÃO DO PEDIDO (COM OS CÓDIGOS INCLUÍDOS NA RAIZ)
            transaction.set(pedidoRef, {
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
                status: "aguardando_confirmacao",
                codigo_retirada: gerarCodigo(), 
                codigo_entrega: gerarCodigo()  
            });

            // 4. ATUALIZAÇÃO DO CARRINHO
            if (itensRestantes.length === 0) {
                transaction.delete(refCarrinho);
            } else {
                transaction.set(refCarrinho, { itens: itensRestantes, atualizado_em: new Date() });
            }
        });

        mostrarToast("Pagamento confirmado! Seu pedido foi realizado.", "sucesso");

        setTimeout(() => {
            window.location.href = "../../public/meus_pedidos.html";
        }, 1200);

    } catch (erro) {
        console.error("Erro ao processar pagamento:", erro);
        mostrarToast(erro.message || "Não foi possível processar o pagamento. Tente novamente.", "erro");
        botaoConfirmar.disabled = false;
        botaoConfirmar.textContent = "Confirmar Pagamento";
    }
});