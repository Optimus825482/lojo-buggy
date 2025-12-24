/**
 * Traccar Geofence Sync API
 *
 * POST /api/traccar/geofence-sync - Buggy Shuttle duraklarını Traccar'a geofence olarak senkronize eder
 * GET /api/traccar/geofence-sync - Senkronizasyon durumunu gösterir
 * DELETE /api/traccar/geofence-sync - Traccar'daki Buggy Shuttle geofence'lerini siler
 *
 * Bu senkronizasyon sayesinde:
 * - Traccar otomatik olarak geofenceEnter/Exit event'leri üretir
 * - WebSocket üzerinden bu event'ler anlık olarak alınır
 * - Kendi geofence hesaplamamıza gerek kalmaz
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import * as traccar from "$lib/server/traccar";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

// Buggy Shuttle geofence'lerini tanımlamak için prefix
const GEOFENCE_PREFIX = "BS_STOP_";

interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  linked: number;
  errors: string[];
}

/**
 * POST - Durakları Traccar'a geofence olarak senkronize et
 */
export const POST: RequestHandler = async ({ url }) => {
  const forceRecreate = url.searchParams.get("force") === "true";

  try {
    const result: SyncResult = {
      created: 0,
      updated: 0,
      deleted: 0,
      linked: 0,
      errors: [],
    };

    // 1. Buggy Shuttle duraklarını çek
    const stops = await db
      .select()
      .from(schema.stops)
      .where(eq(schema.stops.isActive, true));

    if (stops.length === 0) {
      return json({
        success: false,
        message: "Senkronize edilecek aktif durak bulunamadı",
      });
    }

    // 2. Traccar'daki mevcut geofence'leri çek
    const existingGeofences = await traccar.getGeofences();
    const bsGeofences = existingGeofences.filter((g) =>
      g.name.startsWith(GEOFENCE_PREFIX)
    );

    // 3. Force modunda önce tüm BS geofence'lerini sil
    if (forceRecreate && bsGeofences.length > 0) {
      for (const gf of bsGeofences) {
        const deleted = await traccar.deleteGeofence(gf.id);
        if (deleted) {
          result.deleted++;
        } else {
          result.errors.push(`Geofence silinemedi: ${gf.name}`);
        }
      }
    }

    // 4. Traccar cihazlarını çek (geofence bağlantısı için)
    const devices = await traccar.getDevices();

    // 5. Her durak için geofence oluştur veya güncelle
    const createdGeofenceIds: number[] = [];

    for (const stop of stops) {
      const geofenceName = `${GEOFENCE_PREFIX}${stop.id}_${stop.name.replace(
        /\s+/g,
        "_"
      )}`;
      const radius = stop.geofenceRadius || 15;

      // Mevcut geofence var mı kontrol et (force modunda zaten silindi)
      const existing = forceRecreate
        ? null
        : bsGeofences.find(
            (g) =>
              g.name.startsWith(`${GEOFENCE_PREFIX}${stop.id}_`) ||
              g.name === geofenceName
          );

      if (existing) {
        // Güncelleme gerekiyor mu kontrol et
        const expectedArea = `CIRCLE (${stop.lng} ${stop.lat}, ${radius})`;
        if (existing.area !== expectedArea) {
          // Traccar'da geofence güncelleme yok, sil ve yeniden oluştur
          await traccar.deleteGeofence(existing.id);
          const newGf = await traccar.createGeofence(
            geofenceName,
            stop.lat,
            stop.lng,
            radius
          );
          if (newGf) {
            result.updated++;
            createdGeofenceIds.push(newGf.id);

            // Durak tablosuna traccarGeofenceId kaydet
            await db
              .update(schema.stops)
              .set({ updatedAt: new Date() })
              .where(eq(schema.stops.id, stop.id));
          }
        } else {
          createdGeofenceIds.push(existing.id);
        }
      } else {
        // Yeni geofence oluştur
        const newGf = await traccar.createGeofence(
          geofenceName,
          stop.lat,
          stop.lng,
          radius
        );

        if (newGf) {
          result.created++;
          createdGeofenceIds.push(newGf.id);
        } else {
          result.errors.push(`Geofence oluşturulamadı: ${stop.name}`);
        }
      }
    }

    // 6. Tüm cihazlara geofence'leri bağla
    for (const device of devices) {
      for (const geofenceId of createdGeofenceIds) {
        const linked = await traccar.linkDeviceGeofence(device.id, geofenceId);
        if (linked) {
          result.linked++;
        }
      }
    }

    // 7. Traccar'da olup Buggy Shuttle'da olmayan geofence'leri sil
    if (!forceRecreate) {
      const stopIds = stops.map((s) => s.id);
      for (const gf of bsGeofences) {
        // Geofence adından stop ID'yi çıkar
        const match = gf.name.match(/^BS_STOP_(\d+)_/);
        if (match) {
          const stopId = parseInt(match[1]);
          if (!stopIds.includes(stopId)) {
            const deleted = await traccar.deleteGeofence(gf.id);
            if (deleted) {
              result.deleted++;
            }
          }
        }
      }
    }

    return json({
      success: true,
      message: `Senkronizasyon tamamlandı`,
      data: {
        ...result,
        totalStops: stops.length,
        totalDevices: devices.length,
        totalGeofences: createdGeofenceIds.length,
      },
    });
  } catch (error) {
    console.error("Geofence sync error:", error);
    return json({ success: false, message: String(error) }, { status: 500 });
  }
};

