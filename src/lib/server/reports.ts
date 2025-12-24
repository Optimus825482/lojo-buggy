/**
 * Report Generation Service
 *
 * Bu modül:
 * - Günlük/Haftalık/Aylık raporlar oluşturur
 * - Excel ve PDF formatında export yapar
 * - Traccar verilerini kullanarak trip raporları oluşturur
 * - Araç performans raporları oluşturur
 */

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { db } from "./db";
import * as schema from "./db/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import * as traccar from "./traccar";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// TYPES
// ============================================================================

export interface ReportData {
  title: string;
  dateRange: { from: Date; to: Date };
  generatedAt: Date;
  summary: ReportSummary;
  vehicles: VehicleReportData[];
  trips: TripReportData[];
  calls: CallReportData[];
  dailyStats: DailyStatData[];
}

export interface ReportSummary {
  totalVehicles: number;
  activeVehicles: number;
  totalTrips: number;
  totalDistance: number; // km
  totalDuration: number; // dakika
  avgSpeed: number; // km/h
  totalCalls: number;
  completedCalls: number;
  cancelledCalls: number;
  avgWaitTime: number; // dakika
}

export interface VehicleReportData {
  id: number;
  name: string;
  plateNumber: string;
  tripCount: number;
  totalDistance: number;
  totalDuration: number;
  avgSpeed: number;
  maxSpeed: number;
  onlineTime: number; // dakika
}

export interface TripReportData {
  id: number;
  vehicleName: string;
  startTime: Date;
  endTime: Date | null;
  duration: number; // dakika
  distance: number; // km
  avgSpeed: number;
  maxSpeed: number;
  startLocation: string;
  endLocation: string;
}

export interface CallReportData {
  id: number;
  stopName: string;
  status: string;
  vehicleName: string | null;
  createdAt: Date;
  assignedAt: Date | null;
  completedAt: Date | null;
  waitTime: number | null; // dakika
}

export interface DailyStatData {
  date: Date;
  totalCalls: number;
  completedCalls: number;
  cancelledCalls: number;
  totalTrips: number;
  avgWaitTime: number;
}

// ============================================================================
// REPORT DATA COLLECTION
// ============================================================================

/**
 * Rapor verilerini toplar
 */
