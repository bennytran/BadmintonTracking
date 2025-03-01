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

    // Set today's date as default
    const dateInput = document.getElementById('attendanceDate');
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.min = today; // Prevent selecting past dates

    // Add player input event listener
    const playerInput = document.getElementById('playerNameInput');
    if (playerInput) {
        playerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addPlayer();
            }
        });
    }

    // Add button click event listener
    const addPlayerBtn = document.getElementById('addPlayerBtn');
    if (addPlayerBtn) {
        addPlayerBtn.addEventListener('click', addPlayer);
    }

    // Search input event listeners
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        // Handle input changes for dropdown
        searchInput.addEventListener('input', searchPlayers);

        // Handle enter key
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        });
    }

    // Search button click
    const searchButton = document.querySelector('.search-btn');
    if (searchButton) {
        searchButton.addEventListener('click', (e) => {
            e.preventDefault();
            performSearch();
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.search-container')) {
            document.getElementById('searchDropdown').style.display = 'none';
        }
    });
});

function loadData() {
    // Load players
    db.ref('players').on('value', (snapshot) => {
        const data = snapshot.val();
        players = data ? Object.values(data) : [];
        displayPlayers();
    });

    // Single attendance listener
    initializeAttendanceListener();
}

function initializeAttendanceListener() {
    db.ref('attendance').on('value', (snapshot) => {
        const data = snapshot.val();
        attendanceHistory = data ? Object.values(data) : [];
        displayHistory();
    });
}

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
            alert(`${normalizedName} has been added successfully!`);
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

    // Add no results message div if it doesn't exist
    if (!document.getElementById('noSearchResults')) {
        const noResults = document.createElement('div');
        noResults.id = 'noSearchResults';
        noResults.style.display = 'none';
        noResults.style.padding = '10px';
        noResults.textContent = 'No players found';
        playerList.appendChild(noResults);
    }

    // Group players by first letter
    const groupedPlayers = {};
    players.forEach(player => {
        const firstLetter = player.charAt(0).toUpperCase();
        if (!groupedPlayers[firstLetter]) {
            groupedPlayers[firstLetter] = [];
        }
        groupedPlayers[firstLetter].push(player);
    });

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
            playerItem.setAttribute('data-player', player);
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
    if (!historyDiv) return;

    // Clear existing content but keep the header row
    const headerRow = historyDiv.querySelector('tr');
    historyDiv.innerHTML = '';
    if (headerRow) historyDiv.appendChild(headerRow);

    db.ref('attendance').orderByKey().once('value')
        .then((snapshot) => {
            const attendanceData = [];

            snapshot.forEach((dateSnapshot) => {
                const data = dateSnapshot.val();
                if (data && data.date && data.players) {
                    attendanceData.push({
                        key: dateSnapshot.key,
                        date: data.date,
                        players: data.players
                    });
                }
            });

            // Sort by date (newest first)
            attendanceData.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Display each record
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
                historyDiv.appendChild(row);
            });
        })
        .catch(error => {
            console.error('Error loading attendance:', error);
            alert('Error loading attendance history');
        });
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        console.error('Error formatting date:', e);
        return 'Invalid Date';
    }
}

function deleteAttendance(dateKey) {
    if (confirm('Are you sure you want to delete this attendance record?')) {
        db.ref(`attendance/${dateKey}`).remove()
            .then(() => {
                alert('Record deleted successfully');
                displayHistory(); // Refresh the display
            })
            .catch(error => {
                console.error('Error deleting record:', error);
                alert('Error deleting record');
            });
    }
}

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
                // Get existing players if any
                const data = snapshot.val();
                existingPlayers = data.players || [];
            }

            if (!shouldSave) {
                return Promise.reject('Update cancelled by user');
            }

            // Merge existing and new players, remove duplicates
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
            if (error === 'Update cancelled by user') {
                return;
            }
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

// Search functionality
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchText = searchInput.value.toLowerCase();

    // Hide all sections first
    document.querySelectorAll('.letter-section').forEach(section => {
        section.style.display = 'none';
    });

    // Show only matching players and their sections
    let foundMatch = false;
    players.forEach(player => {
        const playerElement = document.querySelector(`.player-item[data-player="${player}"]`);
        if (!playerElement) return;

        if (player.toLowerCase().includes(searchText)) {
            foundMatch = true;
            playerElement.style.display = 'flex';
            // Show the parent letter section
            const letterSection = playerElement.closest('.letter-section');
            if (letterSection) {
                letterSection.style.display = 'block';
            }
        } else {
            playerElement.style.display = 'none';
        }
    });

    // If no matches found, show a message
    const noResultsMsg = document.getElementById('noSearchResults');
    if (noResultsMsg) {
        noResultsMsg.style.display = foundMatch ? 'none' : 'block';
    }

    // Hide dropdown after search
    document.getElementById('searchDropdown').style.display = 'none';
}

// Highlight matching text
function highlightMatch(text, searchTerm) {
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<strong>$1</strong>');
}

// Handle search item selection
function selectSearchItem(player) {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = player;
    document.getElementById('searchDropdown').style.display = 'none';

    // Find and click the add button for this player
    const addBtn = document.querySelector(`.add-btn[data-player="${player}"]`);
    if (addBtn && !addBtn.classList.contains('selected')) {
        togglePlayerSelection(addBtn, player);
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

// Search functionality
function searchPlayers() {
    const searchInput = document.getElementById('searchInput');
    const searchText = searchInput.value.toLowerCase();
    const dropdown = document.getElementById('searchDropdown');

    if (searchText.length > 0) {
        const matches = players.filter(player =>
            player.toLowerCase().includes(searchText)
        );

        dropdown.innerHTML = matches
            .map((player, index) => {
                const highlightedName = player.replace(
                    new RegExp(searchText, 'gi'),
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
            alert(`${normalizedName} has been added successfully!`);
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
