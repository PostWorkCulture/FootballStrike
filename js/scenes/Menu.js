class Menu extends Phaser.Scene {
    constructor() { super('Menu'); }
    create() {
        let bg = this.add.image(400, 600, 'bg');
        bg.setDisplaySize(800, 1200);
        
        let title = this.add.text(400, 300, 'KIDS FOOTBALL', { fontSize: '80px', fill: '#FFF', fontStyle: 'bold' }).setOrigin(0.5);
        title.setShadow(3, 3, 'rgba(0,0,0,0.8)', 5);

        let playBtn = this.add.rectangle(400, 700, 300, 100, 0x32CD32).setInteractive();
        playBtn.setStrokeStyle(6, 0xffffff);
        let playText = this.add.text(400, 700, 'PLAY', { fontSize: '60px', fill: '#FFF', fontStyle: 'bold' }).setOrigin(0.5);

        playBtn.on('pointerdown', () => {
            this.tweens.add({
                targets: [playBtn, playText],
                scaleX: 0.9,
                scaleY: 0.9,
                duration: 100,
                yoyo: true,
                onComplete: () => this.scene.start('CharacterSelect')
            });
        });
    }
}
