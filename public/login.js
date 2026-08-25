import { auth, db } from "./firebase-config.js";

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

const radCliente = document.getElementById("cliente");
const radComerciante = document.getElementById("comerciante");


formulario.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email = campoEmail.value.trim();
    const senha = campoSenha.value;

    const tipoEscolhido = document.querySelector(
        'input[name="tipo_usuario"]:checked'
    ).value;


    try {


        const resultado = await signInWithEmailAndPassword(
            auth,
            email,
            senha
        );

        const usuario = resultado.user;

        console.log("Login realizado!");
        console.log("UID:", usuario.uid);



        const referenciaUsuario = doc(
            db,
            "usuarios",
            usuario.uid
        );

        const documentoUsuario = await getDoc(
            referenciaUsuario
        );



        if (!documentoUsuario.exists()) {

            console.error(
                "Usuário autenticado, mas não encontrado no Firestore."
            );

            alert(
                "Os dados deste usuário não foram encontrados."
            );

            return;
        }



        const dadosUsuario = documentoUsuario.data();

        console.log("Dados do usuário:", dadosUsuario);



        if (dadosUsuario.tipo_usuario !== tipoEscolhido) {

            alert(
                "O tipo de usuário selecionado não corresponde à sua conta."
            );

            return;
        }

        console.log(
            "Tipo de usuário confirmado:",
            dadosUsuario.tipo_usuario
        );


        if (dadosUsuario.tipo_usuario === "cliente") {

            window.location.href = "pagina-inicial.html";

        } else if (dadosUsuario.tipo_usuario === "comerciante") {

            window.location.href = "pagina-inicial.html";

        }

    } catch (erro) {

        console.error("Erro no login:", erro);

        if (erro.code === "auth/invalid-credential") {

            alert(
                "E-mail ou senha incorretos."
            );

        } else if (erro.code === "auth/user-not-found") {

            alert(
                "Usuário não encontrado."
            );

        } else if (erro.code === "auth/wrong-password") {

            alert(
                "Senha incorreta."
            );

        } else {

            alert(
                "Não foi possível realizar o login."
            );
        }
    }

});