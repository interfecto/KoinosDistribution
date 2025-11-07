// API Configuration
const API_BASE = 'http://157.180.23.97:3003/api';
const KOINOSBLOCKS_BASE = 'https://koinosblocks.com/address';

// Global data storage
let globalData = {
    stats: null,
    koinHolders: [],
    vhpHolders: [],
    charts: {}
};

// Known exchange addresses
const KNOWN_ADDRESSES = {
    '1LNFGjYybk5EvPCssAmPNSCRC5LYxv81Kb': 'MEXC',
    '1Kq55nFXNjP8DefaG9vJYqVpNja5ij3j5C': 'Chainge',
    '1MHvKdUMvx4hHXUudmVAF6nr5ZU17Djp7C': 'BingX'
};

// Configure Chart.js defaults for light text
Chart.defaults.color = '#FFFFFF';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
Chart.defaults.plugins.legend.labels.color = '#FFFFFF';

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
    setupSmoothScroll();
    setInterval(loadDashboardData, 60000); // Refresh every minute
});

// Smooth scroll for navigation
function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// Main data loading function
async function loadDashboardData() {
    try {
        // Show loading spinner
        showLoading(true);

        // Fetch all data in parallel with 200 wallets
        const [statsData, koinData, vhpData] = await Promise.all([
            fetchStats(),
            fetchTopHolders('koin', 200),
            fetchTopHolders('vhp', 200)
        ]);

        // Store data globally
        globalData.stats = statsData;
        globalData.koinHolders = koinData;
        globalData.vhpHolders = vhpData;

        // Update UI
        updateStatistics(statsData);
        updateKoinSection(koinData);
        updateVhpSection(vhpData);
        updateDistributionAnalysis();
        updateLastUpdated();

        // Hide loading spinner
        showLoading(false);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Failed to load data. Please try again later.');
        showLoading(false);
    }
}

// API Functions
async function fetchStats() {
    const response = await fetch(`${API_BASE}/stats`);
    const data = await response.json();
    return data.data;
}

async function fetchTopHolders(type, limit = 100) {
    const response = await fetch(`${API_BASE}/${type}/top?limit=${limit}`);
    const data = await response.json();
    return data.data;
}

async function fetchAddressInfo(address) {
    try {
        const response = await fetch(`${API_BASE}/address/${address}`);
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('Error fetching address info:', error);
        return null;
    }
}

// UI Update Functions
function updateStatistics(stats) {
    document.getElementById('total-addresses').textContent = formatNumber(stats.total_addresses);
    document.getElementById('koin-holders').textContent = formatNumber(stats.koin_holders);
    document.getElementById('vhp-holders').textContent = formatNumber(stats.vhp_holders);
    document.getElementById('total-koin').textContent = formatBalance(stats.total_koin);
    document.getElementById('total-vhp').textContent = formatBalance(stats.total_vhp);
}

function updateKoinSection(holders) {
    // Update table
    updateTable('koin-tbody', holders, parseFloat(globalData.stats.total_koin));

    // Create large pie chart with vibrant colors
    createPieChart('koinPieChart', holders, 'KOIN Distribution', '#6B46C1');

    // Calculate metrics
    const gini = calculateGiniCoefficient(holders.map(h => parseFloat(h.balance)));
    const top10Percentage = calculateTopPercentage(holders, 10, parseFloat(globalData.stats.total_koin));

    document.getElementById('koin-gini').textContent = gini.toFixed(3);
    document.getElementById('koin-top10').textContent = top10Percentage + '%';
}

function updateVhpSection(holders) {
    // Update table
    updateTable('vhp-tbody', holders, parseFloat(globalData.stats.total_vhp));

    // Create large pie chart with vibrant colors
    createPieChart('vhpPieChart', holders, 'VHP Distribution', '#10B981');

    // Calculate metrics
    const gini = calculateGiniCoefficient(holders.map(h => parseFloat(h.balance)));
    const top10Percentage = calculateTopPercentage(holders, 10, parseFloat(globalData.stats.total_vhp));

    document.getElementById('vhp-gini').textContent = gini.toFixed(3);
    document.getElementById('vhp-top10').textContent = top10Percentage + '%';
}

