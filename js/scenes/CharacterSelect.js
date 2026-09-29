class CharacterSelect extends Phaser.Scene {
    constructor() { super('CharacterSelect'); }
    create() {
        let bg = this.add.image(400, 600, 'bg');
        bg.setDisplaySize(800, 1200);
        
        this.add.text(400, 200, 'CHOOSE PLAYER', { fontSize: '60px', fill: '#FFF', fontStyle: 'bold' }).setOrigin(0.5).setShadow(3, 3, '#000', 5);

        const chars = ['char1', 'char2', 'char3'];
        const xPos = [200, 400, 600];
        
        chars.forEach((char, index) => {
            let sprite = this.add.sprite(xPos[index], 600, char).setInteractive();
            sprite.setDisplaySize(180, 180);
            sprite.setBlendMode(Phaser.BlendModes.MULTIPLY); // Remove white background
            
            sprite.on('pointerdown', () => {
                this.tweens.add({
                    targets: sprite,
                    scale: sprite.scale * 1.2,
                    duration: 200,
                    yoyo: true,
                    onComplete: () => {
                        this.registry.set('selectedChar', char);
                        this.scene.start('Play');
                    }
                });
            });
        });
    }
}
