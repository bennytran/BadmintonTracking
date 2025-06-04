/**
 * @jest-environment jsdom
 */

// Mock Firebase
const mockDatabase = {
    data: {
        players: {},
        attendance: {}
    },
    listeners: {},
    ref: function (path) {
        return {
            child: (childPath) => {
                return this.ref(`${path}/${childPath}`);
            },
            on: (event, callback) => {
                this.listeners[path] = callback;
                callback({
                    val: () => this.data[path]
                });
            },
            once: (event) => {
                return Promise.resolve({
                    val: () => this.data[path]
                });
            },
            set: (value) => {
                // Split path into segments
                const segments = path.split('/');
                let current = this.data;

                // Navigate to the correct location
                for (let i = 0; i < segments.length - 1; i++) {
                    if (!current[segments[i]]) {
                        current[segments[i]] = {};
                    }
                    current = current[segments[i]];
                }

                // Set the value
                current[segments[segments.length - 1]] = value;

                if (this.listeners[path]) {
                    this.listeners[path]({
                        val: () => value
                    });
                }
                return Promise.resolve();
            },
            push: (value) => {
                if (!this.data[path]) {
                    this.data[path] = {};
                }
                const key = 'key-' + Date.now();
                this.data[path][key] = value;
                if (this.listeners[path]) {
                    this.listeners[path]({
                        val: () => this.data[path]
                    });
                }
                return Promise.resolve();
            }
        };
    }
};

// Set up DOM
document.body.innerHTML = `
    <input type="text" id="playerNameInput">
    <div id="playerList"></div>
    <input type="date" id="attendanceDate">
    <div id="attendanceHistory"></div>
`;

// Mock global variables and functions
global.firebase = {
    database: () => mockDatabase
};
global.db = mockDatabase;
global.alert = jest.fn();
global.showNotification = jest.fn();
global.players = [];

// Import the functions
const script = require('./script.js');
script.showNotification = jest.fn();

describe('Player Management', () => {
    beforeEach(() => {
        // Reset everything
        mockDatabase.data = { players: {} };
        document.getElementById('playerNameInput').value = '';
        global.alert.mockClear();
        global.players = [];
        global.getSelectedPlayers = jest.fn().mockReturnValue([]);
    });

    test('Add player successfully', async () => {
        const playerInput = document.getElementById('playerNameInput');
        playerInput.value = 'John';

        await script.addPlayer();

        const players = Object.values(mockDatabase.data.players);
        expect(players).toContain('John');
        expect(playerInput.value).toBe('');
    });

    test('Cannot add empty player name', () => {
        document.getElementById('playerNameInput').value = '';

        script.addPlayer();

        expect(global.alert).toHaveBeenCalledWith('Please enter a player name');
        expect(Object.keys(mockDatabase.data.players)).toHaveLength(0);
    });

    test('Cannot add duplicate player', async () => {
        // First add a player
        mockDatabase.data.players = { 'key-1': 'John' };
        script.players.splice(0, script.players.length, 'John');

        // Try to add the same player
        document.getElementById('playerNameInput').value = 'John';
        await script.addPlayer();

        expect(global.alert).toHaveBeenCalledWith('This player already exists!');
        expect(Object.values(mockDatabase.data.players).filter(p => p === 'John')).toHaveLength(1);
    });
});

describe('Attendance Management', () => {
    beforeEach(() => {
        mockDatabase.data = {
            players: { 'key-1': 'John', 'key-2': 'Jane' },
            attendance: {}
        };
        document.getElementById('attendanceDate').value = '2024-02-28';
        script.players.splice(0, script.players.length, 'John', 'Jane');
        script.selectedPlayers.clear();
        script.selectedPlayers.add('John');
        script.selectedPlayers.add('Jane');
    });

    test('Save attendance successfully', async () => {
        await script.saveAttendance();

        const savedData = mockDatabase.data.attendance['20240228'];
        expect(savedData).toBeDefined();
        expect(savedData.players).toEqual(['John', 'Jane']);
    });
}); 