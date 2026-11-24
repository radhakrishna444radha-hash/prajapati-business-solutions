
(function () {
  'use strict';

  // ==========================================
  // DASHBOARD ELEMENTS
  // ==========================================

  const tableBody = document.getElementById('leads-table-body');
  const message = document.getElementById('dashboard-message');
  const searchInput = document.getElementById('search-leads');
  const serviceFilter = document.getElementById('filter-service');
  const statusFilter = document.getElementById('filter-status');
  const refreshButton = document.getElementById('refresh-button');

  const modal = document.getElementById('lead-details-modal');
  const closeModalButton = document.getElementById('close-lead-details');
  const detailsContent = document.getElementById('lead-details-content');
  const historyContent = document.getElementById('lead-history-content');

  // FOLLOW-UPS

  const followUpForm = document.getElementById('follow-up-form');
  const followUpLeadSelect = document.getElementById('follow-up-lead');
  const followUpDateInput = document.getElementById('follow-up-at');
  const followUpNotesInput = document.getElementById('follow-up-notes');
  const followUpMessage = document.getElementById('follow-up-message');
  const followUpTableBody = document.getElementById('follow-ups-table-body');
  const followUpFilter = document.getElementById('filter-follow-up-status');
  const followUpCount = document.getElementById('follow-ups-count');
  const refreshFollowUpsButton = document.getElementById('refresh-follow-ups');
  const saveFollowUpButton = document.getElementById('save-follow-up');

  // PROPERTIES

  const propertiesTableBody = document.getElementById('properties-table-body');
  const propertyMessage = document.getElementById('property-management-message');
  const propertySearchInput = document.getElementById('search-properties');
  const propertyTypeFilter = document.getElementById('filter-property-type');
  const propertyReviewFilter = document.getElementById('filter-property-status');
  const refreshPropertiesButton = document.getElementById('refresh-properties');

  const propertyModal = document.getElementById('property-details-modal');
  const closePropertyModalButton = document.getElementById('close-property-details');
  const propertyDetailsContent = document.getElementById('property-details-content');
  const propertyMediaContent = document.getElementById('property-media-content');
  const approvePropertyButton = document.getElementById('approve-property');
  const rejectPropertyButton = document.getElementById('reject-property');

  if (!tableBody) {
    console.error('Dashboard: leads table was not found.');
    return;
  }

  let allLeads = [];
  let allFollowUps = [];
  let allProperties = [];
  let selectedProperty = null;

  const STATUSES = [
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'follow_up', label: 'Follow-up' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'converted', label: 'Converted' },
    { value: 'lost', label: 'Lost' }
  ];

  const FOLLOW_UP_STATUSES = [
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  // ==========================================
  // GENERAL HELPERS
  // ==========================================

  function showMessage(text) {
    if (!message) return;
    message.textContent = text;
    message.hidden = !text;
  }

  function showFollowUpMessage(text, isError = false) {
    if (!followUpMessage) return;
    followUpMessage.textContent = text;
    followUpMessage.hidden = !text;
    followUpMessage.classList.toggle('error', isError);
  }

  function showPropertyMessage(text, isError = false) {
    if (!propertyMessage) return;
    propertyMessage.textContent = text;
    propertyMessage.hidden = !text;
    propertyMessage.classList.toggle('error', isError);
  }

  function formatDate(value) {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  function createCell(value) {
    const cell = document.createElement('td');
    cell.textContent =
      value === null || value === undefined || value === ''
        ? '—'
        : String(value);
    return cell;
  }

  function addDetailRow(container, label, value) {
    const item = document.createElement('div');
    item.className = 'lead-detail-item';

    const heading = document.createElement('strong');
    heading.textContent = label;

    const content = document.createElement('p');

    if (value === null || value === undefined || value === '') {
      content.textContent = '—';
    } else if (typeof value === 'object') {
      content.textContent = JSON.stringify(value, null, 2);
    } else {
      content.textContent = String(value);
    }

    item.append(heading, content);
    container.appendChild(item);
  }

  function serviceName(service) {
    const names = {
      property: 'Property',
      security: 'Security Services',
      security_guard: 'Security Services',
      solar: 'Solar Services'
    };

    return names[service] || service || '—';
  }

  function statusName(status) {
    const item = STATUSES.find(item => item.value === status);
    return item ? item.label : status || '—';
  }

  function followUpStatusName(status) {
    const item = FOLLOW_UP_STATUSES.find(item => item.value === status);
    return item ? item.label : status || '—';
  }

  function propertyReviewStatusName(status) {
    const names = {
      pending: 'Pending Review',
      approved: 'Approved',
      rejected: 'Rejected'
    };

    return names[status] || status || '—';
  }

  // ==========================================
  // SUPABASE SESSION AND REQUEST
  // ==========================================

  async function getSessionDetails() {
    const admin = window.PBSAdmin;

    if (!admin || !admin.ready) {
      throw new Error('Admin session could not be verified.');
    }

    await admin.ready;

    const accessToken = admin.getAccessToken();
    const config = window.PBS_CONFIG || {};

    if (
      !accessToken ||
      !config.SUPABASE_URL ||
      !config.SUPABASE_ANON_KEY
    ) {
      throw new Error(
        'Session or Supabase configuration is missing. Please login again.'
      );
    }

    return { accessToken, config };
  }

  async function supabaseRequest(path, options = {}) {
    const { accessToken, config } = await getSessionDetails();

    const response = await fetch(
      `${config.SUPABASE_URL}/rest/v1/${path}`,
      {
        ...options,
        headers: {
          apikey: config.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          ...(options.headers || {})
        }
      }
    );

    const responseText = await response.text();
    let result = null;

    try {
      result = responseText ? JSON.parse(responseText) : null;
    } catch {
      result = null;
    }

    if (!response.ok) {
      throw new Error(
        result?.message ||
        result?.msg ||
        result?.error_description ||
        'The database request could not be completed.'
      );
    }

    return result;
  }

  // ==========================================
  // LEAD MANAGEMENT
  // ==========================================

  function updateStats() {
    const total = document.getElementById('total-leads');
    const fresh = document.getElementById('new-leads');
    const contacted = document.getElementById('contacted-leads');
    const closed = document.getElementById('closed-leads');

    if (total) total.textContent = allLeads.length;

    if (fresh) {
      fresh.textContent =
        allLeads.filter(lead => lead.status === 'new').length;
    }

    if (contacted) {
      contacted.textContent =
        allLeads.filter(lead => lead.status === 'contacted').length;
    }

    if (closed) {
      closed.textContent =
        allLeads.filter(lead =>
          ['converted', 'lost'].includes(lead.status)
        ).length;
    }
  }

  function createStatusSelect(currentStatus) {
    const select = document.createElement('select');
    select.className = 'lead-status-select';
    select.setAttribute('aria-label', 'Select enquiry status');

    STATUSES.forEach(status => {
      const option = document.createElement('option');
      option.value = status.value;
      option.textContent = status.label;
      option.selected = status.value === currentStatus;
      select.appendChild(option);
    });

    return select;
  }

  function createLeadIdButton(lead) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'view-lead-button';
    button.textContent = lead.lead_id || 'View Details';

    button.addEventListener('click', () => openLeadDetails(lead));

    return button;
  }

  function renderLeads() {
    const search = searchInput
      ? searchInput.value.trim().toLowerCase()
      : '';

    const selectedService = serviceFilter ? serviceFilter.value : '';
    const selectedStatus = statusFilter ? statusFilter.value : '';

    const filtered = allLeads.filter(lead => {
      const matchesSearch = [
        lead.lead_id,
        lead.full_name,
        lead.phone
      ].some(value =>
        String(value || '').toLowerCase().includes(search)
      );

      const matchesService =
        !selectedService ||
        lead.service === selectedService ||
        (selectedService === 'security' &&
          lead.service === 'security_guard');

      const matchesStatus =
        !selectedStatus || lead.status === selectedStatus;

      return matchesSearch && matchesService && matchesStatus;
    });

    tableBody.replaceChildren();

    if (filtered.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 8;
      cell.textContent = 'No enquiries found.';
      row.appendChild(cell);
      tableBody.appendChild(row);
    } else {
      filtered.forEach(lead => {
        const row = document.createElement('tr');

        const leadIdCell = document.createElement('td');
        leadIdCell.appendChild(createLeadIdButton(lead));
        row.appendChild(leadIdCell);

        row.appendChild(createCell(lead.full_name));
        row.appendChild(createCell(lead.phone));
        row.appendChild(createCell(lead.city));
        row.appendChild(createCell(serviceName(lead.service)));
        row.appendChild(createCell(statusName(lead.status)));
        row.appendChild(createCell(formatDate(lead.created_at)));

        const actionCell = document.createElement('td');
        const statusSelect = createStatusSelect(lead.status);
        const updateButton = document.createElement('button');

        updateButton.type = 'button';
        updateButton.textContent = 'Update';
        updateButton.className = 'update-status-button';

        updateButton.addEventListener('click', () => {
          updateLeadStatus(
            lead.lead_id,
            statusSelect.value,
            updateButton
          );
        });

        actionCell.append(statusSelect, updateButton);
        row.appendChild(actionCell);
        tableBody.appendChild(row);
      });
    }

    const count = document.getElementById('leads-count');

    if (count) {
      count.textContent =
        `Showing ${filtered.length} of ${allLeads.length} enquiries`;
    }
  }

  async function loadLeads() {
    if (refreshButton) refreshButton.disabled = true;

    showMessage('Loading enquiries...');

    try {
      const query = new URLSearchParams();
      query.set(
        'select',
        'id,lead_id,full_name,phone,email,city,service,details,status,created_at,updated_at'
      );
      query.set('order', 'created_at.desc');

      const result = await supabaseRequest(
        `leads?${query.toString()}`
      );

      allLeads = Array.isArray(result) ? result : [];

      updateStats();
      renderLeads();
      populateFollowUpLeadOptions();

      showMessage('');

      await loadFollowUps();

    } catch (error) {
      console.error('Lead loading error:', error);
      showMessage(error.message || 'Could not load enquiries.');
    } finally {
      if (refreshButton) refreshButton.disabled = false;
    }
  }

  async function updateLeadStatus(leadId, newStatus, button) {
    if (!STATUSES.some(status => status.value === newStatus)) {
      showMessage('Invalid status selected.');
      return;
    }

    const lead = allLeads.find(item => item.lead_id === leadId);

    if (!lead) {
      showMessage('Enquiry not found. Please refresh the dashboard.');
      return;
    }

    if (lead.status === newStatus) {
      showMessage('No status change was made.');
      return;
    }

    button.disabled = true;
    button.textContent = 'Saving...';
    showMessage('Updating enquiry status...');

    try {
      const query = new URLSearchParams();
      query.set('lead_id', `eq.${leadId}`);

      const result = await supabaseRequest(
        `leads?${query.toString()}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify({ status: newStatus })
        }
      );

      if (!Array.isArray(result) || result.length === 0) {
        throw new Error('No enquiry was updated. Check admin permissions.');
      }

      const updatedLead = result[0];

      allLeads = allLeads.map(item =>
        item.lead_id === leadId
          ? { ...item, ...updatedLead }
          : item
      );

      updateStats();
      renderLeads();
      showMessage(`Status updated successfully for ${leadId}.`);

    } catch (error) {
      console.error('Status update error:', error);
      showMessage(error.message || 'Could not update enquiry status.');
      button.disabled = false;
      button.textContent = 'Update';
    }
  }

  // ==========================================
  // LEAD DETAILS AND STATUS HISTORY
  // ==========================================

  function renderLeadDetails(lead) {
    if (!detailsContent) return;

    detailsContent.replaceChildren();

    addDetailRow(detailsContent, 'Lead ID', lead.lead_id);
    addDetailRow(detailsContent, 'Customer Name', lead.full_name);
    addDetailRow(detailsContent, 'Phone Number', lead.phone);
    addDetailRow(detailsContent, 'Email Address', lead.email);
    addDetailRow(detailsContent, 'City', lead.city);
    addDetailRow(detailsContent, 'Service', serviceName(lead.service));
    addDetailRow(detailsContent, 'Current Status', statusName(lead.status));
    addDetailRow(detailsContent, 'Enquiry Date', formatDate(lead.created_at));
    addDetailRow(detailsContent, 'Last Updated', formatDate(lead.updated_at));

    const heading = document.createElement('h3');
    heading.textContent = 'Customer Requirement';
    detailsContent.appendChild(heading);

    const requirement = document.createElement('pre');
    requirement.className = 'lead-requirement';

    requirement.textContent =
      lead.details && typeof lead.details === 'object'
        ? JSON.stringify(lead.details, null, 2)
        : String(lead.details || 'No additional details provided.');

    detailsContent.appendChild(requirement);
  }

  async function loadLeadHistory(lead) {
    if (!historyContent) return;

    historyContent.replaceChildren();

    const loading = document.createElement('p');
    loading.textContent = 'Loading status history...';
    historyContent.appendChild(loading);

    try {
      const query = new URLSearchParams();
      query.set('select', 'old_status,new_status,changed_at');
      query.set('lead_id', `eq.${lead.id}`);
      query.set('order', 'changed_at.desc');

      const history = await supabaseRequest(
        `lead_status_history?${query.toString()}`
      );

      historyContent.replaceChildren();

      if (!Array.isArray(history) || history.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'No status changes recorded yet.';
        historyContent.appendChild(empty);
        return;
      }

      history.forEach(item => {
        const entry = document.createElement('div');
        entry.className = 'lead-history-entry';

        const change = document.createElement('p');
        change.textContent =
          `${statusName(item.old_status)} → ${statusName(item.new_status)}`;

        const date = document.createElement('small');
        date.textContent = formatDate(item.changed_at);

        entry.append(change, date);
        historyContent.appendChild(entry);
      });

    } catch (error) {
      console.error('Lead history error:', error);
      historyContent.replaceChildren();

      const errorText = document.createElement('p');
      errorText.textContent =
        `Could not load status history: ${error.message}`;

      historyContent.appendChild(errorText);
    }
  }

  async function openLeadDetails(lead) {
    if (!modal || !detailsContent || !historyContent) {
      showMessage('Lead details panel is unavailable.');
      return;
    }

    modal.hidden = false;
    renderLeadDetails(lead);
    await loadLeadHistory(lead);
  }

  function closeLeadDetails() {
    if (modal) modal.hidden = true;
  }

  // ==========================================
  // FOLLOW-UP MANAGEMENT
  // ==========================================

  function populateFollowUpLeadOptions() {
    if (!followUpLeadSelect) return;

    const currentValue = followUpLeadSelect.value;
    followUpLeadSelect.replaceChildren();

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select a customer';
    followUpLeadSelect.appendChild(placeholder);

    allLeads.forEach(lead => {
      const option = document.createElement('option');
      option.value = lead.id;
      option.textContent =
        `${lead.lead_id} - ${lead.full_name} (${lead.phone})`;
      followUpLeadSelect.appendChild(option);
    });

    if (allLeads.some(lead => lead.id === currentValue)) {
      followUpLeadSelect.value = currentValue;
    }
  }

  function renderFollowUps() {
    if (!followUpTableBody) return;

    const selectedStatus = followUpFilter
      ? followUpFilter.value
      : '';

    const filtered = allFollowUps.filter(item =>
      !selectedStatus || item.status === selectedStatus
    );

    followUpTableBody.replaceChildren();

    if (filtered.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.textContent = 'No follow-ups found.';
      row.appendChild(cell);
      followUpTableBody.appendChild(row);
    } else {
      filtered.forEach(item => {
        const row = document.createElement('tr');

        const lead = allLeads.find(
          lead => lead.id === item.lead_id
        );

        row.appendChild(createCell(lead ? lead.full_name : 'Customer'));
        row.appendChild(createCell(lead ? lead.lead_id : '—'));
        row.appendChild(createCell(formatDate(item.follow_up_at)));
        row.appendChild(createCell(item.notes || '—'));
        row.appendChild(createCell(followUpStatusName(item.status)));

        const actionCell = document.createElement('td');

        if (item.status === 'pending') {
          const completeButton = document.createElement('button');
          completeButton.type = 'button';
          completeButton.textContent = 'Complete';
          completeButton.className = 'update-status-button';

          completeButton.addEventListener('click', () => {
            updateFollowUpStatus(item.id, 'completed', completeButton);
          });

          const cancelButton = document.createElement('button');
          cancelButton.type = 'button';
          cancelButton.textContent = 'Cancel';
          cancelButton.className = 'update-status-button';

          cancelButton.addEventListener('click', () => {
            updateFollowUpStatus(item.id, 'cancelled', cancelButton);
          });

          actionCell.append(completeButton, cancelButton);
        } else {
          actionCell.textContent = '—';
        }

        row.appendChild(actionCell);
        followUpTableBody.appendChild(row);
      });
    }

    if (followUpCount) {
      followUpCount.textContent =
        `Showing ${filtered.length} of ${allFollowUps.length} follow-ups`;
    }
  }

  async function loadFollowUps() {
    if (!followUpTableBody) return;

    if (refreshFollowUpsButton) {
      refreshFollowUpsButton.disabled = true;
    }

    followUpTableBody.replaceChildren();

    const loadingRow = document.createElement('tr');
    const loadingCell = document.createElement('td');
    loadingCell.colSpan = 6;
    loadingCell.textContent = 'Loading follow-ups...';
    loadingRow.appendChild(loadingCell);
    followUpTableBody.appendChild(loadingRow);

    try {
      const query = new URLSearchParams();
      query.set(
        'select',
        'id,lead_id,follow_up_at,notes,status,created_at'
      );
      query.set('order', 'follow_up_at.asc');

      const result = await supabaseRequest(
        `follow_ups?${query.toString()}`
      );

      allFollowUps = Array.isArray(result) ? result : [];
      renderFollowUps();
      showFollowUpMessage('');

    } catch (error) {
      console.error('Follow-up loading error:', error);

      followUpTableBody.replaceChildren();

      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.textContent = 'Unable to load follow-ups.';
      row.appendChild(cell);
      followUpTableBody.appendChild(row);

      showFollowUpMessage(
        error.message || 'Could not load follow-ups.',
        true
      );

    } finally {
      if (refreshFollowUpsButton) {
        refreshFollowUpsButton.disabled = false;
      }
    }
  }

  async function createFollowUp(event) {
    event.preventDefault();

    if (
      !followUpLeadSelect ||
      !followUpDateInput ||
      !saveFollowUpButton
    ) {
      return;
    }

    const leadId = followUpLeadSelect.value;
    const dateValue = followUpDateInput.value;
    const notes = followUpNotesInput
      ? followUpNotesInput.value.trim()
      : '';

    if (!leadId || !dateValue) {
      showFollowUpMessage(
        'Please select a customer and follow-up date.',
        true
      );
      return;
    }

    const selectedDate = new Date(dateValue);

    if (Number.isNaN(selectedDate.getTime())) {
      showFollowUpMessage('Please enter a valid date and time.', true);
      return;
    }

    saveFollowUpButton.disabled = true;
    saveFollowUpButton.textContent = 'Saving...';
    showFollowUpMessage('Saving follow-up...');

    try {
      const payload = {
        lead_id: leadId,
        follow_up_at: selectedDate.toISOString(),
        notes: notes || null,
        status: 'pending'
      };

      const result = await supabaseRequest('follow_ups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify(payload)
      });

      if (!Array.isArray(result) || result.length === 0) {
        throw new Error('Follow-up was not saved. Please try again.');
      }

      if (followUpForm) followUpForm.reset();

      showFollowUpMessage('Follow-up scheduled successfully.');
      await loadFollowUps();

    } catch (error) {
      console.error('Create follow-up error:', error);
      showFollowUpMessage(
        error.message || 'Could not schedule follow-up.',
        true
      );

    } finally {
      saveFollowUpButton.disabled = false;
      saveFollowUpButton.textContent = 'Schedule Follow-up';
    }
  }

  async function updateFollowUpStatus(followUpId, newStatus, button) {
    if (!['completed', 'cancelled'].includes(newStatus)) {
      showFollowUpMessage('Invalid follow-up status.', true);
      return;
    }

    button.disabled = true;
    button.textContent = 'Saving...';
    showFollowUpMessage('Updating follow-up...');

    try {
      const query = new URLSearchParams();
      query.set('id', `eq.${followUpId}`);

      const result = await supabaseRequest(
        `follow_ups?${query.toString()}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify({
            status: newStatus,
            updated_at: new Date().toISOString()
          })
        }
      );

      if (!Array.isArray(result) || result.length === 0) {
        throw new Error('Follow-up was not updated.');
      }

      showFollowUpMessage(
        `Follow-up marked as ${followUpStatusName(newStatus)}.`
      );

      await loadFollowUps();

    } catch (error) {
      console.error('Update follow-up error:', error);
      showFollowUpMessage(
        error.message || 'Could not update follow-up.',
        true
      );

      button.disabled = false;
      button.textContent =
        newStatus === 'completed' ? 'Complete' : 'Cancel';
    }
  }

  // ==========================================
  // PROPERTY MANAGEMENT
  // ==========================================

  function renderPropertyStats() {
    const total = allProperties.length;

    const pending = allProperties.filter(
      property => property.review_status === 'pending'
    ).length;

    const published = allProperties.filter(
      property =>
        property.review_status === 'approved' &&
        property.is_published === true
    ).length;

    const inactive = allProperties.filter(
      property =>
        property.review_status === 'rejected' ||
        property.status !== 'available'
    ).length;

    const totalElement = document.getElementById('total-properties');
    const pendingElement = document.getElementById('pending-properties');
    const publishedElement = document.getElementById('published-properties');
    const inactiveElement = document.getElementById('inactive-properties');

    if (totalElement) totalElement.textContent = total;
    if (pendingElement) pendingElement.textContent = pending;
    if (publishedElement) publishedElement.textContent = published;
    if (inactiveElement) inactiveElement.textContent = inactive;
  }

  function renderProperties() {
    if (!propertiesTableBody) return;

    const search = propertySearchInput
      ? propertySearchInput.value.trim().toLowerCase()
      : '';

    const typeFilter = propertyTypeFilter
      ? propertyTypeFilter.value
      : '';

    const statusFilter = propertyReviewFilter
      ? propertyReviewFilter.value
      : '';

    const filtered = allProperties.filter(property => {
      const searchable = [
        property.title,
        property.city,
        property.owner_name,
        property.owner_phone,
        property.listing_type,
        property.property_type
      ].join(' ').toLowerCase();

      const matchesSearch = !search || searchable.includes(search);
      const matchesType =
        !typeFilter || property.listing_type === typeFilter;
      const matchesStatus =
        !statusFilter || property.review_status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });

    propertiesTableBody.replaceChildren();

    if (filtered.length === 0) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 7;
      cell.textContent = 'No properties found.';
      row.appendChild(cell);
      propertiesTableBody.appendChild(row);
      return;
    }

    filtered.forEach(property => {
      const row = document.createElement('tr');

      row.appendChild(createCell(property.title || 'Untitled'));
      row.appendChild(createCell(property.owner_name));
      row.appendChild(createCell(property.city));
      row.appendChild(createCell(property.listing_type));
      row.appendChild(createCell(property.property_type));
      row.appendChild(
        createCell(propertyReviewStatusName(property.review_status))
      );

      const actionCell = document.createElement('td');
      const viewButton = document.createElement('button');

      viewButton.type = 'button';
      viewButton.className = 'view-lead-button';
      viewButton.textContent = 'View Details';

      viewButton.addEventListener('click', () => {
        openPropertyDetails(property);
      });

      actionCell.appendChild(viewButton);
      row.appendChild(actionCell);
      propertiesTableBody.appendChild(row);
    });
  }

  async function loadProperties() {
    if (!propertiesTableBody) return;

    if (refreshPropertiesButton) {
      refreshPropertiesButton.disabled = true;
    }

    propertiesTableBody.replaceChildren();

    const loadingRow = document.createElement('tr');
    const loadingCell = document.createElement('td');
    loadingCell.colSpan = 7;
    loadingCell.textContent = 'Loading properties...';
    loadingRow.appendChild(loadingCell);
    propertiesTableBody.appendChild(loadingRow);

    try {
      const query = new URLSearchParams();

      query.set(
        'select',
        'id,title,slug,description,property_type,listing_type,city,state,address,price,area_sqft,bedrooms,bathroom,status,is_published,created_by,created_at,updated_at,owner_name,owner_phone,owner_email,review_status'
      );

      query.set('order', 'created_at.desc');

      const result = await supabaseRequest(
        `properties?${query.toString()}`
      );

      allProperties = Array.isArray(result) ? result : [];

      renderPropertyStats();
      renderProperties();
      showPropertyMessage('');

    } catch (error) {
      console.error('Property loading error:', error);

      propertiesTableBody.replaceChildren();

      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 7;
      cell.textContent = 'Unable to load properties.';
      row.appendChild(cell);
      propertiesTableBody.appendChild(row);

      showPropertyMessage(
        error.message || 'Could not load properties.',
        true
      );

    } finally {
      if (refreshPropertiesButton) {
        refreshPropertiesButton.disabled = false;
      }
    }
  }

  // ==========================================
  // PRIVATE PROPERTY MEDIA PREVIEW
  // ==========================================

  async function createSignedMediaUrl(storagePath) {
    const { accessToken, config } = await getSessionDetails();

    const encodedPath = storagePath
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/');

    const response = await fetch(
      `${config.SUPABASE_URL}/storage/v1/object/sign/property-images/${encodedPath}`,
      {
        method: 'POST',
        headers: {
          apikey: config.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          expiresIn: 3600
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || 'Could not create media preview URL.'
      );
    }

    const signedPath = result.signedURL || result.signedUrl;

    if (!signedPath) {
      throw new Error('Could not create media preview URL.');
    }

    if (
      signedPath.startsWith('http://') ||
      signedPath.startsWith('https://')
    ) {
      return signedPath;
    }

    if (signedPath.startsWith('/storage/v1/')) {
      return `${config.SUPABASE_URL}${signedPath}`;
    }

    return `${config.SUPABASE_URL}/storage/v1${signedPath}`;
  }

  async function loadPropertyMedia(propertyId) {
    if (!propertyMediaContent) return;

    propertyMediaContent.replaceChildren();

    const loading = document.createElement('p');
    loading.textContent = 'Loading property photos and videos...';
    propertyMediaContent.appendChild(loading);

    try {
      const query = new URLSearchParams();

      query.set(
        'select',
        'id,property_id,storage_path,caption,sort_order,is_cover,media_type,created_at'
      );

      query.set('property_id', `eq.${propertyId}`);
      query.set('order', 'sort_order.asc');

      const media = await supabaseRequest(
        `property_images?${query.toString()}`
      );

      propertyMediaContent.replaceChildren();

      if (!Array.isArray(media) || media.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'No photos or videos uploaded for this property.';
        propertyMediaContent.appendChild(empty);
        return;
      }

      for (const item of media) {
        const wrapper = document.createElement('div');
        wrapper.className = 'property-media-item';

        const caption = document.createElement('p');
        caption.textContent =
          `${item.caption || 'Property media'}${item.is_cover ? ' (Cover)' : ''}`;

        wrapper.appendChild(caption);

        try {
          const mediaUrl = await createSignedMediaUrl(item.storage_path);

          let preview;

          if (item.media_type === 'video') {
            preview = document.createElement('video');
            preview.controls = true;
            preview.preload = 'metadata';
          } else {
            preview = document.createElement('img');
            preview.alt = item.caption || 'Property photo';
            preview.loading = 'lazy';
          }

          preview.src = mediaUrl;
          preview.className = 'property-media-preview';
          wrapper.appendChild(preview);

        } catch (mediaError) {
          const errorText = document.createElement('p');
          errorText.textContent =
            `Media preview unavailable: ${mediaError.message}`;
          wrapper.appendChild(errorText);
        }

        propertyMediaContent.appendChild(wrapper);
      }

    } catch (error) {
      console.error('Property media loading error:', error);
      propertyMediaContent.replaceChildren();

      const errorText = document.createElement('p');
      errorText.textContent =
        `Could not load property media: ${error.message}`;

      propertyMediaContent.appendChild(errorText);
    }
  }

  // ==========================================
  // PROPERTY DETAILS AND REVIEW
  // ==========================================

  function renderPropertyDetails(property) {
    if (!propertyDetailsContent) return;

    propertyDetailsContent.replaceChildren();

    addDetailRow(propertyDetailsContent, 'Property Title', property.title);
    addDetailRow(propertyDetailsContent, 'Listing Type', property.listing_type);
    addDetailRow(propertyDetailsContent, 'Property Type', property.property_type);
    addDetailRow(propertyDetailsContent, 'Description', property.description);
    addDetailRow(propertyDetailsContent, 'City', property.city);
    addDetailRow(propertyDetailsContent, 'State', property.state);
    addDetailRow(propertyDetailsContent, 'Address', property.address);
    addDetailRow(propertyDetailsContent, 'Price', property.price);
    addDetailRow(propertyDetailsContent, 'Area (sq. ft.)', property.area_sqft);
    addDetailRow(propertyDetailsContent, 'Bedrooms', property.bedrooms);
    addDetailRow(propertyDetailsContent, 'Bathrooms', property.bathroom);
    addDetailRow(propertyDetailsContent, 'Availability', property.status);
    addDetailRow(
      propertyDetailsContent,
      'Review Status',
      propertyReviewStatusName(property.review_status)
    );
    addDetailRow(
      propertyDetailsContent,
      'Published',
      property.is_published ? 'Yes' : 'No'
    );

    const ownerHeading = document.createElement('h3');
    ownerHeading.textContent = 'Owner Contact Details';
    propertyDetailsContent.appendChild(ownerHeading);

    addDetailRow(propertyDetailsContent, 'Owner Name', property.owner_name);
    addDetailRow(propertyDetailsContent, 'Owner Phone', property.owner_phone);
    addDetailRow(propertyDetailsContent, 'Owner Email', property.owner_email);

    addDetailRow(
      propertyDetailsContent,
      'Submitted On',
      formatDate(property.created_at)
    );
  }

  async function openPropertyDetails(property) {
    if (
      !propertyModal ||
      !propertyDetailsContent ||
      !propertyMediaContent
    ) {
      showPropertyMessage(
        'Property details panel is unavailable. Check dashboard.html.',
        true
      );
      return;
    }

    selectedProperty = property.id;

    renderPropertyDetails(property);
    propertyModal.hidden = false;

    if (approvePropertyButton) {
      approvePropertyButton.disabled = false;
      approvePropertyButton.hidden =
        property.review_status === 'approved';
    }

    if (rejectPropertyButton) {
      rejectPropertyButton.disabled = false;
      rejectPropertyButton.hidden =
        property.review_status === 'rejected';
    }

    await loadPropertyMedia(property.id);
  }

  function closePropertyDetails() {
    if (propertyModal) propertyModal.hidden = true;
    selectedProperty = null;

    if (propertyMediaContent) {
      propertyMediaContent.replaceChildren();
    }
  }

  async function updatePropertyReview(newReviewStatus, button) {
    if (!selectedProperty) {
      showPropertyMessage('Please open a property first.', true);
      return;
    }

    if (!['approved', 'rejected'].includes(newReviewStatus)) {
      showPropertyMessage('Invalid review status.', true);
      return;
    }

    const property = allProperties.find(
      item => item.id === selectedProperty
    );

    if (!property) {
      showPropertyMessage('Property not found. Refresh the dashboard.', true);
      return;
    }

    if (
      property.review_status === newReviewStatus &&
      property.is_published === (newReviewStatus === 'approved')
    ) {
      showPropertyMessage(
        `This property is already ${newReviewStatus}.`
      );
      return;
    }

    const originalText = button ? button.textContent : '';

    if (button) {
      button.disabled = true;
      button.textContent = 'Saving...';
    }

    showPropertyMessage('Updating property review status...');

    try {
      const query = new URLSearchParams();
      query.set('id', `eq.${selectedProperty}`);

      const payload = {
        review_status: newReviewStatus,
        is_published: newReviewStatus === 'approved',
        updated_at: new Date().toISOString()
      };

      const result = await supabaseRequest(
        `properties?${query.toString()}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!Array.isArray(result) || result.length === 0) {
        throw new Error(
          'Property was not updated. Check admin permissions.'
        );
      }

      const updatedProperty = result[0];

      allProperties = allProperties.map(item =>
        item.id === selectedProperty
          ? { ...item, ...updatedProperty }
          : item
      );

      renderPropertyStats();
      renderProperties();
      renderPropertyDetails(updatedProperty);

      showPropertyMessage(
        newReviewStatus === 'approved'
          ? 'Property approved and marked for publication.'
          : 'Property rejected and unpublished.'
      );

      if (approvePropertyButton) {
        approvePropertyButton.hidden =
          newReviewStatus === 'approved';
      }

      if (rejectPropertyButton) {
        rejectPropertyButton.hidden =
          newReviewStatus === 'rejected';
      }

    } catch (error) {
      console.error('Property review error:', error);

      showPropertyMessage(
        error.message || 'Could not update property review.',
        true
      );

      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================

  if (searchInput) {
    searchInput.addEventListener('input', renderLeads);
  }

  if (serviceFilter) {
    serviceFilter.addEventListener('change', renderLeads);
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', renderLeads);
  }

  if (refreshButton) {
    refreshButton.addEventListener('click', loadLeads);
  }

  if (closeModalButton) {
    closeModalButton.addEventListener('click', closeLeadDetails);
  }

  if (modal) {
    modal.addEventListener('click', event => {
      if (event.target === modal) closeLeadDetails();
    });
  }

  if (followUpForm) {
    followUpForm.addEventListener('submit', createFollowUp);
  }

  if (followUpFilter) {
    followUpFilter.addEventListener('change', renderFollowUps);
  }

  if (refreshFollowUpsButton) {
    refreshFollowUpsButton.addEventListener('click', loadFollowUps);
  }

  if (propertySearchInput) {
    propertySearchInput.addEventListener('input', renderProperties);
  }

  if (propertyTypeFilter) {
    propertyTypeFilter.addEventListener('change', renderProperties);
  }

  if (propertyReviewFilter) {
    propertyReviewFilter.addEventListener('change', renderProperties);
  }

  if (refreshPropertiesButton) {
    refreshPropertiesButton.addEventListener('click', loadProperties);
  }

  if (closePropertyModalButton) {
    closePropertyModalButton.addEventListener(
      'click',
      closePropertyDetails
    );
  }

  if (propertyModal) {
    propertyModal.addEventListener('click', event => {
      if (event.target === propertyModal) {
        closePropertyDetails();
      }
    });
  }

  if (approvePropertyButton) {
    approvePropertyButton.addEventListener('click', () => {
      updatePropertyReview('approved', approvePropertyButton);
    });
  }

  if (rejectPropertyButton) {
    rejectPropertyButton.addEventListener('click', () => {
      updatePropertyReview('rejected', rejectPropertyButton);
    });
  }

  // ==========================================
  // INITIAL LOAD
  // ==========================================

  loadLeads();

  if (propertiesTableBody) {
    loadProperties();
  }

})();
