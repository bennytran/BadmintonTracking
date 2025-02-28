let players = [];
let attendanceHistory = [];
let searchTimeout;
let selectedSearchItem = -1;
let selectedPlayers = new Set();

function loadData() {
    // Listen for players changes
    db.ref('players').on('value', (snapshot) => {
        const data = snapshot.val();
        players = data ? Object.values(data) : [];
        displayPlayers();
    }, (error) => {
        console.error('Error loading players:', error);
        alert('Error loading players');
    });

    // Listen for attendance changes
    db.ref('attendance').on('value', (snapshot) => {
        const data = snapshot.val();
        attendanceHistory = data ? Object.values(data) : [];
        displayHistory();
    }, (error) => {
        console.error('Error loading attendance:', error);
        alert('Error loading attendance');
    });
}

function addPlayer() {
    const playerInput = document.getElementById('playerNameInput');
    const name = playerInput.value.trim();

    if (name) {
        // Normalize the name before checking or adding
        const normalizedName = capitalizeWords(name);

        // Check if name already exists (case-insensitive)
        const nameExists = players.some(player =>
            player.toLowerCase() === normalizedName.toLowerCase()
        );

        if (nameExists) {
            alert('This player already exists!');
            return;
        }

        // Add the normalized name
        players.push(normalizedName);

        // Sort players (case-insensitive)
        players.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        saveData();
        displayPlayers();
        playerInput.value = '';
    }
}

function displayPlayers() {
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = '';

    // Sort and group players
    const sortedPlayers = [...players].sort((a, b) => a.localeCompare(b));
    const groupedPlayers = {};

    sortedPlayers.forEach(player => {
        const firstLetter = player.charAt(0).toUpperCase();
        if (!groupedPlayers[firstLetter]) {
            groupedPlayers[firstLetter] = [];
        }
        groupedPlayers[firstLetter].push(player);
    });

    // Create sections
    Object.keys(groupedPlayers).sort().forEach(letter => {
        const letterSection = document.createElement('div');
        letterSection.className = 'letter-section';

        const letterHeader = document.createElement('div');
        letterHeader.className = 'letter-header';
        letterHeader.textContent = letter;
        letterSection.appendChild(letterHeader);

        groupedPlayers[letter].forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            const isSelected = selectedPlayers.has(player);
            playerItem.innerHTML = `
                <span class="player-name">${player}</span>
                <div class="button-group">
                    <button class="add-btn ${isSelected ? 'selected' : ''}" 
                            onclick="togglePlayerSelection(this, '${player}')" 
                            data-player="${player}"
                            style="background-color: ${isSelected ? '#6c757d' : ''}"
                    >Add</button>
                    <button class="remove-btn" onclick="showRemoveConfirmation('${player}')">Remove</button>
                </div>
            `;
            letterSection.appendChild(playerItem);
        });

        playerList.appendChild(letterSection);
    });

    // Apply sticky behavior after rendering
    const letterHeaders = document.querySelectorAll('.letter-header');
    letterHeaders.forEach(header => {
        const parent = header.parentElement;
        parent.style.overflow = 'visible';
        header.style.position = 'sticky';
        header.style.top = '0';
        header.style.zIndex = '10';
    });

    // Update select all button
    updateSelectAllButton();
}

function updateSelectAllButton() {
    const allButtons = document.querySelectorAll('.add-btn');
    const selectAllBtn = document.querySelector('.select-all-btn');
    const areAllSelected = Array.from(allButtons).every(btn => btn.classList.contains('selected'));

    selectAllBtn.textContent = areAllSelected ? 'Deselect All' : 'Select All';
}

function toggleSelectAll() {
    const allButtons = document.querySelectorAll('.add-btn');
    const selectAllBtn = document.querySelector('.select-all-btn');
    const areAllSelected = Array.from(allButtons).every(btn => btn.classList.contains('selected'));

    allButtons.forEach(btn => {
        const playerName = btn.getAttribute('data-player');
        if (areAllSelected) {
            btn.classList.remove('selected');
            btn.style.backgroundColor = ''; // Reset to default green
            selectedPlayers.delete(playerName);
        } else {
            btn.classList.add('selected');
            btn.style.backgroundColor = '#6c757d'; // Grey
            selectedPlayers.add(playerName);
        }
    });

    updateSelectAllButton();
}

function togglePlayerSelection(button, playerName) {
    button.classList.toggle('selected');
    if (button.classList.contains('selected')) {
        button.style.backgroundColor = '#6c757d'; // Grey when selected
        selectedPlayers.add(playerName);
    } else {
        button.style.backgroundColor = ''; // Reset to default green
        selectedPlayers.delete(playerName);
    }

    updateSelectAllButton(); // Update select all button state
}

function getSelectedPlayers() {
    return Array.from(selectedPlayers);
}

