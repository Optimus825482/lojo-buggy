/**
 * Email Service - Nodemailer ile SMTP Email Gönderimi
 *
 * Bu modül:
 * - SMTP ayarlarını veritabanından okur
 * - Email gönderimi yapar
 * - Rapor dosyalarını ek olarak gönderir
 * - SMTP bağlantı testi yapar
 */

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { db } from "./db";
import * as schema from "./db/schema";
import { eq } from "drizzle-orm";

// ============================================================================
// TYPES
// ============================================================================

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer;
    contentType?: string;
  }>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================================
// SMTP CONFIGURATION
// ============================================================================

/**
 * Veritabanından SMTP ayarlarını çeker
 */
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const [settings] = await db
      .select()
      .from(schema.smtpSettings)
      .where(eq(schema.smtpSettings.isActive, true))
      .limit(1);

    if (!settings) {
      return null;
    }

    return {
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      username: settings.username,
      password: settings.password,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
    };
  } catch (error) {
    console.error("Error fetching SMTP config:", error);
    return null;
  }
}

/**
 * SMTP ayarlarını kaydeder veya günceller
 */
export async function saveSmtpConfig(config: SmtpConfig): Promise<boolean> {
  try {
    // Mevcut aktif ayarları deaktif et
    await db
      .update(schema.smtpSettings)
      .set({ isActive: false, updatedAt: new Date() });

    // Yeni ayarları ekle
    await db.insert(schema.smtpSettings).values({
      host: config.host,
      port: config.port,
      secure: config.secure,
      username: config.username,
      password: config.password,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      isActive: true,
    });

    return true;
  } catch (error) {
    console.error("Error saving SMTP config:", error);
    return false;
  }
}

// ============================================================================
// TRANSPORTER
// ============================================================================

/**
 * Nodemailer transporter oluşturur
 */
async function createTransporter(): Promise<Transporter | null> {
  const config = await getSmtpConfig();
  if (!config) {
    console.error("No SMTP configuration found");
    return null;
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
  });
}

// ============================================================================
// EMAIL SENDING
// ============================================================================

/**
 * Email gönderir
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  try {
    const transporter = await createTransporter();
    if (!transporter) {
      return { success: false, error: "SMTP yapılandırması bulunamadı" };
    }

    const config = await getSmtpConfig();
    if (!config) {
      return { success: false, error: "SMTP yapılandırması bulunamadı" };
    }

    const recipients = Array.isArray(options.to)
      ? options.to.join(", ")
      : options.to;

    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: recipients,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    });

    console.log("Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Rapor emaili gönderir
 */
export async function sendReportEmail(
  recipients: string[],
  reportName: string,
  reportType: string,
  dateRange: { from: Date; to: Date },
  attachmentPath: string,
  attachmentFilename: string
): Promise<EmailResult> {
  const fromDate = dateRange.from.toLocaleDateString("tr-TR");
  const toDate = dateRange.to.toLocaleDateString("tr-TR");

  const subject = `📊 ${reportName} - Buggy Shuttle Raporu`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0891b2, #06b6d4); padding: 20px; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🚐 Buggy Shuttle</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Rapor Bildirimi</p>
      </div>
      
      <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
        <h2 style="color: #1e293b; margin-top: 0;">${reportName}</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Rapor Tipi:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: bold;">${reportType}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Tarih Aralığı:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: bold;">${fromDate} - ${toDate}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Oluşturulma:</td>
            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: bold;">${new Date().toLocaleString(
              "tr-TR"
            )}</td>
          </tr>
        </table>
        
        <p style="color: #64748b; font-size: 14px;">
          Rapor dosyası bu emaile eklenmiştir. Detaylı bilgi için eki inceleyebilirsiniz.
        </p>
        
        <div style="background: #ecfeff; border: 1px solid #06b6d4; border-radius: 8px; padding: 15px; margin-top: 20px;">
          <p style="color: #0891b2; margin: 0; font-size: 14px;">
            📎 Ek: <strong>${attachmentFilename}</strong>
          </p>
        </div>
      </div>
      
      <div style="background: #1e293b; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
        <p style="color: #94a3b8; margin: 0; font-size: 12px;">
          Bu email Buggy Shuttle sistemi tarafından otomatik olarak gönderilmiştir.
        </p>
      </div>
    </div>
  `;

  const text = `
Buggy Shuttle - ${reportName}

Rapor Tipi: ${reportType}
Tarih Aralığı: ${fromDate} - ${toDate}
Oluşturulma: ${new Date().toLocaleString("tr-TR")}

Rapor dosyası bu emaile eklenmiştir.
  `;

  return sendEmail({
    to: recipients,
    subject,
    html,
    text,
    attachments: [
      {
        filename: attachmentFilename,
        path: attachmentPath,
      },
    ],
  });
}

// ============================================================================
// SMTP TEST
// ============================================================================

/**
 * SMTP bağlantısını test eder
 */
export async function testSmtpConnection(
  config?: SmtpConfig
): Promise<EmailResult> {
  try {
    const smtpConfig = config || (await getSmtpConfig());
    if (!smtpConfig) {
      return { success: false, error: "SMTP yapılandırması bulunamadı" };
    }

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.username,
        pass: smtpConfig.password,
      },
    });

    // Bağlantıyı doğrula
    await transporter.verify();

    // Test sonucunu kaydet
    if (!config) {
      await db
        .update(schema.smtpSettings)
        .set({
          lastTestAt: new Date(),
          lastTestResult: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.smtpSettings.isActive, true));
    }

    return { success: true };
  } catch (error) {
    console.error("SMTP test failed:", error);

    // Test sonucunu kaydet
    if (!config) {
      await db
        .update(schema.smtpSettings)
        .set({
          lastTestAt: new Date(),
          lastTestResult: false,
          updatedAt: new Date(),
        })
        .where(eq(schema.smtpSettings.isActive, true));
    }

    return { success: false, error: String(error) };
  }
}

/**
 * Test emaili gönderir
 */
export async function sendTestEmail(toEmail: string): Promise<EmailResult> {
  return sendEmail({
    to: toEmail,
    subject: "🧪 Buggy Shuttle - SMTP Test Emaili",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981, #34d399); padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">✅ Test Başarılı!</h1>
        </div>
        <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="color: #1e293b; font-size: 16px;">
            Bu email, Buggy Shuttle SMTP ayarlarının doğru yapılandırıldığını göstermektedir.
          </p>
          <p style="color: #64748b; font-size: 14px;">
            Gönderim zamanı: ${new Date().toLocaleString("tr-TR")}
          </p>
        </div>
      </div>
    `,
    text: `Buggy Shuttle SMTP Test Emaili\n\nBu email, SMTP ayarlarının doğru yapılandırıldığını göstermektedir.\nGönderim zamanı: ${new Date().toLocaleString(
      "tr-TR"
    )}`,
  });
}
