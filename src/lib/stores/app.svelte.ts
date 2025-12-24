// ============================================
// APP STORE - Global uygulama durumu
// Demo/Live mod, tema, bildirimler
// ============================================

import { playNotificationSound, playSuccessSound } from "$lib/utils/sound";
import { browser } from "$app/environment";

// LocalStorage'dan ayarları yükle
function loadSetting<T>(key: string, defaultValue: T): T {
  if (!browser) return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    return stored !== null ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveSetting(key: string, value: unknown): void {
  if (!browser) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage hatası - sessizce geç
  }
}

// Uygulama modu: demo veya live
let appMode = $state<"demo" | "live">("live");

// Demo modu aktif mi (ayarlardan kapatılabilir)
let demoEnabled = $state(false);

// Çevrimdışı araçları göster
let showOfflineVehicles = $state(true);

// Ses ayarı
let soundEnabled = $state(true);

// Sidebar açık/kapalı
let sidebarOpen = $state(true);

// Browser'da ayarları yükle
if (browser) {
  demoEnabled = loadSetting("demoEnabled", false);
  showOfflineVehicles = loadSetting("showOfflineVehicles", true);
  soundEnabled = loadSetting("soundEnabled", true);
}

// Bildirimler
interface Notification {
  id: number;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

let notifications = $state<Notification[]>([]);
let nextNotificationId = 1;

// Demo simülasyon aktif mi
let demoSimulationActive = $state(false);

export const appStore = {
  // Getters
  get mode() {
    return appMode;
  },
  get isDemo() {
    return appMode === "demo" && demoEnabled;
  },
  get isLive() {
    return appMode === "live";
  },
  get demoEnabled() {
    return demoEnabled;
  },
  get showOfflineVehicles() {
    return showOfflineVehicles;
  },
  get sidebarOpen() {
    return sidebarOpen;
  },
  get notifications() {
    return notifications;
  },
  get unreadCount() {
    return notifications.filter((n) => !n.read).length;
  },
  get demoActive() {
    return demoSimulationActive;
  },
  get soundEnabled() {
    return soundEnabled;
  },

  // Mode actions
  setMode(mode: "demo" | "live") {
    appMode = mode;
    if (mode === "live") {
      demoSimulationActive = false;
    }
  },

  toggleMode() {
    appMode = appMode === "demo" ? "live" : "demo";
    if (appMode === "live") {
      demoSimulationActive = false;
    }
  },

  // Demo enabled toggle
  setDemoEnabled(enabled: boolean) {
    demoEnabled = enabled;
    saveSetting("demoEnabled", enabled);
    if (!enabled) {
      demoSimulationActive = false;
    }
  },

  toggleDemoEnabled() {
    demoEnabled = !demoEnabled;
    saveSetting("demoEnabled", demoEnabled);
    if (!demoEnabled) {
      demoSimulationActive = false;
    }
  },

  // Offline vehicles toggle
  setShowOfflineVehicles(show: boolean) {
    showOfflineVehicles = show;
    saveSetting("showOfflineVehicles", show);
  },

  toggleShowOfflineVehicles() {
    showOfflineVehicles = !showOfflineVehicles;
    saveSetting("showOfflineVehicles", showOfflineVehicles);
  },

  // Sidebar actions
  toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  },

  setSidebarOpen(open: boolean) {
    sidebarOpen = open;
  },

  // Demo simulation
  startDemoSimulation() {
    if (appMode === "demo") {
      demoSimulationActive = true;
    }
  },

  stopDemoSimulation() {
    demoSimulationActive = false;
  },

  // Notification actions
  addNotification(type: Notification["type"], title: string, message: string) {
    const notification: Notification = {
      id: nextNotificationId++,
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
    };
    notifications = [notification, ...notifications].slice(0, 50); // Max 50 bildirim

    // Ses çal (browser ortamında)
    if (soundEnabled && typeof window !== "undefined") {
      if (type === "success") {
        playSuccessSound();
      } else if (type === "info" || type === "warning" || type === "error") {
        playNotificationSound();
      }
    }

    return notification.id;
  },

  // Ses ayarları
  toggleSound() {
    soundEnabled = !soundEnabled;
  },

  setSoundEnabled(enabled: boolean) {
    soundEnabled = enabled;
  },

  markAsRead(id: number) {
    notifications = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
  },

  markAllAsRead() {
    notifications = notifications.map((n) => ({ ...n, read: true }));
  },

  removeNotification(id: number) {
    notifications = notifications.filter((n) => n.id !== id);
  },

  clearNotifications() {
    notifications = [];
  },
};
