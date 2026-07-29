import { UiScaleSetting } from '../types';

export interface DisplayMetrics {
  logicalWidth: number;
  logicalHeight: number;
  scaleFactor: number;
}

export const UI_SCALE_STORAGE_KEY = 'hoc_ui_scale';

export const UI_SCALE_OPTIONS: ReadonlyArray<{
  value: UiScaleSetting;
  factor: number | null;
}> = [
  { value: 'auto', factor: null },
  { value: '100', factor: 1 },
  { value: '110', factor: 1.1 },
  { value: '125', factor: 1.25 },
  { value: '133', factor: 4 / 3 },
  { value: '150', factor: 1.5 },
  { value: '175', factor: 1.75 },
  { value: '200', factor: 2 },
];

const VALID_SETTINGS = new Set<UiScaleSetting>(
  UI_SCALE_OPTIONS.map(option => option.value),
);

export const loadUiScaleSetting = (): UiScaleSetting => {
  const saved = localStorage.getItem(UI_SCALE_STORAGE_KEY) as UiScaleSetting | null;
  return saved && VALID_SETTINGS.has(saved) ? saved : 'auto';
};

export const getBrowserDisplayMetrics = (): DisplayMetrics => ({
  logicalWidth: window.screen?.availWidth || window.innerWidth,
  logicalHeight: window.screen?.availHeight || window.innerHeight,
  scaleFactor: window.devicePixelRatio || 1,
});

export const resolveUiScale = (
  setting: UiScaleSetting,
  metrics: DisplayMetrics,
): number => {
  if (setting !== 'auto') {
    return UI_SCALE_OPTIONS.find(option => option.value === setting)?.factor ?? 1;
  }

  // 1080 logical pixels is the reference canvas. A 1440p display at 100%
  // therefore receives 133%, while Windows' own 150% scaling already reduces
  // the logical height and does not get amplified a second time.
  const rawScale = metrics.logicalHeight / 1080;
  return Math.round(Math.min(2, Math.max(1, rawScale)) * 100) / 100;
};
