/**
 * Email template for confirming tenant registration to the registrant
 */
export const renderTenantRegistrationConfirmationEmail = ({ 
  tenantName, 
  adminUsername, 
  adminEmail,
  adminPassword,
  supportEmail,
  loginUrl,
  dashboardUrl 
}) => {
  const appName = process.env.APP_NAME || 'Dues Accountant';
  const primaryColor = '#3B82F6'; // Blue for information
  const warningColor = '#F59E0B'; // Amber for pending status
  
  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eee;">
        <h1 style="color: ${primaryColor}; margin: 0;">Registration Confirmation</h1>
      </div>
      <div style="padding: 20px 0;">
        <p>Hello ${adminUsername || 'there'},</p>
        <p>Thank you for registering your organization <strong>${tenantName}</strong> on ${appName}.</p>
        
        <div style="background-color: #FEF3C7; padding: 15px; border-left: 4px solid ${warningColor}; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #92400E;">⏳ Pending Approval</p>
          <p style="margin: 10px 0 0 0; color: #78350F;">Your registration has been received and is currently pending approval. You will receive an email notification once your organization has been reviewed and approved by our team.</p>
        </div>

        <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: ${primaryColor};">Your Account Credentials:</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="margin-bottom: 10px;"><strong>Organization Name:</strong> ${tenantName}</li>
            <li style="margin-bottom: 10px;"><strong>Admin Username:</strong> ${adminUsername}</li>
            <li style="margin-bottom: 10px;"><strong>Admin Email:</strong> ${adminEmail || 'Not provided'}</li>
            <li style="margin-bottom: 10px;"><strong>Password:</strong> <code style="background-color: #fff; padding: 2px 6px; border-radius: 3px; font-family: monospace;">${adminPassword}</code></li>
          </ul>
        </div>

        <div style="background-color: #EFF6FF; padding: 15px; border-left: 4px solid ${primaryColor}; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: ${primaryColor};">📋 Next Steps:</p>
          <ol style="margin: 10px 0 0 20px; padding: 0; color: #1E40AF;">
            <li style="margin-bottom: 8px;">Your registration is being reviewed by our team</li>
            <li style="margin-bottom: 8px;">You will receive an approval email once your organization is activated</li>
            <li style="margin-bottom: 8px;">Once approved, you can log in using the credentials above</li>
            <li style="margin-bottom: 8px;">Please change your password immediately after your first login</li>
          </ol>
        </div>

        <p style="margin-top: 25px;"><strong>Important Security Note:</strong> Please keep your credentials safe and change your password immediately after your first login for security purposes.</p>

        <p style="margin-top: 20px;">Once your organization is approved, you can access your dashboard here:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background-color: ${primaryColor}; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Login Page</a>
        </p>
        <p style="font-size: 0.9em; color: #666; text-align: center;">(Login will be available after approval)</p>

        ${supportEmail ? `
        <p style="margin-top: 25px;">If you have any questions or need assistance, please don't hesitate to contact our support team:</p>
        <p style="margin: 10px 0;"><strong>Support Email:</strong> <a href="mailto:${supportEmail}" style="color: ${primaryColor};">${supportEmail}</a></p>
        ` : ''}

        <p style="margin-top: 25px;">Thank you for choosing ${appName}. We look forward to serving you!</p>
      </div>
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.8em; color: #777;">
        <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
      </div>
    </div>
  `;
};

export const renderTenantRegistrationConfirmationText = ({ 
  tenantName, 
  adminUsername, 
  adminEmail,
  adminPassword,
  supportEmail,
  loginUrl
}) => {
  const appName = process.env.APP_NAME || 'Dues Accountant';
  return `
    Hello ${adminUsername || 'there'},

    Thank you for registering your organization ${tenantName} on ${appName}.

    ⏳ PENDING APPROVAL
    Your registration has been received and is currently pending approval. You will receive an email notification once your organization has been reviewed and approved by our team.

    Your Account Credentials:
    Organization Name: ${tenantName}
    Admin Username: ${adminUsername}
    Admin Email: ${adminEmail || 'Not provided'}
    Password: ${adminPassword}

    Next Steps:
    1. Your registration is being reviewed by our team
    2. You will receive an approval email once your organization is activated
    3. Once approved, you can log in using the credentials above
    4. Please change your password immediately after your first login

    Important Security Note: Please keep your credentials safe and change your password immediately after your first login for security purposes.

    Once your organization is approved, you can access your dashboard here:
    ${loginUrl}
    (Login will be available after approval)

    ${supportEmail ? `
    If you have any questions or need assistance, please don't hesitate to contact our support team:
    Support Email: ${supportEmail}
    ` : ''}

    Thank you for choosing ${appName}. We look forward to serving you!

    ---
    © ${new Date().getFullYear()} ${appName}. All rights reserved.
  `;
};
