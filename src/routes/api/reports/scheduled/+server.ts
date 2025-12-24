/**
 * Scheduled Reports API
 *
 * GET /api/reports/scheduled - Zamanlanmış raporları listeler
 * POST /api/reports/scheduled - Yeni zamanlanmış rapor oluşturur
 * PUT /api/reports/scheduled?id=X - Zamanlanmış raporu günceller
 * DELETE /api/reports/scheduled?id=X - Zamanlanmış raporu siler
 * POST /api/reports/scheduled?action=toggle&id=X - Aktif/pasif yapar
 * POST /api/reports/scheduled?action=run&id=X - Manuel çalıştırır
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getScheduledReports,
  getScheduledReport,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  toggleScheduledReport,
  runScheduledReportNow,
  type ScheduledReportInput,
} from "$lib/server/scheduled-reports";

export const GET: RequestHandler = async () => {
  try {
    const reports = await getScheduledReports();

    return json({
      success: true,
      data: reports.map((r) => ({
        ...r,
        emailRecipients: JSON.parse(r.emailRecipients),
      })),
    });
  } catch (error) {
    console.error("Scheduled reports fetch error:", error);
    return json({ success: false, message: String(error) }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, url }) => {
  const action = url.searchParams.get("action");
  const id = url.searchParams.get("id");

  try {
    // Toggle aktif/pasif
    if (action === "toggle" && id) {
      const body = await request.json();
      const success = await toggleScheduledReport(parseInt(id), body.isActive);
      return json({
        success,
        message: body.isActive
          ? "Rapor aktifleştirildi"
          : "Rapor pasifleştirildi",
      });
    }

    // Manuel çalıştır
    if (action === "run" && id) {
      const success = await runScheduledReportNow(parseInt(id));
      return json({
        success,
        message: success ? "Rapor çalıştırıldı" : "Rapor bulunamadı",
      });
    }

    // Yeni rapor oluştur
    const body = await request.json();
    const input: ScheduledReportInput = {
      name: body.name,
      type: body.type,
      format: body.format || "pdf",
      frequency: body.frequency,
      vehicleId: body.vehicleId,
      emailRecipients: body.emailRecipients || [],
      runTime: body.runTime || "08:00",
      dayOfWeek: body.dayOfWeek,
      dayOfMonth: body.dayOfMonth,
    };

    // Validasyon
    if (!input.name || !input.type || !input.frequency) {
      return json(
        {
          success: false,
          message: "Ad, tip ve sıklık zorunludur",
        },
        { status: 400 }
      );
    }

    if (input.emailRecipients.length === 0) {
      return json(
        {
          success: false,
          message: "En az bir email adresi gerekli",
        },
        { status: 400 }
      );
    }

    const report = await createScheduledReport(input);

    return json({
      success: true,
      message: "Zamanlanmış rapor oluşturuldu",
      data: {
        ...report,
        emailRecipients: JSON.parse(report.emailRecipients),
      },
    });
  } catch (error) {
    console.error("Scheduled report create error:", error);
    return json({ success: false, message: String(error) }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ request, url }) => {
  try {
    const id = url.searchParams.get("id");
    if (!id) {
      return json(
        { success: false, message: "Rapor ID gerekli" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const input: Partial<ScheduledReportInput> = {};

    if (body.name) input.name = body.name;
    if (body.type) input.type = body.type;
    if (body.format) input.format = body.format;
    if (body.frequency) input.frequency = body.frequency;
    if (body.vehicleId !== undefined) input.vehicleId = body.vehicleId;
    if (body.emailRecipients) input.emailRecipients = body.emailRecipients;
    if (body.runTime) input.runTime = body.runTime;
    if (body.dayOfWeek !== undefined) input.dayOfWeek = body.dayOfWeek;
    if (body.dayOfMonth !== undefined) input.dayOfMonth = body.dayOfMonth;

    const report = await updateScheduledReport(parseInt(id), input);
    if (!report) {
      return json(
        { success: false, message: "Rapor bulunamadı" },
        { status: 404 }
      );
    }

    return json({
      success: true,
      message: "Zamanlanmış rapor güncellendi",
      data: {
        ...report,
        emailRecipients: JSON.parse(report.emailRecipients),
      },
    });
  } catch (error) {
    console.error("Scheduled report update error:", error);
    return json({ success: false, message: String(error) }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ url }) => {
  try {
    const id = url.searchParams.get("id");
    if (!id) {
      return json(
        { success: false, message: "Rapor ID gerekli" },
        { status: 400 }
      );
    }

    await deleteScheduledReport(parseInt(id));

    return json({ success: true, message: "Zamanlanmış rapor silindi" });
  } catch (error) {
    console.error("Scheduled report delete error:", error);
    return json({ success: false, message: String(error) }, { status: 500 });
  }
};
