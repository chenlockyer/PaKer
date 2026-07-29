export {};

declare global {
  interface Window {
    desktopAPI?: {
      readonly isDesktop: true;
      minimize: () => Promise<void>;
      toggleFullscreen: () => Promise<boolean>;
      getWindowState: () => Promise<{
        fullscreen: boolean;
        maximized: boolean;
      }>;
      getDisplayMetrics: () => Promise<{
        logicalWidth: number;
        logicalHeight: number;
        scaleFactor: number;
      }>;
      quit: () => Promise<void>;
      onWindowStateChanged: (
        listener: (state: { fullscreen: boolean; maximized: boolean }) => void,
      ) => () => void;
      onDisplayMetricsChanged: (
        listener: (metrics: {
          logicalWidth: number;
          logicalHeight: number;
          scaleFactor: number;
        }) => void,
      ) => () => void;
    };
  }
}
