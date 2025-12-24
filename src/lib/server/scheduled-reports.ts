/**
 * Scheduled Reports Service
 *
 * Bu modül:
 * - Otomatik rapor planlaması yapar
 * - Zamanlanmış raporları çalıştırır
 * - Email ile rapor gönderir
 */

import { db } from "./db";
import * as schema from "./db/schema";
import { eq, and, lte, isNull } from "drizzle-orm";
import { createReport } from "./reports";
import { sendReportEmail } from "./email";

// ============================================================================
// TYPES
// ============================================================================

export interface ScheduledReportInput {
  name: string;
  type: "daily" | "weekly" | "monthly" | "custom" | "vehicle" | "trip";
  format: "pdf" | "excel";
  frequency: "daily" | "weekly" | "monthly";
  vehicleId?: number;
  emailRecipients: string[];
  runTime: string; // HH:mm
  dayOfWeek?: number; // 0-6 (Pazar-Cumartesi)
  dayOfMonth?: number; // 1-31
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Yeni zamanlanmış rapor oluşturur
 */
export async function createScheduledReport(
  input: ScheduledReportInput
): Promise<schema.ScheduledReport> {
  const nextRunAt = calculateNextRunTime(
    input.frequency,
    input.runTime,
    input.dayOfWeek,
    input.dayOfMonth
  );

  const [report] = await db
    .insert(schema.scheduledReports)
    .values({
      name: input.name,
      type: input.type,
      format: input.format,
      frequency: input.frequency,
      vehicleId: input.vehicleId || null,
      emailRecipients: JSON.stringify(input.emailRecipients),
      runTime: input.runTime,
      dayOfWeek: input.dayOfWeek,
      dayOfMonth: input.dayOfMonth,
      nextRunAt,
      isActive: true,
    })
    .returning();

  return report;
}

/**
 * Zamanlanmış raporu günceller
 */
export async function updateScheduledReport(
  id: number,
  input: Partial<ScheduledReportInput>
): Promise<schema.ScheduledReport | null> {
  const updates: any = { updatedAt: new Date() };

  if (input.name) updates.name = input.name;
  if (input.type) updates.type = input.type;
  if (input.format) updates.format = input.format;
  if (input.frequency) updates.frequency = input.frequency;
  if (input.vehicleId !== undefined)
    updates.vehicleId = input.vehicleId || null;
  if (input.emailRecipients)
    updates.emailRecipients = JSON.stringify(input.emailRecipients);
  if (input.runTime) updates.runTime = input.runTime;
  if (input.dayOfWeek !== undefined) updates.dayOfWeek = input.dayOfWeek;
  if (input.dayOfMonth !== undefined) updates.dayOfMonth = input.dayOfMonth;

  // Sonraki çalışma zamanını yeniden hesapla
  if (
    input.frequency ||
    input.runTime ||
    input.dayOfWeek !== undefined ||
    input.dayOfMonth !== undefined
  ) {
    const [current] = await db
      .select()
      .from(schema.scheduledReports)
      .where(eq(schema.scheduledReports.id, id));

    if (current) {
      updates.nextRunAt = calculateNextRunTime(
        input.frequency || current.frequency,
        input.runTime || current.runTime,
        input.dayOfWeek ?? current.dayOfWeek ?? undefined,
        input.dayOfMonth ?? current.dayOfMonth ?? undefined
      );
    }
  }

  const [updated] = await db
    .update(schema.scheduledReports)
    .set(updates)
    .where(eq(schema.scheduledReports.id, id))
    .returning();

  return updated || null;
}

/**
 * Zamanlanmış raporu siler
 */
export async function deleteScheduledReport(id: number): Promise<boolean> {
  const result = await db
    .delete(schema.scheduledReports)
    .where(eq(schema.scheduledReports.id, id));

  return true;
}

/**
 * Zamanlanmış raporu aktif/pasif yapar
 */
export async function toggleScheduledReport(
  id: number,
  isActive: boolean
): Promise<boolean> {
  await db
    .update(schema.scheduledReports)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(schema.scheduledReports.id, id));

  return true;
}

/**
 * Tüm zamanlanmış raporları getirir
 */
export async function getScheduledReports(): Promise<schema.ScheduledReport[]> {
  return db.select().from(schema.scheduledReports);
}

/**
 * Belirli bir zamanlanmış raporu getirir
 */
export async function getScheduledReport(
  id: number
): Promise<schema.ScheduledReport | null> {
  const [report] = await db
    .select()
    .from(schema.scheduledReports)
    .where(eq(schema.scheduledReports.id, id));

  return report || null;
}

// ============================================================================
// EXECUTION
// ============================================================================

/**
 * Çalıştırılması gereken raporları bulur ve çalıştırır
 */
export async function runDueReports(): Promise<{
  executed: number;
  errors: string[];
}> {
  const result = { executed: 0, errors: [] as string[] };
  const now = new Date();

  // Çalıştırılması gereken raporları bul
  const dueReports = await db
    .select()
    .from(schema.scheduledReports)
    .where(
      and(
        eq(schema.scheduledReports.isActive, true),
        lte(schema.scheduledReports.nextRunAt, now)
      )
    );

  for (const scheduledReport of dueReports) {
    try {
      await executeScheduledReport(scheduledReport);
      result.executed++;
    } catch (error) {
      result.errors.push(`Report ${scheduledReport.id}: ${String(error)}`);
    }
  }

  return result;
}

/**
 * Tek bir zamanlanmış raporu çalıştırır
 */
