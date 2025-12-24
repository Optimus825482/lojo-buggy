// ============================================
// DRIZZLE SCHEMA - Buggy Shuttle Database
// ============================================

import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  real,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const vehicleStatusEnum = pgEnum("vehicle_status", [
  "available",
  "busy",
  "offline",
  "maintenance",
]);
export const callStatusEnum = pgEnum("call_status", [
  "pending",
  "assigned",
  "completed",
  "cancelled",
]);
export const taskStatusEnum = pgEnum("task_status", [
  "assigned",
  "pickup",
  "dropoff",
  "completed",
  "cancelled",
]);
export const geofenceEventTypeEnum = pgEnum("geofence_event_type", [
  "enter",
  "exit",
]);
export const tripStatusEnum = pgEnum("trip_status", [
  "active",
  "completed",
  "cancelled",
]);
export const reportTypeEnum = pgEnum("report_type", [
  "daily",
  "weekly",
  "monthly",
  "custom",
  "vehicle",
  "trip",
]);
export const reportFormatEnum = pgEnum("report_format", [
  "pdf",
  "excel",
  "json",
]);
export const scheduleFrequencyEnum = pgEnum("schedule_frequency", [
  "daily",
  "weekly",
  "monthly",
]);

// Vehicles Table
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  plateNumber: varchar("plate_number", { length: 20 }).notNull().unique(),
  lat: real("lat").notNull().default(37.1385641),
  lng: real("lng").notNull().default(27.5607023),
  speed: real("speed").notNull().default(0),
  heading: real("heading").notNull().default(0),
  status: vehicleStatusEnum("status").notNull().default("offline"),
  batteryLevel: integer("battery_level").default(100),
  gpsSignal: boolean("gps_signal").notNull().default(false),
  traccarId: integer("traccar_id").unique(),
  currentTaskId: integer("current_task_id"),
  lastGeofenceStopId: integer("last_geofence_stop_id"), // Son temas edilen durak
  lastTraccarUpdate: timestamp("last_traccar_update"), // Son Traccar güncellemesi
  lastUpdate: timestamp("last_update").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Stops Table
