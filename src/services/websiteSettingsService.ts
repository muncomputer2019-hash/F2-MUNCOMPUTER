import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { recordAuditLog } from './auditLogger';
import type { WebsiteSettings } from '../types';

export function buildWebsiteSettingsPayload(
  targetSettings: WebsiteSettings,
  uid: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    businessName: (targetSettings.businessName || 'MUN COMPUTER').trim().slice(0, 100),
    businessType: (
      targetSettings.businessType || 'Digital Service & Computer Solutions Centre'
    )
      .trim()
      .slice(0, 160),
    heroHeading: (targetSettings.heroHeading || 'WELCOME TO MUN COMPUTER').trim().slice(0, 160),
    heroSubtitle: (
      targetSettings.heroSubtitle || 'Your Trusted Digital Service & Computer Solutions Centre.'
    )
      .trim()
      .slice(0, 220),
    heroDescription: (
      targetSettings.heroDescription ||
      'MUN COMPUTER provides digital service assistance, computer solutions, documentation support and customer-focused services.'
    )
      .trim()
      .slice(0, 600),
    phone: (targetSettings.phone || '+91 8101352105').trim().slice(0, 30),
    whatsapp: (targetSettings.whatsapp || '+91 8101352105').trim().slice(0, 30),
    email: (targetSettings.email || 'MUNCOMPUTER2019@GMAIL.COM').trim().slice(0, 120),
    businessHoursConfigured: Boolean(targetSettings.businessHoursConfigured),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  };

  const optStrings: (keyof WebsiteSettings)[] = [
    'logoDataUrl',
    'faviconDataUrl',
    'heroImageUrl',
    'aboutIntro',
    'mission',
    'vision',
    'serviceCommitment',
    'village',
    'postOffice',
    'policeStation',
    'district',
    'state',
    'country',
    'pinCode',
    'openingTime',
    'closingTime',
    'specialHolidayNotice',
    'temporaryClosureNotice',
    'shopMapAddress',
  ];

  for (const key of optStrings) {
    const val = targetSettings[key];
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.length > 0) {
        payload[key] = key === 'shopMapAddress' ? trimmed.slice(0, 300) : trimmed;
      }
    }
  }

  if (
    typeof targetSettings.shopLat === 'number' &&
    typeof targetSettings.shopLng === 'number' &&
    Number.isFinite(targetSettings.shopLat) &&
    Number.isFinite(targetSettings.shopLng) &&
    targetSettings.shopLat >= -90 &&
    targetSettings.shopLat <= 90 &&
    targetSettings.shopLng >= -180 &&
    targetSettings.shopLng <= 180
  ) {
    payload.shopLat = targetSettings.shopLat;
    payload.shopLng = targetSettings.shopLng;
  }

  if (Array.isArray(targetSettings.weeklyHolidays)) {
    payload.weeklyHolidays = targetSettings.weeklyHolidays.slice(0, 7);
  }

  return payload;
}

export async function saveWebsiteSettingsToFirestore(
  targetSettings: WebsiteSettings,
  uid: string,
  auditAction = 'UPDATE_WEBSITE_SETTINGS',
  auditDetails = 'Updated website profile, logo, GPS location, or business hours'
): Promise<void> {
  try {
    const payload = buildWebsiteSettingsPayload(targetSettings, uid);
    await setDoc(doc(db, 'website_settings', 'main'), payload);
    await recordAuditLog(auditAction, 'Website Management', 'main', auditDetails);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'website_settings/main');
  }
}
