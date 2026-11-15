import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

try {
  const localKeyPath = path.join(process.cwd(), 'serviceAccountKey.json');
  const fallbackKeyPath = path.join(__dirname, '../../serviceAccountKey.json');
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    (fs.existsSync(localKeyPath) ? localKeyPath : fallbackKeyPath);

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized with service account key.');
  } else {
    admin.initializeApp();
    console.log('⚠️ GOOGLE_APPLICATION_CREDENTIALS or serviceAccountKey.json not found.');
  }
} catch (e: any) {
  console.log('Firebase Admin init skipped or failed:', e.message);
}

export { admin };
