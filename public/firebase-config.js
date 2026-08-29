import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyC_dcpf5ONUQfXjmEmr8qQ72iMFZru7SvQ",
  authDomain: "save-share-6c89c.firebaseapp.com",
  projectId: "save-share-6c89c",
  storageBucket: "save-share-6c89c.firebasestorage.app",
  messagingSenderId: "166854684268",
  appId: "1:166854684268:web:2f080b7a88fe3571f77249"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export {
    auth,
    db
};