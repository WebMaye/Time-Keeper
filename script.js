// Cache object to store the last known good time data
const timeCache = {};

// Function to format date as "Friday, 12 July 2024"
function formatDate(date) {
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
    return date.toLocaleDateString('en-US', options);
}

// Function to format time with seconds
function formatTime(date, timeZone) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: timeZone });
}

// Function to fetch time data from the API
async function fetchTimeData(country) {
    try {
        const response = await fetch(`http://worldtimeapi.org/api/timezone/${country}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        return data;
    } catch (error) {
        console.error(`Error fetching time for ${country}:`, error);
        return null;
    }
}

// Function to update the clock display
function updateClockDisplay(clockElement, timeData) {
    const time = new Date(timeData.datetime);
    clockElement.querySelector('.time').textContent = formatTime(time, timeData.timezone);
    clockElement.querySelector('.date').textContent = formatDate(time);
}

// Function to re-sync a single clock
async function resyncClock(clockElement) {
    const country = clockElement.dataset.country;
    const newData = await fetchTimeData(country);
    if (newData) {
        timeCache[country] = newData;
        updateClockDisplay(clockElement, newData);
        console.log(`Re-synced clock for ${country}`);
    } else {
        console.log(`Failed to re-sync clock for ${country}, using cached data`);
    }
}

// Function to re-sync all clocks
function resyncAllClocks() {
    const clocks = document.querySelectorAll('.world-clock');
    clocks.forEach(resyncClock);
}

// Function to display world clock for a given country
async function displayWorldClock(country) {
    const worldClocksContainer = document.getElementById('world-clocks');
    const clockElement = document.createElement('div');
    clockElement.className = 'world-clock';
    clockElement.dataset.country = country;

    let timeData = timeCache[country] || await fetchTimeData(country);

    if (timeData) {
        timeCache[country] = timeData;

        clockElement.innerHTML = `
            <div class="clock-header">
                <h3>${country.replace('/', ' - ')}</h3>
                <svg class="remove-clock" viewBox="0 0 24 24" width="18" height="18">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>
            </div>
            <p class="time"></p>
            <p class="date"></p>
        `;

        updateClockDisplay(clockElement, timeData);

        // Update this clock every second
        const intervalId = setInterval(() => {
            const time = new Date(timeData.datetime);
            time.setSeconds(time.getSeconds() + 1);
            timeData.datetime = time.toISOString();
            updateClockDisplay(clockElement, timeData);
        }, 1000);

        // Store the interval ID on the element for later cleanup
        clockElement.dataset.intervalId = intervalId;

        // Add event listener to remove icon
        clockElement.querySelector('.remove-clock').addEventListener('click', () => {
            clearInterval(intervalId);
            clockElement.remove();
            delete timeCache[country];
            saveClocks();
        });
    } else {
        clockElement.innerHTML = `
            <div class="clock-header">
                <h3>${country}</h3>
                <svg class="remove-clock" viewBox="0 0 24 24" width="18" height="18">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                </svg>
            </div>
            <p>Error: Unable to fetch time</p>
        `;
    }
    
    worldClocksContainer.appendChild(clockElement);
    saveClocks();
}

// Function to update user's local time
function updateUserClock() {
    const now = new Date();
    document.getElementById('user-time').textContent = formatTime(now, Intl.DateTimeFormat().resolvedOptions().timeZone);
    document.getElementById('user-date').textContent = formatDate(now);
    document.getElementById('user-timezone').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Function to get user's location
function getUserLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            
            fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`)
                .then(response => response.json())
                .then(data => {
                    document.getElementById('user-location').textContent = `${data.city}, ${data.countryName}`;
                })
                .catch(error => {
                    console.error("Error getting location:", error);
                    document.getElementById('user-location').textContent = "Location not available";
                });
        }, function(error) {
            console.error("Geolocation error:", error);
            document.getElementById('user-location').textContent = "Location access denied";
        });
    } else {
        document.getElementById('user-location').textContent = "Geolocation not supported";
    }
}

// Function to populate country dropdown
async function populateCountryDropdown() {
    const dropdown = document.getElementById('country-dropdown');
    dropdown.className = 'styled-select';
    try {
        const response = await fetch('http://worldtimeapi.org/api/timezone');
        const timezones = await response.json();
        
        timezones.forEach(timezone => {
            const option = document.createElement('option');
            option.value = timezone;
            option.textContent = timezone.replace('/', ' - ');
            dropdown.appendChild(option);
        });
    } catch (error) {
        console.error("Error fetching timezones:", error);
        dropdown.innerHTML = '<option>Error loading timezones</option>';
    }
}

// Function to save clocks to Chrome storage
function saveClocks() {
    const clocks = Array.from(document.querySelectorAll('.world-clock')).map(clock => clock.dataset.country);
    chrome.storage.sync.set({ savedClocks: clocks }, function() {
        console.log('Clocks saved');
    });
}

// Function to load saved clocks
function loadClocks() {
    chrome.storage.sync.get(['savedClocks'], function(result) {
        if (result.savedClocks) {
            result.savedClocks.forEach(country => displayWorldClock(country));
        }
    });
}

// Set up periodic re-syncing
setInterval(resyncAllClocks, 60 * 60 * 1000); // Re-sync every hour

// Function to initialize the extension
function initializeExtension() {
    updateUserClock();
    getUserLocation();
    populateCountryDropdown();
    loadClocks();
    setInterval(updateUserClock, 1000); // Update user clock every second
    resyncAllClocks(); // Initial sync of all clocks
}

// Event listener for search button
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('search-button').className = 'styled-button';
    document.getElementById('search-button').addEventListener('click', function() {
        const country = document.getElementById('country-dropdown').value;
        if (country) {
            displayWorldClock(country);
        }
    });

    // Initialize the extension
    initializeExtension();
});