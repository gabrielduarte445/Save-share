import { auth, db } from "../../public/firebase-config.js";
import { protegerPagina } from "../shared/guarda.js";
import {
    doc,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    collection
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const formulario = document.getElementById("form-endereco");
const botaoSalvar = document.getElementById("btn-salvar-endereco");

const campoCep = document.getElementById("cep");
const campoNumero = document.getElementById("numero");
const campoRua = document.getElementById("rua");
const campoBairro = document.getElementById("bairro");
const campoCidade = document.getElementById("cidade");
const campoEstado = document.getElementById("estado");
const campoComplemento = document.getElementById("complemento");

const parametros = new URLSearchParams(window.location.search);
const idEnderecoParaEditar = parametros.get("id");


const { usuario, dados } = await protegerPagina({ tipos: ["cliente", "comerciante"] });
const usuarioAtual = usuario;
const tipoUsuario = dados.tipo_usuario;

if (tipoUsuario === "comerciante") {
    try {
        const refEnderecoComerciante = doc(db, "enderecos", usuarioAtual.uid);
        const docEndereco = await getDoc(refEnderecoComerciante);
        if (docEndereco.exists()) {
            preencherFormulario(docEndereco.data());
            botaoSalvar.textContent = "Atualizar Endereço";
        }
    } catch (erro) {
        console.error("Erro ao carregar endereço do comerciante:", erro);
    }
}

if (tipoUsuario === "cliente" && idEnderecoParaEditar) {
    try {
        const refEndereco = doc(db, "enderecos", idEnderecoParaEditar);
        const docEndereco = await getDoc(refEndereco);
        if (docEndereco.exists()) {
            preencherFormulario(docEndereco.data());
            botaoSalvar.textContent = "Atualizar Endereço";
        }
    } catch (erro) {
        console.error("Erro ao carregar endereço do cliente:", erro);
    }
}

function preencherFormulario(dadosEnderecoForm) {
    campoCep.value = dadosEnderecoForm.cep || "";
    campoNumero.value = dadosEnderecoForm.numero || "";
    campoRua.value = dadosEnderecoForm.logradouro || "";
    campoBairro.value = dadosEnderecoForm.bairro || "";
    campoCidade.value = dadosEnderecoForm.cidade || "";
    campoEstado.value = dadosEnderecoForm.estado || "";
    campoComplemento.value = dadosEnderecoForm.complemento || "";
}

formulario.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!usuarioAtual) {
        alert("Você precisa estar logado.");
        return;
    }

    const dadosEndereco = {
        usuario_id: usuarioAtual.uid,
        cep: campoCep.value.trim(),
        numero: campoNumero.value.trim(),
        logradouro: campoRua.value.trim(),
        bairro: campoBairro.value.trim(),
        cidade: campoCidade.value.trim(),
        estado: campoEstado.value.trim(),
        complemento: campoComplemento.value.trim()
    };

    try {
        if (tipoUsuario === "comerciante") {
            const refEnderecoComerciante = doc(db, "enderecos", usuarioAtual.uid);
            await setDoc(refEnderecoComerciante, dadosEndereco);

        } else if (idEnderecoParaEditar) {
            const refEndereco = doc(db, "enderecos", idEnderecoParaEditar);
            await updateDoc(refEndereco, dadosEndereco);

        } else {
            const enderecosRef = collection(db, "enderecos");
            await addDoc(enderecosRef, dadosEndereco);
        }

        window.location.href = "../../public/home.html";

    } catch (erro) {
        console.error("Erro ao salvar endereço:", erro);
        alert("Não foi possível salvar o endereço. Tente novamente.");
    }
});