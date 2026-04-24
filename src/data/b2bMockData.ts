/**
 * B2B Panel Types, Constants & Role Definitions
 * Used across the B2B agent dashboard for display and access control.
 */

// ── Types ──────────────────────────────────────────────────────────
export type B2BRole = "owner" | "manager" | "reservation" | "finance" | "ticketing" | "readonly";

export interface B2BPermissions {
  can_search: boolean;
  can_book: boolean;
  can_issue: boolean;
  can_view_wallet: boolean;
  can_manage_finance: boolean;
  can_manage_customers: boolean;
  can_cancel: boolean;
  can_refund: boolean;
  can_access_reports: boolean;
  can_manage_users: boolean;
  can_view_support: boolean;
  can_create_support: boolean;
  can_edit_markup: boolean;
}

export const ROLE_PERMISSIONS: Record<B2BRole, B2BPermissions> = {
  owner: { can_search: true, can_book: true, can_issue: true, can_view_wallet: true, can_manage_finance: true, can_manage_customers: true, can_cancel: true, can_refund: true, can_access_reports: true, can_manage_users: true, can_view_support: true, can_create_support: true, can_edit_markup: true },
  manager: { can_search: true, can_book: true, can_issue: true, can_view_wallet: true, can_manage_finance: false, can_manage_customers: true, can_cancel: true, can_refund: false, can_access_reports: true, can_manage_users: true, can_view_support: true, can_create_support: true, can_edit_markup: true },
  reservation: { can_search: true, can_book: true, can_issue: false, can_view_wallet: false, can_manage_finance: false, can_manage_customers: true, can_cancel: false, can_refund: false, can_access_reports: false, can_manage_users: false, can_view_support: true, can_create_support: true, can_edit_markup: false },
  finance: { can_search: false, can_book: false, can_issue: false, can_view_wallet: true, can_manage_finance: true, can_manage_customers: false, can_cancel: false, can_refund: true, can_access_reports: true, can_manage_users: false, can_view_support: true, can_create_support: false, can_edit_markup: false },
  ticketing: { can_search: true, can_book: false, can_issue: true, can_view_wallet: false, can_manage_finance: false, can_manage_customers: false, can_cancel: true, can_refund: false, can_access_reports: false, can_manage_users: false, can_view_support: true, can_create_support: true, can_edit_markup: false },
  readonly: { can_search: true, can_book: false, can_issue: false, can_view_wallet: false, can_manage_finance: false, can_manage_customers: false, can_cancel: false, can_refund: false, can_access_reports: false, can_manage_users: false, can_view_support: true, can_create_support: false, can_edit_markup: false },
};

export const ROLE_LABELS: Record<B2BRole, string> = {
  owner: "Owner / Admin",
  manager: "Manager",
  reservation: "Reservation Staff",
  finance: "Finance Staff",
  ticketing: "Ticketing Staff",
  readonly: "Read Only",
};

// ── Booking statuses ───────────────────────────────────────────────
export type BookingStatus = "Pending Payment" | "Pending Ticketing" | "Confirmed" | "Issued" | "Cancelled" | "Refunded" | "Failed" | "On Hold" | "Paid" | "Needs Payment" | "Awaiting Payment";

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  "Pending Payment": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "Pending Ticketing": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Confirmed": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  "Issued": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "Cancelled": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  "Refunded": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "Failed": "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  "On Hold": "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  "Paid": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "Needs Payment": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "Awaiting Payment": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

// ── Finance statuses ───────────────────────────────────────────────
export type FinanceStatus = "Paid" | "Partially Paid" | "Unpaid" | "Deposit Pending" | "Verified" | "Rejected";

export const FINANCE_STATUS_COLORS: Record<FinanceStatus, string> = {
  "Paid": "bg-green-100 text-green-800",
  "Partially Paid": "bg-amber-100 text-amber-800",
  "Unpaid": "bg-red-100 text-red-700",
  "Deposit Pending": "bg-blue-100 text-blue-800",
  "Verified": "bg-emerald-100 text-emerald-800",
  "Rejected": "bg-red-200 text-red-900",
};

// ── Support statuses ───────────────────────────────────────────────
export type SupportStatus = "Open" | "In Progress" | "Awaiting Response" | "Resolved" | "Closed";

export const SUPPORT_STATUS_COLORS: Record<SupportStatus, string> = {
  "Open": "bg-blue-100 text-blue-800",
  "In Progress": "bg-amber-100 text-amber-800",
  "Awaiting Response": "bg-purple-100 text-purple-800",
  "Resolved": "bg-green-100 text-green-800",
  "Closed": "bg-gray-100 text-gray-700",
};

// ── Staff User type (used by staff management) ────────────────────
export interface StaffUser {
  id: string;
  full_name: string;
  email: string;
  role: B2BRole;
  status: "active" | "inactive";
  last_login: string;
  permissions: B2BPermissions;
}
