class Boot extends Phaser.Scene {
    constructor() { super('Boot'); }
    preload() {
        // Load very basic assets for loading bar if needed
    }
    create() {
        this.scene.start('Preloader');
    }
}
