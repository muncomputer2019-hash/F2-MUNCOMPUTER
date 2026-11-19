import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Archive,
  BookOpen,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Flame,
  LayoutDashboard,
  LogOut,
  Mail,
  Package,
  Plus,
  Search,
  Settings,
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
import { SERVICE_CATEGORIES } from '../config/businessConfig';
import { useAuth } from '../context/AuthContext';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { recordAuditLog } from '../services/auditLogger';
import { formatFirestoreDate } from '../services/publicData';
import type {
  ContactEnquiry,
  CustomerRecord,
  InventoryItem,
  LedgerEntry,
  LpgRecord,
  ServiceApplication,
  ServiceInternalItem,
} from '../types';

type DashboardTab =
  | 'overview'
  | 'customers'
  | 'applications'
  | 'services'
  | 'ledger'
  | 'lpg'
  | 'inventory'
  | 'enquiries'
  | 'reports';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { firebaseUser, staffProfile, isAdmin, isManagerOrAdmin, deviceId, logoutPortal } =
    useAuth();

  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [searchText, setSearchText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  // Collections state
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [applications, setApplications] = useState<ServiceApplication[]>([]);
  const [serviceInternals, setServiceInternals] = useState<ServiceInternalItem[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [lpgRecords, setLpgRecords] = useState<LpgRecord[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [enquiries, setEnquiries] = useState<ContactEnquiry[]>([]);

  // Form states
  const [custName, setCustName] = useState('');
  const [custMobile, setCustMobile] = useState('');
  const [custVillage, setCustVillage] = useState('');
  const [custNotes, setCustNotes] = useState('');

  const [appCustomer, setAppCustomer] = useState('');
  const [appMobile, setAppMobile] = useState('');
  const [appCategory, setAppCategory] = useState(SERVICE_CATEGORIES[0].title);
  const [appTitle, setAppTitle] = useState('');
  const [appFee, setAppFee] = useState('0');
  const [appStatus, setAppStatus] = useState<ServiceApplication['status']>('Pending');

  const [ledgerType, setLedgerType] = useState<LedgerEntry['entryType']>('Income');
  const [ledgerCat, setLedgerCat] = useState('Service Fee');
  const [ledgerDesc, setLedgerDesc] = useState('');
  const [ledgerAmt, setLedgerAmt] = useState('');
  const [ledgerMode, setLedgerMode] = useState<LedgerEntry['paymentMode']>('Cash');
  const [ledgerDate, setLedgerDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [lpgName, setLpgName] = useState('');
  const [lpgNumber, setLpgNumber] = useState('');
  const [lpgAgency, setLpgAgency] = useState('Indane');
  const [lpgType, setLpgType] = useState<LpgRecord['bookingType']>('Refill Booking');

  const [invName, setInvName] = useState('');
  const [invCat, setInvCat] = useState('Printing & Stationery');
  const [invQty, setInvQty] = useState('1');
  const [invUnit, setInvUnit] = useState('pcs');
  const [invReorder, setInvReorder] = useState('5');

  const [srvTitle, setSrvTitle] = useState('');
  const [srvCat, setSrvCat] = useState(SERVICE_CATEGORIES[0].title);
  const [srvCharge, setSrvCharge] = useState('0');
  const [srvGovtFee, setSrvGovtFee] = useState('0');
  const [srvComm, setSrvComm] = useState('0');
  const [srvEmpCost, setSrvEmpCost] = useState('0');

  useDocumentMeta({
    title: 'Business Manager – MUN COMPUTER',
    description: 'Protected MUN COMPUTER Business Manager dashboard.',
  });

  useEffect(() => {
    if (!firebaseUser) return;

    const unsubCust = onSnapshot(
      query(collection(db, 'customers'), orderBy('createdAt', 'desc')),
      (snap) =>
        setCustomers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CustomerRecord, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'customers')
    );

    const unsubApp = onSnapshot(
      query(collection(db, 'applications'), orderBy('createdAt', 'desc')),
      (snap) =>
        setApplications(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ServiceApplication, 'id'>) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'applications')
    );

    const unsubSrvInt = onSnapshot(
      collection(db, 'service_internals'),
      (snap) =>
        setServiceInternals(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ServiceInternalItem, 'id'>) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'service_internals')
    );

    const unsubLedger = onSnapshot(
      query(collection(db, 'ledger_entries'), orderBy('createdAt', 'desc')),
      (snap) =>
        setLedgerEntries(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LedgerEntry, 'id'>) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'ledger_entries')
    );

    const unsubLpg = onSnapshot(
      query(collection(db, 'lpg_records'), orderBy('createdAt', 'desc')),
      (snap) =>
        setLpgRecords(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LpgRecord, 'id'>) }))),
      (err) => handleFirestoreError(err, OperationType.LIST, 'lpg_records')
    );

    const unsubInv = onSnapshot(
      collection(db, 'inventory_items'),
      (snap) =>
        setInventoryItems(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InventoryItem, 'id'>) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'inventory_items')
    );

    const unsubEnq = onSnapshot(
      query(collection(db, 'contact_enquiries'), orderBy('createdAt', 'desc')),
      (snap) =>
        setEnquiries(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ContactEnquiry, 'id'>) }))
        ),
      (err) => handleFirestoreError(err, OperationType.LIST, 'contact_enquiries')
    );

    return () => {
      unsubCust();
      unsubApp();
      unsubSrvInt();
      unsubLedger();
      unsubLpg();
      unsubInv();
      unsubEnq();
    };
  }, [firebaseUser]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let due = 0;
    for (const entry of ledgerEntries) {
      if (entry.entryType === 'Income' || entry.entryType === 'Payment Received') {
        income += entry.amount;
      } else if (entry.entryType === 'Expense') {
        expense += entry.amount;
      } else if (entry.entryType === 'Payment Due') {
        due += entry.amount;
      }
    }
    const lowStock = inventoryItems.filter((i) => i.quantity <= i.reorderLevel).length;
    return { income, expense, net: income - expense, due, lowStock };
  }, [ledgerEntries, inventoryItems]);

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), 4000);
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    try {
      const payload: Record<string, unknown> = {
        fullName: custName.trim().slice(0, 120),
        mobile: custMobile.trim().slice(0, 20),
        createdBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (custVillage.trim()) payload.village = custVillage.trim().slice(0, 120);
      if (custNotes.trim()) payload.notes = custNotes.trim().slice(0, 600);
      const ref = await addDoc(collection(db, 'customers'), payload);
      await recordAuditLog('CREATE_CUSTOMER', 'Customers', ref.id, `Added customer ${custName}`);
      setCustName('');
      setCustMobile('');
      setCustVillage('');
      setCustNotes('');
      showToast('Customer record saved.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'customers');
    }
  };

  const handleAddApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const referenceId = `MC-APP-${Math.floor(100000 + Math.random() * 900000)}`;
    try {
      const payload: Record<string, unknown> = {
        referenceId,
        customerName: appCustomer.trim().slice(0, 120),
        serviceCategory: appCategory.slice(0, 100),
        serviceTitle: appTitle.trim().slice(0, 140),
        status: appStatus,
        feeCollected: Math.max(0, Number(appFee) || 0),
        createdBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (appMobile.trim()) payload.mobile = appMobile.trim().slice(0, 20);
      const ref = await addDoc(collection(db, 'applications'), payload);
      await recordAuditLog(
        'CREATE_APPLICATION',
        'Applications',
        ref.id,
        `Logged application ${referenceId} for ${appCustomer}`
      );
      setAppCustomer('');
      setAppMobile('');
      setAppTitle('');
      setAppFee('0');
      showToast(`Application ${referenceId} created.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'applications');
    }
  };

  const handleUpdateApplicationStatus = async (
    app: ServiceApplication,
    nextStatus: ServiceApplication['status']
  ) => {
    try {
      await updateDoc(doc(db, 'applications', app.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      await recordAuditLog(
        'UPDATE_APPLICATION_STATUS',
        'Applications',
        app.id,
        `Updated ${app.referenceId} status to ${nextStatus}`
      );
      showToast(`Updated ${app.referenceId} to ${nextStatus}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `applications/${app.id}`);
    }
  };

  const handleAddLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    try {
      const ref = await addDoc(collection(db, 'ledger_entries'), {
        entryType: ledgerType,
        category: ledgerCat.trim().slice(0, 100),
        description: ledgerDesc.trim().slice(0, 300),
        amount: Math.max(0, Number(ledgerAmt) || 0),
        paymentMode: ledgerMode,
        dateStr: ledgerDate,
        createdBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
      });
      await recordAuditLog(
        'ADD_LEDGER_ENTRY',
        'Cashbook & Ledger',
        ref.id,
        `${ledgerType}: ₹${ledgerAmt} (${ledgerDesc})`
      );
      setLedgerDesc('');
      setLedgerAmt('');
      showToast('Ledger entry recorded.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'ledger_entries');
    }
  };

  const handleAddLpg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    try {
      const ref = await addDoc(collection(db, 'lpg_records'), {
        consumerName: lpgName.trim().slice(0, 120),
        consumerNumber: lpgNumber.trim().slice(0, 40),
        agencyName: lpgAgency.trim().slice(0, 100),
        bookingType: lpgType,
        status: 'Booked',
        createdBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
      });
      await recordAuditLog('CREATE_LPG_RECORD', 'LPG Management', ref.id, `LPG ${lpgType} for ${lpgName}`);
      setLpgName('');
      setLpgNumber('');
      showToast('LPG record added.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'lpg_records');
    }
  };

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    try {
      const ref = await addDoc(collection(db, 'inventory_items'), {
        itemName: invName.trim().slice(0, 120),
        category: invCat.trim().slice(0, 80),
        quantity: Math.max(0, Number(invQty) || 0),
        unit: invUnit.trim().slice(0, 30) || 'pcs',
        reorderLevel: Math.max(0, Number(invReorder) || 0),
        updatedAt: serverTimestamp(),
        updatedBy: firebaseUser.uid,
      });
      await recordAuditLog('ADD_INVENTORY_ITEM', 'Inventory', ref.id, `Added stock item ${invName}`);
      setInvName('');
      setInvQty('1');
      showToast('Inventory item added.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'inventory_items');
    }
  };

  const handleAdjustInventory = async (item: InventoryItem, delta: number) => {
    if (!firebaseUser) return;
    const nextQty = Math.max(0, item.quantity + delta);
    try {
      await updateDoc(doc(db, 'inventory_items', item.id), {
        quantity: nextQty,
        updatedAt: serverTimestamp(),
        updatedBy: firebaseUser.uid,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `inventory_items/${item.id}`);
    }
  };

  const handleAddServiceInternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !isManagerOrAdmin) return;
    const id = `srv_${Date.now()}`;
    try {
      await setDoc(doc(db, 'service_internals', id), {
        serviceId: id,
        title: srvTitle.trim().slice(0, 140),
        category: srvCat.slice(0, 100),
        serviceCharge: Math.max(0, Number(srvCharge) || 0),
        govtFee: Math.max(0, Number(srvGovtFee) || 0),
        commission: Math.max(0, Number(srvComm) || 0),
        employeeCost: Math.max(0, Number(srvEmpCost) || 0),
        updatedAt: serverTimestamp(),
        updatedBy: firebaseUser.uid,
      });
      await recordAuditLog('ADD_SERVICE_MASTER', 'Service Master', id, `Added internal rate for ${srvTitle}`);
      setSrvTitle('');
      setSrvCharge('0');
      setSrvGovtFee('0');
      setSrvComm('0');
      setSrvEmpCost('0');
      showToast('Internal service master saved (hidden from public site).');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `service_internals/${id}`);
    }
  };

  const exportCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvLines = [
      headers.join(','),
      ...rows.map((r) =>
        r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadBackup = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      business: 'MUN COMPUTER',
      customers,
      applications,
      ledgerEntries,
      lpgRecords,
      inventoryItems,
      serviceInternals,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mun-computer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    void recordAuditLog('EXPORT_BACKUP', 'Backup', 'all', 'Downloaded JSON business backup');
    showToast('JSON backup exported.');
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser || !isAdmin) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        customers?: CustomerRecord[];
        inventoryItems?: InventoryItem[];
      };
      let count = 0;
      if (Array.isArray(parsed.customers)) {
        for (const c of parsed.customers.slice(0, 50)) {
          if (c.id && c.fullName && c.mobile) {
            await setDoc(doc(db, 'customers', c.id), {
              fullName: String(c.fullName).slice(0, 120),
              mobile: String(c.mobile).slice(0, 20),
              village: String(c.village || '').slice(0, 120),
              notes: String(c.notes || '').slice(0, 600),
              createdBy: firebaseUser.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            count++;
          }
        }
      }
      await recordAuditLog('RESTORE_BACKUP', 'Backup', file.name, `Restored ${count} customer records`);
      showToast(`Backup processed (${count} records synced).`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invalid backup JSON file.');
    }
    e.target.value = '';
  };

  const NAV_TABS: { id: DashboardTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
    { id: 'applications', label: 'Applications', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'services', label: 'Service Master', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'ledger', label: 'Cashbook & Ledger', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'lpg', label: 'LPG Management', icon: <Flame className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventory', icon: <Package className="w-4 h-4" /> },
    { id: 'enquiries', label: 'Web Enquiries', icon: <Mail className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports & Backup', icon: <Archive className="w-4 h-4" /> },
  ];

  const qLower = searchText.trim().toLowerCase();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between shrink-0">
        <div>
          <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
            <Link to="/" className="font-display font-bold text-slate-950 tracking-tight">
              MUN COMPUTER
            </Link>
            <span className="text-xs font-medium text-blue-800 capitalize">
              {staffProfile?.role || 'staff'}
            </span>
          </div>

          <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
            {NAV_TABS.map((tab) => (
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
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Open Admin Control Panel
            </Link>
          )}
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
            className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600 truncate">
            <span className="font-semibold text-slate-950">Business Manager</span>
            <span className="mx-2 text-slate-300">/</span>
            <span className="capitalize">{activeTab}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs text-slate-500 font-mono-tabular">
              Device: {deviceId}
            </span>
            {isAdmin && (
              <Link
                to="/admin"
                className="lg:hidden px-3 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg"
              >
                Admin Panel
              </Link>
            )}
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
          {statusMessage && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
              {statusMessage}
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
                  <p className="text-xs text-slate-500">Registered Customers</p>
                  <p className="font-mono-tabular text-2xl font-bold text-slate-950">
                    {customers.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
                  <p className="text-xs text-slate-500">Applications Tracked</p>
                  <p className="font-mono-tabular text-2xl font-bold text-slate-950">
                    {applications.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
                  <p className="text-xs text-slate-500">Net Cashbook Balance</p>
                  <p className="font-mono-tabular text-2xl font-bold text-emerald-700">
                    ₹{totals.net.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
                  <p className="text-xs text-slate-500">New Web Enquiries</p>
                  <p className="font-mono-tabular text-2xl font-bold text-blue-800">
                    {enquiries.filter((e) => e.status === 'NEW').length}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h2 className="font-display text-base font-bold text-slate-950">
                    Recent Applications
                  </h2>
                  {applications.length === 0 ? (
                    <p className="text-sm text-slate-500">No applications logged yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {applications.slice(0, 5).map((app) => (
                        <div
                          key={app.id}
                          className="flex items-center justify-between text-sm py-2 border-b border-slate-100 last:border-0"
                        >
                          <div>
                            <p className="font-medium text-slate-950">{app.customerName}</p>
                            <p className="text-xs text-slate-500 font-mono-tabular">
                              {app.referenceId} · {app.serviceTitle}
                            </p>
                          </div>
                          <span className="text-xs font-medium text-blue-800">{app.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h2 className="font-display text-base font-bold text-slate-950">
                    Financial Summary (Cashbook &amp; Daybook)
                  </h2>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-600">Total Income &amp; Payments Received</span>
                      <span className="font-mono-tabular font-semibold text-emerald-700">
                        ₹{totals.income.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-600">Total Expenses</span>
                      <span className="font-mono-tabular font-semibold text-red-700">
                        ₹{totals.expense.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-600">Outstanding Payment Due</span>
                      <span className="font-mono-tabular font-semibold text-amber-700">
                        ₹{totals.due.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-600">Low Stock Inventory Alerts</span>
                      <span className="font-mono-tabular font-semibold text-slate-950">
                        {totals.lowStock}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddCustomer}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h2 className="font-display text-base font-bold text-slate-950">
                  Add Customer Record
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Full Name *"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Mobile Number *"
                    value={custMobile}
                    onChange={(e) => setCustMobile(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                  />
                  <input
                    type="text"
                    placeholder="Village / Area"
                    value={custVillage}
                    onChange={(e) => setCustVillage(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Notes"
                    value={custNotes}
                    onChange={(e) => setCustNotes(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Save Customer
                </button>
              </form>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="font-display text-base font-bold text-slate-950">
                    Customer Directory ({customers.length})
                  </h3>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      placeholder="Search customers..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="py-2.5 pr-4">Name</th>
                        <th className="py-2.5 pr-4">Mobile</th>
                        <th className="py-2.5 pr-4">Village</th>
                        <th className="py-2.5 pr-4">Notes</th>
                        {isManagerOrAdmin && <th className="py-2.5 text-right">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {customers
                        .filter(
                          (c) =>
                            !qLower ||
                            c.fullName.toLowerCase().includes(qLower) ||
                            c.mobile.toLowerCase().includes(qLower)
                        )
                        .map((c) => (
                          <tr key={c.id} className="border-b border-slate-100">
                            <td className="py-2.5 pr-4 font-medium text-slate-950">{c.fullName}</td>
                            <td className="py-2.5 pr-4 font-mono-tabular text-slate-700">{c.mobile}</td>
                            <td className="py-2.5 pr-4 text-slate-600">{c.village || '—'}</td>
                            <td className="py-2.5 pr-4 text-slate-600">{c.notes || '—'}</td>
                            {isManagerOrAdmin && (
                              <td className="py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await deleteDoc(doc(db, 'customers', c.id));
                                    await recordAuditLog('DELETE_CUSTOMER', 'Customers', c.id, `Deleted ${c.fullName}`);
                                  }}
                                  className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                                  aria-label={`Delete ${c.fullName}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'applications' && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddApplication}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h2 className="font-display text-base font-bold text-slate-950">
                  Log New Customer Application
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Customer Name *"
                    value={appCustomer}
                    onChange={(e) => setAppCustomer(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <input
                    type="tel"
                    placeholder="Mobile Number"
                    value={appMobile}
                    onChange={(e) => setAppMobile(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                  />
                  <select
                    value={appCategory}
                    onChange={(e) => setAppCategory(e.target.value)}
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
                    placeholder="Service / Form Name *"
                    value={appTitle}
                    onChange={(e) => setAppTitle(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Fee Collected (₹)"
                    value={appFee}
                    onChange={(e) => setAppFee(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                  />
                  <select
                    value={appStatus}
                    onChange={(e) => setAppStatus(e.target.value as ServiceApplication['status'])}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Process">In Process</option>
                    <option value="Completed">Completed</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Create Application
                </button>
              </form>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-display text-base font-bold text-slate-950">
                  Applications Tracker ({applications.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="py-2.5 pr-4">Ref ID</th>
                        <th className="py-2.5 pr-4">Customer</th>
                        <th className="py-2.5 pr-4">Service</th>
                        <th className="py-2.5 pr-4 text-right">Fee (₹)</th>
                        <th className="py-2.5 pr-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((app) => (
                        <tr key={app.id} className="border-b border-slate-100">
                          <td className="py-2.5 pr-4 font-mono-tabular text-xs font-semibold text-blue-800">
                            {app.referenceId}
                          </td>
                          <td className="py-2.5 pr-4 font-medium text-slate-950">
                            {app.customerName}
                          </td>
                          <td className="py-2.5 pr-4 text-slate-600">{app.serviceTitle}</td>
                          <td className="py-2.5 pr-4 text-right font-mono-tabular">
                            ₹{app.feeCollected}
                          </td>
                          <td className="py-2.5 pr-4">
                            <select
                              value={app.status}
                              onChange={(e) =>
                                handleUpdateApplicationStatus(
                                  app,
                                  e.target.value as ServiceApplication['status']
                                )
                              }
                              className="px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                            >
                              <option value="Pending">Pending</option>
                              <option value="In Process">In Process</option>
                              <option value="Completed">Completed</option>
                              <option value="Delivered">Delivered</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'services' && (
            <div className="space-y-6">
              {isManagerOrAdmin && (
                <form
                  onSubmit={handleAddServiceInternal}
                  className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                >
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-950">
                      Internal Service Master (Protected Rates &amp; Commissions)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Stored strictly in private service_internals collection. Never exposed on the
                      public website.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                      type="number"
                      min={0}
                      placeholder="Customer Charge (₹)"
                      value={srvCharge}
                      onChange={(e) => setSrvCharge(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="Portal / Govt Fee (₹)"
                      value={srvGovtFee}
                      onChange={(e) => setSrvGovtFee(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="Internal Commission (₹)"
                      value={srvComm}
                      onChange={(e) => setSrvComm(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="Employee Cost (₹)"
                      value={srvEmpCost}
                      onChange={(e) => setSrvEmpCost(e.target.value)}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Save Internal Rate
                  </button>
                </form>
              )}

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-display text-base font-bold text-slate-950">
                  Protected Service Master ({serviceInternals.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="py-2.5 pr-4">Service</th>
                        <th className="py-2.5 pr-4">Category</th>
                        <th className="py-2.5 pr-4 text-right">Charge</th>
                        <th className="py-2.5 pr-4 text-right">Portal Fee</th>
                        <th className="py-2.5 pr-4 text-right">Commission</th>
                        <th className="py-2.5 text-right">Emp Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {serviceInternals.map((s) => (
                        <tr key={s.id} className="border-b border-slate-100">
                          <td className="py-2.5 pr-4 font-medium text-slate-950">{s.title}</td>
                          <td className="py-2.5 pr-4 text-slate-600 text-xs">{s.category}</td>
                          <td className="py-2.5 pr-4 text-right font-mono-tabular">
                            ₹{s.serviceCharge}
                          </td>
                          <td className="py-2.5 pr-4 text-right font-mono-tabular">
                            ₹{s.govtFee || 0}
                          </td>
                          <td className="py-2.5 pr-4 text-right font-mono-tabular text-emerald-700">
                            ₹{s.commission}
                          </td>
                          <td className="py-2.5 text-right font-mono-tabular text-slate-600">
                            ₹{s.employeeCost || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ledger' && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddLedger}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h2 className="font-display text-base font-bold text-slate-950">
                  Cashbook, Daybook &amp; Ledger Entry
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={ledgerType}
                    onChange={(e) => setLedgerType(e.target.value as LedgerEntry['entryType'])}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                    <option value="Payment Received">Payment Received</option>
                    <option value="Payment Due">Payment Due</option>
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Category *"
                    value={ledgerCat}
                    onChange={(e) => setLedgerCat(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <input
                    type="number"
                    required
                    min={0}
                    placeholder="Amount (₹) *"
                    value={ledgerAmt}
                    onChange={(e) => setLedgerAmt(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Description *"
                    value={ledgerDesc}
                    onChange={(e) => setLedgerDesc(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg sm:col-span-2"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={ledgerMode}
                      onChange={(e) => setLedgerMode(e.target.value as LedgerEntry['paymentMode'])}
                      className="px-2 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank</option>
                      <option value="Card">Card</option>
                    </select>
                    <input
                      type="date"
                      value={ledgerDate}
                      onChange={(e) => setLedgerDate(e.target.value)}
                      className="px-2 py-2 text-xs border border-slate-300 rounded-lg font-mono-tabular"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Record Transaction
                </button>
              </form>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-display text-base font-bold text-slate-950">
                  Daybook &amp; Payment Ledger ({ledgerEntries.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="py-2.5 pr-4">Date</th>
                        <th className="py-2.5 pr-4">Type</th>
                        <th className="py-2.5 pr-4">Description</th>
                        <th className="py-2.5 pr-4">Mode</th>
                        <th className="py-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerEntries.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100">
                          <td className="py-2.5 pr-4 font-mono-tabular text-xs text-slate-600">
                            {item.dateStr}
                          </td>
                          <td className="py-2.5 pr-4 font-medium">{item.entryType}</td>
                          <td className="py-2.5 pr-4 text-slate-700">{item.description}</td>
                          <td className="py-2.5 pr-4 text-xs text-slate-500">{item.paymentMode}</td>
                          <td className="py-2.5 text-right font-mono-tabular font-semibold">
                            ₹{item.amount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'lpg' && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddLpg}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h2 className="font-display text-base font-bold text-slate-950">
                  LPG Booking &amp; Assistance Entry
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Consumer Name *"
                    value={lpgName}
                    onChange={(e) => setLpgName(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Consumer No / LPG ID *"
                    value={lpgNumber}
                    onChange={(e) => setLpgNumber(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Agency Name"
                    value={lpgAgency}
                    onChange={(e) => setLpgAgency(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <select
                    value={lpgType}
                    onChange={(e) => setLpgType(e.target.value as LpgRecord['bookingType'])}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Refill Booking">Refill Booking</option>
                    <option value="e-KYC">e-KYC</option>
                    <option value="New Connection">New Connection</option>
                    <option value="Subsidy Check">Subsidy Check</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Log LPG Assistance
                </button>
              </form>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-display text-base font-bold text-slate-950">
                  LPG Records ({lpgRecords.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="py-2.5 pr-4">Consumer</th>
                        <th className="py-2.5 pr-4">LPG ID</th>
                        <th className="py-2.5 pr-4">Agency</th>
                        <th className="py-2.5 pr-4">Type</th>
                        <th className="py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lpgRecords.map((rec) => (
                        <tr key={rec.id} className="border-b border-slate-100">
                          <td className="py-2.5 pr-4 font-medium">{rec.consumerName}</td>
                          <td className="py-2.5 pr-4 font-mono-tabular text-xs">
                            {rec.consumerNumber}
                          </td>
                          <td className="py-2.5 pr-4 text-slate-600">{rec.agencyName}</td>
                          <td className="py-2.5 pr-4 text-slate-600">{rec.bookingType}</td>
                          <td className="py-2.5 text-xs font-medium text-blue-800">{rec.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <form
                onSubmit={handleAddInventory}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h2 className="font-display text-base font-bold text-slate-950">
                  Add Centre Inventory Item
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Item Name (e.g. A4 Paper Rim) *"
                    value={invName}
                    onChange={(e) => setInvName(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg sm:col-span-2"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Category"
                    value={invCat}
                    onChange={(e) => setInvCat(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Qty"
                    value={invQty}
                    onChange={(e) => setInvQty(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Unit"
                      value={invUnit}
                      onChange={(e) => setInvUnit(e.target.value)}
                      className="px-2 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="Min"
                      value={invReorder}
                      onChange={(e) => setInvReorder(e.target.value)}
                      className="px-2 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Stock Item
                </button>
              </form>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-display text-base font-bold text-slate-950">
                  Stock Levels ({inventoryItems.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="py-2.5 pr-4">Item</th>
                        <th className="py-2.5 pr-4">Category</th>
                        <th className="py-2.5 pr-4 text-right">Quantity</th>
                        <th className="py-2.5 text-right">Adjust</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryItems.map((item) => (
                        <tr key={item.id} className="border-b border-slate-100">
                          <td className="py-2.5 pr-4 font-medium text-slate-950">
                            {item.itemName}
                            {item.quantity <= item.reorderLevel && (
                              <span className="ml-2 text-xs text-amber-700 font-medium">
                                Low Stock
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-slate-600">{item.category}</td>
                          <td className="py-2.5 pr-4 text-right font-mono-tabular">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-2.5 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => handleAdjustInventory(item, -1)}
                              className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustInventory(item, 1)}
                              className="px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                            >
                              +1
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'enquiries' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="font-display text-base font-bold text-slate-950">
                Private Website Contact Enquiries ({enquiries.length})
              </h2>
              {enquiries.length === 0 ? (
                <p className="text-sm text-slate-500">No contact enquiries submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {enquiries.map((enq) => (
                    <div key={enq.id} className="border border-slate-200 rounded-lg p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-950 text-sm">{enq.subject}</p>
                          <p className="text-xs text-slate-500">
                            {enq.name} · {enq.phone || 'No phone'} · {enq.email || 'No email'} ·{' '}
                            {formatFirestoreDate(enq.createdAt)}
                          </p>
                        </div>
                        <select
                          value={enq.status}
                          onChange={async (e) => {
                            await updateDoc(doc(db, 'contact_enquiries', enq.id), {
                              status: e.target.value,
                              updatedAt: serverTimestamp(),
                            });
                          }}
                          className="px-2.5 py-1 text-xs border border-slate-300 rounded bg-white"
                        >
                          <option value="NEW">NEW</option>
                          <option value="IN_PROGRESS">IN_PROGRESS</option>
                          <option value="RESOLVED">RESOLVED</option>
                        </select>
                      </div>
                      <p className="text-sm text-slate-700">{enq.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="font-display text-base font-bold text-slate-950">
                  CSV Financial &amp; Operational Reports
                </h2>
                <p className="text-sm text-slate-600">
                  Export structured CSV files for accounting, cashbook reconciliation, and
                  application tracking.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      exportCsv(
                        'mun-computer-ledger.csv',
                        ['Date', 'Type', 'Category', 'Description', 'Mode', 'Amount'],
                        ledgerEntries.map((l) => [
                          l.dateStr,
                          l.entryType,
                          l.category,
                          l.description,
                          l.paymentMode,
                          l.amount,
                        ])
                      )
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Export Cashbook CSV
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportCsv(
                        'mun-computer-applications.csv',
                        ['Reference ID', 'Customer', 'Category', 'Service', 'Status', 'Fee'],
                        applications.map((a) => [
                          a.referenceId,
                          a.customerName,
                          a.serviceCategory,
                          a.serviceTitle,
                          a.status,
                          a.feeCollected,
                        ])
                      )
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Export Applications CSV
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="font-display text-base font-bold text-slate-950">
                  Backup &amp; Restore
                </h2>
                <p className="text-sm text-slate-600">
                  Download a complete JSON snapshot of business records or restore customer data
                  (Admin only).
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Download JSON Backup
                  </button>
                  {isAdmin && (
                    <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <Upload className="w-4 h-4" /> Restore Customer Backup
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleRestoreBackup}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
