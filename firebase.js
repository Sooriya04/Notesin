const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const serviceAcc = require("./crud-app-c5e3e-firebase-adminsdk-fbsvc-a09d4c3224.json");

initializeApp({
  credential: cert(serviceAcc),
});

const db = getFirestore();

module.exports = { db };
