import { auth, db } from "../../public/firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const listaElemento = document.getElementById("lista-selecao");
const botaoNovo = document.getElementById("btn-novo-endereco-checkout");
const botaoConfirmar = document.getElementById("btn-confirmar-selecao");

let usuarioAtual = null;
let enderecoSelecionadoId = null;


botaoNovo.addEventListener("click", () => {
    window.location.href = "../../public/cadastro_clienteendereco.html?retorno=checkout";
});


onAuthStateChanged(auth, async (usuario) => {

    if (!usuario) {
        window.location.href = "/login.html";
        return;
    }

    usuarioAtual = usuario;
    await carregarEnderecos();
});


async function carregarEnderecos() {

    listaElemento.innerHTML = `<p class="empty-message">Carregando endereços...</p>`;

    try {
        const enderecosRef = collection(db, "enderecos");
        const consulta = query(enderecosRef, where("usuario_id", "==", usuarioAtual.uid));
        const resultado = await getDocs(consulta);

        if (resultado.empty) {
            listaElemento.innerHTML = `<p class="empty-message">Nenhum endereço cadastrado ainda.</p>`;
            return;
        }

        listaElemento.innerHTML = "";

        resultado.docs.forEach((docSnap) => {
            const endereco = docSnap.data();
            const card = criarCardSelecao(docSnap.id, endereco);
            listaElemento.appendChild(card);

            // Pré-seleciona o que já está marcado como padrão
            if (endereco.padrao) {
                selecionarEndereco(docSnap.id, card);
            }
        });

    } catch (erro) {
        console.error("Erro ao carregar endereços:", erro);
        listaElemento.innerHTML = `<p class="empty-message">Erro ao carregar endereços.</p>`;
    }
}


function criarCardSelecao(id, endereco) {

    const card = document.createElement("label");
    card.className = "endereco-card-selecao";
    card.dataset.id = id;

    card.innerHTML = `
        <input type="radio" name="endereco-selecao" value="${id}">
        <div class="endereco-texto">
            <strong>${endereco.logradouro}, ${endereco.numero}</strong>
            ${endereco.bairro} - ${endereco.cidade}/${endereco.estado}
        </div>
    `;

    card.addEventListener("click", () => selecionarEndereco(id, card));

    return card;
}


function selecionarEndereco(id, card) {

    document.querySelectorAll(".endereco-card-selecao").forEach((elemento) => {
        elemento.classList.remove("selecionado");
        elemento.querySelector("input").checked = false;
    });

    card.classList.add("selecionado");
    card.querySelector("input").checked = true;

    enderecoSelecionadoId = id;
    botaoConfirmar.disabled = false;
}


botaoConfirmar.addEventListener("click", async () => {

    if (!enderecoSelecionadoId) {
        alert("Selecione um endereço antes de confirmar.");
        return;
    }

    botaoConfirmar.disabled = true;
    botaoConfirmar.textContent = "Confirmando...";

    try {
        // Marca o endereço escolhido como padrão (o carrinho já lê o padrão)
        const enderecosRef = collection(db, "enderecos");
        const consulta = query(enderecosRef, where("usuario_id", "==", usuarioAtual.uid));
        const resultado = await getDocs(consulta);

        const lote = writeBatch(db);

        resultado.docs.forEach((docSnap) => {
            const refDoc = doc(db, "enderecos", docSnap.id);
            lote.update(refDoc, { padrao: docSnap.id === enderecoSelecionadoId });
        });

        await lote.commit();

        window.location.href = "../../public/carrinho.html";

    } catch (erro) {
        console.error("Erro ao confirmar endereço:", erro);
        alert("Não foi possível confirmar o endereço selecionado.");
        botaoConfirmar.disabled = false;
        botaoConfirmar.textContent = "Confirmar";
    }
});