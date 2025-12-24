/**
 * Traccar Real-time Stream API (Server-Sent Events)
 *
 * GET /api/traccar/stream - Traccar WebSocket'ten gelen verileri SSE olarak yayınlar
 *
 * Bu endpoint:
 * 1. Traccar WebSocket'e bağlanır
 * 2. Gelen position/device güncellemelerini SSE olarak client'a iletir
 * 3. Veritabanını otomatik günceller
 */

import { env } from "$env/dynamic/private";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { fullCorrection, correctHeading } from "$lib/server/gps-correction";
import { calculateDistance } from "$lib/utils/geo";
import { knotsToKmh } from "$lib/server/traccar";
import {
  startTrip,
  endTrip,
  updateTripStats,
} from "$lib/server/trip-detection";

const TRACCAR_URL = env.TRACCAR_URL || "https://traccar.optimistdemo.cloud";
const TRACCAR_USER = env.TRACCAR_USER || "admin";
const TRACCAR_PASSWORD = env.TRACCAR_PASSWORD || "admin";

interface TraccarWSMessage {
  devices?: Array<{
    id: number;
    name: string;
    status: string;
    lastUpdate: string;
  }>;
  positions?: Array<{
    id: number;
    deviceId: number;
    latitude: number;
    longitude: number;
    speed: number;
    course: number;
    valid: boolean;
    serverTime: string;
    attributes: Record<string, any>;
  }>;
  events?: Array<{
    id: number;
    type: string;
    deviceId: number;
    positionId: number;
    geofenceId?: number;
  }>;
}

