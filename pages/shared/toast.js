let containerToast = null;

function garantirContainer() {
    if (containerToast) return containerToast;

    containerToast = document.createElement("div");
    containerToast.id = "toast-container";
    document.body.appendChild(containerToast);
    return containerToast;
}

/**
 * Mostra uma notificação temporária na tela.
 * @param {string} mensagem - texto a exibir
 * @param {"sucesso"|"erro"|"info"} tipo - estilo visual do toast
 * @param {number} duracaoMs - tempo até sumir sozinho (padrão 3500ms)
 */
export function mostrarToast(mensagem, tipo = "info", duracaoMs = 3500) {

    const container = garantirContainer();

    const toast = document.createElement("div");
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensagem;

    container.appendChild(toast);

    // Força reflow para a animação de entrada funcionar
    requestAnimationFrame(() => toast.classList.add("toast-visivel"));

    setTimeout(() => {
        toast.classList.remove("toast-visivel");
        toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    }, duracaoMs);
}

/**
 Versão "confirmação" — substitui o confirm() nativo.
 Retorna uma Promise<boolean>.
 */
export function confirmarAcao(mensagem) {
    return new Promise((resolve) => {

        const overlay = document.createElement("div");
        overlay.className = "confirm-overlay";
        overlay.innerHTML = `
            <div class="confirm-caixa">
                <p class="confirm-mensagem">${mensagem}</p>
                <div class="confirm-botoes">
                    <button type="button" class="confirm-btn confirm-cancelar">Cancelar</button>
                    <button type="button" class="confirm-btn confirm-confirmar">Confirmar</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add("confirm-visivel"));

        function fechar(resultado) {
            overlay.classList.remove("confirm-visivel");
            overlay.addEventListener("transitionend", () => overlay.remove(), { once: true });
            resolve(resultado);
        }

        overlay.querySelector(".confirm-cancelar").addEventListener("click", () => fechar(false));
        overlay.querySelector(".confirm-confirmar").addEventListener("click", () => fechar(true));
    });
}