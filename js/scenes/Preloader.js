class Preloader extends Phaser.Scene {
    constructor() { super('Preloader'); }
    preload() {
        // Load generated assets
        this.load.image('char1', 'assets/char1.jpg');
        this.load.image('char2', 'assets/char2.jpg');
        this.load.image('char3', 'assets/char3.jpg');
        this.load.image('ball', 'assets/ball.jpg');
        this.load.image('bg', 'assets/bg.jpg');
        this.load.image('target_balloon', 'assets/target_balloon.jpg');
        this.load.image('target_box', 'assets/target_box.jpg');
        this.load.image('goal', 'assets/goal.jpg');

        // Particle
        let graphics = this.make.graphics();
        graphics.fillStyle(0xffff00, 1);
        graphics.fillCircle(8, 8, 8);
        graphics.generateTexture('star', 16, 16);
        graphics.clear();
    }
    create() {
        this.scene.start('Menu');
    }
}
