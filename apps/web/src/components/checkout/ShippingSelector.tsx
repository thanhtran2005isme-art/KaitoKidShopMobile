// Chọn đơn vị vận chuyển: KaitoKid Mock / GHN / GHTK / Lalamove / Tất cả

import { formatCurrency } from '../../utils/format';
import type { ShippingQuoteOption } from '../../services/api';

type ProviderCode = 'mock' | 'ghn' | 'ghtk' | 'lalamove' | 'all';

interface Props {
  provider: ProviderCode;
  onProviderChange: (p: ProviderCode) => void;
  options: ShippingQuoteOption[];
  selected: ShippingQuoteOption | null;
  onSelect: (opt: ShippingQuoteOption) => void;
  hasAddress: boolean;
  loading: boolean;
}

function providerLabel(provider: ProviderCode) {
  if (provider === 'all') return 'Tất cả';
  if (provider === 'mock') return 'KaitoKid Mock';
  if (provider === 'ghn') return 'GHN';
  if (provider === 'ghtk') return 'GHTK';
  return 'Lalamove';
}

export default function ShippingSelector({
  provider, onProviderChange, options, selected, onSelect,
  hasAddress, loading,
}: Props) {
  return (
    <div className="ivy-checkout-section">
      <h3 className="ivy-section-title">Đơn vị vận chuyển</h3>
      <div className="ivy-payment-box">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {(['all', 'mock', 'ghn', 'ghtk', 'lalamove'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onProviderChange(p)}
              className={`ivy-shipping-tab${provider === p ? ' active' : ''}`}
            >
              {providerLabel(p)}
            </button>
          ))}
        </div>

        {!hasAddress ? (
          <p className="ivy-payment-note">Vui lòng chọn tỉnh/quận để tính phí vận chuyển.</p>
        ) : loading ? (
          <p className="ivy-payment-note">Đang tính phí vận chuyển...</p>
        ) : options.length === 0 ? (
          <p className="ivy-payment-note ivy-payment-note-error">Chưa lấy được phí ship cho địa chỉ này.</p>
        ) : (
          options.map((opt) => {
            const active = selected?.provider === opt.provider && selected?.serviceCode === opt.serviceCode;
            return (
              <label
                key={`${opt.provider}-${opt.serviceCode}`}
                className={`ivy-radio-option${active ? ' active' : ''}`}
                onClick={() => onSelect(opt)}
              >
                <input type="radio" name="shipping" checked={active} readOnly />
                <span>
                  <strong>{opt.serviceName}</strong> · <span className="ivy-fee-amount">{formatCurrency(opt.fee)}</span>
                </span>
                <small>
                  {opt.provider === 'ghn' ? 'Giao Hàng Nhanh (giá API)'
                    : opt.provider === 'ghtk' ? 'Giao Hàng Tiết Kiệm (giá API)'
                    : opt.provider === 'lalamove' ? 'Lalamove (giá API)'
                    : opt.provider === 'mock' ? 'Mô phỏng nội bộ'
                    : opt.provider}
                  {' · '}Dự kiến {opt.leadTimeHours}h
                </small>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
