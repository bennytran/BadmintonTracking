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

function saveAttendance() {
    const date = document.getElementById('attendanceDate').value;
    if (!date) {
        alert('Please select a date');
        return;
    }

    const presentPlayers = players.filter(player =>
        document.getElementById(`check-${player}`).checked
    );

    // Check if date already exists
    const existingDateIndex = attendanceHistory.findIndex(record => record.date === date);

    if (existingDateIndex !== -1) {
        // Check for duplicate players
        const existingPlayers = attendanceHistory[existingDateIndex].players;
        const newPlayers = [];
        const duplicatePlayers = [];

        presentPlayers.forEach(player => {
            if (!existingPlayers.includes(player)) {
                newPlayers.push(player);
            } else {
                duplicatePlayers.push(player);
            }
        });

        if (duplicatePlayers.length > 0) {
            alert(`Players ${duplicatePlayers.join(', ')} already exist for this date. Only adding new players.`);
        }

        // Update existing record with new players
        attendanceHistory[existingDateIndex].players = [...existingPlayers, ...newPlayers];
    } else {
        // Add new date record
        attendanceHistory.push({
            date: date,
            players: presentPlayers
        });
    }

    localStorage.setItem('attendanceHistory', JSON.stringify(attendanceHistory));
    displayHistory();
}

function displayHistory() {
    const historyDiv = document.getElementById('attendanceHistory');
    historyDiv.innerHTML = '';

    attendanceHistory.sort((a, b) => new Date(b.date) - new Date(a.date))
        .forEach(record => {
            const div = document.createElement('div');
            div.innerHTML = `
                <h3>${record.date}</h3>
                <p>Present: ${record.players.join(', ')}</p>
            `;
            historyDiv.appendChild(div);
        });
}

// Initialize the date input with today's date
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('attendanceDate').value = today;
    loadData();
}); 