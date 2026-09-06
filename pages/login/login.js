import { auth, db } from "/public/firebase-config.js";

import {
    signInWithEmailAndPassword,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const formulario = document.querySelector(".form-login");
const campoEmail = document.getElementById("email");
const campoSenha = document.getElementById("password");
const checkboxLembrar = document.getElementById("lembrar-de-mim");

const botaoToggleSenha = document.getElementById("btn-toggle-senha");
const iconeOlho = document.getElementById("icone-olho");


// =========================
// MOSTRAR/OCULTAR SENHA
// =========================

botaoToggleSenha.addEventListener("click", () => {

    const visivel = campoSenha.type === "text";

    campoSenha.type = visivel ? "password" : "text";

    iconeOlho.innerHTML = visivel
        ? `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`
        : `<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;

    botaoToggleSenha.setAttribute(
        "aria-label",
        visivel ? "Mostrar senha" : "Ocultar senha"
    );
});


// =========================
// MENSAGENS DE ERRO (mais amigáveis)
// =========================

function mostrarErro(campo, mensagem) {

    removerErro(campo);

    const erro = document.createElement("small");

    erro.className = "mensagem-erro-login";
    erro.textContent = mensagem;

    erro.style.display = "block";
    erro.style.color = "#d32f2f";
    erro.style.fontSize = "13px";
    erro.style.marginTop = "5px";

    const container = campo.closest(".input-container");

    if (container) {
        container.insertAdjacentElement("afterend", erro);
    }

    campo.style.border = "1px solid #d32f2f";
}


function removerErro(campo) {

    const container = campo.closest(".input-container");
    const erro = container ? container.nextElementSibling : campo.nextElementSibling;

    if (erro && erro.classList.contains("mensagem-erro-login")) {
        erro.remove();
    }

    campo.style.border = "";
}


formulario.addEventListener("submit", async (event) => {

    event.preventDefault();

    removerErro(campoEmail);
    removerErro(campoSenha);

    const email = campoEmail.value.trim();
    const senha = campoSenha.value;

    if (!email) {
        mostrarErro(campoEmail, "Digite seu e-mail para continuar.");
        campoEmail.focus();
        return;
    }

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!emailValido) {
        mostrarErro(campoEmail, "Esse e-mail não parece válido. Confira e tente de novo.");
        campoEmail.focus();
        return;
    }

    if (!senha) {
        mostrarErro(campoSenha, "Digite sua senha para continuar.");
        campoSenha.focus();
        return;
    }

    try {

        // =========================
        // LEMBRAR DE MIM
        // =========================

        const persistencia = checkboxLembrar.checked
            ? browserLocalPersistence
            : browserSessionPersistence;

        await setPersistence(auth, persistencia);


        // =========================
        // LOGIN FIREBASE
        // =========================

        const resultado = await signInWithEmailAndPassword(auth, email, senha);
        const usuario = resultado.user;

        const referenciaUsuario = doc(db, "usuarios", usuario.uid);
        const documentoUsuario = await getDoc(referenciaUsuario);

        if (!documentoUsuario.exists()) {
            mostrarErro(campoEmail, "Não encontramos seu cadastro. Fale com o suporte se o problema continuar.");
            return;
        }

        const dadosUsuario = documentoUsuario.data();
        const tipoEscolhido = document.querySelector('input[name="tipo_usuario"]:checked').value;

        if (dadosUsuario.tipo_usuario !== tipoEscolhido) {
            mostrarErro(
                campoEmail,
                `Essa conta está cadastrada como "${dadosUsuario.tipo_usuario}". Selecione essa opção acima para entrar.`
            );
            return;
        }

        window.location.href = "/public/home.html";

    } catch (erro) {

        console.error("Erro no login:", erro);

        if (erro.code === "auth/invalid-credential") {
            mostrarErro(campoSenha, "E-mail ou senha incorretos. Vamos tentar de novo?");
            return;
        }
        if (erro.code === "auth/user-not-found") {
            mostrarErro(campoEmail, "Não encontramos uma conta com esse e-mail.");
            return;
        }
        if (erro.code === "auth/wrong-password") {
            mostrarErro(campoSenha, "Senha incorreta. Confira e tente novamente.");
            return;
        }
        if (erro.code === "auth/invalid-email") {
            mostrarErro(campoEmail, "Esse e-mail não parece válido. Confira e tente de novo.");
            return;
        }
        if (erro.code === "auth/too-many-requests") {
            mostrarErro(campoSenha, "Muitas tentativas seguidas. Aguarde um instante antes de tentar de novo.");
            return;
        }
        if (erro.code === "auth/network-request-failed") {
            mostrarErro(campoEmail, "Falha de conexão. Verifique sua internet e tente novamente.");
            return;
        }

        mostrarErro(campoEmail, "Algo deu errado ao entrar. Tente novamente em instantes.");
    }

});