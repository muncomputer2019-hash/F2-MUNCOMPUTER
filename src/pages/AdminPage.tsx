import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe,
  History,
  LayoutDashboard,
  LocateFixed,
  LogOut,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import {
  LOGO_ASSET_CONFIG,
  SERVICE_CATEGORIES,
} from '../config/businessConfig';
import {
  FULL_SERVICES_CATALOG,
  TOTAL_CATALOG_SERVICES,
} from '../config/servicesCatalog';
import { useAuth } from '../context/AuthContext';
import { useWebsiteSettings } from '../context/WebsiteSettingsContext';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { recordAuditLog } from '../services/auditLogger';
import { formatFirestoreDate, parseLatLngFromInput } from '../services/publicData';
import type {
  AuditLog,
  CustomerFeedback,
  FeedbackStatus,
  NoticeCategory,
  NoticeStatus,
  PublicNotice,
  PublicServiceItem,
  StaffUser,
  UserRole,
  WebsiteSettings,
} from '../types';

type AdminTab = 'website' | 'services' | 'notices' | 'feedback' | 'staff' | 'audit';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { firebaseUser, logoutPortal } = useAuth();
  const { settings, effectiveLogoUrl } = useWebsiteSettings();

  const [activeTab, setActiveTab] = useState<AdminTab>('website');
  const [bannerMsg, setBannerMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Website Settings Form
  const [formSettings, setFormSettings] = useState<WebsiteSettings>(settings);
  const [latInput, setLatInput] = useState(
    typeof settings.shopLat === 'number' ? String(settings.shopLat) : ''
  );
  const [lngInput, setLngInput] = useState(
    typeof settings.shopLng === 'number' ? String(settings.shopLng) : ''
  );
  const [gpsCapturing, setGpsCapturing] = useState(false);
  const [gpsPermissionBlocked, setGpsPermissionBlocked] = useState(false);

  useEffect(() => {
    setFormSettings(settings);
    setLatInput(typeof settings.shopLat === 'number' ? String(settings.shopLat) : '');
    setLngInput(typeof settings.shopLng === 'number' ? String(settings.shopLng) : '');
  }, [settings]);

  // Public Services
  const [publicServices, setPublicServices] = useState<PublicServiceItem[]>([]);
  const [srvTitle, setSrvTitle] = useState('');
  const [srvCat, setSrvCat] = useState(SERVICE_CATEGORIES[0].title);
  const [srvShort, setSrvShort] = useState('');
  const [srvDocs, setSrvDocs] = useState('');

  // Notices
  const [notices, setNotices] = useState<PublicNotice[]>([]);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeDesc, setNoticeDesc] = useState('');
  const [noticeCat, setNoticeCat] = useState<NoticeCategory>('Business Announcement');
  const [noticeStatus, setNoticeStatus] = useState<NoticeStatus>('published');
  const [noticeExpires, setNoticeExpires] = useState('');
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);

  // Feedback
  const [feedbackList, setFeedbackList] = useState<CustomerFeedback[]>([]);
  const [fbSearch, setFbSearch] = useState('');
  const [fbCategoryFilter, setFbCategoryFilter] = useState('All');
  const [fbRatingFilter, setFbRatingFilter] = useState('All');
  const [fbStatusFilter, setFbStatusFilter] = useState<'All' | FeedbackStatus>('All');
  const [fbDateFilter, setFbDateFilter] = useState('');
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [confirmDeleteFbId, setConfirmDeleteFbId] = useState<string | null>(null);

  // Staff Users
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [newStaffUid, setNewStaffUid] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('staff');

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useDocumentMeta({
    title: 'Admin Control Panel – MUN COMPUTER',
    description: 'Admin-controlled website management, feedback moderation, and notice board.',
  });

  useEffect(() => {
    if (!firebaseUser) return;

    const unsubSrv = onSnapshot(
      query(collection(db, 'public_services'), orderBy('sortOrder', 'asc')),
      (snap) =>
        setPublicServices(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PublicServiceItem, 'id'>) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'public_services')
    );

    const unsubNotices = onSnapshot(
      query(collection(db, 'public_notices'), orderBy('createdAt', 'desc')),
      (snap) =>
        setNotices(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PublicNotice, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'public_notices')
    );

    const unsubFeedback = onSnapshot(
      query(collection(db, 'customer_feedback'), orderBy('createdAt', 'desc')),
      (snap) =>
        setFeedbackList(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomerFeedback, 'id'>) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'customer_feedback')
    );

    const unsubStaff = onSnapshot(
      collection(db, 'staff_users'),
      (snap) => setStaffList(snap.docs.map((d) => d.data() as StaffUser)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'staff_users')
    );

    const unsubLogs = onSnapshot(
      query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc')),
      (snap) =>
        setAuditLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'audit_logs')
    );

    return () => {
      unsubSrv();
      unsubNotices();
      unsubFeedback();
      unsubStaff();
      unsubLogs();
    };
  }, [firebaseUser]);

  const notify = (msg: string) => {
    setErrorMsg('');
    setBannerMsg(msg);
    setTimeout(() => setBannerMsg(''), 4500);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'logoDataUrl' | 'faviconDataUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');

    if (!LOGO_ASSET_CONFIG.acceptedMimeTypes.includes(file.type)) {
      setErrorMsg('Unsupported file format. Please upload PNG, JPG, JPEG, SVG, or WebP.');
      return;
    }
    if (file.size > LOGO_ASSET_CONFIG.maxUploadBytes) {
      setErrorMsg('File size must be under 240 KB so it can be stored reliably in Firebase.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormSettings((prev) => ({ ...prev, [target]: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const persistWebsiteSettings = async (
    targetSettings: WebsiteSettings,
    latText: string,
    lngText: string,
    options?: {
      successMsg?: string;
      auditAction?: string;
      auditDetails?: string;
    }
  ): Promise<boolean> => {
    if (!firebaseUser) return false;
    setErrorMsg('');

    const trimmedLat = latText.trim();
    const trimmedLng = lngText.trim();
    let parsedLat: number | undefined;
    let parsedLng: number | undefined;

    if ((trimmedLat && !trimmedLng) || (!trimmedLat && trimmedLng)) {
      setErrorMsg('Please provide both Latitude and Longitude coordinates, or leave both blank.');
      return false;
    }

    if (trimmedLat && trimmedLng) {
      parsedLat = Number(trimmedLat);
      parsedLng = Number(trimmedLng);
      if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
        setErrorMsg('Latitude must be a valid decimal number between -90 and 90.');
        return false;
      }
      if (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180) {
        setErrorMsg('Longitude must be a valid decimal number between -180 and 180.');
        return false;
      }
    }

    try {
      const payload: Record<string, unknown> = {
        businessName: (targetSettings.businessName || 'MUN COMPUTER').trim().slice(0, 100),
        businessType: (targetSettings.businessType || 'Digital Service & Computer Solutions Centre')
          .trim()
          .slice(0, 160),
        heroHeading: (targetSettings.heroHeading || 'WELCOME TO MUN COMPUTER').trim().slice(0, 160),
        heroSubtitle: (targetSettings.heroSubtitle || '').trim().slice(0, 220),
        heroDescription: (targetSettings.heroDescription || '').trim().slice(0, 600),
        phone: (targetSettings.phone || '+91 8101352105').trim().slice(0, 30),
        whatsapp: (targetSettings.whatsapp || '+91 8101352105').trim().slice(0, 30),
        email: (targetSettings.email || 'MUNCOMPUTER2019@GMAIL.COM').trim().slice(0, 120),
        businessHoursConfigured: Boolean(targetSettings.businessHoursConfigured),
        updatedAt: serverTimestamp(),
        updatedBy: firebaseUser.uid,
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
      if (typeof parsedLat === 'number' && typeof parsedLng === 'number') {
        payload.shopLat = parsedLat;
        payload.shopLng = parsedLng;
      }
      if (Array.isArray(targetSettings.weeklyHolidays)) {
        payload.weeklyHolidays = targetSettings.weeklyHolidays.slice(0, 7);
      }

      await setDoc(doc(db, 'website_settings', 'main'), payload);
      await recordAuditLog(
        options?.auditAction || 'UPDATE_WEBSITE_SETTINGS',
        'Website Management',
        'main',
        options?.auditDetails || 'Updated website profile, logo, GPS location, or business hours'
      );
      notify(options?.successMsg || 'Website settings saved and published.');
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'website_settings/main');
      return false;
    }
  };

  const handleSaveWebsiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistWebsiteSettings(formSettings, latInput, lngInput);
  };

  const handleCaptureAndSaveGpsLocation = () => {
    setErrorMsg('');
    setGpsPermissionBlocked(false);
    if (!('geolocation' in navigator)) {
      setErrorMsg('Browser GPS geolocation is not supported on this device.');
      return;
    }

    setGpsCapturing(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const capturedLat = Number(pos.coords.latitude.toFixed(7));
        const capturedLng = Number(pos.coords.longitude.toFixed(7));
        const nextLatStr = String(capturedLat);
        const nextLngStr = String(capturedLng);

        setLatInput(nextLatStr);
        setLngInput(nextLngStr);
        const updatedSettings: WebsiteSettings = {
          ...formSettings,
          shopLat: capturedLat,
          shopLng: capturedLng,
        };
        setFormSettings(updatedSettings);

        await persistWebsiteSettings(updatedSettings, nextLatStr, nextLngStr, {
          successMsg: `Present shop GPS location (${capturedLat}, ${capturedLng}) captured and saved live!`,
          auditAction: 'UPDATE_SHOP_GPS_LOCATION',
          auditDetails: `Captured live GPS coordinates (${capturedLat}, ${capturedLng})`,
        });
        setGpsCapturing(false);
      },
      (err) => {
        setGpsCapturing(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsPermissionBlocked(true);
          setErrorMsg(
            'Location permission denied in this preview/browser window. Open Admin in a new tab for live device GPS, OR paste a Google Maps URL / coordinates below.'
          );
        } else if (err.code === err.TIMEOUT) {
          setErrorMsg('GPS signal timed out. Move near an open window/door or paste coordinates manually.');
        } else {
          setErrorMsg('Unable to fetch GPS location automatically. Please enter coordinates manually.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleLatInputChange = (raw: string) => {
    setGpsPermissionBlocked(false);
    // Allow pasting "24.123456, 88.567890" OR a full Google Maps URL straight into the field
    const parsed = parseLatLngFromInput(raw);
    if (parsed) {
      setLatInput(String(parsed.lat));
      setLngInput(String(parsed.lng));
      return;
    }
    setLatInput(raw);
  };


  const handleAddPublicService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const id = `srv-${Date.now()}`;
    try {
      await setDoc(doc(db, 'public_services', id), {
        title: srvTitle.trim().slice(0, 140),
        category: srvCat.slice(0, 100),
        shortDescription: srvShort.trim().slice(0, 300),
        requiredDocuments: srvDocs.trim().slice(0, 600),
        isActive: true,
        sortOrder: publicServices.length + 1,
        updatedAt: serverTimestamp(),
        updatedBy: firebaseUser.uid,
      });
      await recordAuditLog('CREATE_PUBLIC_SERVICE', 'Public Services', id, `Added ${srvTitle}`);
      setSrvTitle('');
      setSrvShort('');
      setSrvDocs('');
      notify('Public service added.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `public_services/${id}`);
    }
  };

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    try {
      if (editingNoticeId) {
        const updatePayload: Record<string, unknown> = {
          title: noticeTitle.trim().slice(0, 160),
          description: noticeDesc.trim().slice(0, 3000),
          category: noticeCat,
          status: noticeStatus,
          isExpired: false,
          publishedAt: noticeStatus === 'published' ? serverTimestamp() : null,
          updatedAt: serverTimestamp(),
        };
        if (noticeExpires.trim()) updatePayload.expiresAt = noticeExpires.trim().slice(0, 40);
        await updateDoc(doc(db, 'public_notices', editingNoticeId), updatePayload);
        await recordAuditLog('UPDATE_NOTICE', 'Notice Board', editingNoticeId, `Updated notice ${noticeTitle}`);
        setEditingNoticeId(null);
        notify('Notice updated.');
      } else {
        const createPayload: Record<string, unknown> = {
          title: noticeTitle.trim().slice(0, 160),
          description: noticeDesc.trim().slice(0, 3000),
          category: noticeCat,
          status: noticeStatus,
          isExpired: false,
          publishedAt: noticeStatus === 'published' ? serverTimestamp() : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: firebaseUser.uid,
        };
        if (noticeExpires.trim()) createPayload.expiresAt = noticeExpires.trim().slice(0, 40);
        const ref = await addDoc(collection(db, 'public_notices'), createPayload);
        await recordAuditLog('CREATE_NOTICE', 'Notice Board', ref.id, `Created notice ${noticeTitle} (${noticeStatus})`);
        notify('Notice created.');
      }
      setNoticeTitle('');
      setNoticeDesc('');
      setNoticeExpires('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'public_notices');
    }
  };

  const handleFeedbackAction = async (
    fb: CustomerFeedback,
    nextStatus: FeedbackStatus,
    publishPublicly = false
  ) => {
    if (!firebaseUser) return;
    if (publishPublicly && !fb.publicationConsent) {
      setErrorMsg('Cannot publish publicly: customer did not grant publication consent.');
      return;
    }

    const adminResponse = (responseDrafts[fb.id] ?? fb.adminResponse ?? '').trim().slice(0, 1000);
    try {
      const updatePayload: Record<string, unknown> = {
        status: nextStatus,
        reviewedBy: firebaseUser.uid,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (adminResponse) updatePayload.adminResponse = adminResponse;

      await updateDoc(doc(db, 'customer_feedback', fb.id), updatePayload);

      if (publishPublicly && fb.publicationConsent) {
        const reviewPayload: Record<string, unknown> = {
          feedbackId: fb.id,
          displayName: fb.customerName?.trim() || 'Verified Customer',
          serviceCategory: fb.serviceCategory,
          rating: fb.rating,
          message: fb.message,
          approvedAt: serverTimestamp(),
          createdAt: fb.createdAt || serverTimestamp(),
          publishedBy: firebaseUser.uid,
        };
        if (adminResponse) reviewPayload.adminResponse = adminResponse;
        await setDoc(doc(db, 'public_reviews', fb.id), reviewPayload);
      } else if (nextStatus === 'REJECTED' || nextStatus === 'ARCHIVED') {
        await deleteDoc(doc(db, 'public_reviews', fb.id)).catch(() => undefined);
      }

      await recordAuditLog(
        `FEEDBACK_${nextStatus}`,
        'Customer Feedback',
        fb.id,
        `Marked ${fb.feedbackCode} as ${nextStatus}${publishPublicly ? ' and published review' : ''}`
      );
      notify(`Feedback ${fb.feedbackCode} updated to ${nextStatus}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `customer_feedback/${fb.id}`);
    }
  };

  const handleDeleteFeedback = async (fb: CustomerFeedback) => {
    try {
      await deleteDoc(doc(db, 'customer_feedback', fb.id));
      await deleteDoc(doc(db, 'public_reviews', fb.id)).catch(() => undefined);
      await recordAuditLog('DELETE_FEEDBACK', 'Customer Feedback', fb.id, `Deleted ${fb.feedbackCode}`);
      setConfirmDeleteFbId(null);
      notify(`Feedback ${fb.feedbackCode} deleted.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `customer_feedback/${fb.id}`);
    }
  };

  const handleAddStaffUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = newStaffUid.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(uid)) {
      setErrorMsg('User UID must contain only letters, numbers, hyphens, or underscores.');
      return;
    }
    try {
      await setDoc(doc(db, 'staff_users', uid), {
        uid,
        email: newStaffEmail.trim().slice(0, 120),
        displayName: newStaffName.trim().slice(0, 100),
        role: newStaffRole,
        status: 'active',
        registeredDevices: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await recordAuditLog('ADD_STAFF_USER', 'Staff Management', uid, `Added ${newStaffEmail} as ${newStaffRole}`);
      setNewStaffUid('');
      setNewStaffEmail('');
      setNewStaffName('');
      notify('Staff account registered.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `staff_users/${uid}`);
    }
  };

  const feedbackStats = useMemo(() => {
    const total = feedbackList.length;
    const counts = {
      NEW: 0,
      UNDER_REVIEW: 0,
      APPROVED: 0,
      REJECTED: 0,
      ARCHIVED: 0,
    };
    let sumRating = 0;
    for (const f of feedbackList) {
      counts[f.status] = (counts[f.status] || 0) + 1;
      sumRating += f.rating || 0;
    }
    const avg = total > 0 ? (sumRating / total).toFixed(1) : '0.0';
    return { total, ...counts, avg };
  }, [feedbackList]);

  const filteredFeedback = useMemo(() => {
    const q = fbSearch.trim().toLowerCase();
    return feedbackList.filter((fb) => {
      if (fbCategoryFilter !== 'All' && fb.serviceCategory !== fbCategoryFilter) return false;
      if (fbRatingFilter !== 'All' && String(fb.rating) !== fbRatingFilter) return false;
      if (fbStatusFilter !== 'All' && fb.status !== fbStatusFilter) return false;
      if (fbDateFilter && fb.createdAt?.toDate) {
        const dStr = fb.createdAt.toDate().toISOString().slice(0, 10);
        if (dStr !== fbDateFilter) return false;
      }
      if (
        q &&
        !fb.feedbackCode.toLowerCase().includes(q) &&
        !(fb.customerName || '').toLowerCase().includes(q) &&
        !(fb.serviceReferenceId || '').toLowerCase().includes(q) &&
        !fb.message.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [feedbackList, fbSearch, fbCategoryFilter, fbRatingFilter, fbStatusFilter, fbDateFilter]);

  const ADMIN_TABS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'website', label: 'Website & Logo', icon: <Globe className="w-4 h-4" /> },
    { id: 'services', label: 'Public Services', icon: <FileText className="w-4 h-4" /> },
    { id: 'notices', label: 'Notice Board', icon: <Bell className="w-4 h-4" /> },
    { id: 'feedback', label: 'Customer Feedback', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'staff', label: 'Staff & Roles', icon: <Users className="w-4 h-4" /> },
    { id: 'audit', label: 'Audit Logs', icon: <History className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between shrink-0">
        <div>
          <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
            <Link to="/" className="font-display font-bold text-slate-950 tracking-tight">
              MUN COMPUTER
            </Link>
            <span className="text-xs font-semibold text-blue-800">Admin</span>
          </div>

          <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
            {ADMIN_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-blue-800 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 space-y-2 hidden lg:block">
          <Link
            to="/dashboard"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-semibold text-slate-900 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Business Manager
          </Link>
          <Link
            to="/"
            className="block text-center py-2 px-3 text-xs font-medium text-slate-600 hover:text-slate-950"
          >
            View Public Website
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logoutPortal();
              navigate('/login');
            }}
            className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600 truncate">
            <span className="font-semibold text-slate-950">Admin Control Panel</span>
            <span className="mx-2 text-slate-300">/</span>
            <span className="capitalize">{activeTab}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs text-slate-500">{firebaseUser?.email}</span>
            <Link
              to="/dashboard"
              className="lg:hidden px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 rounded-lg"
            >
              Manager
            </Link>
            <button
              type="button"
              onClick={async () => {
                await logoutPortal();
                navigate('/login');
              }}
              className="lg:hidden px-3 py-1.5 text-xs font-medium text-red-700 border border-red-200 rounded-lg cursor-pointer"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full">
          {bannerMsg && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{bannerMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
              {errorMsg}
            </div>
          )}

          {/* 1. WEBSITE & LOGO MANAGEMENT */}
          {activeTab === 'website' && (
            <form onSubmit={handleSaveWebsiteSettings} className="space-y-6">
              {/* Logo Upload Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="space-y-1">
                  <h2 className="font-display text-lg font-bold text-slate-950">
                    Official Shop Logo &amp; Favicon Upload
                  </h2>
                  <p className="text-xs text-slate-600">
                    Upload your official MUN COMPUTER logo (PNG including transparent PNG, JPG,
                    JPEG, SVG, or WebP, max 240 KB). Original aspect ratio is preserved in header
                    and footer without stretching or cropping.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-dashed border-slate-300 rounded-xl p-5 space-y-3 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-800">Header &amp; Footer Logo</p>
                    <div className="h-16 flex items-center justify-center bg-white border border-slate-200 rounded-lg px-4">
                      {formSettings.logoDataUrl || effectiveLogoUrl ? (
                        <img
                          src={formSettings.logoDataUrl || effectiveLogoUrl}
                          alt="MUN COMPUTER logo preview"
                          className="h-12 w-auto max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-500">
                          Placeholder Active: MUN COMPUTER Text Wordmark
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {formSettings.logoDataUrl
                        ? 'Custom uploaded logo override active.'
                        : 'Official MUN COMPUTER shop logo active by default.'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        Upload New Logo
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp"
                          onChange={(e) => handleLogoUpload(e, 'logoDataUrl')}
                          className="hidden"
                        />
                      </label>
                      {formSettings.logoDataUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormSettings((prev) => ({ ...prev, logoDataUrl: '' }))
                          }
                          className="px-3 py-2 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer"
                        >
                          Revert to Default Logo
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="border border-dashed border-slate-300 rounded-xl p-5 space-y-3 bg-slate-50">
                    <p className="text-xs font-semibold text-slate-800">
                      Browser Tab Favicon (Optional)
                    </p>
                    <div className="h-16 flex items-center justify-center bg-white border border-slate-200 rounded-lg px-4">
                      {formSettings.faviconDataUrl || LOGO_ASSET_CONFIG.staticFaviconPath ? (
                        <img
                          src={formSettings.faviconDataUrl || LOGO_ASSET_CONFIG.staticFaviconPath}
                          alt="Favicon preview"
                          className="h-8 w-8 object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-500">No custom favicon uploaded</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {formSettings.faviconDataUrl
                        ? 'Custom uploaded favicon active.'
                        : 'Official MUN COMPUTER favicon active by default.'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        Upload Favicon
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp"
                          onChange={(e) => handleLogoUpload(e, 'faviconDataUrl')}
                          className="hidden"
                        />
                      </label>
                      {formSettings.faviconDataUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormSettings((prev) => ({ ...prev, faviconDataUrl: '' }))
                          }
                          className="px-3 py-2 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer"
                        >
                          Revert to Default Favicon
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Business Profile & Contact */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="font-display text-lg font-bold text-slate-950">
                  Business Profile, Hero &amp; Contact Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Business Name</label>
                    <input
                      type="text"
                      value={formSettings.businessName}
                      onChange={(e) =>
                        setFormSettings((p) => ({ ...p, businessName: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Business Type</label>
                    <input
                      type="text"
                      value={formSettings.businessType}
                      onChange={(e) =>
                        setFormSettings((p) => ({ ...p, businessType: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Official Phone</label>
                    <input
                      type="text"
                      value={formSettings.phone}
                      onChange={(e) => setFormSettings((p) => ({ ...p, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-tabular"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Official WhatsApp</label>
                    <input
                      type="text"
                      value={formSettings.whatsapp}
                      onChange={(e) => setFormSettings((p) => ({ ...p, whatsapp: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-tabular"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Official Email</label>
                    <input
                      type="email"
                      value={formSettings.email}
                      onChange={(e) => setFormSettings((p) => ({ ...p, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Shop Storefront Photo Path/URL
                    </label>
                    <input
                      type="text"
                      value={formSettings.heroImageUrl || ''}
                      onChange={(e) =>
                        setFormSettings((p) => ({ ...p, heroImageUrl: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-700">Hero Heading</label>
                    <input
                      type="text"
                      value={formSettings.heroHeading}
                      onChange={(e) =>
                        setFormSettings((p) => ({ ...p, heroHeading: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-700">Hero Subtitle</label>
                    <input
                      type="text"
                      value={formSettings.heroSubtitle}
                      onChange={(e) =>
                        setFormSettings((p) => ({ ...p, heroSubtitle: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-700">Hero Description</label>
                    <textarea
                      rows={2}
                      value={formSettings.heroDescription}
                      onChange={(e) =>
                        setFormSettings((p) => ({ ...p, heroDescription: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Shop GPS Location Settings */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="font-display text-lg font-bold text-slate-950 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-blue-800 shrink-0" />
                      <span>Shop GPS Location Settings</span>
                    </h2>
                    <p className="text-xs text-slate-600">
                      Stand at your shop and click capture to save your exact live GPS pin, or paste
                      coordinates from Google Maps. All public maps and direction buttons update
                      immediately.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCaptureAndSaveGpsLocation}
                    disabled={gpsCapturing}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
                  >
                    <LocateFixed className="w-4 h-4 shrink-0" />
                    <span>
                      {gpsCapturing
                        ? 'Capturing Live GPS...'
                        : 'Capture & Save My Present GPS Location'}
                    </span>
                  </button>
                </div>

                {typeof settings.shopLat === 'number' && typeof settings.shopLng === 'number' && (
                  <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-900">
                        Active Saved GPS Pin:{' '}
                        <span className="font-mono-tabular text-blue-900">
                          {settings.shopLat.toFixed(6)}, {settings.shopLng.toFixed(6)}
                        </span>
                      </p>
                      {settings.shopMapAddress && (
                        <p className="text-slate-600">{settings.shopMapAddress}</p>
                      )}
                    </div>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${settings.shopLat},${settings.shopLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-blue-800 bg-white border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                    >
                      <span>Preview Pin on Google Maps</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                {gpsPermissionBlocked && (
                  <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
                    <p className="font-semibold">
                      Browser / Preview Window Blocked Automatic GPS
                    </p>
                    <p className="text-amber-900 leading-relaxed">
                      Embedded preview frames do not allow live GPS requests. You can set your
                      permanent shop pin using any of these 3 instant methods:
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <a
                        href={typeof window !== 'undefined' ? window.location.href : '/admin'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-white bg-blue-800 rounded-md hover:bg-blue-900"
                      >
                        <span>1. Open Admin in New Tab (Use Live GPS)</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <Link
                        to="/contact"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-blue-900 bg-white border border-amber-300 rounded-md hover:bg-amber-100"
                      >
                        <span>2. Click Your Shop on Satellite Map</span>
                      </Link>
                    </div>
                    <p className="text-[11px] text-amber-900">
                      3. Or drop a pin in Google Maps on your phone/PC, copy the share link or
                      coordinates, and paste it into the Latitude field below.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-700">
                      Shop Map &amp; Public Display Address
                    </label>
                    <input
                      type="text"
                      maxLength={300}
                      placeholder="e.g. Mamudpur Chowmatha More, Ward No. 16, Domkal, Murshidabad - 742406"
                      value={formSettings.shopMapAddress || ''}
                      onChange={(e) =>
                        setFormSettings((p) => ({ ...p, shopMapAddress: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <p className="text-[11px] text-slate-500">
                      When entered, this address appears across the Homepage, Contact page, Footer,
                      and Google Maps InfoWindow.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Latitude (or paste Google Maps link / &ldquo;lat, lng&rdquo;)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 24.138500 or Google Maps link"
                      value={latInput}
                      onChange={(e) => handleLatInputChange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-tabular"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Longitude</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 88.532100"
                      value={lngInput}
                      onChange={(e) => setLngInput(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono-tabular"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      void persistWebsiteSettings(formSettings, latInput, lngInput, {
                        successMsg: 'Shop GPS coordinates and address saved and published.',
                        auditAction: 'UPDATE_SHOP_GPS_LOCATION',
                        auditDetails: `Saved shop location (${latInput || 'cleared'}, ${lngInput || 'cleared'})`,
                      })
                    }
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 transition-colors cursor-pointer"
                  >
                    Save Location &amp; Address
                  </button>

                  {(latInput || lngInput || formSettings.shopMapAddress) && (
                    <button
                      type="button"
                      onClick={() => {
                        setLatInput('');
                        setLngInput('');
                        const cleared: WebsiteSettings = {
                          ...formSettings,
                          shopLat: undefined,
                          shopLng: undefined,
                          shopMapAddress: '',
                        };
                        setFormSettings(cleared);
                        void persistWebsiteSettings(cleared, '', '', {
                          successMsg: 'Saved shop GPS override cleared; default address restored.',
                          auditAction: 'CLEAR_SHOP_GPS_LOCATION',
                          auditDetails: 'Cleared custom shop GPS location override',
                        });
                      }}
                      className="px-3.5 py-2 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      Clear Saved GPS Location
                    </button>
                  )}
                </div>
              </div>

              {/* Business Hours & Holidays */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-950">
                      Business Hours &amp; Holiday Configuration
                    </h2>
                    <p className="text-xs text-slate-600">
                      When disabled, the public website strictly displays &ldquo;Business Hours: To
                      Be Announced&rdquo;.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formSettings.businessHoursConfigured}
                      onChange={(e) =>
                        setFormSettings((p) => ({
                          ...p,
                          businessHoursConfigured: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded"
                    />
                    Publish Configured Hours
                  </label>
                </div>

                {formSettings.businessHoursConfigured && (
                  <div className="space-y-4 pt-2 border-t border-slate-100 text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">Opening Time</label>
                        <input
                          type="text"
                          placeholder="e.g. 09:30 AM"
                          value={formSettings.openingTime || ''}
                          onChange={(e) =>
                            setFormSettings((p) => ({ ...p, openingTime: e.target.value }))
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700">Closing Time</label>
                        <input
                          type="text"
                          placeholder="e.g. 07:30 PM"
                          value={formSettings.closingTime || ''}
                          onChange={(e) =>
                            setFormSettings((p) => ({ ...p, closingTime: e.target.value }))
                          }
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-slate-700">Weekly Holidays</span>
                      <div className="flex flex-wrap gap-3">
                        {WEEKDAYS.map((day) => {
                          const checked = (formSettings.weeklyHolidays || []).includes(day);
                          return (
                            <label key={day} className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const curr = formSettings.weeklyHolidays || [];
                                  const next = e.target.checked
                                    ? [...curr, day]
                                    : curr.filter((d) => d !== day);
                                  setFormSettings((p) => ({ ...p, weeklyHolidays: next }));
                                }}
                              />
                              {day}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Special Holiday Notice (optional)"
                        value={formSettings.specialHolidayNotice || ''}
                        onChange={(e) =>
                          setFormSettings((p) => ({ ...p, specialHolidayNotice: e.target.value }))
                        }
                        className="px-3 py-2 border border-slate-300 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Temporary Closure Notice (optional)"
                        value={formSettings.temporaryClosureNotice || ''}
                        onChange={(e) =>
                          setFormSettings((p) => ({
                            ...p,
                            temporaryClosureNotice: e.target.value,
                          }))
                        }
                        className="px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="px-6 py-3 text-sm font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 cursor-pointer"
              >
                Save &amp; Publish Website Settings
              </button>
            </form>
          )}

          {/* 2. PUBLIC SERVICES MANAGER */}
          {activeTab === 'services' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-6">
                <div className="space-y-1">
                  <h2 className="font-display text-lg font-bold text-slate-950">
                    Public Service Catalogue Manager
                  </h2>
                  <p className="text-xs text-slate-600">
                    Your website serves all{' '}
                    <strong className="text-slate-900">
                      {FULL_SERVICES_CATALOG.length} categories &middot; {TOTAL_CATALOG_SERVICES}{' '}
                      services
                    </strong>{' '}
                    by default. Use this form to publish additional supplemental services into any
                    category. Internal rates &amp; commissions are never stored here.
                  </p>
                </div>
                <Link
                  to="/services"
                  className="px-4 py-2 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 whitespace-nowrap"
                >
                  View Public Directory
                </Link>
              </div>

              <form
                onSubmit={handleAddPublicService}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h3 className="font-display text-base font-bold text-slate-950">
                  Add Public Service Entry
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Service Title *"
                    value={srvTitle}
                    onChange={(e) => setSrvTitle(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <select
                    value={srvCat}
                    onChange={(e) => setSrvCat(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {SERVICE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.title}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Public Short Description *"
                    value={srvShort}
                    onChange={(e) => setSrvShort(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg sm:col-span-2"
                  />
                  <input
                    type="text"
                    placeholder="Typical Documents Required (optional)"
                    value={srvDocs}
                    onChange={(e) => setSrvDocs(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg sm:col-span-2"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Public Service
                </button>
              </form>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h3 className="font-display text-base font-bold text-slate-950">
                  Stored Public Services ({publicServices.length})
                </h3>
                {publicServices.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{s.title}</p>
                      <p className="text-xs text-slate-500">{s.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await updateDoc(doc(db, 'public_services', s.id), {
                            isActive: !s.isActive,
                            updatedAt: serverTimestamp(),
                            updatedBy: firebaseUser?.uid || '',
                          });
                        }}
                        className={`px-3 py-1 text-xs font-medium rounded-lg border cursor-pointer ${
                          s.isActive
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {s.isActive ? 'Visible' : 'Hidden'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deleteDoc(doc(db, 'public_services', s.id));
                          notify('Public service removed.');
                        }}
                        className="p-1.5 text-red-600 hover:text-red-800 cursor-pointer"
                        aria-label={`Delete ${s.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. NOTICE BOARD MANAGER */}
          {activeTab === 'notices' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSaveNotice}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h2 className="font-display text-lg font-bold text-slate-950">
                  {editingNoticeId ? 'Edit Notice' : 'Create Notice Board Announcement'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Notice Title *"
                    value={noticeTitle}
                    onChange={(e) => setNoticeTitle(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg sm:col-span-2"
                  />
                  <select
                    value={noticeCat}
                    onChange={(e) => setNoticeCat(e.target.value as NoticeCategory)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Business Announcement">Business Announcement</option>
                    <option value="Service Notice">Service Notice</option>
                    <option value="Holiday Notice">Holiday Notice</option>
                    <option value="Customer Information">Customer Information</option>
                    <option value="General Update">General Update</option>
                  </select>
                </div>
                <textarea
                  required
                  rows={3}
                  placeholder="Notice Description *"
                  value={noticeDesc}
                  onChange={(e) => setNoticeDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={noticeStatus}
                    onChange={(e) => setNoticeStatus(e.target.value as NoticeStatus)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="published">Published (Visible to Public)</option>
                    <option value="draft">Draft (Private)</option>
                    <option value="archived">Archived (Hidden)</option>
                  </select>
                  <input
                    type="date"
                    value={noticeExpires}
                    onChange={(e) => setNoticeExpires(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 cursor-pointer"
                  >
                    {editingNoticeId ? 'Update Notice' : 'Save Notice'}
                  </button>
                  {editingNoticeId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNoticeId(null);
                        setNoticeTitle('');
                        setNoticeDesc('');
                      }}
                      className="px-4 py-2 text-sm border border-slate-300 rounded-lg cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                <h3 className="font-display text-base font-bold text-slate-950">
                  All Notices ({notices.length})
                </h3>
                {notices.map((n) => (
                  <div
                    key={n.id}
                    className="border border-slate-200 rounded-lg p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-950 text-sm">{n.title}</p>
                        <p className="text-xs text-slate-500">
                          {n.category} · Status: <strong>{n.status}</strong> ·{' '}
                          {n.isExpired ? 'Expired' : 'Active'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoticeId(n.id);
                            setNoticeTitle(n.title);
                            setNoticeDesc(n.description);
                            setNoticeCat(n.category);
                            setNoticeStatus(n.status);
                            setNoticeExpires(n.expiresAt || '');
                          }}
                          className="px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                        >
                          Edit
                        </button>
                        {n.status !== 'published' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await updateDoc(doc(db, 'public_notices', n.id), {
                                status: 'published',
                                publishedAt: serverTimestamp(),
                                updatedAt: serverTimestamp(),
                              });
                              await recordAuditLog('PUBLISH_NOTICE', 'Notice Board', n.id, `Published ${n.title}`);
                              notify('Notice published.');
                            }}
                            className="px-2.5 py-1 bg-emerald-700 text-white rounded hover:bg-emerald-800 cursor-pointer"
                          >
                            Publish
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              await updateDoc(doc(db, 'public_notices', n.id), {
                                status: 'draft',
                                updatedAt: serverTimestamp(),
                              });
                              notify('Notice unpublished.');
                            }}
                            className="px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                          >
                            Unpublish
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await updateDoc(doc(db, 'public_notices', n.id), {
                              status: 'archived',
                              updatedAt: serverTimestamp(),
                            });
                            notify('Notice archived.');
                          }}
                          className="px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                        >
                          Archive
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await updateDoc(doc(db, 'public_notices', n.id), {
                              isExpired: !n.isExpired,
                              updatedAt: serverTimestamp(),
                            });
                          }}
                          className="px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                        >
                          {n.isExpired ? 'Mark Active' : 'Mark Expired'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteDoc(doc(db, 'public_notices', n.id));
                            await recordAuditLog('DELETE_NOTICE', 'Notice Board', n.id, `Deleted ${n.title}`);
                            notify('Notice deleted.');
                          }}
                          className="px-2.5 py-1 text-red-700 border border-red-200 rounded hover:bg-red-50 cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600">{n.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. CUSTOMER FEEDBACK MANAGEMENT */}
          {activeTab === 'feedback' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Total Feedback</p>
                  <p className="font-mono-tabular text-xl font-bold text-slate-950">
                    {feedbackStats.total}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">New</p>
                  <p className="font-mono-tabular text-xl font-bold text-blue-800">
                    {feedbackStats.NEW}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Under Review</p>
                  <p className="font-mono-tabular text-xl font-bold text-amber-700">
                    {feedbackStats.UNDER_REVIEW}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Approved</p>
                  <p className="font-mono-tabular text-xl font-bold text-emerald-700">
                    {feedbackStats.APPROVED}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Rejected</p>
                  <p className="font-mono-tabular text-xl font-bold text-red-700">
                    {feedbackStats.REJECTED}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Archived</p>
                  <p className="font-mono-tabular text-xl font-bold text-slate-600">
                    {feedbackStats.ARCHIVED}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Average Rating</p>
                  <p className="font-mono-tabular text-xl font-bold text-slate-950">
                    {feedbackStats.avg} ★
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    placeholder="Search feedback..."
                    value={fbSearch}
                    onChange={(e) => setFbSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <select
                  value={fbCategoryFilter}
                  onChange={(e) => setFbCategoryFilter(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="All">All Categories</option>
                  {SERVICE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.title}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <select
                  value={fbRatingFilter}
                  onChange={(e) => setFbRatingFilter(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="All">All Ratings</option>
                  <option value="5">5 Stars</option>
                  <option value="4">4 Stars</option>
                  <option value="3">3 Stars</option>
                  <option value="2">2 Stars</option>
                  <option value="1">1 Star</option>
                </select>
                <select
                  value={fbStatusFilter}
                  onChange={(e) => setFbStatusFilter(e.target.value as 'All' | FeedbackStatus)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="All">All Statuses</option>
                  <option value="NEW">NEW</option>
                  <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
                <input
                  type="date"
                  value={fbDateFilter}
                  onChange={(e) => setFbDateFilter(e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-tabular"
                />
              </div>

              {/* Feedback List */}
              <div className="space-y-4">
                {filteredFeedback.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                    No customer feedback entries match the current filters.
                  </div>
                ) : (
                  filteredFeedback.map((fb) => (
                    <div
                      key={fb.id}
                      className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono-tabular font-semibold text-blue-800">
                              {fb.feedbackCode}
                            </span>
                            <span>·</span>
                            <span>{fb.serviceCategory}</span>
                            <span>·</span>
                            <span className="font-mono-tabular">
                              {formatFirestoreDate(fb.createdAt)}
                            </span>
                            <span>·</span>
                            <span className="font-semibold text-slate-900">{fb.status}</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-950">
                            {fb.customerName || 'Anonymous Customer'}{' '}
                            {fb.mobileNumber ? (
                              <span className="font-mono-tabular text-xs font-normal text-slate-500">
                                (Private Mobile: {fb.mobileNumber})
                              </span>
                            ) : null}
                          </p>
                          {fb.serviceReferenceId && (
                            <p className="text-xs text-slate-500 font-mono-tabular">
                              Service Ref: {fb.serviceReferenceId}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-amber-500">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-4 h-4 ${
                                s <= fb.rating ? 'fill-current' : 'text-slate-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <p className="text-sm text-slate-700 leading-relaxed">{fb.message}</p>

                      <div className="text-xs text-slate-600">
                        Publication Consent:{' '}
                        <strong
                          className={fb.publicationConsent ? 'text-emerald-700' : 'text-red-700'}
                        >
                          {fb.publicationConsent ? 'Granted by Customer' : 'Not Granted (Private Only)'}
                        </strong>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <input
                          type="text"
                          placeholder="Optional official Admin response..."
                          value={responseDrafts[fb.id] ?? fb.adminResponse ?? ''}
                          onChange={(e) =>
                            setResponseDrafts((p) => ({ ...p, [fb.id]: e.target.value }))
                          }
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                        />

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => handleFeedbackAction(fb, 'UNDER_REVIEW', false)}
                            className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                          >
                            Mark Under Review
                          </button>
                          <button
                            type="button"
                            disabled={!fb.publicationConsent}
                            onClick={() => handleFeedbackAction(fb, 'APPROVED', true)}
                            className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-40 cursor-pointer"
                          >
                            Approve &amp; Publish Review
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeedbackAction(fb, 'APPROVED', false)}
                            className="px-3 py-1.5 bg-blue-800 text-white rounded-lg hover:bg-blue-900 cursor-pointer"
                          >
                            Approve (Private)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeedbackAction(fb, 'REJECTED', false)}
                            className="px-3 py-1.5 border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-50 cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFeedbackAction(fb, 'ARCHIVED', false)}
                            className="px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                          >
                            Archive
                          </button>
                          {confirmDeleteFbId === fb.id ? (
                            <span className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDeleteFeedback(fb)}
                                className="px-3 py-1.5 bg-red-700 text-white rounded-lg cursor-pointer"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteFbId(null)}
                                className="px-2 py-1.5 text-slate-600 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteFbId(fb.id)}
                              className="px-3 py-1.5 text-red-700 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 5. STAFF & ROLE MANAGEMENT */}
          {activeTab === 'staff' && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddStaffUser}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h2 className="font-display text-base font-bold text-slate-950">
                  Register Staff / Manager / Admin Account
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Firebase User UID *"
                    value={newStaffUid}
                    onChange={(e) => setNewStaffUid(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                  />
                  <input
                    type="email"
                    required
                    placeholder="Google Email *"
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Full Name *"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value as UserRole)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 cursor-pointer"
                >
                  Save Staff User
                </button>
              </form>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-display text-base font-bold text-slate-950">
                  Authorized Accounts ({staffList.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="py-2.5 pr-4">Name</th>
                        <th className="py-2.5 pr-4">Email</th>
                        <th className="py-2.5 pr-4">Role</th>
                        <th className="py-2.5 pr-4">Status</th>
                        <th className="py-2.5">Devices</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffList.map((u) => (
                        <tr key={u.uid} className="border-b border-slate-100">
                          <td className="py-2.5 pr-4 font-medium text-slate-950">{u.displayName}</td>
                          <td className="py-2.5 pr-4 text-slate-600">{u.email}</td>
                          <td className="py-2.5 pr-4">
                            <select
                              value={u.role}
                              onChange={async (e) => {
                                await updateDoc(doc(db, 'staff_users', u.uid), {
                                  role: e.target.value,
                                  updatedAt: serverTimestamp(),
                                });
                                await recordAuditLog('UPDATE_STAFF_ROLE', 'Staff Management', u.uid, `Changed role to ${e.target.value}`);
                              }}
                              className="px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                            >
                              <option value="staff">staff</option>
                              <option value="manager">manager</option>
                              <option value="admin">admin</option>
                            </select>
                          </td>
                          <td className="py-2.5 pr-4">
                            <button
                              type="button"
                              onClick={async () => {
                                const next = u.status === 'active' ? 'suspended' : 'active';
                                await updateDoc(doc(db, 'staff_users', u.uid), {
                                  status: next,
                                  updatedAt: serverTimestamp(),
                                });
                              }}
                              className={`px-2.5 py-1 text-xs rounded border cursor-pointer ${
                                u.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-red-50 text-red-800 border-red-200'
                              }`}
                            >
                              {u.status}
                            </button>
                          </td>
                          <td className="py-2.5 font-mono-tabular text-xs text-slate-500">
                            {(u.registeredDevices || []).join(', ') || 'None'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 6. AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-base font-bold text-slate-950">
                Security &amp; Administrative Audit Logs ({auditLogs.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-2.5 pr-4">Date</th>
                      <th className="py-2.5 pr-4">Action</th>
                      <th className="py-2.5 pr-4">Module</th>
                      <th className="py-2.5 pr-4">Actor</th>
                      <th className="py-2.5">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-100">
                        <td className="py-2.5 pr-4 font-mono-tabular text-xs text-slate-500">
                          {formatFirestoreDate(log.createdAt)}
                        </td>
                        <td className="py-2.5 pr-4 font-mono-tabular text-xs font-semibold text-blue-800">
                          {log.action}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-slate-700">{log.module}</td>
                        <td className="py-2.5 pr-4 text-xs text-slate-600">{log.actorEmail}</td>
                        <td className="py-2.5 text-xs text-slate-700">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
