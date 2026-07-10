// ============================================================
// Tentacalendar — config.js
// Version 0.4.0 (real Firebase values baked in; self-declares
// CONFIG_VERSION for the runtime version report)
// This file is fully deployment-ready — no placeholders remain.
// ============================================================

export const CONFIG_VERSION = "0.4.0";

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAT6GFOGDQxFk-UpNfrAjTLWXNUxFV7LX4",
  authDomain: "tentacalendar.firebaseapp.com",
  projectId: "tentacalendar",
  storageBucket: "tentacalendar.firebasestorage.app",
  messagingSenderId: "1046548387495",
  appId: "1:1046548387495:web:823c563e2474f1a757ad82"
};

// Only these Google accounts may sign in and read/write.
// Must match the emails in firestore.rules.
export const ALLOWED_EMAILS = [
  "jacob.v.wilson@gmail.com",
  "katie.wilson.bynac@gmail.com"
];

// v1 ships with exactly one workspace (HANDOFF D12).
export const WORKSPACE_ID = "primary";
