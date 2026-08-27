import { auth, db } from "../../public/firebase-config.js";

import {
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ======================================================
// CAMPOS DE TIPO DE USUÁRIO
// ======================================================

const radCliente = document.getElementById("cliente");
const radComerciante = document.getElementById("comerciante");

const boxCliente = document.getElementById("campos-cliente");
const boxComerciante = document.getElementById("campos-comerciante");


// ======================================================
// ALTERNAR CLIENTE / COMERCIANTE
// ======================================================

if (radCliente && radComerciante) {

    radCliente.addEventListener("change", () => {

        if (radCliente.checked) {

            if (boxCliente) {
                boxCliente.style.display = "block";
            }

            if (boxComerciante) {
                boxComerciante.style.display = "none";
            }
        }
    });


    radComerciante.addEventListener("change", () => {

        if (radComerciante.checked) {

            if (boxCliente) {
                boxCliente.style.display = "none";
            }

            if (boxComerciante) {
                boxComerciante.style.display = "block";
            }
        }
    });
}


// ======================================================
// FORMULÁRIO
// ======================================================

const formulario = document.querySelector(".form-inicial");


// ======================================================
// FUNÇÃO PARA MOSTRAR ERRO ABAIXO DO CAMPO
// ======================================================

function mostrarErro(campo, mensagem) {

    if (!campo) {
        return;
    }

    // Remove erro antigo desse campo
    removerErro(campo);

    // Cria mensagem
    const mensagemErro = document.createElement("small");

    mensagemErro.className = "mensagem-erro";
    mensagemErro.textContent = mensagem;

    mensagemErro.style.display = "block";
    mensagemErro.style.color = "#d32f2f";
    mensagemErro.style.fontSize = "13px";
    mensagemErro.style.marginTop = "5px";
    mensagemErro.style.marginBottom = "8px";

    // Coloca a mensagem depois do campo/container
    const container = campo.closest(".input-container");

    if (container) {
        container.insertAdjacentElement(
            "afterend",
            mensagemErro
        );
    } else {
        campo.insertAdjacentElement(
            "afterend",
            mensagemErro
        );
    }

    // Borda vermelha
    campo.style.border = "1px solid #d32f2f";
}


// ======================================================
// REMOVER ERRO
// ======================================================

function removerErro(campo) {

    if (!campo) {
        return;
    }

    const container = campo.closest(".input-container");

    let proximo;

    if (container) {
        proximo = container.nextElementSibling;
    } else {
        proximo = campo.nextElementSibling;
    }

    if (
        proximo &&
        proximo.classList.contains("mensagem-erro")
    ) {
        proximo.remove();
    }

    campo.style.border = "";
}


// ======================================================
// LIMPAR TODOS OS ERROS
// ======================================================

function limparErros() {

    document
        .querySelectorAll(".mensagem-erro")
        .forEach((elemento) => {
            elemento.remove();
        });

    document
        .querySelectorAll("input")
        .forEach((campo) => {
            campo.style.border = "";
        });
}


// ======================================================
// FUNÇÃO PARA MOSTRAR SUCESSO
// ======================================================

function mostrarSucesso(campo, mensagem) {

    if (!campo) {
        return;
    }

    removerErro(campo);

    const mensagemSucesso = document.createElement("small");

    mensagemSucesso.className = "mensagem-sucesso";
    mensagemSucesso.textContent = mensagem;

    mensagemSucesso.style.display = "block";
    mensagemSucesso.style.color = "#2e7d32";
    mensagemSucesso.style.fontSize = "13px";
    mensagemSucesso.style.marginTop = "5px";
    mensagemSucesso.style.marginBottom = "8px";

    const container = campo.closest(".input-container");

    if (container) {
        container.insertAdjacentElement(
            "afterend",
            mensagemSucesso
        );
    } else {
        campo.insertAdjacentElement(
            "afterend",
            mensagemSucesso
        );
    }
}


// ======================================================
// SUBMIT
// ======================================================

if (formulario) {

    formulario.addEventListener("submit", async (event) => {

        event.preventDefault();

        limparErros();


        // ==================================================
        // PEGAR TIPO DE USUÁRIO
        // ==================================================

        const tipoSelecionado = document.querySelector(
            'input[name="tipo_usuario"]:checked'
        );

        if (!tipoSelecionado) {

            alert("Selecione se você é Cliente ou Comerciante.");

            return;
        }

        const tipoUsuario = tipoSelecionado.value;


        // ==================================================
        // PEGAR CAMPOS PRINCIPAIS
        // ==================================================

        const campoNome = document.getElementById("nome");
        const campoTelefone = document.getElementById("telefone");
        const campoEmail = document.getElementById("email");
        const campoSenha = document.getElementById("senha");


        const nome = campoNome
            ? campoNome.value.trim()
            : "";

        const telefone = campoTelefone
            ? campoTelefone.value.trim()
            : "";

        const email = campoEmail
            ? campoEmail.value.trim()
            : "";

        const senha = campoSenha
            ? campoSenha.value
            : "";


        let formularioValido = true;


        // ==================================================
        // VALIDAR NOME
        // ==================================================

        if (nome.length < 3) {

            mostrarErro(
                campoNome,
                "Digite seu nome completo."
            );

            formularioValido = false;

        } else if (!nome.includes(" ")) {

            mostrarErro(
                campoNome,
                "Digite seu nome e sobrenome."
            );

            formularioValido = false;
        }


        // ==================================================
        // VALIDAR TELEFONE
        // ==================================================

        const telefoneNumeros =
            telefone.replace(/\D/g, "");

        if (telefoneNumeros.length < 10) {

            mostrarErro(
                campoTelefone,
                "Digite um telefone válido."
            );

            formularioValido = false;
        }


        // ==================================================
        // VALIDAR EMAIL
        // ==================================================

        const emailValido =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        if (!emailValido) {

            mostrarErro(
                campoEmail,
                "Digite um e-mail válido."
            );

            formularioValido = false;
        }


        // ==================================================
        // VALIDAR SENHA
        // ==================================================

        if (senha.length < 6) {

            mostrarErro(
                campoSenha,
                "A senha deve ter pelo menos 6 caracteres."
            );

            formularioValido = false;
        }


        // ==================================================
        // DADOS DO CLIENTE
        // ==================================================

        let cpf = "";
        let dataNascimento = "";

        if (tipoUsuario === "cliente") {

            const campoCpf =
                document.getElementById("cpf");

            const campoNascimento =
                document.getElementById(
                    "data-nascimento-cli"
                );


            cpf = campoCpf
                ? campoCpf.value.replace(/\D/g, "")
                : "";

            dataNascimento =
                campoNascimento
                    ? campoNascimento.value
                    : "";


            // VALIDAR CPF

            if (cpf.length !== 11) {

                mostrarErro(
                    campoCpf,
                    "Digite um CPF válido com 11 números."
                );

                formularioValido = false;
            }


            // VALIDAR NASCIMENTO

            if (!dataNascimento) {

                mostrarErro(
                    campoNascimento,
                    "Informe sua data de nascimento."
                );

                formularioValido = false;
            }
        }


        // ==================================================
        // DADOS DO COMERCIANTE
        // ==================================================

        let cnpj = "";
        let nomeLoja = "";
        let dataAbertura = "";

        if (tipoUsuario === "comerciante") {

            const campoCnpj =
                document.getElementById("cnpj");

            const campoNomeLoja =
                document.getElementById("nome-loja");

            const campoDataAbertura =
                document.getElementById("data-abertura");


            cnpj = campoCnpj
                ? campoCnpj.value.replace(/\D/g, "")
                : "";

            nomeLoja = campoNomeLoja
                ? campoNomeLoja.value.trim()
                : "";

            dataAbertura =
                campoDataAbertura
                    ? campoDataAbertura.value
                    : "";


            // VALIDAR CNPJ

            if (cnpj.length !== 14) {

                mostrarErro(
                    campoCnpj,
                    "Digite um CNPJ válido com 14 números."
                );

                formularioValido = false;
            }


            // VALIDAR NOME DA LOJA

            if (nomeLoja.length < 2) {

                mostrarErro(
                    campoNomeLoja,
                    "Digite o nome da loja."
                );

                formularioValido = false;
            }


            // VALIDAR DATA DE ABERTURA

            if (!dataAbertura) {

                mostrarErro(
                    campoDataAbertura,
                    "Informe a data de abertura da loja."
                );

                formularioValido = false;
            }
        }


        // ==================================================
        // SE HOUVER ERRO, PARA AQUI
        // ==================================================

        if (!formularioValido) {

            console.log(
                "Corrija os campos destacados."
            );

            return;
        }


        // ==================================================
        // OBJETO DOS DADOS
        // ==================================================

        const dados = {

            nome: nome,

            telefone: telefone,

            email: email,

            tipo_usuario: tipoUsuario
        };


        // ==================================================
        // ADICIONAR DADOS DO CLIENTE
        // ==================================================

        if (tipoUsuario === "cliente") {

            dados.cpf = cpf;

            dados.data_nascimento_cliente =
                dataNascimento;
        }


        // ==================================================
        // ADICIONAR DADOS DO COMERCIANTE
        // ==================================================

        if (tipoUsuario === "comerciante") {

            dados.cnpj = cnpj;

            dados.nome_loja = nomeLoja;

            dados.data_abertura =
                dataAbertura;
        }


        console.log(
            "Dados tratados:",
            dados
        );


        // ==================================================
        // CRIAR USUÁRIO NO FIREBASE AUTH
        // ==================================================

        try {

            const resultado =
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    senha
                );


            const usuario = resultado.user;


            console.log(
                "Usuário criado no Firebase:",
                usuario.uid
            );


            // ==================================================
            // SALVAR NO FIRESTORE
            // ==================================================

            await setDoc(
                doc(
                    db,
                    "usuarios",
                    usuario.uid
                ),
                dados
            );


            console.log(
                "Dados salvos no Firestore!"
            );


            // ==================================================
            // MENSAGEM DE SUCESSO
            // ==================================================

            mostrarSucesso(
                campoEmail,
                "Conta criada com sucesso!"
            );


            alert(
                "Cadastro realizado com sucesso!"
            );


            // Opcional: ir para login
            // window.location.href = "login.html";


        } catch (erro) {

            console.error(
                "Erro no cadastro:",
                erro
            );


            // ==================================================
            // EMAIL JÁ CADASTRADO
            // ==================================================

            if (
                erro.code ===
                "auth/email-already-in-use"
            ) {

                mostrarErro(
                    campoEmail,
                    "Este e-mail já está cadastrado. Use outro e-mail ou faça login."
                );

                return;
            }


            // ==================================================
            // EMAIL INVÁLIDO
            // ==================================================

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


            // ==================================================
            // SENHA FRACA
            // ==================================================

            if (
                erro.code ===
                "auth/weak-password"
            ) {

                mostrarErro(
                    campoSenha,
                    "A senha é muito fraca. Use pelo menos 6 caracteres."
                );

                return;
            }


            // ==================================================
            // API KEY
            // ==================================================

            if (
                erro.code ===
                "auth/api-key-not-valid"
            ) {

                alert(
                    "A chave da API do Firebase está incorreta."
                );

                return;
            }


            // ==================================================
            // ERRO GENÉRICO
            // ==================================================

            alert(
                "Não foi possível realizar o cadastro. Tente novamente."
            );
        }

    });
}