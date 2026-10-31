import { auth, db } from "../../public/firebase-config.js";
import { protegerPagina } from "../shared/guarda.js";
import { geocodificarEndereco } from "../shared/mapa.js";
import { mostrarToast } from "../shared/toast.js";

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
        mostrarToast("Você precisa estar logado.", "erro");
        return;
    }

    const logradouro = campoRua.value.trim();
    const numero = campoNumero.value.trim();
    const bairro = campoBairro.value.trim();
    const cidade = campoCidade.value.trim();
    const estado = campoEstado.value.trim();

    // 1. Bloqueia termos genéricos explícitos que quebram o mapa
    const termosGenericos = ["endereço da loja", "loja", "minha loja", "teste", "rua teste", "endereço"];
    if (termosGenericos.includes(logradouro.toLowerCase())) {
        mostrarToast("Por favor, digite o nome real da rua/avenida.", "erro");
        return;
    }

    const dadosParaGeocodificar = { logradouro, numero, bairro, cidade, estado };

    botaoSalvar.disabled = true;
    const textoBotaoOriginal = botaoSalvar.textContent;
    botaoSalvar.textContent = "Validando endereço no mapa...";

    try {
        // 2. Tenta obter latitude e longitude no OpenStreetMap
        const pontoGeocodificado = await geocodificarEndereco(dadosParaGeocodificar);

        if (!pontoGeocodificado) {
            mostrarToast("Endereço não localizado no mapa. Verifique a Rua, Bairro e Cidade.", "erro");
            botaoSalvar.disabled = false;
            botaoSalvar.textContent = textoBotaoOriginal;
            return;
        }

        // 3. Prepara os dados completos com as coordenadas confirmadas
        const dadosEndereco = {
            usuario_id: usuarioAtual.uid,
            cep: campoCep.value.trim(),
            numero,
            logradouro,
            bairro,
            cidade,
            estado,
            complemento: campoComplemento.value.trim(),
            lat: pontoGeocodificado.lat,
            lng: pontoGeocodificado.lng,
            verificado: true
        };

        if (tipoUsuario === "comerciante") {
            const refEnderecoComerciante = doc(db, "enderecos", usuarioAtual.uid);
            await setDoc(refEnderecoComerciante, dadosEndereco);

            // Sincroniza também com o documento do comerciante para garantir a consulta de retiradas
            const refLoja = doc(db, "lojas", usuarioAtual.uid);
            await setDoc(refLoja, { endereco: dadosEndereco }, { merge: true });

        } else if (idEnderecoParaEditar) {
            const refEndereco = doc(db, "enderecos", idEnderecoParaEditar);
            await updateDoc(refEndereco, dadosEndereco);

        } else {
            const enderecosRef = collection(db, "enderecos");
            await addDoc(enderecosRef, dadosEndereco);
        }

        mostrarToast("Endereço validado e salvo com sucesso!", "sucesso");
        
        setTimeout(() => {
            window.location.href = "../../public/home.html";
        }, 1200);

    } catch (erro) {
        console.error("Erro ao salvar endereço:", erro);
        mostrarToast("Não foi possível salvar o endereço. Tente novamente.", "erro");
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = textoBotaoOriginal;
    }
});