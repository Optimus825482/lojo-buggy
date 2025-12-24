/**
 * Reports API
 *
 * GET /api/reports - Rapor listesini getirir
 * POST /api/reports - Yeni rapor oluşturur
 * DELETE /api/reports?id=X - Raporu siler
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getReports,
  createReport,
  deleteReport,
  collectReportData,
} from "$lib/server/reports";
import { sendReportEmail } from "$lib/server/email";

export const GET: RequestHandler = async ({ url }) => {
  try {
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const reports = await getReports(limit);

    return json({
      success: true,
      data: reports.map((r) => ({
        ...r,
        emailSentTo: r.emailSentTo ? JSON.parse(r.emailSentTo) : null,
        metadata: r.metadata ? JSON.parse(r.metadata) : null,
      })),
    });
  } catch (error) {
    console.error("Reports fetch error:", error);
    return json({ success: false, message: String(error) }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      name,
      type,
      format,
      dateFrom,
      dateTo,
      vehicleId,
      sendEmail,
      emailRecipients,
    } = body;

    // Validasyon
    if (!name || !type || !format || !dateFrom || !dateTo) {
      return json(
        {
          success: false,
          message: "Ad, tip, format ve tarih aralığı zorunludur",
        },
        { status: 400 }
      );
    }

    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    if (from > to) {
      return json(
        {
          success: false,
          message: "Başlangıç tarihi bitiş tarihinden sonra olamaz",
        },
        { status: 400 }
      );
    }

    // Rapor oluştur
    const { reportId, filePath, fileSize } = await createReport(
      name,
      type,
      format,
      from,
      to,
      vehicleId || undefined
    );

    // Email gönder
    let emailSent = false;
    if (sendEmail && emailRecipients && emailRecipients.length > 0) {
      const typeLabels: Record<string, string> = {
        daily: "Günlük Rapor",
        weekly: "Haftalık Rapor",
        monthly: "Aylık Rapor",
        custom: "Özel Rapor",
        vehicle: "Araç Raporu",
        trip: "Seyahat Raporu",
      };

      const filename = filePath.split("/").pop() || "report";
      const result = await sendReportEmail(
        emailRecipients,
        name,
        typeLabels[type] || type,
        { from, to },
        filePath,
        filename
      );

      emailSent = result.success;
    }

    return json({
      success: true,
      message: "Rapor oluşturuldu",
      data: {
        reportId,
        filePath,
        fileSize,
        emailSent,
      },
    });
  } catch (error) {
    console.error("Report create error:", error);
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

    const deleted = await deleteReport(parseInt(id));
    if (!deleted) {
      return json(
        { success: false, message: "Rapor bulunamadı" },
        { status: 404 }
      );
    }

    return json({ success: true, message: "Rapor silindi" });
  } catch (error) {
    console.error("Report delete error:", error);
    return json({ success: false, message: String(error) }, { status: 500 });
  }
};
