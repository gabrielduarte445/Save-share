import { auth, db } from "../../public/firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
    addDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const resumoElemento = document.getElementById("resumo-pedido");
const botaoConfirmar = document.getElementById("btn-confirmar-pagamento");

let usuarioAtual = null;
let itensSelecionados = [];
let enderecoEscolhido = null;


onAuthStateChanged(auth, async (usuario) => {

    if (!usuario) {
        window.location.href = "/login.html";
        return;
    }

    usuarioAtual = usuario;
    await carregarResumo();
});


async function carregarResumo() {

    try {
        // Carrega o carrinho
        const refCarrinho = doc(db, "carrinhos", usuarioAtual.uid);
        const docCarrinho = await getDoc(refCarrinho);

        const itensCarrinho = docCarrinho.exists() ? (docCarrinho.data().itens || []) : [];
        itensSelecionados = itensCarrinho.filter((item) => item.selecionado);

        if (itensSelecionados.length === 0) {
            resumoElemento.innerHTML = `<p class="empty-message">Nenhum item selecionado. Volte ao carrinho.</p>`;
            botaoConfirmar.disabled = true;
            return;
        }

        // Carrega o endereço padrão
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
            📍 ${enderecoEscolhido.logradouro}, ${enderecoEscolhido.numero} - ${enderecoEscolhido.bairro}, ${enderecoEscolhido.cidade}/${enderecoEscolhido.estado}
        </p>
    `;

    resumoElemento.innerHTML = html;
}


botaoConfirmar.addEventListener("click", async () => {

    if (itensSelecionados.length === 0 || !enderecoEscolhido) {
        alert("Não foi possível processar o pagamento. Volte ao carrinho.");
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
        // Assumimos aqui que todos os itens do carrinho são do MESMO comerciante.
        // Solução futura: agrupar itensSelecionados por comerciante_id e criar
        // um addDoc() em "pedidos" para cada grupo (um pedido por loja).
        const comercianteId = itensSelecionados[0].comerciante_id;

        const pedidosRef = collection(db, "pedidos");
        await addDoc(pedidosRef, {
            usuario_id: usuarioAtual.uid,
            cliente_id: usuarioAtual.uid,
            comerciante_id: comercianteId,
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
            status: "postado"
        });

        // Remove do carrinho só os itens comprados
        const refCarrinho = doc(db, "carrinhos", usuarioAtual.uid);
        const docCarrinho = await getDoc(refCarrinho);
        let itensRestantes = docCarrinho.exists() ? (docCarrinho.data().itens || []) : [];
        itensRestantes = itensRestantes.filter((item) => !item.selecionado);

        if (itensRestantes.length === 0) {
            await deleteDoc(refCarrinho);
        } else {
            await setDoc(refCarrinho, { itens: itensRestantes, atualizado_em: new Date() });
        }

        alert("Pagamento confirmado! Seu pedido foi realizado. Pagina de pedidos em andamento");


    } catch (erro) {
        console.error("Erro ao processar pagamento:", erro);
        alert("Não foi possível processar o pagamento. Tente novamente.");
        botaoConfirmar.disabled = false;
        botaoConfirmar.textContent = "Confirmar Pagamento";
    }
});