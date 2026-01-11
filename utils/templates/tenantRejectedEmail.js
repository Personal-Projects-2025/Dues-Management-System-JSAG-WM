/**
 * Email template for notifying tenant that their organization has been rejected
 */
export const renderTenantRejectedEmail = ({ tenantName, adminUsername, rejectionReason, supportEmail, registrationUrl }) => {
  const appName = process.env.APP_NAME || 'Dues Accountant';
  const primaryColor = '#DC2626'; // Error red
  const secondaryColor = '#3B82F6'; // Blue for action
  
  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eee;">
        <h1 style="color: ${primaryColor}; margin: 0;">Organization Registration Update</h1>
      </div>
      <div style="padding: 20px 0;">
        <p>Hello ${adminUsername},</p>
        <p>We regret to inform you that your organization registration for <strong>${tenantName}</strong> on ${appName} has been reviewed and unfortunately could not be approved at this time.</p>
        
        ${rejectionReason ? `
        <div style="background-color: #fef2f2; padding: 15px; border-left: 4px solid ${primaryColor}; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: ${primaryColor};">Reason for Rejection:</h3>
          <p style="margin: 0; white-space: pre-wrap;">${rejectionReason}</p>
        </div>
        ` : ''}

        <div style="background-color: #FFFBEB; padding: 15px; border-left: 4px solid #F59E0B; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #92400E;">📋 What to Do Next:</p>
          <ol style="margin: 10px 0 0 20px; padding: 0; color: #78350F;">
            <li style="margin-bottom: 8px;">Please review the reason for rejection carefully</li>
            <li style="margin-bottom: 8px;">Address the issues mentioned in the rejection reason</li>
            <li style="margin-bottom: 8px;">Gather all required information and documentation</li>
            <li style="margin-bottom: 8px;">Submit a new registration with the corrected information</li>
          </ol>
        </div>

        <div style="background-color: #EFF6FF; padding: 15px; border-left: 4px solid ${secondaryColor}; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: ${secondaryColor}; margin-bottom: 10px;">🔄 Ready to Try Again?</p>
          <p style="margin: 10px 0; color: #1E40AF;">If you've addressed the rejection reason and have all the necessary information, you can submit a new registration:</p>
          ${registrationUrl ? `
          <p style="text-align: center; margin: 20px 0;">
            <a href="${registrationUrl}" style="background-color: ${secondaryColor}; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Re-register Organization</a>
          </p>
          <p style="font-size: 0.9em; color: #666; text-align: center;">If the button above doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; font-size: 0.9em; color: #666; text-align: center;">${registrationUrl}</p>
          ` : ''}
        </div>

        <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #374151; margin-bottom: 10px;">💬 Need Help?</p>
          <p style="margin: 10px 0 0 0; color: #4B5563;">If you believe this decision was made in error, or if you have additional information that may help with the review process, please don't hesitate to contact our support team. We're here to help you succeed!</p>
          ${supportEmail ? `
          <p style="margin: 15px 0 0 0;"><strong>Support Email:</strong> <a href="mailto:${supportEmail}" style="color: ${secondaryColor}; text-decoration: none;">${supportEmail}</a></p>
          ` : ''}
        </div>

        <p style="margin-top: 25px;">We encourage you to address the concerns mentioned above and submit a new registration. We look forward to reviewing your application again.</p>
        <p>Thank you for your interest in ${appName}.</p>
      </div>
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.8em; color: #777;">
        <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
      </div>
    </div>
  `;
};

export const renderTenantRejectedText = ({ tenantName, adminUsername, rejectionReason, supportEmail, registrationUrl }) => {
  const appName = process.env.APP_NAME || 'Dues Accountant';
  return `
    Hello ${adminUsername},

    We regret to inform you that your organization registration for ${tenantName} on ${appName} has been reviewed and unfortunately could not be approved at this time.

    ${rejectionReason ? `
    Reason for Rejection:
    ${rejectionReason}
    ` : ''}

    What to Do Next:
    1. Please review the reason for rejection carefully
    2. Address the issues mentioned in the rejection reason
    3. Gather all required information and documentation
    4. Submit a new registration with the corrected information

    Ready to Try Again?
    If you've addressed the rejection reason and have all the necessary information, you can submit a new registration:
    ${registrationUrl || 'Please visit the registration page on our website'}

    ${registrationUrl ? `Registration URL: ${registrationUrl}` : ''}

    Need Help?
    If you believe this decision was made in error, or if you have additional information that may help with the review process, please don't hesitate to contact our support team. We're here to help you succeed!

    ${supportEmail ? `Support Email: ${supportEmail}` : ''}

    We encourage you to address the concerns mentioned above and submit a new registration. We look forward to reviewing your application again.

    Thank you for your interest in ${appName}.

    ---
    © ${new Date().getFullYear()} ${appName}. All rights reserved.
  `;
};

