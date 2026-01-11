/**
 * Email template for notifying system owner about new tenant registration
 */
export const renderTenantApprovalEmail = ({ tenantName, tenantSlug, adminUsername, adminEmail, contactEmail, contactPhone, registrationDate, dashboardUrl }) => {
  const appName = process.env.APP_NAME || 'Dues Accountant';
  const primaryColor = '#3B82F6';
  
  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eee;">
        <h1 style="color: ${primaryColor}; margin: 0;">New Organization Registration</h1>
      </div>
      <div style="padding: 20px 0;">
        <p>Hello System Administrator,</p>
        <p>A new organization has registered on ${appName} and is awaiting your approval.</p>
        <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: ${primaryColor};">Organization Details:</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="margin-bottom: 8px;"><strong>Organization Name:</strong> ${tenantName}</li>
            <li style="margin-bottom: 8px;"><strong>Slug:</strong> ${tenantSlug}</li>
            <li style="margin-bottom: 8px;"><strong>Registration Date:</strong> ${new Date(registrationDate).toLocaleString()}</li>
            <li style="margin-bottom: 8px;"><strong>Admin Username:</strong> ${adminUsername}</li>
            <li style="margin-bottom: 8px;"><strong>Admin Email:</strong> ${adminEmail || 'Not provided'}</li>
            ${contactEmail ? `<li style="margin-bottom: 8px;"><strong>Contact Email:</strong> ${contactEmail}</li>` : ''}
            ${contactPhone ? `<li style="margin-bottom: 8px;"><strong>Contact Phone:</strong> ${contactPhone}</li>` : ''}
          </ul>
        </div>
        <p>Please review this organization and approve or reject it through the system dashboard.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${dashboardUrl}" style="background-color: ${primaryColor}; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Review Organization</a>
        </p>
        <p style="font-size: 0.9em; color: #666;">If the button above doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; font-size: 0.9em; color: #666;">${dashboardUrl}</p>
      </div>
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.8em; color: #777;">
        <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
      </div>
    </div>
  `;
};

export const renderTenantApprovalText = ({ tenantName, tenantSlug, adminUsername, adminEmail, contactEmail, contactPhone, registrationDate, dashboardUrl }) => {
  const appName = process.env.APP_NAME || 'Dues Accountant';
  return `
    Hello System Administrator,

    A new organization has registered on ${appName} and is awaiting your approval.

    Organization Details:
    Organization Name: ${tenantName}
    Slug: ${tenantSlug}
    Registration Date: ${new Date(registrationDate).toLocaleString()}
    Admin Username: ${adminUsername}
    Admin Email: ${adminEmail || 'Not provided'}
    ${contactEmail ? `Contact Email: ${contactEmail}` : ''}
    ${contactPhone ? `Contact Phone: ${contactPhone}` : ''}

    Please review this organization and approve or reject it through the system dashboard:
    ${dashboardUrl}

    ---
    © ${new Date().getFullYear()} ${appName}. All rights reserved.
  `;
};

