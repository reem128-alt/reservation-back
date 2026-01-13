import { Injectable } from '@nestjs/common';
import type {
  BookingCreatedEvent,
  BookingConfirmedEvent,
  BookingCanceledEvent,
} from '../shared/events/booking.events';
import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';
import { PrismaService } from '../auth/prisma.service';

@Injectable()
export class NotificationService {
  private mailerSend: MailerSend | null;

  constructor(private prisma: PrismaService) {
    this.initializeMailerSend();
  }

  private initializeMailerSend() {
    if (process.env.MAILERSEND_API_KEY) {
      this.mailerSend = new MailerSend({
        apiKey: process.env.MAILERSEND_API_KEY,
      });
      console.log('[EMAIL SERVICE] MailerSend initialized');
    } else {
      console.log('[EMAIL SERVICE] No MailerSend API key found, using mock service');
      this.mailerSend = null;
    }
  }

  async handleBookingCreated(event: BookingCreatedEvent) {
    const subject = 'Booking Created - Pending Confirmation';
    const text = `Your booking #${event.bookingId} has been created and is pending confirmation.`;
    const ctx = await this.getBookingEmailContext(event.bookingId);
    const html = this.generateBookingCreatedEmail(event, ctx);

    await this.sendNotification('booking_created', event.userId, {
      subject,
      text,
      html,
    });
  }

  async handleBookingConfirmed(event: BookingConfirmedEvent) {
    const subject = 'Booking Confirmed';
    const text = `Your booking #${event.bookingId} has been confirmed!`;
    const ctx = await this.getBookingEmailContext(event.bookingId);
    const html = this.generateBookingConfirmedEmail(event, ctx);

    await this.sendNotification('booking_confirmed', event.userId, {
      subject,
      text,
      html,
    });
  }

  async handleBookingCanceled(event: BookingCanceledEvent) {
    const subject = 'Booking Canceled';
    const text = `Your booking #${event.bookingId} has been canceled.`;
    const ctx = await this.getBookingEmailContext(event.bookingId);
    const html = this.generateBookingCanceledEmail(event, ctx);

    await this.sendNotification('booking_canceled', event.userId, {
      subject,
      text,
      html,
    });
  }

  async getNotificationSettings(userId: number) {
    const user = (await (this.prisma.user as any).findUnique({
      where: { id: userId },
      select: { notificationsEnabled: true },
    })) as any;

    return {
      notificationsEnabled: user?.notificationsEnabled ?? true,
    };
  }

  async updateNotificationSettings(
    userId: number,
    notificationsEnabled: boolean,
  ) {
    const updated = (await (this.prisma.user as any).update({
      where: { id: userId },
      data: { notificationsEnabled },
      select: { notificationsEnabled: true },
    })) as any;

    return {
      notificationsEnabled: updated.notificationsEnabled,
    };
  }

