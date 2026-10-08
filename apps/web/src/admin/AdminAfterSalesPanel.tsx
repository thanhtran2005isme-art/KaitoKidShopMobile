import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import AdminIcon from '../components/admin/AdminIcon';
import { orderApi } from '../services/api/orderApi';
import type { AdminAfterSalesCase } from '../services/api/orderApi';
import { formatCurrency, formatDate } from '../utils/format';
import '../styles/admin/admin-orders-after-sales.css';

interface Props {
  orderId: number;
  onChanged?: () => Promise<void> | void;
}

function returnLabel(status: AdminAfterSalesCase['returnStatus']) {
  switch (status) {
    case 'requested': return 'Chờ duyệt yêu cầu hoàn';
    case 'approved': return 'Đã duyệt · chờ hàng quay về';
    case 'rejected': return 'Đã từ chối yêu cầu hoàn';
    case 'received_restock': return 'Đã nhận hàng · nhập lại tồn';
    case 'received_quarantine': return 'Đã nhận hàng · quarantine';
    default: return 'Chưa có yêu cầu hoàn';
  }
}

function refundLabel(status: AdminAfterSalesCase['refundStatus']) {
  if (status === 'pending') return 'Chờ hoàn tiền';
  if (status === 'completed') return 'Đã xác nhận hoàn tiền thủ công';
  return 'Chưa phát sinh hoàn tiền';
}

