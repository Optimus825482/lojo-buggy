/**
 * Traccar GPS Tracking Server Integration v6.11.1
 *
 * Bu modül Traccar sunucusu ile iletişim kurar:
 * - Session yönetimi (login/logout/token)
 * - Cihaz listesi çekme
 * - Konum bilgisi çekme (anlık ve geçmiş)
 * - Raporlar (trips, stops, summary, route)
 * - Geofence yönetimi
 * - WebSocket ile canlı konum takibi
 *
 * @see https://www.traccar.org/api-reference/
 */

import { env } from "$env/dynamic/private";

// Environment variables with defaults
const TRACCAR_URL = env.TRACCAR_URL || "https://traccar.optimistdemo.cloud";
const TRACCAR_USER = env.TRACCAR_USER || "admin";
const TRACCAR_PASSWORD = env.TRACCAR_PASSWORD || "admin";

// ============================================================================
// TYPES - Traccar API v6.11.1 Schema
// ============================================================================

export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: "online" | "offline" | "unknown";
  disabled: boolean;
  lastUpdate: string | null;
  positionId: number | null;
  groupId: number | null;
  phone: string | null;
  model: string | null;
  contact: string | null;
  category: string | null;
  attributes: Record<string, any>;
}

export interface TraccarPosition {
  id: number;
  deviceId: number;
  protocol: string;
  deviceTime: string;
  fixTime: string;
  serverTime: string;
  valid: boolean;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number; // knots (1 knot = 1.852 km/h)
  course: number; // 0-360 derece, 0 = kuzey
  address: string | null;
  accuracy: number; // metre
  network: Record<string, any>;
  geofenceIds?: number[];
  attributes: Record<string, any>;
}

export interface TraccarEvent {
  id: number;
  type: string;
  eventTime: string;
  deviceId: number;
  positionId: number;
  geofenceId: number | null;
  maintenanceId: number | null;
  attributes: Record<string, any>;
}

export interface TraccarGeofence {
  id: number;
  name: string;
  description: string | null;
  area: string; // WKT format: CIRCLE (lng lat, radius) or POLYGON (...)
  calendarId: number | null;
  attributes: Record<string, any>;
}

export interface TraccarGroup {
  id: number;
  name: string;
  groupId: number | null;
  attributes: Record<string, any>;
}

export interface TraccarServer {
  id: number;
  registration: boolean;
  readonly: boolean;
  deviceReadonly: boolean;
  limitCommands: boolean;
  map: string;
  bingKey: string;
  mapUrl: string;
  poiLayer: string;
  announcement: string;
  latitude: number;
  longitude: number;
  zoom: number;
  version: string;
  forceSettings: boolean;
  coordinateFormat: string;
  openIdEnabled: boolean;
  openIdForce: boolean;
  attributes: Record<string, any>;
}

export interface TraccarReportTrip {
  deviceId: number;
  deviceName: string;
  maxSpeed: number; // knots
  averageSpeed: number; // knots
  distance: number; // metre
  spentFuel: number; // litre
  duration: number; // saniye
  startTime: string;
  startAddress: string;
  startLat: number;
  startLon: number;
  endTime: string;
  endAddress: string;
  endLat: number;
  endLon: number;
  driverUniqueId?: string;
  driverName?: string;
}

export interface TraccarReportStop {
  deviceId: number;
  deviceName: string;
  duration: number; // saniye
  startTime: string;
  address: string;
  lat: number;
  lon: number;
  endTime: string;
  spentFuel: number;
  engineHours: number;
}

export interface TraccarReportSummary {
  deviceId: number;
  deviceName: string;
  maxSpeed: number; // knots
  averageSpeed: number; // knots
  distance: number; // metre
  spentFuel: number; // litre
  engineHours: number;
}

// ============================================================================
// SESSION & AUTH
// ============================================================================

// Session cookie storage (server-side)
let sessionCookie: string | null = null;

/**
 * Traccar sunucusuna login olur ve session cookie alır
 */
