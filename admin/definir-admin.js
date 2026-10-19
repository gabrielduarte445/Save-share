import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "fs";

// Carrega a chave privada
const serviceAccount = JSON.parse(
    readFileSync(new URL("./chave-privada-firebase.json", import.meta.url))
);

// Inicializa o app
const app = initializeApp({
    credential: cert(serviceAccount)
});

// Pega o UID passado pelo terminal ou cole diretamente na string abaixo
const uidAdmin = process.argv[2] || "7hpUVaUofNjRCLMEThDN";

async function executar() {
    try {
        await getAuth(app).setCustomUserClaims(uidAdmin, { admin: true });
        console.log(`\n✅ Permissão de Administrador atribuída com sucesso ao UID: ${uidAdmin}`);
        process.exit(0);
    } catch (erro) {
        console.error("\n❌ Detalhes do erro:", erro);
        process.exit(1);
    }
}

executar();