function showRemoveConfirmation(player) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Remove Player</h3>
            <p>Are you sure you want to remove ${player}?</p>
            <div class="modal-buttons">
                <button onclick="confirmRemove('${player}')" class="confirm-btn">Confirm</button>
                <button onclick="closeModal()" class="cancel-btn">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeModal() {
    const modal = document.querySelector('.modal');
    if (modal) modal.remove();
}

function confirmRemove(player) {
    removePlayer(player);
    closeModal();
}

function removePlayer(name) {
    db.ref('players').once('value').then((snapshot) => {
        const data = snapshot.val();
        if (data) {
            const updatedPlayers = Object.entries(data)
                .filter(([_, value]) => value !== name)
                .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
            db.ref('players').set(updatedPlayers);
        }
    });
}

function displayHistory() {
    const historyDiv = document.getElementById('attendanceHistory');
    historyDiv.innerHTML = ''; // Just clear the content, don't create new table

    db.ref('attendance').orderByKey().on('value', (snapshot) => {
        const attendanceData = snapshot.val() || {};

        // Convert to array and sort by date (newest first)
        const sortedAttendance = Object.entries(attendanceData)
            .map(([key, value]) => ({
                key,
                date: value.date,
                players: value.players
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedAttendance.forEach(record => {
            const row = document.createElement('tr');
            const date = new Date(record.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            row.innerHTML = `
                <td>${date}</td>
                <td>${record.players.join(', ')}</td>
                <td>
                    <button class="delete-btn" onclick="deleteAttendance('${record.key}')">Delete</button>
                </td>
            `;
            historyDiv.appendChild(row);
        });
    });
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function deleteHistory(date) {
    if (confirm('Are you sure you want to delete this attendance record?')) {
        if (confirm('Please confirm again to delete this record.')) {
            db.ref(`attendance/${date}`).remove()
                .then(() => {
                    showNotification('Record deleted successfully!');
                })
                .catch(error => {
                    console.error('Error deleting record:', error);
                    alert('Error deleting record');
                });
        }
    }
}

function saveAttendance() {
    const date = document.getElementById('attendanceDate').value;
    if (!date) {
        alert('Please select a date');
        return;
    }

    if (selectedPlayers.size === 0) {
        alert('Please select at least one player');
        return;
    }

    // Format date to use as key
    const formattedDate = date.replace(/-/g, '');

    // First, get existing data for this date
    db.ref('attendance/' + formattedDate).once('value')
        .then((snapshot) => {
            let existingPlayers = [];
            if (snapshot.exists()) {
                existingPlayers = snapshot.val().players || [];
            }

            // Combine existing and new players, remove duplicates
            const updatedPlayers = Array.from(new Set([
                ...existingPlayers,
                ...Array.from(selectedPlayers)
            ])).sort();

            // Update database with combined players
            return db.ref('attendance/' + formattedDate).update({
                date: date,
                players: updatedPlayers
            });
        })
        .then(() => {
            alert('Attendance saved successfully!');
            displayAttendance();
        })
        .catch((error) => {
            console.error('Error saving attendance:', error);
            alert('Error saving attendance');
        });
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Add Enter key functionality
document.getElementById('playerName').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        addPlayer(); // Call addPlayer directly
    }
});

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('attendanceDate');
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today; // Restrict past dates
    dateInput.value = today;
    loadData();
    displayAttendance();
});

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        addPlayer: function () {
            const playerInput = document.getElementById('playerName');
            const name = playerInput.value.trim();

            if (!name) {
                alert('Please enter a player name');
                return;
            }

            if (players.includes(name)) {
                alert('Player already exists in the list');
                return;
            }

            db.ref('players').push(name);
            playerInput.value = '';
            playerInput.focus();
        },

        saveAttendance: function () {
            const date = document.getElementById('attendanceDate').value;
            if (!date) {
                alert('Please select a date');
                return;
            }

            const selectedPlayers = getSelectedPlayers();
            if (selectedPlayers.length === 0) {
                alert('Please select at least one player');
                return;
            }

            db.ref(`attendance/${date}`).set({
                date: date,
                players: selectedPlayers
            });

            showNotification('Attendance saved successfully!');
        },

        // Add other functions you want to test
        displayPlayers,
        removePlayer,
        loadData,
        togglePlayerSelection,
        getSelectedPlayers,
        toggleSelectAll
    };
}

// Add this at the bottom of your script
window.addEventListener('beforeunload', () => {
    // Remove Firebase listeners
    db.ref('players').off();
    db.ref('attendance').off();
});

function showRemoveAllConfirmation() {
    if (confirm('Are you sure you want to remove all players?')) {
        if (confirm('Please confirm again to remove all players.')) {
            db.ref('players').set({})
                .then(() => {
                    showNotification('All players removed successfully!');
                })
                .catch(error => {
                    console.error('Error removing players:', error);
                    alert('Error removing players');
                });
        }
    }
}

function showDeleteAllHistoryConfirmation() {
    if (confirm('Are you sure you want to delete all attendance history?')) {
        if (confirm('Please confirm again to delete all history.')) {
            db.ref('attendance').set({})
                .then(() => {
                    showNotification('All history deleted successfully!');
                })
                .catch(error => {
                    console.error('Error deleting history:', error);
                    alert('Error deleting history');
                });
        }
    }
}

