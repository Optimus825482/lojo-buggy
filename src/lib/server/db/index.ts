// ============================================
// DRIZZLE DATABASE CLIENT & HELPER FUNCTIONS
// ============================================

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, desc, asc, sql, gte, count, or } from "drizzle-orm";
import * as schema from "./schema";
import { env } from "$env/dynamic/private";

// postgres.js client oluştur
const client = postgres(
  env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/buggy_shuttle"
);

// Drizzle instance - schema ile birlikte
export const db = drizzle(client, { schema });

// Re-export schema and types
export * from "./schema";

// ============================================
// VEHICLE FUNCTIONS
// ============================================

export async function getAllVehicles(status?: string) {
  if (status) {
    return db
      .select()
      .from(schema.vehicles)
      .where(
        eq(
          schema.vehicles.status,
          status as (typeof schema.vehicleStatusEnum.enumValues)[number]
        )
      )
      .orderBy(asc(schema.vehicles.id));
  }
  return db.select().from(schema.vehicles).orderBy(asc(schema.vehicles.id));
}

export async function getVehicleById(id: number) {
  const result = await db
    .select()
    .from(schema.vehicles)
    .where(eq(schema.vehicles.id, id));
  return result[0] ?? null;
}

export async function createVehicle(data: schema.NewVehicle) {
  const result = await db.insert(schema.vehicles).values(data).returning();
  return result[0];
}

export async function updateVehicle(
  id: number,
  data: Partial<schema.NewVehicle>
) {
  const result = await db
    .update(schema.vehicles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.vehicles.id, id))
    .returning();
  return result[0];
}

export async function updateVehiclePosition(
  id: number,
  lat: number,
  lng: number,
  speed: number,
  heading: number
) {
  const result = await db
    .update(schema.vehicles)
    .set({
      lat,
      lng,
      speed,
      heading,
      lastUpdate: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.vehicles.id, id))
    .returning();
  return result[0];
}

export async function updateVehicleStatus(
  id: number,
  status: (typeof schema.vehicleStatusEnum.enumValues)[number]
) {
  const result = await db
    .update(schema.vehicles)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.vehicles.id, id))
    .returning();
  return result[0];
}

export async function deleteVehicle(id: number) {
  const result = await db
    .delete(schema.vehicles)
    .where(eq(schema.vehicles.id, id))
    .returning();
  return result[0];
}

export async function getVehicleCounts() {
  const all = await db.select({ count: count() }).from(schema.vehicles);
  const available = await db
    .select({ count: count() })
    .from(schema.vehicles)
    .where(eq(schema.vehicles.status, "available"));
  const busy = await db
    .select({ count: count() })
    .from(schema.vehicles)
    .where(eq(schema.vehicles.status, "busy"));
  const offline = await db
    .select({ count: count() })
    .from(schema.vehicles)
    .where(eq(schema.vehicles.status, "offline"));
  const maintenance = await db
    .select({ count: count() })
    .from(schema.vehicles)
    .where(eq(schema.vehicles.status, "maintenance"));

  return {
    total: all[0].count,
    available: available[0].count,
    busy: busy[0].count,
    offline: offline[0].count,
    maintenance: maintenance[0].count,
  };
}

// ============================================
// STOP FUNCTIONS
// ============================================

export async function getAllStops(activeOnly = true) {
  if (activeOnly) {
    return db
      .select()
      .from(schema.stops)
      .where(eq(schema.stops.isActive, true))
      .orderBy(asc(schema.stops.id));
  }
  return db.select().from(schema.stops).orderBy(asc(schema.stops.id));
}

export async function getStopById(id: number) {
  const result = await db
    .select()
    .from(schema.stops)
    .where(eq(schema.stops.id, id));
  return result[0] ?? null;
}

export async function createStop(data: schema.NewStop) {
  const result = await db.insert(schema.stops).values(data).returning();
  return result[0];
}

export async function updateStop(id: number, data: Partial<schema.NewStop>) {
  const result = await db
    .update(schema.stops)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.stops.id, id))
    .returning();
  return result[0];
}

