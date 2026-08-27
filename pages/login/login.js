import { auth, db } from "../../public/firebase-config.js";

import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const formulario = document.querySelector(".form-login");

const campoEmail = document.getElementById("email");
const campoSenha = document.getElementById("password");


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
        container.insertAdjacentElement(
            "afterend",
            erro
        );
    }

    campo.style.border = "1px solid #d32f2f";
}


function removerErro(campo) {

    const container = campo.closest(".input-container");

    const erro = container
        ? container.nextElementSibling
        : campo.nextElementSibling;

    if (
        erro &&
        erro.classList.contains("mensagem-erro-login")
    ) {
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


    // =========================
    // VALIDAR EMAIL
    // =========================

    if (!email) {

        mostrarErro(
            campoEmail,
            "Digite seu e-mail."
        );

        campoEmail.focus();

        return;
    }


    const emailValido =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);


    if (!emailValido) {

        mostrarErro(
            campoEmail,
            "Digite um e-mail válido."
        );

        campoEmail.focus();

        return;
    }


    // =========================
    // VALIDAR SENHA
    // =========================

    if (!senha) {

        mostrarErro(
            campoSenha,
            "Digite sua senha."
        );

        campoSenha.focus();

        return;
    }


    try {

        // =========================
        // LOGIN FIREBASE
        // =========================

        const resultado =
            await signInWithEmailAndPassword(
                auth,
                email,
                senha
            );


        const usuario = resultado.user;

        console.log(
            "Login realizado!"
        );

        console.log(
            "UID:",
            usuario.uid
        );


        // =========================
        // BUSCAR USUÁRIO
        // =========================

        const referenciaUsuario = doc(
            db,
            "usuarios",
            usuario.uid
        );


        const documentoUsuario =
            await getDoc(
                referenciaUsuario
            );


        if (!documentoUsuario.exists()) {

            mostrarErro(
                campoEmail,
                "Os dados deste usuário não foram encontrados."
            );

            return;
        }


        const dadosUsuario =
            documentoUsuario.data();


        console.log(
            "Dados do usuário:",
            dadosUsuario
        );


        // =========================
        // TIPO DE USUÁRIO
        // =========================

        const tipoEscolhido =
            document.querySelector(
                'input[name="tipo_usuario"]:checked'
            ).value;


        if (
            dadosUsuario.tipo_usuario !==
            tipoEscolhido
        ) {

            mostrarErro(
                campoEmail,
                "O tipo de usuário selecionado não corresponde à sua conta."
            );

            return;
        }


        console.log(
            "Tipo confirmado:",
            dadosUsuario.tipo_usuario
        );


        // =========================
        // ENTRAR
        // =========================

        window.location.href =
            "pagina-inicial.html";


    } catch (erro) {

        console.error(
            "Erro no login:",
            erro
        );


        if (
            erro.code ===
            "auth/invalid-credential"
        ) {

            mostrarErro(
                campoEmail,
                "E-mail ou senha incorretos."
            );

            return;
        }


        if (
            erro.code ===
            "auth/user-not-found"
        ) {

            mostrarErro(
                campoEmail,
                "Usuário não encontrado."
            );

            return;
        }


        if (
            erro.code ===
            "auth/wrong-password"
        ) {

            mostrarErro(
                campoSenha,
                "Senha incorreta."
            );

            return;
        }


        if (
            erro.code ===
            "auth/invalid-email"
        ) {

            mostrarErro(
                campoEmail,
                "Digite um e-mail válido."
            );

            return;
        }


        mostrarErro(
            campoEmail,
            "Não foi possível realizar o login."
        );

    }

});