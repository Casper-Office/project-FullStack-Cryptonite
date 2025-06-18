let allCoins = [];
let selectedCoins = [];
let coinDetailsCache = {};
let chartInstance = null;
let updateInterval = null;
let chartStartTime = null;

const searchInput = document.getElementById('searchInput');
const coinsContainer = document.getElementById('coinsContainer');
const mainLoader = document.getElementById('mainLoader');
const modal = document.getElementById('maxCoinsModal');
const pages = document.querySelectorAll('.page');
const navLinks = document.querySelectorAll('.nav-link');

document.addEventListener('DOMContentLoaded', function() {
    loadSelectedCoins();
    
    setupEventListeners();
    
    fetchCoins();
});

function setupEventListeners() {
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetPage = this.getAttribute('data-page');
            navigateToPage(targetPage);
        });
    });
    
    searchInput.addEventListener('keyup', handleSearch);
    
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
}

function navigateToPage(pageName) {
    navLinks.forEach(link => link.classList.remove('active'));
    document.querySelector(`[data-page="${pageName}"]`).classList.add('active');
    
    pages.forEach(page => page.classList.remove('active'));
    document.getElementById(pageName + 'Page').classList.add('active');
    
    if (pageName === 'reports') {
        startLiveReports();
    } else {
        stopLiveReports();
    }
}

function loadSelectedCoins() {
    const saved = localStorage.getItem('selectedCoins');
    if (saved) {
        selectedCoins = JSON.parse(saved);
    }
}

function saveSelectedCoins() {
    localStorage.setItem('selectedCoins', JSON.stringify(selectedCoins));
}

async function fetchCoins() {
    showLoader(true);
    
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=100');
        
        if (!response.ok) {
            throw new Error('Failed to fetch coins');
        }
        
        allCoins = await response.json();
        displayCoins(allCoins);
        
    } catch (error) {
        console.error('Error fetching coins:', error);
        coinsContainer.innerHTML = '<p class="error">שגיאה בטעינת המטבעות. אנא רענן את הדף.</p>';
    } finally {
        showLoader(false);
    }
}

function displayCoins(coins) {
    coinsContainer.innerHTML = '';
    
    coins.forEach(coin => {
        const card = createCoinCard(coin);
        coinsContainer.appendChild(card);
    });
}

function createCoinCard(coin) {
    const isSelected = selectedCoins.includes(coin.symbol.toUpperCase());
    
    const card = document.createElement('div');
    card.className = 'coin-card';
    card.innerHTML = `
        <label class="switch">
            <input type="checkbox" ${isSelected ? 'checked' : ''} 
                   onchange="toggleCoin('${coin.symbol.toUpperCase()}', this)">
            <span class="slider"></span>
        </label>
        <img src="${coin.image}" alt="${coin.name}" class="coin-icon">
        <h3 class="coin-symbol">${coin.symbol.toUpperCase()}</h3>
        <p class="coin-name">${coin.name}</p>
        <button class="more-info-btn" onclick="toggleMoreInfo('${coin.id}', this)">
            MORE INFO
        </button>
        <div id="details-${coin.id}" class="coin-details" style="display: none;"></div>
    `;
    
    return card;
}

function toggleCoin(symbol, checkbox) {
    if (checkbox.checked) {
        if (selectedCoins.length >= 5) {
            checkbox.checked = false;
            showMaxCoinsModal(symbol);
        } else {
            selectedCoins.push(symbol);
            saveSelectedCoins();
        }
    } else {
        selectedCoins = selectedCoins.filter(s => s !== symbol);
        saveSelectedCoins();
    }
}

function showMaxCoinsModal(newSymbol) {
    document.getElementById('newCoinName').textContent = newSymbol;
    
    const list = document.getElementById('selectedCoinsList');
    list.innerHTML = '';
    
    selectedCoins.forEach((coin, index) => {
        const option = document.createElement('div');
        option.className = 'coin-option';
        option.innerHTML = `
            <input type="radio" name="coinToRemove" id="coin-${index}" value="${coin}">
            <label for="coin-${index}">${coin}</label>
        `;
        list.appendChild(option);
    });
    
    modal.dataset.newCoin = newSymbol;
    
    modal.style.display = 'block';
}

function closeModal() {
    modal.style.display = 'none';
    modal.dataset.newCoin = '';
}

function confirmSelection() {
    const selected = document.querySelector('input[name="coinToRemove"]:checked');
    
    if (selected) {
        const coinToRemove = selected.value;
        const newCoin = modal.dataset.newCoin;
        
        selectedCoins = selectedCoins.filter(c => c !== coinToRemove);
        selectedCoins.push(newCoin);
        saveSelectedCoins();
        
        displayCoins(searchInput.value ? filterCoins(allCoins, searchInput.value) : allCoins);
        
        closeModal();
    }
}

