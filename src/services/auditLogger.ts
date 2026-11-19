import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export async function recordAuditLog(
  action: string,
  module: string,
  targetId: string,
  details: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await addDoc(collection(db, 'audit_logs'), {
      action: action.slice(0, 120),
      module: module.slice(0, 80),
      targetId: targetId.slice(0, 128),
      details: details.slice(0, 600),
      actorUid: user.uid,
      actorEmail: (user.email || 'unknown').slice(0, 120),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Failed to write audit log:', err);
  }
}
