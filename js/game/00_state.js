// ============================================================================
// FOOTBALL STRIKE 3D: WORLD CHAMPIONSHIP EDITION (v7.0.0)
// True 3D Directional Raycast Aiming • Zero-Rebound Net Trap • Pro Goalkeeper Rig
// 4-Tier Stadium & Animated Crowd • Full Procedural Matchday Audio Engine
// ============================================================================

// --- Game State & Unified International Training Configuration ---
let currentGameMode = 'training'; // Unified Progressive Training Mode ('training', 'duel', 'keeper', 'targets', 'practice')
let requestedMode = 'training';
let isPlaying = false;
let isAiming = false;
let shotComplete = false;
let score = 0;
let streak = 0;
let highestStreak = 0;
let bestStreak = 0;
let highScore = 0;
let drillLevel = 1;
let trainingShotCount = 0;
let maxSpeedRecord = 0;
let maxSpinRecord = 0;
let targetsShattered = 0;
let goalsScored = 0;
let savesMade = 0;

try {
    bestStreak = parseInt(localStorage.getItem('fs_training_best_streak') || '0', 10) || 0;
    highScore = parseInt(localStorage.getItem('fs_training_high_score') || '0', 10) || 0;
    highestStreak = bestStreak;
} catch (e) {}

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

// Progressive Drill & Duel Round Configuration (Varied spots from 11m penalty spot out to 22m free-kick angles)
let currentRound = 1;
const maxDuelShots = 5;
let duelResults = [];   // Player results: 'goal', 'miss'
let duelAiResults = []; // AI opponent results: 'goal', 'miss'
let spotX = 0;
let spotZ = -9.0;
const freeKickSpots = [
    { x: 0.0,  z: -9.0, isPenalty: true,  tier: 1, label: 'STAGE 1 • PENALTY SPOT (11M)' },
    { x: -2.4, z: -4.5, isPenalty: false, tier: 1, label: 'STAGE 2 • LEFT D-ARC EDGE (15.7M)' },
    { x: 2.4,  z: -4.5, isPenalty: false, tier: 1, label: 'STAGE 3 • RIGHT D-ARC EDGE (15.7M)' },
    { x: 0.0,  z: -2.0, isPenalty: false, tier: 2, label: 'STAGE 4 • CENTRAL PENALTY ARC (18M)' },
    { x: -3.6, z: -1.5, isPenalty: false, tier: 2, label: 'STAGE 5 • LEFT INSWINGER (18.9M)' },
    { x: 3.6,  z: -1.5, isPenalty: false, tier: 2, label: 'STAGE 6 • RIGHT OUTSWINGER (18.9M)' },
    { x: 0.0,  z: 0.0,  isPenalty: false, tier: 3, label: 'STAGE 7 • CENTRAL BOX DEAD-BALL (20M)' },
    { x: -4.8, z: 0.8,  isPenalty: false, tier: 3, label: 'STAGE 8 • LEFT CHANNEL BENDER (21.3M)' },
    { x: 4.8,  z: 0.8,  isPenalty: false, tier: 4, label: 'STAGE 9 • RIGHT CHANNEL BENDER (21.3M)' },
    { x: -6.4, z: 2.0,  isPenalty: false, tier: 4, label: 'STAGE 10 • WIDE LEFT CURLER (22.9M)' },
    { x: 6.4,  z: 2.0,  isPenalty: false, tier: 5, label: 'STAGE 11 • WIDE RIGHT CURLER (22.9M)' },
    { x: 0.0,  z: 4.5,  isPenalty: false, tier: 5, label: 'STAGE 12 • LONG-RANGE KNUCKLEBALL (24.5M)' }
];
const trainingDrillSpots = freeKickSpots;

// Target Race Configuration (Legacy & Progressive Target Support)
let targetRaceTimeLeft = 45;
let targetRaceTimer = null;
let activeTargets = [];
const PHYSICS_STEP = 1 / 120; // fixed simulation step shared by game world and ShotSolver
let cameraFlashes = [];