export async function traccarLogin(): Promise<boolean> {
  try {
    const response = await fetch(`${TRACCAR_URL}/api/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        email: TRACCAR_USER,
        password: TRACCAR_PASSWORD,
      }),
    });

    if (!response.ok) {
      console.error(
        "Traccar login failed:",
        response.status,
        response.statusText
      );
      return false;
    }

    // Session cookie'yi al
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      // JSESSIONID=xxx; Path=/; HttpOnly şeklinde geliyor
      const match = setCookie.match(/JSESSIONID=([^;]+)/);
      if (match) {
        sessionCookie = match[1];
        console.log("Traccar login successful");
        return true;
      }
    }

    // Cookie yoksa Basic Auth kullanacağız
    sessionCookie = null;
    console.log("Traccar login successful (no cookie, will use Basic Auth)");
    return true;
  } catch (error) {
    console.error("Traccar login error:", error);
    return false;
  }
}

/**
 * Traccar API'ye istek yapar (otomatik auth ile)
 */
async function traccarFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Session cookie varsa kullan, yoksa Basic Auth
  if (sessionCookie) {
    headers["Cookie"] = `JSESSIONID=${sessionCookie}`;
  } else {
    const auth = Buffer.from(`${TRACCAR_USER}:${TRACCAR_PASSWORD}`).toString(
      "base64"
    );
    headers["Authorization"] = `Basic ${auth}`;
  }

  const response = await fetch(`${TRACCAR_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // 401 alırsak yeniden login dene
  if (response.status === 401) {
    console.log("Traccar session expired, re-logging in...");
    const loggedIn = await traccarLogin();
    if (loggedIn) {
      // Yeniden dene
      if (sessionCookie) {
        headers["Cookie"] = `JSESSIONID=${sessionCookie}`;
      }
      return fetch(`${TRACCAR_URL}${endpoint}`, { ...options, headers });
    }
  }

  return response;
}

/**
 * Tüm cihazları listeler
 */
export async function getDevices(): Promise<TraccarDevice[]> {
  try {
    const response = await traccarFetch("/api/devices");
    if (!response.ok) {
      console.error("Failed to fetch devices:", response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching devices:", error);
    return [];
  }
}

/**
 * Belirli bir cihazı getirir
 */
export async function getDevice(
  deviceId: number
): Promise<TraccarDevice | null> {
  try {
    const response = await traccarFetch(`/api/devices?id=${deviceId}`);
    if (!response.ok) return null;
    const devices = await response.json();
    return devices[0] || null;
  } catch (error) {
    console.error("Error fetching device:", error);
    return null;
  }
}

/**
 * uniqueId ile cihaz bulur
 */
export async function getDeviceByUniqueId(
  uniqueId: string
): Promise<TraccarDevice | null> {
  try {
    const response = await traccarFetch(`/api/devices?uniqueId=${uniqueId}`);
    if (!response.ok) return null;
    const devices = await response.json();
    return devices[0] || null;
  } catch (error) {
    console.error("Error fetching device by uniqueId:", error);
    return null;
  }
}

/**
 * Tüm cihazların son konumlarını getirir
 */
export async function getPositions(): Promise<TraccarPosition[]> {
  try {
    const response = await traccarFetch("/api/positions");
    if (!response.ok) {
      console.error("Failed to fetch positions:", response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching positions:", error);
    return [];
  }
}

/**
 * Belirli bir cihazın son konumunu getirir
 */
export async function getDevicePosition(
  deviceId: number
): Promise<TraccarPosition | null> {
  try {
    const positions = await getPositions();
    return positions.find((p) => p.deviceId === deviceId) || null;
  } catch (error) {
    console.error("Error fetching device position:", error);
    return null;
  }
}

/**
 * Tüm geofence'leri listeler
 */
export async function getGeofences(): Promise<TraccarGeofence[]> {
  try {
    const response = await traccarFetch("/api/geofences");
    if (!response.ok) {
      console.error("Failed to fetch geofences:", response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching geofences:", error);
    return [];
  }
}

/**
 * Yeni geofence oluşturur
 */
export async function createGeofence(
  name: string,
  lat: number,
  lng: number,
  radius: number = 15
): Promise<TraccarGeofence | null> {
  try {
    // WKT CIRCLE format: CIRCLE (lng lat, radius)
    const area = `CIRCLE (${lng} ${lat}, ${radius})`;

    const response = await traccarFetch("/api/geofences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, area, attributes: {} }),
    });

    if (!response.ok) {
      console.error("Failed to create geofence:", response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Error creating geofence:", error);
    return null;
  }
}

/**
 * Geofence siler
 */
export async function deleteGeofence(geofenceId: number): Promise<boolean> {
  try {
    const response = await traccarFetch(`/api/geofences/${geofenceId}`, {
      method: "DELETE",
    });
    return response.status === 204;
  } catch (error) {
    console.error("Error deleting geofence:", error);
    return false;
  }
}

/**
 * Cihaza geofence bağlar
 */
export async function linkDeviceGeofence(
  deviceId: number,
  geofenceId: number
): Promise<boolean> {
  try {
    const response = await traccarFetch("/api/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, geofenceId }),
    });
    return response.status === 204 || response.ok;
  } catch (error) {
    console.error("Error linking device to geofence:", error);
    return false;
  }
}

/**
 * Cihazdan geofence bağlantısını kaldırır
 */
export async function unlinkDeviceGeofence(
  deviceId: number,
  geofenceId: number
): Promise<boolean> {
  try {
    const response = await traccarFetch("/api/permissions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, geofenceId }),
    });
    return response.status === 204 || response.ok;
  } catch (error) {
    console.error("Error unlinking device from geofence:", error);
    return false;
  }
}

/**
 * Knots'u km/h'ye çevirir
 * 1 knot = 1.852 km/h
 */
export function knotsToKmh(knots: number): number {
  return knots * 1.852;
}

/**
 * km/h'yi knots'a çevirir
 */
export function kmhToKnots(kmh: number): number {
  return kmh / 1.852;
}

/**
 * Metre'yi kilometre'ye çevirir
 */
export function metersToKm(meters: number): number {
  return meters / 1000;
}

/**
 * Saniyeyi dakikaya çevirir
 */
export function secondsToMinutes(seconds: number): number {
  return seconds / 60;
}

/**
 * Saniyeyi saat:dakika:saniye formatına çevirir
 */
export function secondsToHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`;
}

/**
 * WebSocket URL'ini döndürür (client-side kullanım için)
 */
export function getWebSocketUrl(): string {
  const wsProtocol = TRACCAR_URL.startsWith("https") ? "wss" : "ws";
  const baseUrl = TRACCAR_URL.replace(/^https?:\/\//, "");
  return `${wsProtocol}://${baseUrl}/api/socket`;
}

/**
 * WebSocket için Basic Auth header döndürür
 */
export function getWebSocketAuthHeader(): string {
  return Buffer.from(`${TRACCAR_USER}:${TRACCAR_PASSWORD}`).toString("base64");
}

/**
 * Traccar bağlantı durumunu kontrol eder
 */
export async function checkConnection(): Promise<{
  connected: boolean;
  serverInfo?: TraccarServer;
  version?: string;
  error?: string;
}> {
  try {
    // Önce health check (auth gerektirmez)
    const healthy = await healthCheck();
    if (!healthy) {
      return { connected: false, error: "Server health check failed" };
    }

    // Sonra server info (auth gerektirir)
    const response = await traccarFetch("/api/server");
    if (!response.ok) {
      return { connected: false, error: `HTTP ${response.status}` };
    }
    const serverInfo: TraccarServer = await response.json();
    return {
      connected: true,
      serverInfo,
      version: serverInfo.version,
    };
  } catch (error) {
    return { connected: false, error: String(error) };
  }
}

/**
 * Cihaz ve konum bilgilerini birleştirir
 */
export async function getDevicesWithPositions(): Promise<
  Array<TraccarDevice & { position?: TraccarPosition }>
> {
  const [devices, positions] = await Promise.all([
    getDevices(),
    getPositions(),
  ]);

  return devices.map((device) => {
    const position = positions.find((p) => p.deviceId === device.id);
    return { ...device, position };
  });
}

// ============================================================================
// REPORTS - Raporlama API'leri
// ============================================================================

/**
 * Belirli bir cihazın geçmiş konumlarını getirir (Route Report)
 * @param deviceId Cihaz ID
 * @param from Başlangıç tarihi (ISO 8601)
 * @param to Bitiş tarihi (ISO 8601)
 */
export async function getRouteReport(
  deviceId: number,
  from: Date,
  to: Date
): Promise<TraccarPosition[]> {
  try {
    const fromISO = from.toISOString();
    const toISO = to.toISOString();
    const response = await traccarFetch(
      `/api/reports/route?deviceId=${deviceId}&from=${encodeURIComponent(
        fromISO
      )}&to=${encodeURIComponent(toISO)}`
    );
    if (!response.ok) {
      console.error("Failed to fetch route report:", response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching route report:", error);
    return [];
  }
}

/**
 * Belirli bir cihazın seyahat raporunu getirir
 * @param deviceId Cihaz ID
 * @param from Başlangıç tarihi
 * @param to Bitiş tarihi
 */
export async function getTripsReport(
  deviceId: number,
  from: Date,
  to: Date
): Promise<TraccarReportTrip[]> {
  try {
    const fromISO = from.toISOString();
    const toISO = to.toISOString();
    const response = await traccarFetch(
      `/api/reports/trips?deviceId=${deviceId}&from=${encodeURIComponent(
        fromISO
      )}&to=${encodeURIComponent(toISO)}`
    );
    if (!response.ok) {
      console.error("Failed to fetch trips report:", response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching trips report:", error);
    return [];
  }
}

/**
 * Belirli bir cihazın durak raporunu getirir
 * @param deviceId Cihaz ID
 * @param from Başlangıç tarihi
 * @param to Bitiş tarihi
 */
export async function getStopsReport(
  deviceId: number,
  from: Date,
  to: Date
): Promise<TraccarReportStop[]> {
  try {
    const fromISO = from.toISOString();
    const toISO = to.toISOString();
    const response = await traccarFetch(
      `/api/reports/stops?deviceId=${deviceId}&from=${encodeURIComponent(
        fromISO
      )}&to=${encodeURIComponent(toISO)}`
    );
    if (!response.ok) {
      console.error("Failed to fetch stops report:", response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching stops report:", error);
    return [];
  }
}

/**
 * Belirli bir cihazın özet raporunu getirir
 * @param deviceId Cihaz ID
 * @param from Başlangıç tarihi
 * @param to Bitiş tarihi
 */
export async function getSummaryReport(
  deviceId: number,
  from: Date,
  to: Date
): Promise<TraccarReportSummary[]> {
  try {
    const fromISO = from.toISOString();
    const toISO = to.toISOString();
    const response = await traccarFetch(
      `/api/reports/summary?deviceId=${deviceId}&from=${encodeURIComponent(
        fromISO
      )}&to=${encodeURIComponent(toISO)}`
    );
    if (!response.ok) {
      console.error("Failed to fetch summary report:", response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching summary report:", error);
    return [];
  }
}

/**
 * Belirli bir cihazın event raporunu getirir
 * @param deviceId Cihaz ID
 * @param from Başlangıç tarihi
 * @param to Bitiş tarihi
 * @param types Event tipleri (opsiyonel, % = tümü)
 */
export async function getEventsReport(
  deviceId: number,
  from: Date,
  to: Date,
  types?: string[]
): Promise<TraccarEvent[]> {
  try {
    const fromISO = from.toISOString();
    const toISO = to.toISOString();
    let url = `/api/reports/events?deviceId=${deviceId}&from=${encodeURIComponent(
      fromISO
    )}&to=${encodeURIComponent(toISO)}`;
    if (types && types.length > 0) {
      url += `&type=${types.join(",")}`;
    }
    const response = await traccarFetch(url);
    if (!response.ok) {
      console.error("Failed to fetch events report:", response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching events report:", error);
    return [];
  }
}

// ============================================================================
// GROUPS - Grup Yönetimi
// ============================================================================

/**
 * Tüm grupları listeler
 */
export async function getGroups(): Promise<TraccarGroup[]> {
  try {
    const response = await traccarFetch("/api/groups");
    if (!response.ok) {
      console.error("Failed to fetch groups:", response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching groups:", error);
    return [];
  }
}

/**
 * Yeni grup oluşturur
 */
export async function createGroup(
  name: string,
  groupId?: number
): Promise<TraccarGroup | null> {
  try {
    const response = await traccarFetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, groupId: groupId || null, attributes: {} }),
    });
    if (!response.ok) {
      console.error("Failed to create group:", response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Error creating group:", error);
    return null;
  }
}

// ============================================================================
// POSITIONS - Geçmiş Konum Sorgulama
// ============================================================================

/**
 * Belirli bir cihazın geçmiş konumlarını getirir
 * NOT: Bu endpoint /api/positions kullanır, /api/reports/route'dan farklı
 * @param deviceId Cihaz ID
 * @param from Başlangıç tarihi
 * @param to Bitiş tarihi
 */
export async function getHistoricalPositions(
  deviceId: number,
  from: Date,
  to: Date
): Promise<TraccarPosition[]> {
  try {
    const fromISO = from.toISOString();
    const toISO = to.toISOString();
    const response = await traccarFetch(
      `/api/positions?deviceId=${deviceId}&from=${encodeURIComponent(
        fromISO
      )}&to=${encodeURIComponent(toISO)}`
    );
    if (!response.ok) {
      console.error("Failed to fetch historical positions:", response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching historical positions:", error);
    return [];
  }
}

/**
 * Belirli position ID'leri ile konum getirir
 * @param ids Position ID listesi
 */
export async function getPositionsByIds(
  ids: number[]
): Promise<TraccarPosition[]> {
  try {
    const idParams = ids.map((id) => `id=${id}`).join("&");
    const response = await traccarFetch(`/api/positions?${idParams}`);
    if (!response.ok) {
      console.error("Failed to fetch positions by ids:", response.status);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching positions by ids:", error);
    return [];
  }
}

// ============================================================================
// SERVER INFO
// ============================================================================

/**
 * Sunucu bilgilerini getirir
 */
export async function getServerInfo(): Promise<TraccarServer | null> {
  try {
    const response = await traccarFetch("/api/server");
    if (!response.ok) {
      console.error("Failed to fetch server info:", response.status);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching server info:", error);
    return null;
  }
}

/**
 * Sunucu sağlık kontrolü (auth gerektirmez)
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${TRACCAR_URL}/api/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}
