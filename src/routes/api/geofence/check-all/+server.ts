// ============================================
// GEOFENCE CHECK ALL API - Tüm Duraklar İçin Geofence Kontrolü
// POST: Araç konumunu tüm duraklarla karşılaştır
// ============================================

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import * as db from "$lib/server/db";
import { calculateDistance } from "$lib/utils/geo";

// POST - Tüm duraklar için geofence kontrolü
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    // Validasyon
    if (!body.vehicleId || body.lat === undefined || body.lng === undefined) {
      return error(400, "vehicleId, lat ve lng zorunludur");
    }

    const vehicleId = parseInt(body.vehicleId);
    const lat = parseFloat(body.lat);
    const lng = parseFloat(body.lng);

    // Araç var mı kontrol et
    const vehicle = await db.getVehicleById(vehicleId);
    if (!vehicle) {
      return error(404, "Araç bulunamadı");
    }

    // Araç konumunu güncelle
    await db.updateVehiclePosition(
      vehicleId,
      lat,
      lng,
      body.speed ?? 0,
      body.heading ?? 0
    );

    // Tüm aktif durakları al
    const stops = await db.getAllStops(true);

    // Her durak için mesafe hesapla ve geofence kontrolü yap
    const results: Array<{
      stopId: number;
      stopName: string;
      distance: number;
      isInside: boolean;
      eventCreated: boolean;
    }> = [];

    let enteredStop: { id: number; name: string } | null = null;

    for (const stop of stops) {
      const distance = calculateDistance(
        { lat, lng },
        { lat: stop.lat, lng: stop.lng }
      );

      const geofenceRadius = stop.geofenceRadius || 15;
      const isInside = distance <= geofenceRadius;

      let eventCreated = false;

      if (isInside) {
        // Son event'i kontrol et
        const lastEvent = await db.getLastGeofenceEvent(vehicleId, stop.id);
        const shouldTrigger =
          !lastEvent ||
          lastEvent.type === "exit" ||
          Date.now() - new Date(lastEvent.timestamp).getTime() > 60000;

        if (shouldTrigger) {
          // Enter event kaydet
          await db.createGeofenceEvent({
            vehicleId,
            stopId: stop.id,
            type: "enter",
            distance,
          });
          eventCreated = true;
          enteredStop = { id: stop.id, name: stop.name };
        }
      }

      results.push({
        stopId: stop.id,
        stopName: stop.name,
        distance: Math.round(distance),
        isInside,
        eventCreated,
      });
    }

    // En yakın durağı bul
    const nearestStop = results.reduce((prev, curr) =>
      prev.distance < curr.distance ? prev : curr
    );

    return json({
      success: true,
      data: {
        vehicleId,
        position: { lat, lng },
        enteredStop,
        nearestStop: {
          id: nearestStop.stopId,
          name: nearestStop.stopName,
          distance: nearestStop.distance,
          isInside: nearestStop.isInside,
        },
        stopsChecked: results.length,
        stopsInside: results.filter((r) => r.isInside).length,
      },
    });
  } catch (err) {
    console.error("Geofence check-all error:", err);
    return error(500, "Geofence kontrolü sırasında hata oluştu");
  }
};
