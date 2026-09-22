import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BRAND_COLORS } from '@/constants/brand';

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return hours > 0 ? hours + ':' + mm + ':' + ss : mm + ':' + ss;
}

export function CartReservationTimer({
  reservedUntil,
  onExpired,
}: {
  reservedUntil?: string | null;
  onExpired?: () => void;
}) {
  const deadline = reservedUntil ? Date.parse(reservedUntil) : Number.NaN;
  const [remainingMs, setRemainingMs] = useState(() =>
    Number.isFinite(deadline) ? Math.max(0, deadline - Date.now()) : 0,
  );
  const notified = useRef(false);

  useEffect(() => {
    notified.current = false;
    setRemainingMs(
      Number.isFinite(deadline) ? Math.max(0, deadline - Date.now()) : 0,
    );

    if (!Number.isFinite(deadline)) return;

    const tick = () => {
      setRemainingMs(Math.max(0, deadline - Date.now()));
    };

    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  useEffect(() => {
    if (
      Number.isFinite(deadline) &&
      remainingMs <= 0 &&
      !notified.current
    ) {
      notified.current = true;
      onExpired?.();
    }
  }, [deadline, onExpired, remainingMs]);

  if (!reservedUntil || !Number.isFinite(deadline)) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {remainingMs > 0 ? 'Giữ hàng còn' : 'Đang cập nhật giữ hàng'}
      </Text>
      {remainingMs > 0 ? (
        <Text style={styles.time}>{formatDuration(remainingMs)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFF7ED',
    alignSelf: 'flex-start',
  },
  label: {
    color: '#9A3412',
    fontSize: 9,
    fontWeight: '700',
  },
  time: {
    color: BRAND_COLORS.accent,
    fontSize: 10,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
});
