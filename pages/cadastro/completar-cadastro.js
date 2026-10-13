import { auth, db } from "/public/firebase-config.js";
import { mostrarToast } from "/pages/shared/toast.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const formulario = document.getElementById("form-completar");
const botaoConcluir = document.getElementById("btn-concluir");
const botaoCancelar = document.getElementById("btn-cancelar");

const grupos = {
    cliente: document.getElementById("campos-cliente"),
    comerciante: document.getElementById("campos-comerciante"),
    entregador: document.getElementById("campos-entregador")
};

let usuarioAtual = null;


function destinoDoTipo(tipo) {
    return tipo === "entregador"
        ? "/public/pedidos-disponiveis.html"
        : "/public/home.html";
}


// ---------- Tipo de usuário ----------

function mostrarGrupo(tipo) {
    Object.entries(grupos).forEach(([nome, elemento]) => {
        elemento.style.display = nome === tipo ? "block" : "none";
    });
}

document.querySelectorAll('input[name="tipo_usuario"]').forEach((radio) => {
    radio.addEventListener("change", () => mostrarGrupo(radio.value));
});

// Tipo escolhido na tela de login (?tipo=...)
const tipoInicial = new URLSearchParams(window.location.search).get("tipo");

if (grupos[tipoInicial]) {
    document.getElementById(tipoInicial).checked = true;
}

mostrarGrupo(document.querySelector('input[name="tipo_usuario"]:checked').value);


// ---------- Proteção da página ----------

onAuthStateChanged(auth, async (usuario) => {

    if (!usuario) {
        window.location.replace("/public/login.html");
        return;
    }

    try {
        const snap = await getDoc(doc(db, "usuarios", usuario.uid));

        // Quem já tem cadastro não precisa estar aqui
        if (snap.exists()) {
            window.location.replace(destinoDoTipo(snap.data().tipo_usuario));
            return;
        }

    } catch (erro) {
        console.error("Erro ao verificar cadastro:", erro);
        window.location.replace("/public/login.html");
        return;
    }

    usuarioAtual = usuario;
    document.getElementById("nome").value = usuario.displayName || "";
    document.documentElement.classList.remove("aguardando-auth");
});


// ---------- Erros nos campos ----------

function mostrarErro(campo, mensagem) {

    const erro = document.createElement("small");
    erro.className = "mensagem-erro-completar";
    erro.textContent = mensagem;
    erro.style.cssText = "display:block; color:#d32f2f; font-size:13px; margin:5px 0 8px;";

    (campo.closest(".input-container") || campo).insertAdjacentElement("afterend", erro);
    campo.style.border = "1px solid #d32f2f";
}

function limparErros() {
    document.querySelectorAll(".mensagem-erro-completar").forEach((e) => e.remove());
    document.querySelectorAll("#form-completar input, #form-completar select").forEach((campo) => {
        campo.style.border = "";
    });
}


// ---------- Envio ----------

formulario.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (!usuarioAtual) return;

    limparErros();

    const tipo = document.querySelector('input[name="tipo_usuario"]:checked').value;

    const campoNome = document.getElementById("nome");
    const campoTelefone = document.getElementById("telefone");

    const nome = campoNome.value.trim();
    const telefone = campoTelefone.value.trim();

    let valido = true;

    if (nome.length < 3 || !nome.includes(" ")) {
        mostrarErro(campoNome, "Digite seu nome e sobrenome.");
        valido = false;
    }

    if (telefone.replace(/\D/g, "").length < 10) {
        mostrarErro(campoTelefone, "Digite um telefone válido.");
        valido = false;
    }

    const dados = {
        nome: nome,
        telefone: telefone,
        email: usuarioAtual.email || "",
        tipo_usuario: tipo
    };

    let nomeLoja = "";

    if (tipo === "cliente") {

        const campoCpf = document.getElementById("cpf");
        const campoNascimento = document.getElementById("data-nascimento-cli");

        const cpf = campoCpf.value.replace(/\D/g, "");

        if (cpf.length !== 11) {
            mostrarErro(campoCpf, "Digite um CPF válido com 11 números.");
            valido = false;
        }

        if (!campoNascimento.value) {
            mostrarErro(campoNascimento, "Informe sua data de nascimento.");
            valido = false;
        }

        dados.cpf = cpf;
        dados.data_nascimento_cliente = campoNascimento.value;
    }

    if (tipo === "comerciante") {

        const campoCnpj = document.getElementById("cnpj");
        const campoNomeLoja = document.getElementById("nome-loja");
        const campoAbertura = document.getElementById("data-abertura");

        const cnpj = campoCnpj.value.replace(/\D/g, "");
        nomeLoja = campoNomeLoja.value.trim();

        if (cnpj.length !== 14) {
            mostrarErro(campoCnpj, "Digite um CNPJ válido com 14 números.");
            valido = false;
        }

        if (nomeLoja.length < 2) {
            mostrarErro(campoNomeLoja, "Digite o nome da loja.");
            valido = false;
        }

        if (!campoAbertura.value) {
            mostrarErro(campoAbertura, "Informe a data de abertura da loja.");
            valido = false;
        }

        dados.cnpj = cnpj;
        dados.nome_loja = nomeLoja;
        dados.data_abertura = campoAbertura.value;
    }

    if (tipo === "entregador") {

        const campoPlaca = document.getElementById("placa-veiculo");
        const campoCnh = document.getElementById("numero-cnh");

        const placa = campoPlaca.value.trim().toUpperCase();
        const cnh = campoCnh.value.replace(/\D/g, "");

        if (!placa) {
            mostrarErro(campoPlaca, "Digite a placa do veículo.");
            valido = false;
        }

        if (cnh.length < 9) {
            mostrarErro(campoCnh, "Digite um número de CNH válido.");
            valido = false;
        }

        dados.tipo_veiculo = document.getElementById("tipo-veiculo").value;
        dados.placa_veiculo = placa;
        dados.numero_cnh = cnh;
    }

    if (!valido) return;

    botaoConcluir.disabled = true;
    botaoConcluir.textContent = "Salvando...";

    try {
        // Cadastro e loja pública gravados juntos
        const lote = writeBatch(db);

        lote.set(doc(db, "usuarios", usuarioAtual.uid), dados);

        if (tipo === "comerciante") {
            lote.set(doc(db, "lojas", usuarioAtual.uid), { nome_loja: nomeLoja });
        }

        await lote.commit();

        mostrarToast("Cadastro concluído!", "sucesso");

        setTimeout(() => {
            window.location.replace(destinoDoTipo(tipo));
        }, 800);

    } catch (erro) {
        console.error("Erro ao concluir cadastro:", erro);
        mostrarToast("Não foi possível concluir o cadastro. Tente novamente.", "erro");
        botaoConcluir.disabled = false;
        botaoConcluir.textContent = "Concluir cadastro";
    }
});


// ---------- Cancelar ----------

botaoCancelar.addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("/public/login.html");
});