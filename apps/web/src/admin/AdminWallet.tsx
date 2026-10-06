import { useCallback, useEffect, useMemo, useState } from 'react';
import { PiArrowClockwiseBold, PiBankBold, PiCheckBold, PiXBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { adminWalletApi, type WithdrawalDTO } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';
import '../styles/wallet.css';

function statusLabel(status: string) {
  switch (status) {
    case 'pending': return 'Chờ duyệt';
    case 'approved': return 'Đã duyệt · chờ chuyển khoản';
    case 'completed': return 'Đã chuyển khoản';
    case 'rejected': return 'Đã từ chối';
    default: return status;
  }
}

export default function AdminWallet() {
  const [items, setItems] = useState<WithdrawalDTO[]>([]);
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await adminWalletApi.getWithdrawals(status || undefined);
    if (!result.success || !result.data) {
      setError(result.error || 'Không thể tải yêu cầu rút tiền.');
    } else {
      setItems(result.data);
      setSelectedId((current) => current && result.data?.some((item) => item.id === current) ? current : null);
    }
    setLoading(false);
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId],
  );

  const choose = (item: WithdrawalDTO) => {
    setSelectedId(item.id);
    setNote(item.adminNote || '');
    setReason('');
    setReference(item.bankReference || '');
  };

  const approve = async () => {
    if (!selected || busy) return;
    setBusy(true);
    const result = await adminWalletApi.approve(selected.id, note.trim() || undefined);
    setBusy(false);
    if (!result.success) return toast.error(result.error || 'Không thể duyệt yêu cầu.');
    toast.success('Đã duyệt yêu cầu. Tiền vẫn đang được tạm giữ cho tới khi xác nhận chuyển khoản.');
    await load();
  };

  const reject = async () => {
    if (!selected || busy) return;
    if (reason.trim().length < 3) return toast.error('Nhập lý do từ chối ít nhất 3 ký tự.');
    setBusy(true);
    const result = await adminWalletApi.reject(selected.id, reason.trim());
    setBusy(false);
    if (!result.success) return toast.error(result.error || 'Không thể từ chối yêu cầu.');
    toast.success('Đã từ chối và trả số tiền tạm giữ về số dư khả dụng của khách.');
    setSelectedId(null);
    await load();
  };

  const complete = async () => {
    if (!selected || busy) return;
    if (reference.trim().length < 3) return toast.error('Nhập mã giao dịch ngân hàng.');
    setBusy(true);
    const result = await adminWalletApi.complete(selected.id, reference.trim(), note.trim() || undefined);
    setBusy(false);
    if (!result.success) return toast.error(result.error || 'Không thể xác nhận chuyển khoản.');
    toast.success('Đã ghi nhận chuyển khoản. Số tiền tạm giữ đã được trừ khỏi ví.');
    setSelectedId(null);
    await load();
  };

  return (
    <main className="kk-wallet-page">
      <header className="kk-wallet-header">
        <div>
          <h1>Ví & yêu cầu rút tiền</h1>
          <p>Quy trình: khách tạo yêu cầu → tiền bị hold → Admin duyệt → chuyển khoản ngân hàng → nhập mã giao dịch.</p>
        </div>
        <button type="button" className="kk-wallet-btn kk-wallet-btn--secondary" onClick={() => void load()} disabled={loading}>
          <PiArrowClockwiseBold aria-hidden /> Làm mới
        </button>
      </header>

      {error && <div className="kk-wallet-error" role="alert">{error}</div>}

      <section className="kk-wallet-section">
        <div className="kk-wallet-section__head">
          <h2><PiBankBold aria-hidden /> Danh sách yêu cầu</h2>
          <select className="kk-wallet-filter" aria-label="Lọc trạng thái yêu cầu rút" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 260 }}>
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="completed">Đã chuyển khoản</option>
            <option value="rejected">Đã từ chối</option>
          </select>
        </div>

        {loading ? (
          <div className="kk-wallet-empty">Đang tải yêu cầu rút tiền...</div>
        ) : items.length === 0 ? (
          <div className="kk-wallet-empty">Không có yêu cầu phù hợp.</div>
        ) : (
          <div className="kk-wallet-table-wrap">
            <table className="kk-wallet-table">
              <thead><tr><th>Khách hàng</th><th>Số tiền</th><th>Tài khoản nhận</th><th>Trạng thái</th><th>Ngày tạo</th><th></th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.customerName || `#${item.id}`}</strong><br /><span className="kk-wallet-muted">{item.customerEmail}</span></td>
                    <td><strong>{formatCurrency(item.amount)}</strong></td>
                    <td>{item.bankName}<br /><span className="kk-wallet-muted">{item.accountNumber} · {item.accountHolder}</span></td>
                    <td><span className="kk-wallet-status">{statusLabel(item.status)}</span></td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td><button type="button" className="kk-wallet-btn kk-wallet-btn--secondary" onClick={() => choose(item)}>Xử lý</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <section className="kk-wallet-section" aria-labelledby="withdraw-action-title">
          <div className="kk-wallet-section__head">
            <div>
              <h2 id="withdraw-action-title">Yêu cầu #{selected.id} · {formatCurrency(selected.amount)}</h2>
              <p className="kk-wallet-muted">{selected.bankName} · {selected.accountNumber} · {selected.accountHolder}</p>
            </div>
            <span className="kk-wallet-status">{statusLabel(selected.status)}</span>
          </div>

          {selected.customerNote && <p><strong>Khách ghi chú:</strong> {selected.customerNote}</p>}

          {(selected.status === 'pending' || selected.status === 'approved') && (
            <div className="kk-wallet-form">
              <div className="kk-wallet-field kk-wallet-field--wide">
                <label htmlFor="admin-wallet-note">Ghi chú nội bộ</label>
                <textarea id="admin-wallet-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>

              {selected.status === 'pending' && (
                <div className="kk-wallet-field--wide kk-wallet-actions">
                  <button type="button" className="kk-wallet-btn" onClick={() => void approve()} disabled={busy}>
                    <PiCheckBold aria-hidden /> Duyệt yêu cầu
                  </button>
                </div>
              )}

              {selected.status === 'approved' && (
                <>
                  <div className="kk-wallet-field kk-wallet-field--wide">
                    <label htmlFor="admin-wallet-reference">Mã giao dịch ngân hàng sau khi đã chuyển tiền</label>
                    <input id="admin-wallet-reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ví dụ FT261006123456" />
                  </div>
                  <div className="kk-wallet-field--wide kk-wallet-actions">
                    <button type="button" className="kk-wallet-btn" onClick={() => void complete()} disabled={busy}>
                      <PiCheckBold aria-hidden /> Xác nhận đã chuyển khoản
                    </button>
                  </div>
                </>
              )}

              <div className="kk-wallet-field kk-wallet-field--wide">
                <label htmlFor="admin-wallet-reason">Lý do từ chối</label>
                <textarea id="admin-wallet-reason" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Chỉ nhập khi cần từ chối yêu cầu" />
              </div>
              <div className="kk-wallet-field--wide kk-wallet-actions">
                <button type="button" className="kk-wallet-btn kk-wallet-btn--danger" onClick={() => void reject()} disabled={busy}>
                  <PiXBold aria-hidden /> Từ chối và trả hold về ví
                </button>
              </div>
            </div>
          )}

          {selected.status === 'completed' && (
            <div className="kk-wallet-success">Đã chuyển khoản. Mã giao dịch: <strong>{selected.bankReference || '—'}</strong></div>
          )}
          {selected.status === 'rejected' && (
            <div className="kk-wallet-error">Yêu cầu đã bị từ chối. Số tiền hold đã được trả lại ví. {selected.adminNote || ''}</div>
          )}
        </section>
      )}
    </main>
  );
}
