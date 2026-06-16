const THREE = window.THREE;

export class Interaction {
    constructor(camera, scene, world, controls) {
        this.camera = camera;
        this.scene = scene;
        this.world = world;
        this.controls = controls; 
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2(0, 0); 

        // --- INISIALISASI OBJEK OUTLINE BLOCK (SELECTION BOX) ---
        // Buat rangka kotak kawat berukuran 1x1x1 pas sejajar balok
        const outlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)); // Dibuat sedikit lebih besar (1.002) biar ga berantem visual/Z-fighting sama tekstur blok
        const outlineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x000000, // Warna garis outline hitam khas Minecraft
            linewidth: 2     // Ketebalan garis kawat
        });
        
        this.blockOutline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
        this.blockOutline.visible = false; // Sembunyikan dulu di awal startup
        this.scene.add(this.blockOutline);

        this.initListeners();
    }

    initListeners() {
        // EVENT 1: KLIK MOUSE UNTUK PASANG / HANCURKAN BLOK
        window.addEventListener('mousedown', (e) => {
            if (!document.pointerLockElement) return;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.scene.children);

            if (intersects.length > 0) {
                let hit = null;
                for (let i = 0; i < intersects.length; i++) {
                    // Pastikan objek yang kena raycast adalah blok permainan yang valid, BUKAN garis outline kita sendiri!
                    if (intersects[i].object.userData && intersects[i].object.userData.x !== undefined && intersects[i].object !== this.blockOutline) {
                        hit = intersects[i];
                        break;
                    }
                }

                if (!hit || hit.distance > 6) return; 

                const blockX = Math.round(hit.object.userData.x);
                const blockY = Math.round(hit.object.userData.y);
                const blockZ = Math.round(hit.object.userData.z);
                const blockType = hit.object.userData.type;

                if (e.button === 0) {
                    if (blockType === 'water_source' || blockType === 'water_flow') return;
                    this.world.removeBlock(blockX, blockY, blockZ);
                } 
                else if (e.button === 2) {
                    const normal = hit.face.normal;
                    const newX = Math.round(blockX + normal.x);
                    const newY = Math.round(blockY + normal.y);
                    const newZ = Math.round(blockZ + normal.z);
                    
                    const currentType = this.controls.getActiveBlockType();
                    
                    const targetKey = this.world.getKey(newX, newY, newZ);
                    const targetBlock = this.world.blocks.get(targetKey);
                    
                    if (targetBlock && targetBlock.userData.type === 'water_source') {
                        this.world.checkSourceDestruction(targetKey);
                    }

                    this.world.addBlock(newX, newY, newZ, currentType);
                }
            }
        });
    }

    // ---- LOGIC UTAMA: UPDATE POSISI OUTLINE REALTIME ----
    // Fungsi ini bakal dipanggil terus-terusan di loop animasi main.js buat nyari target sorot crosshair
    updateOutline() {
        if (!document.pointerLockElement) {
            this.blockOutline.visible = false;
            return;
        }

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children);

        if (intersects.length > 0) {
            let hit = null;
            for (let i = 0; i < intersects.length; i++) {
                // Raycast mendeteksi blok valid (mengabaikan objek outline dan cairan air)
                if (intersects[i].object.userData && 
                    intersects[i].object.userData.x !== undefined && 
                    intersects[i].object !== this.blockOutline &&
                    intersects[i].object.userData.type !== 'water_source' &&
                    intersects[i].object.userData.type !== 'water_flow') {
                    
                    hit = intersects[i];
                    break;
                }
            }

            // Kalo jarak bidik di bawah 6 meter dan ketemu balok padat, nyalakan outline!
            if (hit && hit.distance <= 6) {
                const blockX = Math.round(hit.object.userData.x);
                const blockY = Math.round(hit.object.userData.y);
                const blockZ = Math.round(hit.object.userData.z);

                // Geser posisi rangka kawat hitam tepat membungkus blok yang lagi lu bidik
                this.blockOutline.position.set(blockX, blockY, blockZ);
                this.blockOutline.visible = true; // Munculkan garis!
            } else {
                this.blockOutline.visible = false; // Matikan garis kalo kejauhan
            }
        } else {
            this.blockOutline.visible = false; // Matikan garis kalo ngarah ke langit kosong
        }
    }
}