export async function collectReportData(
  from: Date,
  to: Date,
  vehicleId?: number
): Promise<ReportData> {
  // Araçları çek
  const vehiclesQuery = vehicleId
    ? db.select().from(schema.vehicles).where(eq(schema.vehicles.id, vehicleId))
    : db.select().from(schema.vehicles);
  const vehicles = await vehiclesQuery;

  // Trip'leri çek
  let tripsQuery = db
    .select()
    .from(schema.trips)
    .where(
      and(gte(schema.trips.startTime, from), lte(schema.trips.startTime, to))
    )
    .orderBy(desc(schema.trips.startTime));

  if (vehicleId) {
    tripsQuery = db
      .select()
      .from(schema.trips)
      .where(
        and(
          gte(schema.trips.startTime, from),
          lte(schema.trips.startTime, to),
          eq(schema.trips.vehicleId, vehicleId)
        )
      )
      .orderBy(desc(schema.trips.startTime));
  }
  const trips = await tripsQuery;

  // Çağrıları çek
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
      and(gte(schema.calls.createdAt, from), lte(schema.calls.createdAt, to))
    )
    .orderBy(desc(schema.calls.createdAt));

  // Durakları çek
  const stops = await db.select().from(schema.stops);
  const stopsMap = new Map(stops.map((s) => [s.id, s]));

  // Özet hesapla
  const totalDistance =
    trips.reduce((sum, t) => sum + (t.distance || 0), 0) / 1000; // metre -> km
  const totalDuration =
    trips.reduce((sum, t) => sum + (t.duration || 0), 0) / 60; // saniye -> dakika
  const avgSpeed =
    trips.length > 0
      ? trips.reduce((sum, t) => sum + (t.avgSpeed || 0), 0) / trips.length
      : 0;

  const completedCalls = calls.filter(
    (c) => c.call.status === "completed"
  ).length;
  const cancelledCalls = calls.filter(
    (c) => c.call.status === "cancelled"
  ).length;

  // Bekleme süresi hesapla
  const waitTimes = calls
    .filter((c) => c.call.assignedAt && c.call.createdAt)
    .map((c) => {
      const created = new Date(c.call.createdAt).getTime();
      const assigned = new Date(c.call.assignedAt!).getTime();
      return (assigned - created) / 60000; // ms -> dakika
    });
  const avgWaitTime =
    waitTimes.length > 0
      ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
      : 0;

  // Araç bazlı veriler
  const vehicleReports: VehicleReportData[] = vehicles.map((v) => {
    const vehicleTrips = trips.filter((t) => t.vehicleId === v.id);
    const vTotalDistance =
      vehicleTrips.reduce((sum, t) => sum + (t.distance || 0), 0) / 1000;
    const vTotalDuration =
      vehicleTrips.reduce((sum, t) => sum + (t.duration || 0), 0) / 60;
    const vAvgSpeed =
      vehicleTrips.length > 0
        ? vehicleTrips.reduce((sum, t) => sum + (t.avgSpeed || 0), 0) /
          vehicleTrips.length
        : 0;
    const vMaxSpeed = Math.max(...vehicleTrips.map((t) => t.maxSpeed || 0), 0);

    return {
      id: v.id,
      name: v.name,
      plateNumber: v.plateNumber,
      tripCount: vehicleTrips.length,
      totalDistance: Math.round(vTotalDistance * 100) / 100,
      totalDuration: Math.round(vTotalDuration),
      avgSpeed: Math.round(vAvgSpeed * 10) / 10,
      maxSpeed: Math.round(vMaxSpeed * 10) / 10,
      onlineTime: 0, // TODO: Traccar'dan hesaplanabilir
    };
  });

  // Trip verileri
  const tripReports: TripReportData[] = trips.map((t) => {
    const vehicle = vehicles.find((v) => v.id === t.vehicleId);
    const startStop = t.startStopId ? stopsMap.get(t.startStopId) : null;
    const endStop = t.endStopId ? stopsMap.get(t.endStopId) : null;

    return {
      id: t.id,
      vehicleName: vehicle?.name || "Bilinmiyor",
      startTime: t.startTime,
      endTime: t.endTime,
      duration: Math.round((t.duration || 0) / 60),
      distance: Math.round(((t.distance || 0) / 1000) * 100) / 100,
      avgSpeed: Math.round((t.avgSpeed || 0) * 10) / 10,
      maxSpeed: Math.round((t.maxSpeed || 0) * 10) / 10,
      startLocation:
        startStop?.name ||
        `${t.startLat?.toFixed(5)}, ${t.startLng?.toFixed(5)}`,
      endLocation:
        endStop?.name ||
        (t.endLat ? `${t.endLat.toFixed(5)}, ${t.endLng?.toFixed(5)}` : "-"),
    };
  });

  // Çağrı verileri
  const callReports: CallReportData[] = calls.map((c) => {
    let waitTime: number | null = null;
    if (c.call.assignedAt && c.call.createdAt) {
      waitTime = Math.round(
        (new Date(c.call.assignedAt).getTime() -
          new Date(c.call.createdAt).getTime()) /
          60000
      );
    }

    return {
      id: c.call.id,
      stopName: c.stop?.name || "Bilinmiyor",
      status: c.call.status,
      vehicleName: c.vehicle?.name || null,
      createdAt: c.call.createdAt,
      assignedAt: c.call.assignedAt,
      completedAt: c.call.completedAt,
      waitTime,
    };
  });

  return {
    title: vehicleId ? `${vehicles[0]?.name || "Araç"} Raporu` : "Genel Rapor",
    dateRange: { from, to },
    generatedAt: new Date(),
    summary: {
      totalVehicles: vehicles.length,
      activeVehicles: vehicles.filter((v) => v.status !== "offline").length,
      totalTrips: trips.length,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalDuration: Math.round(totalDuration),
      avgSpeed: Math.round(avgSpeed * 10) / 10,
      totalCalls: calls.length,
      completedCalls,
      cancelledCalls,
      avgWaitTime: Math.round(avgWaitTime * 10) / 10,
    },
    vehicles: vehicleReports,
    trips: tripReports,
    calls: callReports,
    dailyStats: [],
  };
}

