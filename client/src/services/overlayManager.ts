import { NativeModules, DeviceEventEmitter } from 'react-native';

const { SystemOverlay } = NativeModules;

// Safety fallback for development environments where the Native Module isn't compiled yet.
// Maps to the exact Config Plugin interface expected by the native bridge.
const NativeOverlay = SystemOverlay || {
  checkOverlayPermission: async () => false,
  requestOverlayPermission: async () => false,
  showOverlay: (title: string, colorHex: string) => {
    console.warn(`[NativeBridge Mock] showOverlay called with: ${title} / ${colorHex}`);
  },
  hideOverlay: () => {
    console.warn(`[NativeBridge Mock] hideOverlay called`);
  }
};

export class OverlayManagerService {
  private isInitialized: boolean = false;

  /**
   * Initializes the cross-app overlay service. Must be called once at app boot (e.g. App.tsx or DriveScreen mount).
   */
  public init() {
    if (this.isInitialized) return;
    
    // Subscribe to the unified backend Urban Alert Dispatcher
    DeviceEventEmitter.addListener('URBAN_ALERT_TRIGGERED', this.handleUrbanAlert.bind(this));
    this.isInitialized = true;
  }

  /**
   * Checks if the OS (Android) has granted the SYSTEM_ALERT_WINDOW capability.
   */
  public async checkPermissions(): Promise<boolean> {
    try {
      return await NativeOverlay.checkOverlayPermission();
    } catch (e) {
      console.warn('Failed to check native overlay permissions', e);
      return false;
    }
  }

  /**
   * Prompts the user via the OS Settings pane to allow "Draw Over Other Apps".
   */
  public async requestPermissions(): Promise<boolean> {
    try {
      return await NativeOverlay.requestOverlayPermission();
    } catch (e) {
      console.warn('Failed to request native overlay permissions', e);
      return false;
    }
  }

  private handleUrbanAlert(data: { timestamp: number, severity: 'medium' | 'high' }) {
    // Design Constraint: Minimalist 2-word Macros & Dynamic Hex mapping.
    // (Never pass numeric speed digits to this bridge).
    let title = '';
    let colorHex = '';

    if (data.severity === 'high') {
      title = 'למתן מהירות';
      colorHex = '#dc2626'; // Flashing muted red
    } else {
      title = 'האצה חדה';
      colorHex = '#f59e0b'; // Soft pulsing amber
    }

    this.showOverlay(title, colorHex);
  }

  public showOverlay(title: string, colorHex: string) {
    try {
      NativeOverlay.showOverlay(title, colorHex);
    } catch (e) {
      console.error('Failed to trigger native SystemOverlay', e);
    }
  }

  public hideOverlay() {
    try {
      NativeOverlay.hideOverlay();
    } catch (e) {
      console.error('Failed to hide native SystemOverlay', e);
    }
  }
}

export const overlayManager = new OverlayManagerService();