export async function executeScheduledReport(
  scheduledReport: schema.ScheduledReport
): Promise<void> {
  console.log(`[Scheduler] Executing report: ${scheduledReport.name}`);

  // Tarih aralığını hesapla
  const { from, to } = calculateDateRange(scheduledReport.frequency);

  // Raporu oluştur
  const { reportId, filePath, fileSize } = await createReport(
    scheduledReport.name,
    scheduledReport.type,
    scheduledReport.format,
    from,
    to,
    scheduledReport.vehicleId || undefined,
    scheduledReport.id
  );

  // Email gönder
  const recipients = JSON.parse(scheduledReport.emailRecipients) as string[];
  if (recipients.length > 0) {
    const filename = filePath.split("/").pop() || "report";
    const typeLabels: Record<string, string> = {
      daily: "Günlük Rapor",
      weekly: "Haftalık Rapor",
      monthly: "Aylık Rapor",
      custom: "Özel Rapor",
      vehicle: "Araç Raporu",
      trip: "Seyahat Raporu",
    };

    const emailResult = await sendReportEmail(
      recipients,
      scheduledReport.name,
      typeLabels[scheduledReport.type] || scheduledReport.type,
      { from, to },
      filePath,
      filename
    );

    if (emailResult.success) {
      // Email gönderim bilgisini kaydet
      await db
        .update(schema.reports)
        .set({
          emailSentTo: JSON.stringify(recipients),
          emailSentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.reports.id, reportId));
    }
  }

  // Sonraki çalışma zamanını güncelle
  const nextRunAt = calculateNextRunTime(
    scheduledReport.frequency,
    scheduledReport.runTime,
    scheduledReport.dayOfWeek ?? undefined,
    scheduledReport.dayOfMonth ?? undefined
  );

  await db
    .update(schema.scheduledReports)
    .set({
      lastRunAt: new Date(),
      nextRunAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.scheduledReports.id, scheduledReport.id));

  console.log(
    `[Scheduler] Report ${scheduledReport.name} completed, next run: ${nextRunAt}`
  );
}

/**
 * Manuel olarak zamanlanmış raporu çalıştırır
 */
export async function runScheduledReportNow(id: number): Promise<boolean> {
  const report = await getScheduledReport(id);
  if (!report) return false;

  await executeScheduledReport(report);
  return true;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Sonraki çalışma zamanını hesaplar
 */
function calculateNextRunTime(
  frequency: string,
  runTime: string,
  dayOfWeek?: number,
  dayOfMonth?: number
): Date {
  const [hours, minutes] = runTime.split(":").map(Number);
  const now = new Date();
  const next = new Date();

  next.setHours(hours, minutes, 0, 0);

  switch (frequency) {
    case "daily":
      // Bugünkü saat geçtiyse yarına ayarla
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;

    case "weekly":
      // Belirtilen güne ayarla
      const targetDay = dayOfWeek ?? 1; // Varsayılan: Pazartesi
      const currentDay = next.getDay();
      let daysUntilTarget = targetDay - currentDay;

      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && next <= now)) {
        daysUntilTarget += 7;
      }

      next.setDate(next.getDate() + daysUntilTarget);
      break;

    case "monthly":
      // Belirtilen güne ayarla
      const targetDate = dayOfMonth ?? 1; // Varsayılan: Ayın 1'i
      next.setDate(targetDate);

      // Bu ayki tarih geçtiyse gelecek aya ayarla
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }

      // Ay sonunu aşıyorsa ayın son gününe ayarla
      const lastDay = new Date(
        next.getFullYear(),
        next.getMonth() + 1,
        0
      ).getDate();
      if (targetDate > lastDay) {
        next.setDate(lastDay);
      }
      break;
  }

  return next;
}

/**
 * Rapor için tarih aralığını hesaplar
 */
function calculateDateRange(frequency: string): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  const from = new Date(now);
  from.setHours(0, 0, 0, 0);

  switch (frequency) {
    case "daily":
      // Dün
      from.setDate(from.getDate() - 1);
      to.setDate(to.getDate() - 1);
      break;

    case "weekly":
      // Geçen hafta
      from.setDate(from.getDate() - 7);
      to.setDate(to.getDate() - 1);
      break;

    case "monthly":
      // Geçen ay
      from.setMonth(from.getMonth() - 1);
      from.setDate(1);
      to.setDate(0); // Geçen ayın son günü
      break;
  }

  return { from, to };
}

// ============================================================================
// SCHEDULER LOOP
// ============================================================================

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Scheduler'ı başlatır (her dakika kontrol eder)
 */
export function startScheduler(): void {
  if (schedulerInterval) {
    console.log("[Scheduler] Already running");
    return;
  }

  console.log("[Scheduler] Starting...");

  // İlk çalıştırma
  runDueReports().then((result) => {
    if (result.executed > 0) {
      console.log(
        `[Scheduler] Initial run: ${result.executed} reports executed`
      );
    }
  });

  // Her dakika kontrol et
  schedulerInterval = setInterval(async () => {
    const result = await runDueReports();
    if (result.executed > 0 || result.errors.length > 0) {
      console.log(
        `[Scheduler] Run complete: ${result.executed} executed, ${result.errors.length} errors`
      );
    }
  }, 60000); // 1 dakika
}

/**
 * Scheduler'ı durdurur
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scheduler] Stopped");
  }
}

/**
 * Scheduler durumunu döndürür
 */
export function isSchedulerRunning(): boolean {
  return schedulerInterval !== null;
}
