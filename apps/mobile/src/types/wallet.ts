export type WalletSummary = {
  availableBalance: number;
  heldBalance: number;
  totalBalance: number;
  pendingWithdrawalAmount: number;
  pendingWithdrawalCount: number;
  updatedAt: string;
};

export type WalletTransaction = {
  id: number;
  type: string;
  direction: 'credit' | 'debit' | string;
  amount: number;
  availableAfter: number;
  heldAfter: number;
  referenceType: string;
  referenceId: string;
  description?: string | null;
  createdAt: string;
};

export type WalletWithdrawal = {
  id: number;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected' | string;
  customerNote?: string | null;
  adminNote?: string | null;
  bankReference?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

export type CreateWalletWithdrawalInput = {
  amount: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  note?: string;
};
