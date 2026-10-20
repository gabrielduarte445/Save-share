// App Check: prova ao Firebase que a chamada vem do SEU site (e não de um
// script copiando sua configuração). O Firebase AI Logic exige isso.
//
// A chave de SITE do reCAPTCHA é pública: pode ficar no código.
// A chave SECRETA vai só no Console (App Check > Apps > reCAPTCHA).

import { getApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
    initializeAppCheck,
    ReCaptchaV3Provider
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app-check.js";

const CHAVE_RECAPTCHA_SITE = "COLE_AQUI_A_CHAVE_DE_SITE_DO_RECAPTCHA_V3";

if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

let appCheck = null;

try {
    appCheck = initializeAppCheck(getApp(), {
        provider: new ReCaptchaV3Provider(CHAVE_RECAPTCHA_SITE),
        isTokenAutoRefreshEnabled: true
    });
} catch (erro) {
    console.error("Erro ao iniciar o App Check:", erro);
}

export { appCheck };