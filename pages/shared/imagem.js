const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
const TAMANHO_MAXIMO_ORIGINAL = 10 * 1024 * 1024;


async function carregarImagem(arquivo) {

    if (typeof createImageBitmap === "function") {
        try {
            // "from-image" respeita a rotação das fotos tiradas no celular
            return await createImageBitmap(arquivo, { imageOrientation: "from-image" });
        } catch {
            // usa o plano B abaixo
        }
    }

    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(arquivo);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("imagem-invalida")); };
        img.src = url;
    });
}


/**
 * Reduz a imagem e devolve o JPEG em base64 (sem o prefixo "data:...").
 * Erros: tipo-invalido, arquivo-grande, imagem-invalida, nao-reduziu.
 */
export async function prepararImagem(arquivo, { maxLado = 640, maxChars = 90000 } = {}) {

    if (!TIPOS_ACEITOS.includes(arquivo.type)) {
        throw new Error("tipo-invalido");
    }

    if (arquivo.size > TAMANHO_MAXIMO_ORIGINAL) {
        throw new Error("arquivo-grande");
    }

    const original = await carregarImagem(arquivo);
    let escala = Math.min(1, maxLado / Math.max(original.width, original.height));

    for (let tentativa = 0; tentativa < 6; tentativa++) {

        const largura = Math.max(1, Math.round(original.width * escala));
        const altura = Math.max(1, Math.round(original.height * escala));

        const canvas = document.createElement("canvas");
        canvas.width = largura;
        canvas.height = altura;

        const contexto = canvas.getContext("2d");
        contexto.fillStyle = "#ffffff";   // fundo branco para PNG com transparência
        contexto.fillRect(0, 0, largura, altura);
        contexto.drawImage(original, 0, 0, largura, altura);

        for (const qualidade of [0.8, 0.7, 0.6, 0.5]) {
            const base64 = canvas.toDataURL("image/jpeg", qualidade).split(",")[1];

            if (base64.length <= maxChars) {
                return base64;
            }
        }

        escala *= 0.8;
    }

    throw new Error("nao-reduziu");
}