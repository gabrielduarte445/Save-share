
import { auth, db } from "../../public/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

export function protegerPagina({ permitirAdmin = false } = {}) {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (usuario) => {
            if (!usuario) {
                window.location.href = "/public/login.html";
                return;
            }

            // 1. Força a verificação das claims de Administrador no Token JWT
            const tokenResult = await usuario.getIdTokenResult();
            const ehAdmin = tokenResult.claims.admin === true;

            // Se a rota exige admin e o token confirma admin: true, libera o acesso imediatamente
            if (permitirAdmin && ehAdmin) {
                resolve({ usuario, ehAdmin: true });
                return;
            }

            // 2. Para rotas normais ou fallback, busca o documento na coleção 'usuarios'
            try {
                const docRef = doc(db, "usuarios", usuario.uid);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists() && !ehAdmin) {
                    alert("Não encontramos seu cadastro. Fale com o suporte se o problema continuar.");
                    window.location.href = "/public/login.html";
                    return;
                }

                resolve({ usuario, dadosPerfil: docSnap.data() || {} });

            } catch (erro) {
                console.error("Erro ao validar permissões:", erro);
                // Se for admin, não bloqueia em caso de falha de leitura no Firestore
                if (ehAdmin) {
                    resolve({ usuario, ehAdmin: true });
                } else {
                    window.location.href = "/public/login.html";
                }
            }
        });
    });
}