  private async sendNotification(type: string, userId: number, data: any) {
    try {
      const user = (await (this.prisma.user as any).findUnique({
        where: { id: userId },
        select: { email: true, notificationsEnabled: true },
      })) as any;

      if (!user) {
        return;
      }

      if (!user.notificationsEnabled) {
        return;
      }

      if (user.email) {
        await this.sendEmail(user.email, data.subject, data.html);
      }

      console.log(`Email notification sent for ${type} to user ${userId}`);
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  private async sendEmail(to: string, subject: string, html: string) {
    // Use MailerSend if configured, otherwise use mock service
    if (this.mailerSend) {
      try {
        console.log(`[MAILERSEND] Sending email to ${to} with subject: ${subject}`);
        
        const sentFrom = new Sender(
          process.env.MAILERSEND_FROM_EMAIL || 'noreply@trial-domain.mlsender.net',
          'Reservation System'
        );
        
        const recipients = [new Recipient(to)];
        
        const emailParams = new EmailParams()
          .setFrom(sentFrom)
          .setTo(recipients)
          .setSubject(subject)
          .setHtml(html);

        const response = await this.mailerSend.email.send(emailParams);
        console.log('[MAILERSEND] Email sent successfully');
        return { success: true, emailId: response.body.message_id };
      } catch (error) {
        console.error('[MAILERSEND] Failed to send email:', error);
        // Fall back to mock service
        return this.sendMockEmail(to, subject, html);
      }
    } else {
      // Use mock service
      return this.sendMockEmail(to, subject, html);
    }
  }

  private async sendMockEmail(to: string, subject: string, html: string) {
    const otp = subject.includes('code') ? html.match(/(\d{6})/)?.[1] : null;
    
    console.log(`[MOCK EMAIL] To: ${to}`);
    console.log(`[MOCK EMAIL] Subject: ${subject}`);
    if (otp) {
      console.log(`[MOCK EMAIL] OTP: ${otp}`);
    }
    console.log(`[MOCK EMAIL] HTML content length: ${html.length} chars`);
    
    return { success: true, mockService: true };
  }

  async sendOtpEmail(
    to: string,
    code: string,
    purpose: 'REGISTER' | 'LOGIN' | 'RESET_PASSWORD',
  ) {
    const subject =
      purpose === 'REGISTER'
        ? 'Verify Your Email - Reservation Platform'
        : purpose === 'LOGIN'
          ? 'Login Verification Code - Reservation Platform'
          : 'Password Reset Code - Reservation Platform';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f6f8fb;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f6f8fb; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                      🏢 Reservation Platform
                    </h1>
                    <p style="margin: 8px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">
                      Your trusted booking solution
                    </p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 24px; font-weight: 600;">
                      ${subject.split(' - ')[0]}
                    </h2>
                    
                    <p style="margin: 0 0 30px 0; color: #475569; font-size: 16px; line-height: 1.6;">
                      ${purpose === 'REGISTER' ? 'Welcome! Please verify your email address to complete your registration.' : purpose === 'LOGIN' ? 'Use the code below to securely log in to your account.' : 'Use the code below to reset your password.'}
                    </p>
                    
                    <!-- OTP Code Box -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 30px 0;">
                      <tr>
                        <td style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border: 2px dashed #667eea; border-radius: 12px; padding: 30px; text-align: center;">
                          <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                            Your Verification Code
                          </p>
                          <p style="margin: 0; color: #667eea; font-size: 42px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                            ${code}
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 0 0 20px 0; color: #64748b; font-size: 14px; line-height: 1.6;">
                      ⏱️ This code will expire in <strong>10 minutes</strong> for your security.
                    </p>
                    
                    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 0 0 20px 0;">
                      <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                        <strong>⚠️ Security Notice:</strong> If you didn't request this code, please ignore this email or contact our support team immediately.
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">
                      <strong>Reservation Platform</strong>
                    </p>
                    <p style="margin: 0 0 15px 0; color: #94a3b8; font-size: 12px;">
                      Making reservations simple and secure
                    </p>
                    <p style="margin: 0; color: #cbd5e1; font-size: 11px;">
                      © ${new Date().getFullYear()} Reservation Platform. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Log the OTP code for development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV MODE] OTP for ${to}: ${code} (purpose: ${purpose})`);
    }

    await this.sendEmail(to, subject, html);
  }

  private wrapBookingEmail(title: string, contentHtml: string): string {
    return `
      <div style="background:#f6f8fb;padding:24px;font-family:Arial,Helvetica,sans-serif;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e7eaf0;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:18px 20px;background:#0f172a;color:#ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background:#ffffff;color:#0f172a;font-weight:700;">R</div>
                    <span style="margin-left:10px;font-size:14px;font-weight:700;letter-spacing:0.4px;">Reservation</span>
                  </td>
                  <td style="text-align:right;vertical-align:middle;font-size:12px;opacity:0.9;">${title}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 20px;">
              ${contentHtml}
              <div style="margin-top:18px;border-top:1px solid #eef1f6;padding-top:14px;color:#64748b;font-size:12px;line-height:1.5;">
                If you have questions about your booking, reply to this email.
              </div>
            </td>
          </tr>
        </table>
      </div>
    `;
  }

  private bookingDetailsTable(
    rows: Array<{ label: string; value: string }>,
  ): string {
    const safeRows = rows.filter(
      (r) => r.value !== undefined && r.value !== null && r.value !== '',
    );
    const htmlRows = safeRows
      .map(
        (r) => `
          <tr>
            <td style="padding:10px 12px;border-top:1px solid #eef1f6;color:#334155;font-size:13px;width:38%;background:#f8fafc;"><strong>${r.label}</strong></td>
            <td style="padding:10px 12px;border-top:1px solid #eef1f6;color:#0f172a;font-size:13px;">${r.value}</td>
          </tr>
        `,
      )
      .join('');

    return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #eef1f6;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0;">
        ${htmlRows}
      </table>
    `;
  }

  private async getBookingEmailContext(bookingId: number) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        resource: {
          select: {
            title: true,
            price: true,
          },
        },
        payment: {
          select: {
            amount: true,
            currency: true,
          },
        },
      },
    });

    if (!booking) {
      return {
        userName: 'User',
        resourceTitle: `Resource #${bookingId}`,
        amountText: 'N/A',
      };
    }

    const userName = booking.user?.name ?? 'User';
    const resourceTitle =
      booking.resource?.title ?? `Resource #${booking.resourceId}`;

    let amount = booking.payment?.amount;
    let currency = booking.payment?.currency ?? 'usd';
    if (amount === undefined || amount === null) {
      const durationInHours =
        (booking.endTime.getTime() - booking.startTime.getTime()) /
        (1000 * 60 * 60);
      amount = durationInHours * (booking.resource?.price ?? 0);
      currency = 'usd';
    }

    const amountText = `$${Number(amount).toFixed(2)} ${String(currency).toUpperCase()}`;

    return {
      userName,
      resourceTitle,
      amountText,
    };
  }

  private generateBookingCreatedEmail(
    event: BookingCreatedEvent,
    ctx: { userName: string; resourceTitle: string; amountText: string },
  ): string {
    const details = this.bookingDetailsTable([
      { label: 'Booking ID', value: String(event.bookingId) },
      { label: 'Resource', value: ctx.resourceTitle },
      { label: 'Amount', value: ctx.amountText },
      { label: 'Start time', value: event.startTime.toLocaleString() },
      { label: 'End time', value: event.endTime.toLocaleString() },
      { label: 'Status', value: event.status },
    ]);

    const content = `
      <h2 style="margin:0 0 10px 0;color:#0f172a;font-size:22px;line-height:1.25;">Booking Created</h2>
      <p style="margin:0 0 14px 0;color:#334155;font-size:14px;">Hi <strong>${ctx.userName}</strong>, your booking has been created and is pending confirmation.</p>
      ${details}
      <div style="margin-top:16px;padding:12px 14px;background:#eff6ff;border:1px solid #dbeafe;border-radius:10px;color:#1e3a8a;font-size:13px;">
        You'll receive another email once your booking is confirmed.
      </div>
    `;

    return this.wrapBookingEmail('Booking Created', content);
  }

  private generateBookingConfirmedEmail(
    event: BookingConfirmedEvent,
    ctx: { userName: string; resourceTitle: string; amountText: string },
  ): string {
    const details = this.bookingDetailsTable([
      { label: 'Booking ID', value: String(event.bookingId) },
      { label: 'Resource', value: ctx.resourceTitle },
      { label: 'Amount', value: ctx.amountText },
      {
        label: 'Payment ID',
        value: event.paymentId ? String(event.paymentId) : '',
      },
    ]);

    const content = `
      <h2 style="margin:0 0 10px 0;color:#0f172a;font-size:22px;line-height:1.25;">Booking Confirmed</h2>
      <p style="margin:0 0 14px 0;color:#334155;font-size:14px;">Hi <strong>${ctx.userName}</strong>, great news! Your booking is confirmed.</p>
      <div style="margin:0 0 14px 0;padding:12px 14px;background:#ecfdf5;border:1px solid #d1fae5;border-radius:10px;color:#065f46;font-size:13px;">
        Status: <strong>CONFIRMED</strong>
      </div>
      ${details}
      <div style="margin-top:16px;color:#334155;font-size:14px;">Thank you for using Reservation.</div>
    `;

    return this.wrapBookingEmail('Booking Confirmed', content);
  }

  private generateBookingCanceledEmail(
    event: BookingCanceledEvent,
    ctx: { userName: string; resourceTitle: string; amountText: string },
  ): string {
    const details = this.bookingDetailsTable([
      { label: 'Booking ID', value: String(event.bookingId) },
      { label: 'Resource', value: ctx.resourceTitle },
      { label: 'Amount', value: ctx.amountText },
      { label: 'Reason', value: event.reason ? String(event.reason) : '' },
    ]);

    const content = `
      <h2 style="margin:0 0 10px 0;color:#0f172a;font-size:22px;line-height:1.25;">Booking Canceled</h2>
      <p style="margin:0 0 14px 0;color:#334155;font-size:14px;">Hi <strong>${ctx.userName}</strong>, your booking has been canceled.</p>
      <div style="margin:0 0 14px 0;padding:12px 14px;background:#fef2f2;border:1px solid #fee2e2;border-radius:10px;color:#991b1b;font-size:13px;">
        Status: <strong>CANCELED</strong>
      </div>
      ${details}
      <div style="margin-top:16px;color:#334155;font-size:14px;">If you did not request this cancellation, please contact support.</div>
    `;

    return this.wrapBookingEmail('Booking Canceled', content);
  }
}
