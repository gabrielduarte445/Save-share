import { auth, db } from "/public/firebase-config.js";
import { mostrarToast, confirmarAcao } from "../shared/toast.js";
import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    doc,
    updateDoc,
    query,
    where,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const listaDisponiveis = document.getElementById("lista-disponiveis");
const listaMinhasEntregas = document.getElementById("lista-minhas-entregas");

let usuarioAtual = null;


onAuthStateChanged(auth, (usuario) => {

    if (!usuario) {
        window.location.href = "/public/login.html";
        return;
    }

    usuarioAtual = usuario;
    escutarDisponiveis();
    escutarMinhasEntregas();
});


function escutarDisponiveis() {
    const pedidosRef = collection(db, "pedidos");

    // A QUERY TEM DE CORRESPONDER EXATAMENTE À REGRA DE LEITURA
    const consulta = query(
        pedidosRef,
        where("status", "==", "preparo"),
        where("entregador_id", "==", null)
    );

    onSnapshot(consulta, (resultado) => {
        if (resultado.empty) {
            listaDisponiveis.innerHTML = `<p class="empty-message">Nenhum pedido disponível no momento.</p>`;
            return;
        }

        listaDisponiveis.innerHTML = "";
        
        resultado.docs.forEach((docSnap) => {
            const pedido = docSnap.data();
            const itensTexto = (pedido.itens || []).map((item) => `${item.quantidade}x ${item.nome}`).join(", ");
            
            const card = document.createElement("div");
            card.className = "card-pedido";
            card.innerHTML = `
                <p class="pedido-valor">R$ ${Number(pedido.valor_total || 0).toFixed(2)}</p>
                <p class="pedido-endereco">
                    📍 ${pedido.endereco_snapshot?.logradouro || ""}, ${pedido.endereco_snapshot?.numero || ""} -
                    ${pedido.endereco_snapshot?.bairro || ""}, ${pedido.endereco_snapshot?.cidade || ""}/${pedido.endereco_snapshot?.estado || ""}
                </p>
                <p class="pedido-itens">${itensTexto}</p>
                <input type="text" class="input-codigo" placeholder="Código de retirada (4 dígitos)" maxlength="4">
                <button type="button" class="btn-pegar-pedido">Confirmar retirada</button>
            `;

            card.querySelector(".btn-pegar-pedido").addEventListener("click", () => {
                const codigoDigitado = card.querySelector(".input-codigo").value.trim();
                pegarPedido(docSnap.id, pedido.codigo_retirada, codigoDigitado);
            });

            listaDisponiveis.appendChild(card);
        });
    }, (erro) => {
        console.error("Erro no escutarDisponiveis:", erro);
        listaDisponiveis.innerHTML = `<p class="empty-message">Erro ao carregar pedidos: ${erro.message}</p>`;
    });
}
async function pegarPedido(pedidoId, codigoCorreto, codigoDigitado) {
    if (!codigoDigitado) {
        alert("Digite o código de retirada informado pelo estabelecimento.");
        return;
    }

    // Normaliza ambos para String e remove espaços acidentais
    const codigoLimpoDigitado = String(codigoDigitado).trim();
    const codigoLimpoCorreto = String(codigoCorreto).trim();

    if (codigoLimpoDigitado !== codigoLimpoCorreto) {
        alert("Código incorreto. Confirme o código com o estabelecimento.");
        return;
    }

    try {
        const refPedido = doc(db, "pedidos", pedidoId);
        await updateDoc(refPedido, {
            entregador_id: usuarioAtual.uid,
            status: "entrega"
        });
        
        alert("Retirada confirmada! Pedido em transporte.");
    } catch (erro) {
        console.error("Erro ao pegar pedido:", erro);
        alert("Não foi possível aceitar o pedido. Verifique o console para detalhes.");
    }
}

function escutarMinhasEntregas() {

    const pedidosRef = collection(db, "pedidos");
    const consulta = query(
        pedidosRef,
        where("entregador_id", "==", usuarioAtual.uid),
        where("status", "==", "entrega")
    );

    onSnapshot(consulta, (resultado) => {

        if (resultado.empty) {
            listaMinhasEntregas.innerHTML = `<p class="empty-message">Você não tem entregas em andamento.</p>`;
            return;
        }

        listaMinhasEntregas.innerHTML = "";

        resultado.docs.forEach((docSnap) => {
            const pedido = docSnap.data();
            const itensTexto = pedido.itens.map((item) => `${item.quantidade}x ${item.nome}`).join(", ");

            const card = document.createElement("div");
            card.className = "card-pedido";
            card.innerHTML = `
                <p class="pedido-valor">R$ ${Number(pedido.valor_total).toFixed(2)}</p>
                <p class="pedido-endereco">
                    📍 ${pedido.endereco_snapshot.logradouro}, ${pedido.endereco_snapshot.numero} -
                    ${pedido.endereco_snapshot.bairro}, ${pedido.endereco_snapshot.cidade}/${pedido.endereco_snapshot.estado}
                </p>
                <p class="pedido-itens">${itensTexto}</p>
                <button type="button" class="btn-entregue">Marcar como entregue</button>
            `;

            card.querySelector(".btn-entregue").addEventListener("click", () => marcarEntregue(docSnap.id));
            listaMinhasEntregas.appendChild(card);
        });

    }, (erro) => {
        console.error("Erro ao carregar minhas entregas:", erro);
        listaMinhasEntregas.innerHTML = `<p class="empty-message">Erro ao carregar entregas.</p>`;
    });
}


async function marcarEntregue(pedidoId) {

    const confirmar = await confirmarAcao("Confirma que este pedido foi entregue?");
    if (!confirmar) return;

    try {
        const refPedido = doc(db, "pedidos", pedidoId);
        await updateDoc(refPedido, { status: "entregue" });

    } catch (erro) {
        console.error("Erro ao marcar como entregue:", erro);
        mostrarToast("Não foi possível atualizar o pedido.","erro");
    }
}