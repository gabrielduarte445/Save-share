import { auth, db } from "../../public/firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/**
 * Libera a página só para usuário logado (e, opcionalmente, de certos tipos).
 * Retorna { usuario, dados } quando liberado; caso contrário, redireciona.
 */
export function protegerPagina({ tipos = null } = {}) {

    return new Promise((resolve) => {

        onAuthStateChanged(auth, async (usuario) => {

            if (!usuario) {
                window.location.replace("/public/login.html");
                return;
            }

            let dados = null;

            try {
                const snap = await getDoc(doc(db, "usuarios", usuario.uid));
                dados = snap.exists() ? snap.data() : null;
            } catch {
                dados = null;
            }

            if (!dados) {
                window.location.replace("/public/login.html");
                return;
            }

            if (tipos && !tipos.includes(dados.tipo_usuario)) {
                window.location.replace("/public/home.html");
                return;
            }

            // Mantém o nome da loja na coleção pública "lojas" (ver Parte 2)
            if (dados.tipo_usuario === "comerciante" && dados.nome_loja
                && !sessionStorage.getItem("loja_sincronizada")) {
                try {
                    await setDoc(doc(db, "lojas", usuario.uid), { nome_loja: dados.nome_loja });
                    sessionStorage.setItem("loja_sincronizada", "1");
                } catch {
                    // sem problema, tenta de novo na próxima visita
                }
            }

            document.documentElement.classList.remove("aguardando-auth");
            resolve({ usuario, dados });
        });
    });
}