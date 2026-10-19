import { auth, db } from "/public/firebase-config.js";

import {
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
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
const botaoGoogle = document.getElementById("btn-google");

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
function destinoDoTipo(tipo) {
    return tipo === "entregador"
        ? "/public/pedidos-disponiveis.html"
        : "/public/home.html";
}

// A persistência é definida ANTES do clique: um await antes do popup
// pode fazer o navegador bloquear a janela do Google.
function aplicarPersistencia() {
    const persistencia = checkboxLembrar.checked
        ? browserLocalPersistence
        : browserSessionPersistence;

    setPersistence(auth, persistencia).catch((erro) => {
        console.error("Erro ao definir persistência:", erro);
    });
}

aplicarPersistencia();
checkboxLembrar.addEventListener("change", aplicarPersistencia);


botaoGoogle.addEventListener("click", async () => {

    removerErro(campoEmail);
    removerErro(campoSenha);
    botaoGoogle.disabled = true;

    try {
        const resultado = await signInWithPopup(auth, new GoogleAuthProvider());
        const usuario = resultado.user;

        const snap = await getDoc(doc(db, "usuarios", usuario.uid));
        const tipoEscolhido = document.querySelector('input[name="tipo_usuario"]:checked').value;

        // Primeiro acesso: ainda não existe cadastro no sistema
        if (!snap.exists()) {
            window.location.href = `../../public/completar-cadastro.html?tipo=${encodeURIComponent(tipoEscolhido)}`;
            return;
        }

        const tipoDaConta = snap.data().tipo_usuario;

        if (tipoDaConta !== tipoEscolhido) {
            mostrarErro(
                campoEmail,
                `Essa conta está cadastrada como "${tipoDaConta}". Selecione essa opção acima para entrar.`
            );
            return;
        }

        window.location.href = destinoDoTipo(tipoDaConta);

    } catch (erro) {

        console.error("Erro no login com Google:", erro);

        if (erro.code === "auth/popup-closed-by-user" || erro.code === "auth/cancelled-popup-request") {
            return;
        }

        const mensagens = {
            "auth/popup-blocked": "O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente de novo.",
            "auth/unauthorized-domain": "Este endereço não está autorizado para login com Google.",
            "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente novamente.",
            "auth/account-exists-with-different-credential": "Já existe uma conta com esse e-mail usando outro método. Entre com e-mail e senha."
        };

        mostrarErro(campoEmail, mensagens[erro.code] || "Não foi possível entrar com o Google. Tente novamente.");

    } finally {
        botaoGoogle.disabled = false;
    }
});


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


        // LEMBRAR DE MIM
        const persistencia = checkboxLembrar.checked
            ? browserLocalPersistence
            : browserSessionPersistence;

        await setPersistence(auth, persistencia);


        // LOGIN FIREBASE

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

        // REDIRECIONAMENTO POR TIPO DE USUÁRIO

        if (dadosUsuario.tipo_usuario === "entregador") {
            window.location.href = "../../public/pedidos_disponiveis.html";
        } else {
            window.location.href = "../../public/home.html";
        }

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