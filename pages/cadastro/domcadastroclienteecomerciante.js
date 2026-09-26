import { auth, db } from "../../public/firebase-config.js";

import {
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";



// CAMPOS DE TIPO DE USUÁRIO


const radCliente = document.getElementById("cliente");
const radComerciante = document.getElementById("comerciante");
const radEntregador = document.getElementById("entregador");

const boxCliente = document.getElementById("campos-cliente");
const boxComerciante = document.getElementById("campos-comerciante");
const boxEntregador = document.getElementById("campos-entregador");


// ALTERNAR CLIENTE / COMERCIANTE / ENTREGADOR


function esconderTodosOsBlocos() {
    if (boxCliente) boxCliente.style.display = "none";
    if (boxComerciante) boxComerciante.style.display = "none";
    if (boxEntregador) boxEntregador.style.display = "none";
}

if (radCliente) {
    radCliente.addEventListener("change", () => {
        if (radCliente.checked) {
            esconderTodosOsBlocos();
            if (boxCliente) boxCliente.style.display = "block";
        }
    });
}

if (radComerciante) {
    radComerciante.addEventListener("change", () => {
        if (radComerciante.checked) {
            esconderTodosOsBlocos();
            if (boxComerciante) boxComerciante.style.display = "block";
        }
    });
}

if (radEntregador) {
    radEntregador.addEventListener("change", () => {
        if (radEntregador.checked) {
            esconderTodosOsBlocos();
            if (boxEntregador) boxEntregador.style.display = "block";
        }
    });
}



// FORMULÁRIO


const formulario = document.querySelector(".form-inicial");


function mostrarErro(campo, mensagem) {
    if (!campo) return;

    removerErro(campo);

    const mensagemErro = document.createElement("small");
    mensagemErro.className = "mensagem-erro";
    mensagemErro.textContent = mensagem;
    mensagemErro.style.display = "block";
    mensagemErro.style.color = "#d32f2f";
    mensagemErro.style.fontSize = "13px";
    mensagemErro.style.marginTop = "5px";
    mensagemErro.style.marginBottom = "8px";

    const container = campo.closest(".input-container");

    if (container) {
        container.insertAdjacentElement("afterend", mensagemErro);
    } else {
        campo.insertAdjacentElement("afterend", mensagemErro);
    }

    campo.style.border = "1px solid #d32f2f";
}


function removerErro(campo) {
    if (!campo) return;

    const container = campo.closest(".input-container");
    let proximo = container ? container.nextElementSibling : campo.nextElementSibling;

    if (proximo && proximo.classList.contains("mensagem-erro")) {
        proximo.remove();
    }

    campo.style.border = "";
}


function limparErros() {
    document.querySelectorAll(".mensagem-erro").forEach((elemento) => elemento.remove());
    document.querySelectorAll("input").forEach((campo) => (campo.style.border = ""));
}


function mostrarSucesso(campo, mensagem) {
    if (!campo) return;

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
        container.insertAdjacentElement("afterend", mensagemSucesso);
    } else {
        campo.insertAdjacentElement("afterend", mensagemSucesso);
    }
}