export async function deleteStop(id: number) {
  const result = await db
    .delete(schema.stops)
    .where(eq(schema.stops.id, id))
    .returning();
  return result[0];
}

// ============================================
// CALL FUNCTIONS
// ============================================

export async function getAllCalls(
  options: { status?: string; limit?: number; offset?: number } = {}
) {
  const { status, limit = 50, offset = 0 } = options;

  let query = db
    .select({
      call: schema.calls,
      stop: schema.stops,
      vehicle: schema.vehicles,
    })
    .from(schema.calls)
    .leftJoin(schema.stops, eq(schema.calls.stopId, schema.stops.id))
    .leftJoin(
      schema.vehicles,
      eq(schema.calls.assignedVehicleId, schema.vehicles.id)
    )
    .orderBy(desc(schema.calls.createdAt))
    .limit(limit)
    .offset(offset);

  if (status) {
    query = query.where(
      eq(
        schema.calls.status,
        status as (typeof schema.callStatusEnum.enumValues)[number]
      )
    ) as typeof query;
  }

  const calls = await query;
  const totalResult = await db.select({ count: count() }).from(schema.calls);

  return {
    calls: calls.map((c) => ({
      ...c.call,
      stop: c.stop,
      assignedVehicle: c.vehicle,
    })),
    total: totalResult[0].count,
  };
}

export async function getActiveCalls() {
  const calls = await db
    .select({
      call: schema.calls,
      stop: schema.stops,
      vehicle: schema.vehicles,
    })
    .from(schema.calls)
    .leftJoin(schema.stops, eq(schema.calls.stopId, schema.stops.id))
    .leftJoin(
      schema.vehicles,
      eq(schema.calls.assignedVehicleId, schema.vehicles.id)
    )
    .where(
      or(
        eq(schema.calls.status, "pending"),
        eq(schema.calls.status, "assigned")
      )
    )
    .orderBy(desc(schema.calls.createdAt));

  return calls.map((c) => ({
    ...c.call,
    stop: c.stop,
    assignedVehicle: c.vehicle,
  }));
}

export async function getCallById(id: number) {
  const result = await db
    .select({
      call: schema.calls,
      stop: schema.stops,
      vehicle: schema.vehicles,
    })
    .from(schema.calls)
    .leftJoin(schema.stops, eq(schema.calls.stopId, schema.stops.id))
    .leftJoin(
      schema.vehicles,
      eq(schema.calls.assignedVehicleId, schema.vehicles.id)
    )
    .where(eq(schema.calls.id, id));

  if (!result[0]) return null;

  return {
    ...result[0].call,
    stop: result[0].stop,
    assignedVehicle: result[0].vehicle,
  };
}

export async function createCall(stopId: number) {
  // Aynı durakta bekleyen çağrı var mı kontrol et
  const existing = await db
    .select()
    .from(schema.calls)
    .where(
      and(eq(schema.calls.stopId, stopId), eq(schema.calls.status, "pending"))
    );

  if (existing.length > 0) {
    throw new Error("Bu durakta zaten bekleyen bir çağrı var");
  }

  const result = await db.insert(schema.calls).values({ stopId }).returning();
  return result[0];
}

export async function assignCall(id: number, vehicleId: number) {
  const result = await db
    .update(schema.calls)
    .set({
      assignedVehicleId: vehicleId,
      status: "assigned",
      assignedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.calls.id, id))
    .returning();
  return result[0];
}

export async function completeCall(id: number) {
  const result = await db
    .update(schema.calls)
    .set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.calls.id, id))
    .returning();
  return result[0];
}

export async function cancelCall(id: number, reason?: string) {
  const result = await db
    .update(schema.calls)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(schema.calls.id, id))
    .returning();
  return result[0];
}

// ============================================
// TASK FUNCTIONS
// ============================================

