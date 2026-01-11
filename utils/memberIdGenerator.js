/**
 * Extract tenant initials from tenant name
 * Takes first letter of each word, converts to uppercase
 * Example: "Acme Ventures" -> "AV"
 * Example: "Acme Ventures Development Inc" -> "AVDI"
 */
export const extractTenantInitials = (tenantName) => {
  if (!tenantName || typeof tenantName !== 'string') {
    return 'ORG'; // Default fallback
  }

  // Split by spaces, filter out empty strings
  const words = tenantName.trim().split(/\s+/).filter(word => word.length > 0);
  
  if (words.length === 0) {
    return 'ORG'; // Default fallback
  }

  // Take first character of each word, convert to uppercase
  const initials = words
    .map(word => word.charAt(0).toUpperCase())
    .join('');

  // Return initials (or default if empty)
  return initials.length > 0 ? initials : 'ORG';
};

/**
 * Generate member ID in format: {INITIALS}-{COUNTER}
 * Counter is zero-padded to 5 digits
 * Example: "AV-00001", "AVDI-00123"
 */
export const generateMemberId = (tenantName, tenantCounter) => {
  const initials = extractTenantInitials(tenantName);
  const counter = tenantCounter || 0;
  
  // Increment counter (function receives current counter, returns next ID)
  const nextCounter = counter + 1;
  
  // Zero-pad to 5 digits
  const paddedCounter = String(nextCounter).padStart(5, '0');
  
  return `${initials}-${paddedCounter}`;
};

