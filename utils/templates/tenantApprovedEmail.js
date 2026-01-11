/**
 * Email template for notifying tenant that their organization has been approved
 */
export const renderTenantApprovedEmail = ({ tenantName, adminUsername, loginUrl }) => {
  const appName = process.env.APP_NAME || 'Dues Accountant';
  const primaryColor = '#16A34A'; // Success green
  
  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eee;">
        <h1 style="color: ${primaryColor}; margin: 0;">✓ Organization Approved</h1>
      </div>
      <div style="padding: 20px 0;">
        <p>Hello ${adminUsername},</p>
        <p>Great news! Your organization <strong>${tenantName}</strong> has been approved and is now active on ${appName}.</p>
        <p>You can now access your organization's dashboard and start using all the features.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background-color: ${primaryColor}; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Access Dashboard</a>
        </p>
        <p style="font-size: 0.9em; color: #666;">If the button above doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; font-size: 0.9em; color: #666;">${loginUrl}</p>
        <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
      </div>
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.8em; color: #777;">
        <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
      </div>
    </div>
  `;
};

export const renderTenantApprovedText = ({ tenantName, adminUsername, loginUrl }) => {
  const appName = process.env.APP_NAME || 'Dues Accountant';
  return `
    Hello ${adminUsername},

    Great news! Your organization ${tenantName} has been approved and is now active on ${appName}.

    You can now access your organization's dashboard and start using all the features.

    Access your dashboard here:
    ${loginUrl}

    If you have any questions or need assistance, please don't hesitate to contact our support team.

    ---
    © ${new Date().getFullYear()} ${appName}. All rights reserved.
  `;
};