export async function getAllTasks(
  options: {
    status?: string;
    vehicleId?: number;
    limit?: number;
    offset?: number;
  } = {}
) {
  const { status, vehicleId, limit = 50, offset = 0 } = options;

  const conditions = [];
  if (status) {
    conditions.push(
      eq(
        schema.tasks.status,
        status as (typeof schema.taskStatusEnum.enumValues)[number]
      )
    );
  }
  if (vehicleId) {
    conditions.push(eq(schema.tasks.vehicleId, vehicleId));
  }

  const tasks = await db.query.tasks.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    with: {
      vehicle: true,
      call: true,
      pickupStop: true,
      dropoffStop: true,
    },
    orderBy: [desc(schema.tasks.createdAt)],
    limit,
    offset,
  });

  const totalResult = await db.select({ count: count() }).from(schema.tasks);

  return { tasks, total: totalResult[0].count };
}

export async function getActiveTasks() {
  return db.query.tasks.findMany({
    where: or(
      eq(schema.tasks.status, "assigned"),
      eq(schema.tasks.status, "pickup"),
      eq(schema.tasks.status, "dropoff")
    ),
    with: {
      vehicle: true,
      call: true,
      pickupStop: true,
      dropoffStop: true,
    },
    orderBy: [desc(schema.tasks.createdAt)],
  });
}

export async function getTaskById(id: number) {
  return db.query.tasks.findFirst({
    where: eq(schema.tasks.id, id),
    with: {
      vehicle: true,
      call: true,
      pickupStop: true,
      dropoffStop: true,
    },
  });
}

export async function createTask(data: {
  vehicleId: number;
  callId: number;
  pickupStopId: number;
  dropoffStopId?: number;
}) {
  const result = await db
    .insert(schema.tasks)
    .values({
      vehicleId: data.vehicleId,
      callId: data.callId,
      pickupStopId: data.pickupStopId,
      dropoffStopId: data.dropoffStopId,
    })
    .returning();
  return result[0];
}

export async function setTaskDropoff(id: number, dropoffStopId: number) {
  const result = await db
    .update(schema.tasks)
    .set({ dropoffStopId, updatedAt: new Date() })
    .where(eq(schema.tasks.id, id))
    .returning();
  return result[0];
}

export async function pickupTask(id: number) {
  const result = await db
    .update(schema.tasks)
    .set({ status: "pickup", pickupAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.tasks.id, id))
    .returning();
  return result[0];
}

export async function dropoffTask(id: number) {
  const result = await db
    .update(schema.tasks)
    .set({ status: "dropoff", dropoffAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.tasks.id, id))
    .returning();
  return result[0];
}

export async function completeTask(id: number, autoCompleted = false) {
  // Task'ı tamamla
  const task = await db
    .update(schema.tasks)
    .set({
      status: "completed",
      completedAt: new Date(),
      autoCompleted,
      updatedAt: new Date(),
    })
    .where(eq(schema.tasks.id, id))
    .returning();

  if (task[0]) {
    // Call'ı tamamla
    await db
      .update(schema.calls)
      .set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.calls.id, task[0].callId));

    // Aracı müsait yap
    await db
      .update(schema.vehicles)
      .set({ status: "available", updatedAt: new Date() })
      .where(eq(schema.vehicles.id, task[0].vehicleId));
  }

  return task[0];
}

export async function cancelTask(id: number) {
  const task = await db
    .update(schema.tasks)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.tasks.id, id))
    .returning();

  if (task[0]) {
    // Call'ı "pending" durumuna geri döndür (tekrar atanabilir)
    await db
      .update(schema.calls)
      .set({
        status: "pending",
        assignedAt: null,
        assignedVehicleId: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.calls.id, task[0].callId));

    // Aracı müsait yap
    await db
      .update(schema.vehicles)
      .set({ status: "available", updatedAt: new Date() })
      .where(eq(schema.vehicles.id, task[0].vehicleId));
  }

  return task[0];
}

// ============================================
// STATS FUNCTIONS
// ============================================

export async function getTodayStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await db
    .select()
    .from(schema.dailyStats)
    .where(gte(schema.dailyStats.date, today));

  return result[0] ?? null;
}

export async function getRecentStats(days: number) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  return db
    .select()
    .from(schema.dailyStats)
    .where(gte(schema.dailyStats.date, startDate))
    .orderBy(desc(schema.dailyStats.date));
}