async function toggleMoreInfo(coinId, button) {
    const detailsDiv = document.getElementById(`details-${coinId}`);
    
    if (detailsDiv.style.display === 'block') {
        detailsDiv.style.display = 'none';
        button.textContent = 'MORE INFO';
        return;
    }
    
    const cached = coinDetailsCache[coinId];
    const now = Date.now();
    
    if (cached && (now - cached.timestamp < 120000)) {
        displayCoinDetails(coinId, cached.data);
        button.textContent = 'CLOSE INFO';
        return;
    }
    
    button.textContent = 'Loading...';
    button.disabled = true;
    
    try {
        const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch coin details');
        }
        
        const data = await response.json();
        
        coinDetailsCache[coinId] = {
            data: data,
            timestamp: now
        };
        
        displayCoinDetails(coinId, data);
        button.textContent = 'CLOSE INFO';
        
    } catch (error) {
        console.error('Error fetching coin details:', error);
        detailsDiv.innerHTML = '<p style="color: red;">שגיאה בטעינת המידע</p>';
        detailsDiv.style.display = 'block';
        button.textContent = 'MORE INFO';
    } finally {
        button.disabled = false;
    }
}

function displayCoinDetails(coinId, data) {
    const detailsDiv = document.getElementById(`details-${coinId}`);
    
    const usd = data.market_data.current_price.usd || 0;
    const eur = data.market_data.current_price.eur || 0;
    const ils = data.market_data.current_price.ils || 0;
    
    detailsDiv.innerHTML = `
        <p>$ ${usd.toLocaleString()}</p>
        <p>€ ${eur.toLocaleString()}</p>
        <p>₪ ${ils.toLocaleString()}</p>
    `;
    
    detailsDiv.style.display = 'block';
}

function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase();
    
    if (!searchTerm) {
        displayCoins(allCoins);
        return;
    }
    
    const filtered = filterCoins(allCoins, searchTerm);
    displayCoins(filtered);
}

function filterCoins(coins, searchTerm) {
    return coins.filter(coin => 
        coin.symbol.toLowerCase().includes(searchTerm) || 
        coin.name.toLowerCase().includes(searchTerm)
    );
}

function showLoader(show) {
    mainLoader.style.display = show ? 'block' : 'none';
}

function startLiveReports() {
    const chartContainer = document.getElementById('chartContainer');
    const canvas = document.getElementById('liveChart');
    const emptyState = document.getElementById('noCoinsSelected');
    
    if (selectedCoins.length === 0) {
        canvas.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    canvas.style.display = 'block';
    emptyState.style.display = 'none';
    
    initializeChart();
    
    chartStartTime = Date.now();
    fetchChartData();
    updateInterval = setInterval(fetchChartData, 2000);
    
    setTimeout(() => {
        if (chartInstance) {
            chartInstance.data.labels = [];
            chartInstance.data.datasets.forEach(dataset => {
                dataset.data = [];
            });
            chartInstance.update();
            chartStartTime = Date.now();
        }
    }, 1200000); 
}

function stopLiveReports() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
}

function initializeChart() {
    const ctx = document.getElementById('liveChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    const datasets = selectedCoins.map((coin, index) => ({
        label: coin,
        data: [],
        borderColor: getChartColor(index),
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.1
    }));
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Price (USD)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            }
        }
    });
}

async function fetchChartData() {
    if (!chartInstance || selectedCoins.length === 0) return;
    
    try {
        const symbols = selectedCoins.join(',');
        const response = await fetch(
            `https://min-api.cryptocompare.com/data/pricemulti?fsyms=${symbols}&tsyms=USD`
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch prices');
        }
        
        const data = await response.json();
        
        const time = new Date().toLocaleTimeString('he-IL');
        chartInstance.data.labels.push(time);
        
        selectedCoins.forEach((coin, index) => {
            const price = data[coin]?.USD || 0;
            chartInstance.data.datasets[index].data.push(price);
        });
        
        if (chartInstance.data.labels.length > 20) {
            chartInstance.data.labels.shift();
            chartInstance.data.datasets.forEach(dataset => {
                dataset.data.shift();
            });
        }
        
        chartInstance.update();
        
    } catch (error) {
        console.error('Error fetching chart data:', error);
    }
}

function getChartColor(index) {
    const colors = [
        '#3498db', // Blue
        '#e74c3c', // Red
        '#2ecc71', // Green
        '#f39c12', // Orange
        '#9b59b6'  // Purple
    ];
    return colors[index % colors.length];
}

function loadChartJS() {
    if (typeof Chart === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = function() {
            console.log('Chart.js loaded');
        };
        document.head.appendChild(script);
    }
}

loadChartJS();