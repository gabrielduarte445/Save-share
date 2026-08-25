import { auth, db } from "./firebase-config.js";

import {
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ===============================
// SELEÇÃO CLIENTE / COMERCIANTE
// ===============================

const radCliente = document.getElementById("cliente");
const radComerciante = document.getElementById("comerciante");

const boxCliente = document.getElementById("campos-cliente");
const boxComerciante = document.getElementById("campos-comerciante");


radCliente.addEventListener("change", () => {

    if (radCliente.checked) {
        boxCliente.style.display = "block";
        boxComerciante.style.display = "none";
    }

});


radComerciante.addEventListener("change", () => {

    if (radComerciante.checked) {
        boxCliente.style.display = "none";
        boxComerciante.style.display = "block";
    }

});


// ===============================
// CADASTRO
// ===============================

const formulario = document.querySelector(".form-inicial");


formulario.addEventListener("submit", async (event) => {

    event.preventDefault();


    // Descobre se é cliente ou comerciante
    const tipoUsuario = document.querySelector(
        'input[name="tipo_usuario"]:checked'
    ).value;


    // Dados básicos
    const dados = {

        nome: document.getElementById("nome").value.trim(),

        telefone: document.getElementById("telefone").value.trim(),

        email: document.getElementById("email").value.trim(),

        senha: document.getElementById("senha").value,

        tipo_usuario: tipoUsuario

    };


    // ===============================
    // DADOS DO CLIENTE
    // ===============================

    if (tipoUsuario === "cliente") {

        dados.cpf =
            document.getElementById("cpf").value.trim();

        dados.data_nascimento_cliente =
            document.getElementById("data-nascimento-cli").value;

    }


    // ===============================
    // DADOS DO COMERCIANTE
    // ===============================

    if (tipoUsuario === "comerciante") {

        dados.cnpj =
            document.getElementById("cnpj").value.trim();

        dados.nome_loja =
            document.getElementById("nome-loja").value.trim();

        dados.data_abertura =
            document.getElementById("data-abertura").value;

    }


    try {

        // ===============================
        // CRIA USUÁRIO NO AUTHENTICATION
        // ===============================

        const resultado = await createUserWithEmailAndPassword(
            auth,
            dados.email,
            dados.senha
        );


        const usuario = resultado.user;


        console.log(
            "Usuário criado no Firebase:",
            usuario.uid
        );


        // ===============================
        // PREPARA DADOS PARA O FIRESTORE
        // ===============================

        const dadosFirestore = { ...dados };


        // Não salva a senha no Firestore
        delete dadosFirestore.senha;


        // ===============================
        // SALVA NO FIRESTORE
        // ===============================

        await setDoc(
            doc(db, "usuarios", usuario.uid),
            dadosFirestore
        );


        console.log(
            "Dados salvos no Firestore!"
        );


        alert("Cadastro realizado com sucesso!");


    } catch (erro) {

        console.error(
            "Erro no cadastro:",
            erro
        );

        alert(
            "Erro ao realizar o cadastro: " +
            erro.message
        );

    }

});