export async function calculateLiveStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Bugünkü çağrılar
  const todayCalls = await db
    .select({ count: count() })
    .from(schema.calls)
    .where(gte(schema.calls.createdAt, today));

  const completedCalls = await db
    .select({ count: count() })
    .from(schema.calls)
    .where(
      and(
        gte(schema.calls.createdAt, today),
        eq(schema.calls.status, "completed")
      )
    );

  const pendingCalls = await db
    .select({ count: count() })
    .from(schema.calls)
    .where(
      and(
        gte(schema.calls.createdAt, today),
        eq(schema.calls.status, "pending")
      )
    );

  // Araç durumları
  const vehicleCounts = await getVehicleCounts();

  // Aktif görevler
  const activeTasks = await db
    .select({ count: count() })
    .from(schema.tasks)
    .where(
      or(
        eq(schema.tasks.status, "assigned"),
        eq(schema.tasks.status, "pickup"),
        eq(schema.tasks.status, "dropoff")
      )
    );

  return {
    todayCalls: todayCalls[0].count,
    completedCalls: completedCalls[0].count,
    pendingCalls: pendingCalls[0].count,
    activeTasks: activeTasks[0].count,
    vehicles: vehicleCounts,
  };
}

export async function getTodayCallCounts() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const total = await db
    .select({ count: count() })
    .from(schema.calls)
    .where(gte(schema.calls.createdAt, today));

  const pending = await db
    .select({ count: count() })
    .from(schema.calls)
    .where(
      and(
        gte(schema.calls.createdAt, today),
        eq(schema.calls.status, "pending")
      )
    );

  const assigned = await db
    .select({ count: count() })
    .from(schema.calls)
    .where(
      and(
        gte(schema.calls.createdAt, today),
        eq(schema.calls.status, "assigned")
      )
    );

  const completed = await db
    .select({ count: count() })
    .from(schema.calls)
    .where(
      and(
        gte(schema.calls.createdAt, today),
        eq(schema.calls.status, "completed")
      )
    );

  const cancelled = await db
    .select({ count: count() })
    .from(schema.calls)
    .where(
      and(
        gte(schema.calls.createdAt, today),
        eq(schema.calls.status, "cancelled")
      )
    );

  return {
    total: total[0].count,
    pending: pending[0].count,
    assigned: assigned[0].count,
    completed: completed[0].count,
    cancelled: cancelled[0].count,
  };
}

export async function getTodayTaskCounts() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const total = await db
    .select({ count: count() })
    .from(schema.tasks)
    .where(gte(schema.tasks.createdAt, today));

  const active = await db
    .select({ count: count() })
    .from(schema.tasks)
    .where(
      and(
        gte(schema.tasks.createdAt, today),
        or(
          eq(schema.tasks.status, "assigned"),
          eq(schema.tasks.status, "pickup"),
          eq(schema.tasks.status, "dropoff")
        )
      )
    );

  const completed = await db
    .select({ count: count() })
    .from(schema.tasks)
    .where(
      and(
        gte(schema.tasks.createdAt, today),
        eq(schema.tasks.status, "completed")
      )
    );

  const cancelled = await db
    .select({ count: count() })
    .from(schema.tasks)
    .where(
      and(
        gte(schema.tasks.createdAt, today),
        eq(schema.tasks.status, "cancelled")
      )
    );

  return {
    total: total[0].count,
    active: active[0].count,
    completed: completed[0].count,
    cancelled: cancelled[0].count,
  };
}

export async function incrementCallCount() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db
    .insert(schema.dailyStats)
    .values({ date: today, totalCalls: 1 })
    .onConflictDoUpdate({
      target: schema.dailyStats.date,
      set: {
        totalCalls: sql`${schema.dailyStats.totalCalls} + 1`,
        updatedAt: new Date(),
      },
    });
}

export async function incrementCompletedCallCount() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db
    .insert(schema.dailyStats)
    .values({ date: today, completedCalls: 1 })
    .onConflictDoUpdate({
      target: schema.dailyStats.date,
      set: {
        completedCalls: sql`${schema.dailyStats.completedCalls} + 1`,
        updatedAt: new Date(),
      },
    });
}

