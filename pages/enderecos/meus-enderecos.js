import { auth, db } from "/public/firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    query,
    where,
    getDocs,
    doc,
    deleteDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const listaElemento = document.getElementById("lista-enderecos");
const botaoNovo = document.getElementById("btn-novo-endereco");

let usuarioAtual = null;


botaoNovo.addEventListener("click", () => {
    window.location.href = "/public/cadastro_clienteendereco.html";
});


onAuthStateChanged(auth, async (usuario) => {

    if (!usuario) {
        window.location.href = "/public/login.html";
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
            const card = criarCardEndereco(docSnap.id, endereco);
            listaElemento.appendChild(card);
        });

    } catch (erro) {
        console.error("Erro ao carregar endereços:", erro);
        listaElemento.innerHTML = `<p class="empty-message">Erro ao carregar endereços.</p>`;
    }
}


function criarCardEndereco(id, endereco) {

    const card = document.createElement("div");
    card.className = "endereco-card";
    if (endereco.padrao) {
        card.classList.add("endereco-padrao");
    }

    card.innerHTML = `
        <div class="endereco-info">
            <p class="endereco-rua">${endereco.logradouro}, ${endereco.numero}</p>
            <p class="endereco-detalhe">${endereco.bairro} - ${endereco.cidade}/${endereco.estado}</p>
            <p class="endereco-detalhe">CEP: ${endereco.cep}</p>
            ${endereco.padrao ? '<span class="badge-padrao">⭐ Padrão</span>' : ''}
        </div>
        <div class="endereco-acoes">
            <button type="button" class="btn-endereco-editar" data-id="${id}">Editar</button>
            ${!endereco.padrao ? `<button type="button" class="btn-endereco-padrao" data-id="${id}">Definir padrão</button>` : ''}
            <button type="button" class="btn-endereco-excluir" data-id="${id}">Excluir</button>
        </div>
    `;

    card.querySelector(".btn-endereco-editar").addEventListener("click", () => {
        window.location.href = `/public/cadastro_clienteendereco.html?id=${id}`;
    });

    const botaoPadrao = card.querySelector(".btn-endereco-padrao");
    if (botaoPadrao) {
        botaoPadrao.addEventListener("click", () => definirComoPadrao(id));
    }

    card.querySelector(".btn-endereco-excluir").addEventListener("click", () => excluirEndereco(id));

    return card;
}


async function definirComoPadrao(idEscolhido) {

    try {
        const enderecosRef = collection(db, "enderecos");
        const consulta = query(enderecosRef, where("usuario_id", "==", usuarioAtual.uid));
        const resultado = await getDocs(consulta);

        const lote = writeBatch(db);

        resultado.docs.forEach((docSnap) => {
            const refDoc = doc(db, "enderecos", docSnap.id);
            lote.update(refDoc, { padrao: docSnap.id === idEscolhido });
        });

        await lote.commit();
        await carregarEnderecos();

    } catch (erro) {
        console.error("Erro ao definir endereço padrão:", erro);
        alert("Não foi possível definir o endereço padrão.");
    }
}


async function excluirEndereco(id) {

    const confirmar = confirm("Tem certeza que deseja excluir este endereço?");
    if (!confirmar) return;

    try {
        await deleteDoc(doc(db, "enderecos", id));
        await carregarEnderecos();

    } catch (erro) {
        console.error("Erro ao excluir endereço:", erro);
        alert("Não foi possível excluir o endereço.");
    }
}