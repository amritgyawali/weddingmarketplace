import { useWindowDimensions } from 'react-native';

/**
 * Breakpoints for the web-ready consoles. Phones get one column; tablets and
 * desktop browsers (expo start --web) get side navigation and grids.
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    wide: width >= 960,
    medium: width >= 640,
    columns: width >= 1280 ? 3 : width >= 900 ? 2 : 1,
    /** Max content width for readable pages on large screens. */
    contentWidth: Math.min(width, width >= 1280 ? 1240 : width >= 960 ? 1040 : width),
  };
}
