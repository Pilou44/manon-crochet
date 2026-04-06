// Copier ce fichier en config.js et remplir les valeurs réelles
const firebaseConfig = {
  apiKey: "FIREBASE_API_KEY",
  authDomain: "FIREBASE_AUTH_DOMAIN",
  projectId: "FIREBASE_PROJECT_ID",
  storageBucket: "FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "FIREBASE_MESSAGING_SENDER_ID",
  appId: "FIREBASE_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const cloudinaryConfig = {
  cloudName: "CLOUDINARY_CLOUD_NAME",
  uploadPreset: "CLOUDINARY_UPLOAD_PRESET"
};

const siteConfig = {
  email: "CONTACT_EMAIL",
  nom: "SITE_NAME"
};
