const THREE = window.THREE;

export class Controls {
    constructor(camera, domElement, world) {
        this.camera = camera;
        this.domElement = domElement;
        this.world = world;
        
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        this.isHoldingSpace = false; 
        
        // --- STATE SPRINT & CROUCH ---
        this.isSprinting = false;
        this.isCrouching = false;
        
        this.activeSlot = 0;
        this.slotTypes = ['grass', 'dirt', 'stone', 'wood', 'leaves', 'sand', 'grass', 'grass', 'grass'];
        
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        
        this.playerHeight = 1.8; 
        this.defaultFOV = camera.fov; 
        
        this.pitchObject = new THREE.Object3D();
        this.pitchObject.add(camera);
        
        this.yawObject = new THREE.Object3D();
        this.yawObject.position.set(0, 15, 0); 
        this.yawObject.add(this.pitchObject);
        
        this.initListeners();
    }

    initListeners() {
        this.domElement.addEventListener('click', () => {
            this.domElement.requestPointerLock();
        });

        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement !== this.domElement) return;
            this.yawObject.rotation.y -= e.movementX * 0.0025;
            this.pitchObject.rotation.x -= e.movementY * 0.0025;
            this.pitchObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitchObject.rotation.x));
        });

        document.addEventListener('keydown', (e) => {
            if (e.code.startsWith('Digit')) {
                const num = parseInt(e.code.replace('Digit', ''));
                if (num >= 1 && num <= 9) {
                    this.activeSlot = num - 1;
                    const slots = document.querySelectorAll('.slot');
                    slots.forEach((slot, index) => {
                        if (index === this.activeSlot) slot.classList.add('active');
                        else slot.classList.remove('active');
                    });
                }
            }

            switch (e.code) {
                case 'KeyW': this.moveForward = true; break;
                case 'KeyS': this.moveBackward = true; break;
                case 'KeyA': this.moveLeft = true; break;
                case 'KeyD': this.moveRight = true; break;
                case 'Space': 
                    this.isHoldingSpace = true;
                    if (this.canJump === true && !this.isInWater) {
                        this.velocity.y = this.isCrouching ? 5.5 : 7.5; 
                        this.canJump = false;
                    }
                    break;
                
                // TOMBOL SPRINT: Shift Kiri
                case 'ShiftLeft':
                    if (this.moveForward && !this.isCrouching) {
                        this.isSprinting = true;
                    }
                    break;
                
                // TOMBOL CROUCH: Ctrl Kiri
                case 'ControlLeft':
                    this.isCrouching = true;
                    this.isSprinting = false;
                    this.playerHeight = 1.4; 
                    break;
            }
        });

        document.addEventListener('keyup', (e) => {
            switch (e.code) {
                case 'KeyW': 
                    this.moveForward = false; 
                    this.isSprinting = false; 
                    break;
                case 'KeyS': this.moveBackward = false; break;
                case 'KeyA': this.moveLeft = false; break;
                case 'KeyD': this.moveRight = false; break;
                case 'Space': 
                    this.isHoldingSpace = false; 
                    break;
                case 'ShiftLeft':
                    this.isSprinting = false;
                    break;
                case 'ControlLeft':
                    this.isCrouching = false;
                    this.playerHeight = 1.8; 
                    break;
            }
        });
    }

    getActiveBlockType() {
        return this.slotTypes[this.activeSlot];
    }

    update(delta) {
        if (document.pointerLockElement !== this.domElement) return;

        const playerX = Math.round(this.yawObject.position.x);
        const playerZ = Math.round(this.yawObject.position.z);
        const currentFeetY = Math.floor(this.yawObject.position.y - this.playerHeight + 0.05);
        const currentHeadY = Math.floor(this.yawObject.position.y + 0.2);

        const blockAtFeet = this.world.blocks.get(`${playerX},${currentFeetY},${playerZ}`);
        this.isInWater = (blockAtFeet && blockAtFeet.userData && blockAtFeet.userData.type === 'water');

        // ---- SET KECEPATAN BERDASARKAN STATE ----
        let moveSpeed = 40.0;
        if (this.isInWater) {
            moveSpeed = 15.0; 
        } else if (this.isSprinting) {
            moveSpeed = 65.0; 
        } else if (this.isCrouching) {
            moveSpeed = 18.0; 
        }

        // --- EFFECT VISUAL: FOV PAS SPRINT ---
        if (this.isSprinting && this.moveForward) {
            if (this.camera.fov < this.defaultFOV + 8) {
                this.camera.fov += 40 * delta;
                this.camera.updateProjectionMatrix();
            }
        } else {
            if (this.camera.fov > this.defaultFOV) {
                this.camera.fov -= 40 * delta;
                this.camera.updateProjectionMatrix();
            }
        }
        
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        
        if (this.isInWater) {
            this.velocity.y -= 3.0 * delta; 
            if (this.velocity.y < -1.5) this.velocity.y = -1.5;
            if (this.isHoldingSpace) this.velocity.y = 2.5; 
        } else {
            this.velocity.y -= 9.8 * 2.5 * delta; 
        }

        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();

        const oldX = this.yawObject.position.x;
        const oldZ = this.yawObject.position.z;

        if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * moveSpeed * delta;
        if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * moveSpeed * delta;

        // ---- KUNCI UTAMA: SNEAK EDGE PROTECTION (ANTI-FALL JONGKOK) ----
        if (this.isCrouching && this.velocity.y <= 0) {
            // Cek prediksi langkah horizontal di frame selanjutnya
            const nextXFrame = -this.velocity.x * delta;
            const nextZFrame = this.velocity.z * delta;

            // Kloning objek posisi global untuk simulasi melangkah
            const tempObject = this.yawObject.clone();
            tempObject.translateX(nextXFrame);
            tempObject.translateZ(nextZFrame);

            const nextGlobalX = Math.round(tempObject.position.x);
            const nextGlobalZ = Math.round(tempObject.position.z);
            const checkBelowY = Math.floor(this.yawObject.position.y - this.playerHeight - 0.1);

            // Cek kondisi balok di bawah langkah masa depan tersebut
            const blockBelowNextStep = this.world.blocks.get(`${nextGlobalX},${checkBelowY},${nextGlobalZ}`);
            const isNextStepVoid = !blockBelowNextStep || blockBelowNextStep.userData.type === 'water_source' || blockBelowNextStep.userData.type === 'water_flow';

            // Kalo di bawahnya terdeteksi void/jurang kosong/air, rem paksa gerakannya!
            if (isNextStepVoid) {
                this.velocity.x = 0;
                this.velocity.z = 0;
            }
        }

        // Terapkan translasi koordinat setelah lolos sensor pengaman rem tebing
        this.yawObject.translateX(-this.velocity.x * delta);
        this.yawObject.translateZ(this.velocity.z * delta);
        this.yawObject.position.y += this.velocity.y * delta;

        // FIXED ANTI-STUCK SYSTEM
        const checkFeetBlock = this.world.blocks.get(`${playerX},${currentFeetY + 1},${playerZ}`);
        const checkBodyBlock = this.world.blocks.get(`${playerX},${currentFeetY + 2},${playerZ}`);
        
        const isFeetSolid = checkFeetBlock && checkFeetBlock.userData.type !== 'water';
        const isBodySolid = checkBodyBlock && checkBodyBlock.userData.type !== 'water';

        if (isFeetSolid && isBodySolid) {
            this.yawObject.position.y = Math.floor(this.yawObject.position.y) + 1.0 + this.playerHeight;
            this.velocity.y = 0;
        } 
        else if (isFeetSolid || isBodySolid) {
            this.yawObject.position.x = oldX;
            this.yawObject.position.z = oldZ;
            this.velocity.x = 0;
            this.velocity.z = 0;
        }

        // Cek Kepentok Atas
        if (this.world.blocks.has(`${playerX},${currentHeadY},${playerZ}`)) {
            const topBlock = this.world.blocks.get(`${playerX},${currentHeadY},${playerZ}`);
            if (topBlock && topBlock.userData.type !== 'water') {
                if (this.velocity.y > 0) {
                    this.velocity.y = 0; 
                    this.yawObject.position.y = currentHeadY - 0.21;
                }
            }
        }

        // Cek Pijakan Kaki Tanah
        let terrainY = -999;
        for (let y = currentFeetY; y >= currentFeetY - 3; y--) {
            const block = this.world.blocks.get(`${playerX},${y},${playerZ}`);
            if (block && block.userData.type !== 'water') {
                terrainY = y;
                break;
            }
        }

        const floorY = terrainY + 0.5 + this.playerHeight;
        
        if (this.yawObject.position.y <= floorY && this.yawObject.position.y > floorY - 0.6) {
            if (this.velocity.y <= 0) {
                this.velocity.y = 0;
                this.yawObject.position.y = floorY;
                this.canJump = true; 
            }
        } else if (this.yawObject.position.y < floorY - 0.6) {
            if (!this.isInWater) this.canJump = false; 
        }
    }

    getObject() {
        return this.yawObject;
    }
}