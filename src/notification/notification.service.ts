import { Injectable } from '@nestjs/common';
import type { 
  BookingCreatedEvent, 
  BookingConfirmedEvent, 
  BookingCanceledEvent 
} from '../shared/events/booking.events';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../auth/prisma.service';

@Injectable()
export class NotificationService {
  private transporter: nodemailer.Transporter;

  constructor(private prisma: PrismaService) {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false, // Use TLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false,
      },
    });
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

  async updateNotificationSettings(userId: number, notificationsEnabled: boolean) {
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
    const fromEmail = process.env.EMAIL_USER;
    const from = fromEmail ? `Reservation <${fromEmail}>` : 'Reservation';
    
    try {
      console.log(`Attempting to send email to ${to} with subject: ${subject}`);
      const info = await this.transporter.sendMail({
        from,
        to,
        subject,
        html,
      });
      console.log('Email sent successfully:', info.messageId);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  async sendOtpEmail(to: string, code: string, purpose: 'REGISTER' | 'LOGIN' | 'RESET_PASSWORD') {
    const subject =
      purpose === 'REGISTER'
        ? 'Verify your email'
        : purpose === 'LOGIN'
          ? 'Login verification code'
          : 'Password reset code';
    const html = `
      <h2>${subject}</h2>
      <p>Your verification code is:</p>
      <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">${code}</p>
      <p>This code will expire soon. If you did not request this, you can ignore this email.</p>
    `;

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

  private bookingDetailsTable(rows: Array<{ label: string; value: string }>): string {
    const safeRows = rows.filter((r) => r.value !== undefined && r.value !== null && r.value !== '');
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
    const resourceTitle = booking.resource?.title ?? `Resource #${booking.resourceId}`;

    let amount = booking.payment?.amount;
    let currency = booking.payment?.currency ?? 'usd';
    if (amount === undefined || amount === null) {
      const durationInHours =
        (booking.endTime.getTime() - booking.startTime.getTime()) / (1000 * 60 * 60);
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
      { label: 'Payment ID', value: event.paymentId ? String(event.paymentId) : '' },
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
