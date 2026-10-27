import { auth, db } from "../../public/firebase-config.js";
import { mostrarToast } from "../shared/toast.js";
import { protegerPagina } from "../shared/guarda.js";
import {
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const nomeElemento = document.getElementById("user-name");
const badgeElemento = document.getElementById("location-badge");
const textoLocalizacao = document.getElementById("location-text");
const containerProdutos = document.getElementById("products-container");

const botaoMeusPedidos = document.getElementById("btn-meus-pedidos");
const botaoPedidosRecebidos = document.getElementById("btn-pedidos-recebidos");
const botaoMeusProdutos = document.getElementById("btn-meus-produtos");

// Modal de Adicionar ao Carrinho
const modal = document.getElementById("modal-carrinho");
const modalFechar = document.getElementById("modal-close");
const modalNome = document.getElementById("modal-produto-nome");
const modalPreco = document.getElementById("modal-produto-preco");
const modalQtd = document.getElementById("modal-qtd-valor");
const btnModalDiminuir = document.getElementById("btn-modal-diminuir");
const btnModalAumentar = document.getElementById("btn-modal-aumentar");
const btnModalConfirmar = document.getElementById("btn-modal-confirmar");

let produtoSelecionado = null;
let quantidadeSelecionada = 1;

const { usuario, dados } = await protegerPagina({ tipos: ["cliente", "comerciante"] });
let usuarioLogado = usuario;

try {
    if (dados) {
        nomeElemento.textContent = dados.nome || "Usuário";
        document.body.classList.remove("tema-comerciante", "tema-entregador");

        if (dados.tipo_usuario === "comerciante") {
            if (botaoMeusProdutos) botaoMeusProdutos.style.display = "flex";
            if (botaoPedidosRecebidos) botaoPedidosRecebidos.style.display = "flex";
            document.body.classList.add("tema-comerciante");

        } else if (dados.tipo_usuario === "cliente") {
            if (botaoMeusPedidos) botaoMeusPedidos.style.display = "flex";

        } else if (dados.tipo_usuario === "entregador") {
            const botaoEntregas = document.getElementById("btn-entregas");
            if (botaoEntregas) botaoEntregas.style.display = "flex";
            document.body.classList.add("tema-entregador");
        }
    } else {
        nomeElemento.textContent = "Usuário";
    }
} catch (erro) {
    console.error("Erro ao processar dados do usuário:", erro);
    nomeElemento.textContent = "Usuário";
}

function atualizarPrecoModal() {
    if (!produtoSelecionado) return;
    const precoUnitario = Number(produtoSelecionado.valor);

    if (quantidadeSelecionada === 1) {
        modalPreco.textContent = `R$ ${precoUnitario.toFixed(2).replace(".", ",")}`;
    } else {
        const precoTotal = precoUnitario * quantidadeSelecionada;
        const precoUnitarioFormatado = precoUnitario.toFixed(2).replace(".", ",");
        const precoTotalFormatado = precoTotal.toFixed(2).replace(".", ",");

        modalPreco.textContent = `${quantidadeSelecionada}x R$ ${precoUnitarioFormatado} = R$ ${precoTotalFormatado}`;
    }
}

function abrirModal(produtoId, produto) {
    produtoSelecionado = { id: produtoId, ...produto };
    quantidadeSelecionada = 1;

    modalNome.textContent = produto.nome;
    modalQtd.textContent = quantidadeSelecionada;

    atualizarPrecoModal();
    modal.style.display = "flex";
}

function fecharModal() {
    modal.style.display = "none";
    produtoSelecionado = null;
}

modalFechar.addEventListener("click", fecharModal);
modal.addEventListener("click", (e) => {
    if (e.target === modal) fecharModal();
});

btnModalAumentar.addEventListener("click", () => {
    if (produtoSelecionado && quantidadeSelecionada < produtoSelecionado.estoque) {
        quantidadeSelecionada++;
        modalQtd.textContent = quantidadeSelecionada;
        atualizarPrecoModal();
    }
});

btnModalDiminuir.addEventListener("click", () => {
    if (quantidadeSelecionada > 1) {
        quantidadeSelecionada--;
        modalQtd.textContent = quantidadeSelecionada;
        atualizarPrecoModal();
    }
});

btnModalConfirmar.addEventListener("click", async () => {
    if (produtoSelecionado) {
        await adicionarAoCarrinho(produtoSelecionado.id, produtoSelecionado, quantidadeSelecionada);
        fecharModal();
    }
});

async function adicionarAoCarrinho(produtoId, produto, quantidade) {
    try {
        const refCarrinho = doc(db, "carrinhos", usuarioLogado.uid);
        const docCarrinho = await getDoc(refCarrinho);

        let itens = docCarrinho.exists() ? (docCarrinho.data().itens || []) : [];
        const indiceExistente = itens.findIndex((item) => item.produto_id === produtoId);

        if (indiceExistente >= 0) {
            itens[indiceExistente].quantidade += quantidade;
        } else {
            itens.push({
                produto_id: produtoId,
                nome: produto.nome,
                preco: produto.valor,
                quantidade: quantidade,
                comerciante_id: produto.comerciante_id,
                selecionado: true
            });
        }

        await setDoc(refCarrinho, {
            itens: itens,
            atualizado_em: new Date()
        });

        mostrarToast(`${quantidade}x ${produto.nome} adicionado ao carrinho!`, "sucesso");

    } catch (erro) {
        console.error("Erro ao adicionar ao carrinho:", erro);
        mostrarToast("Não foi possível adicionar ao carrinho.", "erro");
    }
}

async function carregarProdutosDisponiveis() {
    try {
        // Apenas exibe produtos aprovados pelo admin
        const consultaProdutos = query(
            collection(db, "produtos"),
            where("status_verificacao", "==", "aprovado")
        );
        const resultado = await getDocs(consultaProdutos);

        if (resultado.empty) {
            containerProdutos.innerHTML = `<p class="empty-message">Nenhum produto cadastrado no momento.</p>`;
            return;
        }

        containerProdutos.innerHTML = "";

        // Pré-carrega os nomes das lojas para evitar múltiplas chamadas repetidas
        const comercianteIds = [...new Set(
            resultado.docs
                .map(d => d.data().comerciante_id)
                .filter(Boolean)
        )];

        const cacheLojas = {};
        await Promise.all(
            comercianteIds.map(async (comercianteId) => {
                try {
                    const docLoja = await getDoc(doc(db, "lojas", comercianteId));
                    cacheLojas[comercianteId] = docLoja.exists()
                        ? (docLoja.data().nome_loja || "Loja")
                        : "Loja";
                } catch {
                    cacheLojas[comercianteId] = "Loja";
                }
            })
        );

        let quantidadeExibida = 0;

        for (const docSnap of resultado.docs) {
            const produto = docSnap.data();

            if (produto.estoque <= 0) continue;

            const nomeLoja = cacheLojas[produto.comerciante_id] || "Loja";
            quantidadeExibida++;

            const card = document.createElement("article");
            card.className = "product-card";

            card.innerHTML = `
                <div class="product-image-placeholder">
                    <span>Sem imagem</span>
                </div>
                <div class="product-info">
                    <p class="product-title">${produto.nome}</p>
                    <p class="product-description">${produto.descricao || ""}</p>
                    <p class="product-price">R$ ${Number(produto.valor).toFixed(2).replace(".", ",")}</p>
                    <p class="product-seller">Vendido por: ${nomeLoja}</p>
                </div>
                <div class="product-acoes">
                    <button type="button" class="btn-adicionar-carrinho" style="width: 100%;">
                        Adicionar
                    </button>
                </div>
            `;

            if (produto.imagem) {
                const imgContainer = card.querySelector(".product-image-placeholder");
                const img = document.createElement("img");
                img.src = `data:image/jpeg;base64,${produto.imagem}`;
                img.alt = produto.nome;
                img.loading = "lazy";
                imgContainer.replaceChildren(img);
            }

            card.querySelector(".btn-adicionar-carrinho").addEventListener("click", () => {
                abrirModal(docSnap.id, produto);
            });

            containerProdutos.appendChild(card);
        }

        if (quantidadeExibida === 0) {
            containerProdutos.innerHTML = `<p class="empty-message">Nenhum produto disponível no momento.</p>`;
        }

    } catch (erro) {
        console.error("Erro ao carregar produtos:", erro);
        containerProdutos.innerHTML = `<p class="empty-message">Não foi possível carregar os produtos.</p>`;
    }
}

await carregarProdutosDisponiveis();

// Endereço
try {
    const enderecosRef = collection(db, "enderecos");
    const consultaEndereco = query(
        enderecosRef,
        where("usuario_id", "==", usuarioLogado.uid)
    );

    const resultado = await getDocs(consultaEndereco);

    if (resultado.empty) {
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