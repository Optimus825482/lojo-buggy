/**
 * Traccar Sync API
 *
 * POST /api/traccar/sync - Traccar'dan konum verilerini çeker ve veritabanını günceller
 * POST /api/traccar/sync?action=link - Araç-cihaz eşleştirmesi yapar
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import * as traccar from "$lib/server/traccar";
import * as dbFunctions from "$lib/server/db";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import { fullCorrection, correctHeading } from "$lib/server/gps-correction";
import { calculateDistance } from "$lib/utils/geo";

export const POST: RequestHandler = async ({ request, url }) => {
  const action = url.searchParams.get("action");
  const snapToRoute = url.searchParams.get("snap") !== "false"; // Varsayılan: true

  try {
    switch (action) {
      case "link": {
        // Araç-cihaz eşleştirmesi
        const body = await request.json();
        const { vehicleId, traccarDeviceId } = body;

        if (!vehicleId || !traccarDeviceId) {
          return json(
            { success: false, message: "vehicleId ve traccarDeviceId gerekli" },
            { status: 400 }
          );
        }

        // Traccar'da cihaz var mı kontrol et
        const device = await traccar.getDevice(traccarDeviceId);
        if (!device) {
          return json(
            { success: false, message: "Traccar cihazı bulunamadı" },
            { status: 404 }
          );
        }

        // Veritabanında aracı güncelle
        const [updated] = await db
          .update(schema.vehicles)
          .set({ traccarId: traccarDeviceId, updatedAt: new Date() })
          .where(eq(schema.vehicles.id, vehicleId))
          .returning();

        if (!updated) {
          return json(
            { success: false, message: "Araç bulunamadı" },
            { status: 404 }
          );
        }

        return json({
          success: true,
          message: `${updated.name} → ${device.name} eşleştirildi`,
          data: { vehicle: updated, device },
        });
      }

      case "unlink": {
        // Eşleştirmeyi kaldır
        const body = await request.json();
        const { vehicleId } = body;

        if (!vehicleId) {
          return json(
            { success: false, message: "vehicleId gerekli" },
            { status: 400 }
          );
        }

        const [updated] = await db
          .update(schema.vehicles)
          .set({ traccarId: null, updatedAt: new Date() })
          .where(eq(schema.vehicles.id, vehicleId))
          .returning();

        if (!updated) {
          return json(
            { success: false, message: "Araç bulunamadı" },
            { status: 404 }
          );
        }

        return json({
          success: true,
          message: "Eşleştirme kaldırıldı",
          data: updated,
        });
      }

      default: {
        // Varsayılan: Tüm eşleştirilmiş araçların konumlarını güncelle
        const vehicles = await db.select().from(schema.vehicles);
        const traccarPositions = await traccar.getPositions();
        const traccarDevices = await traccar.getDevices();

        // Durakları çek (GPS düzeltme için)
        const stops = await db.select().from(schema.stops);
        const stopsForCorrection = stops.map((s) => ({
          id: s.id,
          lng: s.lng,
          lat: s.lat,
          name: s.name,
        }));

        let updatedCount = 0;
        const updates: any[] = [];

        for (const vehicle of vehicles) {
          if (!vehicle.traccarId) continue;

          const position = traccarPositions.find(
            (p) => p.deviceId === vehicle.traccarId
          );
          const device = traccarDevices.find((d) => d.id === vehicle.traccarId);

          if (position && position.valid) {
            // GPS Düzeltme: Snap to Route
            let finalLat = position.latitude;
            let finalLng = position.longitude;
            let finalHeading = position.course;
            let correctionType = "none";
            let correctionDistance = 0;

            if (snapToRoute) {
              const correction = fullCorrection(
                position.longitude,
                position.latitude,
                stopsForCorrection,
                { stopSnapRadius: 15, routeMaxDistance: 40 }
              );

              finalLat = correction.lat;
              finalLng = correction.lng;
              correctionType = correction.correctionType;
              correctionDistance = correction.distance;

              // Heading'i de düzelt
              if (correction.correctionType !== "none") {
                finalHeading = correctHeading(
                  finalLng,
                  finalLat,
                  position.course
                );
              }
            }

            // En yakın durağı bul (geofence kontrolü için)
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

            // Durum belirleme mantığı:
            // - Cihaz online ve araç offline ise → available yap
            // - Cihaz offline ise → offline yap
            // - Diğer durumlarda mevcut durumu koru (busy, maintenance vb.)
            let newStatus = vehicle.status;

            if (device?.status === "online") {
              if (vehicle.status === "offline") {
                newStatus = "available";
              }
              // busy veya maintenance ise değiştirme
            } else {
              newStatus = "offline";
            }

            const [updated] = await db
              .update(schema.vehicles)
              .set({
                lat: finalLat,
                lng: finalLng,
                speed: traccar.knotsToKmh(position.speed),
                heading: finalHeading,
                gpsSignal: device?.status === "online",
                status: newStatus,
                lastUpdate: new Date(position.serverTime),
                lastTraccarUpdate: new Date(),
                lastGeofenceStopId: nearestStopId,
                updatedAt: new Date(),
              })
              .where(eq(schema.vehicles.id, vehicle.id))
              .returning();

            if (updated) {
              updatedCount++;
              updates.push({
                vehicleId: vehicle.id,
                vehicleName: vehicle.name,
                originalLat: position.latitude,
                originalLng: position.longitude,
                correctedLat: finalLat,
                correctedLng: finalLng,
                correctionType,
                correctionDistance: Math.round(correctionDistance * 10) / 10,
                speed: traccar.knotsToKmh(position.speed),
                heading: finalHeading,
                deviceStatus: device?.status,
              });

              // Geofence kontrolü - tüm duraklar için
              for (const stop of stops) {
                const distance = calculateDistance(
                  { lat: finalLat, lng: finalLng },
                  { lat: stop.lat, lng: stop.lng }
                );

                const geofenceRadius = stop.geofenceRadius || 15;
                const isInside = distance <= geofenceRadius;

                if (isInside) {
                  // Son event'i kontrol et
                  const lastEvent = await dbFunctions.getLastGeofenceEvent(
                    vehicle.id,
                    stop.id
                  );
                  const shouldTrigger =
                    !lastEvent ||
                    lastEvent.type === "exit" ||
                    Date.now() - new Date(lastEvent.timestamp).getTime() >
                      60000;

                  if (shouldTrigger) {
                    // Enter event kaydet
                    await dbFunctions.createGeofenceEvent({
                      vehicleId: vehicle.id,
                      stopId: stop.id,
                      type: "enter",
                      distance,
                    });
                  }
                }
              }
            }
          } else if (device?.status === "offline") {
            // Cihaz offline ise aracı da offline yap
            await db
              .update(schema.vehicles)
              .set({
                gpsSignal: false,
                status: "offline",
                updatedAt: new Date(),
              })
              .where(eq(schema.vehicles.id, vehicle.id));
          }
        }

        return json({
          success: true,
          message: `${updatedCount} araç güncellendi`,
          data: { updatedCount, updates },
        });
      }
    }
  } catch (error) {
    console.error("Traccar sync error:", error);
    return json({ success: false, message: String(error) }, { status: 500 });
  }
};

export const GET: RequestHandler = async () => {
  // Eşleştirme durumunu göster
  try {
    const vehicles = await db.select().from(schema.vehicles);
    const traccarDevices = await traccar.getDevices();
    const traccarPositions = await traccar.getPositions();

    const mappings = vehicles.map((vehicle) => {
      const device = vehicle.traccarId
        ? traccarDevices.find((d) => d.id === vehicle.traccarId)
        : null;
      const position = vehicle.traccarId
        ? traccarPositions.find((p) => p.deviceId === vehicle.traccarId)
        : null;

      return {
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        traccarId: vehicle.traccarId,
        traccarDevice: device
          ? {
              id: device.id,
              name: device.name,
              uniqueId: device.uniqueId,
              status: device.status,
            }
          : null,
        lastPosition: position
          ? {
              lat: position.latitude,
              lng: position.longitude,
              speed: traccar.knotsToKmh(position.speed),
              time: position.serverTime,
            }
          : null,
        linked: !!device,
      };
    });

    const unlinkedDevices = traccarDevices.filter(
      (d) => !vehicles.some((v) => v.traccarId === d.id)
    );

    return json({
      success: true,
      data: {
        mappings,
        unlinkedDevices: unlinkedDevices.map((d) => ({
          id: d.id,
          name: d.name,
          uniqueId: d.uniqueId,
          status: d.status,
        })),
        summary: {
          totalVehicles: vehicles.length,
          linkedVehicles: mappings.filter((m) => m.linked).length,
          totalTraccarDevices: traccarDevices.length,
          onlineDevices: traccarDevices.filter((d) => d.status === "online")
            .length,
        },
      },
    });
  } catch (error) {
    console.error("Traccar sync GET error:", error);
    return json({ success: false, message: String(error) }, { status: 500 });
  }
};
