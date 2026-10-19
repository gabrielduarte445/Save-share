import { auth, db } from "../../public/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

export function protegerPagina({ permitirAdmin = false } = {}) {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (usuario) => {
            // Se não estiver logado, redireciona para o login
            if (!usuario) {
                window.location.href = "/public/login.html";
                return;
            }

            try {
                // 1. Checa a claim de Admin no Token JWT
                const tokenResult = await usuario.getIdTokenResult();
                const ehAdmin = tokenResult.claims.admin === true;

                // Se a rota exige Admin e o token confirma admin: true, libera o acesso imediatamente
                if (permitirAdmin && ehAdmin) {
                    resolve({ usuario, ehAdmin: true });
                    return;
                }

                // 2. Se a rota exige admin mas o usuário NÃO é admin
                if (permitirAdmin && !ehAdmin) {
                    alert("Acesso restrito a administradores.");
                    window.location.href = "/public/index.html";
                    return;
                }

                // 3. Para rotas de usuários normais, busca o perfil no Firestore
                const docRef = doc(db, "usuarios", usuario.uid);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists() && !ehAdmin) {
                    alert("Não encontramos seu cadastro. Fale com o suporte se o problema continuar.");
                    window.location.href = "/public/login.html";
                    return;
                }

                resolve({ usuario, dadosPerfil: docSnap.data() || {} });

            } catch (erro) {
                console.error("Erro na verificação de acesso:", erro);
                window.location.href = "/public/login.html";
            }
        });
    });
}