export const stops = pgTable("stops", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  icon: varchar("icon", { length: 10 }).notNull().default("📍"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  geofenceRadius: integer("geofence_radius").notNull().default(15),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Calls Table
export const calls = pgTable("calls", {
  id: serial("id").primaryKey(),
  stopId: integer("stop_id")
    .notNull()
    .references(() => stops.id),
  status: callStatusEnum("status").notNull().default("pending"),
  assignedVehicleId: integer("assigned_vehicle_id").references(
    () => vehicles.id
  ),
  assignedAt: timestamp("assigned_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Tasks Table
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id")
    .notNull()
    .references(() => vehicles.id),
  callId: integer("call_id")
    .notNull()
    .references(() => calls.id),
  pickupStopId: integer("pickup_stop_id")
    .notNull()
    .references(() => stops.id),
  dropoffStopId: integer("dropoff_stop_id").references(() => stops.id),
  status: taskStatusEnum("status").notNull().default("assigned"),
  pickupAt: timestamp("pickup_at"),
  dropoffAt: timestamp("dropoff_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  autoCompleted: boolean("auto_completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Geofence Events Table
export const geofenceEvents = pgTable("geofence_events", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id")
    .notNull()
    .references(() => vehicles.id),
  stopId: integer("stop_id")
    .notNull()
    .references(() => stops.id),
  type: geofenceEventTypeEnum("type").notNull(),
  distance: real("distance").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Vehicle Positions Table (GPS History)
export const vehiclePositions = pgTable("vehicle_positions", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id")
    .notNull()
    .references(() => vehicles.id),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  speed: real("speed").notNull(),
  heading: real("heading").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Daily Stats Table
export const dailyStats = pgTable("daily_stats", {
  id: serial("id").primaryKey(),
  date: timestamp("date").notNull().unique(),
  totalCalls: integer("total_calls").notNull().default(0),
  completedCalls: integer("completed_calls").notNull().default(0),
  cancelledCalls: integer("cancelled_calls").notNull().default(0),
  averageWaitTime: integer("average_wait_time").notNull().default(0),
  averageTripTime: integer("average_trip_time").notNull().default(0),
  totalTrips: integer("total_trips").notNull().default(0),
  peakHour: integer("peak_hour"),
  busiestStop: integer("busiest_stop"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// System Settings Table
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Trips Table (Phase 2 - Otomatik Trip Detection)
export const trips = pgTable("trips", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id")
    .notNull()
    .references(() => vehicles.id),
  status: tripStatusEnum("status").notNull().default("active"),
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"),
  startLat: real("start_lat").notNull(),
  startLng: real("start_lng").notNull(),
  endLat: real("end_lat"),
  endLng: real("end_lng"),
  startStopId: integer("start_stop_id").references(() => stops.id),
  endStopId: integer("end_stop_id").references(() => stops.id),
  distance: real("distance").default(0), // metre
  maxSpeed: real("max_speed").default(0), // km/h
  avgSpeed: real("avg_speed").default(0), // km/h
  duration: integer("duration").default(0), // saniye
  traccarTripId: integer("traccar_trip_id"), // Traccar trip ID (varsa)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Reports Table (Phase 3 - Raporlama)
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  type: reportTypeEnum("type").notNull(),
  format: reportFormatEnum("format").notNull().default("pdf"),
  dateFrom: timestamp("date_from").notNull(),
  dateTo: timestamp("date_to").notNull(),
  vehicleId: integer("vehicle_id").references(() => vehicles.id), // null = tüm araçlar
  filePath: varchar("file_path", { length: 500 }),
  fileSize: integer("file_size"), // bytes
  generatedAt: timestamp("generated_at"),
  emailSentTo: text("email_sent_to"), // JSON array of emails
  emailSentAt: timestamp("email_sent_at"),
  scheduledReportId: integer("scheduled_report_id"), // Otomatik oluşturulduysa
  metadata: text("metadata"), // JSON - ek bilgiler
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Scheduled Reports Table (Otomatik Rapor Planlama)
export const scheduledReports = pgTable("scheduled_reports", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  type: reportTypeEnum("type").notNull(),
  format: reportFormatEnum("format").notNull().default("pdf"),
  frequency: scheduleFrequencyEnum("frequency").notNull(),
  vehicleId: integer("vehicle_id").references(() => vehicles.id), // null = tüm araçlar
  emailRecipients: text("email_recipients").notNull(), // JSON array of emails
  isActive: boolean("is_active").notNull().default(true),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  runTime: varchar("run_time", { length: 5 }).notNull().default("08:00"), // HH:mm
  dayOfWeek: integer("day_of_week"), // 0-6 (Pazar-Cumartesi) - haftalık için
  dayOfMonth: integer("day_of_month"), // 1-31 - aylık için
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// SMTP Settings Table (Email Ayarları)
export const smtpSettings = pgTable("smtp_settings", {
  id: serial("id").primaryKey(),
  host: varchar("host", { length: 255 }).notNull(),
  port: integer("port").notNull().default(587),
  secure: boolean("secure").notNull().default(false), // true = SSL/TLS
  username: varchar("username", { length: 255 }).notNull(),
  password: varchar("password", { length: 255 }).notNull(), // Şifrelenmiş
  fromEmail: varchar("from_email", { length: 255 }).notNull(),
  fromName: varchar("from_name", { length: 100 })
    .notNull()
    .default("Buggy Shuttle"),
  isActive: boolean("is_active").notNull().default(true),
  lastTestAt: timestamp("last_test_at"),
  lastTestResult: boolean("last_test_result"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Relations
export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  currentTask: one(tasks, {
    fields: [vehicles.currentTaskId],
    references: [tasks.id],
  }),
  tasks: many(tasks),
  calls: many(calls),
  geofenceEvents: many(geofenceEvents),
  positions: many(vehiclePositions),
  trips: many(trips),
}));

export const stopsRelations = relations(stops, ({ many }) => ({
  calls: many(calls),
  pickupTasks: many(tasks, { relationName: "pickupStop" }),
  dropoffTasks: many(tasks, { relationName: "dropoffStop" }),
  geofenceEvents: many(geofenceEvents),
  startTrips: many(trips, { relationName: "startStop" }),
  endTrips: many(trips, { relationName: "endStop" }),
}));

export const callsRelations = relations(calls, ({ one }) => ({
  stop: one(stops, { fields: [calls.stopId], references: [stops.id] }),
  assignedVehicle: one(vehicles, {
    fields: [calls.assignedVehicleId],
    references: [vehicles.id],
  }),
  task: one(tasks),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [tasks.vehicleId],
    references: [vehicles.id],
  }),
  call: one(calls, { fields: [tasks.callId], references: [calls.id] }),
  pickupStop: one(stops, {
    fields: [tasks.pickupStopId],
    references: [stops.id],
    relationName: "pickupStop",
  }),
  dropoffStop: one(stops, {
    fields: [tasks.dropoffStopId],
    references: [stops.id],
    relationName: "dropoffStop",
  }),
}));

export const geofenceEventsRelations = relations(geofenceEvents, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [geofenceEvents.vehicleId],
    references: [vehicles.id],
  }),
  stop: one(stops, { fields: [geofenceEvents.stopId], references: [stops.id] }),
}));

export const vehiclePositionsRelations = relations(
  vehiclePositions,
  ({ one }) => ({
    vehicle: one(vehicles, {
      fields: [vehiclePositions.vehicleId],
      references: [vehicles.id],
    }),
  })
);

export const tripsRelations = relations(trips, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [trips.vehicleId],
    references: [vehicles.id],
  }),
  startStop: one(stops, {
    fields: [trips.startStopId],
    references: [stops.id],
    relationName: "startStop",
  }),
  endStop: one(stops, {
    fields: [trips.endStopId],
    references: [stops.id],
    relationName: "endStop",
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [reports.vehicleId],
    references: [vehicles.id],
  }),
  scheduledReport: one(scheduledReports, {
    fields: [reports.scheduledReportId],
    references: [scheduledReports.id],
  }),
}));

export const scheduledReportsRelations = relations(
  scheduledReports,
  ({ one, many }) => ({
    vehicle: one(vehicles, {
      fields: [scheduledReports.vehicleId],
      references: [vehicles.id],
    }),
    reports: many(reports),
  })
);

// Type exports
export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;
export type Stop = typeof stops.$inferSelect;
export type NewStop = typeof stops.$inferInsert;
export type Call = typeof calls.$inferSelect;
export type NewCall = typeof calls.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type GeofenceEvent = typeof geofenceEvents.$inferSelect;
export type DailyStat = typeof dailyStats.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type ScheduledReport = typeof scheduledReports.$inferSelect;
export type NewScheduledReport = typeof scheduledReports.$inferInsert;
export type SmtpSetting = typeof smtpSettings.$inferSelect;
export type NewSmtpSetting = typeof smtpSettings.$inferInsert;
