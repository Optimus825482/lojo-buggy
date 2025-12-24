/**
 * Report Download API
 *
 * GET /api/reports/download/[id] - Rapor dosyasını indirir
 */

import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";

export const GET: RequestHandler = async ({ params }) => {
  try {
    const reportId = parseInt(params.id);
    if (isNaN(reportId)) {
      return new Response("Geçersiz rapor ID", { status: 400 });
    }

    // Raporu bul
    const [report] = await db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.id, reportId));

    if (!report) {
      return new Response("Rapor bulunamadı", { status: 404 });
    }

    if (!report.filePath || !fs.existsSync(report.filePath)) {
      return new Response("Rapor dosyası bulunamadı", { status: 404 });
    }

    // Dosyayı oku
    const fileBuffer = fs.readFileSync(report.filePath);
    const filename = report.filePath.split("/").pop() || "report";

    // Content-Type belirle
    let contentType = "application/octet-stream";
    if (report.format === "pdf") {
      contentType = "application/pdf";
    } else if (report.format === "excel") {
      contentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else if (report.format === "json") {
      contentType = "application/json";
    }

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Report download error:", error);
    return new Response("İndirme hatası", { status: 500 });
  }
};