export async function incrementCancelledCallCount() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db
    .insert(schema.dailyStats)
    .values({ date: today, cancelledCalls: 1 })
    .onConflictDoUpdate({
      target: schema.dailyStats.date,
      set: {
        cancelledCalls: sql`${schema.dailyStats.cancelledCalls} + 1`,
        updatedAt: new Date(),
      },
    });
}

export async function updateAverageWaitTime() {
  // Bugünkü tamamlanan çağrıların ortalama bekleme süresini hesapla
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedCalls = await db
    .select()
    .from(schema.calls)
    .where(
      and(
        gte(schema.calls.createdAt, today),
        eq(schema.calls.status, "completed")
      )
    );

  if (completedCalls.length === 0) return;

  const totalWaitTime = completedCalls.reduce((sum, call) => {
    if (call.assignedAt && call.createdAt) {
      return sum + (call.assignedAt.getTime() - call.createdAt.getTime());
    }
    return sum;
  }, 0);

  const avgWaitTime = Math.round(totalWaitTime / completedCalls.length / 1000); // saniye

  await db
    .update(schema.dailyStats)
    .set({ averageWaitTime: avgWaitTime, updatedAt: new Date() })
    .where(gte(schema.dailyStats.date, today));
}

export async function updateAverageTripTime() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedTasks = await db
    .select()
    .from(schema.tasks)
    .where(
      and(
        gte(schema.tasks.createdAt, today),
        eq(schema.tasks.status, "completed")
      )
    );

  if (completedTasks.length === 0) return;

  const totalTripTime = completedTasks.reduce((sum, task) => {
    if (task.completedAt && task.pickupAt) {
      return sum + (task.completedAt.getTime() - task.pickupAt.getTime());
    }
    return sum;
  }, 0);

  const avgTripTime = Math.round(totalTripTime / completedTasks.length / 1000); // saniye

  await db
    .update(schema.dailyStats)
    .set({
      averageTripTime: avgTripTime,
      totalTrips: completedTasks.length,
      updatedAt: new Date(),
    })
    .where(gte(schema.dailyStats.date, today));
}

// ============================================
// SETTINGS FUNCTIONS
// ============================================

export async function getAllSettings() {
  return db.select().from(schema.systemSettings);
}

export async function getSetting(key: string) {
  const result = await db
    .select()
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, key));
  return result[0] ?? null;
}

