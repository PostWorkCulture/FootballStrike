// ============================================================================
// FOOTBALL STRIKE 3D: TOURNAMENT EDITION (v5.0.0)
// True 3D Directional Raycast Aiming • Zero-Rebound Net Trap • Pro Goalkeeper Rig
// 4-Tier Stadium & Animated Crowd • Full Procedural Matchday Audio Engine
// ============================================================================

// --- Game State & Tournament Configuration ---
let currentGameMode = 'duel'; // 'duel' or 'targets'
let isPlaying = false;
let isAiming = false;
let shotComplete = false;
let score = 0;
let streak = 0;
let highestStreak = 0;
let maxSpeedRecord = 0;
let maxSpinRecord = 0;
let targetsShattered = 0;
let goalsScored = 0;

// Duel Mode Configuration (5 Free Kick Rounds against GK + Wall)
let currentRound = 1;
const maxDuelShots = 5;
let duelResults = []; // 'goal', 'miss'
let spotX = 0;
let spotZ = -9.0;
const freeKickSpots = [
    { x: 0, z: -9.0, isPenalty: true },     // Round 1: Central Penalty Spot (11m, inside box, NO wall)
    { x: 0, z: -0.5, isPenalty: false },    // Round 2: Central Edge of Box (19.5m, outside box, 3-man wall)
    { x: -4.5, z: 0.5, isPenalty: false },  // Round 3: Left Channel (20.5m, 3-man wall)
    { x: 4.5, z: 0.5, isPenalty: false },   // Round 4: Right Channel (20.5m, 3-man wall)
    { x: -6.5, z: 2.0, isPenalty: false }   // Round 5: Wide Curler Arc (22m, 3-man wall)
];

// Target Race Configuration (45s Timed Shooting Gallery)
let targetRaceTimeLeft = 45;
let targetRaceTimer = null;
let activeTargets = [];
let particles = [];
let cameraFlashes = [];

