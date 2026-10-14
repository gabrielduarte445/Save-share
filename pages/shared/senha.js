export const COMPRIMENTO_MINIMO = 6;
export const COMPRIMENTO_MAXIMO = 64;

export const REQUISITOS_SENHA = [
    {
        id: "tamanho",
        texto: `Pelo menos ${COMPRIMENTO_MINIMO} caracteres`,
        testar: (s) => s.length >= COMPRIMENTO_MINIMO && s.length <= COMPRIMENTO_MAXIMO
    },
    { id: "minuscula", texto: "Uma letra minúscula", testar: (s) => /\p{Ll}/u.test(s) },
    { id: "maiuscula", texto: "Uma letra maiúscula", testar: (s) => /\p{Lu}/u.test(s) },
    { id: "numero", texto: "Um número", testar: (s) => /\d/.test(s) },
    {
        id: "especial",
        texto: "Um caractere especial (ex.: ! @ # $ %)",
        // letras acentuadas, números e espaços não contam como especiais
        testar: (s) => /[^\p{L}\p{N}\s]/u.test(s)
    }
];

export function requisitosNaoAtendidos(senha) {
    return REQUISITOS_SENHA.filter((requisito) => !requisito.testar(senha));
}

export function senhaValida(senha) {
    return requisitosNaoAtendidos(senha).length === 0;
}

// Desenha a lista de requisitos e a atualiza enquanto o usuário digita.
export function ativarChecklistSenha(campoSenha, lista) {

    lista.innerHTML = "";
    const itens = {};

    REQUISITOS_SENHA.forEach((requisito) => {
        const item = document.createElement("li");
        item.textContent = requisito.texto;
        lista.appendChild(item);
        itens[requisito.id] = item;
    });

    function atualizar() {
        REQUISITOS_SENHA.forEach((requisito) => {
            itens[requisito.id].classList.toggle("ok", requisito.testar(campoSenha.value));
        });
    }

    campoSenha.addEventListener("input", atualizar);
    atualizar();
}