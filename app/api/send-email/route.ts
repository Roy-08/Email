import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleSheetsClient, SHEET_ID, ensureSheetExists } from "@/app/lib/googleSheets";

// Note: In Next.js App Router, body size is controlled by the runtime/server config.
// The request body limit for serverless functions is typically 4.5MB by default.
// For larger attachments, consider using streaming uploads or external storage.

// For Next.js App Router, set the max duration and body size
export const maxDuration = 60;

interface EmailItem {
  srNo: string;
  description: string;
  unit: string;
  qty: string;
}

interface Vendor {
  manufacturer: string;
  contact: string;
  mobile: string;
  email: string;
}

interface Attachment {
  name: string;
  mimeType: string;
  base64: string;
}

// Allowed sender accounts. Each account has its own Gmail OAuth credentials
// and its own signature block (regards name, mobile, and address lines).
const SENDER_ACCOUNTS = {
  "inquiry@saraswateng.com": {
    email: process.env.GMAIL_INQUIRY_EMAIL || "inquiry@saraswateng.com",
    clientId: process.env.GMAIL_INQUIRY_CLIENT_ID,
    clientSecret: process.env.GMAIL_INQUIRY_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_INQUIRY_REFRESH_TOKEN,
    signature: {
      regardsName: "Shital Rane.",
      mobile: "9930895593",
      addressLines: [
        "401, Corporate Annex,",
        "Sonawala Road, Goregaon(E),",
        "Mumbai-400 063",
      ],
    },
  },
  "sasinair@saraswateng.com": {
    email: process.env.GMAIL_SASINAIR_EMAIL || "sasinair@saraswateng.com",
    clientId: process.env.GMAIL_SASINAIR_CLIENT_ID,
    clientSecret: process.env.GMAIL_SASINAIR_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_SASINAIR_REFRESH_TOKEN,
    signature: {
      regardsName: "Manish Kumar",
      mobile: "9653627704",
      addressLines: [
        "Satyam CHS, Ostwal Complex,",
        "Navapur Rd., Boisar (W)- 401501",
      ],
    },
  },
} as const;

type SenderEmail = keyof typeof SENDER_ACCOUNTS;

const DEFAULT_SENDER: SenderEmail = "inquiry@saraswateng.com";