export async function setSetting(key: string, value: string) {
  await db
    .insert(schema.systemSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: schema.systemSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function setSettings(settings: Record<string, unknown>) {
  const updates = Object.entries(settings).map(([key, value]) =>
    db
      .insert(schema.systemSettings)
      .values({
        key,
        value: typeof value === "string" ? value : JSON.stringify(value),
      })
      .onConflictDoUpdate({
        target: schema.systemSettings.key,
        set: {
          value: typeof value === "string" ? value : JSON.stringify(value),
          updatedAt: new Date(),
        },
      })
  );

  await Promise.all(updates);
}

// ============================================
// GEOFENCE FUNCTIONS
// ============================================

export async function createGeofenceEvent(data: {
  vehicleId: number;
  stopId: number;
  type: "enter" | "exit";
  distance: number;
}) {
  const result = await db
    .insert(schema.geofenceEvents)
    .values(data)
    .returning();
  return result[0];
}

export async function getRecentGeofenceEvents(vehicleId: number, limit = 10) {
  return db
    .select({
      event: schema.geofenceEvents,
      stop: schema.stops,
    })
    .from(schema.geofenceEvents)
    .leftJoin(schema.stops, eq(schema.geofenceEvents.stopId, schema.stops.id))
    .where(eq(schema.geofenceEvents.vehicleId, vehicleId))
    .orderBy(desc(schema.geofenceEvents.timestamp))
    .limit(limit);
}

// ============================================
// VEHICLE POSITION HISTORY
// ============================================

export async function saveVehiclePosition(data: {
  vehicleId: number;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
}) {
  const result = await db
    .insert(schema.vehiclePositions)
    .values(data)
    .returning();
  return result[0];
}

export async function getVehiclePositionHistory(
  vehicleId: number,
  limit = 100
) {
  return db
    .select()
    .from(schema.vehiclePositions)
    .where(eq(schema.vehiclePositions.vehicleId, vehicleId))
    .orderBy(desc(schema.vehiclePositions.timestamp))
    .limit(limit);
}

// ============================================
// SEED FUNCTIONS
// ============================================

export async function seedStops(stops: schema.NewStop[]) {
  // Önce mevcut durakları temizle
  await db.delete(schema.stops);

  // Yeni durakları ekle
  const result = await db.insert(schema.stops).values(stops).returning();
  return result;
}

export async function seedVehicles(vehicles: schema.NewVehicle[]) {
  // Önce mevcut araçları temizle
  await db.delete(schema.vehicles);

  // Yeni araçları ekle
  const result = await db.insert(schema.vehicles).values(vehicles).returning();
  return result;
}

// ============================================
// ADDITIONAL TASK FUNCTIONS
// ============================================

export async function getActiveTaskByVehicleId(vehicleId: number) {
  return db.query.tasks.findFirst({
    where: and(
      eq(schema.tasks.vehicleId, vehicleId),
      or(
        eq(schema.tasks.status, "assigned"),
        eq(schema.tasks.status, "pickup"),
        eq(schema.tasks.status, "dropoff")
      )
    ),
    with: {
      vehicle: true,
      call: true,
      pickupStop: true,
      dropoffStop: true,
    },
  });
}

export async function getActiveTaskByCallId(callId: number) {
  return db.query.tasks.findFirst({
    where: and(
      eq(schema.tasks.callId, callId),
      or(
        eq(schema.tasks.status, "assigned"),
        eq(schema.tasks.status, "pickup"),
        eq(schema.tasks.status, "dropoff")
      )
    ),
  });
}

export async function getLastGeofenceEvent(vehicleId: number, stopId: number) {
  const result = await db
    .select()
    .from(schema.geofenceEvents)
    .where(
      and(
        eq(schema.geofenceEvents.vehicleId, vehicleId),
        eq(schema.geofenceEvents.stopId, stopId)
      )
    )
    .orderBy(desc(schema.geofenceEvents.timestamp))
    .limit(1);

  return result[0] ?? null;
}

// Araç için en son girilen durağı bul (enter event)
export async function getVehicleCurrentStop(vehicleId: number) {
  const result = await db
    .select({
      event: schema.geofenceEvents,
      stop: schema.stops,
    })
    .from(schema.geofenceEvents)
    .leftJoin(schema.stops, eq(schema.geofenceEvents.stopId, schema.stops.id))
    .where(
      and(
        eq(schema.geofenceEvents.vehicleId, vehicleId),
        eq(schema.geofenceEvents.type, "enter")
      )
    )
    .orderBy(desc(schema.geofenceEvents.timestamp))
    .limit(1);

  return result[0]?.stop ?? null;
}

// Tüm araçlar için mevcut durak bilgisini getir (batch)
export async function getAllVehiclesWithCurrentStop() {
  // Önce tüm araçları al
  const allVehicles = await db
    .select()
    .from(schema.vehicles)
    .orderBy(asc(schema.vehicles.id));

  // Her araç için en son enter event'ini bul
  const vehiclesWithStops = await Promise.all(
    allVehicles.map(async (vehicle) => {
      const lastEnterEvent = await db
        .select({
          event: schema.geofenceEvents,
          stop: schema.stops,
        })
        .from(schema.geofenceEvents)
        .leftJoin(
          schema.stops,
          eq(schema.geofenceEvents.stopId, schema.stops.id)
        )
        .where(
          and(
            eq(schema.geofenceEvents.vehicleId, vehicle.id),
            eq(schema.geofenceEvents.type, "enter")
          )
        )
        .orderBy(desc(schema.geofenceEvents.timestamp))
        .limit(1);

      return {
        ...vehicle,
        currentStop: lastEnterEvent[0]?.stop ?? null,
      };
    })
  );

  return vehiclesWithStops;
}