function updateTable(tableId, holders, totalSupply) {
    const tbody = document.getElementById(tableId);
    tbody.innerHTML = '';

    holders.slice(0, 50).forEach((holder, index) => {
        const balance = parseFloat(holder.balance);
        const percentage = ((balance / totalSupply) * 100).toFixed(2);

        const row = document.createElement('tr');
        const displayName = KNOWN_ADDRESSES[holder.address]
            ? `<span class="exchange-label">${KNOWN_ADDRESSES[holder.address]}</span>`
            : `Wallet ${index + 1}`;

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <a href="#" class="address-link" onclick="showWalletDetails('${holder.address}'); return false;" title="${holder.address}">
                    ${displayName}
                </a>
            </td>
            <td>${formatBalance(balance)}</td>
            <td>${percentage}%</td>
            <td>
                <button class="view-btn" onclick="window.open('${KOINOSBLOCKS_BASE}/${holder.address}', '_blank')">
                    View on Explorer
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function updateDistributionAnalysis() {
    // Create combined distribution chart
    createCombinedChart();
}

// Chart Creation Functions
function createPieChart(canvasId, holders, title, color) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    // Destroy existing chart if it exists
    if (globalData.charts[canvasId]) {
        globalData.charts[canvasId].destroy();
    }

    // Prepare data for top 30 holders + others
    const top30 = holders.slice(0, 30);
    const othersBalance = holders.slice(30).reduce((sum, h) => sum + parseFloat(h.balance), 0);

    const data = {
        labels: [...top30.map((h, i) => getAddressLabel(h.address, i)), 'Others'],
        datasets: [{
            data: [...top30.map(h => parseFloat(h.balance)), othersBalance],
            backgroundColor: generateGradientColors(31, color),
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderWidth: 1,
            addresses: [...top30.map(h => h.address), null] // Store actual addresses for reference
        }]
    };

    globalData.charts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '40%',
            elements: {
                arc: {
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1
                }
            },
            plugins: {
                datalabels: {
                    display: false
                },
                legend: {
                    position: 'right',
                    labels: {
                        color: '#FFFFFF',
                        padding: 10,
                        font: {
                            size: 14,
                            family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            weight: '500'
                        },
                        usePointStyle: false,
                        boxWidth: 15,
                        boxHeight: 15
                    }
                },
                title: {
                    display: true,
                    text: title,
                    color: '#F1F5F9',
                    font: {
                        size: 24,
                        weight: 'bold'
                    },
                    padding: 20
                },
                tooltip: {
                    bodyFont: {
                        size: 14
                    },
                    titleFont: {
                        size: 15
                    },
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = formatBalance(context.parsed);
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(2);
                            const address = context.dataset.addresses[context.dataIndex];

                            // Show address for all wallets when hovering
                            if (address) {
                                return [
                                    `${label}: ${value} (${percentage}%)`,
                                    `Address: ${address}`
                                ];
                            }
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    if (index < 30) {
                        const address = holders[index].address;
                        showWalletDetails(address);
                    }
                }
            }
        }
    });
}

function createBarChart(canvasId, holders, title, color) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    // Destroy existing chart if it exists
    if (globalData.charts[canvasId]) {
        globalData.charts[canvasId].destroy();
    }

    const data = {
        labels: holders.map(h => truncateAddress(h.address)),
        datasets: [{
            label: 'Balance',
            data: holders.map(h => parseFloat(h.balance)),
            backgroundColor: generateGradientColors(holders.length, color),
            borderColor: color,
            borderWidth: 1
        }]
    };

    globalData.charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: title,
                    color: '#F1F5F9',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatBalance(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#94A3B8',
                        callback: function(value) {
                            return formatShortNumber(value);
                        }
                    },
                    grid: {
                        color: '#334155',
                        drawBorder: false
                    }
                },
                x: {
                    ticks: {
                        color: '#94A3B8',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        display: false
                    }
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const address = holders[index].address;
                    showWalletDetails(address);
                }
            }
        }
    });
}

function createCombinedChart() {
    const ctx = document.getElementById('combinedChart').getContext('2d');

    // Destroy existing chart if it exists
    if (globalData.charts.combinedChart) {
        globalData.charts.combinedChart.destroy();
    }

    // Prepare data for both KOIN and VHP top holders - show top 50
    const labels = Array.from({length: 50}, (_, i) => `Rank ${i + 1}`);

    const koinData = globalData.koinHolders.slice(0, 50).map(h => parseFloat(h.balance));
    const vhpData = globalData.vhpHolders.slice(0, 50).map(h => parseFloat(h.balance));

    globalData.charts.combinedChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'KOIN Holdings',
                    data: koinData,
                    borderColor: '#6B46C1',
                    backgroundColor: 'rgba(107, 70, 193, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'VHP Holdings',
                    data: vhpData,
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Distribution Curve: Top 50 Holders',
                    color: '#F1F5F9',
                    font: {
                        size: 18,
                        weight: 'bold'
                    }
                },
                legend: {
                    labels: {
                        color: '#F1F5F9'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatBalance(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'logarithmic',
                    ticks: {
                        color: '#94A3B8',
                        callback: function(value) {
                            return formatShortNumber(value);
                        }
                    },
                    grid: {
                        color: '#334155',
                        drawBorder: false
                    }
                },
                x: {
                    ticks: {
                        color: '#94A3B8'
                    },
                    grid: {
                        color: '#334155',
                        drawBorder: false
                    }
                }
            }
        }
    });
}