// ============================================================================
// EXCEL EXPORT
// ============================================================================

/**
 * Excel raporu oluşturur
 */
export async function generateExcelReport(data: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Buggy Shuttle";
  workbook.created = new Date();

  // Özet Sayfası
  const summarySheet = workbook.addWorksheet("Özet");
  addSummarySheet(summarySheet, data);

  // Araçlar Sayfası
  if (data.vehicles.length > 0) {
    const vehiclesSheet = workbook.addWorksheet("Araçlar");
    addVehiclesSheet(vehiclesSheet, data.vehicles);
  }

  // Seyahatler Sayfası
  if (data.trips.length > 0) {
    const tripsSheet = workbook.addWorksheet("Seyahatler");
    addTripsSheet(tripsSheet, data.trips);
  }

  // Çağrılar Sayfası
  if (data.calls.length > 0) {
    const callsSheet = workbook.addWorksheet("Çağrılar");
    addCallsSheet(callsSheet, data.calls);
  }

  return (await workbook.xlsx.writeBuffer()) as Buffer;
}

function addSummarySheet(sheet: ExcelJS.Worksheet, data: ReportData) {
  // Başlık
  sheet.mergeCells("A1:D1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = data.title;
  titleCell.font = { size: 18, bold: true, color: { argb: "FF0891B2" } };
  titleCell.alignment = { horizontal: "center" };

  // Tarih aralığı
  sheet.mergeCells("A2:D2");
  const dateCell = sheet.getCell("A2");
  dateCell.value = `${formatDate(data.dateRange.from)} - ${formatDate(
    data.dateRange.to
  )}`;
  dateCell.font = { size: 12, color: { argb: "FF64748B" } };
  dateCell.alignment = { horizontal: "center" };

  // Boşluk
  sheet.addRow([]);

  // Özet tablosu
  const summaryData = [
    ["Metrik", "Değer"],
    ["Toplam Araç", data.summary.totalVehicles],
    ["Aktif Araç", data.summary.activeVehicles],
    ["Toplam Seyahat", data.summary.totalTrips],
    ["Toplam Mesafe", `${data.summary.totalDistance} km`],
    ["Toplam Süre", `${data.summary.totalDuration} dk`],
    ["Ortalama Hız", `${data.summary.avgSpeed} km/h`],
    ["Toplam Çağrı", data.summary.totalCalls],
    ["Tamamlanan Çağrı", data.summary.completedCalls],
    ["İptal Edilen Çağrı", data.summary.cancelledCalls],
    ["Ort. Bekleme Süresi", `${data.summary.avgWaitTime} dk`],
  ];

  summaryData.forEach((row, index) => {
    const excelRow = sheet.addRow(row);
    if (index === 0) {
      excelRow.font = { bold: true };
      excelRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0891B2" },
      };
      excelRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    }
  });

  // Sütun genişlikleri
  sheet.getColumn(1).width = 25;
  sheet.getColumn(2).width = 20;
}

function addVehiclesSheet(
  sheet: ExcelJS.Worksheet,
  vehicles: VehicleReportData[]
) {
  // Başlık satırı
  const headers = [
    "Araç Adı",
    "Plaka",
    "Seyahat Sayısı",
    "Toplam Mesafe (km)",
    "Toplam Süre (dk)",
    "Ort. Hız (km/h)",
    "Max Hız (km/h)",
  ];
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0891B2" },
  };

  // Veri satırları
  vehicles.forEach((v) => {
    sheet.addRow([
      v.name,
      v.plateNumber,
      v.tripCount,
      v.totalDistance,
      v.totalDuration,
      v.avgSpeed,
      v.maxSpeed,
    ]);
  });

  // Sütun genişlikleri
  sheet.columns.forEach((col) => {
    col.width = 18;
  });
}

