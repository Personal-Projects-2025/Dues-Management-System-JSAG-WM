export const renderUserCreationEmail = ({ username, email, password, setupLink, loginUrl, role }) => {
  const systemName = process.env.SYSTEM_NAME || 'Dues Accountant';
  const roleDisplay = role === 'system' ? 'System User' : role === 'super' ? 'Super Admin' : 'Admin';
  
  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to ${systemName}</h1>
      </div>
      
      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; margin-top: 0;">Hello,</p>
        
        <p>Your account has been created with the following credentials:</p>
        
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: 600; color: #374151;">Username:</td>
              <td style="padding: 8px 0; color: #1f2937;">${username}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600; color: #374151;">Email:</td>
              <td style="padding: 8px 0; color: #1f2937;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600; color: #374151;">Password:</td>
              <td style="padding: 8px 0; color: #1f2937; font-family: monospace;">${password}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600; color: #374151;">Role:</td>
              <td style="padding: 8px 0; color: #1f2937;">${roleDisplay}</td>
            </tr>
          </table>
        </div>
        
        <div style="margin: 30px 0;">
          <p style="margin-bottom: 15px;"><strong>Next Steps:</strong></p>
          <ol style="margin: 0; padding-left: 20px; color: #4b5563;">
            <li style="margin-bottom: 10px;">Use the credentials above to log in at: <a href="${loginUrl}" style="color: #2563eb; text-decoration: none;">${loginUrl}</a></li>
            <li style="margin-bottom: 10px;">For security, we recommend setting your own password using this link: <a href="${setupLink}" style="color: #2563eb; text-decoration: none;">Set Your Password</a></li>
            <li style="margin-bottom: 10px;">The password reset link expires in 24 hours</li>
          </ol>
        </div>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-right: 10px;">Log In Now</a>
          <a href="${setupLink}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Set Password</a>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
          <p style="margin: 0;"><strong>Security Note:</strong></p>
          <p style="margin: 5px 0 0 0;">Please keep your credentials secure and do not share them with anyone. If you did not request this account, please contact support immediately.</p>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  `;
};

export const renderUserCreationText = ({ username, email, password, setupLink, loginUrl, role }) => {
  const systemName = process.env.SYSTEM_NAME || 'Dues Accountant';
  const roleDisplay = role === 'system' ? 'System User' : role === 'super' ? 'Super Admin' : 'Admin';
  
  return `Welcome to ${systemName}

Hello,

Your account has been created with the following credentials:

Username: ${username}
Email: ${email}
Password: ${password}
Role: ${roleDisplay}

Next Steps:
1. Use the credentials above to log in at: ${loginUrl}
2. For security, we recommend setting your own password using this link: ${setupLink}
3. The password reset link expires in 24 hours

Security Note:
Please keep your credentials secure and do not share them with anyone. If you did not request this account, please contact support immediately.

This is an automated message. Please do not reply to this email.`;
};