export const GET: RequestHandler = async ({ request }) => {
  const encoder = new TextEncoder();

  // SSE stream oluştur
  const stream = new ReadableStream({
    async start(controller) {
      // WebSocket URL oluştur
      const wsProtocol = TRACCAR_URL.startsWith("https") ? "wss" : "ws";
      const baseUrl = TRACCAR_URL.replace(/^https?:\/\//, "");
      const wsUrl = `${wsProtocol}://${baseUrl}/api/socket`;

      // Basic Auth header
      const auth = Buffer.from(`${TRACCAR_USER}:${TRACCAR_PASSWORD}`).toString(
        "base64"
      );

      let ws: WebSocket | null = null;
      let pingInterval: ReturnType<typeof setInterval> | null = null;
      let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
      let isClosing = false;

      // Durakları çek (GPS düzeltme için)
      const stops = await db.select().from(schema.stops);
      const stopsForCorrection = stops.map((s) => ({
        id: s.id,
        lng: s.lng,
        lat: s.lat,
        name: s.name,
      }));

      // Araç-Traccar ID eşleştirmesini çek
      const vehicles = await db.select().from(schema.vehicles);
      const vehicleMap = new Map(
        vehicles.filter((v) => v.traccarId).map((v) => [v.traccarId!, v])
      );

      function sendSSE(event: string, data: any) {
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (e) {
          // Stream kapalı olabilir
        }
      }

      function connect() {
        if (isClosing) return;

        try {
          // Node.js WebSocket kullan (ws paketi)
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const WebSocket = require("ws");

          ws = new WebSocket(wsUrl, {
            headers: {
              Authorization: `Basic ${auth}`,
            },
          }) as globalThis.WebSocket;

          ws.onopen = () => {
            console.log("[Traccar WS] Connected");
            sendSSE("connected", {
              status: "connected",
              timestamp: new Date().toISOString(),
            });

            // Ping interval başlat
            pingInterval = setInterval(() => {
              if (ws?.readyState === 1) {
                // OPEN
                sendSSE("ping", { timestamp: new Date().toISOString() });
              }
            }, 30000);
          };

          ws.onmessage = async (event: MessageEvent) => {
            try {
              const data: TraccarWSMessage = JSON.parse(event.data.toString());

              // Position güncellemesi
              if (data.positions && data.positions.length > 0) {
                for (const position of data.positions) {
                  if (!position.valid) continue;

                  const vehicle = vehicleMap.get(position.deviceId);
                  if (!vehicle) continue;

                  // GPS Düzeltme
                  let finalLat = position.latitude;
                  let finalLng = position.longitude;
                  let finalHeading = position.course;

                  const correction = fullCorrection(
                    position.longitude,
                    position.latitude,
                    stopsForCorrection,
                    { stopSnapRadius: 15, routeMaxDistance: 40 }
                  );

                  finalLat = correction.lat;
                  finalLng = correction.lng;

                  if (correction.correctionType !== "none") {
                    finalHeading = correctHeading(
                      finalLng,
                      finalLat,
                      position.course
                    );
                  }

                  // En yakın durağı bul
                  let nearestStopId: number | null = null;
                  let nearestStopDistance = Infinity;

                  for (const stop of stops) {
                    const distance = calculateDistance(
                      { lat: finalLat, lng: finalLng },
                      { lat: stop.lat, lng: stop.lng }
                    );
                    const geofenceRadius = stop.geofenceRadius || 15;

                    if (
                      distance <= geofenceRadius &&
                      distance < nearestStopDistance
                    ) {
                      nearestStopId = stop.id;
                      nearestStopDistance = distance;
                    }
                  }

                  // Veritabanını güncelle
                  await db
                    .update(schema.vehicles)
                    .set({
                      lat: finalLat,
                      lng: finalLng,
                      speed: knotsToKmh(position.speed),
                      heading: finalHeading,
                      gpsSignal: true,
                      lastUpdate: new Date(position.serverTime),
                      lastTraccarUpdate: new Date(),
                      lastGeofenceStopId: nearestStopId,
                      updatedAt: new Date(),
                    })
                    .where(eq(schema.vehicles.id, vehicle.id));

                  // Trip istatistiklerini güncelle (aktif trip varsa)
                  await updateTripStats(
                    vehicle.id,
                    knotsToKmh(position.speed),
                    finalLat,
                    finalLng
                  );

                  // SSE ile client'a gönder
                  sendSSE("position", {
                    vehicleId: vehicle.id,
                    vehicleName: vehicle.name,
                    lat: finalLat,
                    lng: finalLng,
                    speed: knotsToKmh(position.speed),
                    heading: finalHeading,
                    nearestStopId,
                    timestamp: position.serverTime,
                  });
                }
              }

              // Device status güncellemesi
              if (data.devices && data.devices.length > 0) {
                for (const device of data.devices) {
                  const vehicle = vehicleMap.get(device.id);
                  if (!vehicle) continue;

                  // Güncel araç durumunu veritabanından çek
                  const [currentVehicle] = await db
                    .select()
                    .from(schema.vehicles)
                    .where(eq(schema.vehicles.id, vehicle.id));

                  if (!currentVehicle) continue;

                  // Durum belirleme mantığı:
                  // - Cihaz online ve araç offline ise → available yap
                  // - Cihaz offline ise → offline yap
                  // - Diğer durumlarda mevcut durumu koru (busy, maintenance vb.)
                  let newStatus = currentVehicle.status;

                  if (device.status === "online") {
                    // Cihaz çevrimiçi oldu
                    if (currentVehicle.status === "offline") {
                      newStatus = "available";
                    }
                    // busy veya maintenance ise değiştirme
                  } else {
                    // Cihaz çevrimdışı oldu
                    newStatus = "offline";
                  }

                  await db
                    .update(schema.vehicles)
                    .set({
                      status: newStatus,
                      gpsSignal: device.status === "online",
                      updatedAt: new Date(),
                    })
                    .where(eq(schema.vehicles.id, vehicle.id));

                  // vehicleMap'i de güncelle (sonraki güncellemeler için)
                  vehicleMap.set(device.id, {
                    ...currentVehicle,
                    status: newStatus,
                  });

                  sendSSE("device", {
                    vehicleId: vehicle.id,
                    vehicleName: vehicle.name,
                    status: newStatus,
                    deviceStatus: device.status,
                    previousStatus: currentVehicle.status,
                  });
                }
              }

              // Event güncellemesi (geofence enter/exit vb.)
              if (data.events && data.events.length > 0) {
                for (const event of data.events) {
                  const vehicle = vehicleMap.get(event.deviceId);
                  if (!vehicle) continue;

                  // Geofence event'lerini işle
                  if (
                    event.geofenceId &&
                    (event.type === "geofenceEnter" ||
                      event.type === "geofenceExit")
                  ) {
                    const eventType =
                      event.type === "geofenceEnter" ? "enter" : "exit";

                    // Geofence event'ini veritabanına kaydet
                    // NOT: Traccar geofence ID'si ile Buggy Shuttle stop ID'si farklı
                    // Bu yüzden şimdilik sadece SSE ile client'a gönderiyoruz

                    sendSSE("geofence", {
                      vehicleId: vehicle.id,
                      vehicleName: vehicle.name,
                      type: eventType,
                      traccarGeofenceId: event.geofenceId,
                      eventType: event.type,
                      timestamp: new Date().toISOString(),
                    });

                    console.log(
                      `[Traccar Event] ${vehicle.name} - ${event.type} - Geofence: ${event.geofenceId}`
                    );
                  }

                  // Diğer event tipleri
                  if (
                    event.type === "deviceMoving" ||
                    event.type === "deviceStopped"
                  ) {
                    // Trip Detection (Phase 2)
                    const [currentVehicle] = await db
                      .select()
                      .from(schema.vehicles)
                      .where(eq(schema.vehicles.id, vehicle.id));

                    if (currentVehicle) {
                      if (event.type === "deviceMoving") {
                        // Trip başlat
                        const tripId = await startTrip({
                          vehicleId: vehicle.id,
                          lat: currentVehicle.lat,
                          lng: currentVehicle.lng,
                          timestamp: new Date(),
                          stopId:
                            currentVehicle.lastGeofenceStopId || undefined,
                        });
                        console.log(
                          `[Trip] Started trip ${tripId} for ${vehicle.name}`
                        );
                      } else {
                        // Trip bitir
                        await endTrip({
                          vehicleId: vehicle.id,
                          lat: currentVehicle.lat,
                          lng: currentVehicle.lng,
                          timestamp: new Date(),
                          stopId:
                            currentVehicle.lastGeofenceStopId || undefined,
                        });
                        console.log(`[Trip] Ended trip for ${vehicle.name}`);
                      }
                    }

                    sendSSE("movement", {
                      vehicleId: vehicle.id,
                      vehicleName: vehicle.name,
                      type: event.type,
                      isMoving: event.type === "deviceMoving",
                      timestamp: new Date().toISOString(),
                    });
                  }

                  if (
                    event.type === "deviceOnline" ||
                    event.type === "deviceOffline"
                  ) {
                    sendSSE("connection", {
                      vehicleId: vehicle.id,
                      vehicleName: vehicle.name,
                      type: event.type,
                      isOnline: event.type === "deviceOnline",
                      timestamp: new Date().toISOString(),
                    });
                  }

                  // Genel event (tüm event tipleri için)
                  sendSSE("event", {
                    vehicleId: vehicle.id,
                    vehicleName: vehicle.name,
                    type: event.type,
                    geofenceId: event.geofenceId,
                    positionId: event.positionId,
                    timestamp: new Date().toISOString(),
                  });
                }
              }
            } catch (e) {
              console.error("[Traccar WS] Parse error:", e);
            }
          };

          ws.onerror = (error: Event) => {
            console.error("[Traccar WS] Error:", error);
            sendSSE("error", { message: "WebSocket error" });
          };

          ws.onclose = () => {
            console.log("[Traccar WS] Disconnected");
            if (pingInterval) clearInterval(pingInterval);

            if (!isClosing) {
              sendSSE("disconnected", { status: "disconnected" });
              // 5 saniye sonra yeniden bağlan
              reconnectTimeout = setTimeout(connect, 5000);
            }
          };
        } catch (e) {
          console.error("[Traccar WS] Connection error:", e);
          sendSSE("error", { message: "Connection failed" });

          if (!isClosing) {
            reconnectTimeout = setTimeout(connect, 5000);
          }
        }
      }

      // İlk bağlantı
      connect();

      // Client bağlantısı kesildiğinde temizlik
      request.signal.addEventListener("abort", () => {
        isClosing = true;
        if (pingInterval) clearInterval(pingInterval);
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        if (ws) {
          ws.close();
        }
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Nginx buffering'i kapat
    },
  });
};
