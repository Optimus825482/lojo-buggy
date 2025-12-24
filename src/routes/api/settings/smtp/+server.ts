/**
 * SMTP Settings API
 *
 * GET /api/settings/smtp - SMTP ayarlarını getirir
 * POST /api/settings/smtp - SMTP ayarlarını kaydeder
 * POST /api/settings/smtp?action=test - SMTP bağlantısını test eder
 * POST /api/settings/smtp?action=send-test - Test emaili gönderir
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import * as schema from "$lib/server/db/schema";
import { eq } from "drizzle-orm";
import {
  getSmtpConfig,
  saveSmtpConfig,
  testSmtpConnection,
  sendTestEmail,
  type SmtpConfig,
} from "$lib/server/email";

export const GET: RequestHandler = async () => {
  try {
    const [settings] = await db
      .select()
      .from(schema.smtpSettings)
      .where(eq(schema.smtpSettings.isActive, true))
      .limit(1);

    if (!settings) {
      return json({
        success: true,
        data: null,
        message: "SMTP ayarları yapılandırılmamış",
      });
    }

    // Şifreyi maskele
    return json({
      success: true,
      data: {
        id: settings.id,
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        username: settings.username,
        password: "********", // Şifreyi gösterme
        fromEmail: settings.fromEmail,
        fromName: settings.fromName,
        isActive: settings.isActive,
        lastTestAt: settings.lastTestAt,
        lastTestResult: settings.lastTestResult,
      },
    });
  } catch (error) {
    console.error("SMTP settings fetch error:", error);
    return json({ success: false, message: String(error) }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, url }) => {
  const action = url.searchParams.get("action");

  try {
    const body = await request.json();

    // Test bağlantısı
    if (action === "test") {
      const config: SmtpConfig = {
        host: body.host,
        port: body.port,
        secure: body.secure,
        username: body.username,
        password: body.password,
        fromEmail: body.fromEmail,
        fromName: body.fromName || "Buggy Shuttle",
      };

      const result = await testSmtpConnection(config);
      return json({
        success: result.success,
        message: result.success
          ? "SMTP bağlantısı başarılı"
          : `Bağlantı hatası: ${result.error}`,
      });
    }

    // Test emaili gönder
    if (action === "send-test") {
      const { email } = body;
      if (!email) {
        return json(
          { success: false, message: "Email adresi gerekli" },
          { status: 400 }
        );
      }

      const result = await sendTestEmail(email);
      return json({
        success: result.success,
        message: result.success
          ? `Test emaili ${email} adresine gönderildi`
          : `Email gönderilemedi: ${result.error}`,
      });
    }

    // Ayarları kaydet
    const config: SmtpConfig = {
      host: body.host,
      port: body.port || 587,
      secure: body.secure || false,
      username: body.username,
      password: body.password,
      fromEmail: body.fromEmail,
      fromName: body.fromName || "Buggy Shuttle",
    };

    // Validasyon
    if (
      !config.host ||
      !config.username ||
      !config.password ||
      !config.fromEmail
    ) {
      return json(
        {
          success: false,
          message: "Host, kullanıcı adı, şifre ve gönderen email zorunludur",
        },
        { status: 400 }
      );
    }

    const saved = await saveSmtpConfig(config);
    if (!saved) {
      return json(
        { success: false, message: "Ayarlar kaydedilemedi" },
        { status: 500 }
      );
    }

    return json({
      success: true,
      message: "SMTP ayarları kaydedildi",
    });
  } catch (error) {
    console.error("SMTP settings save error:", error);
    return json({ success: false, message: String(error) }, { status: 500 });
  }
};
