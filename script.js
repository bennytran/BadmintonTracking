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
    playerList.innerHTML = '';

    players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = `
            <input type="checkbox" id="check-${player}">
            <label for="check-${player}">${player}</label>
            <button onclick="removePlayer('${player}')" style="margin-left: auto">Remove</button>
        `;
        playerList.appendChild(div);
    });
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
        attendanceHistory = attendanceHistory.filter(record => record.date !== date);
        localStorage.setItem('attendanceHistory', JSON.stringify(attendanceHistory));
        displayHistory();
    }
}

function saveAttendance() {
    const date = document.getElementById('attendanceDate').value;
    if (!date) {
        alert('Please select a date');
        return;
    }

    const presentPlayers = players.filter(player =>
        document.getElementById(`check-${player}`).checked
    );

    if (presentPlayers.length === 0) {
        alert('Please select at least one player');
        return;
    }

    // Remove any existing records for this date
    attendanceHistory = attendanceHistory.filter(record => record.date !== date);

    // Add the new record
    attendanceHistory.push({
        date: date,
        players: presentPlayers
    });

    localStorage.setItem('attendanceHistory', JSON.stringify(attendanceHistory));
    displayHistory();

    // Show success message
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