export const renderTenantCreationEmail = ({ tenantName, tenantSlug, adminUsername, adminPassword, adminEmail, loginUrl }) => {
  const appName = process.env.APP_NAME || 'Dues Accountant';
  const primaryColor = '#3B82F6'; // Tailwind blue-500
  const secondaryColor = '#60A5FA'; // Tailwind blue-400

  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eee;">
        <h1 style="color: ${primaryColor}; margin: 0;">Welcome to ${appName}</h1>
      </div>
      <div style="padding: 20px 0;">
        <p>Hello,</p>
        <p>Congratulations! Your organization <strong>${tenantName}</strong> has been successfully registered on ${appName}.</p>
        <p>Here are your account details:</p>
        <ul style="list-style: none; padding: 0; margin: 15px 0;">
          <li style="margin-bottom: 10px;"><strong>Organization Name:</strong> ${tenantName}</li>
          <li style="margin-bottom: 10px;"><strong>Organization Slug:</strong> ${tenantSlug}</li>
          <li style="margin-bottom: 10px;"><strong>Admin Username:</strong> ${adminUsername}</li>
          <li style="margin-bottom: 10px;"><strong>Admin Email:</strong> ${adminEmail || 'Not provided'}</li>
          <li style="margin-bottom: 10px;"><strong>Admin Password:</strong> <code>${adminPassword}</code></li>
        </ul>
        <p><strong>Important:</strong> Please change your password immediately after logging in for the first time.</p>
        <p>You can now log in to your organization's dashboard:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background-color: ${primaryColor}; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Log In to Dashboard</a>
        </p>
        <p>If the button above doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; font-size: 0.9em; color: ${secondaryColor};">${loginUrl}</p>
        <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
      </div>
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.8em; color: #777;">
        <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
      </div>
    </div>
  `;
};

export const renderTenantCreationText = ({ tenantName, tenantSlug, adminUsername, adminPassword, adminEmail, loginUrl }) => {
  const appName = process.env.APP_NAME || 'Dues Accountant';
  return `
    Hello,

    Congratulations! Your organization ${tenantName} has been successfully registered on ${appName}.

    Here are your account details:
    Organization Name: ${tenantName}
    Organization Slug: ${tenantSlug}
    Admin Username: ${adminUsername}
    Admin Email: ${adminEmail || 'Not provided'}
    Admin Password: ${adminPassword}

    Important: Please change your password immediately after logging in for the first time.

    You can now log in to your organization's dashboard:
    ${loginUrl}

    If you have any questions or need assistance, please don't hesitate to contact our support team.

    ---
    © ${new Date().getFullYear()} ${appName}. All rights reserved.
  `;
};