export default function AdminAfterSalesPanel({ orderId, onChanged }: Props) {
  const [data, setData] = useState<AdminAfterSalesCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [inspectionNote, setInspectionNote] = useState('');
  const [disposition, setDisposition] = useState<'restock' | 'quarantine'>('quarantine');
  const [refundReference, setRefundReference] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setData(await orderApi.getAfterSalesCase(orderId));
    } catch (error) {
      console.error(error);
      toast.error('Không thể tải trạng thái hậu mãi');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [orderId]);

  const refreshAll = async (next: AdminAfterSalesCase) => {
    setData(next);
    if (onChanged) await onChanged();
  };

  const decide = async (decision: 'approve' | 'reject') => {
    if (!data || busy) return;
    if (decision === 'reject' && decisionNote.trim().length < 3) {
      toast.error('Hãy nhập lý do từ chối ít nhất 3 ký tự');
      return;
    }
    setBusy(decision);
    try {
      const next = await orderApi.decideReturn(orderId, decision, decisionNote.trim() || undefined);
      await refreshAll(next);
      setDecisionNote('');
      toast.success(decision === 'approve' ? 'Đã duyệt yêu cầu hoàn' : 'Đã từ chối yêu cầu hoàn');
    } catch (error) {
      console.error(error);
      toast.error('Không thể cập nhật quyết định hoàn hàng');
    } finally {
      setBusy(null);
    }
  };

  const receive = async () => {
    if (!data || busy) return;
    if (inspectionNote.trim().length < 3) {
      toast.error('Hãy nhập kết quả kiểm hàng ít nhất 3 ký tự');
      return;
    }
    const warning = disposition === 'restock'
      ? 'Bạn xác nhận hàng đủ điều kiện bán lại. Tồn kho sản phẩm và biến thể sẽ được cộng lại.'
      : 'Hàng sẽ được ghi nhận quarantine và KHÔNG cộng vào tồn bán được.';
    if (!window.confirm(warning)) return;

    setBusy('receive');
    try {
      const next = await orderApi.receiveReturn(orderId, disposition, inspectionNote.trim());
      await refreshAll(next);
      setInspectionNote('');
      toast.success(disposition === 'restock' ? 'Đã nhận hàng hoàn và nhập lại tồn' : 'Đã nhận hàng hoàn vào quarantine');
    } catch (error) {
      console.error(error);
      toast.error('Không thể ghi nhận hàng hoàn');
    } finally {
      setBusy(null);
    }
  };

  const completeRefund = async () => {
    if (!data || busy) return;
    if (refundReference.trim().length < 3) {
      toast.error('Nhập mã tham chiếu hoặc ghi chú hoàn tiền');
      return;
    }
    if (!window.confirm('Xác nhận bạn đã thực sự hoàn tiền thủ công cho khách? Thao tác này chỉ ghi audit, không gọi cổng thanh toán.')) return;

    setBusy('refund');
    try {
      const next = await orderApi.markRefundCompleted(orderId, refundReference.trim());
      await refreshAll(next);
      setRefundReference('');
      toast.success('Đã ghi nhận hoàn tiền thủ công');
    } catch (error) {
      console.error(error);
      toast.error('Không thể xác nhận hoàn tiền');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="after-sales-loading">Đang tải nghiệp vụ hậu mãi…</div>;
  }
  if (!data) return null;

  return (
    <section className="after-sales-workspace">
      <div className="after-sales-heading">
        <div>
          <span className="orders-card-kicker">AFTER-SALES WORKSPACE</span>
          <h4>Đối soát giao hàng & hoàn trả</h4>
        </div>
        {data.requiresAttention && (
          <span className="after-sales-attention"><AdminIcon name="fa-triangle-exclamation" /> Cần xử lý</span>
        )}
      </div>

      <div className="after-sales-summary-grid">
        <div className={`after-sales-summary ${data.deliveryIssueOpen ? 'danger' : ''}`}>
          <span>Giao hàng</span>
          <strong>{data.deliveryIssueOpen ? 'Khách báo chưa nhận' : 'Không có khiếu nại mở'}</strong>
        </div>
        <div className={`after-sales-summary ${data.returnStatus === 'requested' || data.returnStatus === 'approved' ? 'warning' : ''}`}>
          <span>Hoàn hàng</span>
          <strong>{returnLabel(data.returnStatus)}</strong>
        </div>
        <div className={`after-sales-summary ${data.refundStatus === 'pending' ? 'warning' : ''}`}>
          <span>Hoàn tiền</span>
          <strong>{refundLabel(data.refundStatus)}</strong>
        </div>
      </div>

      {data.returnReason && (
        <div className="after-sales-note-card">
          <span>Lý do khách gửi</span>
          <p>{data.returnReason}</p>
        </div>
      )}

      {(data.canApproveReturn || data.canRejectReturn) && (
        <div className="after-sales-action-card">
          <label htmlFor={`decision-note-${orderId}`}>Ghi chú duyệt / lý do từ chối</label>
          <textarea
            id={`decision-note-${orderId}`}
            maxLength={300}
            value={decisionNote}
            onChange={(event) => setDecisionNote(event.target.value)}
            placeholder="Ví dụ: ảnh lỗi hợp lệ; hoặc lý do từ chối…"
          />
          <div className="after-sales-actions">
            <button type="button" className="after-sales-button approve" disabled={busy !== null} onClick={() => void decide('approve')}>
              <AdminIcon name="fa-check" /> Duyệt hoàn hàng
            </button>
            <button type="button" className="after-sales-button reject" disabled={busy !== null} onClick={() => void decide('reject')}>
              <AdminIcon name="fa-ban" /> Từ chối
            </button>
          </div>
        </div>
      )}

      {data.canReceiveReturn && (
        <div className="after-sales-action-card">
          <div className="after-sales-field-label">Kết quả kiểm hàng thực tế</div>
          <div className="after-sales-choice-grid">
            <button
              type="button"
              className={`after-sales-choice ${disposition === 'restock' ? 'active' : ''}`}
              onClick={() => setDisposition('restock')}
            >
              <AdminIcon name="fa-box-open" />
              <span><strong>Nhập lại tồn bán</strong><small>Chỉ chọn khi hàng đủ điều kiện bán lại.</small></span>
            </button>
            <button
              type="button"
              className={`after-sales-choice ${disposition === 'quarantine' ? 'active' : ''}`}
              onClick={() => setDisposition('quarantine')}
            >
              <AdminIcon name="fa-shield-halved" />
              <span><strong>Quarantine</strong><small>Không cộng vào tồn bán được.</small></span>
            </button>
          </div>
          <textarea
            maxLength={300}
            value={inspectionNote}
            onChange={(event) => setInspectionNote(event.target.value)}
            placeholder="Bắt buộc: tình trạng hàng, bao bì, lỗi quan sát được…"
          />
          <button type="button" className="after-sales-button primary" disabled={busy !== null} onClick={() => void receive()}>
            <AdminIcon name="fa-box" /> Xác nhận đã nhận & kiểm hàng hoàn
          </button>
        </div>
      )}

      {data.canMarkRefundCompleted && (
        <div className="after-sales-action-card refund">
          <div className="after-sales-field-label">Hoàn tiền thủ công</div>
          <p className="after-sales-help">
            Hệ thống chưa có API refund gateway cho flow này. Chỉ xác nhận sau khi tiền đã được hoàn thực tế.
          </p>
          <input
            maxLength={300}
            value={refundReference}
            onChange={(event) => setRefundReference(event.target.value)}
            placeholder="Mã giao dịch / biên nhận / ghi chú đối soát"
          />
          <button type="button" className="after-sales-button primary" disabled={busy !== null} onClick={() => void completeRefund()}>
            <AdminIcon name="fa-receipt" /> Xác nhận đã hoàn tiền thủ công
          </button>
        </div>
      )}

      {data.history.length > 0 && (
        <div className="after-sales-timeline">
          <h5>Lịch sử hậu mãi</h5>
          {data.history.slice().reverse().map((event) => (
            <div className="after-sales-event" key={event.id}>
              <div className="after-sales-event-dot" />
              <div>
                <strong>{event.status}</strong>
                {event.description && <p>{event.description}</p>}
                <small>{event.actor || 'Hệ thống'} · {formatDate(event.at)}</small>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.refundStatus === 'pending' && (
        <div className="after-sales-money-note">
          Giá trị đơn tham chiếu: <strong>{formatCurrency(data.total)}</strong>. Đây không tự động là số tiền refund cuối cùng nếu có điều chỉnh nghiệp vụ.
        </div>
      )}
    </section>
  );
}
