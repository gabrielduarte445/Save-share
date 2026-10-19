import admin from "firebase-admin";
import serviceAccount from "./chave-privada-firebase.json" assert { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const ADMIN_UID = window.ENV?.ADMIN_UID;

if (!ADMIN_UID) {
    console.error("Erro: ADMIN_UID não configurado no env.js!");
} else {
async function tornarAdmin(uid) {
  try {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log(`Sucesso! O utilizador ${uid} agora é um Administrador.`);
    process.exit(0);
  } catch (erro) {
    console.error("Erro ao definir claim de admin:", erro);
    process.exit(1);
  }
}
}
tornarAdmin(uidAdmin);