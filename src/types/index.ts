import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'manager' | 'staff';

export interface WebsiteSettings {
  businessName: string;
  businessType: string;
  logoDataUrl?: string;
  faviconDataUrl?: string;
  heroHeading: string;
  heroSubtitle: string;
  heroDescription: string;
  heroImageUrl?: string;
  aboutIntro?: string;
  mission?: string;
  vision?: string;
  serviceCommitment?: string;
  phone: string;
  whatsapp: string;
  email: string;
  village?: string;
  postOffice?: string;
  policeStation?: string;
  district?: string;
  state?: string;
  country?: string;
  pinCode?: string;
  businessHoursConfigured: boolean;
  openingTime?: string;
  closingTime?: string;
  weeklyHolidays?: string[];
  specialHolidayNotice?: string;
  temporaryClosureNotice?: string;
  shopLat?: number;
  shopLng?: number;
  shopMapAddress?: string;
  updatedAt?: Timestamp | string;
  updatedBy?: string;
}

export interface ServiceCategoryInfo {
  id: string;
  number: string;
  title: string;
  shortDescription: string;
  iconName: string;
}

export interface PublicServiceItem {
  id: string;
  title: string;
  category: string;
  shortDescription: string;
  fullDescription?: string;
  requiredDocuments?: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export interface ServiceInternalItem {
  id: string;
  serviceId: string;
  title: string;
  category: string;
  serviceCharge: number;
  govtFee?: number;
  commission: number;
  employeeCost?: number;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export type NoticeCategory =
  | 'Business Announcement'
  | 'Service Notice'
  | 'Holiday Notice'
  | 'Customer Information'
  | 'General Update';

export type NoticeStatus = 'draft' | 'published' | 'archived';

export interface PublicNotice {
  id: string;
  title: string;
  description: string;
  category: NoticeCategory;
  status: NoticeStatus;
  isExpired: boolean;
  expiresAt?: string;
  publishedAt?: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy: string;
}

export type FeedbackStatus = 'NEW' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export interface CustomerFeedback {
  id: string;
  feedbackCode: string;
  customerName?: string;
  mobileNumber?: string;
  serviceCategory: string;
  serviceReferenceId?: string;
  rating: number;
  message: string;
  publicationConsent: boolean;
  status: FeedbackStatus;
  adminResponse?: string;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PublicReview {
  id: string;
  feedbackId: string;
  displayName: string;
  serviceCategory: string;
  rating: number;
  message: string;
  adminResponse?: string;
  approvedAt?: Timestamp;
  createdAt?: Timestamp;
  publishedBy: string;
}

export interface ContactEnquiry {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  serviceCategory?: string;
  subject: string;
  message: string;
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface StaffUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'suspended';
  registeredDevices?: string[];
  lastLoginAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CustomerRecord {
  id: string;
  fullName: string;
  mobile: string;
  village?: string;
  notes?: string;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ServiceApplication {
  id: string;
  referenceId: string;
  customerName: string;
  mobile?: string;
  serviceCategory: string;
  serviceTitle: string;
  status: 'Pending' | 'In Process' | 'Completed' | 'Delivered' | 'Cancelled';
  feeCollected: number;
  notes?: string;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface LedgerEntry {
  id: string;
  entryType: 'Income' | 'Expense' | 'Payment Received' | 'Payment Due';
  category: string;
  description: string;
  amount: number;
  paymentMode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Card';
  dateStr: string;
  createdBy: string;
  createdAt?: Timestamp;
}

export interface LpgRecord {
  id: string;
  consumerName: string;
  consumerNumber: string;
  agencyName: string;
  bookingType: 'Refill Booking' | 'e-KYC' | 'New Connection' | 'Subsidy Check';
  status: 'Booked' | 'Pending' | 'Completed';
  createdBy: string;
  createdAt?: Timestamp;
}

export interface InventoryItem {
  id: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  updatedAt?: Timestamp;
  updatedBy: string;
}

export interface AuditLog {
  id: string;
  action: string;
  module: string;
  targetId: string;
  details: string;
  actorUid: string;
  actorEmail: string;
  createdAt?: Timestamp;
}
