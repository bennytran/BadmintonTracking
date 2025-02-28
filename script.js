// Start of script.js - remove any Firebase config from here
// Just keep your application logic

// Initialize global variables
let players = [];
let attendanceHistory = [];
let searchTimeout;
let selectedSearchItem = -1;
let selectedPlayers = new Set();

// Initialize Firebase listeners when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Test connection
    console.log("Testing Firebase connection...");
    db.ref().once('value')
        .then(() => {
            console.log("Successfully connected to Firebase!");
            // Initialize the rest of your app
            loadData();
            initializeAttendanceListener();
        })
        .catch((error) => {
            console.error("Error connecting to Firebase:", error);
        });
});

function loadData() {
    db.ref('players').on('value', (snapshot) => {
        players = [];
        snapshot.forEach((childSnapshot) => {
            const playerName = childSnapshot.val();
            if (playerName) {
                players.push(playerName);
            }
        });
        players.sort((a, b) => a.localeCompare(b));
        displayPlayers();
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

    if (!name) {
        alert('Please enter a player name');
        return;
    }

    // Normalize the name
    const normalizedName = name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

    // Check for duplicates (case-insensitive)
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
            console.log('Player added successfully:', normalizedName);
            playerInput.value = '';
            playerInput.focus();
        })
        .catch(error => {
            console.error('Error adding player:', error);
            alert('Error adding player');
        });
}

