class Play extends Phaser.Scene {
    constructor() { super('Play'); }
    create() {
        // Pitch background
        let bg = this.add.image(400, 600, 'bg');
        bg.setDisplaySize(800, 1200);
        
        // Goal
        this.goal = this.physics.add.staticImage(400, 200, 'goal');
        this.goal.setDisplaySize(450, 300);
        this.goal.setBlendMode(Phaser.BlendModes.MULTIPLY);
        // Adjust physics body for the goal since texture is large
        this.goal.setSize(800, 300);

        // Character
        let selectedChar = this.registry.get('selectedChar') || 'char1';
        this.player = this.add.sprite(400, 1000, selectedChar);
        this.player.setDisplaySize(200, 200);
        this.player.setBlendMode(Phaser.BlendModes.MULTIPLY);

        // Ball
        this.ball = this.physics.add.sprite(400, 850, 'ball');
        this.ball.setDisplaySize(80, 80);
        this.ball.setBlendMode(Phaser.BlendModes.MULTIPLY);
        this.ball.setBounce(0.8);
        this.ball.setCollideWorldBounds(true);
        this.ball.setDrag(0.98); // Friction
        this.ball.setDamping(true);
        this.ball.setCircle(450); // physics body for 1024x1024 ball

        // Targets Group
        this.targets = this.physics.add.group();
        this.spawnTargets();

        // Particles
        this.emitter = this.add.particles(0, 0, 'star', {
            speed: { min: -400, max: 400 },
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 },
            lifespan: 1000,
            gravityY: 400,
            emitting: false
        });

        // Input - Swipe to shoot
        this.input.on('pointerdown', this.startSwipe, this);
        this.input.on('pointerup', this.endSwipe, this);

        // Collisions
        this.physics.add.collider(this.ball, this.goal, this.scoreGoal, null, this);
        this.physics.add.collider(this.ball, this.targets, this.hitTarget, null, this);
        
        this.score = 0;
        this.scoreText = this.add.text(20, 20, 'SCORE: 0', { fontSize: '60px', fill: '#FFF', fontStyle: 'bold' });
        this.scoreText.setShadow(3, 3, '#000', 5);
        
        this.gameState = 'aiming'; // aiming, shooting, resetting
    }

    startSwipe(pointer) {
        if (this.gameState !== 'aiming') return;
        this.swipeStart = { x: pointer.x, y: pointer.y };
    }

    endSwipe(pointer) {
        if (this.gameState !== 'aiming' || !this.swipeStart) return;
        
        let dx = pointer.x - this.swipeStart.x;
        let dy = pointer.y - this.swipeStart.y;
        
        // Ensure it's an upward swipe (forward on the pitch)
        if (dy < -50) {
            this.gameState = 'shooting';
            // Calculate velocity based on swipe vector
            let speedX = dx * 5;
            let speedY = dy * 5;
            
            // Limit max speed
            speedX = Phaser.Math.Clamp(speedX, -1500, 1500);
            speedY = Phaser.Math.Clamp(speedY, -2500, -800);

            this.ball.setVelocity(speedX, speedY);
            
            // Spin effect
            this.ball.setAngularVelocity(speedX);
            
            // Auto reset
            this.time.delayedCall(3000, this.resetTurn, [], this);
        }
    }

    update() {
        // Fake 3D scale effect as ball goes up the pitch
        if (this.gameState === 'shooting') {
            let scale = Phaser.Math.Clamp(this.ball.y / 850, 0.4, 1.0);
            this.ball.setScale(scale * (80/1024)); // Since original texture is 1024x1024, base scale is 80/1024
        }
    }

    scoreGoal(ball, goal) {
        if (this.gameState !== 'shooting') return;
        this.ball.setVelocity(0, 0);
        this.gameState = 'scored';
        
        this.score += 10;
        this.scoreText.setText('SCORE: ' + this.score);
        
        this.celebrate(ball.x, ball.y);
        this.time.delayedCall(2000, this.resetTurn, [], this);
    }

    hitTarget(ball, target) {
        this.score += 5;
        this.scoreText.setText('SCORE: ' + this.score);
        
        // Explode target
        this.emitter.setPosition(target.x, target.y);
        this.emitter.explode(30);
        target.destroy();
    }

    celebrate(x, y) {
        this.emitter.setPosition(x, y);
        this.emitter.explode(50);
        let txt = this.add.text(400, 400, 'GOOOOAL!', { fontSize: '100px', fill: '#FFD700', fontStyle: 'bold' }).setOrigin(0.5);
        txt.setShadow(5, 5, '#000', 10);
        
        this.tweens.add({
            targets: txt,
            scale: 1.5,
            alpha: 0,
            duration: 2000,
            onComplete: () => txt.destroy()
        });
    }

    resetTurn() {
        this.gameState = 'aiming';
        this.ball.setPosition(400, 850);
        this.ball.setVelocity(0, 0);
        this.ball.setAngularVelocity(0);
        this.ball.setScale(80/1024);
        
        if (this.targets.getChildren().length === 0) {
            this.spawnTargets();
        }
    }

    spawnTargets() {
        for(let i=0; i<3; i++) {
            let x = Phaser.Math.Between(200, 600);
            let y = Phaser.Math.Between(300, 600);
            let type = Phaser.Math.Between(0, 1) ? 'target_box' : 'target_balloon';
            let target = this.targets.create(x, y, type);
            target.setDisplaySize(120, 120);
            target.setBlendMode(Phaser.BlendModes.MULTIPLY);
            target.setImmovable(true);
            
            // Adjust body size
            target.setSize(600, 600);
        }
    }
}
