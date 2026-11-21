
import fs from "node:fs";
import path from "node:path";
import {
  cert,
  getApps,
  initializeApp,
  type ServiceAccount
} from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

function initializeFirebaseAdmin() {
  const existingApp = getApps().find(
    (app) => app.name === "[DEFAULT]"
  );

  if (existingApp) {
    return existingApp;
  }

  let serviceAccount: ServiceAccount;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    serviceAccount = JSON.parse(serviceAccountJson) as ServiceAccount;
  } else {
    const serviceAccountPath = path.resolve(
      process.cwd(),
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
        "./secrets/firebase-service-account.json"
    );

    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(
        `Firebase service account not found: ${serviceAccountPath}`
      );
    }

    serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf8")
    ) as ServiceAccount;
  }

  return initializeApp({
    credential: cert(serviceAccount)
  });
}

const firebaseAdminApp = initializeFirebaseAdmin();

export const firebaseMessaging = getMessaging(firebaseAdminApp);