function validateName(name) {
    // Allow only letters, numbers, and spaces
    const regex = /^[a-zA-Z0-9\s]+$/;
    return regex.test(name);
}

// Add search functionality
document.getElementById('searchInput').addEventListener('input', function (e) {
    clearTimeout(searchTimeout);
    const searchTerm = e.target.value.trim().toLowerCase();

    searchTimeout = setTimeout(() => {
        if (validateName(searchTerm) || searchTerm === '') {
            showSearchDropdown(searchTerm);
        }
    }, 300);
});

document.getElementById('searchInput').addEventListener('keydown', function (e) {
    const dropdown = document.getElementById('searchDropdown');
    const items = dropdown.getElementsByClassName('dropdown-item');

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const direction = e.key === 'ArrowDown' ? 1 : -1;
        selectedSearchItem = (selectedSearchItem + direction + items.length) % items.length;

        Array.from(items).forEach((item, index) => {
            item.classList.toggle('selected', index === selectedSearchItem);
        });
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedSearchItem >= 0 && items[selectedSearchItem]) {
            const selectedPlayer = items[selectedSearchItem].textContent;
            selectSearchItem(selectedPlayer);
        } else {
            performSearch();
        }
    }
});

// Close dropdown when clicking outside
document.addEventListener('click', function (e) {
    if (!e.target.closest('.search-container')) {
        document.getElementById('searchDropdown').style.display = 'none';
    }
});

function showSearchDropdown(searchTerm) {
    const dropdown = document.getElementById('searchDropdown');
    if (!searchTerm) {
        dropdown.style.display = 'none';
        return;
    }

    const matches = players.filter(player =>
        player.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (matches.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

    dropdown.innerHTML = matches
        .map((player, index) => `
            <div class="dropdown-item" 
                 onclick="selectSearchItem('${player}')"
                 data-index="${index}">
                ${highlightMatch(player, searchTerm)}
            </div>
        `)
        .join('');

    dropdown.style.display = 'block';
}

function highlightMatch(text, searchTerm) {
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<strong>$1</strong>');
}

function selectSearchItem(player) {
    document.getElementById('searchInput').value = player;
    document.getElementById('searchDropdown').style.display = 'none';
    performSearch();
}

function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.toLowerCase();
    const dropdown = document.getElementById('searchDropdown');

    if (!searchTerm) {
        dropdown.style.display = 'none';
        return;
    }

    const matches = players.filter(player =>
        player.toLowerCase().includes(searchTerm)
    );

    if (matches.length > 0) {
        dropdown.innerHTML = matches
            .map((player, index) => {
                const highlightedName = player.replace(
                    new RegExp(searchTerm, 'gi'),
                    match => `<strong>${match}</strong>`
                );
                return `
                    <div class="dropdown-item ${index === selectedSearchItem ? 'selected' : ''}" 
                         onclick="selectPlayer('${player}')">
                        ${highlightedName}
                    </div>`;
            })
            .join('');
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }
}

// Add input validation for player name input
document.getElementById('playerName').addEventListener('input', function (e) {
    const input = e.target;
    const name = input.value;

    if (name && !validateName(name)) {
        input.style.borderColor = '#dc3545';
        input.title = 'Name can only contain letters, numbers, and spaces';
    } else {
        input.style.borderColor = '';
        input.title = '';
    }
});

function displayAttendance() {
    const attendanceHistory = document.getElementById('attendanceHistory');
    attendanceHistory.innerHTML = '';

    db.ref('attendance').orderByKey().on('value', (snapshot) => {
        const attendanceData = snapshot.val() || {};

        // Convert to array and sort by date (newest first)
        const sortedAttendance = Object.entries(attendanceData)
            .map(([key, value]) => ({
                key,
                date: value.date,
                players: value.players
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedAttendance.forEach(record => {
            const row = document.createElement('tr');
            const date = new Date(record.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            row.innerHTML = `
                <td>${date}</td>
                <td>${record.players.join(', ')}</td>
                <td>
                    <button class="delete-btn" onclick="deleteAttendance('${record.key}')">Delete</button>
                </td>
            `;
            attendanceHistory.appendChild(row);
        });
    });
}

function deleteAttendance(key) {
    if (confirm('Are you sure you want to delete this attendance record?')) {
        if (confirm('Please confirm again to delete this record.')) {
            db.ref(`attendance/${key}`).remove()
                .then(() => {
                    showNotification('Record deleted successfully!');
                })
                .catch(error => {
                    console.error('Error deleting record:', error);
                    alert('Error deleting record');
                });
        }
    }
}

// Function to capitalize first letter of each word
function capitalizeWords(name) {
    return name
        .trim() // Remove leading/trailing spaces
        .toLowerCase() // Convert all to lowercase first
        .split(' ') // Split into words
        .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize first letter of each word
        .join(' '); // Join back with spaces
} 