if (formulario) {

    formulario.addEventListener("submit", async (event) => {

        event.preventDefault();
        limparErros();

        const tipoSelecionado = document.querySelector('input[name="tipo_usuario"]:checked');

        if (!tipoSelecionado) {
            alert("Selecione se você é Cliente, Comerciante ou Entregador.");
            return;
        }

        const tipoUsuario = tipoSelecionado.value;

        const campoNome = document.getElementById("nome");
        const campoTelefone = document.getElementById("telefone");
        const campoEmail = document.getElementById("email");
        const campoSenha = document.getElementById("senha");

        const nome = campoNome ? campoNome.value.trim() : "";
        const telefone = campoTelefone ? campoTelefone.value.trim() : "";
        const email = campoEmail ? campoEmail.value.trim() : "";
        const senha = campoSenha ? campoSenha.value : "";

        let formularioValido = true;

        if (nome.length < 3) {
            mostrarErro(campoNome, "Digite seu nome completo.");
            formularioValido = false;
        } else if (!nome.includes(" ")) {
            mostrarErro(campoNome, "Digite seu nome e sobrenome.");
            formularioValido = false;
        }

        const telefoneNumeros = telefone.replace(/\D/g, "");
        if (telefoneNumeros.length < 10) {
            mostrarErro(campoTelefone, "Digite um telefone válido.");
            formularioValido = false;
        }

        const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!emailValido) {
            mostrarErro(campoEmail, "Digite um e-mail válido.");
            formularioValido = false;
        }

        if (senha.length < 6) {
            mostrarErro(campoSenha, "A senha deve ter pelo menos 6 caracteres.");
            formularioValido = false;
        }


        let cpf = "";
        let dataNascimento = "";

        if (tipoUsuario === "cliente") {
            const campoCpf = document.getElementById("cpf");
            const campoNascimento = document.getElementById("data-nascimento-cli");

            cpf = campoCpf ? campoCpf.value.replace(/\D/g, "") : "";
            dataNascimento = campoNascimento ? campoNascimento.value : "";

            if (cpf.length !== 11) {
                mostrarErro(campoCpf, "Digite um CPF válido com 11 números.");
                formularioValido = false;
            }

            if (!dataNascimento) {
                mostrarErro(campoNascimento, "Informe sua data de nascimento.");
                formularioValido = false;
            }
        }

        // DADOS DO COMERCIANTE


        let cnpj = "";
        let nomeLoja = "";
        let dataAbertura = "";

        if (tipoUsuario === "comerciante") {
            const campoCnpj = document.getElementById("cnpj");
            const campoNomeLoja = document.getElementById("nome-loja");
            const campoDataAbertura = document.getElementById("data-abertura");

            cnpj = campoCnpj ? campoCnpj.value.replace(/\D/g, "") : "";
            nomeLoja = campoNomeLoja ? campoNomeLoja.value.trim() : "";
            dataAbertura = campoDataAbertura ? campoDataAbertura.value : "";

            if (cnpj.length !== 14) {
                mostrarErro(campoCnpj, "Digite um CNPJ válido com 14 números.");
                formularioValido = false;
            }

            if (nomeLoja.length < 2) {
                mostrarErro(campoNomeLoja, "Digite o nome da loja.");
                formularioValido = false;
            }

            if (!dataAbertura) {
                mostrarErro(campoDataAbertura, "Informe a data de abertura da loja.");
                formularioValido = false;
            }
        }

        // DADOS DO ENTREGADOR

        let tipoVeiculo = "";
        let placaVeiculo = "";
        let numeroCnh = "";

        if (tipoUsuario === "entregador") {
            const campoTipoVeiculo = document.getElementById("tipo-veiculo");
            const campoPlaca = document.getElementById("placa-veiculo");
            const campoCnh = document.getElementById("numero-cnh");

            tipoVeiculo = campoTipoVeiculo ? campoTipoVeiculo.value : "";
            placaVeiculo = campoPlaca ? campoPlaca.value.trim().toUpperCase() : "";
            numeroCnh = campoCnh ? campoCnh.value.replace(/\D/g, "") : "";

            if (!placaVeiculo) {
                mostrarErro(campoPlaca, "Digite a placa do veículo.");
                formularioValido = false;
            }

            if (numeroCnh.length < 9) {
                mostrarErro(campoCnh, "Digite um número de CNH válido.");
                formularioValido = false;
            }
        }

        if (!formularioValido) {
            return;
        }
         // OBJETO DOS DADOS

        const dados = {
            nome: nome,
            telefone: telefone,
            email: email,
            tipo_usuario: tipoUsuario
        };

        if (tipoUsuario === "cliente") {
            dados.cpf = cpf;
            dados.data_nascimento_cliente = dataNascimento;
        }

        if (tipoUsuario === "comerciante") {
            dados.cnpj = cnpj;
            dados.nome_loja = nomeLoja;
            dados.data_abertura = dataAbertura;
        }

        if (tipoUsuario === "entregador") {
            dados.tipo_veiculo = tipoVeiculo;
            dados.placa_veiculo = placaVeiculo;
            dados.numero_cnh = numeroCnh;
        }


        // CRIAR USUÁRIO NO FIREBASE AUTH + FIRESTORE=

        try {
            const resultado = await createUserWithEmailAndPassword(auth, email, senha);
            const usuario = resultado.user;

            await setDoc(doc(db, "usuarios", usuario.uid), dados);

            mostrarSucesso(campoEmail, "Conta criada com sucesso!");
            alert("Cadastro realizado com sucesso!");

            window.location.href = "/public/login.html";

        } catch (erro) {
            console.error("Erro no cadastro:", erro);

            if (erro.code === "auth/email-already-in-use") {
                mostrarErro(campoEmail, "Este e-mail já está cadastrado. Use outro e-mail ou faça login.");
                return;
            }

            if (erro.code === "auth/invalid-email") {
                mostrarErro(campoEmail, "Digite um e-mail válido.");
                return;
            }

            if (erro.code === "auth/weak-password") {
                mostrarErro(campoSenha, "A senha é muito fraca. Use pelo menos 6 caracteres.");
                return;
            }

            if (erro.code === "auth/api-key-not-valid") {
                alert("A chave da API do Firebase está incorreta.");
                return;
            }

            alert("Não foi possível realizar o cadastro. Tente novamente.");
        }
    });
}