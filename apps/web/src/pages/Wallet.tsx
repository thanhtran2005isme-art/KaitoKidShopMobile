import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PiArrowClockwiseBold, PiBankBold, PiWalletBold } from 'react-icons/pi';
import {
  walletApi,
  type WalletSummaryDTO,
  type WalletTransactionDTO,
  type WithdrawalDTO,
} from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import '../styles/wallet.css';

const EMPTY_FORM = {
  amount: '',
  bankName: '',
  accountNumber: '',
  accountHolder: '',
  note: '',
};

function statusLabel(status: string) {
  switch (status) {
    case 'pending': return 'Chờ duyệt';
    case 'approved': return 'Đã duyệt · chờ chuyển khoản';
    case 'completed': return 'Đã chuyển khoản';
    case 'rejected': return 'Đã từ chối';
    default: return status;
  }
}

export default function Wallet() {
  const [summary, setSummary] = useState<WalletSummaryDTO | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionDTO[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalDTO[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [summaryResult, transactionResult, withdrawalResult] = await Promise.all([
      walletApi.getSummary(),
      walletApi.getTransactions(1, 50),
      walletApi.getWithdrawals(),
    ]);
    if (!summaryResult.success || !summaryResult.data) {
      setError(summaryResult.error || 'Không thể tải Ví KaitoKid.');
    } else {
      setSummary(summaryResult.data);
    }
    if (transactionResult.success && transactionResult.data) setTransactions(transactionResult.data);
    if (withdrawalResult.success && withdrawalResult.data) setWithdrawals(withdrawalResult.data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submitWithdrawal = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !summary) return;
    const amount = Number(form.amount.replace(/\D/g, ''));
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError('Vui lòng nhập số tiền rút hợp lệ.');
      return;
    }
    if (amount > summary.availableBalance) {
      setError('Số tiền rút lớn hơn số dư khả dụng.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    const result = await walletApi.createWithdrawal({
      amount,
      bankName: form.bankName.trim(),
      accountNumber: form.accountNumber.trim(),
      accountHolder: form.accountHolder.trim(),
      note: form.note.trim() || undefined,
    });
    setSubmitting(false);
    if (!result.success) {
      setError(result.error || 'Không thể tạo yêu cầu rút tiền.');
      return;
    }
    setForm(EMPTY_FORM);
    setSuccess('Đã tạo yêu cầu rút tiền. Số tiền đã được chuyển sang trạng thái tạm giữ trong lúc Admin xử lý.');
    await load();
  };

  if (loading && !summary) {
    return <div className="kk-wallet-page"><div className="kk-wallet-empty">Đang tải Ví KaitoKid...</div></div>;
  }

  return (
    <main className="kk-wallet-page">
      <header className="kk-wallet-header">
        <div>
          <h1>Ví KaitoKid</h1>
          <p>Tiền hoàn hàng được cộng vào ví. Bạn có thể dùng cho đơn tiếp theo hoặc yêu cầu rút về ngân hàng.</p>
        </div>
        <button type="button" className="kk-wallet-btn kk-wallet-btn--secondary" onClick={() => void load()} disabled={loading}>
          <PiArrowClockwiseBold aria-hidden /> Làm mới
        </button>
      </header>

      {error && <div className="kk-wallet-error" role="alert">{error}</div>}
      {success && <div className="kk-wallet-success" role="status">{success}</div>}

      {summary && (
        <div className="kk-wallet-grid">
          <div className="kk-wallet-card">
            <span className="kk-wallet-card__label">Số dư khả dụng</span>
            <strong className="kk-wallet-card__value">{formatCurrency(summary.availableBalance)}</strong>
          </div>
          <div className="kk-wallet-card">
            <span className="kk-wallet-card__label">Đang tạm giữ để rút</span>
            <strong className="kk-wallet-card__value">{formatCurrency(summary.heldBalance)}</strong>
          </div>
          <div className="kk-wallet-card">
            <span className="kk-wallet-card__label">Tổng số dư ví</span>
            <strong className="kk-wallet-card__value">{formatCurrency(summary.totalBalance)}</strong>
          </div>
        </div>
      )}

      <section className="kk-wallet-section" aria-labelledby="withdraw-title">
        <div className="kk-wallet-section__head">
          <div>
            <h2 id="withdraw-title"><PiBankBold aria-hidden /> Rút tiền về ngân hàng</h2>
            <p className="kk-wallet-muted">Khi gửi yêu cầu, số tiền được giữ lại ngay để tránh vừa chi tiêu vừa rút cùng một khoản.</p>
          </div>
        </div>
        <form className="kk-wallet-form" onSubmit={submitWithdrawal}>
          <div className="kk-wallet-field">
            <label htmlFor="wallet-amount">Số tiền rút</label>
            <input
              id="wallet-amount"
              inputMode="numeric"
              autoComplete="off"
              value={form.amount}
              onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))}
              placeholder="Ví dụ 500000"
              required
            />
          </div>
          <div className="kk-wallet-field">
            <label htmlFor="wallet-bank">Ngân hàng</label>
            <input id="wallet-bank" value={form.bankName} onChange={(e) => setForm((current) => ({ ...current, bankName: e.target.value }))} required />
          </div>
          <div className="kk-wallet-field">
            <label htmlFor="wallet-account">Số tài khoản</label>
            <input id="wallet-account" inputMode="numeric" autoComplete="off" value={form.accountNumber} onChange={(e) => setForm((current) => ({ ...current, accountNumber: e.target.value }))} required />
          </div>
          <div className="kk-wallet-field">
            <label htmlFor="wallet-holder">Tên chủ tài khoản</label>
            <input id="wallet-holder" autoComplete="name" value={form.accountHolder} onChange={(e) => setForm((current) => ({ ...current, accountHolder: e.target.value }))} required />
          </div>
          <div className="kk-wallet-field kk-wallet-field--wide">
            <label htmlFor="wallet-note">Ghi chú (không bắt buộc)</label>
            <textarea id="wallet-note" value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} maxLength={300} />
          </div>
          <div className="kk-wallet-field--wide kk-wallet-actions">
            <button className="kk-wallet-btn" type="submit" disabled={submitting || !summary || summary.availableBalance <= 0}>
              <PiWalletBold aria-hidden /> {submitting ? 'Đang gửi...' : 'Tạo yêu cầu rút tiền'}
            </button>
            {summary && <span className="kk-wallet-muted">Có thể rút tối đa {formatCurrency(summary.availableBalance)}</span>}
          </div>
        </form>
      </section>

      <section className="kk-wallet-section" aria-labelledby="withdraw-history-title">
        <div className="kk-wallet-section__head"><h2 id="withdraw-history-title">Yêu cầu rút tiền</h2></div>
        {withdrawals.length === 0 ? (
          <div className="kk-wallet-empty">Chưa có yêu cầu rút tiền.</div>
        ) : (
          <div className="kk-wallet-table-wrap">
            <table className="kk-wallet-table">
              <thead><tr><th>Ngày</th><th>Số tiền</th><th>Ngân hàng</th><th>Trạng thái</th><th>Tham chiếu</th></tr></thead>
              <tbody>
                {withdrawals.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.createdAt)}</td>
                    <td><strong>{formatCurrency(item.amount)}</strong></td>
                    <td>{item.bankName}<br /><span className="kk-wallet-muted">{item.accountNumber} · {item.accountHolder}</span></td>
                    <td><span className="kk-wallet-status">{statusLabel(item.status)}</span>{item.adminNote ? <><br /><span className="kk-wallet-muted">{item.adminNote}</span></> : null}</td>
                    <td>{item.bankReference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="kk-wallet-section" aria-labelledby="transaction-title">
        <div className="kk-wallet-section__head"><h2 id="transaction-title">Lịch sử giao dịch ví</h2></div>
        {transactions.length === 0 ? (
          <div className="kk-wallet-empty">Chưa có giao dịch ví.</div>
        ) : (
          <div className="kk-wallet-table-wrap">
            <table className="kk-wallet-table">
              <thead><tr><th>Ngày</th><th>Nội dung</th><th>Số tiền</th><th>Số dư khả dụng sau GD</th><th>Tạm giữ sau GD</th></tr></thead>
              <tbody>
                {transactions.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>{item.description || item.type}</td>
                    <td><strong>{item.direction === 'credit' ? '+' : '−'}{formatCurrency(item.amount)}</strong></td>
                    <td>{formatCurrency(item.availableAfter)}</td>
                    <td>{formatCurrency(item.heldAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
