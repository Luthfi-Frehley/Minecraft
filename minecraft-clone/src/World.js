const THREE = window.THREE;

export class World {
    constructor(scene) {
        this.scene = scene;
        this.blocks = new Map(); 
        this.meshList = [];      
        
        this.chunkSize = 16;     
        this.geometry = new THREE.BoxGeometry(1, 1, 1);
        
        // --- PRE-CALCULATE GEOMETRI AIR KUSTOM PER PIKSEL ---
        // Kita generate cache geometry dari tinggi 31 piksel sampai 7 piksel (step turun 3)
        this.waterGeometries = {};
        for (let pixelHeight = 31; pixelHeight >= 4; pixelHeight -= 3) {
            const scaleY = pixelHeight / 32;
            this.waterGeometries[pixelHeight] = new THREE.BoxGeometry(1, scaleY, 1);
        }

        const loader = new THREE.TextureLoader();
        const loadTex = (path) => {
            const tex = loader.load(path);
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            return tex;
        };

        this.texGrassAtas  = loadTex('texture/Tanah_Atas.png');
        this.texGrassSamp  = loadTex('texture/Tanah_Samping.png');
        this.texDirt       = loadTex('texture/Tanah.png');
        this.texStone      = loadTex('texture/Batu.png');
        this.texWoodAtas   = loadTex('texture/Kayu_Atas.png');
        this.texWoodSamp   = loadTex('texture/Kayu_Samping.png');
        this.texLeaves     = loadTex('texture/Daun.png');
        this.texSand       = loadTex('texture/Pasir.png');
        this.texWater      = loadTex('texture/Air_Diam.png'); 

        this.materials = {
            grass: [
                new THREE.MeshLambertMaterial({ map: this.texGrassSamp }),
                new THREE.MeshLambertMaterial({ map: this.texGrassSamp }),
                new THREE.MeshLambertMaterial({ map: this.texGrassAtas }),
                new THREE.MeshLambertMaterial({ map: this.texDirt }),
                new THREE.MeshLambertMaterial({ map: this.texGrassSamp }),
                new THREE.MeshLambertMaterial({ map: this.texGrassSamp })
            ],
            dirt: new THREE.MeshLambertMaterial({ map: this.texDirt }),
            stone: new THREE.MeshLambertMaterial({ map: this.texStone }),
            wood: [
                new THREE.MeshLambertMaterial({ map: this.texWoodSamp }),
                new THREE.MeshLambertMaterial({ map: this.texWoodSamp }),
                new THREE.MeshLambertMaterial({ map: this.texWoodAtas }),
                new THREE.MeshLambertMaterial({ map: this.texWoodAtas }),
                new THREE.MeshLambertMaterial({ map: this.texWoodSamp }),
                new THREE.MeshLambertMaterial({ map: this.texWoodSamp })
            ],
            leaves: new THREE.MeshLambertMaterial({ map: this.texLeaves, transparent: true }),
            sand: new THREE.MeshLambertMaterial({ map: this.texSand }),
            water: new THREE.MeshLambertMaterial({ map: this.texWater, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
        };

        this.waterLevel = 1; 
        this.isGenerating = false; 
    }

    getKey(x, y, z) {
        return `${x},${y},${z}`;
    }

    getHeight(x, z) {
        const mountainWave = Math.sin(x * 0.02) * Math.cos(z * 0.02) * 12;
        const hillWave = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2;
        const riverBase = Math.cos(x * 0.04 + z * 0.03) * 6;
        
        let finalHeight = Math.round(5 + mountainWave + hillWave);
        if (riverBase < -2) finalHeight += Math.round(riverBase * 1.5);
        return finalHeight;
    }

    generateChunk(cx, cz) {
        const startX = cx * this.chunkSize;
        const startZ = cz * this.chunkSize;

        for (let x = startX; x < startX + this.chunkSize; x++) {
            for (let z = startZ; z < startZ + this.chunkSize; z++) {
                const targetY = this.getHeight(x, z);
                
                let surfaceBlock = 'grass';
                if (targetY <= this.waterLevel + 1) surfaceBlock = 'sand';

                if (targetY >= this.waterLevel) {
                    this.addBlock(x, targetY, z, surfaceBlock);
                } else {
                    this.addBlock(x, targetY, z, 'sand');
                }

                if (targetY < this.waterLevel) {
                    for (let wY = targetY + 1; wY <= this.waterLevel; wY++) {
                        this.addBlock(x, wY, z, 'water_source');
                    }
                }
                
                for (let y = targetY - 1; y >= targetY - 2; y--) this.addBlock(x, y, z, 'dirt');
                for (let y = targetY - 3; y >= targetY - 8; y--) this.addBlock(x, y, z, 'stone');

                if (surfaceBlock === 'grass' && Math.random() < 0.02) {
                    this.createTree(x, targetY + 1, z);
                }
            }
        }
    }

    generate() {
        this.isGenerating = true; 
        for (let cx = -1; cx <= 1; cx++) {
            for (let cz = -1; cz <= 1; cz++) {
                this.generateChunk(cx, cz);
            }
        }
        this.isGenerating = false; 

        // Sebarkan aliran air sungai alami setelah seluruh peta awal kelar ke-load
        this.blocks.forEach((mesh, key) => {
            if (mesh.userData.type === 'water_source') {
                const { x, y, z } = mesh.userData;
                this.triggerWaterFlowAround(x, y, z, key, 31); // Mulai dari 31 piksel sesuai request!
            }
        });
    }

    createTree(trunkX, trunkStartY, trunkZ) {
        const treeHeight = Math.floor(Math.random() * 2) + 4; 
        for (let i = 0; i < treeHeight; i++) this.addBlock(trunkX, trunkStartY + i, trunkZ, 'wood');
        const leavesStartY = trunkStartY + treeHeight - 2;
        for (let ly = leavesStartY; ly <= trunkStartY + treeHeight; ly++) {
            const radius = ly === trunkStartY + treeHeight ? 1 : 2; 
            for (let lx = -radius; lx <= radius; lx++) {
                for (let lz = -radius; lz <= radius; lz++) {
                    if (lx === 0 && lz === 0 && ly < trunkStartY + treeHeight) continue;
                    this.addBlock(trunkX + lx, ly, trunkZ + lz, 'leaves');
                }
            }
        }
    }

    addBlock(x, y, z, type = 'grass') {
        const key = this.getKey(x, y, z);
        
        if (this.blocks.has(key)) {
            const existingBlock = this.blocks.get(key);
            if (this.isGenerating && (type === 'water_source' || type === 'water_flow') && existingBlock.userData.type === 'sand') {
                // Jangan timpa pasir pantai bawah air bawaan map
            } else if (existingBlock.userData.type === 'water_flow' || existingBlock.userData.type === 'water_source') {
                this.removeWaterLogic(x, y, z);
            } else if (type === 'water_source' || type === 'water_flow') {
                return; 
            } else {
                this.scene.remove(existingBlock);
                this.blocks.delete(key);
                this.meshList = this.meshList.filter(m => m !== existingBlock);
            }
        }

        let currentGeometry = this.geometry;
        let matType = type;
        let yOffset = 0;
        let initialPixels = 0;
        
        if (type === 'water_source') {
            currentGeometry = this.waterGeometries[31]; // Pakai geometri kustom 31 piksel (Ada gap 1 piksel dari atas!)
            matType = 'water';
            initialPixels = 31;
            yOffset = -0.015625; // Turunin dikit mesh-nya (0.5 / 32) biar nempel di dasar lantai bawah
        }

        const material = this.materials[matType] || this.materials.grass;
        const mesh = new THREE.Mesh(currentGeometry, material);
        
        mesh.position.set(x, y + yOffset, z);
        mesh.userData = { x, y, z, type, parentSource: null, pixels: initialPixels }; 
        
        this.scene.add(mesh);
        this.blocks.set(key, mesh);
        
        if (type !== 'water_source' && type !== 'water_flow') {
            this.meshList.push(mesh); 
        }

        if (!this.isGenerating) {
            this.checkSandGravity(x, y, z);
        }
        
        if (type === 'water_source' && !this.isGenerating) {
            this.triggerWaterFlowAround(x, y, z, key, 31); 
        }
    
    }

    removeBlock(x, y, z) {
        const key = this.getKey(x, y, z);
        if (this.blocks.has(key)) {
            const mesh = this.blocks.get(key);
            if (mesh.userData.type === 'water_source' || mesh.userData.type === 'water_flow') return;

            this.meshList = this.meshList.filter(m => m !== mesh);
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            this.blocks.delete(key);
            mesh.parent = null;

            setTimeout(() => {
                this.checkSandGravity(x, y + 1, z); 
                this.triggerWaterFlowAround(x, y, z, null, 0); 
            }, 50);
        }
    }

    removeWaterLogic(x, y, z) {
        const key = this.getKey(x, y, z);
        if (this.blocks.has(key)) {
            const mesh = this.blocks.get(key);
            this.scene.remove(mesh);
            this.blocks.delete(key);
            mesh.parent = null;
        }
    }

    checkSandGravity(x, y, z) {
        const currentKey = this.getKey(x, y, z);
        if (!this.blocks.has(currentKey)) return;

        const mesh = this.blocks.get(currentKey);
        if (mesh.userData.type === 'sand') {
            const belowKey = this.getKey(x, y - 1, z);
            const blockBelow = this.blocks.get(belowKey);
            
            const isBelowLiquidOrEmpty = !this.blocks.has(belowKey) || 
                                         (blockBelow && (blockBelow.userData.type === 'water_source' || blockBelow.userData.type === 'water_flow'));

            if (isBelowLiquidOrEmpty) {
                if (blockBelow) this.removeWaterLogic(x, y - 1, z); 

                this.meshList = this.meshList.filter(m => m !== mesh);
                this.blocks.delete(currentKey);

                mesh.position.y -= 1;
                mesh.userData.y -= 1;

                const newKey = this.getKey(x, y - 1, z);
                this.blocks.set(newKey, mesh);
                this.meshList.push(mesh);

                setTimeout(() => {
                    this.checkSandGravity(x, y - 1, z);
                    this.triggerWaterFlowAround(x, y, z, null, 0);
                }, 100);
            }
        }
    }

    // ---- LOGIC FLUID DYNAMICS: MAX 8 ALIRAN & SUSUT CONSTANT PAKE STEP 3 PIKSEL ----
    triggerWaterFlowAround(x, y, z, parentKey, currentPixels) {
        if (!parentKey) {
            const dirs = [{x:1,z:0}, {x:-1,z:0}, {x:0,z:1}, {x:0,z:-1}];
            dirs.forEach(d => {
                const nKey = this.getKey(x + d.x, y, z + d.z);
                const neighbor = this.blocks.get(nKey);
                if (neighbor && (neighbor.userData.type === 'water_source' || neighbor.userData.type === 'water_flow')) {
                    const nextPix = neighbor.userData.type === 'water_source' ? 28 : neighbor.userData.pixels - 3;
                    if (nextPix >= 4) this.flowWaterInto(x, y, z, nKey, nextPix);
                }
            });
            return;
        }

        // Susutkan setebal 3 piksel untuk setiap langkah aliran horizontal baru
        let nextPixels = 28; // Langkah ke-1 dari pusat (31 -> 28)
        if (parentKey.includes("flow")) {
            nextPixels = currentPixels - 3; 
        }

        if (nextPixels < 4) return; // Batasi total aliran maksimal 8 langkah (Mentok di sisa 7 piksel!)

        const directions = [
            {x: 1, z: 0}, {x: -1, z: 0},
            {x: 0, z: 1}, {x: 0, z: -1}
        ];

        directions.forEach(dir => {
            this.flowWaterInto(x + dir.x, y, z + dir.z, parentKey, nextPixels);
        });
    }

    flowWaterInto(x, y, z, parentKey, pixels) {
        const targetKey = this.getKey(x, y, z);
        
        if (this.blocks.has(targetKey)) {
            const block = this.blocks.get(targetKey);
            if (block.userData.type === 'water_flow' && block.userData.pixels < pixels) {
                this.removeWaterLogic(x, y, z);
            } else {
                return; 
            }
        } 
        
        if (y > this.waterLevel) return;

        const currentGeometry = this.waterGeometries[pixels] || this.waterGeometries[4];
        const material = this.materials['water'];
        const mesh = new THREE.Mesh(currentGeometry, material);
        
        // Atur offset visual Y biar dasar air tipis lu bener-bener menapak rapat di lantai bawah
        const scaleY = pixels / 32;
        const yOffset = -(1 - scaleY) / 2;
        
        mesh.position.set(x, y + yOffset, z);
        mesh.userData = { x, y, z, type: 'water_flow', parentSource: parentKey, pixels: pixels }; 

        this.scene.add(mesh);
        this.blocks.set(targetKey, mesh);

        const belowKey = this.getKey(x, y - 1, z);
        if (!this.blocks.has(belowKey)) {
            setTimeout(() => {
                // Efek air terjun vertikal deras: Ketinggian level air di-reset full lagi ke pusat 31 piksel
                this.flowWaterInto(x, y - 1, z, `flow_${targetKey}`, 31); 
            }, 80);
        } else {
            setTimeout(() => {
                this.triggerWaterFlowAround(x, y, z, `flow_${targetKey}`, pixels);
            }, 80);
        }
    }

    checkSourceDestruction(sourceKey) {
        this.blocks.forEach((mesh, key) => {
            if (mesh.userData.type === 'water_flow' && mesh.userData.parentSource && mesh.userData.parentSource.includes(sourceKey)) {
                const { x, y, z } = mesh.userData;
                this.removeWaterLogic(x, y, z); 
            }
        });
    }
}