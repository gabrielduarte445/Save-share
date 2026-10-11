export function gerarCodigo() {
    const numero = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
    return String(numero).padStart(6, "0");
}