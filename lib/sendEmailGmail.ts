import nodemailer from 'nodemailer';

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!transporter) {
    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailAppPassword) {
      throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD environment variables are required');
    }

    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });
  }

  return transporter;
}

export async function sendDownloadEmailGmail(
  email: string,
  paperTitle: string,
  pptUrl: string | null,
  docxUrl: string | null
): Promise<boolean> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('[Email] No GMAIL credentials, skipping email');
    return false;
  }

  try {
    const transporter = getTransporter();

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h1 style="color: #0ea5e9; margin: 0 0 20px 0;">Your Journal Club Analysis is Ready! 📚</h1>

          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Hello,
          </p>

          <p style="color: #333; font-size: 16px; line-height: 1.6;">
            Your journal club presentation and analysis for <strong>${paperTitle}</strong> has been successfully generated.
          </p>

          <h2 style="color: #333; margin-top: 30px;">Download Your Documents:</h2>

          <table style="width: 100%; margin: 20px 0;">
            <tr>
              <td style="padding: 12px;">
                ${pptUrl ? `
                <a href="${pptUrl}" style="background: #0ea5e9; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  📊 Download PowerPoint
                </a>
                ` : '<span style="color: #999;">PowerPoint not available</span>'}
              </td>
            </tr>
            <tr>
              <td style="padding: 12px;">
                ${docxUrl ? `
                <a href="${docxUrl}" style="background: #10b981; color: white; padding: 12px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  📄 Download Word Document
                </a>
                ` : '<span style="color: #999;">Word document not available</span>'}
              </td>
            </tr>
          </table>

          <p style="color: #999; font-size: 12px; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
            <strong>Note:</strong> Download links expire after 48 hours. If you don't see this email in your inbox, check your spam folder.
          </p>

          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            Best regards,<br/>
            Journal Club Team
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: `Journal Club: ${paperTitle}`,
      html: emailHtml,
    });

    console.log(`[Email] Successfully sent to: ${email}`);
    return true;
  } catch (error) {
    console.error('[Email] Send error:', error);
    return false;
  }
}
