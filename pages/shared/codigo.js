
const CARACTERES = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function gerarCodigo(tamanho = 6) {

    const array = new Uint8Array(tamanho);
    crypto.getRandomValues(array);

    let resultado = "";

    for (let i = 0; i < tamanho; i++) {
        resultado += CARACTERES[array[i] % CARACTERES.length];
    }

    return resultado;
}