import 'dotenv/config';
import nodemailer from 'nodemailer';

/**
 * Email Service for Quantum Healthcare Platform
 * Uses SMTP to send notifications for document uploads and doctor suggestions
 */

// SMTP Configuration - Configure these in your environment variables
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
};

// Create transporter
let transporter = null;

function initializeTransporter() {
  if (!SMTP_CONFIG.auth.user || !SMTP_CONFIG.auth.pass) {
    console.warn('[Email Service] SMTP credentials not configured. Email notifications disabled.');
    return null;
  }

  transporter = nodemailer.createTransport(SMTP_CONFIG);

  // Verify connection
  transporter.verify((error, success) => {
    if (error) {
      console.error('[Email Service] SMTP connection failed:', error.message);
    } else {
      console.log('[Email Service] SMTP server connected successfully');
    }
  });

  return transporter;
}

// Initialize on module load
initializeTransporter();

/**
 * Email Templates
 */
const emailTemplates = {
  /**
   * Template for notifying doctors when a patient uploads a document
   */
  documentUploaded: (data) => ({
    subject: `New Medical Document Shared - ${data.patientName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Document Shared</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-align: center;">
                🏥 Quantum Healthcare
              </h1>
              <p style="color: #e0e0e0; margin: 10px 0 0; text-align: center; font-size: 14px;">
                Secure Medical Records Platform
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333333; margin: 0 0 20px; font-size: 20px;">
                📄 New Medical Document Shared
              </h2>

              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Dear <strong>Dr. ${data.doctorName}</strong>,
              </p>

              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                A patient has shared a new medical document with you for review.
              </p>

              <!-- Document Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="color: #667eea; margin: 0 0 15px; font-size: 16px; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
                      Document Details
                    </h3>
                    <table width="100%" cellpadding="5" cellspacing="0">
                      <tr>
                        <td style="color: #888888; font-size: 14px; width: 140px;">Patient Name:</td>
                        <td style="color: #333333; font-size: 14px; font-weight: bold;">${data.patientName}</td>
                      </tr>
                      <tr>
                        <td style="color: #888888; font-size: 14px;">Patient ID:</td>
                        <td style="color: #333333; font-size: 14px; font-weight: bold;">${data.patientId}</td>
                      </tr>
                      <tr>
                        <td style="color: #888888; font-size: 14px;">Document Name:</td>
                        <td style="color: #333333; font-size: 14px; font-weight: bold;">${data.documentName}</td>
                      </tr>
                      <tr>
                        <td style="color: #888888; font-size: 14px;">Document Type:</td>
                        <td style="color: #333333; font-size: 14px; font-weight: bold;">${data.documentType}</td>
                      </tr>
                      <tr>
                        <td style="color: #888888; font-size: 14px;">Uploaded On:</td>
                        <td style="color: #333333; font-size: 14px; font-weight: bold;">${data.uploadedAt}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security Badge -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e8f5e9; border-radius: 8px; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 15px; text-align: center;">
                    <span style="color: #2e7d32; font-size: 14px;">
                      🔒 This document is protected with <strong>AES-256 + BB84 Quantum Encryption</strong>
                    </span>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${data.portalUrl || 'http://localhost:5173'}"
                       style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 25px; font-size: 16px; font-weight: bold;">
                      View Document in Portal
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 25px 0 0; text-align: center;">
                Please log in to the Quantum Healthcare portal to review the document and provide your medical suggestions.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; border-radius: 0 0 10px 10px; border-top: 1px solid #eeeeee;">
              <p style="color: #999999; font-size: 12px; margin: 0; text-align: center;">
                This is an automated notification from Quantum Healthcare Platform.<br>
                Please do not reply to this email.
              </p>
              <p style="color: #999999; font-size: 12px; margin: 10px 0 0; text-align: center;">
                © ${new Date().getFullYear()} Quantum Healthcare. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    text: `
New Medical Document Shared

Dear Dr. ${data.doctorName},

A patient has shared a new medical document with you for review.

Document Details:
- Patient Name: ${data.patientName}
- Patient ID: ${data.patientId}
- Document Name: ${data.documentName}
- Document Type: ${data.documentType}
- Uploaded On: ${data.uploadedAt}

This document is protected with AES-256 + BB84 Quantum Encryption.

Please log in to the Quantum Healthcare portal to review the document and provide your medical suggestions.

Portal URL: ${data.portalUrl || 'http://localhost:5173'}

---
This is an automated notification from Quantum Healthcare Platform.
    `,
  }),

  /**
   * Template for notifying patients when a doctor provides a suggestion
   */
  suggestionReceived: (data) => ({
    subject: `Medical Suggestion from Dr. ${data.doctorName} - ${data.priority} Priority`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Medical Suggestion</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-align: center;">
                🏥 Quantum Healthcare
              </h1>
              <p style="color: #e0e0e0; margin: 10px 0 0; text-align: center; font-size: 14px;">
                Secure Medical Records Platform
              </p>
            </td>
          </tr>

          <!-- Priority Banner -->
          <tr>
            <td style="background-color: ${getPriorityColor(data.priority)}; padding: 15px; text-align: center;">
              <span style="color: #ffffff; font-size: 14px; font-weight: bold; text-transform: uppercase;">
                ${getPriorityIcon(data.priority)} ${data.priority} Priority Suggestion
              </span>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333333; margin: 0 0 20px; font-size: 20px;">
                🩺 New Medical Suggestion Received
              </h2>

              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Dear <strong>${data.patientName}</strong>,
              </p>

              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                Your healthcare provider has reviewed your medical document and provided the following suggestion.
              </p>

              <!-- Doctor Info Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e3f2fd; border-radius: 8px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="color: #1976d2; margin: 0 0 10px; font-size: 16px;">
                      👨‍⚕️ Healthcare Provider
                    </h3>
                    <p style="color: #333333; font-size: 14px; margin: 5px 0;">
                      <strong>Dr. ${data.doctorName}</strong>
                      ${data.doctorSpecialty ? `<br><span style="color: #666666;">${data.doctorSpecialty}</span>` : ''}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Document Reference -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; border-radius: 8px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 15px;">
                    <p style="color: #888888; font-size: 12px; margin: 0;">Regarding Document:</p>
                    <p style="color: #333333; font-size: 14px; margin: 5px 0 0; font-weight: bold;">
                      📄 ${data.documentName}
                    </p>
                  </td>
                </tr>
              </table>

              ${data.diagnosis ? `
              <!-- Diagnosis -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff3e0; border-left: 4px solid #ff9800; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="color: #e65100; margin: 0 0 10px; font-size: 14px;">
                      🔍 Diagnosis
                    </h3>
                    <p style="color: #333333; font-size: 14px; line-height: 1.6; margin: 0;">
                      ${data.diagnosis}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Suggestion -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e8f5e9; border-left: 4px solid #4caf50; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="color: #2e7d32; margin: 0 0 10px; font-size: 14px;">
                      💡 Medical Recommendation
                    </h3>
                    <p style="color: #333333; font-size: 14px; line-height: 1.6; margin: 0;">
                      ${data.suggestion}
                    </p>
                  </td>
                </tr>
              </table>

              ${data.prescription ? `
              <!-- Prescription -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e1f5fe; border-left: 4px solid #03a9f4; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="color: #0277bd; margin: 0 0 10px; font-size: 14px;">
                      💊 Prescription
                    </h3>
                    <p style="color: #333333; font-size: 14px; line-height: 1.6; margin: 0;">
                      ${data.prescription}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}

              ${data.followUpDate ? `
              <!-- Follow-up -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fce4ec; border-radius: 8px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <h3 style="color: #c2185b; margin: 0 0 10px; font-size: 14px;">
                      📅 Follow-up Recommended
                    </h3>
                    <p style="color: #333333; font-size: 18px; font-weight: bold; margin: 0;">
                      ${data.followUpDate}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${data.portalUrl || 'http://localhost:5173'}"
                       style="display: inline-block; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 25px; font-size: 16px; font-weight: bold;">
                      View in Patient Portal
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Disclaimer -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 25px;">
                <tr>
                  <td style="background-color: #fff8e1; padding: 15px; border-radius: 8px; border: 1px solid #ffecb3;">
                    <p style="color: #f57c00; font-size: 12px; margin: 0; text-align: center;">
                      ⚠️ <strong>Important:</strong> This is a medical suggestion. Please consult with your healthcare provider
                      before making any changes to your treatment plan.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; border-radius: 0 0 10px 10px; border-top: 1px solid #eeeeee;">
              <p style="color: #999999; font-size: 12px; margin: 0; text-align: center;">
                This is an automated notification from Quantum Healthcare Platform.<br>
                Please do not reply to this email.
              </p>
              <p style="color: #999999; font-size: 12px; margin: 10px 0 0; text-align: center;">
                © ${new Date().getFullYear()} Quantum Healthcare. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    text: `
New Medical Suggestion Received - ${data.priority.toUpperCase()} PRIORITY

Dear ${data.patientName},

Your healthcare provider has reviewed your medical document and provided the following suggestion.

HEALTHCARE PROVIDER:
Dr. ${data.doctorName}${data.doctorSpecialty ? ` (${data.doctorSpecialty})` : ''}

REGARDING DOCUMENT:
${data.documentName}

${data.diagnosis ? `DIAGNOSIS:\n${data.diagnosis}\n\n` : ''}
MEDICAL RECOMMENDATION:
${data.suggestion}

${data.prescription ? `PRESCRIPTION:\n${data.prescription}\n\n` : ''}
${data.followUpDate ? `FOLLOW-UP RECOMMENDED: ${data.followUpDate}\n\n` : ''}

Please log in to the Patient Portal to view the complete details.
Portal URL: ${data.portalUrl || 'http://localhost:5173'}

---
IMPORTANT: This is a medical suggestion. Please consult with your healthcare provider
before making any changes to your treatment plan.

This is an automated notification from Quantum Healthcare Platform.
    `,
  }),

  /**
   * Template for notifying doctors when a patient grants them access
   */
  accessGranted: (data) => ({
    subject: `Access Granted - ${data.patientName} shared medical documents with you`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Granted</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; text-align: center;">
                🏥 Quantum Healthcare
              </h1>
              <p style="color: #e0e0e0; margin: 10px 0 0; text-align: center; font-size: 14px;">
                Secure Medical Records Platform
              </p>
            </td>
          </tr>

          <!-- Access Badge -->
          <tr>
            <td style="background-color: #7c3aed; padding: 15px; text-align: center;">
              <span style="color: #ffffff; font-size: 14px; font-weight: bold;">
                🔓 NEW ACCESS GRANTED
              </span>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333333; margin: 0 0 20px; font-size: 20px;">
                📋 Patient Has Shared Documents With You
              </h2>

              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Dear <strong>Dr. ${data.doctorName}</strong>,
              </p>

              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                A patient has granted you access to their medical documents. You can now view and provide medical suggestions for their records.
              </p>

              <!-- Patient Info Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3e8ff; border-radius: 8px; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="color: #7c3aed; margin: 0 0 15px; font-size: 16px; border-bottom: 2px solid #7c3aed; padding-bottom: 10px;">
                      👤 Patient Information
                    </h3>
                    <table width="100%" cellpadding="5" cellspacing="0">
                      <tr>
                        <td style="color: #888888; font-size: 14px; width: 140px;">Patient Name:</td>
                        <td style="color: #333333; font-size: 14px; font-weight: bold;">${data.patientName}</td>
                      </tr>
                      <tr>
                        <td style="color: #888888; font-size: 14px;">Patient ID:</td>
                        <td style="color: #333333; font-size: 14px; font-weight: bold;">${data.patientId}</td>
                      </tr>
                      <tr>
                        <td style="color: #888888; font-size: 14px;">Document:</td>
                        <td style="color: #333333; font-size: 14px; font-weight: bold;">${data.documentName}</td>
                      </tr>
                      <tr>
                        <td style="color: #888888; font-size: 14px;">Granted On:</td>
                        <td style="color: #333333; font-size: 14px; font-weight: bold;">${data.grantedAt}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security Badge -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e8f5e9; border-radius: 8px; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 15px; text-align: center;">
                    <span style="color: #2e7d32; font-size: 14px;">
                      🔒 All documents are protected with <strong>AES-256 + BB84 Quantum Encryption</strong>
                    </span>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${data.portalUrl || 'http://localhost:5173'}"
                       style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 25px; font-size: 16px; font-weight: bold;">
                      View Patient Documents
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 25px 0 0; text-align: center;">
                Log in to review the patient's documents and provide your medical expertise.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; border-radius: 0 0 10px 10px; border-top: 1px solid #eeeeee;">
              <p style="color: #999999; font-size: 12px; margin: 0; text-align: center;">
                This is an automated notification from Quantum Healthcare Platform.<br>
                Please do not reply to this email.
              </p>
              <p style="color: #999999; font-size: 12px; margin: 10px 0 0; text-align: center;">
                © ${new Date().getFullYear()} Quantum Healthcare. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    text: `
Access Granted - New Patient Documents Available

Dear Dr. ${data.doctorName},

A patient has granted you access to their medical documents. You can now view and provide medical suggestions for their records.

PATIENT INFORMATION:
- Patient Name: ${data.patientName}
- Patient ID: ${data.patientId}
- Document: ${data.documentName}
- Granted On: ${data.grantedAt}

All documents are protected with AES-256 + BB84 Quantum Encryption.

Please log in to the portal to review the patient's documents.
Portal URL: ${data.portalUrl || 'http://localhost:5173'}

---
This is an automated notification from Quantum Healthcare Platform.
    `,
  }),
};

/**
 * Helper functions for priority styling
 */
function getPriorityColor(priority) {
  switch (priority?.toLowerCase()) {
    case 'critical': return '#d32f2f';
    case 'high': return '#f57c00';
    case 'medium': return '#fbc02d';
    case 'low': return '#388e3c';
    default: return '#757575';
  }
}

function getPriorityIcon(priority) {
  switch (priority?.toLowerCase()) {
    case 'critical': return '🚨';
    case 'high': return '⚠️';
    case 'medium': return '📋';
    case 'low': return '📝';
    default: return '📋';
  }
}

/**
 * Email Service Class
 */
class EmailService {
  constructor() {
    this.transporter = transporter;
    this.fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@quantumhealthcare.com';
  }

  /**
   * Check if email service is configured and available
   */
  isConfigured() {
    return this.transporter !== null;
  }

  /**
   * Send email
   */
  async sendEmail(to, template) {
    if (!this.isConfigured()) {
      console.warn('[Email Service] Email not sent - SMTP not configured');
      return { success: false, reason: 'SMTP not configured' };
    }

    if (!to) {
      console.warn('[Email Service] Email not sent - No recipient email address');
      return { success: false, reason: 'No recipient email' };
    }

    try {
      const result = await this.transporter.sendMail({
        from: `"Quantum Healthcare" <${this.fromAddress}>`,
        to: to,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });

      console.log(`[Email Service] Email sent successfully to ${to}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error(`[Email Service] Failed to send email to ${to}:`, error.message);
      return { success: false, reason: error.message };
    }
  }

  /**
   * Notify doctor about new document upload
   */
  async notifyDoctorDocumentUploaded(doctorEmail, data) {
    const template = emailTemplates.documentUploaded(data);
    return this.sendEmail(doctorEmail, template);
  }

  /**
   * Notify patient about new suggestion
   */
  async notifyPatientSuggestionReceived(patientEmail, data) {
    const template = emailTemplates.suggestionReceived(data);
    return this.sendEmail(patientEmail, template);
  }

  /**
   * Notify doctor when patient grants access to documents
   */
  async notifyDoctorAccessGranted(doctorEmail, data) {
    const template = emailTemplates.accessGranted(data);
    return this.sendEmail(doctorEmail, template);
  }
}

const emailService = new EmailService();

export { EmailService, emailService };