export async function POST(request: Request) {
  try {
    const { subject, items, vendors, attachments, senderEmail } = (await request.json()) as {
      subject: string;
      items: EmailItem[];
      vendors: Vendor[];
      attachments: Attachment[];
      senderEmail?: string;
    };

    if (!subject || !subject.trim()) {
      return NextResponse.json({ success: false, message: "Subject is required!" });
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, message: "Please select at least one item!" });
    }
    if (!vendors || vendors.length === 0) {
      return NextResponse.json({ success: false, message: "Please select at least one vendor!" });
    }

    // Resolve the chosen sender account (defaults to inquiry@).
    const chosenSenderKey: SenderEmail =
      senderEmail && senderEmail in SENDER_ACCOUNTS ? (senderEmail as SenderEmail) : DEFAULT_SENDER;
    const senderAccount = SENDER_ACCOUNTS[chosenSenderKey];

    if (!senderAccount.clientId || !senderAccount.clientSecret || !senderAccount.refreshToken) {
      return NextResponse.json({
        success: false,
        message: `Missing Gmail credentials for sender "${chosenSenderKey}". Please configure its CLIENT_ID, CLIENT_SECRET and REFRESH_TOKEN in your environment variables.`,
      });
    }

    // Setup Gmail OAuth2 client for the selected sender account
    const oAuth2Client = new google.auth.OAuth2(
      senderAccount.clientId,
      senderAccount.clientSecret,
      "https://developers.google.com/oauthplayground"
    );

    oAuth2Client.setCredentials({
      refresh_token: senderAccount.refreshToken,
    });

    // Verify access token before sending
    try {
      const tokenResponse = await oAuth2Client.getAccessToken();
      console.log("🔑 Gmail access token obtained:", !!tokenResponse?.token);
      if (!tokenResponse?.token) {
        return NextResponse.json({ 
          success: false, 
          message: "Failed to obtain Gmail access token. Please regenerate your refresh token from Google OAuth Playground." 
        });
      }
    } catch (tokenErr: unknown) {
      const tokenErrMsg = tokenErr instanceof Error ? tokenErr.message : "Unknown token error";
      console.error("❌ Gmail token error:", tokenErrMsg);
      return NextResponse.json({ 
        success: false, 
        message: `Gmail authentication failed: ${tokenErrMsg}. Please regenerate your refresh token from https://developers.google.com/oauthplayground using your Client ID and Client Secret.` 
      });
    }

    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // Build HTML table
    let descHtml = '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%; font-family:Arial,sans-serif;">';
    descHtml += '<tr style="background-color:#1a73e8; color:white;">';
    descHtml += '<th style="padding:10px;">Sr No.</th>';
    descHtml += '<th style="padding:10px;">Description of Item</th>';
    descHtml += '<th style="padding:10px;">Unit</th>';
    descHtml += '<th style="padding:10px;">Quantity</th>';
    descHtml += "</tr>";

    let descPlain = "";

    for (let d = 0; d < items.length; d++) {
      const item = items[d];
      descPlain += `${item.srNo}. ${item.description} | Unit: ${item.unit} | Qty: ${item.qty}\n`;
      const rowBg = d % 2 === 0 ? "#f8f9fa" : "#ffffff";
      descHtml += `<tr style="background-color:${rowBg};">`;
      descHtml += `<td style="text-align:center; padding:8px;">${item.srNo}</td>`;
      descHtml += `<td style="padding:8px;">${item.description}</td>`;
      descHtml += `<td style="text-align:center; padding:8px;">${item.unit}</td>`;
      descHtml += `<td style="text-align:center; padding:8px;">${item.qty}</td>`;
      descHtml += "</tr>";
    }
    descHtml += "</table>";

    // Suppress unused variable warning
    void descPlain;

    // Send emails
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    const sheets = getGoogleSheetsClient();
    await ensureSheetExists("Archive", ["Date", "Subject", "Description", "Vendor", "Contact", "Email", "Mobile", "Status"]);

    for (const vendor of vendors) {
      if (!vendor.email || !vendor.email.trim()) continue;

      try {
        const companyName = vendor.manufacturer || "";
        const mobileText = vendor.mobile || "";

        const addressHtml = senderAccount.signature.addressLines
          .map((line) => `<span style="color: #008080;">${line}</span>`)
          .join("<br />");

        const html = `<p>Dear Sir,<br><strong>${companyName}</strong><br>(${mobileText})</p><p>Please provide best offer for the following:</p><br>${descHtml}<p style="font-weight: 400;"><span style="color: #000000;">Regards,</span><br /><strong><span style="color: #000000; background-color: #ffff00;">${senderAccount.signature.regardsName}</span></strong><br /><strong><span style="color: #000000; background-color: #ffff00;">${senderAccount.signature.mobile}</span></strong><br /><span style="text-decoration: underline; color: #333399;"><strong>Saraswat Engineering Services</strong></span><br /><span style="text-decoration: underline;"><span style="color: #ff0000; text-decoration: underline;">Together We Grow</span></span><br />An ISO 9001:2015 Certified Company<br /><span style="color: #008080;">Maharashtra GSTIN \u2013 27AAZFS6239C1ZO (Alphabet \u2018O\u2019)</span><br />${addressHtml}<br /><span style="color: #008080;"><strong>E-mail ID</strong> : ${senderAccount.email}</span><br /><span style="color: #008080;"><strong>Website</strong> : www.saraswateng.com</span></p>`;

        // Build raw MIME message
        const rawMessage = buildRawMessage({
          from: `"Saraswat Engineering Services" <${senderAccount.email}>`,
          to: vendor.email,
          subject,
          html,
          attachments: attachments || [],
        });

        const encodedMessage = Buffer.from(rawMessage)
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

        await gmail.users.messages.send({
          userId: "me",
          requestBody: { raw: encodedMessage },
        });

        sent++;
        console.log(`✅ Email sent to: ${vendor.email}`);

        // Archive
        const descSummary = items.map((row) => row.description).join(", ").substring(0, 200);
        await sheets.spreadsheets.values.append({
          spreadsheetId: SHEET_ID,
          range: "Archive!A:H",
          valueInputOption: "RAW",
          requestBody: {
            values: [[new Date().toISOString(), subject, descSummary, vendor.manufacturer, vendor.contact, vendor.email, vendor.mobile, "Sent"]],
          },
        });
      } catch (err: unknown) {
        failed++;
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error(`❌ Email failed for ${vendor.email}:`, errorMessage);
        errors.push(`${vendor.email}: ${errorMessage}`);

        await sheets.spreadsheets.values.append({
          spreadsheetId: SHEET_ID,
          range: "Archive!A:H",
          valueInputOption: "RAW",
          requestBody: {
            values: [[new Date().toISOString(), subject, "", vendor.manufacturer, vendor.contact, vendor.email, vendor.mobile, `Failed: ${errorMessage}`]],
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      errors,
      message: `Sent: ${sent} | Failed: ${failed}`,
    });
  } catch (error) {
    console.error("Error sending emails:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, message: "Failed to send emails: " + errorMessage });
  }
}

/**
 * Wrap a base64 string into lines of 76 characters (MIME standard requirement).
 * Gmail and other email clients require base64 content to be line-wrapped.
 */
function wrapBase64(base64: string): string {
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += 76) {
    lines.push(base64.substring(i, i + 76));
  }
  return lines.join("\r\n");
}

/**
 * Build a raw MIME message string for Gmail API.
 * Supports HTML content and file attachments.
 * 
 * Key fixes:
 * 1. Base64 content is line-wrapped to 76 chars per MIME standard
 * 2. HTML body is base64-encoded to handle special characters
 * 3. Proper CRLF line endings throughout
 * 4. Clean base64 data from attachments (remove any whitespace)
 */
function buildRawMessage({
  from,
  to,
  subject,
  html,
  attachments,
}: {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments: Attachment[];
}): string {
  const CRLF = "\r\n";

  if (!attachments || attachments.length === 0) {
    // Simple HTML email without attachments
    const htmlBase64 = wrapBase64(Buffer.from(html, "utf-8").toString("base64"));
    return [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      htmlBase64,
    ].join(CRLF);
  }

  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  // Encode HTML body as base64 for the multipart message
  const htmlBase64 = wrapBase64(Buffer.from(html, "utf-8").toString("base64"));

  // Multipart email with attachments
  let message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    htmlBase64,
  ].join(CRLF);

  // Add each attachment as a separate MIME part
  for (const att of attachments) {
    // Clean the base64 string - remove any whitespace/newlines that may have been introduced
    const cleanBase64 = att.base64.replace(/[\r\n\s]/g, "");
    const wrappedBase64 = wrapBase64(cleanBase64);
    const mimeType = att.mimeType || "application/octet-stream";
    // Encode filename for Content-Type and Content-Disposition to handle special chars
    const safeName = att.name.replace(/"/g, '\\"');

    message += CRLF + [
      `--${boundary}`,
      `Content-Type: ${mimeType}; name="${safeName}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${safeName}"`,
      "",
      wrappedBase64,
    ].join(CRLF);
  }

  // Close the multipart boundary
  message += `${CRLF}--${boundary}--`;

  return message;
}
