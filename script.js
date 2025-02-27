let players = [];
let attendanceHistory = [];

// Load data from localStorage when the page loads
function loadData() {
    const savedPlayers = localStorage.getItem('players');
    const savedHistory = localStorage.getItem('attendanceHistory');

    if (savedPlayers) players = JSON.parse(savedPlayers);
    if (savedHistory) attendanceHistory = JSON.parse(savedHistory);

    displayPlayers();
    displayHistory();
}

function addPlayer() {
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

    players.push(name);
    localStorage.setItem('players', JSON.stringify(players));
    displayPlayers();
    playerInput.value = '';
}

function displayPlayers() {
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = `
        <div class="select-all-container">
            <button class="select-all-btn" onclick="toggleSelectAll()">Select All</button>
        </div>
    `;

    players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = `
            <span class="player-name">${player}</span>
            <div class="button-group">
                <button class="add-btn" onclick="togglePlayerSelection(this, '${player}')" data-player="${player}">Add</button>
                <button class="remove-btn" onclick="showRemoveConfirmation('${player}')">Remove</button>
            </div>
        `;
        playerList.appendChild(div);
    });
}

function togglePlayerSelection(button, player) {
    button.classList.toggle('selected');
    // Store selection state
    const selectedPlayers = getSelectedPlayers();
    localStorage.setItem('selectedPlayers', JSON.stringify(selectedPlayers));
}

function getSelectedPlayers() {
    return Array.from(document.querySelectorAll('.add-btn.selected'))
        .map(btn => btn.getAttribute('data-player'));
}

function toggleSelectAll() {
    const allButtons = document.querySelectorAll('.add-btn');
    const selectAllBtn = document.querySelector('.select-all-btn');
    const areAllSelected = Array.from(allButtons).every(btn => btn.classList.contains('selected'));

    allButtons.forEach(btn => {
        if (areAllSelected) {
            btn.classList.remove('selected');
        } else {
            btn.classList.add('selected');
        }
    });

    selectAllBtn.textContent = areAllSelected ? 'Select All' : 'Deselect All';
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
    players = players.filter(player => player !== name);
    localStorage.setItem('players', JSON.stringify(players));
    displayPlayers();
}

function displayHistory() {
    const historyDiv = document.getElementById('attendanceHistory');
    historyDiv.innerHTML = `
        <table class="history-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Present Players</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        </table>
    `;

    const tbody = historyDiv.querySelector('tbody');

    // Sort by date in descending order and remove duplicates
    const uniqueDates = {};
    attendanceHistory.forEach(record => {
        if (!uniqueDates[record.date]) {
            uniqueDates[record.date] = record.players;
        }
    });

    Object.entries(uniqueDates)
        .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA))
        .forEach(([date, players]) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDate(date)}</td>
                <td>${players.join(', ')}</td>
                <td>
                    <button class="delete-btn" onclick="deleteHistory('${date}')">
                        Delete
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function deleteHistory(date) {
    if (confirm('Are you sure you want to delete this attendance record?')) {
        if (confirm('Please confirm again to delete this record.')) {
            attendanceHistory = attendanceHistory.filter(record => record.date !== date);
            localStorage.setItem('attendanceHistory', JSON.stringify(attendanceHistory));
            displayHistory();
        }
    }
}

function saveAttendance() {
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

    // Remove any existing records for this date
    attendanceHistory = attendanceHistory.filter(record => record.date !== date);

    // Add the new record
    attendanceHistory.push({
        date: date,
        players: selectedPlayers
    });

    localStorage.setItem('attendanceHistory', JSON.stringify(attendanceHistory));
    displayHistory();
    showNotification('Attendance saved successfully!');
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

// Initialize the date input with today's date
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('attendanceDate').value = today;
    loadData();
}); 