function displayPlayers() {
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = '';

    // Group players by first letter
    const groupedPlayers = {};
    players.forEach(player => {
        const firstLetter = player.charAt(0).toUpperCase();
        if (!groupedPlayers[firstLetter]) {
            groupedPlayers[firstLetter] = [];
        }
        groupedPlayers[firstLetter].push(player);
    });

    // Display players by group
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
                            style="background-color: ${isSelected ? '#6c757d' : ''}"
                            data-player="${player}">Add</button>
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
    const selectAllBtn = document.querySelector('.select-all-btn');
    if (selectAllBtn) {
        const allButtons = document.querySelectorAll('.add-btn');
        const areAllSelected = Array.from(allButtons).every(btn => btn.classList.contains('selected'));
        selectAllBtn.textContent = areAllSelected ? 'Deselect All' : 'Select All';
    }
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
    const isSelected = button.classList.toggle('selected');
    if (isSelected) {
        button.style.backgroundColor = '#6c757d';
        selectedPlayers.add(playerName);
    } else {
        button.style.backgroundColor = '';
        selectedPlayers.delete(playerName);
    }
    updateSelectAllButton();
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

    // First get existing players for this date
    db.ref(`attendance/date: "${date}"/players`).once('value')
        .then((snapshot) => {
            let existingPlayers = [];
            if (snapshot.exists()) {
                existingPlayers = snapshot.val() || [];
            }

            // Combine existing and new players, remove duplicates
            const updatedPlayers = Array.from(new Set([
                ...existingPlayers,
                ...Array.from(selectedPlayers)
            ])).sort();

            // Save with the exact structure requested
            return db.ref(`attendance/date: "${date}"`).set({
                players: updatedPlayers
            });
        })
        .then(() => {
            alert('Attendance saved successfully!');
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

// Add event listener for the enter key
document.getElementById('playerNameInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        addPlayer();
    }
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
    const historyDiv = document.getElementById('attendanceHistory');
    historyDiv.innerHTML = '';

    db.ref('attendance').once('value')
        .then((snapshot) => {
            const attendanceData = [];
            const processedDates = new Set(); // Track processed dates

            snapshot.forEach((dateSnapshot) => {
                const date = dateSnapshot.key.replace('date: ', '').replace(/"/g, '');

                // Skip if we've already processed this date
                if (processedDates.has(date)) return;
                processedDates.add(date);

                const data = dateSnapshot.val();
                if (data && data.players) {
                    attendanceData.push({
                        date: date,
                        players: data.players
                    });
                }
            });

            // Sort by date (newest first)
            attendanceData.sort((a, b) => new Date(b.date) - new Date(a.date));

            if (attendanceData.length === 0) {
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = '<td colspan="3" class="text-center">No attendance records</td>';
                historyDiv.appendChild(emptyRow);
                return;
            }

            attendanceData.forEach(record => {
                const row = document.createElement('tr');
                const displayDate = new Date(record.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });

                row.innerHTML = `
                    <td>${displayDate}</td>
                    <td>${record.players.join(', ')}</td>
                    <td>
                        <button class="delete-btn" onclick="deleteAttendance('${record.date}')">Delete</button>
                    </td>
                `;
                historyDiv.appendChild(row);
            });
        });
}

function deleteAttendance(date) {
    if (confirm('Are you sure you want to delete this attendance record?')) {
        db.ref(`attendance/date: "${date}"`).remove()
            .then(() => {
                displayAttendance();
            })
            .catch((error) => {
                console.error('Error deleting attendance:', error);
                alert('Error deleting attendance');
            });
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

// Separate function for attendance listener
function initializeAttendanceListener() {
    db.ref('attendance').on('value', (snapshot) => {
        displayAttendance();
    });
}

// Fix search functionality
function searchPlayers() {
    const searchInput = document.getElementById('searchInput');
    const searchText = searchInput.value.toLowerCase();
    const dropdown = document.getElementById('searchDropdown');

    if (searchText.length > 0) {
        const matches = players.filter(player =>
            player.toLowerCase().includes(searchText)
        );

        dropdown.innerHTML = matches
            .map(player => {
                const highlightedName = player.replace(
                    new RegExp(searchText, 'gi'),
                    match => `<strong>${match}</strong>`
                );
                return `<div class="dropdown-item" 
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

// Fix player selection from dropdown
function selectPlayer(player) {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = player;
    document.getElementById('searchDropdown').style.display = 'none';

    // Find and click the corresponding Add button
    const addButtons = document.querySelectorAll('.add-btn');
    addButtons.forEach(button => {
        if (button.dataset.player === player) {
            button.click();
        }
    });
}

// Fix add player functionality
function addPlayer() {
    const playerInput = document.getElementById('playerNameInput');
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

    // Check for duplicates (case-insensitive)
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
            console.log('Player added successfully:', normalizedName);
            playerInput.value = '';
            playerInput.focus();
        })
        .catch(error => {
            console.error('Error adding player:', error);
            alert('Error adding player');
        });
}

// Fix date handling in displayAttendance
function displayAttendance() {
    const historyDiv = document.getElementById('attendanceHistory');
    historyDiv.innerHTML = '';

    db.ref('attendance').once('value')
        .then((snapshot) => {
            const attendanceData = [];
            const processedDates = new Set(); // Track processed dates

            snapshot.forEach((dateSnapshot) => {
                const date = dateSnapshot.key.replace('date: ', '').replace(/"/g, '');

                // Skip if we've already processed this date
                if (processedDates.has(date)) return;
                processedDates.add(date);

                const data = dateSnapshot.val();
                if (data && data.players) {
                    attendanceData.push({
                        date: date,
                        players: data.players
                    });
                }
            });

            // Sort by date (newest first)
            attendanceData.sort((a, b) => new Date(b.date) - new Date(a.date));

            if (attendanceData.length === 0) {
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = '<td colspan="3" class="text-center">No attendance records</td>';
                historyDiv.appendChild(emptyRow);
                return;
            }

            attendanceData.forEach(record => {
                const row = document.createElement('tr');
                const displayDate = new Date(record.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });

                row.innerHTML = `
                    <td>${displayDate}</td>
                    <td>${record.players.join(', ')}</td>
                    <td>
                        <button class="delete-btn" onclick="deleteAttendance('${record.date}')">Delete</button>
                    </td>
                `;
                historyDiv.appendChild(row);
            });
        });
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Add player input event listener
    const playerInput = document.getElementById('playerNameInput');
    playerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addPlayer();
        }
    });

    // Add search input event listener
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', searchPlayers);

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.matches('#searchInput')) {
            document.getElementById('searchDropdown').style.display = 'none';
        }
    });
}); 