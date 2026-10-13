// ============================================================================
// FOOTBALL STRIKE 3D: WORLD CHAMPIONSHIP EDITION (v7.0.0)
// True 3D Directional Raycast Aiming • Zero-Rebound Net Trap • Pro Goalkeeper Rig
// 4-Tier Stadium & Animated Crowd • Full Procedural Matchday Audio Engine
// ============================================================================

// --- Game State & Tournament Configuration ---
let currentGameMode = 'duel'; // 'duel', 'keeper', 'targets', 'practice'
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
let savesMade = 0;

// Camera & Role Configuration
window.cameraViewMode = 'third_person'; // 'third_person' | 'first_person' | 'broadcast'
let keeperTurnActive = false;
let aiShotTimer = null;
let aiAimTarget = { x: 0, y: 1.25 };

// Wind & Fireball / Lucky Ball Aerodynamic State
let windSpeedKmh = 0;
let windDirSign = 1; // +1 right, -1 left
let fireballCharge = 0; // 0..100
let isOnFire = false;

// Duel Mode Configuration (5 Free Kick Rounds against GK + Wall + 1v1 AI Scoreboard)
let currentRound = 1;
const maxDuelShots = 5;
let duelResults = [];   // Player results: 'goal', 'miss'
let duelAiResults = []; // AI opponent results: 'goal', 'miss'
let spotX = 0;
let spotZ = -9.0;
const freeKickSpots = [
    { x: 0, z: -9.0, isPenalty: true, label: 'PENALTY SPOT (11M)' },
    { x: 0, z: -0.5, isPenalty: false, label: 'CENTRAL BOX EDGE (19.5M)' },
    { x: -4.5, z: 0.5, isPenalty: false, label: 'LEFT CHANNEL (20.5M)' },
    { x: 4.5, z: 0.5, isPenalty: false, label: 'RIGHT CHANNEL (20.5M)' },
    { x: -6.5, z: 2.0, isPenalty: false, label: 'WIDE CURLER ARC (22M)' }
];

// Target Race Configuration (45s Timed Shooting Gallery)
let targetRaceTimeLeft = 45;
let targetRaceTimer = null;
let activeTargets = [];
const PHYSICS_STEP = 1 / 120; // fixed simulation step shared by game world and ShotSolver
let cameraFlashes = [];
