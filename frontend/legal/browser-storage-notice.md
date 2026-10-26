# Browser storage

> Effective October 26, 2026. Last revised October 26, 2026. Version 2026-10-26.

Donee uses browser storage for sign-in and appearance preferences. Local storage and session storage are browser technologies distinct from cookies; they may still be covered by privacy and device-storage laws.

## Sign-in storage

The `donee-session` entry in session storage contains the current access and refresh credentials, expiry information, and a session identifier. It lets Donee restore sign-in when you reload the same tab and renew access securely. It is removed on local sign-out or when renewal fails, and is temporarily removed during credential rotation. Browser restoration behavior can preserve session storage; token validity is separately controlled by the server. Do not treat closing a window as confirmed server sign-out.

Browsers that cannot safely support the session coordination use memory-only sign-in. The old `donee-session-token` entry is removed. Session credentials are not advertising identifiers and are not sent to file-storage providers for authentication.

## Appearance preferences

The `donee-appearance` local-storage entry saves the theme and font when you turn on **Remember appearance on this device** in Appearance. New visitors start with remembering off. Existing saved preferences continue to work. Saved choices persist until replaced or cleared; they do not have a built-in expiry.

Turn remembering off at any time to remove the saved appearance preference. Your current tab keeps its theme and font until you reload, and further selections are not saved while remembering is off. This does not clear your sign-in. If browser settings prevent removal, Donee shows a warning; you can clear this site's storage in the browser instead. Clearing all site data may also sign you out locally.

## Cookies, analytics, and choices

The application currently implements authentication through tokens rather than authentication cookies. No product analytics or advertising cookies, pixels, or session-replay tools are enabled in this version. Cloudflare's deployed configuration and any future integration must be checked for additional storage or tracking technologies before launch; naming the provider does not confirm its settings.

Necessary sign-in storage and storage used for a requested preference may qualify for consent exceptions in some jurisdictions. This is purpose-dependent, not a blanket exemption for all local storage. Where consent is needed for optional analytics or another technology, it must be obtained before that technology operates, with an equally accessible way to refuse or withdraw. No such optional analytics integration or consent manager has been implemented yet.

For questions, contact [{{CONTACT_EMAIL}}](mailto:{{CONTACT_EMAIL}}). Read the [Privacy policy](/legal/privacy) for broader information handling.
