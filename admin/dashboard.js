
(function () {
  const tableBody = document.getElementById('leads-table-body');
  const message = document.getElementById('dashboard-message');
  const searchInput = document.getElementById('search-leads');
  const serviceFilter = document.getElementById('filter-service');
  const statusFilter = document.getElementById('filter-status');
  const refreshButton = document.getElementById('refresh-button');

  if (!tableBody) return;

  let allLeads = [];

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

  function updateStats(leads) {
    document.getElementById('total-leads').textContent = leads.length;
    document.getElementById('new-leads').textContent =
      leads.filter(lead => lead.status === 'new').length;
    document.getElementById('contacted-leads').textContent =
      leads.filter(lead => lead.status === 'contacted').length;
    document.getElementById('closed-leads').textContent =
      leads.filter(lead =>
        ['converted', 'lost'].includes(lead.status)
      ).length;
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
      cell.colSpan = 7;
      cell.textContent = 'No enquiries found.';
      row.appendChild(cell);
      tableBody.appendChild(row);
    } else {
      filtered.forEach(lead => {
        const row = document.createElement('tr');

        [
          lead.lead_id,
          lead.full_name,
          lead.phone,
          lead.city,
          serviceName(lead.service),
          lead.status,
          formatDate(lead.created_at)
        ].forEach(value => {
          const cell = document.createElement('td');
          cell.textContent = value || '—';
          row.appendChild(cell);
        });

        tableBody.appendChild(row);
      });
    }

    document.getElementById('leads-count').textContent =
      `Showing ${filtered.length} of ${allLeads.length} enquiries`;
  }

  async function loadLeads() {
    refreshButton.disabled = true;
    showMessage('Loading enquiries...');

    try {
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

      const url = new URL(
        `${config.SUPABASE_URL}/rest/v1/leads`
      );

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

      updateStats(allLeads);
      renderLeads();
      showMessage('');

    } catch (error) {
      console.error('Dashboard error:', error);
      showMessage(error.message || 'Something went wrong while loading enquiries.');
      tableBody.replaceChildren();

      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 7;
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