/**
 * GET - Senkronizasyon durumunu göster
 */
export const GET: RequestHandler = async () => {
  try {
    // Buggy Shuttle durakları
    const stops = await db
      .select()
      .from(schema.stops)
      .where(eq(schema.stops.isActive, true));

    // Traccar geofence'leri
    const allGeofences = await traccar.getGeofences();
    const bsGeofences = allGeofences.filter((g) =>
      g.name.startsWith(GEOFENCE_PREFIX)
    );

    // Traccar cihazları
    const devices = await traccar.getDevices();

    // Eşleştirme durumunu kontrol et
    const syncStatus = stops.map((stop) => {
      const geofenceName = `${GEOFENCE_PREFIX}${stop.id}_`;
      const traccarGeofence = bsGeofences.find((g) =>
        g.name.startsWith(geofenceName)
      );

      return {
        stopId: stop.id,
        stopName: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        radius: stop.geofenceRadius || 15,
        synced: !!traccarGeofence,
        traccarGeofenceId: traccarGeofence?.id || null,
        traccarGeofenceName: traccarGeofence?.name || null,
      };
    });

    const syncedCount = syncStatus.filter((s) => s.synced).length;
    const notSyncedCount = syncStatus.filter((s) => !s.synced).length;

    // Traccar'da olup Buggy Shuttle'da olmayan geofence'ler
    const orphanGeofences = bsGeofences.filter((gf) => {
      const match = gf.name.match(/^BS_STOP_(\d+)_/);
      if (match) {
        const stopId = parseInt(match[1]);
        return !stops.some((s) => s.id === stopId);
      }
      return false;
    });

    return json({
      success: true,
      data: {
        summary: {
          totalStops: stops.length,
          syncedStops: syncedCount,
          notSyncedStops: notSyncedCount,
          totalTraccarGeofences: allGeofences.length,
          bsGeofences: bsGeofences.length,
          orphanGeofences: orphanGeofences.length,
          totalDevices: devices.length,
        },
        stops: syncStatus,
        orphanGeofences: orphanGeofences.map((g) => ({
          id: g.id,
          name: g.name,
          area: g.area,
        })),
      },
    });
  } catch (error) {
    console.error("Geofence sync status error:", error);
    return json({ success: false, message: String(error) }, { status: 500 });
  }
};

/**
 * DELETE - Traccar'daki tüm Buggy Shuttle geofence'lerini sil
 */
export const DELETE: RequestHandler = async () => {
  try {
    const allGeofences = await traccar.getGeofences();
    const bsGeofences = allGeofences.filter((g) =>
      g.name.startsWith(GEOFENCE_PREFIX)
    );

    let deletedCount = 0;
    const errors: string[] = [];

    for (const gf of bsGeofences) {
      const deleted = await traccar.deleteGeofence(gf.id);
      if (deleted) {
        deletedCount++;
      } else {
        errors.push(`Silinemedi: ${gf.name}`);
      }
    }

    return json({
      success: true,
      message: `${deletedCount} geofence silindi`,
      data: {
        deleted: deletedCount,
        errors,
      },
    });
  } catch (error) {
    console.error("Geofence delete error:", error);
    return json({ success: false, message: String(error) }, { status: 500 });
  }
};
