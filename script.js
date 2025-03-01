/*
v1.1.4 - Code cleanup: removed duplicates and unused functions
*/

// Global variables
let players = [];
let selectedPlayers = new Set();
let isListenerInitialized = false;
let displayTimeout;

// Utility function for debouncing
function debounce(func, wait) {
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(displayTimeout);
            func(...args);
        };
        clearTimeout(displayTimeout);
        displayTimeout = setTimeout(later, wait);
    };
}

// Debug logging
function debugLog(message, data) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`, data || '');
}

// Date formatting
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Player management
function addPlayer() {
    const playerInput = document.getElementById('playerNameInput');
    if (!playerInput) {
        console.error('Player input element not found');
        return;
    }

    const name = playerInput.value.trim();
    if (!name) {
        alert('Please enter a player name');
        return;
    }

    // Normalize the name
    const normalizedName = name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

    // Check for duplicates
    const nameExists = players.some(player =>
        player.toLowerCase() === normalizedName.toLowerCase()
    );

    if (nameExists) {
        alert('This player already exists!');
        playerInput.value = '';
        return;
    }

    // Add to Firebase
    db.ref('players').push(normalizedName)
        .then(() => {
            alert(`${normalizedName} has been added successfully!`);
            playerInput.value = '';
            playerInput.focus();
        })
        .catch(error => {
            console.error('Error adding player:', error);
            alert('Error adding player');
        });
}

// Attendance management
function saveAttendance() {
    const dateInput = document.getElementById('attendanceDate');
    if (!dateInput) {
        console.error('Date input not found');
        return;
    }

    const date = dateInput.value;
    if (!date) {
        alert('Please select a date');
        return;
    }

    if (selectedPlayers.size === 0) {
        alert('Please select at least one player');
        return;
    }

    const dateKey = date.split('T')[0];
    let shouldSave = true;
    let existingPlayers = [];

    db.ref(`attendance/${dateKey}`).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                shouldSave = confirm('Attendance record already exists for this date. Do you want to update it?');
                const data = snapshot.val();
                existingPlayers = data.players || [];
            }

            if (!shouldSave) {
                return Promise.reject('Update cancelled by user');
            }

            const allPlayers = [...new Set([
                ...existingPlayers,
                ...Array.from(selectedPlayers)
            ])].sort();

            const attendanceRecord = {
                date: dateKey,
                players: allPlayers
            };

            return db.ref(`attendance/${dateKey}`).set(attendanceRecord);
        })
        .then(() => {
            alert('Attendance saved successfully!');
        })
        .catch((error) => {
            if (error === 'Update cancelled by user') return;
            console.error('Error saving attendance:', error);
            alert('Error saving attendance');
        });
}

// Display functions
const debouncedDisplayHistory = debounce(() => {
    debugLog("displayHistory called (debounced)");
    const historyBody = document.getElementById('attendanceHistory');
    if (!historyBody) {
        debugLog("History tbody not found!");
        return;
    }

    historyBody.innerHTML = '';

    db.ref('attendance').orderByKey().once('value')
        .then((snapshot) => {
            const attendanceData = [];
            const rawData = snapshot.val();
            debugLog("Raw Firebase data:", rawData);

            if (rawData) {
                Object.entries(rawData).forEach(([dateKey, data]) => {
                    if (data && data.date && data.players) {
                        attendanceData.push({
                            key: dateKey,
                            date: data.date,
                            players: data.players
                        });
                    }
                });
            }

            attendanceData.sort((a, b) => new Date(b.date) - new Date(a.date));

            attendanceData.forEach(record => {
                const row = document.createElement('tr');
                const formattedDate = formatDate(record.date);

                row.innerHTML = `
                    <td>${formattedDate}</td>
                    <td>${record.players.join(', ')}</td>
                    <td>
                        <button class="delete-btn" onclick="deleteAttendance('${record.key}')">Delete</button>
                    </td>
                `;
                historyBody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('Error loading attendance:', error);
            alert('Error loading attendance history');
        });
}, 300);

function displayPlayers() {
    const playerList = document.getElementById('playerList');
    if (!playerList) return;

    playerList.innerHTML = '';
    players.sort().forEach(player => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `player-${player}`;
        checkbox.value = player;
        checkbox.checked = selectedPlayers.has(player);
        checkbox.onchange = () => {
            if (checkbox.checked) {
                selectedPlayers.add(player);
            } else {
                selectedPlayers.delete(player);
            }
        };

        const label = document.createElement('label');
        label.htmlFor = `player-${player}`;
        label.textContent = player;

        const div = document.createElement('div');
        div.className = 'player-item';
        div.appendChild(checkbox);
        div.appendChild(label);

        playerList.appendChild(div);
    });
}

// Delete functions
function deleteAttendance(dateKey) {
    debugLog("Attempting to delete attendance for date:", dateKey);

    if (confirm('Are you sure you want to delete this attendance record?')) {
        // No need to clean the dateKey - it's already in the correct format from Firebase
        db.ref('attendance').child(dateKey).remove()
            .then(() => {
                debugLog("Successfully deleted attendance for:", dateKey);
                alert('Attendance record deleted successfully!');
            })
            .catch((error) => {
                console.error('Error deleting attendance:', error);
                alert('Error deleting attendance record');
            });
    }
}

function deleteAllHistory() {
    if (confirm('Are you sure you want to delete all attendance history? This cannot be undone!')) {
        db.ref('attendance').remove()
            .then(() => {
                alert('All attendance history deleted successfully!');
            })
            .catch((error) => {
                console.error('Error deleting all history:', error);
                alert('Error deleting attendance history');
            });
    }
}

// Initialization
function initializeAttendanceListener() {
    if (isListenerInitialized) {
        debugLog("Attendance listener already initialized, skipping");
        return;
    }

    debugLog("Setting up attendance listener");
    db.ref('attendance').off('value');

    db.ref('attendance').on('value', (snapshot) => {
        debugLog("Attendance listener triggered with data:", snapshot.val());
        debouncedDisplayHistory();
    });

    isListenerInitialized = true;
}

function loadData() {
    db.ref('players').on('value', (snapshot) => {
        const data = snapshot.val();
        players = data ? Object.values(data) : [];
        displayPlayers();
    });

    if (!isListenerInitialized) {
        initializeAttendanceListener();
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!isListenerInitialized) {
        loadData();
    }
});
