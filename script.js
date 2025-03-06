// Version 1.2.0 - Fixed player addition functionality and added success notifications
// Version 1.2.1 - Updated UI layout and player information display
// Version 1.2.2 - Fixed form submission redirect issue
// Version 1.2.3 - Fixed player list display and data handling
// Version 1.2.4 - Fixed add player functionality and validation

// Start of script.js - remove any Firebase config from here
// Just keep your application logic

// Initialize global variables
let players = [];
let attendanceHistory = [];
let searchTimeout;
let selectedSearchItem = -1;
let selectedPlayers = new Set();

// Add debounce function at the top
let displayTimeout;
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

// Add flag at the top of file
let isListenerInitialized = false;

// Initialize Firebase listeners when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Test connection
    console.log("Testing Firebase connection...");
    db.ref().once('value')
        .then(() => {
            console.log("Successfully connected to Firebase!");
            if (!isListenerInitialized) {
                loadData();
            }
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
        addPlayerBtn.addEventListener('click', showAddPlayerModal);
        console.log('Add Player button listener added');
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

    // Form validation
    const addPlayerForm = document.getElementById('addPlayerForm');
    if (addPlayerForm) {
        // Initialize real-time validation for the form
        setupRealTimeValidation();
    }

    // Real-time validation
    setupRealTimeValidation();
});

function loadData() {
    // Load players with new structure
    db.ref('players').on('value', (snapshot) => {
        const data = snapshot.val();
        players = [];
        if (data) {
            Object.keys(data).forEach(key => {
                players.push({
                    id: key,
                    ...data[key]
                });
            });
        }
        console.log('Loaded players:', players); // Debug log
        displayPlayers();
    });

    // Only initialize attendance listener if not already done
    if (!isListenerInitialized) {
        initializeAttendanceListener();
    }
}

// Single consolidated function for displaying attendance history with debouncing
const displayAttendanceHistory = debounce(() => {
    debugLog("displayAttendanceHistory called");
    const historyBody = document.getElementById('attendanceHistory');
    if (!historyBody) {
        debugLog("History tbody not found!");
        return;
    }

    historyBody.innerHTML = '';

    db.ref('attendance').orderByKey().once('value')
        .then((snapshot) => {
            const attendanceData = [];
            const processedDates = new Set(); // Track processed dates
            const rawData = snapshot.val();
            debugLog("Raw Firebase data:", rawData);

            if (rawData) {
                Object.entries(rawData).forEach(([dateKey, data]) => {
                    // Skip if we've already processed this date
                    if (processedDates.has(dateKey)) return;
                    processedDates.add(dateKey);

                    if (data && data.date && data.players) {
                        attendanceData.push({
                            key: dateKey,
                            date: data.date,
                            players: data.players
                        });
                    }
                });
            }

            // Sort by date (newest first)
            attendanceData.sort((a, b) => new Date(b.date) - new Date(a.date));

            if (attendanceData.length === 0) {
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = '<td colspan="3" class="text-center">No attendance records</td>';
                historyBody.appendChild(emptyRow);
                return;
            }

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
                historyBody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('Error loading attendance:', error);
            alert('Error loading attendance history');
        });
}, 300); // 300ms debounce delay

