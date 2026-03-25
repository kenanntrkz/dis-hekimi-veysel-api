import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
});

const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@dtveyselarslan.com';

export async function sendAppointmentNotification(
  to: string,
  name: string,
  date: Date,
  status: 'confirmed' | 'cancelled'
) {
  const isConfirmed = status === 'confirmed';
  const dateStr = date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const subject = isConfirmed ? '✅ Randevunuz Onaylandı' : '❌ Randevunuz İptal Edildi';
  const color = isConfirmed ? '#0891b2' : '#dc2626';
  const icon = isConfirmed ? '✅' : '❌';
  const message = isConfirmed
    ? 'Randevunuz onaylandı. Belirtilen tarih ve saatte kliniğimizde sizi bekliyoruz.'
    : 'Randevunuz maalesef iptal edilmiştir. Yeni randevu için bizimle iletişime geçebilirsiniz.';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background: #f3f4f6; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="background: ${color}; padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px;">${icon} ${subject}</h1>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #374151;">Sayın <strong>${name}</strong>,</p>
      <p style="font-size: 15px; color: #6b7280;">${message}</p>
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <p style="margin: 4px 0; color: #374151;"><strong>📅 Tarih:</strong> ${dateStr}</p>
        <p style="margin: 4px 0; color: #374151;"><strong>🕐 Saat:</strong> ${timeStr}</p>
      </div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
      <p style="color: #9ca3af; font-size: 13px; margin: 0;">
        <strong>Dt. Veysel Arslan</strong><br>
        Yeni Mah. 505 Cad. No:20/2, Finike/Antalya<br>
        Tel: 0536 915 32 91
      </p>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
  });
}
