import { auth, db } from "/public/firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const formulario = document.getElementById("perfilForm");
const botaoSalvar = document.getElementById("btn-salvar-perfil");
const botaoSair = document.getElementById("btn-sair");
const mensagemStatus = document.getElementById("mensagem-status");

const campoNome = document.getElementById("nome");
const campoEmail = document.getElementById("email");
const campoTelefone = document.getElementById("telefone");
const campoTipoDisplay = document.getElementById("tipo-usuario-display");

const enderecoTexto = document.getElementById("endereco-perfil-texto");

const inputFoto = document.getElementById("foto");
const avatarPreview = document.getElementById("avatar-preview");
const avatarIcone = document.getElementById("avatar-icone");

let usuarioAtual = null;


onAuthStateChanged(auth, async (usuario) => {

    if (!usuario) {
        window.location.href = "/public/login.html";
        return;
    }

    usuarioAtual = usuario;

    await carregarDadosUsuario();
    await carregarEnderecoPrincipal();
});


async function carregarDadosUsuario() {

    try {
        const refUsuario = doc(db, "usuarios", usuarioAtual.uid);
        const docUsuario = await getDoc(refUsuario);

        campoEmail.value = usuarioAtual.email || "";

        if (docUsuario.exists()) {
            const dados = docUsuario.data();
            campoNome.value = dados.nome || "";
            campoTelefone.value = dados.telefone || "";
            campoTipoDisplay.value = dados.tipo_usuario === "comerciante" ? "Comerciante" : "Cliente";
        }

    } catch (erro) {
        console.error("Erro ao carregar dados do usuário:", erro);
        mostrarStatus("Não foi possível carregar seus dados.", "erro");
    }
}


async function carregarEnderecoPrincipal() {

    try {
        const enderecosRef = collection(db, "enderecos");
        const consulta = query(enderecosRef, where("usuario_id", "==", usuarioAtual.uid));
        const resultado = await getDocs(consulta);

        if (resultado.empty) {
            enderecoTexto.textContent = "Nenhum endereço cadastrado ainda.";
            return;
        }

        let enderecoDoc = resultado.docs.find((d) => d.data().padrao);
        if (!enderecoDoc) {
            enderecoDoc = resultado.docs[0];
        }

        const endereco = enderecoDoc.data();
        enderecoTexto.textContent =
            `${endereco.logradouro}, ${endereco.numero} - ${endereco.bairro}, ${endereco.cidade}/${endereco.estado}`;

    } catch (erro) {
        console.error("Erro ao carregar endereço:", erro);
        enderecoTexto.textContent = "Não foi possível carregar o endereço.";
    }
}

// PREVIEW DE FOTO (local, sem upload ainda)
inputFoto.addEventListener("change", (event) => {

    const arquivo = event.target.files[0];
    if (!arquivo) return;

    const leitor = new FileReader();

    leitor.onload = (e) => {
        avatarPreview.src = e.target.result;
        avatarPreview.style.display = "block";
        avatarIcone.style.display = "none";
    };

    leitor.readAsDataURL(arquivo);
});

// SALVAR ALTERAÇÕES

formulario.addEventListener("submit", async (event) => {

    event.preventDefault();

    const nome = campoNome.value.trim();
    const telefone = campoTelefone.value.trim();

    if (!nome) {
        mostrarStatus("O nome não pode ficar vazio.", "erro");
        return;
    }

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    try {
        const refUsuario = doc(db, "usuarios", usuarioAtual.uid);
        await updateDoc(refUsuario, {
            nome: nome,
            telefone: telefone
        });

        mostrarStatus("Perfil atualizado com sucesso!", "sucesso");

    } catch (erro) {
        console.error("Erro ao salvar perfil:", erro);
        mostrarStatus("Não foi possível salvar. Tente novamente.", "erro");

    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = "Salvar alterações";
    }
});


function mostrarStatus(texto, tipo) {

    mensagemStatus.textContent = texto;
    mensagemStatus.className = `mensagem-status ${tipo}`;
    mensagemStatus.style.display = "block";

    setTimeout(() => {
        mensagemStatus.style.display = "none";
    }, 4000);
}


// =========================
// SAIR DA CONTA
// =========================

botaoSair.addEventListener("click", async () => {

    const confirmar = confirm("Tem certeza que deseja sair da sua conta?");
    if (!confirmar) return;

    try {
        await signOut(auth);
        window.location.href = "/public/login.html";
    } catch (erro) {
        console.error("Erro ao sair:", erro);
        alert("Não foi possível sair. Tente novamente.");
    }
});