// Step 3 - Thanh toán online sau khi đặt đơn ATM.
// payOS webhook là authority; Customer Web chỉ poll KaitoKid backend để refresh UI.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentApi, type PaymentInstructions } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import type { BankAccount } from './types';

interface Props {
  orderCode: string;
  total: number;
  /** Legacy fallback cho đơn/config cũ khi payOS chưa được cấu hình. */
  bankAccounts: BankAccount[];
  /** Backend cho phép gọi simulate-paid không (chỉ dev). Production luôn ẩn. */
  allowSimulatePaid: boolean;
  onPaid: () => void;
}

export default function PaymentStep({ orderCode, total, bankAccounts, allowSimulatePaid, onPaid }: Props) {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(900);
  const [expired, setExpired] = useState(false);
  const [instructionLoading, setInstructionLoading] = useState(true);
  const [instructionError, setInstructionError] = useState('');
  const [instructions, setInstructions] = useState<PaymentInstructions | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadInstructions = async () => {
      setInstructionLoading(true);
      setInstructionError('');
      const result = await paymentApi.getInstructions(orderCode);
      if (cancelled) return;

      if (!result.success || !result.data) {
        setInstructionError(result.error || 'Không thể tải thông tin thanh toán.');
        setInstructionLoading(false);
        return;
      }

      setInstructions(result.data);
      setSecondsLeft(result.data.secondsLeft);
      setInstructionLoading(false);
    };

    void loadInstructions();
    return () => { cancelled = true; };
  }, [orderCode]);

  // Webhook payOS cập nhật DB. Polling này chỉ làm UI gần realtime và là fallback
  // khi browser không nhận push nào khác.
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const r = await paymentApi.getStatus(orderCode);
        if (cancelled || !r.success || !r.data) return;
        setSecondsLeft(r.data.secondsLeft);
        if (r.data.status === 'cancelled' || r.data.secondsLeft <= 0) {
          setExpired(true);
          return;
        }
        if (r.data.paidAt) onPaid();
      } finally {
        inFlight = false;
      }
    };
    void tick();
    const interval = window.setInterval(tick, 3000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [orderCode, onPaid]);

  useEffect(() => {
    if (expired) return;
    const t = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [expired]);

  const isPayOs = instructions?.provider === 'payos';
  const primaryBank = instructions?.bankAccount || bankAccounts[0] || null;
  const transferContent = instructions?.transferContent || `DH${orderCode}`;
  const payableTotal = instructions?.total ?? total;
  const qrUrl = instructions?.qrUrl?.trim() || primaryBank?.qrImage?.trim() || '';
  const showBankAccount = Boolean(
    primaryBank?.accountNumber &&
    primaryBank.accountNumber !== 'Thanh toán trên payOS' &&
    primaryBank.accountHolder,
  );

  const handleSimulatePaid = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    setActionError('');
    try {
      const r = await paymentApi.simulatePaid(orderCode);
      if (!r.success) {
        setActionError(r.error || 'Không thể mô phỏng thanh toán.');
        return;
      }
      const s = await paymentApi.getStatus(orderCode);
      if (s.success && s.data?.paidAt) onPaid();
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancel = async () => {
    if (actionBusy) return;
    setActionBusy(true);
    setActionError('');
    try {
      const result = await paymentApi.cancel(orderCode);
      if (!result.success) {
        setActionError(result.error || 'Không thể hủy giao dịch.');
        return;
      }
      setExpired(true);
      setSecondsLeft(0);
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="ivy-checkout-page">
      <div className="ivy-cart-steps">
        <div className="ivy-step done"><div className="ivy-step-num">✓</div><span>Giỏ hàng</span></div>
        <div className="ivy-step-line active"></div>
        <div className="ivy-step done"><div className="ivy-step-num">✓</div><span>Đặt hàng</span></div>
        <div className="ivy-step-line active"></div>
        <div className="ivy-step active"><div className="ivy-step-num">3</div><span>Thanh toán</span></div>
        <div className="ivy-step-line"></div>
        <div className="ivy-step"><div className="ivy-step-num">4</div><span>Hoàn thành đơn</span></div>
      </div>

      <div className="ivy-payment-step">
        <div className="ivy-payment-step__header">
          <i className="fa fa-university"></i>
          <div>
            <h2>{isPayOs ? 'Thanh toán qua payOS' : 'Thanh toán qua ngân hàng'}</h2>
            <p>
              {isPayOs
                ? 'Quét QR hoặc mở trang payOS. KaitoKid tự xác nhận sau webhook, không cần bấm “đã thanh toán”.'
                : 'Quét mã QR để thanh toán nhanh chóng và an toàn'}
            </p>
          </div>
        </div>

        {!expired ? (
          <div className={`ivy-payment-countdown${secondsLeft < 60 ? ' urgent' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <i className="fa fa-clock"></i>
              <div>
                <strong>Thời gian thanh toán còn lại</strong>
                <div className="ivy-payment-countdown__hint">
                  {isPayOs
                    ? 'Backend sẽ đối soát payOS trước khi hủy và hoàn tồn kho/coupon.'
                    : 'Đơn hàng sẽ tự hủy nếu không thanh toán trước khi hết giờ'}
                </div>
              </div>
            </div>
            <div className="ivy-payment-countdown__time">
              {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
            </div>
          </div>
        ) : (
          <div className="ivy-payment-expired">
            <i className="fa fa-times-circle"></i>
            <h3>Giao dịch không còn hiệu lực</h3>
            <p>Đơn đã hủy hoặc hết thời gian thanh toán.</p>
            <button onClick={() => navigate('/cart')} className="ivy-btn-primary">Quay về giỏ hàng</button>
          </div>
        )}

        {!expired && instructionLoading && (
          <div className="ivy-payment-no-bank">Đang tạo hoặc khôi phục payment link...</div>
        )}

        {!expired && !instructionLoading && instructions && (
          <div className="ivy-payment-step__body">
            <div className="ivy-payment-info">
              <h3><i className="fa fa-file-invoice"></i> Thông tin thanh toán</h3>
              <p className="ivy-payment-info__order">Mã giao dịch: <strong>{orderCode}</strong></p>

              <div className="ivy-payment-info__rows">
                <div>
                  <span className="ivy-label">Số tiền</span>
                  <div className="ivy-amount-pill">{formatCurrency(payableTotal)}</div>
                </div>
                {showBankAccount && primaryBank && (
                  <>
                    <div>
                      <span className="ivy-label">Kênh nhận</span>
                      <div className="ivy-value-bold">{primaryBank.bankName}</div>
                    </div>
                    <div>
                      <span className="ivy-label">Số tài khoản</span>
                      <div className="ivy-value-row">
                        <span className="ivy-value-bigred">{primaryBank.accountNumber}</span>
                        <button type="button" onClick={() => navigator.clipboard.writeText(primaryBank.accountNumber)} className="ivy-copy-btn">
                          <i className="fa fa-copy"></i> Sao chép
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="ivy-label">Chủ tài khoản</span>
                      <div className="ivy-value-bold">{primaryBank.accountHolder}</div>
                    </div>
                  </>
                )}
                <div>
                  <span className="ivy-label">Nội dung</span>
                  <div className="ivy-value-row">
                    <span className="ivy-value-pill">{transferContent}</span>
                    <button type="button" onClick={() => navigator.clipboard.writeText(transferContent)} className="ivy-copy-btn">
                      <i className="fa fa-copy"></i> Sao chép
                    </button>
                  </div>
                </div>
              </div>

              <p className="ivy-payment-info__note">
                <strong>Lưu ý:</strong>{' '}
                {isPayOs
                  ? 'payOS webhook mới là nguồn xác nhận thanh toán. Không đóng/mở đơn dựa vào URL quay về từ trình duyệt.'
                  : 'Vui lòng chuyển đúng số tiền và nội dung để hệ thống xác nhận đơn.'}
              </p>

              {isPayOs && instructions.checkoutUrl && (
                <a
                  href={instructions.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ivy-btn-primary"
                >
                  Mở trang thanh toán payOS
                </a>
              )}
            </div>

            <div className="ivy-payment-qr">
              <h3>{isPayOs ? 'Quét QR payOS để thanh toán' : 'Quét mã QR để thanh toán'}</h3>
              {qrUrl ? (
                <>
                  <div className="ivy-payment-qr__frame">
                    <img src={qrUrl} alt={isPayOs ? 'QR payOS' : 'QR chuyển khoản'} loading="lazy" decoding="async" />
                  </div>
                  <p className="ivy-payment-qr__hint">
                    {isPayOs
                      ? instructions.qrMode === 'payos_checkout'
                        ? 'Payment link đã tồn tại; QR mở payOS Hosted Checkout để tiếp tục thanh toán.'
                        : 'QR được payOS cấp theo đúng số tiền của đơn; trạng thái sẽ tự cập nhật sau khi webhook được xác minh.'
                      : 'Quét bằng ứng dụng ngân hàng để thanh toán.'}
                  </p>
                  <a href={qrUrl} download={`QR-${orderCode}.png`} className="ivy-btn-primary">
                    <i className="fa fa-download"></i> Tải QR về máy
                  </a>
                </>
              ) : (
                <p className="ivy-payment-qr__hint">Không tạo được QR. Hãy mở trang thanh toán payOS.</p>
              )}
            </div>
          </div>
        )}

        {!expired && !instructionLoading && !instructions && (
          <div className="ivy-payment-no-bank">
            {instructionError || 'Phương thức thanh toán chưa được cấu hình. Vui lòng liên hệ shop.'}
          </div>
        )}

        {actionError && <div className="ivy-payment-no-bank">{actionError}</div>}

        {!expired && (
          <div className="ivy-payment-actions">
            {allowSimulatePaid && (
              <button disabled={actionBusy} onClick={() => void handleSimulatePaid()} className="ivy-btn-primary">
                Mô phỏng paid (chỉ dev)
              </button>
            )}
            <button disabled={actionBusy} onClick={() => void handleCancel()} className="ivy-btn-secondary">
              Hủy giao dịch
            </button>
            <button onClick={() => navigate('/products')} className="ivy-btn-secondary">
              Tiếp tục mua hàng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
