export function gerarCodigoFormatado(tamanho = 6) {
    const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const array = new Uint8Array(tamanho);
    
    crypto.getRandomValues(array);
    
    let resultado = "";
    for (let i = 0; i < tamanho; i++) {
        // Mapeia cada valor aleatório uniformemente para os caracteres disponíveis
        resultado += caracteres[array[i] % caracteres.length];
    }
    
    return resultado;
}