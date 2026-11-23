/* PBS enquiry form. Sends to the existing submit-enquiry Edge Function.
   A success message is shown ONLY when the function confirms success.
   Contract assumptions are listed in CHANGELOG.md; adjust buildPayload/classifyResult if the function differs. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.PBSEnquiry = api; }
  if (typeof document !== 'undefined' && document.getElementById('enquiry-form')) { api.init(document, root); }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var FORM_VERSION = 1;
  var TIMEOUT_MS = 15000;
  // Website value -> value the Edge Function accepts.
  var ALIASES = { property: 'property', security: 'security_guard', security_guard: 'security_guard', solar: 'solar' };
  var SERVICE_FIELDS = {
    property: ['property_need', 'property_type', 'property_area', 'budget'],
    security_guard: ['premises_type', 'guards_needed', 'start_timeline'],
    solar: ['solar_category', 'monthly_bill', 'roof_available', 'owns_property']
  };
  var CHOICES = {
    property_need: ['buy', 'sell', 'rent', 'lease', 'management'],
    solar_category: ['residential', 'commercial', 'not_sure'],
    roof_available: ['yes', 'no', 'not_sure'],
    owns_property: ['yes', 'no', 'not_sure']
  };
  var MESSAGES = {
    not_connected: 'This form is not connected yet, so your enquiry has not been sent.',
    network: 'We could not reach the server, so we cannot confirm your enquiry was sent. Please check your internet connection and try again.',
    server: 'Something went wrong on our side, so we cannot confirm your enquiry was received. Please try again later.',
    unconfirmed: 'We could not confirm that your enquiry was received. Please try again later.',
    rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
    auth: 'This form is not authorised to send enquiries right now. Your enquiry has not been sent.',
    rejected: 'Your enquiry was not accepted. Please check the details you entered and try again.'
  };

  function toApiService(v) {
    var k = String(v || '').toLowerCase().trim();
    return Object.prototype.hasOwnProperty.call(ALIASES, k) ? ALIASES[k] : null;
  }
  function normalizePhone(raw) {
    var s = String(raw || '').replace(/[\s\-().]/g, '');
    s = s.replace(/^(\+91|0091|91|0)(?=\d{10}$)/, '');
    return /^[6-9]\d{9}$/.test(s) ? s : null;
  }
  function isValidEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s); }
  function str(x) { return String(x == null ? '' : x).trim(); }

  function validateValues(v) {
    var e = {}, name = str(v.full_name), city = str(v.city), msg = str(v.message), email = str(v.email);
    if (name.length < 2) e.full_name = 'Please enter your full name.';
    else if (name.length > 100) e.full_name = 'Name is too long.';
    if (!normalizePhone(v.phone)) e.phone = 'Enter a valid 10-digit Indian mobile number.';
    if (email && !isValidEmail(email)) e.email = 'Enter a valid email address or leave it blank.';
    if (city.length < 2) e.city = 'Please enter your city.';
    else if (city.length > 80) e.city = 'City name is too long.';
    if (!SERVICE_FIELDS[v.service]) e.service = 'Please choose a service.';
    if (msg.length < 10) e.message = 'Please add a few details (at least 10 characters).';
    else if (msg.length > 1500) e.message = 'Please keep your message under 1500 characters.';
    if (v.consent !== true) e.consent = 'Please tick the box to continue.';
    var info = v.serviceInfo || {};
    (SERVICE_FIELDS[v.service] || []).forEach(function (k) {
      var val = str(info[k]);
      if (!val) return;
      if (CHOICES[k]) { if (CHOICES[k].indexOf(val) === -1) e[k] = 'Please choose one of the options.'; }
      else if (k === 'guards_needed') { if (!/^\d{1,4}$/.test(val) || parseInt(val, 10) < 1) e[k] = 'Enter a whole number from 1 to 9999.'; }
      else if (val.length > 80) e[k] = 'Please keep this under 80 characters.';
    });
    return e;
  }

  // details is an OBJECT: the customer's message plus only the service fields they filled in.
  function buildDetails(v) {
    var info = {}, raw = v.serviceInfo || {};
    (SERVICE_FIELDS[v.service] || []).forEach(function (k) {
      var val = str(raw[k]);
      if (val) info[k] = (k === 'guards_needed') ? parseInt(val, 10) : val;
    });
    return { message: str(v.message), service_info: info, source: 'website_enquiry_form', form_version: FORM_VERSION };
  }
  function buildPayload(v) {
    var p = { full_name: str(v.full_name), phone: normalizePhone(v.phone), city: str(v.city), service: v.service, details: buildDetails(v), consent: v.consent === true };
    if (str(v.email)) p.email = str(v.email);
    return p;
  }

  function isConfigured(cfg) {
    return !!(cfg && typeof cfg.SUPABASE_URL === 'string' && /^https:\/\//.test(cfg.SUPABASE_URL) && !/YOUR-/i.test(cfg.SUPABASE_URL) &&
      typeof cfg.SUPABASE_ANON_KEY === 'string' && cfg.SUPABASE_ANON_KEY.length > 20 && !/YOUR-/i.test(cfg.SUPABASE_ANON_KEY));
  }

  // Turns an HTTP status + parsed body into one result. Success needs a 2xx AND explicit confirmation.
  function classifyResult(status, body) {
    if (status >= 200 && status < 300) {
      if (body && typeof body === 'object') {
        if (body.success === false || body.error) return { kind: 'rejected' };
        var id = body.lead_id || (body.data && body.data.lead_id);
        if (body.success === true || typeof id === 'string') {
          return { kind: 'success', leadId: (typeof id === 'string' && /^[A-Za-z0-9-]{3,40}$/.test(id)) ? id : null };
        }
      }
      return { kind: 'unconfirmed' };
    }
    if (status === 429) return { kind: 'rate_limited' };
    if (status === 401 || status === 403) return { kind: 'auth' };
    if (status >= 500) return { kind: 'server' };
    return { kind: 'rejected' };
  }

  // Never rejects: always resolves to a result object.
  function sendEnquiry(payload, cfg, fetchImpl) {
    if (!isConfigured(cfg)) return Promise.resolve({ kind: 'not_connected' });
    var doFetch = fetchImpl || function (u, o) { return fetch(u, o); };
    var headers = { 'Content-Type': 'application/json', 'apikey': cfg.SUPABASE_ANON_KEY };
    if (/^eyJ/.test(cfg.SUPABASE_ANON_KEY)) headers.Authorization = 'Bearer ' + cfg.SUPABASE_ANON_KEY;
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, TIMEOUT_MS);
    var url = cfg.SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1/submit-enquiry';
    return Promise.resolve().then(function () {
      return doFetch(url, { method: 'POST', headers: headers, body: JSON.stringify(payload), signal: controller ? controller.signal : undefined });
    }).then(function (res) {
      return res.text().then(function (t) {
        var body = null;
        try { body = t ? JSON.parse(t) : null; } catch (err) { body = null; }
        clearTimeout(timer);
        return classifyResult(res.status, body);
      });
    }).catch(function () { clearTimeout(timer); return { kind: 'network' }; });
  }

  function init(doc, root) {
    var form = doc.getElementById('enquiry-form');
    var statusBox = doc.getElementById('form-status'), statusMsg = doc.getElementById('status-msg');
    var okBox = doc.getElementById('form-success'), okRef = doc.getElementById('success-ref');
    var button = form.querySelector('button[type=submit]');
    var select = form.elements.service;
    var sets = form.querySelectorAll('fieldset[data-service]');
    var order = ['full_name', 'phone', 'email', 'city', 'service'];
    var sending = false;
    Object.keys(SERVICE_FIELDS).forEach(function (s) { order = order.concat(SERVICE_FIELDS[s]); });
    order = order.concat(['message', 'consent']);

    function showServiceFields() {
      var s = toApiService(select.value);
      for (var i = 0; i < sets.length; i++) sets[i].hidden = (sets[i].getAttribute('data-service') !== s);
    }
    var wanted = toApiService(new URLSearchParams(root.location.search).get('service'));
    if (wanted) select.value = wanted;
    showServiceFields();
    select.addEventListener('change', showServiceFields);

    function setError(name, msg) {
      var out = doc.getElementById('err-' + name), field = form.elements[name];
      if (out) out.textContent = msg || '';
      if (field) { if (msg) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid'); }
    }
    function readValues() {
      var val = function (n) { return form.elements[n] ? form.elements[n].value : ''; };
      var service = toApiService(select.value) || '';
      var info = {};
      (SERVICE_FIELDS[service] || []).forEach(function (k) { info[k] = val(k); });
      return { full_name: val('full_name'), phone: val('phone'), email: val('email'), city: val('city'), service: service, message: val('message'), serviceInfo: info, consent: form.elements.consent.checked };
    }
    function finish(result) {
      sending = false; button.disabled = false; button.textContent = 'Submit enquiry'; form.removeAttribute('aria-busy');
      if (result.kind === 'success') {
        form.hidden = true; statusBox.hidden = true;
        if (result.leadId) { okRef.textContent = 'Your reference ID is ' + result.leadId + '.'; okRef.hidden = false; }
        okBox.hidden = false; okBox.focus();
        return;
      }
      statusMsg.textContent = MESSAGES[result.kind] || MESSAGES.unconfirmed;
      statusBox.hidden = false; statusBox.focus();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      statusBox.hidden = true;
      // Basic bot trap only. This is NOT real spam protection (see SPAM-PROTECTION.md).
      if (form.elements.website && form.elements.website.value) return;
      var values = readValues(), errors = validateValues(values), first = null;
      order.forEach(function (n) { setError(n, errors[n]); if (errors[n] && !first) first = n; });
      if (first) { form.elements[first].focus(); return; }
      sending = true; button.disabled = true; button.textContent = 'Sending...'; form.setAttribute('aria-busy', 'true');
      sendEnquiry(buildPayload(values), root.PBS_CONFIG).then(finish);
    });
  }

  return { init: init, toApiService: toApiService, normalizePhone: normalizePhone, validateValues: validateValues, buildDetails: buildDetails,
           buildPayload: buildPayload, classifyResult: classifyResult, sendEnquiry: sendEnquiry, isConfigured: isConfigured, MESSAGES: MESSAGES };
});