function addTripsSheet(sheet: ExcelJS.Worksheet, trips: TripReportData[]) {
  const headers = [
    "Araç",
    "Başlangıç",
    "Bitiş",
    "Süre (dk)",
    "Mesafe (km)",
    "Ort. Hız",
    "Max Hız",
    "Başlangıç Konum",
    "Bitiş Konum",
  ];
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0891B2" },
  };

  trips.forEach((t) => {
    sheet.addRow([
      t.vehicleName,
      formatDateTime(t.startTime),
      t.endTime ? formatDateTime(t.endTime) : "-",
      t.duration,
      t.distance,
      t.avgSpeed,
      t.maxSpeed,
      t.startLocation,
      t.endLocation,
    ]);
  });

  sheet.columns.forEach((col) => {
    col.width = 18;
  });
}

function addCallsSheet(sheet: ExcelJS.Worksheet, calls: CallReportData[]) {
  const headers = [
    "Durak",
    "Durum",
    "Araç",
    "Oluşturulma",
    "Atanma",
    "Tamamlanma",
    "Bekleme (dk)",
  ];
  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0891B2" },
  };

  const statusMap: Record<string, string> = {
    pending: "Bekliyor",
    assigned: "Atandı",
    completed: "Tamamlandı",
    cancelled: "İptal",
  };

  calls.forEach((c) => {
    sheet.addRow([
      c.stopName,
      statusMap[c.status] || c.status,
      c.vehicleName || "-",
      formatDateTime(c.createdAt),
      c.assignedAt ? formatDateTime(c.assignedAt) : "-",
      c.completedAt ? formatDateTime(c.completedAt) : "-",
      c.waitTime ?? "-",
    ]);
  });

  sheet.columns.forEach((col) => {
    col.width = 18;
  });
}

// ============================================================================
// PDF EXPORT
// ============================================================================

/**
 * PDF raporu oluşturur
 */
