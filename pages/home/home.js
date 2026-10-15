import { auth, db } from "../../public/firebase-config.js";
import { mostrarToast, confirmarAcao } from "../shared/toast.js";
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

const { usuario, dados } = await protegerPagina({ tipos: ["cliente", "comerciante"] });
let usuarioLogado = usuario;

try {
    if (dados) {
        nomeElemento.textContent = dados.nome || "Usuário";
        document.body.classList.remove("tema-comerciante", "tema-entregador");

        if (dados.tipo_usuario === "comerciante") {
            botaoMeusProdutos.style.display = "flex";
            botaoPedidosRecebidos.style.display = "flex";
            document.body.classList.add("tema-comerciante");

        } else if (dados.tipo_usuario === "cliente") {
            botaoMeusPedidos.style.display = "flex";

        } else if (dados.tipo_usuario === "entregador") {
            // Exemplo de botões visíveis para o entregador (se houver)
            if (typeof botaoEntregas !== "undefined") {
                botaoEntregas.style.display = "flex";
            }
            document.body.classList.add("tema-entregador");
        }
    } else {
        nomeElemento.textContent = "Usuário";
    }
} catch (erro) {
    console.error("Erro ao processar dados do usuário:", erro);
    nomeElemento.textContent = "Usuário";
}

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

        alert(`${quantidade}x ${produto.nome} adicionado ao carrinho!`);

    } catch (erro) {
        console.error("Erro ao adicionar ao carrinho:", erro);
        alert("Não foi possível adicionar ao carrinho.");
    }
}

async function carregarProdutosDisponiveis() {
    try {
        const produtosRef = collection(db, "produtos");
        const resultado = await getDocs(produtosRef);

        if (resultado.empty) {
            containerProdutos.innerHTML = `<p class="empty-message">Nenhum produto cadastrado no momento.</p>`;
            return;
        }

        containerProdutos.innerHTML = "";

        const cacheLojas = {};

        for (const docSnap of resultado.docs) {
            const produto = docSnap.data();

            if (produto.estoque <= 0) continue;

            // Busca o nome da loja na coleção pública "lojas"
            let nomeLoja = cacheLojas[produto.comerciante_id];

            if (!nomeLoja) {
                try {
                    const refLoja = doc(db, "lojas", produto.comerciante_id);
                    const docLoja = await getDoc(refLoja);
                    nomeLoja = docLoja.exists()
                        ? (docLoja.data().nome_loja || "Loja")
                        : "Loja";
                } catch {
                    nomeLoja = "Loja";
                }
                cacheLojas[produto.comerciante_id] = nomeLoja;
            }

            const card = document.createElement("article");
            card.className = "product-card";

            // 1. Primeiro insere o HTML base do card
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
                    <div class="quantidade-seletor">
                        <button type="button" class="btn-qtd" data-acao="diminuir">−</button>
                        <span class="qtd-valor">1</span>
                        <button type="button" class="btn-qtd" data-acao="aumentar">+</button>
                    </div>
                    <button type="button" class="btn-adicionar-carrinho">
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

            // Lógica do seletor de quantidade
            const qtdValor = card.querySelector(".qtd-valor");
            const botoesQtd = card.querySelectorAll(".btn-qtd");

            botoesQtd.forEach((botao) => {
                botao.addEventListener("click", () => {
                    let atual = parseInt(qtdValor.textContent);

                    if (botao.dataset.acao === "aumentar" && atual < produto.estoque) {
                        atual++;
                    } else if (botao.dataset.acao === "diminuir" && atual > 1) {
                        atual--;
                    }

                    qtdValor.textContent = atual;
                });
            });

            // Botão adicionar ao carrinho
            card.querySelector(".btn-adicionar-carrinho").addEventListener("click", async () => {
                const quantidade = parseInt(qtdValor.textContent);
                await adicionarAoCarrinho(docSnap.id, produto, quantidade);
            });

            containerProdutos.appendChild(card);
        }

        if (containerProdutos.innerHTML === "") {
            containerProdutos.innerHTML = `<p class="empty-message">Nenhum produto disponível no momento.</p>`;
        }

    } catch (erro) {
        console.error("Erro ao carregar produtos:", erro);
        containerProdutos.innerHTML = `<p class="empty-message">Não foi possível carregar os produtos.</p>`;
    }
}

await carregarProdutosDisponiveis();

// 5. ENDEREÇO
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