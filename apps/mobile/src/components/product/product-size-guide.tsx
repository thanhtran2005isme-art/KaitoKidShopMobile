import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND_COLORS } from '@/constants/brand';
import { KID_SIZE_GUIDE } from '@/utils/product-detail';

type ProductSizeGuideProps = {
  visible: boolean;
  availableSizes: string[];
  onClose: () => void;
};

export function ProductSizeGuide({ visible, availableSizes, onClose }: ProductSizeGuideProps) {
  const rows = KID_SIZE_GUIDE.filter(
    (row) => !availableSizes.length || availableSizes.includes(row.size),
  );

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      transparent={false}
      visible={visible}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>KAITOKID SIZE GUIDE</Text>
            <Text style={styles.title}>Chọn size cho bé</Text>
          </View>
          <Pressable accessibilityLabel="Đóng" onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.intro}>
            Size KaitoKid ưu tiên theo chiều cao. Hãy đo chiều cao và cân nặng thực tế của bé;
            nếu bé nằm giữa hai size hoặc thích mặc rộng, ưu tiên size lớn hơn.
          </Text>

          <View style={styles.table}>
            <View style={[styles.row, styles.headRow]}>
              <Text style={[styles.cell, styles.headCell]}>Size</Text>
              <Text style={[styles.cell, styles.headCell]}>Độ tuổi gợi ý</Text>
              <Text style={[styles.cell, styles.headCell]}>Chiều cao</Text>
            </View>

            {rows.map((row) => (
              <View key={row.size} style={styles.row}>
                <Text style={[styles.cell, styles.sizeCell]}>{row.size}</Text>
                <Text style={styles.cell}>{row.age}</Text>
                <Text style={styles.cell}>{row.height}</Text>
              </View>
            ))}
          </View>

          <View style={styles.note}>
            <Text style={styles.noteTitle}>Lưu ý</Text>
            <Text style={styles.noteText}>
              Bảng trên là gợi ý tham khảo. Tỷ lệ cơ thể mỗi bé khác nhau, vì vậy chiều cao thực tế
              nên được ưu tiên hơn độ tuổi.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={onClose} style={styles.done}>
            <Text style={styles.doneText}>Đã hiểu</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND_COLORS.canvas,
  },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: BRAND_COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BRAND_COLORS.line,
  },
  eyebrow: {
    color: BRAND_COLORS.primary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  title: {
    color: BRAND_COLORS.ink,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: BRAND_COLORS.ink,
    fontSize: 26,
    lineHeight: 28,
  },
  content: {
    padding: 18,
    gap: 18,
  },
  intro: {
    color: BRAND_COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
  },
  table: {
    backgroundColor: BRAND_COLORS.surface,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND_COLORS.line,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BRAND_COLORS.line,
  },
  headRow: {
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  cell: {
    flex: 1,
    paddingHorizontal: 10,
    color: '#4B5563',
    fontSize: 11,
    textAlign: 'center',
  },
  headCell: {
    color: BRAND_COLORS.primaryDark,
    fontWeight: '900',
  },
  sizeCell: {
    color: BRAND_COLORS.ink,
    fontWeight: '900',
  },
  note: {
    borderRadius: 18,
    backgroundColor: BRAND_COLORS.accentSoft,
    padding: 15,
    gap: 5,
  },
  noteTitle: {
    color: '#9A3412',
    fontSize: 12,
    fontWeight: '900',
  },
  noteText: {
    color: '#7C2D12',
    fontSize: 10,
    lineHeight: 16,
  },
  footer: {
    padding: 16,
    backgroundColor: BRAND_COLORS.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BRAND_COLORS.line,
  },
  done: {
    height: 50,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});
