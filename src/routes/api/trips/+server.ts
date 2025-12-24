/**
 * Trips API
 *
 * GET /api/trips - Trip listesini getirir
 * GET /api/trips?vehicleId=X - Araç bazlı trip'leri getirir
 * GET /api/trips?active=true - Aktif trip'leri getirir
 * POST /api/trips/sync - Traccar'dan trip'leri senkronize eder
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import {
  getAllActiveTrips,
  getVehicleTrips,
  getTripsByDateRange,
  getTripSummary,
  syncTraccarTrips,
} from "$lib/server/trip-detection";

export const GET: RequestHandler = async ({ url }) => {
  try {
    const vehicleId = url.searchParams.get("vehicleId");
    const active = url.searchParams.get("active");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    let trips: schema.Trip[];

    // Aktif trip'ler
    if (active === "true") {
      trips = await getAllActiveTrips();
    }
    // Araç bazlı
    else if (vehicleId) {
      trips = await getVehicleTrips(parseInt(vehicleId), limit);
    }
    // Tarih aralığı
    else if (from && to) {
      trips = await getTripsByDateRange(
        new Date(from),
        new Date(to),
        vehicleId ? parseInt(vehicleId) : undefined
      );
    }
    // Tümü
    else {
      trips = await db
        .select()
        .from(schema.trips)
        .orderBy(desc(schema.trips.startTime))
        .limit(limit);
    }

    // Araç bilgilerini ekle
    const vehicles = await db.select().from(schema.vehicles);
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

    const stops = await db.select().from(schema.stops);
    const stopMap = new Map(stops.map((s) => [s.id, s]));

    const enrichedTrips = trips.map((t) => ({
      ...t,
      vehicle: vehicleMap.get(t.vehicleId),
      startStop: t.startStopId ? stopMap.get(t.startStopId) : null,
      endStop: t.endStopId ? stopMap.get(t.endStopId) : null,
      distanceKm: Math.round(((t.distance || 0) / 1000) * 100) / 100,
      durationMin: Math.round((t.duration || 0) / 60),
    }));

    // Özet istatistikler
    let summary = null;
    if (from && to) {
      summary = await getTripSummary(
        new Date(from),
        new Date(to),
        vehicleId ? parseInt(vehicleId) : undefined
      );
    }

    return json({
      success: true,
      data: {
        trips: enrichedTrips,
        summary,
        total: trips.length,
      },
    });
  } catch (error) {
    console.error("Trips fetch error:", error);
    return json({ success: false, message: String(error) }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ url }) => {
  const action = url.searchParams.get("action");

  try {
    // Traccar senkronizasyonu
    if (action === "sync") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");

      const fromDate = from
        ? new Date(from)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const toDate = to ? new Date(to) : new Date();

      const result = await syncTraccarTrips(fromDate, toDate);

      return json({
        success: true,
        message: `${result.synced} trip senkronize edildi`,
        data: result,
      });
    }

    return json(
      { success: false, message: "Geçersiz action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Trips action error:", error);
    return json({ success: false, message: String(error) }, { status: 500 });
  }
};
