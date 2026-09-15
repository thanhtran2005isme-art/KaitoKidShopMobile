import { useWindowDimensions } from 'react-native';

const GRID_HORIZONTAL_PADDING = 24;
const GRID_GAP = 12;
const MAX_CARD_WIDTH = 240;

export function useProductGrid() {
  const { width } = useWindowDimensions();
  const columns = width >= 1024 ? 4 : width >= 700 ? 3 : 2;
  const availableWidth = Math.max(
    0,
    width - GRID_HORIZONTAL_PADDING - GRID_GAP * (columns - 1),
  );
  const cardWidth = Math.max(
    110,
    Math.min(MAX_CARD_WIDTH, Math.floor(availableWidth / columns)),
  );

  return {
    cardWidth,
    columns,
    gap: GRID_GAP,
  };
}
