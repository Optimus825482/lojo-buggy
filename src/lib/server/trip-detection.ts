/**
 * Trip Detection Service (Phase 2)
 *
 * Bu modül:
 * - Traccar deviceMoving/deviceStopped event'lerini işler
 * - Otomatik trip başlatma/bitirme yapar
 * - Trip istatistiklerini hesaplar
 * - Traccar trip raporlarını senkronize eder
 */

import { db } from "./db";
import * as schema from "./db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import * as traccar from "./traccar";

// ============================================================================
// TYPES
// ============================================================================

export interface TripStartEvent {
  vehicleId: number;
  lat: number;
  lng: number;
  timestamp: Date;
  stopId?: number;
}

export interface TripEndEvent {
  vehicleId: number;
  lat: number;
  lng: number;
  timestamp: Date;
  stopId?: number;
  distance?: number;
  maxSpeed?: number;
  avgSpeed?: number;
}

export interface ActiveTrip {
  id: number;
  vehicleId: number;
  startTime: Date;
  startLat: number;
  startLng: number;
  startStopId: number | null;
  currentDistance: number;
  currentMaxSpeed: number;
  positionCount: number;
}

// ============================================================================
// TRIP MANAGEMENT
// ============================================================================

/**
 * Yeni trip başlatır (deviceMoving event'i geldiğinde)
 */
export async function startTrip(event: TripStartEvent): Promise<number | null> {
  try {
    // Bu araç için aktif trip var mı kontrol et
    const [existingTrip] = await db
      .select()
      .from(schema.trips)
      .where(
        and(
          eq(schema.trips.vehicleId, event.vehicleId),
          eq(schema.trips.status, "active")
        )
      )
      .limit(1);

    if (existingTrip) {
      console.log(
        `[Trip] Vehicle ${event.vehicleId} already has active trip ${existingTrip.id}`
      );
      return existingTrip.id;
    }

    // Yeni trip oluştur
    const [trip] = await db
      .insert(schema.trips)
      .values({
        vehicleId: event.vehicleId,
        status: "active",
        startTime: event.timestamp,
        startLat: event.lat,
        startLng: event.lng,
        startStopId: event.stopId || null,
        distance: 0,
        maxSpeed: 0,
        avgSpeed: 0,
        duration: 0,
      })
      .returning();

    console.log(
      `[Trip] Started trip ${trip.id} for vehicle ${event.vehicleId}`
    );
    return trip.id;
  } catch (error) {
    console.error("[Trip] Error starting trip:", error);
    return null;
  }
}

/**
 * Trip'i bitirir (deviceStopped event'i geldiğinde)
 */
export async function endTrip(event: TripEndEvent): Promise<boolean> {
  try {
    // Aktif trip'i bul
    const [activeTrip] = await db
      .select()
      .from(schema.trips)
      .where(
        and(
          eq(schema.trips.vehicleId, event.vehicleId),
          eq(schema.trips.status, "active")
        )
      )
      .limit(1);

    if (!activeTrip) {
      console.log(`[Trip] No active trip found for vehicle ${event.vehicleId}`);
      return false;
    }

    // Süreyi hesapla
    const duration = Math.floor(
      (event.timestamp.getTime() - new Date(activeTrip.startTime).getTime()) /
        1000
    );

    // Trip'i güncelle
    await db
      .update(schema.trips)
      .set({
        status: "completed",
        endTime: event.timestamp,
        endLat: event.lat,
        endLng: event.lng,
        endStopId: event.stopId || null,
        distance: event.distance || activeTrip.distance || 0,
        maxSpeed: event.maxSpeed || activeTrip.maxSpeed || 0,
        avgSpeed: event.avgSpeed || activeTrip.avgSpeed || 0,
        duration,
        updatedAt: new Date(),
      })
      .where(eq(schema.trips.id, activeTrip.id));

    console.log(
      `[Trip] Ended trip ${activeTrip.id} for vehicle ${event.vehicleId}, duration: ${duration}s`
    );
    return true;
  } catch (error) {
    console.error("[Trip] Error ending trip:", error);
    return false;
  }
}

/**
 * Trip istatistiklerini günceller (konum güncellemesi geldiğinde)
 */
export async function updateTripStats(
  vehicleId: number,
  speed: number,
  lat: number,
  lng: number
): Promise<void> {
  try {
    // Aktif trip'i bul
    const [activeTrip] = await db
      .select()
      .from(schema.trips)
      .where(
        and(
          eq(schema.trips.vehicleId, vehicleId),
          eq(schema.trips.status, "active")
        )
      )
      .limit(1);

    if (!activeTrip) return;

    // Max speed güncelle
    const newMaxSpeed = Math.max(activeTrip.maxSpeed || 0, speed);

    // Mesafe hesapla (önceki konumdan)
    const distance = calculateDistance(
      activeTrip.endLat || activeTrip.startLat,
      activeTrip.endLng || activeTrip.startLng,
      lat,
      lng
    );

    const newDistance = (activeTrip.distance || 0) + distance;

    // Süre hesapla
    const duration = Math.floor(
      (Date.now() - new Date(activeTrip.startTime).getTime()) / 1000
    );

    // Ortalama hız hesapla
    const avgSpeed = duration > 0 ? newDistance / 1000 / (duration / 3600) : 0;

    await db
      .update(schema.trips)
      .set({
        distance: newDistance,
        maxSpeed: newMaxSpeed,
        avgSpeed: Math.round(avgSpeed * 10) / 10,
        duration,
        endLat: lat,
        endLng: lng,
        updatedAt: new Date(),
      })
      .where(eq(schema.trips.id, activeTrip.id));
  } catch (error) {
    console.error("[Trip] Error updating trip stats:", error);
  }
}

