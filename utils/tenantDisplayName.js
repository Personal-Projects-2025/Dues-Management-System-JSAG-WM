const DEFAULT_NAME = 'Dues Accountant';

/**
 * Detect branding.name values stuck from partial typing during registration
 * (e.g. org name "Wesley Group" but branding.name is "W").
 */
function isStaleBrandingName(branded, orgName) {
  if (!branded || !orgName) return false;
  if (branded.length <= 1 && orgName.length > 1) return true;
  if (orgName.startsWith(branded) && branded.length < orgName.length) return true;
  return false;
}

/**
 * Organization name for emails, SMS, PDFs, and sender display.
 * Uses tenant.name as the source of truth; branding.name is a fallback only
 * when the org name is missing or clearly stale from registration.
 */
export function getTenantDisplayName(tenant, fallback = DEFAULT_NAME) {
  if (!tenant) {
    return process.env.GROUP_NAME || fallback;
  }

  const orgName = String(tenant.name || '').trim();
  const branded = String(tenant.config?.branding?.name || '').trim();

  if (orgName) {
    if (branded && branded !== orgName && !isStaleBrandingName(branded, orgName)) {
      return branded;
    }
    return orgName;
  }

  return branded || process.env.GROUP_NAME || fallback;
}

/**
 * Keep config.branding.name aligned with tenant.name when the org is renamed.
 */
export function syncBrandingNameWithTenantName(tenant, newName) {
  const name = String(newName || '').trim();
  if (!name || !tenant) return;

  tenant.name = name;
  if (!tenant.config) tenant.config = {};
  if (!tenant.config.branding) tenant.config.branding = {};
  tenant.config.branding.name = name;
}
