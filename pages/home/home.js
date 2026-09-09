import { auth, db } from "/public/firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const nomeElemento = document.getElementById("user-name");
const badgeElemento = document.getElementById("location-badge");
const textoLocalizacao = document.getElementById("location-text");


const botaoMeusProdutos = document.getElementById("btn-meus-produtos");

onAuthStateChanged(auth, async (usuario) => {

    if (!usuario) {
        window.location.href = "/public/login.html";
        return;
    }

    // Nome do usuário + verificação de tipo
    try {
        const refUsuario = doc(db, "usuarios", usuario.uid);
        const docUsuario = await getDoc(refUsuario);

        if (docUsuario.exists()) {
            const dadosUsuario = docUsuario.data();
            nomeElemento.textContent = dadosUsuario.nome || "Usuário";

            if (dadosUsuario.tipo_usuario === "comerciante") {
                botaoMeusProdutos.style.display = "flex";
            }

        } else {
            nomeElemento.textContent = "Usuário";
        }
    } catch (erro) {
        console.error("Erro ao buscar usuário:", erro);
        nomeElemento.textContent = "Usuário";
    }

    // ENDEREÇO

    try {
        const enderecosRef = collection(db, "enderecos");
        const consultaEndereco = query(
            enderecosRef,
            where("usuario_id", "==", usuario.uid)
        );

        const resultado = await getDocs(consultaEndereco);

        if (resultado.empty) {
            // REAÇÃO: nenhum endereço cadastrado
            textoLocalizacao.textContent = "Adicionar endereço";
            badgeElemento.style.cursor = "pointer";
            badgeElemento.addEventListener("click", () => {
                window.location.href = "../../public/cadastro_clienteendereco.html";
            });

        } else {
            let enderecoDoc = resultado.docs.find((d) => d.data().padrao);
            if (!enderecoDoc) {
                enderecoDoc = resultado.docs[0];
            }

            const endereco = enderecoDoc.data();
            textoLocalizacao.textContent =
                `${endereco.logradouro || endereco.rua}, ${endereco.numero}`;

            badgeElemento.style.cursor = "pointer";
            badgeElemento.addEventListener("click", () => {
                window.location.href = "/public/meus-enderecos.html";
            });
        }
    } catch (erro) {
        console.error("Erro ao buscar endereço:", erro);
        textoLocalizacao.textContent = "Erro ao carregar endereço";
    }

});