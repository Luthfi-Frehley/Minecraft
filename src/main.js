import { World } from './World.js';
import { Controls } from './Controls.js';
import { Interaction } from './Interaction.js';
import { ShadowManager } from './ShadowManager.js'; // Import file baru

let scene, camera, renderer, world, controls, interaction;
let clock = new THREE.Clock();

// Variabel global menampung objek Matahari 3D
let sunCube; 

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Biru langit Alpha
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(10, 20, 15);
    scene.add(directionalLight);

    // 1. Jalankan load world chunk murni
    world = new World(scene);
    world.generate();

    // 2. Load modul kontroler gerakan
    controls = new Controls(camera, renderer.domElement, world);
    
    // 3. Set titik awal spawn kamera aman
    const spawnY = world.getHeight(0, 0) + 1.8 + 1.0; 
    controls.getObject().position.set(0, spawnY, 0); 
    scene.add(controls.getObject());

    // 4. Hubungkan interaksi klik dengan menyertakan modul kontroler
    interaction = new Interaction(camera, scene, world, controls); 

    // ---- SUN & CLOUDS EDISI FULL 3D FIXED ----
    create3DSun();
    create3DStaticClouds();

    window.addEventListener('resize', onWindowResize);

    animate();

    
}

// --- FUNGSI GENERATOR MATAHARI KUBUS 3D FIX TEXTURE & DEKAT ---
function create3DSun() {
    const texLoader = new THREE.TextureLoader();
    const sunTexture = texLoader.load('texture/matahari.png');
    
    sunTexture.magFilter = THREE.NearestFilter;
    sunTexture.minFilter = THREE.NearestFilter;

    const sunMaterial = new THREE.MeshBasicMaterial({ 
        map: sunTexture, 
        transparent: true 
    });

    const materials = [
        sunMaterial, // Sisi Kanan (+X)
        sunMaterial, // Sisi Kiri (-X)
        sunMaterial, // Sisi Atas (+Y)
        sunMaterial, // Sisi Bawah (-Y)
        sunMaterial, // Sisi Depan (+Z)
        sunMaterial, // Sisi Belakang (-Z)
    ];

    const sunGeometry = new THREE.BoxGeometry(10, 10, 10); 
    sunCube = new THREE.Mesh(sunGeometry, materials);

    // Letak pas melayang megah tepat di atas lapisan awan 3D lu!
    sunCube.position.set(20, 60, -25);
    
    sunCube.rotation.x = 0.5;
    sunCube.rotation.y = 0.5;
    
    scene.add(sunCube);
}

// --- FUNGSI GENERATOR GUGUSAN AWAN BALOK 3D TEBAL ---
function create3DStaticClouds() {
    const cloudMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.65, 
        side: THREE.DoubleSide
    });

    for (let i = 0; i < 20; i++) {
        const cloudW = Math.floor(Math.random() * 10) + 8; 
        const cloudH = 1.5;                                
        const cloudD = Math.floor(Math.random() * 10) + 8; 

        const cloudGeometry = new THREE.BoxGeometry(cloudW, cloudH, cloudD);
        const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);

        const cloudX = (Math.random() - 0.5) * 80;
        const cloudY = 42 + (Math.random() * 2); 
        const cloudZ = (Math.random() - 0.5) * 80;

        cloudMesh.position.set(cloudX, cloudY, cloudZ);
        scene.add(cloudMesh);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ---- LOOP ANIMASI UTAMA GAME ----
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime(); // Ambil data detik berjalan konstan
    
    controls.update(delta);

    // 1. Jalankan animasi putar pelan kubus matahari 3D
    if (sunCube) {
        sunCube.rotation.y += 0.05 * delta;
    }

    // 2. ANIMASI REALTIME OMBAK AIR (BERDASARKAN DATA WATER.JSON LU)
    // Kita panggil data wave settings: frequency=1.0, speed=2.0 dari config lu
    if (world && world.blocks) {
        world.blocks.forEach((mesh, key) => {
            if (mesh.userData.type === 'water_source' || mesh.userData.type === 'water_flow') {
                const basePositionBoxY = mesh.userData.y; // Koordinat Y grid murni
                
                // Cari rumus offset visual awal bawaan kasta air tipis
                let baseOffset = 0;
                if (mesh.userData.type === 'water_flow') {
                    const scaleY = mesh.userData.pixels / 32;
                    baseOffset = -(1 - scaleY) / 2;
                } else {
                    baseOffset = -0.015625; // Offset pusat 31 piksel
                }

                // Formula Gelombang Sinus murni memanfaatkan data frequency (1.0) dan speed (2.0)
                // Tinggi ombak dibuat tipis saja (0.04) biar airnya ga meluap nembus daratan pasir pantai
                const waveFormula = Math.sin((elapsedTime * 2.0) + (mesh.userData.x * 1.0) + (mesh.userData.z * 1.0)) * 0.04;
                
                // Update posisi tinggi mesh secara realtime per frame
                mesh.position.y = basePositionBoxY + baseOffset + waveFormula;
            }
        });
    }

    // 3. Ambil data update pendeteksi kotak bidik outline
    if (interaction && typeof interaction.updateOutline === 'function') {
        interaction.updateOutline();
    }

    renderer.render(scene, camera);
}

init();