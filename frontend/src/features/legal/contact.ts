const configuredEmail = (
  import.meta.env.VITE_LEGAL_CONTACT_EMAIL || 'its.tebo0@gmail.com'
).trim();
// Public configuration only; reject malformed values before constructing mailto links or Markdown.
if (
  !/^[a-zA-Z0-9.!+_-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(configuredEmail)
) {
  throw new Error(
    'VITE_LEGAL_CONTACT_EMAIL must be a valid public contact address.',
  );
}
export const legalContactEmail = configuredEmail;
export function renderLegalText(source: string) {
  return source.replaceAll('{{CONTACT_EMAIL}}', legalContactEmail);
}
