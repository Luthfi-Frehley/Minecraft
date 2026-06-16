const THREE = window.THREE;

export class ShadowManager {
    constructor(scene) {
        this.scene = scene;
        this.light = null;
        this.init();
    }

    init() {
        // Light source
        this.light = new THREE.DirectionalLight(0xffffff, 1.0);
        this.light.position.set(20, 50, 20);
        
        // Shadow configuration based on global.json (Blocky Shadows)
        this.light.castShadow = true;
        
        // Resolusi shadow (texel_size: 32 means we need high res for crisp edges)
        this.light.shadow.mapSize.width = 2048;
        this.light.shadow.mapSize.height = 2048;
        
        // Shadow camera bounds (seberapa luas bayangan diproyeksikan)
        const d = 40;
        this.light.shadow.camera.left = -d;
        this.light.shadow.camera.right = d;
        this.light.shadow.camera.top = d;
        this.light.shadow.camera.bottom = -d;
        this.light.shadow.camera.near = 0.1;
        this.light.shadow.camera.far = 100;
        
        // Tipe shadow sharp agar blocky
        this.light.shadow.bias = -0.001; 
        
        this.scene.add(this.light);
        
        // Ambient light untuk sedikit cahaya di bayangan
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);
    }
    
    update(player) {
        // Biar bayangan ngikutin posisi player biar selalu tajam di area sekitar player
        this.light.position.set(player.x + 20, 50, player.z + 20);
        this.light.target.position.set(player.x, 0, player.z);
        this.light.target.updateMatrixWorld();
    }
}