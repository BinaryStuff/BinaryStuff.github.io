/*
 * script.js
 * Provides functionality for the Valorant RR Tracker app.
 * Handles user interactions, data persistence via localStorage,
 * summary statistics, table rendering, and chart plotting using Chart.js.
 */

(function () {
  // Key used for storing data in localStorage
  const STORAGE_KEY = 'valorantRRData';
  // Array to hold RR change entries
  let rrData = [];
  // Chart instance; reused and destroyed on updates
  let rrChart;

  /**
   * Load saved data from localStorage and update UI
   */
  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      rrData = saved ? JSON.parse(saved) : [];
    } catch (err) {
      console.error('Failed to load RR data from storage', err);
      rrData = [];
    }
    // Ensure sorting by timestamp ascending for consistent running totals
    rrData.sort((a, b) => a.timestamp - b.timestamp);
    renderAll();
  }

  /**
   * Save current rrData array to localStorage
   */
  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rrData));
  }

  /**
   * Compute summary statistics from rrData
   * @returns {Object} stats
   */
  function computeStats() {
    const count = rrData.length;
    let total = 0;
    let max = null;
    let min = null;
    rrData.forEach(entry => {
      const val = entry.value;
      total += val;
      if (max === null || val > max) max = val;
      if (min === null || val < min) min = val;
    });
    const average = count > 0 ? (total / count) : 0;
    return {
      count,
      total,
      average,
      max: max !== null ? max : 0,
      min: min !== null ? min : 0
    };
  }

  /**
   * Render summary statistics to DOM
   */
  function renderStats() {
    const stats = computeStats();
    document.getElementById('stat-count').textContent = stats.count;
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-average').textContent = stats.count ? stats.average.toFixed(2) : 0;
    document.getElementById('stat-max').textContent = stats.count ? stats.max : 0;
    document.getElementById('stat-min').textContent = stats.count ? stats.min : 0;
  }

  /**
   * Format a timestamp into date and time strings
   * @param {number} timestamp
   * @returns {{date: string, time: string}}
   */
  function formatTimestamp(timestamp) {
    const dt = new Date(timestamp);
    // Format date as YYYY-MM-DD
    const date = dt.toLocaleDateString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    // Format time as HH:MM AM/PM
    const time = dt.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    return { date, time };
  }

  /**
   * Render the match history table and running total
   */
  function renderTable() {
    const tbody = document.getElementById('history-body');
    // Clear current rows
    tbody.innerHTML = '';
    let runningTotal = 0;
    rrData.forEach((entry, index) => {
      runningTotal += entry.value;
      const row = document.createElement('tr');
      // Index column
      const idxCell = document.createElement('td');
      idxCell.textContent = index + 1;
      row.appendChild(idxCell);
      // Date column
      const { date, time } = formatTimestamp(entry.timestamp);
      const dateCell = document.createElement('td');
      dateCell.textContent = date;
      row.appendChild(dateCell);
      // Time column
      const timeCell = document.createElement('td');
      timeCell.textContent = time;
      row.appendChild(timeCell);
      // RR change column
      const valueCell = document.createElement('td');
      valueCell.textContent = entry.value > 0 ? `+${entry.value}` : `${entry.value}`;
      valueCell.style.color = entry.value >= 0 ? '#4caf50' : '#e53935';
      row.appendChild(valueCell);
      // Running total column
      const totalCell = document.createElement('td');
      totalCell.textContent = runningTotal;
      totalCell.style.fontWeight = '500';
      row.appendChild(totalCell);
      // Action column (delete button)
      const actionCell = document.createElement('td');
      const delBtn = document.createElement('button');
      delBtn.className = 'action-btn';
      delBtn.textContent = 'Remove';
      delBtn.title = 'Remove this entry';
      // Attach index to dataset for removal
      delBtn.dataset.index = index;
      delBtn.addEventListener('click', handleDeleteEntry);
      actionCell.appendChild(delBtn);
      row.appendChild(actionCell);
      tbody.appendChild(row);
    });
  }

  /**
   * Render the line chart showing running total progression
   */
  function renderChart() {
    const ctx = document.getElementById('rr-chart').getContext('2d');
    // Prepare data: labels as match numbers, data as running totals
    const labels = [];
    const data = [];
    let runningTotal = 0;
    rrData.forEach((entry, index) => {
      runningTotal += entry.value;
      labels.push(index + 1);
      data.push(runningTotal);
    });
    // Destroy existing chart if any
    if (rrChart) {
      rrChart.destroy();
    }
    rrChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Running RR Total',
            data: data,
            borderColor: '#d02e64',
            backgroundColor: 'rgba(208, 46, 100, 0.2)',
            tension: 0.25,
            fill: true,
            pointRadius: 3,
            pointHoverRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Match Index',
              color: '#a5b1c2'
            },
            ticks: {
              color: '#a5b1c2'
            },
            grid: {
              color: 'rgba(255,255,255,0.05)'
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Running Total RR',
              color: '#a5b1c2'
            },
            ticks: {
              color: '#a5b1c2'
            },
            grid: {
              color: 'rgba(255,255,255,0.05)'
            },
            beginAtZero: true
          }
        },
        plugins: {
          legend: {
            labels: {
              color: '#a5b1c2'
            }
          },
          tooltip: {
            backgroundColor: '#1f2a38',
            titleColor: '#e5e7eb',
            bodyColor: '#e5e7eb',
            borderColor: '#d02e64',
            borderWidth: 1
          }
        }
      }
    });
  }

  /**
   * Render all components: stats, table and chart
   */
  function renderAll() {
    renderStats();
    renderTable();
    renderChart();
  }

  /**
   * Handle form submission to add new entry
   * @param {Event} e
   */
  function handleAddEntry(e) {
    e.preventDefault();
    const input = document.getElementById('rr-value');
    const valueStr = input.value.trim();
    if (valueStr === '') return;
    const value = Number(valueStr);
    if (Number.isNaN(value)) {
      alert('Please enter a valid number for RR change.');
      return;
    }
    // Push new entry with current timestamp
    rrData.push({ timestamp: Date.now(), value: value });
    // Save and re-render
    saveData();
    renderAll();
    // Reset input
    input.value = '';
    input.focus();
  }

  /**
   * Handle deletion of an entry
   * @param {Event} e
   */
  function handleDeleteEntry(e) {
    const index = parseInt(e.target.dataset.index, 10);
    if (isNaN(index)) return;
    // Confirm deletion
    if (!confirm('Remove this entry?')) return;
    rrData.splice(index, 1);
    saveData();
    renderAll();
  }

  /**
   * Handle clearing all data
   */
  function handleClearAll() {
    if (!rrData.length) return;
    if (confirm('This will remove all saved data. Are you sure?')) {
      rrData = [];
      saveData();
      renderAll();
    }
  }

  /**
   * Initialize event listeners and load data
   */
  function init() {
    document.getElementById('rr-form').addEventListener('submit', handleAddEntry);
    document.getElementById('clear-data').addEventListener('click', handleClearAll);
    loadData();
  }

  // Initialize when DOM content is loaded
  document.addEventListener('DOMContentLoaded', () => {
    init();
    // Update year in footer if present
    const yearSpan = document.getElementById('year');
    if (yearSpan) {
      yearSpan.textContent = new Date().getFullYear();
    }
  });
})();