/**
 * Araç için aktif trip'i getirir
 */
export async function getActiveTrip(
  vehicleId: number
): Promise<schema.Trip | null> {
  const [trip] = await db
    .select()
    .from(schema.trips)
    .where(
      and(
        eq(schema.trips.vehicleId, vehicleId),
        eq(schema.trips.status, "active")
      )
    )
    .limit(1);

  return trip || null;
}

/**
 * Tüm aktif trip'leri getirir
 */
export async function getAllActiveTrips(): Promise<schema.Trip[]> {
  return db
    .select()
    .from(schema.trips)
    .where(eq(schema.trips.status, "active"));
}

/**
 * Araç için son trip'leri getirir
 */
export async function getVehicleTrips(
  vehicleId: number,
  limit = 20
): Promise<schema.Trip[]> {
  return db
    .select()
    .from(schema.trips)
    .where(eq(schema.trips.vehicleId, vehicleId))
    .orderBy(desc(schema.trips.startTime))
    .limit(limit);
}

/**
 * Belirli tarih aralığındaki trip'leri getirir
 */
export async function getTripsByDateRange(
  from: Date,
  to: Date,
  vehicleId?: number
): Promise<schema.Trip[]> {
  const conditions = [
    schema.trips.startTime >= from,
    schema.trips.startTime <= to,
  ];

  if (vehicleId) {
    conditions.push(eq(schema.trips.vehicleId, vehicleId) as any);
  }

  return db
    .select()
    .from(schema.trips)
    .where(and(...(conditions as any)))
    .orderBy(desc(schema.trips.startTime));
}

// ============================================================================
// TRACCAR SYNC
// ============================================================================

/**
 * Traccar'dan trip raporlarını senkronize eder
 */
export async function syncTraccarTrips(
  from: Date,
  to: Date
): Promise<{ synced: number; errors: string[] }> {
  const result = { synced: 0, errors: [] as string[] };

  try {
    // Traccar'a bağlı araçları çek
    const vehicles = await db
      .select()
      .from(schema.vehicles)
      .where(isNull(schema.vehicles.traccarId).not());

    for (const vehicle of vehicles) {
      if (!vehicle.traccarId) continue;

      try {
        // Traccar'dan trip'leri çek
        const traccarTrips = await traccar.getTripsReport(
          vehicle.traccarId,
          from,
          to
        );

        for (const tt of traccarTrips) {
          // Bu trip zaten var mı kontrol et
          const [existing] = await db
            .select()
            .from(schema.trips)
            .where(
              eq(
                schema.trips.traccarTripId,
                tt.deviceId * 1000000 +
                  (new Date(tt.startTime).getTime() % 1000000)
              )
            )
            .limit(1);

          if (existing) continue;

          // Yeni trip oluştur
          await db.insert(schema.trips).values({
            vehicleId: vehicle.id,
            status: "completed",
            startTime: new Date(tt.startTime),
            endTime: new Date(tt.endTime),
            startLat: tt.startLat,
            startLng: tt.startLon,
            endLat: tt.endLat,
            endLng: tt.endLon,
            distance: tt.distance,
            maxSpeed: traccar.knotsToKmh(tt.maxSpeed),
            avgSpeed: traccar.knotsToKmh(tt.averageSpeed),
            duration: tt.duration,
            traccarTripId:
              tt.deviceId * 1000000 +
              (new Date(tt.startTime).getTime() % 1000000),
          });

          result.synced++;
        }
      } catch (error) {
        result.errors.push(`Vehicle ${vehicle.name}: ${String(error)}`);
      }
    }
  } catch (error) {
    result.errors.push(`General error: ${String(error)}`);
  }

  return result;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * İki koordinat arasındaki mesafeyi hesaplar (metre)
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Dünya yarıçapı (metre)
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Trip özet istatistiklerini hesaplar
 */
export async function getTripSummary(
  from: Date,
  to: Date,
  vehicleId?: number
): Promise<{
  totalTrips: number;
  totalDistance: number;
  totalDuration: number;
  avgSpeed: number;
  maxSpeed: number;
}> {
  const trips = await getTripsByDateRange(from, to, vehicleId);

  const totalDistance = trips.reduce((sum, t) => sum + (t.distance || 0), 0);
  const totalDuration = trips.reduce((sum, t) => sum + (t.duration || 0), 0);
  const avgSpeed =
    trips.length > 0
      ? trips.reduce((sum, t) => sum + (t.avgSpeed || 0), 0) / trips.length
      : 0;
  const maxSpeed = Math.max(...trips.map((t) => t.maxSpeed || 0), 0);

  return {
    totalTrips: trips.length,
    totalDistance: Math.round((totalDistance / 1000) * 100) / 100, // km
    totalDuration: Math.round(totalDuration / 60), // dakika
    avgSpeed: Math.round(avgSpeed * 10) / 10,
    maxSpeed: Math.round(maxSpeed * 10) / 10,
  };
}
