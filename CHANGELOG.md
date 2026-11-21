# Change log

## v1.2: final Phase 1 updates

### `_headers`
- Review result: the previous `_headers` file already used valid Netlify syntax (unindented path line, two-space-indented `Name: value` lines, no block comments of any kind). The CSP and all other security headers are unchanged: `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `connect-src 'self' https://YOUR-PROJECT-REF.supabase.co`, no `unsafe-inline`, no `unsafe-eval`, no wildcards.
- Change: the `noindex, nofollow` rule now covers both `/admin` and `/admin/*` (separate valid blocks), so the admin address is covered with or without a trailing slash.

### Security Guard Services page
- Removed the sentence "We are building security guard services as our own in-house operation" (it could read as "not ready yet"). It now says "Our security guard services are organised around five areas".
- Removed a leftover HTML comment about licence details from the page source.
- Added a neutral standards statement: "We are committed to professional standards, responsible business practices and compliance with applicable laws and regulations."
- No licence, certification or legal-verification claim was added, and no disclaimer, pending-licence or compliance-gap wording exists on any page. Licence details are left for you to add later.

### Unchanged (verified by file comparison with the previous ZIP)
- All other pages, `assets/` files (CSS, JS, config, favicon), `robots.txt`, `sitemap.xml`, `README-DEPLOY.md` and `SPAM-PROTECTION.md`. The enquiry form's service mapping and details object are byte-for-byte unchanged. Supabase database, RLS policies and the Edge Function were never touched.

### Checks performed in this release
- STATIC ONLY (no browser, no live Supabase): `_headers` syntax and CSP rules, all local links and file references, duplicate ids, label/aria targets, inline styles/handlers/scripts, JSON-LD validity, JavaScript syntax, 43 logic tests with a mocked fetch.
- NOT performed: any real browser test, any Netlify deploy, any live Supabase or Edge Function call, CORS, mobile layout.

---

## v1.1: Phase 1 corrections

## Enquiry service mapping
- The form's service values are now `property`, `security_guard`, `solar`. The URL values `?service=security` and `?service=security_guard` both work and map to `security_guard`. Unknown values are rejected.

## Enquiry details (object)
- `details` is now an object, not a string:
  `{ message, service_info: {...only the fields the customer filled in...}, source: "website_enquiry_form", form_version: 1 }`
- New optional fields appear for the chosen service. Property: property_need, property_type, property_area, budget. Security guard: premises_type, guards_needed (number), start_timeline. Solar: solar_category, monthly_bill, roof_available, owns_property.
- The full payload is `{ full_name, phone, email (omitted if blank), city, service, details, consent }`.
- Privacy Policy updated to mention these optional service details.

## Assumptions about your Edge Function (NOT yet verified: I have not seen its code)
- Accepts a JSON POST at `<project URL>/functions/v1/submit-enquiry` with the payload above.
- Phone is sent as a 10-digit Indian number (no +91).
- It does not reject the extra keys `service_info`, `source` or `form_version` inside `details`.
- Success is a 2xx response whose JSON has `success: true` or a `lead_id` string. Any other 2xx is treated as unconfirmed, not success.
- The `apikey` header is always sent. `Authorization: Bearer` is sent only when the key looks like a JWT (starts with `eyJ`).
If any of this differs, only `buildPayload` and `classifyResult` in `assets/js/enquiry-form.js` need changing.

## Enquiry error handling
- Handles: network errors and 15-second timeouts, 5xx server errors, 429 rate limiting, 401/403 not authorised, other 4xx rejections, 2xx responses without confirmation, and a not-configured state.
- Success is shown only when the function confirms it. Every failure message avoids saying "sent" and keeps the phone and email fallback visible. Form data is kept on failure. Double submits are blocked.
- New file `assets/js/config.js` holds only the public Supabase URL and anon/publishable key (empty until you fill it).
- `_headers` CSP: `connect-src` now allows `'self'` and one exact placeholder host `https://YOUR-PROJECT-REF.supabase.co` that you replace (README-DEPLOY Part 4). No wildcard was used.

## Mobile navigation
- The menu closes when a link is clicked, on Escape (focus returns to the Menu button), on a click outside, on back/forward navigation, and when the screen size crosses the mobile/desktop breakpoint.
- `aria-expanded` is updated in a single function so it always matches the real state. The button label stays "Menu".
- Added a style for the open state and a global `[hidden]` rule.

## JSON-LD and CSP
- Review result: the JSON-LD block in `index.html` is `type="application/ld+json"`, a data block that the browser never executes, so `script-src 'self'` does not need `'unsafe-inline'`, a nonce or a hash. It was validated as parseable JSON and contains no user input. Search engines expect JSON-LD inline, so it was kept. `_headers` was not weakened. I could not test this in a real browser: after deploying, confirm the Console shows no CSP errors.

## Spam protection
- Batch 5 had no honeypot. v1.1 adds a basic hidden honeypot field (client-side only). It is not production-grade protection. See `SPAM-PROTECTION.md` for the server-side protections needed before launch.

## Unchanged
- Design system, business details, all 11 public pages, and your Supabase database, policies and Edge Function (never touched).

## Verification done (by me, no browser, no Supabase)
- 43 logic tests pass (service mapping, phone normalisation, details object, validation, response classification, mocked network/timeout/5xx/success cases).
- All JS files pass a syntax check. All 11 pages checked for duplicate ids, broken local links, label/aria targets, inline styles/handlers/scripts, one h1, lang/title/description, and valid JSON-LD.
- NOT verified: real browser behaviour (menu, form UI, CSP), CORS, the real Edge Function response, mobile layout.