// Utility Functions
function formatNumber(num) {
    return parseInt(num).toLocaleString();
}

function formatBalance(balance) {
    const num = parseFloat(balance);
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
}

function formatShortNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(0);
}

function truncateAddress(address) {
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
}

function getAddressLabel(address, index) {
    // Check if this is a known exchange address
    if (KNOWN_ADDRESSES[address]) {
        return KNOWN_ADDRESSES[address];
    }
    // Otherwise return a generic wallet label without showing address
    return index !== undefined ? `Wallet ${index + 1}` : 'Wallet';
}

function generateGradientColors(count, baseColor) {
    // Create a vibrant color palette
    const vibrantColors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
        '#FF9FF3', '#54A0FF', '#48DBFB', '#A29BFE', '#FD79A8',
        '#FDCB6E', '#6C5CE7', '#00B894', '#00CEC9', '#0984E3',
        '#E17055', '#74B9FF', '#A29BFE', '#81ECEC', '#55A3FF',
        '#FFA502', '#FF6348', '#FF4757', '#5F27CD', '#00D2D3',
        '#C44569', '#F8777D', '#FCA5A5', '#FBBF24', '#34D399',
        '#60A5FA', '#A78BFA', '#F472B6', '#EC4899', '#8B5CF6'
    ];

    // If we need more colors than predefined, generate them
    const colors = [];
    for (let i = 0; i < count; i++) {
        if (i < vibrantColors.length) {
            colors.push(vibrantColors[i]);
        } else {
            // Generate additional colors using HSL
            const hue = (i * 137.5) % 360; // Golden angle for good distribution
            const saturation = 65 + (i % 3) * 10; // Vary saturation
            const lightness = 55 + (i % 4) * 5; // Vary lightness
            colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
        }
    }

    return colors;
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 107, g: 70, b: 193 };
}

function calculateGiniCoefficient(values) {
    if (values.length === 0) return 0;

    // Sort values in ascending order
    values.sort((a, b) => a - b);

    const n = values.length;
    const total = values.reduce((sum, val) => sum + val, 0);

    if (total === 0) return 0;

    let cumulativeSum = 0;
    let giniSum = 0;

    for (let i = 0; i < n; i++) {
        cumulativeSum += values[i];
        giniSum += (n - i) * values[i];
    }

    return (n + 1) / n - (2 * giniSum) / (n * total);
}

function calculateTopPercentage(holders, topN, totalSupply) {
    const topSum = holders.slice(0, topN).reduce((sum, h) => sum + parseFloat(h.balance), 0);
    return ((topSum / totalSupply) * 100).toFixed(2);
}

