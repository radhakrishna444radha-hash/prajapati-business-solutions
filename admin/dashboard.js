
(function () {
  const tableBody = document.getElementById('leads-table-body');
  const message = document.getElementById('dashboard-message');
  const searchInput = document.getElementById('search-leads');
  const serviceFilter = document.getElementById('filter-service');
  const statusFilter = document.getElementById('filter-status');
  const refreshButton = document.getElementById('refresh-button');

  if (!tableBody) return;

  let allLeads = [];

  const STATUSES = [
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'follow_up', label: 'Follow-up' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'converted', label: 'Converted' },
    { value: 'lost', label: 'Lost' }
  ];

  function showMessage(text) {
    message.textContent = text;
    message.hidden = !text;
  }

  function formatDate(value) {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleDateString('en-IN');
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
    return item ? item.label : status;
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

        row.appendChild(createCell(lead.lead_id));
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

  async function getSessionDetails() {
    const admin = window.PBSAdmin;

    if (!admin || !admin.ready) {
      throw new Error('Admin session could not be verified.');
    }

    await admin.ready;

    const accessToken = admin.getAccessToken();
    const config = window.PBS_CONFIG || {};

    if (!accessToken || !config.SUPABASE_URL ||
        !config.SUPABASE_ANON_KEY) {
      throw new Error('Session or Supabase configuration is missing. Please login again.');
    }

    return {
      accessToken,
      config
    };
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
      const { accessToken, config } = await getSessionDetails();

      const url = new URL(`${config.SUPABASE_URL}/rest/v1/leads`);
      url.searchParams.set('lead_id', `eq.${leadId}`);

      const response = await fetch(url.toString(), {
        method: 'PATCH',
        headers: {
          apikey: config.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify({
          status: newStatus
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || result.msg || 'Status update failed.'
        );
      }

      if (!Array.isArray(result) || result.length === 0) {
        throw new Error(
          'No enquiry was updated. Please check your admin permissions.'
        );
      }

      const updatedLead = result[0];

      allLeads = allLeads.map(item =>
        item.lead_id === leadId ? updatedLead : item
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

  async function loadLeads() {
    refreshButton.disabled = true;
    showMessage('Loading enquiries...');

    try {
      const { accessToken, config } = await getSessionDetails();

      const url = new URL(`${config.SUPABASE_URL}/rest/v1/leads`);

      url.searchParams.set(
        'select',
        'lead_id,full_name,phone,city,service,status,created_at'
      );

      url.searchParams.set('order', 'created_at.desc');

      const response = await fetch(url.toString(), {
        headers: {
          apikey: config.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || result.msg || 'Could not load enquiries.'
        );
      }

      allLeads = Array.isArray(result) ? result : [];

      updateStats();
      renderLeads();
      showMessage('');

    } catch (error) {
      console.error('Dashboard error:', error);
      showMessage(error.message || 'Something went wrong while loading enquiries.');

      tableBody.replaceChildren();

      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 8;
      cell.textContent = 'Unable to load enquiries. Please check the error message above.';
      row.appendChild(cell);
      tableBody.appendChild(row);

    } finally {
      refreshButton.disabled = false;
    }
  }

  searchInput.addEventListener('input', renderLeads);
  serviceFilter.addEventListener('change', renderLeads);
  statusFilter.addEventListener('change', renderLeads);
  refreshButton.addEventListener('click', loadLeads);

  loadLeads();
})();
