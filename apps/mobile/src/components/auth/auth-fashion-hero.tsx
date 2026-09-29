import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { AppIcon } from '@/components/ui/app-icon';
import { BRAND, BRAND_COLORS } from '@/constants/brand';
import { resolveMediaUrl } from '@/services/api-client';
import { discoveryApi } from '@/services/discovery.api';
import { shopApi } from '@/services/home.api';

type AuthFashionHeroProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  height?: number;
  onBack?: () => void;
};

export function AuthFashionHero({
  eyebrow,
  title,
  subtitle,
  height = 300,
  onBack,
}: AuthFashionHeroProps) {
  const reducedMotion = useReducedMotion();
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let active = true;

    void Promise.allSettled([
      discoveryApi.getLookbooks(),
      shopApi.getBanners('homepage'),
    ]).then(([lookbookResult, bannerResult]) => {
      if (!active) return;

      const lookbookImage =
        lookbookResult.status === 'fulfilled'
          ? [...lookbookResult.value]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .find((item) => Boolean(item.image?.trim()))
              ?.image?.trim()
          : null;

      const bannerImage =
        bannerResult.status === 'fulfilled'
          ? [...bannerResult.value]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .find((item) => Boolean(item.image?.trim()))
              ?.image?.trim()
          : null;

      setRawImage(lookbookImage || bannerImage || null);
    });

    return () => {
      active = false;
    };
  }, []);

  const image = useMemo(() => resolveMediaUrl(rawImage), [rawImage]);
  const showImage = Boolean(image) && !imageFailed;

  return (
    <View style={[styles.hero, { height }]}>
      {showImage ? (
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(320)}
          style={StyleSheet.absoluteFill}>
          <Image
            accessibilityLabel="Ảnh thời trang KaitoKid"
            cachePolicy="memory-disk"
            contentFit="cover"
            onError={() => setImageFailed(true)}
            source={{ uri: image ?? '' }}
            style={StyleSheet.absoluteFill}
            transition={reducedMotion ? 0 : 220}
          />
        </Animated.View>
      ) : (
        <LinearGradient
          colors={['#111827', BRAND_COLORS.primaryDark, BRAND_COLORS.primary]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      <LinearGradient
        colors={[
          'rgba(17,24,39,0.10)',
          'rgba(17,24,39,0.20)',
          'rgba(17,24,39,0.78)',
        ]}
        locations={[0, 0.46, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          {onBack ? (
            <Pressable
              accessibilityLabel="Quay lại"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onBack}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}>
              <AppIcon color="#FFFFFF" name="arrowLeft" size={22} />
            </Pressable>
          ) : null}

          <View style={styles.brandPill}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>K</Text>
            </View>
            <Text style={styles.brandName}>{BRAND.name}</Text>
          </View>
        </View>

        <View style={styles.memberPill}>
          <AppIcon color="#FFFFFF" name="sparkles" size={15} />
          <Text style={styles.memberText}>MEMBER</Text>
        </View>
      </View>

      <Animated.View
        entering={
          reducedMotion
            ? undefined
            : FadeInDown.duration(280).delay(60)
        }
        style={styles.copy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: '#111827',
    position: 'relative',
  },
  topBar: {
    paddingHorizontal: 18,
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(17,24,39,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandPill: {
    minHeight: 44,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingRight: 13,
    backgroundColor: 'rgba(17,24,39,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.24)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoMark: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: BRAND_COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  memberPill: {
    minHeight: 38,
    borderRadius: 14,
    paddingHorizontal: 11,
    backgroundColor: 'rgba(124,58,237,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.26)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  copy: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 34,
    maxWidth: 520,
    gap: 7,
  },
  eyebrow: {
    color: '#FDE68A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 31,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: '#F3F4F6',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    maxWidth: 460,
  },
  pressed: { opacity: 0.74 },
});