// Update the initialization function to use the new consolidated function
function initializeAttendanceListener() {
    if (isListenerInitialized) {
        debugLog("Attendance listener already initialized, skipping");
        return;
    }

    debugLog("Setting up attendance listener");
    // Remove any existing listeners first
    db.ref('attendance').off('value');

    // Set up new listener
    db.ref('attendance').on('value', (snapshot) => {
        debugLog("Attendance listener triggered with data:", snapshot.val());
        displayAttendanceHistory();
    });

    isListenerInitialized = true;
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
    if (!playerList) return;

    playerList.innerHTML = '';

    if (!players || players.length === 0) {
        playerList.innerHTML = '<div class="no-players">No players found</div>';
        return;
    }

    // Sort players by username
    const sortedPlayers = [...players].sort((a, b) =>
        (a.username || '').localeCompare(b.username || '')
    );

    sortedPlayers.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.innerHTML = `
            <span class="player-username">${player.username || ''}</span>
            <span class="player-fullname">${player.fullname || ''}</span>
            <span class="player-phone">${player.phone || ''}</span>
            <div class="button-group">
                <button class="add-btn" onclick="togglePlayerSelection(this, '${player.username}')">Add</button>
                <button class="remove-btn" onclick="showRemoveConfirmation('${player.username}')">Remove</button>
            </div>
        `;
        playerList.appendChild(playerItem);
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
    debugLog("Deleting attendance for date:", dateKey);

    if (confirm('Are you sure you want to delete this attendance record?')) {
        // Ensure we're using the raw dateKey without any formatting
        const cleanDateKey = dateKey.replace('date: ', '').replace(/"/g, '');
        debugLog("Clean date key for deletion:", cleanDateKey);

        db.ref(`attendance/${cleanDateKey}`).remove()
            .then(() => {
                debugLog("Successfully deleted attendance for:", cleanDateKey);
                alert('Attendance record deleted successfully!');
                // The listener will automatically trigger displayHistory
            })
            .catch((error) => {
                console.error('Error deleting attendance:', error);
                alert('Error deleting attendance record');
            });
    }
}

function saveAttendance() {
    const date = document.getElementById('attendanceDate').value;
    if (!date) {
        alert('Please select a date');
        return;
    }

    // Get selected usernames (not player names)
    const selectedUsernames = Array.from(selectedPlayers);
    if (selectedUsernames.length === 0) {
        alert('Please select at least one player');
        return;
    }

    // Create attendance record with new structure
    const attendanceRef = db.ref('attendance').child(date.replace(/-/g, ''));
    const attendanceData = {
        date: date,
        players: selectedUsernames
    };

    attendanceRef.set(attendanceData)
        .then(() => {
            showNotification('Attendance saved successfully!');
            selectedPlayers.clear();
            updateSelectAllButton();
            displayPlayers(); // Refresh display
        })
        .catch(error => {
            console.error('Error saving attendance:', error);
            showNotification('Error saving attendance', 'error');
        });
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Add some styling for visibility
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.padding = '15px 25px';
    notification.style.backgroundColor = type === 'success' ? '#28a745' : '#dc3545';
    notification.style.color = 'white';
    notification.style.borderRadius = '4px';
    notification.style.zIndex = '1000';
    notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';

    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
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
        const playerElement = document.querySelector(`.player-item[data-player="${player.username}"]`);
        if (!playerElement) return;

        if (player.username.toLowerCase().includes(searchText)) {
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
    searchInput.value = player.username;
    document.getElementById('searchDropdown').style.display = 'none';

    // Find and click the add button for this player
    const addBtn = document.querySelector(`.add-btn[data-player="${player.username}"]`);
    if (addBtn && !addBtn.classList.contains('selected')) {
        togglePlayerSelection(addBtn, player.username);
    }
}

// Search functionality
function searchPlayers() {
    const searchInput = document.getElementById('searchInput');
    const searchText = searchInput.value.toLowerCase();
    const dropdown = document.getElementById('searchDropdown');

    if (searchText.length > 0) {
        const matches = players.filter(player =>
            player.username.toLowerCase().includes(searchText)
        );

        dropdown.innerHTML = matches
            .map((player, index) => {
                const highlightedName = player.username.replace(
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
    searchInput.value = player.username;
    document.getElementById('searchDropdown').style.display = 'none';

    // Find and click the corresponding Add button
    const addButtons = document.querySelectorAll('.add-btn');
    addButtons.forEach(button => {
        if (button.dataset.player === player.username) {
            button.click();
        }
    });
}



// Add this helper function at the top
function debugLog(message, data) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`, data || '');
    // Force log to persist
    console.trace(`[${timestamp}] Called from`);
}

// Add Player Modal Functions
function showAddPlayerModal() {
    const modal = document.getElementById('addPlayerModal');
    if (!modal) {
        console.error('Modal element not found');
        return;
    }
    modal.style.display = 'block';

    // Reset form and validation states
    const form = document.getElementById('addPlayerForm');
    form.reset();

    // Remove any existing event listeners
    const submitBtn = document.getElementById('submitPlayerBtn');
    const newSubmitBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);

    // Add new click event listener
    newSubmitBtn.addEventListener('click', async () => {
        const playerData = {
            username: document.getElementById('username').value,
            fullname: document.getElementById('fullname').value,
            phone: document.getElementById('phone').value
        };

        try {
            await addNewPlayer(playerData);
        } catch (error) {
            console.error('Error adding player:', error);
            showNotification('Error adding player', 'error');
        }
    });

    // Setup validation after resetting
    setupRealTimeValidation();
}

function closeAddPlayerModal() {
    const modal = document.getElementById('addPlayerModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('addPlayerForm').reset();
    }
}

// Real-time validation
function setupRealTimeValidation() {
    const inputs = ['username', 'fullname', 'phone'];
    const submitBtn = document.getElementById('submitPlayerBtn');

    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (!input) return; // Skip if input doesn't exist

        input.addEventListener('input', function () {
            let isValid = false;

            switch (id) {
                case 'username':
                    isValid = /^[a-zA-Z0-9._-]+$/.test(this.value);
                    break;
                case 'fullname':
                    isValid = /^[a-zA-Z\s]+$/.test(this.value);
                    break;
                case 'phone':
                    isValid = /^[0-9+\s-()]+$/.test(this.value);
                    break;
            }

            // Update input styling
            if (isValid) {
                this.classList.remove('invalid');
                this.classList.add('valid');
            } else {
                this.classList.remove('valid');
                this.classList.add('invalid');
            }

            // Update hint message
            const hintElement = this.parentElement.querySelector('.hint-message');
            if (hintElement) {
                hintElement.classList.toggle('error', !isValid);
            }

            // Check if all inputs are valid
            const allValid = inputs.every(inputId => {
                const element = document.getElementById(inputId);
                return element && element.value && element.classList.contains('valid');
            });

            // Update submit button state
            if (submitBtn) {
                submitBtn.disabled = !allValid;
                submitBtn.style.backgroundColor = allValid ? 'var(--accent-green)' : '#ccc';
                submitBtn.style.cursor = allValid ? 'pointer' : 'not-allowed';
            }
        });
    });
}

function addNewPlayer(playerData) {
    return new Promise((resolve, reject) => {
        // Add validation
        if (!playerData.username || !playerData.fullname || !playerData.phone) {
            showNotification('Please fill all required fields', 'error');
            reject(new Error('Missing required fields'));
            return;
        }

        const newPlayerRef = db.ref('players').push();

        console.log('Adding player:', playerData); // Debug log

        newPlayerRef.set(playerData)
            .then(() => {
                console.log('Successfully added player:', playerData);
                showNotification(`${playerData.fullname} has been added successfully!`);
                closeAddPlayerModal();
                resolve();
            })
            .catch(error => {
                console.error('Error adding player:', error);
                showNotification('Error adding player', 'error');
                reject(error);
            });
    });
}
