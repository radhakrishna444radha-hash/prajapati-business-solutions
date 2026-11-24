
(function () {
  // ==========================================
  // EXISTING DASHBOARD ELEMENTS
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

  // ==========================================
  // FOLLOW-UP ELEMENTS
  // ==========================================

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

  if (!tableBody) return;

  let allLeads = [];
  let allFollowUps = [];

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

  function showFollowUpMessage(text) {
    if (!followUpMessage) return;
    followUpMessage.textContent = text;
    followUpMessage.hidden = !text;
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

  function updateStats() {
    document.getElementById('total-leads').textContent =
      allLeads.length;

    document.getElementById('new-leads').textContent =
      allLeads.filter(lead => lead.status === 'new').length;

    document.getElementById('contacted-leads').textContent =
      allLeads.filter(lead => lead.status === 'contacted').length;

    document.getElementById('closed-leads').textContent =
      allLeads.filter(lead =>
        ['converted', 'lost'].includes(lead.status)
      ).length;
  }

  function createCell(value) {
    const cell = document.createElement('td');
    cell.textContent = value || '—';
    return cell;
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
        'The database request could not be completed.'
      );
    }

    return result;
  }

  // ==========================================
  // LEAD STATUS MANAGEMENT
  // ==========================================

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

    button.addEventListener('click', function () {
      openLeadDetails(lead);
    });

    return button;
  }

  function renderLeads() {
    const search = searchInput.value.trim().toLowerCase();
    const selectedService = serviceFilter.value;
    const selectedStatus = statusFilter.value;

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

        updateButton.addEventListener('click', function () {
          updateLeadStatus(
            lead.lead_id,
            statusSelect.value,
            updateButton
          );
        });

        actionCell.appendChild(statusSelect);
        actionCell.appendChild(updateButton);

        row.appendChild(actionCell);
        tableBody.appendChild(row);
      });
    }

    document.getElementById('leads-count').textContent =
      `Showing ${filtered.length} of ${allLeads.length} enquiries`;
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
        throw new Error(
          'No enquiry was updated. Please check your admin permissions.'
        );
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

    item.appendChild(heading);
    item.appendChild(content);
    container.appendChild(item);
  }

  function renderLeadDetails(lead) {
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

    const requirementHeading = document.createElement('h3');
    requirementHeading.textContent = 'Customer Requirement';

    detailsContent.appendChild(requirementHeading);

    const requirement = document.createElement('pre');
    requirement.className = 'lead-requirement';

    if (lead.details && typeof lead.details === 'object') {
      requirement.textContent = JSON.stringify(lead.details, null, 2);
    } else {
      requirement.textContent =
        String(lead.details || 'No additional details provided.');
    }

    detailsContent.appendChild(requirement);
  }

  async function loadLeadHistory(lead) {
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

        entry.appendChild(change);
        entry.appendChild(date);
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
      showMessage('Lead details panel is unavailable. Please check dashboard.html.');
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

    const selectedStatus = followUpFilter ? followUpFilter.value : '';

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

        const lead = allLeads.find(lead => lead.id === item.lead_id);

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

          completeButton.addEventListener('click', function () {
            updateFollowUpStatus(item.id, 'completed', completeButton);
          });

          const cancelButton = document.createElement('button');
          cancelButton.type = 'button';
          cancelButton.textContent = 'Cancel';
          cancelButton.className = 'update-status-button';

          cancelButton.addEventListener('click', function () {
            updateFollowUpStatus(item.id, 'cancelled', cancelButton);
          });

          actionCell.appendChild(completeButton);
          actionCell.appendChild(cancelButton);
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
      cell.textContent = 'Unable to load follow-ups. Check the message above.';

      row.appendChild(cell);
      followUpTableBody.appendChild(row);

      showFollowUpMessage(
        error.message || 'Could not load follow-ups.'
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
      showFollowUpMessage('Please select a customer and follow-up date.');
      return;
    }

    const selectedDate = new Date(dateValue);

    if (Number.isNaN(selectedDate.getTime())) {
      showFollowUpMessage('Please enter a valid follow-up date and time.');
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

      followUpForm.reset();

      showFollowUpMessage('Follow-up scheduled successfully.');

      await loadFollowUps();

    } catch (error) {
      console.error('Create follow-up error:', error);

      showFollowUpMessage(
        error.message || 'Could not schedule follow-up.'
      );

    } finally {
      saveFollowUpButton.disabled = false;
      saveFollowUpButton.textContent = 'Schedule Follow-up';
    }
  }

  async function updateFollowUpStatus(followUpId, newStatus, button) {
    if (!['completed', 'cancelled'].includes(newStatus)) {
      showFollowUpMessage('Invalid follow-up status.');
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
        throw new Error(
          'Follow-up was not updated. Please check admin permissions.'
        );
      }

      showFollowUpMessage(
        `Follow-up marked as ${followUpStatusName(newStatus)}.`
      );

      await loadFollowUps();

    } catch (error) {
      console.error('Update follow-up error:', error);

      showFollowUpMessage(
        error.message || 'Could not update follow-up.'
      );

      button.disabled = false;
      button.textContent =
        newStatus === 'completed' ? 'Complete' : 'Cancel';
    }
  }

  // ==========================================
  // LOAD CUSTOMER ENQUIRIES
  // ==========================================

  async function loadLeads() {
    refreshButton.disabled = true;
    showMessage('Loading enquiries...');

    try {
      const query = new URLSearchParams();

      query.set(
        'select',
        'id,lead_id,full_name,phone,email,city,service,status,details,created_at,updated_at'
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
      console.error('Dashboard error:', error);

      showMessage(
        error.message || 'Something went wrong while loading enquiries.'
      );

      tableBody.replaceChildren();

      const row = document.createElement('tr');
      const cell = document.createElement('td');

      cell.colSpan = 8;
      cell.textContent =
        'Unable to load enquiries. Please check the error message above.';

      row.appendChild(cell);
      tableBody.appendChild(row);

    } finally {
      refreshButton.disabled = false;
    }
  }

  // ==========================================
  // EVENT LISTENERS
  // ==========================================

  searchInput.addEventListener('input', renderLeads);
  serviceFilter.addEventListener('change', renderLeads);
  statusFilter.addEventListener('change', renderLeads);
  refreshButton.addEventListener('click', loadLeads);

  if (followUpForm) {
    followUpForm.addEventListener('submit', createFollowUp);
  }

  if (followUpFilter) {
    followUpFilter.addEventListener('change', renderFollowUps);
  }

  if (refreshFollowUpsButton) {
    refreshFollowUpsButton.addEventListener('click', loadFollowUps);
  }

  if (closeModalButton) {
    closeModalButton.addEventListener('click', closeLeadDetails);
  }

  if (modal) {
    modal.addEventListener('click', function (event) {
      if (event.target === modal) {
        closeLeadDetails();
      }
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && modal && !modal.hidden) {
      closeLeadDetails();
    }
  });

  // ==========================================
  // INITIALIZE DASHBOARD
  // ==========================================

  loadLeads();

})();
