# Gmail SMTP Setup Guide

This application now uses Gmail SMTP with Nodemailer instead of MailerSend.

## Prerequisites

You need a Gmail account to send emails from your application.

## Step 1: Enable 2-Factor Authentication

1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security**
3. Enable **2-Step Verification** if not already enabled

## Step 2: Generate App Password

1. Go to https://myaccount.google.com/apppasswords
2. Select **Mail** as the app
3. Select **Other (Custom name)** as the device
4. Enter a name like "Reservation Platform"
5. Click **Generate**
6. Copy the 16-character app password (remove spaces)

## Step 3: Update Environment Variables

Update your `.env` file with the following:

```env
# Email Service - Gmail SMTP
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-16-char-app-password"
EMAIL_FROM_NAME="Reservation Platform"
```

**Important Notes:**
- Use your Gmail address for `SMTP_USER`
- Use the **App Password** (not your regular Gmail password) for `SMTP_PASS`
- Port 587 uses STARTTLS (SMTP_SECURE=false)
- Port 465 uses SSL/TLS (SMTP_SECURE=true)

## Step 4: Gmail Sending Limits

- **Free Gmail accounts**: 500 emails per day
- **Google Workspace accounts**: 2,000 emails per day

If you exceed these limits, consider using a dedicated email service like SendGrid, AWS SES, or Mailgun.

## Troubleshooting

### "Invalid login" error
- Make sure you're using an **App Password**, not your regular Gmail password
- Verify 2-Factor Authentication is enabled
- Check that SMTP_USER matches the email that generated the App Password

### "Connection timeout" error
- Check your firewall settings
- Verify SMTP_HOST and SMTP_PORT are correct
- Try port 465 with SMTP_SECURE=true

### Emails going to spam
- Add SPF and DKIM records to your domain (if using custom domain)
- Warm up your sending by starting with small volumes
- Avoid spam trigger words in subject lines

## Alternative SMTP Providers

If Gmail doesn't meet your needs, you can use other SMTP providers:

### SendGrid
```env
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="apikey"
SMTP_PASS="your-sendgrid-api-key"
```

### AWS SES
```env
SMTP_HOST="email-smtp.us-east-1.amazonaws.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-aws-smtp-username"
SMTP_PASS="your-aws-smtp-password"
```

### Mailgun
```env
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="postmaster@your-domain.mailgun.org"
SMTP_PASS="your-mailgun-smtp-password"
```