export async function generatePdfReport(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Başlık
    doc.fontSize(24).fillColor("#0891b2").text(data.title, { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .fillColor("#64748b")
      .text(
        `${formatDate(data.dateRange.from)} - ${formatDate(data.dateRange.to)}`,
        { align: "center" }
      );
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .fillColor("#94a3b8")
      .text(`Oluşturulma: ${formatDateTime(data.generatedAt)}`, {
        align: "center",
      });
    doc.moveDown(2);

    // Özet Bölümü
    doc.fontSize(16).fillColor("#1e293b").text("📊 Özet", { underline: true });
    doc.moveDown(0.5);

    const summaryItems = [
      ["Toplam Araç", data.summary.totalVehicles.toString()],
      ["Aktif Araç", data.summary.activeVehicles.toString()],
      ["Toplam Seyahat", data.summary.totalTrips.toString()],
      ["Toplam Mesafe", `${data.summary.totalDistance} km`],
      ["Toplam Süre", `${data.summary.totalDuration} dk`],
      ["Ortalama Hız", `${data.summary.avgSpeed} km/h`],
      ["Toplam Çağrı", data.summary.totalCalls.toString()],
      ["Tamamlanan", data.summary.completedCalls.toString()],
      ["İptal Edilen", data.summary.cancelledCalls.toString()],
      ["Ort. Bekleme", `${data.summary.avgWaitTime} dk`],
    ];

    doc.fontSize(11).fillColor("#334155");
    summaryItems.forEach(([label, value]) => {
      doc
        .text(`${label}: `, { continued: true })
        .fillColor("#0891b2")
        .text(value)
        .fillColor("#334155");
    });
    doc.moveDown(1.5);

    // Araçlar Bölümü
    if (data.vehicles.length > 0) {
      doc
        .fontSize(16)
        .fillColor("#1e293b")
        .text("🚐 Araç Performansı", { underline: true });
      doc.moveDown(0.5);

      data.vehicles.slice(0, 10).forEach((v) => {
        doc.fontSize(11).fillColor("#334155");
        doc.text(`${v.name} (${v.plateNumber})`, { continued: false });
        doc.fontSize(10).fillColor("#64748b");
        doc.text(
          `  Seyahat: ${v.tripCount} | Mesafe: ${v.totalDistance} km | Ort. Hız: ${v.avgSpeed} km/h`
        );
        doc.moveDown(0.3);
      });
      doc.moveDown(1);
    }

    // Son Seyahatler
    if (data.trips.length > 0) {
      doc.addPage();
      doc
        .fontSize(16)
        .fillColor("#1e293b")
        .text("🛣️ Son Seyahatler", { underline: true });
      doc.moveDown(0.5);

      data.trips.slice(0, 15).forEach((t) => {
        doc.fontSize(10).fillColor("#334155");
        doc.text(`${t.vehicleName} - ${formatDateTime(t.startTime)}`);
        doc.fontSize(9).fillColor("#64748b");
        doc.text(`  ${t.startLocation} → ${t.endLocation}`);
        doc.text(
          `  Süre: ${t.duration} dk | Mesafe: ${t.distance} km | Hız: ${t.avgSpeed} km/h`
        );
        doc.moveDown(0.4);
      });
    }

    // Footer
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor("#94a3b8");
      doc.text(
        `Buggy Shuttle - Sayfa ${i + 1}/${pageCount}`,
        50,
        doc.page.height - 30,
        { align: "center" }
      );
    }

    doc.end();
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================================================
// REPORT GENERATION & STORAGE
// ============================================================================

const REPORTS_DIR = "./static/reports";

/**
 * Rapor dosyasını kaydeder
 */
export async function saveReportFile(
  buffer: Buffer,
  filename: string
): Promise<string> {
  // Klasör yoksa oluştur
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const filePath = path.join(REPORTS_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Tam rapor oluşturur ve kaydeder
 */
export async function createReport(
  name: string,
  type: "daily" | "weekly" | "monthly" | "custom" | "vehicle" | "trip",
  format: "pdf" | "excel",
  from: Date,
  to: Date,
  vehicleId?: number,
  scheduledReportId?: number
): Promise<{ reportId: number; filePath: string; fileSize: number }> {
  // Veri topla
  const data = await collectReportData(from, to, vehicleId);

  // Dosya oluştur
  let buffer: Buffer;
  let extension: string;

  if (format === "excel") {
    buffer = await generateExcelReport(data);
    extension = "xlsx";
  } else {
    buffer = await generatePdfReport(data);
    extension = "pdf";
  }

  // Dosya adı
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${type}_${timestamp}.${extension}`;

  // Kaydet
  const filePath = await saveReportFile(buffer, filename);
  const fileSize = buffer.length;

  // Veritabanına kaydet
  const [report] = await db
    .insert(schema.reports)
    .values({
      name,
      type,
      format,
      dateFrom: from,
      dateTo: to,
      vehicleId,
      filePath,
      fileSize,
      generatedAt: new Date(),
      scheduledReportId,
    })
    .returning();

  return {
    reportId: report.id,
    filePath,
    fileSize,
  };
}

/**
 * Rapor listesini getirir
 */
export async function getReports(limit = 50): Promise<schema.Report[]> {
  return db
    .select()
    .from(schema.reports)
    .orderBy(desc(schema.reports.createdAt))
    .limit(limit);
}

/**
 * Raporu siler
 */
export async function deleteReport(reportId: number): Promise<boolean> {
  const [report] = await db
    .select()
    .from(schema.reports)
    .where(eq(schema.reports.id, reportId));

  if (!report) return false;

  // Dosyayı sil
  if (report.filePath && fs.existsSync(report.filePath)) {
    fs.unlinkSync(report.filePath);
  }

  // Veritabanından sil
  await db.delete(schema.reports).where(eq(schema.reports.id, reportId));
  return true;
}
