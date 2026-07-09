// ============================================================
// Tentacalendar — config.js
// Version 0.2.0
// THE ONLY FILE YOU SHOULD NEED TO EDIT BY HAND.
// 1. Create Firebase project "tentacalendar" (Blaze plan)
// 2. Enable Firestore + Authentication (Google provider)
// 3. Add a Web App in project settings, paste its config below
// ============================================================

export const FIREBASE_CONFIG = {
  apiKey: "PASTE_ME",
  authDomain: "PASTE_ME.firebaseapp.com",
  projectId: "PASTE_ME",
  storageBucket: "PASTE_ME.appspot.com",
  messagingSenderId: "PASTE_ME",
  appId: "PASTE_ME"
};

// Only these Google accounts may sign in and read/write.
// Must match the emails in firestore.rules.
export const ALLOWED_EMAILS = [
  "jacob.v.wilson@gmail.com",
  "KATIE_EMAIL_HERE@gmail.com"
];

// v1 ships with exactly one workspace (HANDOFF D12).
export const WORKSPACE_ID = "primary";

export const APP_VERSION = "0.2.0";