// Modal Functions
function showWalletDetails(address) {
    const modal = document.getElementById('walletModal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = 'Loading...';
    modalBody.innerHTML = '<div class="spinner"></div>';
    modal.classList.add('active');

    // Find wallet in our data
    const koinHolder = globalData.koinHolders.find(h => h.address === address);
    const vhpHolder = globalData.vhpHolders.find(h => h.address === address);

    const walletName = KNOWN_ADDRESSES[address]
        ? `${KNOWN_ADDRESSES[address]} Exchange`
        : `Wallet: ${truncateAddress(address)}`;
    modalTitle.textContent = walletName;

    modalBody.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
            <p style="font-family: monospace; color: var(--text-secondary); word-break: break-all;">
                ${address}
            </p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
            <div style="background: rgba(107, 70, 193, 0.1); padding: 1rem; border-radius: 8px;">
                <h4 style="color: var(--text-secondary); margin-bottom: 0.5rem;">KOIN Balance</h4>
                <p style="font-size: 1.5rem; font-weight: bold;">
                    ${koinHolder ? formatBalance(koinHolder.balance) : '0'}
                </p>
                ${koinHolder ? `
                    <p style="color: var(--text-secondary); font-size: 0.875rem;">
                        Rank #${globalData.koinHolders.indexOf(koinHolder) + 1}
                    </p>
                ` : ''}
            </div>

            <div style="background: rgba(16, 185, 129, 0.1); padding: 1rem; border-radius: 8px;">
                <h4 style="color: var(--text-secondary); margin-bottom: 0.5rem;">VHP Balance</h4>
                <p style="font-size: 1.5rem; font-weight: bold;">
                    ${vhpHolder ? formatBalance(vhpHolder.balance) : '0'}
                </p>
                ${vhpHolder ? `
                    <p style="color: var(--text-secondary); font-size: 0.875rem;">
                        Rank #${globalData.vhpHolders.indexOf(vhpHolder) + 1}
                    </p>
                ` : ''}
            </div>
        </div>

        <div style="text-align: center;">
            <button class="view-btn" style="width: 100%;" onclick="window.open('${KOINOSBLOCKS_BASE}/${address}', '_blank')">
                View on Koinos Blocks Explorer →
            </button>
        </div>
    `;
}

function closeModal() {
    const modal = document.getElementById('walletModal');
    modal.classList.remove('active');
}

// Search Function
async function searchAddress() {
    const searchInput = document.getElementById('address-search');
    const searchResults = document.getElementById('search-results');
    const address = searchInput.value.trim();

    if (!address) {
        searchResults.innerHTML = '<p style="color: var(--text-secondary);">Please enter a wallet address</p>';
        return;
    }

    searchResults.innerHTML = '<div class="spinner"></div>';

    // Search in our existing data
    const koinHolder = globalData.koinHolders.find(h => h.address.toLowerCase() === address.toLowerCase());
    const vhpHolder = globalData.vhpHolders.find(h => h.address.toLowerCase() === address.toLowerCase());

    if (koinHolder || vhpHolder) {
        searchResults.innerHTML = `
            <div style="background: var(--dark-bg); padding: 1.5rem; border-radius: 8px;">
                <h3 style="margin-bottom: 1rem;">Address Found</h3>
                <p style="font-family: monospace; color: var(--text-secondary); margin-bottom: 1rem; word-break: break-all;">
                    ${address}
                </p>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div>
                        <h4 style="color: var(--text-secondary); margin-bottom: 0.5rem;">KOIN Balance</h4>
                        <p style="font-size: 1.25rem; font-weight: bold;">
                            ${koinHolder ? formatBalance(koinHolder.balance) : '0'}
                        </p>
                        ${koinHolder ? `
                            <p style="color: var(--text-secondary); font-size: 0.875rem;">
                                Rank #${globalData.koinHolders.indexOf(koinHolder) + 1} of ${globalData.koinHolders.length}
                            </p>
                        ` : ''}
                    </div>

                    <div>
                        <h4 style="color: var(--text-secondary); margin-bottom: 0.5rem;">VHP Balance</h4>
                        <p style="font-size: 1.25rem; font-weight: bold;">
                            ${vhpHolder ? formatBalance(vhpHolder.balance) : '0'}
                        </p>
                        ${vhpHolder ? `
                            <p style="color: var(--text-secondary); font-size: 0.875rem;">
                                Rank #${globalData.vhpHolders.indexOf(vhpHolder) + 1} of ${globalData.vhpHolders.length}
                            </p>
                        ` : ''}
                    </div>
                </div>

                <button class="view-btn" onclick="window.open('${KOINOSBLOCKS_BASE}/${address}', '_blank')">
                    View on Koinos Blocks Explorer →
                </button>
            </div>
        `;
    } else {
        // Try fetching from API
        const addressInfo = await fetchAddressInfo(address);
        if (addressInfo) {
            searchResults.innerHTML = `
                <div style="background: var(--dark-bg); padding: 1.5rem; border-radius: 8px;">
                    <h3 style="margin-bottom: 1rem;">Address Information</h3>
                    <p style="font-family: monospace; color: var(--text-secondary); margin-bottom: 1rem; word-break: break-all;">
                        ${address}
                    </p>
                    <p>Address data retrieved from API</p>
                    <button class="view-btn" onclick="window.open('${KOINOSBLOCKS_BASE}/${address}', '_blank')">
                        View on Koinos Blocks Explorer →
                    </button>
                </div>
            `;
        } else {
            searchResults.innerHTML = `
                <div style="background: rgba(239, 68, 68, 0.1); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--danger-color);">
                    <p style="color: var(--danger-color);">Address not found in the top holders list</p>
                    <button class="view-btn" style="margin-top: 1rem;" onclick="window.open('${KOINOSBLOCKS_BASE}/${address}', '_blank')">
                        Try viewing on Koinos Blocks Explorer →
                    </button>
                </div>
            `;
        }
    }
}

// Loading and Error Handling
function showLoading(show) {
    const loadingDiv = document.getElementById('loading');
    if (show) {
        loadingDiv.classList.remove('hidden');
    } else {
        setTimeout(() => {
            loadingDiv.classList.add('hidden');
        }, 500);
    }
}

function showError(message) {
    console.error(message);
    // You can implement a toast notification here
}

function updateLastUpdated() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    const dateString = now.toLocaleDateString();
    document.getElementById('last-updated').textContent = `${dateString} ${timeString}`;
}

// Window click event to close modal
window.onclick = function(event) {
    const modal = document.getElementById('walletModal');
    if (event.target === modal) {
        closeModal();
    }
}

// New Chart Functions
function createBubbleChart(canvasId, holders, title, tokenType) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    // Destroy existing chart if it exists
    if (globalData.charts[canvasId]) {
        globalData.charts[canvasId].destroy();
    }

    // Prepare bubble data - x: rank, y: balance, r: relative size
    const maxBalance = Math.max(...holders.map(h => parseFloat(h.balance)));
    const bubbleData = holders.map((holder, index) => {
        const balance = parseFloat(holder.balance);
        return {
            x: index + 1,
            y: balance,
            r: Math.sqrt(balance / maxBalance) * 30, // Scale bubble size
            address: holder.address
        };
    });

    globalData.charts[canvasId] = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: tokenType + ' Holdings',
                data: bubbleData,
                backgroundColor: generateGradientColors(holders.length, '#FF6B6B').map(color => {
                    // Add transparency for bubble effect
                    return color.replace('rgb', 'rgba').replace(')', ', 0.6)');
                }),
                borderColor: generateGradientColors(holders.length, '#FF6B6B'),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title,
                    color: '#F1F5F9',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const data = context.raw;
                            return [
                                'Rank: #' + data.x,
                                'Balance: ' + formatBalance(data.y),
                                'Address: ' + truncateAddress(data.address)
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Holder Rank',
                        color: '#94A3B8'
                    },
                    ticks: {
                        color: '#94A3B8'
                    },
                    grid: {
                        color: '#334155'
                    }
                },
                y: {
                    type: 'logarithmic',
                    title: {
                        display: true,
                        text: 'Balance (log scale)',
                        color: '#94A3B8'
                    },
                    ticks: {
                        color: '#94A3B8',
                        callback: function(value) {
                            return formatShortNumber(value);
                        }
                    },
                    grid: {
                        color: '#334155'
                    }
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const address = holders[index].address;
                    showWalletDetails(address);
                }
            }
        }
    });
}

function createRadarChart(canvasId, holders, title) {
    const ctx = document.getElementById(canvasId).getContext('2d');

    // Destroy existing chart if it exists
    if (globalData.charts[canvasId]) {
        globalData.charts[canvasId].destroy();
    }

    // Normalize balances for radar chart (0-100 scale)
    const maxBalance = Math.max(...holders.map(h => parseFloat(h.balance)));
    const normalizedData = holders.map(h => (parseFloat(h.balance) / maxBalance) * 100);

    globalData.charts[canvasId] = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: holders.map(h => truncateAddress(h.address)),
            datasets: [{
                label: 'Relative Balance',
                data: normalizedData,
                backgroundColor: 'rgba(147, 51, 234, 0.2)',
                borderColor: '#9333EA',
                pointBackgroundColor: generateGradientColors(holders.length, '#9333EA'),
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#9333EA',
                borderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title,
                    color: '#F1F5F9',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const actualBalance = holders[index].balance;
                            return [
                                'Balance: ' + formatBalance(actualBalance),
                                'Relative: ' + context.parsed.r.toFixed(1) + '%'
                            ];
                        }
                    }
                }
            },
            scales: {
                r: {
                    angleLines: {
                        color: '#334155'
                    },
                    grid: {
                        color: '#334155'
                    },
                    pointLabels: {
                        color: '#94A3B8',
                        font: {
                            size: 10
                        }
                    },
                    ticks: {
                        color: '#94A3B8',
                        backdropColor: 'transparent'
                    },
                    suggestedMin: 0,
                    suggestedMax: 100
                }
            }
        }
    });
}