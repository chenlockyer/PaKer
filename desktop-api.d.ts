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
      quit: () => Promise<void>;
      onWindowStateChanged: (
        listener: (state: { fullscreen: boolean; maximized: boolean }) => void,
      ) => () => void;
    };
  }
}
