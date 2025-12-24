// ============================================
// VEHICLES API - Araç Yönetimi (Drizzle)
// GET: Tüm araçları listele
// POST: Yeni araç ekle
// ============================================

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import * as db from "$lib/server/db";

// GET - Tüm araçları listele (mevcut durak bilgisi ile)
export const GET: RequestHandler = async ({ url }) => {
  try {
    const status = url.searchParams.get("status") ?? undefined;
    const withCurrentStop = url.searchParams.get("withCurrentStop") !== "false";

    let vehicles;
    if (withCurrentStop) {
      // Mevcut durak bilgisi ile birlikte getir
      const allVehicles = await db.getAllVehiclesWithCurrentStop();
      vehicles = status
        ? allVehicles.filter((v) => v.status === status)
        : allVehicles;
    } else {
      vehicles = await db.getAllVehicles(status);
    }

    return json({
      success: true,
      data: vehicles,
      count: vehicles.length,
    });
  } catch (err) {
    console.error("Vehicles GET error:", err);
    return error(500, "Araçlar getirilirken hata oluştu");
  }
};

// POST - Yeni araç ekle
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    if (!body.name || !body.plateNumber) {
      return error(400, "name ve plateNumber zorunludur");
    }

    const vehicle = await db.createVehicle({
      name: body.name,
      plateNumber: body.plateNumber,
      lat: body.lat ?? 37.1385641,
      lng: body.lng ?? 27.5607023,
      traccarId: body.traccarId,
      status: "offline",
    });

    return json(
      { success: true, data: vehicle, message: "Araç eklendi" },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("Vehicle POST error:", err);

    // Unique constraint violation
    if (err instanceof Error && err.message.includes("unique")) {
      return error(409, "Bu plaka veya isim zaten kayıtlı");
    }

    return error(500, "Araç eklenirken hata oluştu");
  }
};
