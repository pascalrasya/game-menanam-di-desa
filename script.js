const WORLD_SIZE = 400;
const RIVER_CENTER_X = -60;
const RIVER_SAFE_HALF_WIDTH = 11;
let scene, camera, renderer, sun;
let cloudsGroup, starsGroup, skyMoon;
let lastEventDay = 0;
let player, playerVelocity, isGrounded = true;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let prevTime = performance.now();

let isGamePaused = false;

let ambienceAudio = {
    tracks: null,
    activeArea: null,
    muted: false,
    volume: 0.35,
    started: false
};

function startAmbience() {
    if (!ambienceAudio.tracks) {
        ambienceAudio.tracks = {
            village: new Audio('audio/Isaac_Stern_-_Humoresque_No._7_Op._101_Anton_n_Dvo_k_(mp3.pm).mp3'),
            mine: new Audio('audio/David_Nevue_-_Solitude_(mp3.pm).mp3'),
            dungeon: new Audio('audio/Amethystium_-_Avalon_(mp3.pm).mp3')
        };
        Object.values(ambienceAudio.tracks).forEach(track => {
            track.loop = true;
            track.preload = 'auto';
            track.volume = ambienceAudio.volume;
        });
    }
    ambienceAudio.started = true;
    updateAmbienceArea();
}

function updateAmbienceArea() {
    if (!ambienceAudio.tracks) return;
    const area = dungeonState.active ? 'dungeon' : mineState.active ? 'mine' : 'village';
    if (ambienceAudio.activeArea === area) return;
    const previousTrack = ambienceAudio.activeArea ? ambienceAudio.tracks[ambienceAudio.activeArea] : null;
    if (previousTrack) {
        previousTrack.pause();
        previousTrack.currentTime = 0;
    }
    ambienceAudio.activeArea = area;
    if (!ambienceAudio.muted) ambienceAudio.tracks[area].play().catch(() => {});
}

function toggleAmbience() {
    if (!ambienceAudio.tracks) startAmbience();
    ambienceAudio.muted = !ambienceAudio.muted;
    const activeTrack = ambienceAudio.activeArea ? ambienceAudio.tracks[ambienceAudio.activeArea] : null;
    if (ambienceAudio.muted) {
        if (activeTrack) activeTrack.pause();
    } else if (activeTrack) {
        activeTrack.play().catch(() => {});
    }
    document.getElementById('audio-toggle-btn').innerText = ambienceAudio.muted ? '🔇' : '🔊';
}

function setAmbienceVolume(value) {
    ambienceAudio.volume = Number(value);
    if (ambienceAudio.tracks) {
        Object.values(ambienceAudio.tracks).forEach(track => { track.volume = ambienceAudio.volume; });
    }
}

let stats = {
    level: 1, exp: 0, nextExp: 50,
    hp: 100, maxHp: 100,
    stamina: 100, maxStamina: 100,
    magicFruits: { dungeon: false, mine: false, quest: false, hidden: false },
    gold: 100, wood: 0, stone: 0, copper: 0, silver: 0, oreGold: 0, diamond: 0, crop: 0, seeds: 3, fodderSeeds: 3, fodder: 2, potion: 1,
    milk: 0, egg: 0, wool: 0,
    hasSword: false, swordDamage: 15,
    axeLvl: 1, pickLvl: 1,
    
    // Fitur Memancing Baru
    hasFishingRod: false,
    baitCount: 0,
    fishes: {
        mujair: 0,
        lele: 0,
        emas: 0,
        toman: 0
    },

    day: 1, hour: 6, minute: 0,
    
    // Status Bangunan Kandang, Silo, & Jumlah Ternak
    hasChickenCoop: false,
    hasBigCoop: false,
    hasSilo: false,
    siloStorage: 0,
    siloMaxStorage: 50,
    chickensCount: 0,
    cowsCount: 0,
    sheepsCount: 0,
    totalProduceCount: 0,
    // Hubungan warga desa
    friendship: { walidesa: 0, mamat: 0, siti: 0, dudung: 0, jaja: 0 },
    giftGiven: {},
    partner: null
};

let storyStep = 0;
let questData = [
    { title: "1. Kunjungan Pertama", desc: "Temui Walidesa di dekat pusat lapangan untuk melaporkan kedatanganmu.", target: "walidesa", progress: () => "Bicara dengan Walidesa" },
    { title: "2. Pembangunan Desa", desc: "Kumpulkan bahan untuk memperbaiki fasilitas desa yang rusak.", woodNeeded: 4, stoneNeeded: 4, progress: () => `Kayu: ${stats.wood}/4 | Batu: ${stats.stone}/4` },
    { title: "3. Ketahanan Pangan", desc: "Cangkul lahan (Tekan 9), tanam benih jagung, lalu panen untuk pasokan pangan desa.", cropNeeded: 2, progress: () => `Panen Jagung: ${stats.crop}/2` },
    { title: "4. Ancaman Serigala", desc: "Beli pedang dari Walidesa lalu kalahkan 1 Serigala Hutan.", monstersKilled: 0, monsterNeeded: 1, progress: () => `Monster Dikalakan: ${questData[3].monstersKilled}/1` },
    { title: "5. Desa Aman, Babak Baru", desc: "Desa sudah aman berkat kamu! Tapi kisahmu belum usai — temui Walidesa untuk melanjutkan misi membesarkan peternakan warisan keluargamu.", progress: () => "Bicara dengan Walidesa untuk misi lanjutan" },
    { title: "6. Investasi Peternakan", desc: "Perbesar peternakan warisanmu. Beli hewan dari Pak Mamat hingga mencapai jumlah berikut.", chickenNeeded: 3, cowNeeded: 2, sheepNeeded: 2, progress: () => `Ayam: ${stats.chickensCount}/3 | Sapi: ${stats.cowsCount}/2 | Domba: ${stats.sheepsCount}/2` },
    { title: "7. Panen Hasil Ternak", desc: "Rawat, beri makan, dan panen hasil ternakmu (telur, susu, wol) sampai peternakan benar-benar produktif.", produceNeeded: 15, progress: () => `Total Hasil Dipanen: ${stats.totalProduceCount}/15` },
    { title: "8. Warisan yang Bangkit", desc: "Peternakanmu sudah sukses besar! Kembali dan bicaralah dengan Walidesa untuk menutup kisahmu.", progress: () => "Bicara dengan Walidesa untuk TAMAT" },
    { title: "9. Kisah Baru Dimulai", desc: "Kamu telah menamatkan kisah utama! Silakan terus bermain bebas mengembangkan peternakanmu sesukamu.", progress: () => "✅ TAMAT — Mode Bebas Bermain" }
];

let activeSlot = 1;
let worldObjects = [];
let monsters = [];
let crops = [];
let farmPlots = [];
let animals = [];
let nameplates = [];
let mountainZones = [];

let chickenCoopMesh = null, bigCoopMesh = null, siloMesh = null;
let chickenFeederMesh = null, bigFeederMesh = null;
let hotSpringGroup = null, hotSpringCooldown = 0;

let npcWalidesa, npcPakMamat, npcNengSiti, npcPamanJaja, npcMangDudung;
let walkingNPCData = [];
let partnerNPCs = [];
let familyNPCs = [];
let houseMesh, farmLandMesh, riverMesh;
let buildingDoors = [];
let buildingColliders = [];
let activeTargetDoor = null;
let interiorGroup = null;
let insideBuilding = false;
let currentBuildingId = null;
let exteriorReturnPosition = new THREE.Vector3();
let interiorNPC = null;
let savedNPCStates = [];
let activeTargetSleep = false;
let sleepBedMesh = null;

// Objek Animasi Memancing
let isFishing = false;
let fishingTimer = 0;
let fishingRodMesh = null;
let fishingLineMesh = null;
let fishingBobberMesh = null;

let dungeonEntranceMesh = null;
let dungeonStairsMesh = null;
let dungeonFloorGroups = [];
let dungeonEnemies = [];
let dungeonState = { active: false, floor: 0, totalFloors: 3, completed: false };
let dungeonLights = [];
let dungeonDeathHandled = false;
let mineEntranceMesh = null;
let mineRoom = null;
let mineStairsMesh = null;
let mineLiftMesh = null;
let mineExitMesh = null;
let mineKeyRock = null;
let mineNodes = [];
let mineFloorLabel = null;
let mineState = { active: false, floor: 0, checkpoint: 1, stairsOpen: false };

let isLocked = false;
let activeTargetNPC = null;
let activeTargetAnimal = null;
let activeTargetObject = null;
let isUIOpen = true;
let interactionEffects = [];
let damageTexts = [];

let textures = {};

function createProceduralTextures() {
    function createNoiseTexture(width, height, drawFn) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        drawFn(ctx, width, height);
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    textures.grass = createNoiseTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#557a2b'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 3000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#4d6e27' : '#5e8730';
            ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
    });
    textures.grass.repeat.set(40, 40);

    textures.water = createNoiseTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#1e90ff'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 400; i++) {
            ctx.globalAlpha = Math.random() * 0.3;
            ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * 20 + 5, 2);
        }
    });
    textures.water.repeat.set(2, 20);

    textures.dirt = createNoiseTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#4e3629'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#3a271d';
        for (let i = 0; i < 1500; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
        ctx.strokeStyle = '#2d1e16'; ctx.lineWidth = 4;
        for (let y = 0; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    });
    textures.dirt.repeat.set(4, 4);

    textures.wood = createNoiseTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#5a3d28'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#3d281a';
        for (let i = 0; i < w; i += 4) ctx.fillRect(i, 0, 2 + Math.random() * 2, h);
    });

    textures.leaves = createNoiseTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#2e5c1e'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#1e3d13';
        for (let i = 0; i < 1000; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    });

    textures.stone = createNoiseTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#7f8c8d'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#515a5b';
        for (let i = 0; i < 800; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    });

    textures.wall = createNoiseTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#8b5a2b'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#5c3a1b'; ctx.lineWidth = 3;
        for (let y = 0; y < h; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    });

    textures.roof = createNoiseTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#c0392b'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#78231a'; ctx.lineWidth = 3;
        for (let y = 0; y < h; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    });

    textures.surfaceDetail = createNoiseTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#f5f5f5'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(80, 80, 80, 0.16)';
        for (let i = 0; i < 700; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        for (let y = 0; y < h; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    });

    textures.wolfFur = createNoiseTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#596575'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#27313d';
        for (let i = 0; i < 800; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 4);
    });

    textures.slimeSkin = createNoiseTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#38b86b'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(190, 255, 160, 0.42)';
        for (let i = 0; i < 120; i++) {
            ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 0, Math.PI * 2); ctx.fill();
        }
    });

    textures.goblinSkin = createNoiseTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#719c52'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#42613a';
        for (let i = 0; i < 500; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 3, 2);
    });

    textures.snakeSkin = createNoiseTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#c77a22'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#704316'; ctx.lineWidth = 3;
        for (let y = -16; y < h + 16; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + 28); ctx.stroke(); }
    });

    textures.bossSkin = createNoiseTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#743d91'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#d35a7d';
        for (let i = 0; i < 180; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 4, 4);
    });

    textures.clothWali = createNoiseTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#2980b9'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#1f618d';
        for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);
    });

    textures.clothMamat = createNoiseTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#27ae60'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#1e8449';
        for (let i = 0; i < 600; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    });

    textures.clothJaja = createNoiseTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#d35400'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#a04000';
        for (let i = 0; i < 500; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    });

    textures.clothDudung = createNoiseTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#16a085'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#117864';
        for (let i = 0; i < 500; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    });

    textures.apronSiti = createNoiseTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#5d4037'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#3e2723';
        for (let i = 0; i < 800; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    });

    textures.strawHat = createNoiseTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#d4ac0d'; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#9a7d0a'; ctx.lineWidth = 2;
        for (let i = 0; i < w; i += 8) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
        }
    });
}

function createSkySystem() {
    cloudsGroup = new THREE.Group();
    for (let i = 0; i < 14; i++) {
        const cloud = new THREE.Group();
        const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.82 });
        const count = 3 + Math.floor(Math.random() * 3);
        for (let j = 0; j < count; j++) {
            const puff = new THREE.Mesh(new THREE.SphereGeometry(2.2 + Math.random()*1.4, 12, 8), mat);
            puff.scale.y = 0.55;
            puff.position.set(j*2.3, Math.random()*0.8, Math.random()*1.2);
            cloud.add(puff);
        }
        cloud.position.set((Math.random()-0.5)*260, 45 + Math.random()*22, (Math.random()-0.5)*180);
        cloud.userData.speed = 1.5 + Math.random()*2.5;
        cloudsGroup.add(cloud);
    }
    scene.add(cloudsGroup);

    starsGroup = new THREE.Group();
    const starGeo = new THREE.BufferGeometry();
    const positions = [];
    for (let i=0;i<450;i++) {
        const r = 180 + Math.random()*100;
        const a = Math.random()*Math.PI*2;
        const y = 55 + Math.random()*120;
        positions.push(Math.cos(a)*r, y, Math.sin(a)*r);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
    const starMat = new THREE.PointsMaterial({ color:0xffffff, size:1.2, sizeAttenuation:false, transparent:true, opacity:.9 });
    starsGroup.add(new THREE.Points(starGeo, starMat));
    starsGroup.visible = false;
    scene.add(starsGroup);
}

function updateSky(delta) {
    if (!cloudsGroup || !starsGroup) return;
    const night = stats.hour >= 19 || stats.hour < 5;
    cloudsGroup.visible = !night;
    starsGroup.visible = night;
    cloudsGroup.children.forEach(c => {
        c.position.x += c.userData.speed * delta;
        if (c.position.x > 150) c.position.x = -150;
    });
}

function getSeason() {
    const d = ((stats.day - 1) % 112) + 1;
    if (d <= 28) return '🌱 Musim Semi';
    if (d <= 56) return '☀️ Musim Panas';
    if (d <= 84) return '🍂 Musim Gugur';
    return '❄️ Musim Dingin';
}

const npcResidents = {
    walidesa: { name:'Walidesa', role:'Kepala Desa', birthdaySeason:'🌱 Musim Semi', birthdayDay:8, favorite:'🌽 Jagung', item:'crop' },
    mamat: { name:'Pak Mamat', role:'Peternak', birthdaySeason:'🌱 Musim Semi', birthdayDay:15, favorite:'🥛 Susu', item:'milk' },
    siti: { name:'Neng Siti', role:'Pandai Besi', birthdaySeason:'☀️ Musim Panas', birthdayDay:5, favorite:'🪨 Batu', item:'stone' },
    dudung: { name:'Mang Dudung', role:'Nelayan', birthdaySeason:'🍂 Musim Gugur', birthdayDay:18, favorite:'🐟 Lele', item:'fish_lele' },
    jaja: { name:'Paman Jaja', role:'Petani Warga', birthdaySeason:'❄️ Musim Dingin', birthdayDay:24, favorite:'🥚 Telur', item:'egg' }
};

const partnerProfiles = [
    { key:'ayu', name:'Ayu Lestari', role:'Penjahit Desa', favorite:'🌽 Jagung', birthdaySeason:'🌱 Musim Semi', birthdayDay:11, shirtColor:0xe67e22, pantsColor:0x6c3483, hairColor:0x3b2416, home:[-18,-34], waypoints:[[-18,-30],[-12,-32],[-12,-38],[-24,-38]], family:[['Bu Rini','Ibu Ayu'],['Dimas','Adik Ayu']] },
    { key:'bunga', name:'Bunga Kirana', role:'Perawat Klinik', favorite:'🥛 Susu', birthdaySeason:'☀️ Musim Panas', birthdayDay:19, shirtColor:0xf5b7b1, pantsColor:0x2471a3, hairColor:0x17202a, home:[36,32], waypoints:[[31,32],[38,27],[43,32],[38,37]], family:[['Pak Raka','Ayah Bunga'],['Nia','Adik Bunga']] },
    { key:'citra', name:'Citra Wulandari', role:'Petani Bunga', favorite:'🪨 Batu', birthdaySeason:'🍂 Musim Gugur', birthdayDay:3, shirtColor:0x27ae60, pantsColor:0x784212, hairColor:0x512e5f, home:[-34,-6], waypoints:[[-38,-6],[-34,-10],[-30,-6],[-34,-2]], family:[['Bu Wati','Ibu Citra'],['Reno','Kakak Citra']] },
    { key:'dewi', name:'Dewi Anggraini', role:'Pemilik Kedai Teh', favorite:'🐟 Lele', birthdaySeason:'❄️ Musim Dingin', birthdayDay:9, shirtColor:0x3498db, pantsColor:0x922b21, hairColor:0x1b2631, home:[48,18], waypoints:[[44,18],[49,14],[53,18],[49,22]], family:[['Pak Surya','Ayah Dewi'],['Lala','Adik Dewi']] },
    { key:'elisa', name:'Elisa Maharani', role:'Penjaga Perpustakaan', favorite:'🥚 Telur', birthdaySeason:'🌱 Musim Semi', birthdayDay:26, shirtColor:0x8e44ad, pantsColor:0x1b4f72, hairColor:0x641e16, home:[-50,-34], waypoints:[[-46,-30],[-54,-30],[-54,-38],[-46,-40]], family:[['Bu Maya','Ibu Elisa'],['Fajar','Adik Elisa']] }
];

partnerProfiles.forEach(profile => {
    npcResidents[profile.key] = { name: profile.name, role: profile.role, birthdaySeason: profile.birthdaySeason, birthdayDay: profile.birthdayDay, favorite: profile.favorite, item: profile.favorite === '🥛 Susu' ? 'milk' : profile.favorite === '🪨 Batu' ? 'stone' : profile.favorite === '🐟 Lele' ? 'fish_lele' : profile.favorite === '🥚 Telur' ? 'egg' : 'crop' };
    stats.friendship[profile.key] = 0;
});

const partnerDialogueLines = {
    ayu: ['"Kain baru sedang kupotong. Desa ini akan penuh warna kalau semua orang mau merawatnya."', '"Aku suka melihatmu datang dari jalan setapak. Rasanya desa ini jadi lebih ramai."', '"Kalau kau punya waktu, bantu aku memilih warna untuk pakaian festival."'],
    bunga: ['"Klinik hari ini tenang. Jangan lupa menjaga stamina, petualang juga perlu istirahat."', '"Aku selalu membawa perban dan teh hangat untuk warga yang kelelahan."', '"Senyummu lebih sehat daripada obat mana pun yang ada di rakku."'],
    citra: ['"Bunga-bunga di kebunku mekar paling indah saat disiram dengan sabar."', '"Tanah yang baik mengajarkan kita bahwa hasil besar perlu waktu."', '"Aku sedang mencari bibit baru. Mungkin kita bisa menanamnya bersama."'],
    dewi: ['"Teh sore ini memakai daun pilihan dari bukit sebelah. Harumnya menenangkan, bukan?"', '"Kedai ramai saat senja. Cerita warga adalah bumbu terbaik untuk secangkir teh."', '"Kalau hari terasa berat, duduklah sebentar. Tidak semua hal harus dikejar."'],
    elisa: ['"Buku-buku di perpustakaan menyimpan cerita lama tentang desa ini."', '"Aku sedang menyusun rak sejarah. Nama baikmu mungkin akan masuk di sana."', '"Hening di perpustakaan bukan berarti sepi. Banyak pikiran sedang tumbuh di sini."']
};

function getMonthDay() { return ((stats.day - 1) % 28) + 1; }
function getSeasonIndex() { return Math.floor(((stats.day - 1) % 112) / 28); }
function seasonNameByIndex(i) { return ['🌱 Musim Semi','☀️ Musim Panas','🍂 Musim Gugur','❄️ Musim Dingin'][i % 4]; }
function getBirthdayForDate(day, seasonIndex = getSeasonIndex()) {
    return Object.entries(npcResidents).filter(([key,n]) => n.birthdayDay === day && seasonNameByIndex(seasonIndex) === n.birthdaySeason);
}
function getBirthdayToday() { return getBirthdayForDate(getMonthDay()); }

const villageEvents = {
    7:  { name:'🛍️ Pasar Desa', desc:'Warga berkumpul di pusat desa. Semua pembelian dari toko mendapat diskon 10%.', bonus:'shopDiscount' },
    14: { name:'🌽 Festival Panen', desc:'Festival panen diadakan di desa. Kamu mendapatkan +30 Gold saat memulai hari.', bonus:'gold' },
    21: { name:'🎣 Lomba Memancing', desc:'Hari terbaik untuk memancing! Setiap ikan yang didapat memberi +10 Gold.', bonus:'fishing' },
    28: { name:'🌅 Festival Desa Senja', desc:'Perayaan akhir bulan. Kamu mendapatkan +50 Gold dan EXP tambahan.', bonus:'senja' }
};

const shopClosingDays = {
    walidesa: 6,
    mamat: 1,
    siti: 3,
    dudung: 0
};

function getWeekdayIndex(day = stats.day) {
    return (day - 1) % 7;
}

function getWeekdayName(day = stats.day) {
    return ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'][(day - 1) % 7];
}

function getShopOwnerKey(type) {
    if (type === 'walidesa') return 'walidesa';
    if (type === 'dudung') return 'dudung';
    if (type === 'siti') return 'siti';
    if (type === 'mamat_coop' || type === 'mamat_livestock' || type === 'mamat_shop') return 'mamat';
    return null;
}

function getShopClosingDay(type) {
    const ownerKey = getShopOwnerKey(type);
    return ownerKey === null ? null : shopClosingDays[ownerKey];
}

function getTodayEvent() { return villageEvents[((stats.day-1)%28)+1] || null; }

function processDailyEvent() {
    if (lastEventDay === stats.day) return;
    lastEventDay = stats.day;
    const event = getTodayEvent();
    if (!event) return;
    if (event.bonus === 'gold') stats.gold += 30;
    if (event.bonus === 'senja') { stats.gold += 50; addEXP(10); }
    const birthdays = getBirthdayToday();
    if (birthdays.length) {
        const names = birthdays.map(x => x[1].name).join(', ');
        showNotification(`🎂 Hari Ulang Tahun ${names}! Cek kalender dan berikan hadiah.`);
    } else {
        showNotification(event ? `${event.name} — ${event.desc}` : `🌾 Hari Ke-${stats.day} dimulai!`);
    }
    updateUI();
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const info = document.getElementById('event-info');
    const season = document.getElementById('calendar-season');
    if (!grid || !info) return;
    season.innerText = `${getSeason()} • Bulan ${Math.floor(((stats.day-1)%112)/28)+1}`;
    grid.innerHTML = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(x=>`<div class="calendar-head">${x}</div>`).join('');
    const current = ((stats.day-1)%28)+1;
    for(let d=1; d<=28; d++) {
        const ev=villageEvents[d];
        const birthdays=getBirthdayForDate(d).map(x=>x[1]);
        const mark=ev ? ' ★' : (birthdays.length ? ' 🎂' : '');
        grid.innerHTML += `<div class="calendar-day ${d===current?'today ':''}${ev?'event':''}" onclick="showCalendarDate(${d})" title="Klik untuk detail tanggal ${d}">${d}${mark}</div>`;
    }
    showCalendarDate(current);
}


function showCalendarDate(day) {
    const info = document.getElementById('event-info');
    if (!info) return;
    const ev = villageEvents[day];
    const birthdays = getBirthdayForDate(day);
    const isToday = day === getMonthDay();
    let html = `<div style="font-size:15px;color:#ffd700;font-weight:bold;">📅 ${seasonNameByIndex(getSeasonIndex())} — Tanggal ${day}</div>`;
    if (isToday) html += `<div style="color:#2ecc71;margin-top:4px;">⭐ Hari ini</div>`;
    html += ev ? `<div style="margin-top:8px;"><b>${ev.name}</b><br><span style="color:#ccc">${ev.desc}</span></div>`
               : `<div style="margin-top:8px;color:#aaa;">🌾 Tidak ada event khusus.</div>`;
    if (birthdays.length) {
        html += `<div style="margin-top:10px;"><b class="birthday-badge">🎂 Ulang Tahun:</b><br>`;
        birthdays.forEach(([key,n]) => {
            html += `${n.name} — hadiah favorit: <span style="color:#ffd700">${n.favorite}</span><br>`;
        });
        html += `</div>`;
    }
    info.innerHTML = html;
}

function openTodayDateInfo() {
    document.getElementById('calendar-modal').style.display = 'block';
    isUIOpen = true;
    if (document.pointerLockElement) document.exitPointerLock();
    renderCalendar();
    showCalendarDate(getMonthDay());
}

function getInventoryItemCount(item) {
    if (item === 'fish_lele') return stats.fishes?.lele || 0;
    return Number(stats[item] || 0);
}
function consumeGiftItem(item) {
    if (item === 'fish_lele') stats.fishes.lele--;
    else stats[item]--;
}
function giveGift(npcKey, item) {
    const npc = npcResidents[npcKey];
    if (!npc || getInventoryItemCount(item) <= 0) {
        showNotification('⚠️ Kamu tidak punya barang itu.');
        return;
    }
    consumeGiftItem(item);
    const favorite = item === npc.item;
    const points = favorite ? 20 : 5;
    stats.friendship[npcKey] = Math.min(100, (stats.friendship[npcKey] || 0) + points);
    stats.giftGiven[npcKey] = (stats.giftGiven[npcKey] || 0) + 1;
    if (favorite) addEXP(8);
    updateUI();
    showNotification(favorite
        ? `💖 ${npc.name} sangat menyukai ${npc.favorite}! +${points} Pertemanan`
        : `🎁 ${npc.name} menerima hadiah. +${points} Pertemanan`);
    openGiftModal(npcKey);
}

function openGiftModal(npcKey) {
    const npc = npcResidents[npcKey];
    if (!npc) return;
    isUIOpen = true;
    document.exitPointerLock();
    document.querySelectorAll('.modal-box').forEach(m => m.style.display = 'none');
    document.getElementById('gift-modal').style.display = 'block';
    document.getElementById('gift-recipient').innerHTML =
        `Untuk <b>${npc.name}</b> (${npc.role})<br>🎂 Ulang tahun: ${npc.birthdaySeason}, tanggal ${npc.birthdayDay}<br>❤️ Pertemanan: ${stats.friendship[npcKey] || 0}<br>⭐ Barang favorit: <b>${npc.favorite}</b>`;
    const items = [
        ['crop','🌽 Jagung'], ['milk','🥛 Susu'], ['egg','🥚 Telur'], ['wool','🧶 Wol'],
        ['wood','🌲 Kayu'], ['stone','🪨 Batu'], ['fish_lele','🐟 Lele']
    ];
    document.getElementById('gift-content').innerHTML = items.map(([item,label]) => {
        const count = getInventoryItemCount(item);
        const fav = item === npc.item ? ' 💖 FAVORIT' : '';
        return `<div class="gift-item"><span>${label} x${count}${fav}</span>
            <button class="btn-action gift-btn" onclick="giveGift('${npcKey}','${item}')" ${count<=0?'disabled style="opacity:.45;cursor:not-allowed;"':''}>🎁 Berikan</button></div>`;
    }).join('');
}

function toggleCalendar() {
    const modal=document.getElementById('calendar-modal');
    const open=modal.style.display==='block';
    if(open) { modal.style.display='none'; isUIOpen=false; document.body.requestPointerLock(); }
    else { modal.style.display='block'; isUIOpen=true; renderCalendar(); if(document.pointerLockElement) document.exitPointerLock(); }
}

function getRelationshipLevel(points) {
    if (points >= 100) return 'Sangat Dekat';
    if (points >= 60) return 'Dekat';
    if (points >= 25) return 'Teman';
    return 'Kenal';
}

function renderRelationships() {
    const content = document.getElementById('relationship-content');
    if (!content) return;
    content.innerHTML = Object.entries(npcResidents).map(([key, npc]) => {
        const points = stats.friendship[key] || 0;
        const progress = Math.min(100, points);
        const partnerMark = stats.partner === key ? ' 💍 Pasanganmu' : '';
        return `<div class="relationship-row">
            <div class="relationship-head"><b>${npc.name}</b><span>${getRelationshipLevel(points)}${partnerMark}</span></div>
            <div class="relationship-role">${npc.role} · Favorit: ${npc.favorite}</div>
            <div class="relationship-bar"><div style="width:${progress}%"></div></div>
            <div class="relationship-points">❤️ ${points}/100 kedekatan</div>
        </div>`;
    }).join('');
}

function toggleRelationships() {
    const modal = document.getElementById('relationship-modal');
    const open = modal.style.display === 'block';
    if (open) {
        closeModal();
    } else {
        document.querySelectorAll('.modal-box').forEach(item => item.style.display = 'none');
        renderRelationships();
        modal.style.display = 'block';
        isUIOpen = true;
        if (document.pointerLockElement) document.exitPointerLock();
    }
}

function toggleHudPanels() {
    const panels = document.querySelectorAll('.hud-panel:not(#time-display):not(#inventory-container)');
    const shouldHide = [...panels].some(panel => getComputedStyle(panel).display !== 'none');
    panels.forEach(panel => {
        if (shouldHide) {
            panel.style.display = 'none';
        } else {
            panel.style.display = panel.id === 'inventory-container' ? 'flex' : 'block';
        }
    });
    document.getElementById('hud-toggle-btn').innerHTML = shouldHide ? '👁 TAMPILKAN HUD <small>(H)</small>' : '👁 SEMBUNYIKAN HUD <small>(H)</small>';
}

function getInteractionPosition() {
    if (activeTargetDoor) return getDoorWorldPosition(activeTargetDoor);
    if (activeTargetAnimal) return activeTargetAnimal.mesh.position.clone();
    if (activeTargetObject === 'silo' && siloMesh) return siloMesh.position.clone();
    if (activeTargetObject === 'feeder_chicken' && chickenFeederMesh) return chickenFeederMesh.getWorldPosition(new THREE.Vector3());
    if (activeTargetObject === 'feeder_big' && bigFeederMesh) return bigFeederMesh.getWorldPosition(new THREE.Vector3());
    if (activeTargetObject === 'hotspring' && hotSpringGroup) return hotSpringGroup.position.clone();
    if (activeTargetObject === 'dungeon_entrance' && dungeonEntranceMesh) return dungeonEntranceMesh.position.clone();
    if (activeTargetObject === 'dungeon_stairs' && dungeonStairsMesh) return dungeonStairsMesh.getWorldPosition(new THREE.Vector3());
    if (activeTargetObject === 'mine_entrance' && mineEntranceMesh) return mineEntranceMesh.position.clone();
    if (activeTargetObject === 'mine_stairs' && mineStairsMesh) return mineStairsMesh.getWorldPosition(new THREE.Vector3());
    if (activeTargetObject === 'mine_lift' && mineLiftMesh) return mineLiftMesh.getWorldPosition(new THREE.Vector3());
    if (activeTargetObject === 'mine_exit' && mineExitMesh) return mineExitMesh.getWorldPosition(new THREE.Vector3());
    const npcMap = { walidesa: npcWalidesa, mamat: npcPakMamat, siti: npcNengSiti, dudung: npcMangDudung, jaja: npcPamanJaja };
    if (npcMap[activeTargetNPC]) return npcMap[activeTargetNPC].position.clone();
    const partner = partnerNPCs.find(npc => npc.userData.partnerKey === activeTargetNPC);
    if (partner) return partner.position.clone();
    if (activeTargetNPC === 'house' && houseMesh) return houseMesh.position.clone();
    return player ? player.position.clone() : new THREE.Vector3();
}

function playInteractionAnimation() {
    const crosshair = document.getElementById('crosshair');
    const feedback = document.getElementById('interaction-feedback');
    crosshair.classList.remove('interaction-pulse');
    void crosshair.offsetWidth;
    crosshair.classList.add('interaction-pulse');
    feedback.classList.remove('show');
    void feedback.offsetWidth;
    feedback.classList.add('show');

    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.62, 32),
        new THREE.MeshBasicMaterial({ color: 0xffe082, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(getInteractionPosition());
    ring.position.y = 0.08;
    ring.userData.life = 0.65;
    ring.userData.maxLife = 0.65;
    scene.add(ring);
    interactionEffects.push(ring);
}

function updateInteractionAnimations(delta) {
    interactionEffects = interactionEffects.filter(effect => {
        effect.userData.life -= delta;
        const progress = 1 - effect.userData.life / effect.userData.maxLife;
        const scale = 1 + progress * 2.5;
        effect.scale.set(scale, scale, scale);
        effect.material.opacity = Math.max(0, 0.95 * (1 - progress));
        effect.position.y = 0.08 + progress * 0.45;
        if (effect.userData.life <= 0) {
            scene.remove(effect);
            effect.geometry.dispose();
            effect.material.dispose();
            return false;
        }
        return true;
    });
}

window.onload = function() { init(); };

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 90, 260);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(100, 150, 50);
    sun.castShadow = true;
    scene.add(sun);
    createSkySystem();

    createProceduralTextures();

    createEnvironment();
    createMountains();
    createHotSpring();
    beautifyVillage();
    addVillageAtmosphere();
    spawnNPCs();
    spawnHouse();
    spawnMonsters();
    spawnTreesAndRocks();
    createMine();
    createDungeon();
    createHiddenMagicFruit();
    applyDefaultTextures();

    player = new THREE.Object3D();
    player.position.set(0, 5, -42);
    scene.add(player);
    player.add(camera);
    camera.position.set(0, 1.6, 0);
    playerVelocity = new THREE.Vector3();

    setupFishingRig();
    setupControls();
    window.addEventListener('resize', onWindowResize);
    updateUI();
    updateQuestUI();
    animate();
}

function setupFishingRig() {
    // Joran pancing di tangan pemain (3D Model Sederhana)
    fishingRodMesh = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.8), new THREE.MeshStandardMaterial({ color: 0x4a235a }));
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0, -0.4);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 2.5), new THREE.MeshStandardMaterial({ color: 0xd4ac0d }));
    pole.rotation.x = Math.PI / 3;
    pole.position.set(0, 0.6, -1.2);

    fishingRodMesh.add(handle, pole);
    fishingRodMesh.position.set(0.4, -0.4, -0.5);
    fishingRodMesh.visible = false;
    camera.add(fishingRodMesh);

    // Pelampung pancing (Bobber)
    const bobberGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const bobberMat = new THREE.MeshBasicMaterial({ color: 0xe74c3c });
    fishingBobberMesh = new THREE.Mesh(bobberGeo, bobberMat);
    fishingBobberMesh.visible = false;
    scene.add(fishingBobberMesh);

    // Tali Pancing
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
    fishingLineMesh = new THREE.Line(lineGeo, lineMat);
    fishingLineMesh.visible = false;
    scene.add(fishingLineMesh);
}

// ============================================
// SISTEM TUTORIAL DALAM GAME
// ============================================
const tutorialSteps = [
    {
        title: "🎓 Selamat Datang, Juragan!",
        desc: "Ini kisah dimulainya hidup barumu di desa. Tutorial singkat ini akan memandumu mengenal dasar-dasar permainan sebelum petualangan dimulai."
    },
    {
        title: "🚶 Bergerak & Melihat Sekeliling",
        desc: "Gunakan <b>W A S D</b> untuk berjalan, gerakkan <b>mouse</b> untuk melihat sekeliling, dan tekan <b>SPASI</b> untuk melompat. Tampilan HUD disembunyikan agar pandangan lebih luas; tekan <b>H</b> untuk menampilkannya."
    },
    {
        title: "🗣️ Berinteraksi",
        desc: "Dekati NPC, hewan, rumah, silo, atau tempat pakan lalu tekan <b>E</b> untuk berinteraksi. Perhatikan petunjuk aksi berwarna hijau di tengah layar."
    },
    {
        title: "🚜 Cangkul Lahan Dulu!",
        desc: "Sebelum menanam apa pun, kamu <b>wajib mencangkul lahan</b> di area kebun (tanah cokelat) terlebih dahulu. Pilih slot <b>9 (Cangkul)</b>, lalu klik kiri di atas tanah kebun untuk membuat petak lahan siap tanam."
    },
    {
        title: "🌱 Menanam & Merawat Tanaman",
        desc: "Setelah lahan tercangkul, pilih benih (slot <b>4</b> Jagung / slot <b>8</b> Pakan Ternak) lalu klik kiri di petak lahan tersebut. Siram tanaman tiap hari dengan Penyiram (slot <b>5</b>) agar tumbuh, lalu panen setelah matang."
    },
    {
        title: "🐄 Membangun Peternakan",
        desc: "Kunjungi <b>Pak Mamat</b> untuk membangun kandang, silo, dan membeli hewan ternak. Beri makan hewan secara rutin agar mereka menghasilkan telur, susu, atau wol."
    },
    {
        title: "📜 Ikuti Jurnal Misi",
        desc: "HUD disembunyikan secara default. Tekan <b>H</b> untuk melihat level, resource, waktu, inventori, dan Jurnal Misi. Tombol <b>Q</b> tetap dapat menyembunyikan atau menampilkan Jurnal Misi."
    },
    {
        title: "🏆 Tujuan Akhir Permainan",
        desc: "Untuk <b>MENAMATKAN</b> permainan ini, kamu harus membesarkan peternakan warisan keluargamu hingga sukses (punya cukup hewan ternak & hasil panen), lalu selesaikan seluruh rangkaian misi hingga melapor terakhir kali ke Walidesa. Selamat berpetualang, Juragan!"
    }
];
let tutorialIndex = 0;

function startTutorial() {
    tutorialIndex = 0;
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('instructions').style.display = 'none';
    isUIOpen = true;
    document.exitPointerLock();
    showTutorialStep();
    document.getElementById('tutorial-modal').style.display = 'block';
}

function showTutorialStep() {
    const step = tutorialSteps[tutorialIndex];
    document.getElementById('tutorial-title').innerText = step.title;
    document.getElementById('tutorial-desc').innerHTML = step.desc;
    document.getElementById('tutorial-progress').innerText = `${tutorialIndex + 1}/${tutorialSteps.length}`;
    document.getElementById('tutorial-next-btn').innerText = (tutorialIndex === tutorialSteps.length - 1) ? "Mulai! ✅" : "Lanjut ▶️";
}

function nextTutorialStep() {
    tutorialIndex++;
    if (tutorialIndex >= tutorialSteps.length) {
        skipTutorial();
        return;
    }
    showTutorialStep();
}

function skipTutorial() {
    document.getElementById('tutorial-modal').style.display = 'none';
    isUIOpen = false;
    if (stats.hp > 0 && !isGamePaused) document.body.requestPointerLock();
}

function showProlog() {
    document.getElementById('main-menu').style.display = 'none';
    const prolog = document.getElementById('prolog-modal');
    prolog.classList.remove('prolog-playing');
    void prolog.offsetWidth;
    prolog.classList.add('prolog-playing');
    prolog.style.display = 'block';
}

function closeProlog() {
    document.getElementById('prolog-modal').style.display = 'none';
    document.getElementById('main-menu').style.display = 'block';
}

function beginJourney() {
    document.getElementById('prolog-modal').style.display = 'none';
    startGame(false);
    startTutorial();
}

function startGame(isLoaded = false) {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('instructions').style.display = 'none';
    isUIOpen = false;
    startAmbience();

    if (!isLoaded) {
        stats.day = 1;
        stats.hour = 6;
        stats.minute = 0;
        updateUI();
        updateLighting();
        showNotification("🌱 Petualangan Menanam di Desa Dimulai!");
    }

    document.body.requestPointerLock();
}

function showGuide() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('instructions').style.display = 'block';
}

function backToMainMenu() {
    document.getElementById('instructions').style.display = 'none';
    document.getElementById('main-menu').style.display = 'block';
}

function saveGame() {
    const saveData = {
        stats: stats,
        storyStep: storyStep,
        monstersKilled: questData[3].monstersKilled,
        mineState: { checkpoint: mineState.checkpoint },
        farmPlots: farmPlots.map(p => ({ x: p.x, z: p.z })),
        playerPosition: {
            x: insideBuilding ? exteriorReturnPosition.x : player.position.x,
            y: insideBuilding ? exteriorReturnPosition.y : player.position.y,
            z: insideBuilding ? exteriorReturnPosition.z : player.position.z
        }
    };

    localStorage.setItem('farming_rpg_save', JSON.stringify(saveData));
    showNotification("💾 Permainan Berhasil Disimpan!");
}

function loadGame() {
    const savedData = localStorage.getItem('farming_rpg_save');

    if (!savedData) {
        alert("Tidak ada data simpanan ditemukan!");
        return;
    }

    let parsedData;
    try {
        parsedData = JSON.parse(savedData);
    } catch (error) {
        alert('Data simpanan rusak dan tidak dapat dimuat.');
        return;
    }

    if (!parsedData.stats || typeof parsedData.stats !== 'object') {
        alert('Data simpanan tidak valid.');
        return;
    }
    stats = parsedData.stats;
    stats.copper = stats.copper || 0;
    stats.silver = stats.silver || 0;
    stats.oreGold = stats.oreGold || 0;
    stats.diamond = stats.diamond || 0;
    if (!stats.fishes) {
        stats.fishes = { mujair: 0, lele: 0, emas: 0, toman: 0 };
    }
    if (!stats.magicFruits) {
        stats.magicFruits = { dungeon: false, mine: false, quest: false, hidden: false };
    } else {
        stats.magicFruits = { dungeon: false, mine: false, quest: false, hidden: false, ...stats.magicFruits };
    }
    if (stats.totalProduceCount === undefined) stats.totalProduceCount = 0;
    if (!stats.friendship) stats.friendship = { walidesa:0, mamat:0, siti:0, dudung:0, jaja:0 };
    if (!stats.giftGiven) stats.giftGiven = {};
    storyStep = Number.isInteger(parsedData.storyStep) ? parsedData.storyStep : 0;
    if (parsedData.mineState && Number.isInteger(parsedData.mineState.checkpoint)) {
        mineState.checkpoint = Math.max(1, Math.min(50, parsedData.mineState.checkpoint));
    }
    if (parsedData.monstersKilled !== undefined) {
        questData[3].monstersKilled = parsedData.monstersKilled;
    }

    // Restore Petak Lahan yang Sudah Dicangkul
    farmPlots.forEach(p => scene.remove(p.mesh));
    farmPlots = [];
    if (parsedData.farmPlots) {
        parsedData.farmPlots.forEach(p => tillLandSilent(p.x, p.z));
    }
    
    if (parsedData.playerPosition) {
        player.position.set(
            parsedData.playerPosition.x,
            parsedData.playerPosition.y,
            parsedData.playerPosition.z
        );
    }

    // Restore Kandang, Silo & Hewan
    if (stats.hasChickenCoop && !chickenCoopMesh) buildChickenCoopMesh();
    if (stats.hasBigCoop && !bigCoopMesh) buildBigCoopMesh();
    if (stats.hasSilo && !siloMesh) buildSiloMesh();

    animals.forEach(a => scene.remove(a.mesh));
    animals = [];
    for(let i=0; i<stats.chickensCount; i++) createAnimal('chicken');
    for(let i=0; i<stats.cowsCount; i++) createAnimal('cow');
    for(let i=0; i<stats.sheepsCount; i++) createAnimal('sheep');

    updateUI();
    updateQuestUI();
    updateLighting();

    startGame(true);
    showNotification("📂 Progress Berhasil Dimuat!");
}

function updateQuestUI() {
    const q = questData[storyStep];
    document.getElementById('quest-title').innerText = q.title;
    document.getElementById('quest-desc').innerText = q.desc;
    document.getElementById('quest-progress').innerText = `Status: ${q.progress()}`;
}

function checkQuestProgress() {
    if (storyStep === 1) {
        if (stats.wood >= questData[1].woodNeeded && stats.stone >= questData[1].stoneNeeded) {
            showNotification("📜 Quest Selesai! Bicara ke Walidesa.");
        }
    } else if (storyStep === 2) {
        if (stats.crop >= questData[2].cropNeeded) {
            showNotification("📜 Quest Selesai! Bicara ke Walidesa.");
        }
    } else if (storyStep === 3) {
        if (questData[3].monstersKilled >= questData[3].monsterNeeded) {
            showNotification("📜 Quest Selesai! Bicara ke Walidesa.");
        }
    } else if (storyStep === 5) {
        if (stats.chickensCount >= questData[5].chickenNeeded && stats.cowsCount >= questData[5].cowNeeded && stats.sheepsCount >= questData[5].sheepNeeded) {
            showNotification("📜 Quest Selesai! Bicara ke Walidesa.");
        }
    } else if (storyStep === 6) {
        if (stats.totalProduceCount >= questData[6].produceNeeded) {
            showNotification("📜 Quest Selesai! Bicara ke Walidesa.");
        }
    }
    updateQuestUI();
}

function progressStory(npcKey) {
    if (npcKey === 'walidesa') {
        if (storyStep === 0) {
            storyStep = 1;
            showNotification("📜 Quest Baru: Pembangunan Desa!");
            closeModal();
        } else if (storyStep === 1 && stats.wood >= 4 && stats.stone >= 4) {
            stats.wood -= 4; stats.stone -= 4;
            storyStep = 2;
            addEXP(40); stats.gold += 50;
            showNotification("🎉 Quest Selesai! +50 Gold & 40 EXP");
            closeModal();
        } else if (storyStep === 2 && stats.crop >= 2) {
            storyStep = 3;
            addEXP(50); stats.gold += 60;
            showNotification("🎉 Quest Selesai! +60 Gold & 50 EXP");
            closeModal();
        } else if (storyStep === 3 && questData[3].monstersKilled >= 1) {
            storyStep = 4;
            addEXP(100); stats.gold += 150;
            showNotification("🏆 GELAR DIBUKA: Pahlawan Desa!");
            collectMagicFruit('quest');
            closeModal();
        } else if (storyStep === 4) {
            storyStep = 5;
            addEXP(20);
            showNotification("📜 Quest Baru: Investasi Peternakan! Perbesar peternakanmu.");
            closeModal();
        } else if (storyStep === 5 && stats.chickensCount >= questData[5].chickenNeeded && stats.cowsCount >= questData[5].cowNeeded && stats.sheepsCount >= questData[5].sheepNeeded) {
            storyStep = 6;
            addEXP(80); stats.gold += 100;
            showNotification("🎉 Quest Selesai! Peternakan makin besar. +100 Gold & 80 EXP");
            closeModal();
        } else if (storyStep === 6 && stats.totalProduceCount >= questData[6].produceNeeded) {
            storyStep = 7;
            addEXP(100); stats.gold += 150;
            showNotification("🎉 Quest Selesai! Hasil panen melimpah. +150 Gold & 100 EXP");
            closeModal();
        } else if (storyStep === 7) {
            storyStep = 8;
            closeModal();
            triggerGameEnding();
        }
    }
    updateUI();
    updateQuestUI();
}


function createHotSpring() {
    hotSpringGroup = new THREE.Group();

    const stoneMat = new THREE.MeshStandardMaterial({ map: textures.stone });
    const waterMat = new THREE.MeshStandardMaterial({
        color: 0x69d2e7, transparent: true, opacity: 0.82, roughness: 0.15
    });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(8, 9, 0.8, 24), stoneMat);
    base.position.y = 0.35;
    hotSpringGroup.add(base);

    const water = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 6.8, 0.28, 32), waterMat);
    water.position.y = 0.82;
    hotSpringGroup.add(water);

    for (let i = 0; i < 10; i++) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + Math.random()*0.45, 0), stoneMat);
        const a = (i / 10) * Math.PI * 2;
        rock.position.set(Math.cos(a) * 7.4, 1.0, Math.sin(a) * 7.4);
        hotSpringGroup.add(rock);
    }

    const sign = createNameplate('♨️ PEMANDIAN AIR PANAS', 'rgba(52,73,94,.9)', '#8ff6ff');
    sign.position.set(0, 4.2, -1);
    sign.scale.set(5, 1.25, 1);
    hotSpringGroup.add(sign);

    // Uap sederhana
    for (let i = 0; i < 7; i++) {
        const steam = new THREE.Mesh(
            new THREE.SphereGeometry(0.45 + Math.random()*0.3, 10, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 })
        );
        steam.position.set((Math.random()-0.5)*6, 1.8 + Math.random()*2.5, (Math.random()-0.5)*5);
        steam.userData.baseY = steam.position.y;
        steam.userData.phase = Math.random()*Math.PI*2;
        hotSpringGroup.add(steam);
    }

    hotSpringGroup.position.set(55, 0, 5);
    scene.add(hotSpringGroup);
}

function useHotSpring() {
    if (!hotSpringGroup) return;
    if (hotSpringCooldown > 0) {
        showNotification(`♨️ Air panas sedang menenangkan tubuh... tunggu ${Math.ceil(hotSpringCooldown)} dtk.`);
        return;
    }
    const wasFull = stats.stamina >= stats.maxStamina && stats.hp >= stats.maxHp;
    stats.stamina = stats.maxStamina;
    stats.hp = Math.min(stats.maxHp, stats.hp + 20);
    hotSpringCooldown = 8;
    updateUI();
    showNotification(wasFull ? '♨️ Energi sudah penuh!' : '♨️ Berendam di air panas! Stamina penuh +20 HP.');
}


function beautifyVillage() {
    const pathMat = new THREE.MeshStandardMaterial({ color: 0xb89b72, roughness: 1 });
    const pathGeo = new THREE.BoxGeometry(5, 0.12, 34);
    const paths = [
        [0,0.08,-2,0],
        [18,0.08,0,Math.PI/2],
        [-25,0.08,10,Math.PI/2],
        [30,0.08,0,0],
        [-16,0.08,-18,0],
        [29,0.08,14,0],
        [-24,0.08,-10,0],
        [35,0.08,19,0],
        [-40,0.08,-20,0]
    ];
    paths.forEach(([x,y,z,r]) => {
        const path = new THREE.Mesh(pathGeo, pathMat);
        path.position.set(x,y,z); path.rotation.y=r; scene.add(path);
    });

    const lampMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd27f });
    [[-15,0,-14],[10,0,-2],[21,0,-14],[-34,0,22],[30,0,8],[30,0,-23]].forEach(([x,y,z]) => {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.16,2.6,8), lampMat);
        pole.position.set(x,1.3,z);
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.28,10,10), glowMat);
        glow.position.set(x,2.7,z);
        scene.add(pole,glow);
    });

    // Jerami dan pot bunga agar area kandang lebih rapi
    const strawMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d });
    [[26,0,19],[34,0,19],[26,0,-19],[34,0,-19]].forEach(([x,y,z]) => {
        const bale = new THREE.Mesh(new THREE.BoxGeometry(1.5,1.1,1.5), strawMat);
        bale.position.set(x,0.55,z);
        scene.add(bale);
    });

    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xff69b4 });
    [[-19,0,-15],[-11,0,-15],[6,0,-13],[2,0,-6]].forEach(([x,y,z]) => {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.28,0.45,10), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
        pot.position.set(x,0.22,z);
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.22,8,8), flowerMat);
        flower.position.set(x,0.7,z);
        scene.add(pot,flower);
    });
}

function addVillageAtmosphere() {
    const woodMat = new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.95 });
    const stoneMat = new THREE.MeshStandardMaterial({ map: textures.stone, roughness: 1 });
    const roofMat = new THREE.MeshStandardMaterial({ map: textures.roof, roughness: 0.9 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x3d7a2b, roughness: 1 });
    const flowerColors = [0xff6b81, 0xffd166, 0xc084fc, 0xffffff];

    const gate = new THREE.Group();
    const gatePostL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 4.5, 0.55), woodMat);
    gatePostL.position.set(-3.5, 2.25, -34);
    const gatePostR = gatePostL.clone(); gatePostR.position.x = 3.5;
    const gateTop = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.55, 0.6), woodMat);
    gateTop.position.set(0, 4.25, -34);
    gate.add(gatePostL, gatePostR, gateTop);
    const gateSign = createNameplate('🌾 DESA SENJA', 'rgba(92,58,27,.92)', '#ffe082');
    gateSign.position.set(0, 3.2, -33.6); gateSign.scale.set(2.8, 0.7, 1);
    gate.add(gateSign);
    scene.add(gate);

    const well = new THREE.Group();
    const wellBase = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 1, 12), stoneMat);
    wellBase.position.y = 0.5;
    const wellWater = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.08, 20), new THREE.MeshStandardMaterial({ color: 0x4db6d6, roughness: 0.2 }));
    wellWater.position.y = 1.04;
    const roofPostL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.2, 0.22), woodMat);
    roofPostL.position.set(-1.55, 2.2, 0);
    const roofPostR = roofPostL.clone(); roofPostR.position.x = 1.55;
    const wellRoof = new THREE.Mesh(new THREE.ConeGeometry(2.25, 1.35, 4), roofMat);
    wellRoof.position.y = 4.05; wellRoof.rotation.y = Math.PI / 4;
    well.add(wellBase, wellWater, roofPostL, roofPostR, wellRoof);
    well.position.set(0, 0, 8);
    const wellLabel = createNameplate('💧 SUMUR DESA', 'rgba(52,73,94,.88)', '#b9f3ff');
    wellLabel.position.set(0, 4.8, 0); wellLabel.scale.set(2.3, 0.6, 1);
    well.add(wellLabel);
    scene.add(well);

    const fencePositions = [
        [-28, 0, 0, 0], [-22, 0, 0, 0], [-16, 0, 0, 0], [-10, 0, 0, 0],
        [-28, 0, 24, 0], [-22, 0, 24, 0], [-16, 0, 24, 0], [-10, 0, 24, 0]
    ];
    fencePositions.forEach(([x, y, z, rotation]) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.25, 0.18), woodMat);
        post.position.set(x, 0.62, z); post.rotation.y = rotation;
        const rail = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.16, 0.16), woodMat);
        rail.position.set(x + 2.75, 0.7, z); rail.rotation.y = rotation;
        scene.add(post, rail);
    });

    [[-25, 0, 3], [-20, 0, 6], [-8, 0, 4], [8, 0, -7], [17, 0, 7]].forEach(([x, y, z]) => {
        const patch = new THREE.Group();
        for (let flowerIndex = 0; flowerIndex < 7; flowerIndex++) {
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.32, 5), greenMat);
            stem.position.set((Math.random() - 0.5) * 3.5, 0.16, (Math.random() - 0.5) * 2.2);
            const flower = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshStandardMaterial({ color: flowerColors[flowerIndex % flowerColors.length], roughness: 0.8 }));
            flower.position.copy(stem.position); flower.position.y += 0.25;
            patch.add(stem, flower);
        }
        patch.position.set(x, y, z);
        scene.add(patch);
    });

    const cart = new THREE.Group();
    const cartBed = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.45, 1.6), woodMat);
    cartBed.position.y = 0.8;
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x3d281a, roughness: 1 });
    [-1.15, 1.15].forEach(x => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.22, 14), wheelMat);
        wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.55, 0);
        cart.add(wheel);
    });
    const cartHandle = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 0.15), woodMat);
    cartHandle.position.set(2.4, 1, 0); cartHandle.rotation.z = -0.12;
    cart.add(cartBed, cartHandle);
    cart.position.set(12, 0, 8);
    scene.add(cart);

    const scarecrow = new THREE.Group();
    const scarecrowPost = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.8, 8), woodMat);
    scarecrowPost.position.y = 1.4;
    const scarecrowArms = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.12), woodMat);
    scarecrowArms.position.y = 1.9;
    const scarecrowHead = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe6b87a }));
    scarecrowHead.position.y = 2.5;
    const scarecrowHat = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.35, 8), new THREE.MeshStandardMaterial({ map: textures.strawHat }));
    scarecrowHat.position.y = 2.9;
    scarecrow.add(scarecrowPost, scarecrowArms, scarecrowHead, scarecrowHat);
    scarecrow.position.set(-5, 0, 10);
    scene.add(scarecrow);
}

function createMountains() {
    const mountainData = [
        { x: 78, z: -105, radius: 34, height: 42, color: 0x68727d, snow: 0xe8f4f8 },
        { x: -112, z: -118, radius: 27, height: 30, color: 0x58636f, snow: 0xdcecf2 }
    ];
    mountainData.forEach(data => {
        const mountain = new THREE.Group();
        const rockMat = new THREE.MeshStandardMaterial({ color: data.color, roughness: 1 });
        const snowMat = new THREE.MeshStandardMaterial({ color: data.snow, roughness: 0.85 });
        const base = new THREE.Mesh(new THREE.ConeGeometry(data.radius, data.height, 9), rockMat);
        base.position.y = data.height / 2;
        const snowCap = new THREE.Mesh(new THREE.ConeGeometry(data.radius * 0.43, data.height * 0.36, 9), snowMat);
        snowCap.position.y = data.height * 0.84;
        mountain.add(base, snowCap);

        for (let rockIndex = 0; rockIndex < 8; rockIndex++) {
            const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + Math.random() * 1.2, 0), rockMat);
            const angle = (rockIndex / 8) * Math.PI * 2;
            const distance = data.radius * (0.55 + Math.random() * 0.25);
            rock.position.set(Math.cos(angle) * distance, 1, Math.sin(angle) * distance);
            rock.scale.y = 0.7;
            mountain.add(rock);
        }

        mountain.position.set(data.x, 0, data.z);
        const label = createNameplate('⛰️ GUNUNG SENJA', 'rgba(52,73,94,.9)', '#e8f4f8');
        label.position.set(0, data.height + 3, 0);
        label.scale.set(2.7, 0.7, 1);
        mountain.add(label);
        scene.add(mountain);
        mountainZones.push({ x: data.x, z: data.z, radius: data.radius, height: data.height });
    });
}

function isMountainZone(x, z) {
    return mountainZones.some(zone => Math.hypot(x - zone.x, z - zone.z) < zone.radius * 1.05);
}

function getMountainGroundHeight(x, z) {
    let height = 0;
    mountainZones.forEach(zone => {
        const distance = Math.hypot(x - zone.x, z - zone.z);
        if (distance < zone.radius) {
            const slope = 1 - distance / zone.radius;
            height = Math.max(height, zone.height * Math.pow(slope, 0.72));
        }
    });
    return height;
}

function updateMountainGround() {
    if (!player) return;
    const groundY = 1.6 + getMountainGroundHeight(player.position.x, player.position.z);
    if (player.position.y < groundY) {
        player.position.y = groundY;
        playerVelocity.y = 0;
        isGrounded = true;
    }
}

function createEnvironment() {
    const groundGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE);
    const groundMat = new THREE.MeshStandardMaterial({ map: textures.grass, roughness: 0.8 });
    const terrain = new THREE.Mesh(groundGeo, groundMat);
    terrain.rotation.x = -Math.PI / 2;
    scene.add(terrain);

    const riverGeo = new THREE.PlaneGeometry(18, WORLD_SIZE);
    const riverMat = new THREE.MeshStandardMaterial({ map: textures.water, roughness: 0.1, transparent: true, opacity: 0.85 });
    riverMesh = new THREE.Mesh(riverGeo, riverMat);
    riverMesh.rotation.x = -Math.PI / 2;
    riverMesh.position.set(RIVER_CENTER_X, 0.1, 0);
    scene.add(riverMesh);

    const farmGeo = new THREE.PlaneGeometry(24, 24);
    const farmMat = new THREE.MeshStandardMaterial({ map: textures.dirt, roughness: 0.9 });
    farmLandMesh = new THREE.Mesh(farmGeo, farmMat);
    farmLandMesh.rotation.x = -Math.PI / 2;
    farmLandMesh.position.set(-15, 0.15, 10);
    scene.add(farmLandMesh);
}

function isRiverZone(x, z) {
    return Math.abs(x - RIVER_CENTER_X) <= RIVER_SAFE_HALF_WIDTH;
}

function createNameplate(text, bgColor = 'rgba(0,0,0,0.7)', textColor = '#ffffff') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(10, 10, 492, 108, 20);
    ctx.fill();

    ctx.lineWidth = 6;
    ctx.strokeStyle = textColor;
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = 'Bold 42px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(4, 1, 1);
    nameplates.push(sprite);
    return sprite;
}

function applyDefaultTextures() {
    scene.traverse(object => {
        if (!object.isMesh || !object.material || object.material.map || object.material instanceof THREE.MeshBasicMaterial) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => {
            if (!material.map && material.color) {
                material.map = textures.surfaceDetail;
                material.map.repeat.set(2, 2);
                material.needsUpdate = true;
            }
        });
    });
}

function createMonsterHealthBar(maxHp, yPosition) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 28;
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(2.4, 0.3, 1);
    sprite.position.y = yPosition;
    sprite.userData.healthBar = { canvas, context: canvas.getContext('2d'), texture, maxHp };
    updateMonsterHealthBar(sprite, maxHp, maxHp);
    return sprite;
}

function updateMonsterHealthBar(monster, hp = monster.hp, maxHp = monster.maxHp) {
    if (!monster.healthBar) return;
    const bar = monster.healthBar.userData.healthBar;
    const ratio = Math.max(0, Math.min(1, hp / maxHp));
    const ctx = bar.context;
    ctx.clearRect(0, 0, bar.canvas.width, bar.canvas.height);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, 256, 28);
    ctx.fillStyle = ratio > 0.5 ? '#2ecc71' : ratio > 0.25 ? '#f1c40f' : '#e74c3c';
    ctx.fillRect(4, 4, 248 * ratio, 20);
    bar.texture.needsUpdate = true;
}

function showDamageText(position, amount, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    ctx.font = 'Bold 52px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeText(`-${amount}`, 128, 40);
    ctx.fillStyle = color;
    ctx.fillText(`-${amount}`, 128, 40);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }));
    sprite.scale.set(1.8, 0.56, 1);
    sprite.position.copy(position);
    sprite.position.y += 2.2;
    scene.add(sprite);
    damageTexts.push({ sprite, life: 0.8, velocity: 1.4 });
}

function updateDamageTexts(delta) {
    for (let index = damageTexts.length - 1; index >= 0; index--) {
        const damageText = damageTexts[index];
        damageText.life -= delta;
        damageText.sprite.position.y += damageText.velocity * delta;
        damageText.sprite.material.opacity = Math.max(0, damageText.life / 0.8);
        if (damageText.life <= 0) {
            scene.remove(damageText.sprite);
            damageText.sprite.material.map.dispose();
            damageText.sprite.material.dispose();
            damageTexts.splice(index, 1);
        }
    }
}

// ============================================================
// SISTEM PINTU & INTERIOR BANGUNAN
// Setiap bangunan memiliki pintu yang bisa didekati lalu [E]
// untuk masuk. Di dalam bangunan tersedia pintu keluar [E].
// ============================================================
function addBuildingDoor(group, localX, localY, localZ, id, label) {
    const doorGroup = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: 0.8 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.7 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.7, roughness: 0.25 });

    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.7, 0.28), frameMat);
    const frameR = frameL.clone();
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.18, 0.28), frameMat);
    frameL.position.set(-1.05, 1.35, 0);
    frameR.position.set(1.05, 1.35, 0);
    frameTop.position.set(0, 2.7, 0);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(2, 2.55, 0.18), doorMat);
    panel.position.y = 1.28;
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), handleMat);
    handle.position.set(0.72, 1.28, 0.16);

    doorGroup.add(frameL, frameR, frameTop, panel, handle);
    doorGroup.position.set(localX, localY, localZ);
    group.add(doorGroup);

    const entry = { id, label, group, mesh: doorGroup, isExit: false };
    buildingDoors.push(entry);
    return entry;
}

function getDoorWorldPosition(door) {
    return door.mesh.getWorldPosition(new THREE.Vector3());
}

function createInterior(id, title, type = 'room') {
    if (interiorGroup) scene.remove(interiorGroup);

    const room = new THREE.Group();
    const floorMat = new THREE.MeshStandardMaterial({ color: type === 'coop' ? 0x6b4a2e : 0x806040 });
    const wallMat = new THREE.MeshStandardMaterial({ color: type === 'silo' ? 0x6f7a7c : 0x9b7653 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x4b3424 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 14), floorMat);
    floor.position.y = -0.15;
    room.add(floor);

    const ceilingLight = new THREE.PointLight(type === 'house' ? 0xffc46b : 0x9bd6ff, 1.1, 22);
    ceilingLight.position.set(0, 3.4, 0);
    room.add(ceilingLight);

    const rugColor = type === 'house' ? 0xb56576 : type === 'coop' ? 0x9b7653 : 0x3f6f8f;
    const rug = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.04, 3.2), new THREE.MeshStandardMaterial({ color: rugColor, roughness: 0.95 }));
    rug.position.set(0, 0.03, 1.2);
    room.add(rug);

    const back = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 0.3), wallMat);
    back.position.set(0, 2, -7);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 14), wallMat);
    left.position.set(-9, 2, 0);
    const right = left.clone(); right.position.x = 9;
    const frontL = new THREE.Mesh(new THREE.BoxGeometry(6.5, 4, 0.3), wallMat);
    frontL.position.set(-5.75, 2, 7);
    const frontR = frontL.clone(); frontR.position.x = 5.75;
    room.add(back, left, right, frontL, frontR);

    const interiorWindowMat = new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x214c63, emissiveIntensity: 0.4 });
    [-4.5, 4.5].forEach(x => {
        const window = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.25, 0.08), interiorWindowMat);
        window.position.set(x, 2.3, -6.78);
        room.add(window);
    });

    const label = createNameplate(title, 'rgba(0,0,0,0.75)', '#ffd700');
    label.position.set(0, 3.5, -6.7);
    room.add(label);

    if (type === 'house') {
        const bed = new THREE.Mesh(new THREE.BoxGeometry(4, 0.65, 2.2), new THREE.MeshStandardMaterial({ color: 0xf5f5f5 }));
        bed.position.set(-4.5, 0.35, -2.5);
        bed.userData.isSleepBed = true;
        sleepBedMesh = bed;
        room.add(bed);
        const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 1.7), new THREE.MeshStandardMaterial({ color: 0xe8dff5 }));
        pillow.position.set(-5.8, 0.78, -2.5);
        room.add(pillow);
        const wardrobe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.8, 1), trimMat);
        wardrobe.position.set(6, 1.4, -3.8);
        room.add(wardrobe);
        const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 1.2), trimMat);
        table.position.set(3.8, 1.05, 1.8);
        room.add(table);
        const tableLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1, 0.18), trimMat);
        [-0.8, 0.8].forEach(x => {
            const leg = tableLeg.clone();
            leg.position.set(3.8 + x, 0.5, 1.8);
            room.add(leg);
        });
    } else if (type === 'coop') {
        for (let x = -5; x <= 5; x += 2.5) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 0.18), trimMat);
            post.position.set(x, 1.1, 2.5);
            room.add(post);
        }
        const feeder = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 1), trimMat);
        feeder.position.set(3, 0.35, -1);
        room.add(feeder);
        const hay = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1, 12), new THREE.MeshStandardMaterial({ color: 0xd4ac0d }));
        hay.position.set(-4, 0.5, -1);
        room.add(hay);
    } else if (type === 'silo') {
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 1.1, 16), new THREE.MeshStandardMaterial({ color: 0xd4ac0d }));
        pile.position.y = 0.55;
        room.add(pile);
        const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.5, 0.18), trimMat);
        ladder.position.set(4, 1.8, -2);
        const ladderRail = ladder.clone();
        ladderRail.position.x = 5;
        room.add(ladder, ladderRail);
        for (let y = 0.5; y <= 3.5; y += 0.6) {
            const rung = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.12), trimMat);
            rung.position.set(4.5, y, -2);
            room.add(rung);
        }
    } else {
        const counter = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 1.2), trimMat);
        counter.position.set(0, 0.5, -1);
        room.add(counter);
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(5, 2.5, 0.5), trimMat);
        shelf.position.set(0, 2, -5.5);
        room.add(shelf);
        for (let x = -1.8; x <= 1.8; x += 1.8) {
            const item = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.35), new THREE.MeshStandardMaterial({ color: 0xe67e22 }));
            item.position.set(x, 2.1, -5.15);
            room.add(item);
        }
    }

    const exitDoor = addBuildingDoor(room, 0, 0, 6.75, `exit_${id}`, 'Keluar');
    exitDoor.isExit = true;
    exitDoor.mesh.rotation.y = Math.PI;

    const index = buildingDoors.filter(d => !d.isExit).findIndex(d => d.id === id);
    room.position.set(-80 + Math.max(0, index) * 24, 0, -260);
    scene.add(room);
    interiorGroup = room;
    return room;
}

function getNPCForBuilding(buildingId) {
    const map = {
        village_hall: npcWalidesa,
        mamat_shop: npcPakMamat,
        smithy: npcNengSiti,
        fishing_post: npcMangDudung,
        farmer_hut: npcPamanJaja
    };
    return map[buildingId] || null;
}

function getResidentsForBuilding(buildingId) {
    const residents = [];
    const mainNPC = getNPCForBuilding(buildingId);
    if (mainNPC) residents.push(mainNPC);
    const profile = partnerProfiles.find(item => `partner_${item.key}` === buildingId);
    if (profile) {
        const partner = partnerNPCs.find(npc => npc.userData.partnerKey === profile.key);
        if (partner) residents.push(partner);
        familyNPCs.filter(npc => npc.userData.familyOf === profile.key).forEach(npc => residents.push(npc));
    }
    return residents;
}

function moveNPCIntoBuilding(buildingId, room) {
    savedNPCStates = [];
    const npcs = [npcWalidesa, npcPakMamat, npcNengSiti, npcMangDudung, npcPamanJaja, ...partnerNPCs, ...familyNPCs];
    npcs.forEach(npc => {
        if (!npc) return;
        savedNPCStates.push({ npc, position: npc.position.clone(), rotationY: npc.rotation.y, visible: npc.visible });
        npc.visible = false;
    });

    const residents = getResidentsForBuilding(buildingId);
    if (!residents.length) return;
    const positions = {
        village_hall: [-2.5, 0, -1.5],
        mamat_shop: [2, 0, -1],
        smithy: [2, 0, -1.5],
        fishing_post: [1.5, 0, -1],
        farmer_hut: [-1.8, 0, -1.2]
    };
    const pos = positions[buildingId] || [0, 0, -1];
    residents.forEach((npc, index) => {
        npc.position.set(room.position.x + pos[0] + (index % 2) * 2.2, room.position.y, room.position.z + pos[2] + Math.floor(index / 2) * 1.5);
        npc.rotation.y = Math.PI;
        npc.visible = true;
    });
    interiorNPC = residents[0];
}

function restoreNPCsAfterExit() {
    savedNPCStates.forEach(state => {
        state.npc.position.copy(state.position);
        state.npc.rotation.y = state.rotationY;
        state.npc.visible = state.visible;
    });
    savedNPCStates = [];
    interiorNPC = null;
}

function checkInteriorNPCTarget() {
    activeTargetNPC = null;
    if (!insideBuilding || !interiorNPC || !interiorNPC.visible) return null;
    if (player.position.distanceTo(interiorNPC.position) < 4) {
        if (interiorNPC === npcWalidesa) activeTargetNPC = 'walidesa';
        else if (interiorNPC === npcPakMamat) activeTargetNPC = 'mamat';
        else if (interiorNPC === npcNengSiti) activeTargetNPC = 'siti';
        else if (interiorNPC === npcMangDudung) activeTargetNPC = 'dudung';
        else if (interiorNPC === npcPamanJaja) activeTargetNPC = 'jaja';
        else if (interiorNPC.userData.partnerKey) activeTargetNPC = interiorNPC.userData.partnerKey;
        return activeTargetNPC;
    }
    return null;
}

function enterBuilding(door) {
    if (!door || insideBuilding) return;
    exteriorReturnPosition.copy(player.position);
    currentBuildingId = door.id;
    insideBuilding = true;

    const types = {
        house: ['🏠 Rumah', 'Rumah tempat beristirahat', 'house'],
        chicken_coop: ['🐔 Kandang Ayam', 'Bagian Dalam Kandang Ayam', 'coop'],
        big_coop: ['🐮 Kandang Sapi & Domba', 'Bagian Dalam Kandang Besar', 'coop'],
        silo: ['🏰 Silo Pakan', 'Bagian Dalam Silo', 'silo'],
        village_hall: ['🏛️ Balai Desa', 'Bagian Dalam Balai Desa', 'room'],
        mamat_shop: ['🏚️ Kantor Peternakan', 'Bagian Dalam Kantor Peternakan', 'room'],
        smithy: ['🔥 Bengkel Pandai Besi', 'Bagian Dalam Bengkel', 'room'],
        fishing_post: ['🎣 Pos Pancing', 'Bagian Dalam Pos Pancing', 'room'],
        farmer_hut: ['🏡 Gubuk Tani', 'Bagian Dalam Gubuk Tani', 'room']
    };
    partnerProfiles.forEach(profile => {
        types[`partner_${profile.key}`] = [`🏠 Rumah ${profile.name}`, `Rumah ${profile.name}`, 'house'];
    });
    const info = types[door.id] || ['🏠 Bangunan', 'Bagian Dalam Bangunan', 'room'];
    const room = createInterior(door.id, info[1], info[2]);
    moveNPCIntoBuilding(door.id, room);
    player.position.set(room.position.x, 1.6, room.position.z + 4.5);
    playerVelocity.set(0, 0, 0);
    showNotification(`🚪 Masuk ke ${info[0]} — Tekan [E] di pintu untuk keluar.`);
}

function exitBuilding() {
    if (!insideBuilding) return;
    restoreNPCsAfterExit();
    if (interiorGroup) scene.remove(interiorGroup);
    interiorGroup = null;
    insideBuilding = false;
    currentBuildingId = null;
    player.position.copy(exteriorReturnPosition);
    playerVelocity.set(0, 0, 0);
    activeTargetDoor = null;
    activeTargetSleep = false;
    sleepBedMesh = null;
    showNotification('🚪 Keluar dari bangunan.');
}

function checkSleepTarget() {
    activeTargetSleep = false;
    if (!insideBuilding || currentBuildingId !== 'house' || !sleepBedMesh) return false;
    const dist = player.position.distanceTo(sleepBedMesh.getWorldPosition(new THREE.Vector3()));
    if (dist < 3) {
        activeTargetSleep = true;
        return true;
    }
    return false;
}

function checkDoorTarget() {
    activeTargetDoor = null;
    let bestDist = Infinity;
    for (const door of buildingDoors) {
        const dist = player.position.distanceTo(getDoorWorldPosition(door));
        if (dist < 4 && dist < bestDist) {
            bestDist = dist;
            activeTargetDoor = door;
        }
    }
    return activeTargetDoor;
}

function spawnHouse() {
    const houseGroup = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 8), new THREE.MeshStandardMaterial({ map: textures.wall }));
    walls.position.y = 2.5;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 4, 4), new THREE.MeshStandardMaterial({ map: textures.roof }));
    roof.position.y = 7;
    roof.rotation.y = Math.PI / 4;
    houseGroup.add(walls, roof);
    houseGroup.position.set(-10, 0, -18);
    houseGroup.rotation.y = Math.PI / 2;
    const houseDoor = addBuildingDoor(houseGroup, 0, 0, 4.05, 'house', 'Rumah');
    registerBuildingCollider(houseGroup, 8, 8, houseDoor);

    const houseLabel = createNameplate('🏠 Rumah (Tidur)', 'rgba(139, 90, 43, 0.85)', '#ffd700');
    houseLabel.position.set(0, 9.5, 0);
    houseGroup.add(houseLabel);

    scene.add(houseGroup);
    houseMesh = houseGroup;
}

// -------------------------------------------------------------
// SISTEM KANDANG, SILO, PALUNG PAKAN, DAN HEWAN TERNAK
// -------------------------------------------------------------
function buildChickenCoopMesh() {
    const group = new THREE.Group();
    const fenceMat = new THREE.MeshStandardMaterial({ map: textures.wood });
    
    const fence = new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, 0.2), fenceMat);
    const f1 = fence.clone(); f1.position.set(0, 0.6, -6);
    const f2 = fence.clone(); f2.position.set(0, 0.6, 6);
    const f3 = fence.clone(); f3.rotation.y = Math.PI/2; f3.position.set(-6, 0.6, 0);
    const f4 = fence.clone(); f4.rotation.y = Math.PI/2; f4.position.set(6, 0.6, 0);
    group.add(f1, f2, f3, f4);

    const coopHouse = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 3), new THREE.MeshStandardMaterial({ map: textures.wall }));
    coopHouse.position.set(0, 1.5, -4);
    const coopRoof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 2, 4), new THREE.MeshStandardMaterial({ map: textures.roof }));
    coopRoof.position.set(0, 3.5, -4); coopRoof.rotation.y = Math.PI/4;
    group.add(coopHouse, coopRoof);
    const chickenDoor = addBuildingDoor(group, 0, 0, -2.45, 'chicken_coop', 'Kandang Ayam');
    registerBuildingCollider(group, 12, 12, chickenDoor);

    chickenFeederMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 0.8), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
    chickenFeederMesh.position.set(-3, 0.2, 2);
    group.add(chickenFeederMesh);

    group.position.set(62, 0, 24);
    const label = createNameplate('🐔 Kandang Ayam', 'rgba(230, 126, 34, 0.85)', '#ffffff');
    label.position.set(0, 5, 0);
    group.add(label);

    scene.add(group);
    chickenCoopMesh = group;
}

function buildBigCoopMesh() {
    const group = new THREE.Group();
    const fenceMat = new THREE.MeshStandardMaterial({ map: textures.wood });
    
    const fence = new THREE.Mesh(new THREE.BoxGeometry(20, 1.8, 0.3), fenceMat);
    const f1 = fence.clone(); f1.position.set(0, 0.9, -10);
    const f2 = fence.clone(); f2.position.set(0, 0.9, 10);
    const f3 = fence.clone(); f3.rotation.y = Math.PI/2; f3.position.set(-10, 0.9, 0);
    const f4 = fence.clone(); f4.rotation.y = Math.PI/2; f4.position.set(6, 0.9, 0);
    group.add(f1, f2, f3, f4);

    const barn = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 6), new THREE.MeshStandardMaterial({ map: textures.wall }));
    barn.position.set(0, 2.5, -6.5);
    const barnRoof = new THREE.Mesh(new THREE.ConeGeometry(7, 3, 4), new THREE.MeshStandardMaterial({ map: textures.roof }));
    barnRoof.position.set(0, 6.5, -6.5); barnRoof.rotation.y = Math.PI/4;
    group.add(barn, barnRoof);
    const bigCoopDoor = addBuildingDoor(group, 0, 0, -3.45, 'big_coop', 'Kandang Sapi & Domba');
    registerBuildingCollider(group, 20, 20, bigCoopDoor);

    bigFeederMesh = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 1.2), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
    bigFeederMesh.position.set(-5, 0.3, 3);
    group.add(bigFeederMesh);

    group.position.set(62, 0, -20);
    const label = createNameplate('🐮 Kandang Sapi & Domba', 'rgba(39, 174, 96, 0.85)', '#ffffff');
    label.position.set(0, 8.5, 0);
    group.add(label);

    scene.add(group);
    bigCoopMesh = group;
}

function buildSiloMesh() {
    const group = new THREE.Group();
    const cylinderGeo = new THREE.CylinderGeometry(2.5, 2.5, 9, 16);
    const siloMat = new THREE.MeshStandardMaterial({ map: textures.wall });
    const cylinder = new THREE.Mesh(cylinderGeo, siloMat);
    cylinder.position.y = 4.5;

    const roofGeo = new THREE.ConeGeometry(3, 3, 16);
    const roofMat = new THREE.MeshStandardMaterial({ map: textures.roof });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 10.5;

    group.add(cylinder, roof);
    const siloDoor = addBuildingDoor(group, 0, 0, 2.55, 'silo', 'Silo Pakan');
    registerBuildingCollider(group, 5, 5, siloDoor);
    group.position.set(50, 0, 2);

    const label = createNameplate('🏰 Silo Pakan', 'rgba(41, 128, 185, 0.85)', '#ffd700');
    label.position.set(0, 12, 0);
    group.add(label);

    scene.add(group);
    siloMesh = group;
}

function createAnimal(type) {
    const animalRules = {
        chicken: { coop: 'hasChickenCoop', purchased: 'chickensCount' },
        cow: { coop: 'hasBigCoop', purchased: 'cowsCount' },
        sheep: { coop: 'hasBigCoop', purchased: 'sheepsCount' }
    };
    const rule = animalRules[type];
    if (!rule || !stats[rule.coop]) return null;
    const activeAnimals = animals.filter(animal => animal.type === type).length;
    if (activeAnimals >= Number(stats[rule.purchased] || 0)) return null;

    const animalGroup = new THREE.Group();
    let labelText = "", areaCenter = new THREE.Vector3(), areaRadius = 4;
    const legs = [];
    const hoofMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.85 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.25 });

    if (type === 'chicken') {
        const featherMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.9 });
        const redMat = new THREE.MeshStandardMaterial({ color: 0xd63031 });
        const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf39c12 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 12), featherMat);
        body.position.y = 0.65; body.scale.set(1, 0.82, 1.25);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10), featherMat);
        head.position.set(0, 1.08, 0.3);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
        eye.position.set(-0.18, 1.13, 0.52);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 6), orangeMat);
        beak.rotation.x = Math.PI / 2; beak.position.set(0, 1.03, 0.58);
        const comb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), redMat);
        comb.scale.set(0.7, 1.2, 0.7); comb.position.set(0, 1.38, 0.28);
        const wingL = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), featherMat);
        wingL.position.set(-0.42, 0.68, 0.08); wingL.scale.set(0.45, 0.9, 1);
        const wingR = wingL.clone(); wingR.position.x = 0.42;
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 6), featherMat);
        tail.rotation.x = -Math.PI / 2; tail.position.set(0, 0.82, -0.58);
        animalGroup.add(body, head, eye, beak, comb, wingL, wingR, tail);
        [[-0.2, 0.25, 0.12], [0.2, 0.25, 0.12]].forEach(([x,y,z]) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.35, 6), orangeMat);
            leg.position.set(x, y, z); animalGroup.add(leg); legs.push(leg);
        });
        areaCenter.set(62, 0, 24);
        areaRadius = 4;
        labelText = "🐔 Ayam";
    } else if (type === 'cow') {
        const cowMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.95 });
        const spotMat = new THREE.MeshStandardMaterial({ color: 0x4b3621, roughness: 0.9 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.2, 2.35), cowMat);
        body.position.y = 1.1;
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.46, 10, 8), spotMat);
        spot.position.set(0.55, 1.3, -0.35); spot.scale.set(0.35, 0.7, 0.75);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.8, 0.9), cowMat);
        head.position.set(0, 1.45, 1.35);
        const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8b7a5 }));
        muzzle.position.set(0, 1.28, 1.78);
        const hornMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, roughness: 0.75 });
        [-0.3, 0.3].forEach(x => {
            const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.35, 6), hornMat);
            horn.position.set(x, 1.98, 1.3); horn.rotation.z = x < 0 ? -0.35 : 0.35; animalGroup.add(horn);
        });
        animalGroup.add(body, spot, head, muzzle);
        [[-0.55, 0.48, -0.72], [0.55, 0.48, -0.72], [-0.55, 0.48, 0.72], [0.55, 0.48, 0.72]].forEach(([x,y,z]) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.85, 8), hoofMat);
            leg.position.set(x, y, z); animalGroup.add(leg); legs.push(leg);
        });
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.9, 6), cowMat);
        tail.position.set(0, 1.25, -1.25); tail.rotation.x = -0.4; animalGroup.add(tail);
        areaCenter.set(62, 0, -20);
        areaRadius = 7;
        labelText = "🐮 Sapi";
    } else if (type === 'sheep') {
        const woolMat = new THREE.MeshStandardMaterial({ color: 0xf5f6fa, roughness: 1 });
        const wool = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 1), woolMat);
        wool.position.y = 1.05; wool.scale.set(1, 0.9, 1.35);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), new THREE.MeshStandardMaterial({ color: 0x3b3b4f, roughness: 0.8 }));
        head.position.set(0, 1.12, 0.92);
        const earL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), head.material);
        earL.position.set(-0.3, 1.3, 0.85); const earR = earL.clone(); earR.position.x = 0.3;
        animalGroup.add(wool, head, earL, earR);
        [[-0.45, 0.42, -0.55], [0.45, 0.42, -0.55], [-0.45, 0.42, 0.55], [0.45, 0.42, 0.55]].forEach(([x,y,z]) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 8), hoofMat);
            leg.position.set(x, y, z); animalGroup.add(leg); legs.push(leg);
        });
        areaCenter.set(30, 0, -15);
        areaRadius = 7;
        labelText = "🐑 Domba";
    }

    const rx = areaCenter.x + (Math.random() - 0.5) * areaRadius * 1.5;
    const rz = areaCenter.z + (Math.random() - 0.5) * areaRadius * 1.5;
    animalGroup.position.set(rx, 0, rz);

    const nameLabel = createNameplate(labelText, 'rgba(0,0,0,0.6)', '#ffd700');
    nameLabel.position.y = (type === 'chicken') ? 1.4 : 2.4;
    animalGroup.add(nameLabel);

    scene.add(animalGroup);

    animals.push({
        mesh: animalGroup,
        type: type,
        center: areaCenter,
        radius: areaRadius,
        isFed: false,
        hasProduce: false,
        moveTimer: 0,
        targetPos: new THREE.Vector3(rx, 0, rz),
        legs,
        animTime: Math.random() * Math.PI * 2
    });
    return animalGroup;
}

function updateAnimals(delta) {
    animals.forEach(anim => {
        anim.moveTimer -= delta;
        if (anim.moveTimer <= 0) {
            anim.moveTimer = Math.random() * 4 + 3;
            const rx = anim.center.x + (Math.random() - 0.5) * anim.radius * 1.5;
            const rz = anim.center.z + (Math.random() - 0.5) * anim.radius * 1.5;
            anim.targetPos.set(rx, 0, rz);
        }

        const pos = anim.mesh.position;
        const dist = pos.distanceTo(anim.targetPos);
        if (dist > 0.2) {
            anim.mesh.lookAt(anim.targetPos.x, pos.y, anim.targetPos.z);
            anim.mesh.translateZ(0.015);
            anim.animTime += delta * 7;
            const swing = Math.sin(anim.animTime) * 0.28;
            anim.legs.forEach((leg, index) => { leg.rotation.x = index % 2 === 0 ? swing : -swing; });
        } else {
            anim.animTime += delta * 2;
            anim.mesh.position.y = Math.abs(Math.sin(anim.animTime)) * 0.025;
        }
    });
}

function feedAnimalDirectly(animal) {
    if (animal.isFed) {
        showNotification(`⚠️ ${animal.type.toUpperCase()} ini sudah kenyang hari ini!`);
        return;
    }

    if (stats.fodder > 0) {
        stats.fodder--;
        animal.isFed = true;
        showNotification(`🌾 Kamu memberi makan ${animal.type.toUpperCase()}!`);
        updateUI();
    } else if (stats.hasSilo && stats.siloStorage > 0) {
        stats.siloStorage--;
        animal.isFed = true;
        showNotification(`🌾 Mengambil pakan dari Silo untuk memberi makan ${animal.type.toUpperCase()}!`);
        updateUI();
    } else {
        showNotification("⚠️ Kamu tidak punya Pakan Ternak! Tanam Benih Pakan atau Isi Silo.");
    }
}

function feedThroughFeeder(category) {
    let hungryAnimals = animals.filter(a => (category === 'chicken' ? a.type === 'chicken' : a.type !== 'chicken') && !a.isFed);
    if (hungryAnimals.length === 0) {
        showNotification("⚠️ Semua hewan di kandang ini sudah diberi makan!");
        return;
    }

    let fedCount = 0;
    for (let animal of hungryAnimals) {
        if (stats.fodder > 0) {
            stats.fodder--;
            animal.isFed = true;
            fedCount++;
        } else if (stats.hasSilo && stats.siloStorage > 0) {
            stats.siloStorage--;
            animal.isFed = true;
            fedCount++;
        } else {
            break;
        }
    }

    if (fedCount > 0) {
        showNotification(`🌾 Berhasil memberi makan ${fedCount} hewan ternak melalui Palung Pakan!`);
        updateUI();
    } else {
        showNotification("⚠️ Pakan habis! Isi Silo atau bawa Pakan Ternak.");
    }
}

function depositToSilo() {
    if (!stats.hasSilo) {
        showNotification("⚠️ Kamu belum membangun Silo!");
        return;
    }
    if (stats.fodder <= 0) {
        showNotification("⚠️ Kamu tidak membawa Pakan Ternak!");
        return;
    }
    if (stats.siloStorage >= stats.siloMaxStorage) {
        showNotification("⚠️ Silo sudah penuh!");
        return;
    }

    let amountToAdd = Math.min(stats.fodder, stats.siloMaxStorage - stats.siloStorage);
    stats.fodder -= amountToAdd;
    stats.siloStorage += amountToAdd;
    showNotification(`🏰 Menyimpan +${amountToAdd} Pakan Ternak ke dalam Silo!`);
    updateUI();
}

function harvestAnimal(animal) {
    if (!animal.hasProduce) {
        showNotification(`⚠️ ${animal.type.toUpperCase()} ini belum menghasilkan produk! Pastikan ia diberi makan.`);
        return;
    }

    if (!useStamina(4)) return;

    if (animal.type === 'chicken') {
        stats.egg++;
        showNotification("🍳 Mengambil +1 Telur Ayam!");
    } else if (animal.type === 'cow') {
        stats.milk++;
        showNotification("🥛 Memerah +1 Susu Sapi!");
    } else if (animal.type === 'sheep') {
        stats.wool++;
        showNotification("🧶 Mencukur +1 Wol Domba!");
    }

    animal.hasProduce = false;
    stats.totalProduceCount++;
    addEXP(8);
    updateUI();
    checkQuestProgress();
}

function createDetailedNPC(config) {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac, roughness: 0.6 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), skinMat);
    head.position.y = 1.75;
    group.add(head);

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
    eyeL.position.set(-0.12, 1.8, 0.33);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
    eyeR.position.set(0.12, 1.8, 0.33);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 8), skinMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 1.73, 0.37);
    group.add(eyeL, eyeR, nose);

    if (config.hairColor) {
        const hairMat = new THREE.MeshStandardMaterial({ color: config.hairColor, roughness: 0.9 });
        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), hairMat);
        hair.position.set(0, 1.91, -0.02);
        hair.scale.set(1.02, 0.72, 1.05);
        const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.12), hairMat);
        fringe.position.set(0, 1.94, 0.32);
        const lockL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), hairMat);
        lockL.position.set(-0.33, 1.72, 0.1);
        const lockR = lockL.clone(); lockR.position.x = 0.33;
        group.add(hair, fringe, lockL, lockR);
    }

    if (config.hasHat) {
        const hatMat = new THREE.MeshStandardMaterial({ map: textures.strawHat, roughness: 0.8 });
        const hat = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.3, 16), hatMat);
        hat.position.set(0, 2.05, 0);
        group.add(hat);
    }

    const shirtMat = new THREE.MeshStandardMaterial({ map: config.shirtTexture || null, color: config.shirtColor || 0xffffff, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 0.85, 16), shirtMat);
    body.position.y = 1.05;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.18, 10), skinMat);
    neck.position.y = 1.52;
    const collarMat = new THREE.MeshStandardMaterial({ color: config.collarColor || 0xf5f5f5, roughness: 0.7 });
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 6, 16), collarMat);
    collar.rotation.x = Math.PI / 2; collar.position.set(0, 1.43, 0.03);
    group.add(body, neck, collar);

    const buttonMat = new THREE.MeshStandardMaterial({ color: config.buttonColor || 0xf1c40f, metalness: 0.25, roughness: 0.5 });
    [1.2, 1.03, 0.86].forEach(y => {
        const button = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), buttonMat);
        button.position.set(0, y, 0.39);
        group.add(button);
    });

    const pantsMat = new THREE.MeshStandardMaterial({ color: config.pantsColor || 0x2c3e50, roughness: 0.8 });
    const pants = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.32, 0.5, 12), pantsMat);
    pants.position.y = 0.45;
    group.add(pants);

    if (config.hasApron) {
        const apronMat = new THREE.MeshStandardMaterial({ map: textures.apronSiti, roughness: 0.9 });
        const apron = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.1), apronMat);
        apron.position.set(0, 0.9, 0.22);
        group.add(apron);
    }

    const beltMat = new THREE.MeshStandardMaterial({ color: 0x3d2314 });
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 12), beltMat);
    belt.position.y = 0.68;
    group.add(belt);

    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), skinMat);
    handL.position.set(-0.48, 0.72, 0);
    const handR = handL.clone(); handR.position.x = 0.48;
    group.add(handL, handR);

    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), shirtMat);
    armL.position.set(-0.48, 1.05, 0);
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), shirtMat);
    armR.position.set(0.48, 1.05, 0);

    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), pantsMat);
    legL.position.set(-0.18, 0.25, 0);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), pantsMat);
    legR.position.set(0.18, 0.25, 0);

    const shoeMat = new THREE.MeshStandardMaterial({ color: config.shoeColor || 0x202633, roughness: 0.85 });
    const shoeL = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), shoeMat);
    shoeL.scale.set(0.8, 0.55, 1.25); shoeL.position.set(-0.18, 0.08, 0.08);
    const shoeR = shoeL.clone(); shoeR.position.x = 0.18;

    group.add(armL, armR, legL, legR, shoeL, shoeR);
    group.userData = { armL, armR, legL, legR, handL, handR };

    return group;
}

// -------------------------------------------------------------
// BANGUNAN KHAS TIAP NPC
// -------------------------------------------------------------
function buildNPCStructure(x, z, rotY, opts) {
    const group = new THREE.Group();
    const w = opts.width || 6, h = opts.height || 4, d = opts.depth || 6;

    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: textures.wall, color: opts.wallTint || 0xffffff }));
    walls.position.y = h / 2;
    group.add(walls);

    const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x3b2416, roughness: 0.8 });
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x214c63, emissiveIntensity: 0.35, transparent: true, opacity: 0.9 });
    [-w * 0.28, w * 0.28].forEach(windowX => {
        const window = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.9, 0.12), windowMat);
        window.position.set(windowX, h * 0.58, d / 2 + 0.08);
        const frameV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.08, 0.18), windowFrameMat);
        frameV.position.copy(window.position);
        const frameH = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.18), windowFrameMat);
        frameH.position.copy(window.position);
        group.add(window, frameV, frameH);
    });

    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, h * 0.65, 4), new THREE.MeshStandardMaterial({ map: textures.roof, color: opts.roofTint || 0xffffff }));
    roof.position.y = h + (h * 0.32);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    if (opts.chimney) {
        const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2.2, 8), new THREE.MeshStandardMaterial({ color: 0x555555 }));
        chimney.position.set(w / 3, h + h * 0.7, d / 4);
        group.add(chimney);
    }

    if (opts.stall) {
        const counter = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 1, 1.2), new THREE.MeshStandardMaterial({ map: textures.wood }));
        counter.position.set(0, 0.5, d / 2 + 0.6);
        group.add(counter);
    }

    const exteriorLamp = new THREE.PointLight(0xffd27f, 0.45, 8);
    exteriorLamp.position.set(0, h * 0.78, d / 2 + 0.6);
    group.add(exteriorLamp);

    if (opts.dock) {
        const dockGeo = new THREE.BoxGeometry(w * 1.6, 0.3, d * 1.3);
        const dockMesh = new THREE.Mesh(dockGeo, new THREE.MeshStandardMaterial({ map: textures.wood }));
        dockMesh.position.set(0, 0.15, d * 1.1);
        group.add(dockMesh);
    }

    group.position.set(x, 0, z);
    group.rotation.y = rotY || 0;

    const label = createNameplate(opts.label, opts.labelColor || 'rgba(0,0,0,0.8)', '#ffffff');
    label.position.set(0, h + h * 0.7 + 2, 0);
    group.add(label);

    scene.add(group);
    if (opts.buildingId) {
        const door = addBuildingDoor(group, 0, 0, d / 2 + 0.15, opts.buildingId, opts.label);
        buildingColliders.push({ group, width: w, depth: d, door });
    }
    return group;
}

function registerBuildingCollider(group, width, depth, door) {
    buildingColliders.push({ group, width, depth, door });
}

function isBlockedByBuilding(x, z) {
    return false;
}

function buildAllNPCStructures() {
    // Balai Desa - Walidesa (dekat posisi 5,0,5)
    buildNPCStructure(10, 2, 0, {
        width: 8, height: 5, depth: 7,
        label: '🏛️ Balai Desa',
        labelColor: 'rgba(41, 128, 185, 0.85)',
        roofTint: 0x3498db,
        buildingId: 'village_hall',
        stall: true
    });

    // Kantor Peternakan - Pak Mamat (dekat posisi 25,0,-5)
    buildNPCStructure(24, -9, Math.PI / 2, {
        width: 6, height: 4, depth: 5,
        label: '🏚️ Kantor Peternakan',
        labelColor: 'rgba(39, 174, 96, 0.85)',
        roofTint: 0x27ae60,
        buildingId: 'mamat_shop'
    });

    // Bengkel Pandai Besi - Neng Siti (dekat posisi -30,0,25)
    buildNPCStructure(-34, 28, Math.PI, {
        width: 6, height: 4, depth: 6,
        label: '🔥 Bengkel Pandai Besi',
        labelColor: 'rgba(142, 68, 173, 0.85)',
        roofTint: 0x8e44ad,
        buildingId: 'smithy',
        wallTint: 0xcccccc,
        chimney: true,
        stall: true
    });

    // Pos Pancing - Mang Dudung (dekat posisi -32,0,5, sisi sungai)
    buildNPCStructure(-38, 8, Math.PI / 2, {
        width: 5, height: 3.2, depth: 4,
        label: '🎣 Pos Pancing',
        labelColor: 'rgba(52, 152, 219, 0.85)',
        roofTint: 0x2980b9,
        buildingId: 'fishing_post',
        dock: true
    });

    // Gubuk Tani - Paman Jaja (dekat titik jalan awal 0,0,-5)
    buildNPCStructure(5, -12, 0, {
        width: 5, height: 3.5, depth: 5,
        label: '🏡 Gubuk Tani',
        labelColor: 'rgba(211, 84, 0, 0.85)',
        roofTint: 0xd35400,
        buildingId: 'farmer_hut'
    });

    partnerProfiles.forEach((profile, index) => {
        const houseRotations = [0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI / 2];
        buildNPCStructure(profile.home[0], profile.home[1], houseRotations[index], {
            width: 6, height: 4, depth: 6,
            label: `🏠 Rumah ${profile.name}`,
            labelColor: ['rgba(230,126,34,.9)','rgba(245,183,177,.9)','rgba(39,174,96,.9)','rgba(52,152,219,.9)','rgba(142,68,173,.9)'][index],
            roofTint: [0xe67e22,0xf1948a,0x27ae60,0x3498db,0x8e44ad][index],
            chimney: index === 1 || index === 4,
            buildingId: `partner_${profile.key}`
        });
    });
}

function spawnPartnerAndFamily(profile) {
    const partner = createDetailedNPC(profile);
    partner.position.set(profile.home[0], 0, profile.home[1] + 5);
    partner.userData.partnerKey = profile.key;
    const partnerLabel = createNameplate(`💗 ${profile.name}`, 'rgba(214, 48, 49, .9)', '#ffffff');
    partnerLabel.position.set(0, 2.6, 0);
    partner.add(partnerLabel);
    scene.add(partner);
    partnerNPCs.push(partner);

    profile.family.forEach((member, memberIndex) => {
        const familyMember = createDetailedNPC({ shirtColor: [0xf1c40f, 0x5dade2][memberIndex], pantsColor: 0x34495e, hairColor: memberIndex ? 0x3b2416 : 0x17202a });
        familyMember.position.set(profile.home[0] + (memberIndex ? 1.8 : -1.8), 0, profile.home[1] + 3.2);
        familyMember.userData.familyOf = profile.key;
        familyMember.userData.familyName = member[0];
        familyMember.userData.familyRole = member[1];
        familyMember.userData.interactionKey = `family:${profile.key}:${memberIndex}`;
        const familyLabel = createNameplate(`👪 ${member[0]}`, 'rgba(52, 73, 94, .9)', '#ffffff');
        familyLabel.position.set(0, 2.6, 0);
        familyMember.add(familyLabel);
        scene.add(familyMember);
        familyNPCs.push(familyMember);
        walkingNPCData.push({
            mesh: familyMember,
            target: new THREE.Vector3(profile.home[0] + (memberIndex ? 2 : -2), 0, profile.home[1] + 2),
            speed: 0.018 + Math.random() * 0.008,
            waitTime: Math.random() * 2,
            animTime: 0,
            waypoints: [
                new THREE.Vector3(profile.home[0] - 2.5, 0, profile.home[1] + 2),
                new THREE.Vector3(profile.home[0] + 2.5, 0, profile.home[1] + 2),
                new THREE.Vector3(profile.home[0] + 2.5, 0, profile.home[1] + 5),
                new THREE.Vector3(profile.home[0] - 2.5, 0, profile.home[1] + 5)
            ]
        });
    });
}

function openPartnerModal(partnerKey) {
    const profile = partnerProfiles.find(item => item.key === partnerKey);
    if (!profile) return;
    isUIOpen = true;
    document.exitPointerLock();
    document.querySelectorAll('.modal-box').forEach(modal => modal.style.display = 'none');
    let modal = document.getElementById('partner-dialogue');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'partner-dialogue';
        modal.className = 'modal-box';
        document.getElementById('ui').appendChild(modal);
    }
    const friendship = stats.friendship[partnerKey] || 0;
    const isPartner = stats.partner === partnerKey;
    const canBecomePartner = friendship >= 100 || isPartner;
    const familyNames = profile.family.map(member => `${member[0]} (${member[1]})`).join('<br>');
    const partnerButton = isPartner ? '💍 Sudah Menjadi Pasanganmu' : canBecomePartner ? '💞 Jadikan Pasangan' : '🔒 Butuh Kedekatan 100/100';
    const dialogue = pickRandomLine(partnerDialogueLines[partnerKey] || [`"Aku ${profile.name}, ${profile.role}. Senang bisa berbincang denganmu!"`]);
    modal.innerHTML = `<h2>💗 ${profile.name}</h2><div class="dialogue-text">${dialogue}<br><br>👪 Keluarga:<br>${familyNames}<br><br>❤️ Kedekatan: ${friendship}/100${canBecomePartner ? '' : '<br><span style="color:#ff9ff3;">Tingkatkan kedekatan dengan memberi hadiah.</span>'}</div><button class="btn-action" style="background:#e84393;${canBecomePartner ? '' : 'opacity:.5;cursor:not-allowed;'}" onclick="choosePartner('${partnerKey}')" ${canBecomePartner ? '' : 'disabled'}>${partnerButton}</button><button class="gift-btn" onclick="openGiftModal('${partnerKey}')">🎁 Berikan Hadiah — Favorit: ${profile.favorite}</button><button class="btn-action" style="background:#7f8c8d;" onclick="closeModal()">Tutup</button>`;
    modal.style.display = 'block';
}

function openFamilyModal(familyKey) {
    const parts = familyKey.split(':');
    const familyNPC = familyNPCs.find(npc => npc.userData.interactionKey === familyKey);
    const profile = partnerProfiles.find(item => item.key === parts[1]);
    if (!familyNPC || !profile) return;
    isUIOpen = true;
    document.exitPointerLock();
    document.querySelectorAll('.modal-box').forEach(modal => modal.style.display = 'none');
    let modal = document.getElementById('family-dialogue');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'family-dialogue';
        modal.className = 'modal-box';
        document.getElementById('ui').appendChild(modal);
    }
    const lines = [
        `"Aku ${familyNPC.userData.familyName}, ${familyNPC.userData.familyRole}. ${profile.name} sering bercerita tentangmu."`,
        `"Rumah kami selalu terbuka untuk tamu desa. Semoga harimu menyenangkan."`,
        `"${profile.name} sedang sibuk, tapi pasti senang kamu datang berkunjung."`
    ];
    modal.innerHTML = `<h2>👪 ${familyNPC.userData.familyName}</h2><div class="dialogue-text">${pickRandomLine(lines)}<br><br>🏠 Keluarga: ${profile.name}<br>💬 Warga desa juga bisa diajak berbicara.</div><button class="btn-action" style="background:#7f8c8d;" onclick="closeModal()">Tutup</button>`;
    modal.style.display = 'block';
}

function choosePartner(partnerKey) {
    const profile = partnerProfiles.find(item => item.key === partnerKey);
    if (!profile || (stats.friendship[partnerKey] || 0) < 100) {
        showNotification(`🔒 Kedekatan dengan ${profile ? profile.name : 'warga ini'} harus mencapai 100/100.`);
        return;
    }
    stats.partner = partnerKey;
    showNotification(`💍 ${profile.name} sekarang menjadi pasanganmu!`);
    openPartnerModal(partnerKey);
}

function spawnNPCs() {
    npcWalidesa = createDetailedNPC({ shirtTexture: textures.clothWali, pantsColor: 0x1b2631, hairColor: 0x4a235a });
    npcWalidesa.position.set(5, 0, 5);
    const labelWali = createNameplate('👨‍🌾 Walidesa', 'rgba(41, 128, 185, 0.85)', '#ffffff');
    labelWali.position.set(0, 2.6, 0);
    npcWalidesa.add(labelWali);
    scene.add(npcWalidesa);

    npcPakMamat = createDetailedNPC({ shirtTexture: textures.clothMamat, pantsColor: 0x5d4037, hasHat: true });
    npcPakMamat.position.set(25, 0, -5);
    const labelMamat = createNameplate('🐮 Pak Mamat', 'rgba(39, 174, 96, 0.85)', '#ffffff');
    labelMamat.position.set(0, 2.6, 0);
    npcPakMamat.add(labelMamat);
    scene.add(npcPakMamat);

    npcNengSiti = createDetailedNPC({ shirtColor: 0xc0392b, pantsColor: 0x212f3d, hairColor: 0x111111, hasApron: true });
    npcNengSiti.position.set(-30, 0, 25);
    const labelSiti = createNameplate('🛠️ Neng Siti', 'rgba(142, 68, 173, 0.85)', '#ffffff');
    labelSiti.position.set(0, 2.6, 0);
    npcNengSiti.add(labelSiti);
    scene.add(npcNengSiti);

    // NPC Mang Dudung di dekat Sungai
    npcMangDudung = createDetailedNPC({ shirtTexture: textures.clothDudung, pantsColor: 0x2c3e50, hairColor: 0x2d3436, hasHat: true });
    npcMangDudung.position.set(-32, 0, 5);
    const labelDudung = createNameplate('🎣 Mang Dudung', 'rgba(52, 152, 219, 0.85)', '#ffffff');
    labelDudung.position.set(0, 2.6, 0);
    npcMangDudung.add(labelDudung);
    scene.add(npcMangDudung);

    npcPamanJaja = createDetailedNPC({ shirtTexture: textures.clothJaja, pantsColor: 0x273746, hairColor: 0x2c3e50 });
    npcPamanJaja.position.set(0, 0, -5);
    const labelJaja = createNameplate('🚶 Paman Jaja', 'rgba(211, 84, 0, 0.85)', '#ffffff');
    labelJaja.position.set(0, 2.6, 0);
    npcPamanJaja.add(labelJaja);
    scene.add(npcPamanJaja);

    buildAllNPCStructures();

    walkingNPCData = [{
        mesh: npcPamanJaja,
        target: new THREE.Vector3(10, 0, 10),
        speed: 0.035,
        waitTime: 0,
        animTime: 0,
        waypoints: [
            new THREE.Vector3(15, 0, 15),
            new THREE.Vector3(-10, 0, 20),
            new THREE.Vector3(20, 0, -10),
            new THREE.Vector3(0, 0, -20),
            new THREE.Vector3(-20, 0, -5)
        ]
    }];

    partnerProfiles.forEach(profile => {
        spawnPartnerAndFamily(profile);
        const partner = partnerNPCs[partnerNPCs.length - 1];
        walkingNPCData.push({
            mesh: partner,
            target: new THREE.Vector3(profile.waypoints[0][0], 0, profile.waypoints[0][1]),
            speed: 0.025 + Math.random() * 0.01,
            waitTime: Math.random() * 2,
            animTime: 0,
            waypoints: profile.waypoints.map(point => new THREE.Vector3(point[0], 0, point[1]))
        });
    });
}

function updateWalkingNPC(delta) {
    if (!walkingNPCData.length || insideBuilding) return;
    walkingNPCData.forEach(npc => {

    if (npc.waitTime > 0) {
        npc.waitTime -= delta;
        npc.mesh.userData.armL.rotation.x = 0;
        npc.mesh.userData.armR.rotation.x = 0;
        npc.mesh.userData.legL.rotation.x = 0;
        npc.mesh.userData.legR.rotation.x = 0;
        return;
    }

    const pos = npc.mesh.position;
    const dist = pos.distanceTo(npc.target);

    if (dist < 0.5) {
        npc.waitTime = Math.random() * 3 + 2;
        const nextIdx = Math.floor(Math.random() * npc.waypoints.length);
        npc.target.copy(npc.waypoints[nextIdx]);
    } else {
        npc.mesh.lookAt(npc.target.x, pos.y, npc.target.z);
        npc.mesh.translateZ(npc.speed);

        npc.animTime += delta * 8;
        const swing = Math.sin(npc.animTime) * 0.5;
        npc.mesh.userData.armL.rotation.x = swing;
        npc.mesh.userData.armR.rotation.x = -swing;
        npc.mesh.userData.legL.rotation.x = -swing;
        npc.mesh.userData.legR.rotation.x = swing;
    }
    });
}

function spawnTreesAndRocks() {
    for (let i = 0; i < 40; i++) {
        let x = (Math.random() - 0.5) * (WORLD_SIZE - 60);
        let z = (Math.random() - 0.5) * (WORLD_SIZE - 60);
        if (Math.abs(x) < 35 && Math.abs(z) < 35) continue;
        if (isRiverZone(x, z) || isMountainZone(x, z)) continue;

        const group = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 4), new THREE.MeshStandardMaterial({ map: textures.wood }));
        trunk.position.y = 2;
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.5, 5, 5), new THREE.MeshStandardMaterial({ map: textures.leaves }));
        leaves.position.y = 5.5;
        group.add(trunk, leaves);
        group.position.set(x, 0, z);
        scene.add(group);
        worldObjects.push({ mesh: group, type: 'tree', hp: 3 });
    }

    for (let i = 0; i < 30; i++) {
        let x = (Math.random() - 0.5) * (WORLD_SIZE - 60);
        let z = (Math.random() - 0.5) * (WORLD_SIZE - 60);
        if (Math.abs(x) < 35 && Math.abs(z) < 35) continue;
        if (isRiverZone(x, z) || isMountainZone(x, z)) continue;

        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 1), new THREE.MeshStandardMaterial({ map: textures.stone, roughness: 0.9 }));
        rock.position.set(x, 0.8, z);
        scene.add(rock);
        worldObjects.push({ mesh: rock, type: 'rock', hp: 4 });
    }
}

function spawnMonsters() {
    for (let i = 0; i < 4; i++) {
        const wolf = new THREE.Group();
        const furMat = new THREE.MeshStandardMaterial({ color: 0x3d4652, map: textures.wolfFur, roughness: 0.95 });
        const darkFurMat = new THREE.MeshStandardMaterial({ color: 0x202631, map: textures.surfaceDetail, roughness: 0.9 });
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), furMat);
        body.position.y = 1.0; body.scale.set(0.9, 0.78, 1.45);
        const chest = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), darkFurMat);
        chest.position.set(0, 1.03, 0.9); chest.scale.set(0.8, 0.9, 0.8);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), furMat);
        head.position.set(0, 1.35, 1.35); head.scale.set(0.85, 0.9, 1.05);
        const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), darkFurMat);
        muzzle.position.set(0, 1.2, 1.82);
        [-0.2, 0.2].forEach(x => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), eyeMat);
            eye.position.set(x, 1.48, 1.75); wolf.add(eye);
            const ear = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 4), darkFurMat);
            ear.position.set(x * 1.8, 1.95, 1.3); ear.rotation.x = x < 0 ? -0.12 : 0.12; wolf.add(ear);
        });
        const teeth = [];
        [-0.12, 0.12].forEach(x => {
            const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0xf5f5dc }));
            tooth.position.set(x, 1.08, 1.98); tooth.rotation.x = Math.PI; wolf.add(tooth); teeth.push(tooth);
        });
        const legs = [];
        [[-0.52, 0.48, -0.62], [0.52, 0.48, -0.62], [-0.52, 0.48, 0.65], [0.52, 0.48, 0.65]].forEach(([x,y,z]) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.9, 8), darkFurMat);
            leg.position.set(x, y, z); wolf.add(leg); legs.push(leg);
        });
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 1.4, 8), furMat);
        tail.position.set(0, 1.35, -1.2); tail.rotation.x = -0.9; wolf.add(tail);
        wolf.add(body, chest, head, muzzle);
        let x = (Math.random() - 0.5) * 160 + 40;
        let z = (Math.random() - 0.5) * 160 + 40;
        while (isRiverZone(x, z) || isMountainZone(x, z)) {
            x = (Math.random() - 0.5) * 160 + 40;
            z = (Math.random() - 0.5) * 160 + 40;
        }
        wolf.position.set(x, 0, z);
        scene.add(wolf);
        const maxHp = 60;
        const healthBar = createMonsterHealthBar(maxHp, 3.2);
        wolf.add(healthBar);
        monsters.push({ mesh: wolf, hp: maxHp, maxHp, damage: 8, speed: 0.04, attackTimer: 0, legs, tail, animTime: Math.random() * Math.PI * 2, knockbackVelocity: new THREE.Vector3(), knockbackTime: 0, healthBar });
    }
}

function createDungeon() {
    const entranceGroup = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ map: textures.stone, roughness: 1 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x24202a, roughness: 1 });
    const archLeft = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6, 1.5), stoneMat);
    const archRight = archLeft.clone(); archRight.position.x = 7;
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.5, 1.5), stoneMat);
    archTop.position.set(3.5, 5.5, 0);
    const darkness = new THREE.Mesh(new THREE.BoxGeometry(5.5, 4.5, 0.3), darkMat);
    darkness.position.set(3.5, 2.4, 0.55);
    entranceGroup.add(archLeft, archRight, archTop, darkness);
    entranceGroup.position.set(72, 0, 0);
    const label = createNameplate('🕳️ DUNGEON SENJA', 'rgba(35,25,45,.95)', '#d8a7ff');
    label.position.set(3.5, 7.5, 0);
    entranceGroup.add(label);
    scene.add(entranceGroup);
    dungeonEntranceMesh = entranceGroup;

    for (let floor = 1; floor <= dungeonState.totalFloors; floor++) {
        const room = new THREE.Group();
        const floorMat = new THREE.MeshStandardMaterial({ color: floor === 3 ? 0x3a2020 : 0x33333d, roughness: 1 });
        const roomFloor = new THREE.Mesh(new THREE.BoxGeometry(38, 0.3, 34), floorMat);
        roomFloor.position.y = -0.15;
        const wallMat = new THREE.MeshStandardMaterial({ color: floor === 3 ? 0x5a2525 : 0x464653 });
        const wallBack = new THREE.Mesh(new THREE.BoxGeometry(38, 7, 0.5), wallMat);
        wallBack.position.set(0, 3.5, -17);
        const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 34), wallMat);
        wallLeft.position.set(-19, 3.5, 0);
        const wallRight = wallLeft.clone(); wallRight.position.x = 19;
        const ceiling = new THREE.Mesh(new THREE.BoxGeometry(38, 0.5, 34), new THREE.MeshStandardMaterial({ color: 0x17151d, roughness: 1 }));
        ceiling.position.y = 7.2;
        const stair = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0xd4ac0d, emissive: 0x5a3d00, emissiveIntensity: 0.35 }));
        stair.position.set(0, 0.18, 13);
        const floorLabel = createNameplate(`⚔️ LANTAI ${floor}`, 'rgba(20,20,28,.9)', floor === 3 ? '#ff7675' : '#ffe082');
        floorLabel.position.set(0, 6.5, -12);
        room.add(roomFloor, wallBack, wallLeft, wallRight, ceiling, stair, floorLabel);
        const pillarMat = new THREE.MeshStandardMaterial({ color: floor === 3 ? 0x321b28 : 0x555260, roughness: 0.9 });
        const crystalMat = new THREE.MeshStandardMaterial({ color: floor === 3 ? 0xff315f : 0x56ccf2, emissive: floor === 3 ? 0x8f1535 : 0x164c78, emissiveIntensity: 1.2, roughness: 0.3 });
        [[-16, -14], [16, -14], [-16, 10], [16, 10]].forEach(([x, zPos]) => {
            const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 6.5, 10), pillarMat);
            pillar.position.set(x, 3.25, zPos);
            const capital = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.85, 0.35, 10), pillarMat);
            capital.position.set(x, 6.5, zPos);
            room.add(pillar, capital);
        });
        [[-12, -12], [12, 6], [-10, 12]].forEach(([x, zPos]) => {
            const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 1), crystalMat);
            crystal.position.set(x, 1.1, zPos);
            crystal.rotation.set(0.2, 0.4, -0.15);
            room.add(crystal);
        });
        [-6, 6].forEach(x => {
            const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 3.2, 6), new THREE.MeshStandardMaterial({ color: 0x17151d, metalness: 0.7, roughness: 0.45 }));
            chain.position.set(x, 5.4, -16.4);
            room.add(chain);
        });
        [-13, 13].forEach(x => {
            const torch = new THREE.Group();
            const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 8), new THREE.MeshStandardMaterial({ color: 0x4a2d1b }));
            holder.position.y = 2.8;
            const flame = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshBasicMaterial({ color: floor === 3 ? 0xff334f : 0xff8a3d }));
            flame.position.y = 3.45;
            const light = new THREE.PointLight(floor === 3 ? 0xff294d : 0xff6b35, 1.6, 14);
            light.position.y = 3.5;
            torch.add(holder, flame, light);
            torch.position.set(x, 0, -8);
            room.add(torch);
            dungeonLights.push({ light, flame, phase: Math.random() * Math.PI * 2 });
        });
        room.position.set(145, 0, (floor - 1) * 45);
        scene.add(room);
        dungeonFloorGroups.push({ room, stair, floor });
        room.visible = false;
    }
}

function createHiddenMagicFruit() {
    const fruit = new THREE.Group();
    const fruitMat = new THREE.MeshStandardMaterial({ color: 0xff4d6d, emissive: 0x7a102d, emissiveIntensity: 0.8, roughness: 0.35 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), fruitMat);
    body.scale.set(0.85, 1.15, 0.85);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), leafMat);
    leaf.scale.set(1.4, 0.25, 0.7);
    leaf.position.set(0.28, 0.82, 0);
    fruit.add(body, leaf);
    fruit.position.set(-105, 1, 78);
    const label = createNameplate('🍎 BUAH AJAIB TERSEMBUNYI', 'rgba(30,20,25,.95)', '#ff9ff3');
    label.position.y = 2.2;
    fruit.add(label);
    scene.add(fruit);
    worldObjects.push({ mesh: fruit, type: 'magicFruit', source: 'hidden' });
}

function createDungeonMonster(type, position, floor) {
    const group = new THREE.Group();
    const colors = { slime: 0x2ecc71, goblin: 0x6ab04c, snake: 0xf39c12, boss: 0x8e44ad };
    const bodyTextures = { slime: textures.slimeSkin, goblin: textures.goblinSkin, snake: textures.snakeSkin, boss: textures.bossSkin };
    const bodyMat = new THREE.MeshStandardMaterial({ color: colors[type], map: bodyTextures[type], roughness: 0.8 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1d1b25, roughness: 0.7, metalness: 0.15 });
    const metalMat = new THREE.MeshStandardMaterial({ color: type === 'boss' ? 0xffd166 : 0x9aa4b2, roughness: 0.35, metalness: 0.75 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffeaa7, emissive: 0xff7b00, emissiveIntensity: 1.4 });
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x24121c, roughness: 0.9 });
    const size = type === 'boss' ? 2.1 : type === 'goblin' ? 1.1 : 0.85;

    if (type === 'slime') {
        const body = new THREE.Mesh(new THREE.SphereGeometry(size, 24, 16), bodyMat);
        body.position.y = size * 0.9; body.scale.set(1.15, 0.9, 1.05);
        const core = new THREE.Mesh(new THREE.SphereGeometry(size * 0.38, 16, 12), new THREE.MeshStandardMaterial({ color: 0xb8ff9c, emissive: 0x39ff88, emissiveIntensity: 0.7, transparent: true, opacity: 0.9 }));
        core.position.set(0, size * 0.95, size * 0.65);
        const mouth = new THREE.Mesh(new THREE.TorusGeometry(size * 0.25, size * 0.045, 6, 16, Math.PI), mouthMat);
        mouth.position.set(0, size * 0.7, size * 0.88); mouth.rotation.x = Math.PI;
        group.add(body, core, mouth);
        [-0.3, 0.3].forEach(x => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), eyeMat);
            eye.position.set(x, size * 1.25, size * 0.75); group.add(eye);
        });
        for (let bubbleIndex = 0; bubbleIndex < 3; bubbleIndex++) {
            const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.12 + bubbleIndex * 0.035, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8ffd0, transparent: true, opacity: 0.6 }));
            bubble.position.set(-0.45 + bubbleIndex * 0.4, 0.55 + bubbleIndex * 0.18, 0.35);
            group.add(bubble);
        }
    } else if (type === 'goblin') {
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.55, size * 0.7, size * 1.25, 12), bodyMat);
        torso.position.y = size * 0.95;
        const head = new THREE.Mesh(new THREE.SphereGeometry(size * 0.62, 16, 12), bodyMat);
        head.position.set(0, size * 1.9, size * 0.05);
        const nose = new THREE.Mesh(new THREE.ConeGeometry(size * 0.18, size * 0.45, 8), bodyMat);
        nose.rotation.x = Math.PI / 2; nose.position.set(0, size * 1.82, size * 0.58);
        group.add(torso, head, nose);
        [-0.52, 0.52].forEach(x => {
            const ear = new THREE.Mesh(new THREE.ConeGeometry(size * 0.22, size * 0.8, 8), bodyMat);
            ear.position.set(x, size * 2.05, 0); ear.rotation.z = x < 0 ? -0.65 : 0.65; group.add(ear);
            const eye = new THREE.Mesh(new THREE.SphereGeometry(size * 0.1, 10, 8), eyeMat);
            eye.position.set(x * 0.55, size * 1.95, size * 0.53); group.add(eye);
        });
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(size * 0.72, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), metalMat);
        helmet.position.set(0, size * 2.16, 0); group.add(helmet);
        const belt = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.72, size * 0.72, size * 0.12, 12), metalMat);
        belt.position.y = size * 0.72; group.add(belt);
        [-0.52, 0.52].forEach(x => {
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.13, size * 0.16, size * 0.85, 8), bodyMat);
            arm.position.set(x, size * 1.05, 0); arm.rotation.z = x < 0 ? -0.55 : 0.55; group.add(arm);
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.16, size * 0.2, size * 0.72, 8), darkMat);
            leg.position.set(x * 0.55, size * 0.28, 0); group.add(leg);
        });
        const sword = new THREE.Mesh(new THREE.BoxGeometry(size * 0.12, size * 1.15, size * 0.18), metalMat);
        sword.position.set(size * 0.8, size * 1.15, size * 0.2); sword.rotation.z = -0.35; group.add(sword);
    } else if (type === 'snake') {
        for (let segmentIndex = 0; segmentIndex < 5; segmentIndex++) {
            const segment = new THREE.Mesh(new THREE.SphereGeometry(size * (0.55 - segmentIndex * 0.055), 16, 12), bodyMat);
            segment.position.set(0, size * 0.45 + Math.sin(segmentIndex) * 0.06, segmentIndex * size * 0.5 - size);
            segment.scale.set(1, 0.75, 1.2); group.add(segment);
        }
        const head = new THREE.Mesh(new THREE.SphereGeometry(size * 0.7, 18, 14), bodyMat);
        head.position.set(0, size * 0.95, size * 1.35); head.scale.set(0.9, 0.8, 1.1); group.add(head);
        [-0.22, 0.22].forEach(x => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), eyeMat);
            eye.position.set(x, size * 1.12, size * 1.82); group.add(eye);
        });
        const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, size * 0.55), new THREE.MeshBasicMaterial({ color: 0xff5c8a }));
        tongue.position.set(0, size * 0.82, size * 2.02); group.add(tongue);
    } else {
        const body = new THREE.Mesh(new THREE.SphereGeometry(size, 24, 18), bodyMat);
        body.position.y = size * 1.05; body.scale.set(1.05, 1.2, 0.9); group.add(body);
        const chest = new THREE.Mesh(new THREE.SphereGeometry(size * 0.55, 16, 12), metalMat);
        chest.position.set(0, size * 1.1, size * 0.78); chest.scale.set(1.1, 1.2, 0.35); group.add(chest);
        [-0.65, 0.65].forEach(x => {
            const horn = new THREE.Mesh(new THREE.ConeGeometry(size * 0.18, size * 1.1, 8), metalMat);
            horn.position.set(x, size * 2.15, 0); horn.rotation.z = x < 0 ? -0.45 : 0.45; group.add(horn);
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.14, size * 0.2, size * 1.2, 10), bodyMat);
            arm.position.set(x * 0.85, size * 1.05, 0); arm.rotation.z = x < 0 ? -0.35 : 0.35; group.add(arm);
        });
        [-0.35, 0.35].forEach(x => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), eyeMat);
            eye.position.set(x, size * 1.55, size * 0.78); group.add(eye);
        });
        const crown = new THREE.Mesh(new THREE.ConeGeometry(size * 0.75, size * 0.55, 6), metalMat);
        crown.position.set(0, size * 2.65, 0); group.add(crown);
        const aura = new THREE.Mesh(new THREE.TorusGeometry(size * 1.45, 0.08, 8, 32), new THREE.MeshBasicMaterial({ color: 0xff4d6d, transparent: true, opacity: 0.65 }));
        aura.rotation.x = Math.PI / 2; aura.position.y = 0.15; group.add(aura);
    }
    const label = createNameplate(type === 'boss' ? '👑 BOS DUNGEON' : `👾 ${type.toUpperCase()}`, 'rgba(20,20,25,.8)', type === 'boss' ? '#ff7675' : '#ffffff');
    label.position.y = size * 2.3;
    group.add(label);
    const maxHp = type === 'boss' ? 360 : type === 'goblin' ? 90 : type === 'snake' ? 76 : 60;
    const healthBar = createMonsterHealthBar(maxHp, size * 3.05);
    group.add(healthBar);
    group.position.copy(position);
    scene.add(group);
    const damageByType = { slime: 6, snake: 12, goblin: 16, boss: 24 };
    const monster = { mesh: group, type, floor, hp: maxHp, maxHp, damage: damageByType[type], speed: type === 'boss' ? 0.025 : 0.035, attackTimer: 0, legs: [], tail: null, animTime: Math.random() * Math.PI * 2, dungeon: true, knockbackVelocity: new THREE.Vector3(), knockbackTime: 0, healthBar };
    monsters.push(monster);
    dungeonEnemies.push(monster);
}

function clearDungeonEnemies() {
    dungeonEnemies.forEach(enemy => scene.remove(enemy.mesh));
    monsters = monsters.filter(monster => !monster.dungeon);
    dungeonEnemies = [];
}

function spawnDungeonFloor(floor) {
    clearDungeonEnemies();
    dungeonFloorGroups.forEach(item => { item.room.visible = item.floor === floor; });
    const z = (floor - 1) * 45;
    if (floor === 1) {
        createDungeonMonster('slime', new THREE.Vector3(136, 0, z + 2), floor);
        createDungeonMonster('slime', new THREE.Vector3(154, 0, z + 5), floor);
        createDungeonMonster('goblin', new THREE.Vector3(145, 0, z - 8), floor);
    } else if (floor === 2) {
        createDungeonMonster('snake', new THREE.Vector3(136, 0, z + 2), floor);
        createDungeonMonster('snake', new THREE.Vector3(154, 0, z + 5), floor);
        createDungeonMonster('goblin', new THREE.Vector3(145, 0, z - 8), floor);
        createDungeonMonster('goblin', new THREE.Vector3(145, 0, z + 10), floor);
    } else {
        createDungeonMonster('boss', new THREE.Vector3(145, 0, z - 3), floor);
    }
    dungeonStairsMesh = dungeonFloorGroups.find(item => item.floor === floor).stair;
    dungeonStairsMesh.userData.active = false;
    showNotification(`⚔️ Dungeon Lantai ${floor}: kalahkan semua monster!`);
}

function enterDungeon() {
    dungeonState.active = true;
    dungeonState.floor = 1;
    dungeonState.completed = false;
    dungeonDeathHandled = false;
    if (dungeonEntranceMesh) dungeonEntranceMesh.visible = false;
    spawnDungeonFloor(1);
    scene.background.setHex(0x08060d);
    scene.fog.color.setHex(0x08060d);
    scene.fog.near = 5;
    scene.fog.far = 58;
    sun.intensity = 0.08;
    player.position.set(145, 1.6, -12);
    playerVelocity.set(0, 0, 0);
    showNotification('🕳️ Memasuki Dungeon Senja. Gunakan Pedang untuk bertarung!');
}

function exitDungeon() {
    clearDungeonEnemies();
    dungeonFloorGroups.forEach(item => { item.room.visible = false; });
    if (dungeonEntranceMesh) dungeonEntranceMesh.visible = true;
    dungeonState.active = false;
    dungeonState.floor = 0;
    dungeonStairsMesh = null;
    updateLighting();
    player.position.set(72, 1.6, 8);
    showNotification('🏕️ Kembali ke Desa Senja.');
}

function loseDungeonItems() {
    stats.wood = 0;
    stats.stone = 0;
    stats.crop = 0;
    stats.seeds = 0;
    stats.fodder = 0;
    stats.potion = 0;
    stats.milk = 0;
    stats.egg = 0;
    stats.wool = 0;
    stats.baitCount = 0;
    stats.fishes = { mujair: 0, lele: 0, emas: 0, toman: 0 };
    showNotification('💀 Kamu gugur di dungeon. Semua item yang dibawa tertinggal di dalam dungeon!');
}

function advanceDungeonFloor() {
    if (dungeonEnemies.length > 0) {
        showNotification('⚠️ Kalahkan semua monster sebelum turun ke lantai berikutnya!');
        return;
    }
    if (dungeonState.floor >= dungeonState.totalFloors) {
        stats.gold += 300;
        stats.potion += 2;
        stats.seeds += 5;
        stats.fodderSeeds += 5;
        collectMagicFruit('dungeon');
        dungeonState.completed = true;
        updateUI();
        showNotification('🏆 Dungeon selesai! +300 Gold, +2 Potion, +5 Benih Jagung, +5 Benih Pakan.');
        exitDungeon();
        return;
    }
    dungeonState.floor++;
    player.position.set(145, 1.6, (dungeonState.floor - 1) * 45 - 12);
    spawnDungeonFloor(dungeonState.floor);
}

function updateMonsters(delta) {
    monsters.forEach(monster => {
        if (monster.dungeon && !dungeonState.active) return;
        if (monster.knockbackTime > 0) {
            monster.mesh.position.addScaledVector(monster.knockbackVelocity, delta * 5);
            monster.knockbackVelocity.multiplyScalar(Math.max(0, 1 - delta * 8));
            monster.knockbackTime = Math.max(0, monster.knockbackTime - delta);
        }
        monster.animTime += delta * 5;
        const breath = Math.sin(monster.animTime * 0.7) * 0.025;
        monster.mesh.scale.y = 1 + breath;
        const swing = Math.sin(monster.animTime) * 0.18;
        if (monster.legs) monster.legs.forEach((leg, index) => { leg.rotation.x = index % 2 === 0 ? swing : -swing; });
        if (monster.tail) monster.tail.rotation.z = -0.35 + Math.sin(monster.animTime * 0.8) * 0.2;
    });
}

function setupControls() {
    document.addEventListener('pointerlockchange', () => {
        isLocked = (document.pointerLockElement === document.body);
    });

    document.addEventListener('mousemove', (e) => {
        if (!isLocked || isUIOpen || isGamePaused || stats.hp <= 0) return;
        player.rotation.y -= e.movementX * 0.002;
        camera.rotation.x = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, camera.rotation.x - e.movementY * 0.002));
    });

    document.addEventListener('keydown', (e) => {
        if (stats.hp <= 0) return;

        if (e.code === 'KeyP') {
            togglePause();
            return;
        }

        if (e.code === 'KeyC') {
            toggleCalendar();
            return;
        }

        if (e.code === 'KeyR') {
            toggleRelationships();
            return;
        }

        if (e.code === 'KeyH') {
            toggleHudPanels();
            return;
        }

        if (e.code === 'KeyQ') {
            const tracker = document.getElementById('quest-tracker');
            tracker.style.display = tracker.style.display === 'none' ? 'block' : 'none';
            return;
        }

        if (isGamePaused) return;

        if (e.code === 'KeyW') moveForward = true;
        if (e.code === 'KeyS') moveBackward = true;
        if (e.code === 'KeyA') moveLeft = true;
        if (e.code === 'KeyD') moveRight = true;
        if (e.code === 'Space' && isGrounded) { playerVelocity.y += 10; isGrounded = false; }
        
        if (['1','2','3','4','5','6','7','8','9'].includes(e.key)) setSlot(parseInt(e.key));

        if (e.code === 'KeyE') {
            if (activeTargetSleep) {
                sleepAndAdvanceDay();
            } else if (activeTargetDoor) {
                if (activeTargetDoor.isExit) exitBuilding();
                else enterBuilding(activeTargetDoor);
            } else if (activeTargetAnimal) {
                if (activeTargetAnimal.hasProduce) harvestAnimal(activeTargetAnimal);
                else feedAnimalDirectly(activeTargetAnimal);
            } else if (activeTargetObject) {
                if (activeTargetObject === 'silo') depositToSilo();
                else if (activeTargetObject === 'feeder_chicken') feedThroughFeeder('chicken');
                else if (activeTargetObject === 'feeder_big') feedThroughFeeder('big');
                else if (activeTargetObject === 'hotspring') useHotSpring();
                else if (activeTargetObject === 'dungeon_entrance') enterDungeon();
                else if (activeTargetObject === 'dungeon_stairs') advanceDungeonFloor();
                else if (activeTargetObject === 'mine_entrance') enterMine();
                else if (activeTargetObject === 'mine_stairs') advanceMineFloor();
                else if (activeTargetObject === 'mine_lift') saveMineCheckpoint();
                else if (activeTargetObject === 'mine_exit') exitMine();
            } else if (activeTargetNPC) {
                if (activeTargetNPC === 'house') sleepAndAdvanceDay();
                else openNPCModal(activeTargetNPC);
            }
        }
        if (e.code === 'Escape') {
            if (isUIOpen) closeModal();
            else togglePause();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') moveForward = false;
        if (e.code === 'KeyS') moveBackward = false;
        if (e.code === 'KeyA') moveLeft = false;
        if (e.code === 'KeyD') moveRight = false;
    });

    document.addEventListener('mousedown', (e) => {
        if (!isLocked || isUIOpen || isGamePaused || stats.hp <= 0 || e.button !== 0) return;
        handleLeftClick();
    });
}

function togglePause() {
    isGamePaused = !isGamePaused;
    const pauseModal = document.getElementById('pause-modal');
    
    if (isGamePaused) {
        document.exitPointerLock();
        pauseModal.style.display = 'block';
    } else {
        pauseModal.style.display = 'none';
        if (!isUIOpen && stats.hp > 0) document.body.requestPointerLock();
    }
}

function useStamina(amount) {
    const staminaCost = Math.max(1, Math.ceil(amount * 0.75));
    if (stats.stamina < staminaCost) {
        showNotification("⚡ Kamu terlalu lelah! Tidur di Rumah untuk isi stamina.");
        return false;
    }
    stats.stamina -= staminaCost;
    updateUI();
    return true;
}

function handleLeftClick() {
    if (isFishing) return; // Mencegah klik ganda saat animasi pancing berjalan

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    if (activeSlot === 9) {
        const intersectsFarm = raycaster.intersectObject(farmLandMesh);
        if (intersectsFarm.length > 0 && intersectsFarm[0].distance < 8) {
            tillLand(intersectsFarm[0].point);
            return;
        }
    }

    if (activeSlot === 4) {
        const intersectsFarm = raycaster.intersectObject(farmLandMesh);
        if (intersectsFarm.length > 0 && intersectsFarm[0].distance < 8) {
            const plot = findPlotAt(intersectsFarm[0].point);
            if (!plot) { showNotification("⚠️ Cangkul lahan ini dulu! (Pilih slot 9, lalu klik tanah)"); return; }
            if (plot.planted) { showNotification("⚠️ Lahan ini sudah ditanami!"); return; }
            if (stats.seeds > 0) {
                if (!useStamina(4)) return;
                stats.seeds--;
                plantCrop(plot, 'corn');
                showNotification("🌱 Menanam Benih Jagung!");
                updateUI();
            } else showNotification("⚠️ Benih Jagung habis!");
            return;
        }
    }

    if (activeSlot === 8) {
        const intersectsFarm = raycaster.intersectObject(farmLandMesh);
        if (intersectsFarm.length > 0 && intersectsFarm[0].distance < 8) {
            const plot = findPlotAt(intersectsFarm[0].point);
            if (!plot) { showNotification("⚠️ Cangkul lahan ini dulu! (Pilih slot 9, lalu klik tanah)"); return; }
            if (plot.planted) { showNotification("⚠️ Lahan ini sudah ditanami!"); return; }
            if (stats.fodderSeeds > 0) {
                if (!useStamina(4)) return;
                stats.fodderSeeds--;
                plantCrop(plot, 'fodder');
                showNotification("🌾 Menanam Benih Pakan Ternak!");
                updateUI();
            } else showNotification("⚠️ Benih Pakan Ternak habis!");
            return;
        }
    }

    if (activeSlot === 5) {
        const cropIntersects = raycaster.intersectObjects(crops.map(c => c.mesh), true);
        if (cropIntersects.length > 0 && cropIntersects[0].distance < 7) {
            let hitCrop = cropIntersects[0].object;
            while (hitCrop.parent && hitCrop.parent.type !== 'Scene') hitCrop = hitCrop.parent;
            const crop = crops.find(c => c.mesh === hitCrop);
            if (crop && !crop.isWatered) {
                if (!useStamina(3)) return;
                crop.isWatered = true;
                crop.stemMat.color.setHex(0x1abc9c);
                showNotification("💧 Tanaman disiram!");
            }
            return;
        }
    }

    const cropIntersects = raycaster.intersectObjects(crops.map(c => c.mesh), true);
    if (cropIntersects.length > 0 && cropIntersects[0].distance < 6) {
        let hitCrop = cropIntersects[0].object;
        while (hitCrop.parent && hitCrop.parent.type !== 'Scene') hitCrop = hitCrop.parent;
        const idx = crops.findIndex(c => c.mesh === hitCrop);
        if (idx !== -1 && crops[idx].stage >= 2) {
            const cropType = crops[idx].type;
            if (crops[idx].plot) crops[idx].plot.planted = false;
            scene.remove(crops[idx].mesh);
            crops.splice(idx, 1);
            if (cropType === 'fodder') {
                stats.fodder += 3;
                addEXP(12);
                showNotification("🌾 Memanen +3 Pakan Ternak!");
            } else {
                stats.crop += 2;
                addEXP(15);
                showNotification("🌽 Memanen +2 Jagung!");
                checkQuestProgress();
            }
            updateUI();
            return;
        }
    }

    if (activeSlot === 6) {
        if (!stats.hasSword) { showNotification("⚠️ Beli Pedang di Walidesa!"); return; }
        const monsterIntersects = raycaster.intersectObjects(monsters.map(m => m.mesh), true);
        if (monsterIntersects.length > 0 && monsterIntersects[0].distance < 6) {
            if (!useStamina(5)) return;
            let hitMonster = monsterIntersects[0].object;
            while (hitMonster.parent && hitMonster.parent.type !== 'Scene') hitMonster = hitMonster.parent;
            const idx = monsters.findIndex(m => m.mesh === hitMonster);
            if (idx !== -1) {
                const monster = monsters[idx];
                const damage = stats.swordDamage;
                monster.hp -= damage;
                updateMonsterHealthBar(monster);
                showDamageText(monster.mesh.position, damage, '#ffe082');
                const knockbackDirection = monster.mesh.position.clone().sub(player.position);
                knockbackDirection.y = 0;
                if (knockbackDirection.lengthSq() > 0) {
                    knockbackDirection.normalize();
                    monster.knockbackVelocity.copy(knockbackDirection).multiplyScalar(0.42);
                    monster.knockbackTime = 0.22;
                }
                if (monsters[idx].hp <= 0) {
                    const defeatedMonster = monsters[idx];
                    scene.remove(monsters[idx].mesh);
                    monsters.splice(idx, 1);
                    if (defeatedMonster.dungeon) {
                        dungeonEnemies = dungeonEnemies.filter(enemy => enemy !== defeatedMonster);
                        if (dungeonEnemies.length === 0) {
                            showNotification(dungeonState.floor === dungeonState.totalFloors
                                ? '👑 Bos dikalahkan! Kembali ke tangga untuk mengambil hadiah.'
                                : '✨ Semua monster dikalahkan! Tangga dungeon kini terbuka.');
                            if (dungeonStairsMesh) dungeonStairsMesh.userData.active = true;
                        }
                    }
                    stats.gold += 25; addEXP(30);
                    showNotification("💥 Monster Dikalahkan! (+25 Gold)");
                    if (storyStep === 3) questData[3].monstersKilled++;
                    checkQuestProgress();
                }
                updateUI();
            }
            return;
        }
    }

    // MEKANISME MEMANCING BARU
    if (activeSlot === 3) {
        if (!stats.hasFishingRod) {
            showNotification("⚠️ Kamu belum punya alat pancing! Beli di Mang Dudung (Dekat Sungai).");
            return;
        }
        if (stats.baitCount <= 0) {
            showNotification("⚠️ Kamu membutuhkan Umpan Pancing! Beli di Mang Dudung.");
            return;
        }

        const intersectsRiver = raycaster.intersectObject(riverMesh);
        if (intersectsRiver.length > 0 && intersectsRiver[0].distance < 15) {
            if (!useStamina(8)) return;
            stats.baitCount--;
            startFishingAnimation(intersectsRiver[0].point);
            updateUI();
            return;
        } else {
            showNotification("⚠️ Arahkan pancingan ke Sungai!");
        }
    }

    const objIntersects = raycaster.intersectObjects(worldObjects.map(o => o.mesh), true);
    if (objIntersects.length > 0 && objIntersects[0].distance < 7) {
        let hitMesh = objIntersects[0].object;
        while (hitMesh.parent && hitMesh.parent.type !== 'Scene') hitMesh = hitMesh.parent;
        const idx = worldObjects.findIndex(o => o.mesh === hitMesh);
        if (idx !== -1) {
            const obj = worldObjects[idx];
            if (obj.type === 'magicFruit') {
                scene.remove(obj.mesh);
                worldObjects.splice(idx, 1);
                collectMagicFruit(obj.source);
            } else if (obj.type === 'tree' && activeSlot === 1) {
                if (!useStamina(6)) return;
                obj.hp -= stats.axeLvl;
                if (obj.hp <= 0) {
                    scene.remove(obj.mesh); worldObjects.splice(idx, 1);
                    stats.wood += 2; addEXP(12);
                    showNotification("🌲 Mendapatkan +2 Kayu!");
                    checkQuestProgress();
                }
            } else if (obj.type === 'rock' && activeSlot === 2) {
                if (!useStamina(8)) return;
                obj.hp -= stats.pickLvl;
                if (obj.hp <= 0) {
                    scene.remove(obj.mesh); worldObjects.splice(idx, 1);
                    stats.stone += 2; addEXP(15);
                    showNotification("🪨 Mendapatkan +2 Batu!");
                    checkQuestProgress();
                }
            } else if (obj.type === 'mine_key' && activeSlot === 2) {
                if (!useStamina(10)) return;
                obj.hp -= stats.pickLvl;
                if (obj.hp <= 0) {
                    scene.remove(obj.mesh); worldObjects.splice(idx, 1);
                    mineKeyRock = null;
                    mineState.stairsOpen = true;
                    showNotification('🪨 Batu kunci pecah! Tangga ke lantai berikutnya ditemukan.');
                }
            } else if (obj.type === 'mineral' && activeSlot === 2) {
                if (!useStamina(10)) return;
                obj.hp -= stats.pickLvl;
                if (obj.hp <= 0) {
                    scene.remove(obj.mesh); worldObjects.splice(idx, 1);
                    stats[obj.mineral]++;
                    const labels = { copper: 'Tembaga', silver: 'Silver', oreGold: 'Emas', diamond: 'Diamond' };
                    showNotification(`⛏️ Mendapatkan +1 ${labels[obj.mineral]}!`);
                }
            }
            updateUI();
        }
    }
}

// FUNGSI ANIMASI & PENGAMBILAN IKAN MEMANCING
function startFishingAnimation(targetPoint) {
    isFishing = true;
    fishingTimer = 3.5; // Durasi animasi memancing

    fishingBobberMesh.position.copy(targetPoint);
    fishingBobberMesh.position.y = 0.2; // Tepat di atas air
    fishingBobberMesh.visible = true;
    fishingLineMesh.visible = true;

    showNotification("🎣 Melempar Kail... Menunggu Ikan Menyampar!");
}

function updateFishingAnimation(delta) {
    if (!isFishing) return;

    fishingTimer -= delta;

    // Animasi pelampung memantul di air
    fishingBobberMesh.position.y = 0.2 + Math.sin(performance.now() * 0.008) * 0.08;

    // Gambar tali pancing dari joran ke pelampung
    const tipPos = new THREE.Vector3(0.4, -0.1, -1.8).applyMatrix4(camera.matrixWorld);
    const positions = fishingLineMesh.geometry.attributes.position.array;
    positions[0] = tipPos.x; positions[1] = tipPos.y; positions[2] = tipPos.z;
    positions[3] = fishingBobberMesh.position.x;
    positions[4] = fishingBobberMesh.position.y;
    positions[5] = fishingBobberMesh.position.z;
    fishingLineMesh.geometry.attributes.position.needsUpdate = true;

    if (fishingTimer <= 0) {
        isFishing = false;
        fishingBobberMesh.visible = false;
        fishingLineMesh.visible = false;
        catchFish();
    }
}

function catchFish() {
    const rand = Math.random();
    let caughtFish = "";
    let expGain = 10;

    if (rand < 0.45) {
        stats.fishes.mujair++;
        caughtFish = "🐟 Ikan Mujair";
        expGain = 10;
    } else if (rand < 0.75) {
        stats.fishes.lele++;
        caughtFish = "🐟 Ikan Lele";
        expGain = 15;
    } else if (rand < 0.93) {
        stats.fishes.emas++;
        caughtFish = "✨ Ikan Emas";
        expGain = 25;
    } else {
        stats.fishes.toman++;
        caughtFish = "🐊 Ikan Toman Langka!";
        expGain = 45;
    }

    addEXP(expGain);
    showNotification(`🎉 Umpan Dimakan! Berhasil Menangkap ${caughtFish}! (+${expGain} EXP)`);
    updateUI();
}

// -------------------------------------------------------------
// SISTEM PETAK LAHAN (CANGKUL SEBELUM TANAM)
// -------------------------------------------------------------
const PLOT_GRID = 2; // ukuran grid petak lahan

function snapToGrid(v) {
    return Math.round(v / PLOT_GRID) * PLOT_GRID;
}

function findPlotAt(pos) {
    const gx = snapToGrid(pos.x);
    const gz = snapToGrid(pos.z);
    return farmPlots.find(p => p.x === gx && p.z === gz) || null;
}

function tillLandSilent(gx, gz) {
    const plotGeo = new THREE.PlaneGeometry(1.8, 1.8);
    const plotMat = new THREE.MeshStandardMaterial({ map: textures.dirt, roughness: 1, color: 0x6b4a2b });
    const plotMesh = new THREE.Mesh(plotGeo, plotMat);
    plotMesh.rotation.x = -Math.PI / 2;
    plotMesh.position.set(gx, 0.17, gz);
    scene.add(plotMesh);
    farmPlots.push({ x: gx, z: gz, mesh: plotMesh, planted: false });
}

function tillLand(pos) {
    const gx = snapToGrid(pos.x);
    const gz = snapToGrid(pos.z);
    const existing = farmPlots.find(p => p.x === gx && p.z === gz);
    if (existing) {
        showNotification("⚠️ Lahan ini sudah dicangkul!");
        return;
    }
    if (!useStamina(3)) return;

    const plotGeo = new THREE.PlaneGeometry(1.8, 1.8);
    const plotMat = new THREE.MeshStandardMaterial({ map: textures.dirt, roughness: 1, color: 0x6b4a2b });
    const plotMesh = new THREE.Mesh(plotGeo, plotMat);
    plotMesh.rotation.x = -Math.PI / 2;
    plotMesh.position.set(gx, 0.17, gz);
    scene.add(plotMesh);

    const plot = { x: gx, z: gz, mesh: plotMesh, planted: false };
    farmPlots.push(plot);

    addEXP(2);
    showNotification("🚜 Lahan berhasil dicangkul! Sekarang bisa ditanami.");
    updateUI();
}

function plantCrop(plot, type = 'corn') {
    const cropGroup = new THREE.Group();
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x78e08f });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4), stemMat);
    stem.position.y = 0.2;
    cropGroup.add(stem);
    cropGroup.position.set(plot.x, 0.2, plot.z);
    scene.add(cropGroup);
    plot.planted = true;
    crops.push({ mesh: cropGroup, stemMat: stemMat, stage: 0, isWatered: false, type: type, plot: plot });
}

function sleepAndAdvanceDay() {
    stats.day++;
    stats.hour = 6;
    stats.minute = 0;
    stats.stamina = stats.maxStamina;
    stats.hp = stats.maxHp;

    crops.forEach(crop => {
        if (crop.isWatered) {
            crop.stage++;
            crop.isWatered = false;
            crop.stemMat.color.setHex(0x2ec4b6);
            if (crop.stage === 2) {
                if (crop.type === 'fodder') {
                    const grass = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 5), new THREE.MeshStandardMaterial({ color: 0x27ae60 }));
                    grass.position.y = 0.5;
                    crop.mesh.add(grass);
                } else {
                    const corn = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshStandardMaterial({ color: 0xf1c40f }));
                    corn.position.y = 0.6;
                    crop.mesh.add(corn);
                }
            }
        }
    });

    animals.forEach(a => {
        if (a.isFed) {
            a.hasProduce = true;
            a.isFed = false;
        } else {
            a.hasProduce = false;
        }
    });

    showNotification(`🌅 Hari Ke-${stats.day} Dimulai! HP & Stamina Pulih.`);
    processDailyEvent();
    updateLighting();
    updateUI();
}

function updateGameTime(delta) {
    stats.minute += delta * 5;
    if (stats.minute >= 60) {
        stats.minute = 0;
        stats.hour++;
        if (stats.hour >= 24) sleepAndAdvanceDay();
        updateLighting();
    }
    updateUI();
}

function updateLighting() {
    if (dungeonState.active) return;
    let lightIntensity = 0.8;
    if (stats.hour >= 19 || stats.hour < 5) {
        scene.background.setHex(0x0b0d1b); scene.fog.color.setHex(0x0b0d1b); lightIntensity = 0.15;
    } else if (stats.hour >= 5 && stats.hour < 7) {
        scene.background.setHex(0xe67e22); scene.fog.color.setHex(0xe67e22); lightIntensity = 0.5;
    } else {
        scene.background.setHex(0x87ceeb); scene.fog.color.setHex(0x87ceeb); lightIntensity = 0.8;
    }
    sun.intensity = lightIntensity;
    scene.fog.near = 90;
    scene.fog.far = 260;
    if (cloudsGroup) cloudsGroup.visible = !(stats.hour >= 19 || stats.hour < 5);
    if (starsGroup) starsGroup.visible = (stats.hour >= 19 || stats.hour < 5);
}

// ============================================
// SISTEM DIALOG DINAMIS ALA HARVEST MOON
// Kumpulan obrolan acak per NPC agar tiap kunjungan terasa hidup & tidak monoton
// ============================================
function getGreeting() {
    const h = stats.hour;
    if (h >= 5 && h < 11) return "Selamat pagi";
    if (h >= 11 && h < 15) return "Selamat siang";
    if (h >= 15 && h < 18) return "Selamat sore";
    return "Selamat malam";
}

function pickRandomLine(pool) {
    return pool[Math.floor(Math.random() * pool.length)];
}

const npcFlavorLines = {
    mamat: [
        `"${getGreeting()}, Juragan! Ternak itu ibarat rekan bisnis: rawat baik-baik, mereka akan balas budi."`,
        `"Dulu kau atur rapat penting di kota, sekarang kau atur jadwal makan sapi. Hidup memang lucu, ya?"`,
        `"Jangan lupa isi palung pakan setiap hari. Hewan lapar itu ternak yang tidak produktif, hehe."`,
        `"Bangun kandang & silo dulu kalau mau pelihara dan beri makan hewan ternakmu secara teratur."`,
        `"Susu segar pagi ini lebih berharga daripada saham manapun yang pernah kau punya, percayalah."`,
        `"Aku lihat kau makin telaten mengurus kandang. Sedikit lagi, kau jadi peternak sungguhan!"`,
        `"Kalau capek, istirahat dulu tidak apa-apa. Ternak sabar menunggu, tidak seperti deadline kantor."`
    ],
    siti: [
        `"Bawakan aku batu dan kayu, nanti kubuatkan alat kerja yang lebih tajam!"`,
        `"Dulu tanganmu cuma pegang pena kontrak, sekarang pegang cangkul. Tapi lihat, ototmu makin kuat!"`,
        `"Alat yang bagus bukan dari harga mahal, tapi dari besi pilihan dan tempaan yang sabar."`,
        `"Kalau butuh alat lebih tajam, aku selalu di sini. Api tungku ini tak pernah padam."`,
        `"${getGreeting()}! Datang untuk mengasah alat, atau cuma numpang hangat di dekat tungku?"`,
        `"Setiap alat yang kutempa punya cerita. Alatmu nanti akan jadi bagian dari cerita desa ini."`
    ],
    dudung: [
        `"Halo nak! Sungai di desa kita penuh dengan ikan segar. Beli alat pancing dan umpan dulu kalau mau memancing di sini!"`,
        `"Memancing itu soal sabar, Juragan — beda jauh sama dunia bisnis yang serba buru-buru."`,
        `"Kalau beruntung, hari ini bisa dapat Ikan Emas. Rezeki itu memang tak terduga, sama seperti ikan."`,
        `"Sungai ini sudah memberiku makan bertahun-tahun. Tak pernah sekali pun ia mengkhianatiku."`,
        `"${getGreeting()}! Air sungai lagi tenang, cocok sekali buat melempar kail."`,
        `"Dulu kau sibuk dengan angka-angka di layar. Sekarang coba tenang sejenak, dengarkan aliran air."`
    ],
    jaja: [
        `"Halo anak muda! Saya sedang jalan-jalan keliling desa memeriksa tanaman dan ternak warga."`,
        `"Cuaca hari ini cerah sekali, cocok untuk menanam. Semoga panenmu melimpah!"`,
        `"Aku dengar dulu kau pengusaha besar di kota. Sekarang lihat, tanganmu berlumur tanah — itu tanda kerja jujur."`,
        `"Desa ini kecil, tapi hatinya besar. Kau akan betah di sini, aku yakin."`,
        `"${getGreeting()}! Sudah hari ke-${stats.day} kau di desa ini. Rasanya waktu cepat sekali berlalu, ya?"`,
        `"Kalau ada waktu luang, mampir ke sawahku. Aku senang berbagi cerita dengan orang baru."`
    ],
    walidesa_idle: [
        `"Terima kasih, Pahlawan Desa! Desa ini sudah aman dan makmur kembali."`,
        `"${getGreeting()}! Berkatmu, warga desa bisa tidur nyenyak tanpa takut serigala lagi."`,
        `"Kadang aku heran, orang kota sepertimu justru yang paling betah tinggal di desa ini."`,
        `"Toko selalu buka untukmu, Juragan. Mampir kapan saja kalau butuh bekal."`,
        `"Desa ini dulu nyaris runtuh. Sekarang, berkatmu, ia jadi rumah yang hangat bagi semua."`
    ]
};

function openNPCModal(npcKey) {
    if (npcKey && npcKey.startsWith('family:')) {
        openFamilyModal(npcKey);
        return;
    }
    if (partnerProfiles.some(profile => profile.key === npcKey)) {
        openPartnerModal(npcKey);
        return;
    }
    isUIOpen = true;
    document.exitPointerLock();
    const oldGift = document.querySelector('.dynamic-gift-btn');
    if (oldGift) oldGift.remove();
    
    const questBtn = document.getElementById('btn-quest-walidesa');
    const talkText = document.getElementById('talk-walidesa');

    if (npcKey === 'walidesa') {
        questBtn.style.display = 'block';
        if (storyStep === 0) {
            talkText.innerText = `"Selamat datang, pengelana! Desa kami dalam kondisi hancur akibat badai dan ancaman monster. Maukah kamu membantu kami membangun kembali desa ini?"`;
            questBtn.innerText = "📜 Terima Quest Pertama";
        } else if (storyStep === 1) {
            if (stats.wood >= 4 && stats.stone >= 4) {
                talkText.innerText = `"Terima kasih banyak! Bahan-bahan ini akan digunakan untuk memperbaiki jembatan dan pagar desa."`;
                questBtn.innerText = "✅ Serahkan Bahan (4 Kayu, 4 Batu)";
            } else {
                talkText.innerText = `"Kami masih membutuhkan 4 Kayu dan 4 Batu untuk perbaikan desa."`;
                questBtn.style.display = 'none';
            }
        } else if (storyStep === 2) {
            if (stats.crop >= 2) {
                talkText.innerText = `"Luar biasa! Pasokan pangan desa kita kini aman."`;
                questBtn.innerText = "✅ Lapor Panen Jagung";
            } else {
                talkText.innerText = `"Tanamlah benih jagung dan siram setiap hari sampai bisa dipanen."`;
                questBtn.style.display = 'none';
            }
        } else if (storyStep === 3) {
            if (questData[3].monstersKilled >= 1) {
                talkText.innerText = `"Luar biasa! Serigala itu telah dikalahkan. Desa ini akhirnya aman kembali!"`;
                questBtn.innerText = "🏆 Selesaikan Petualangan";
            } else {
                talkText.innerText = `"Beli Pedang Besi di tokoku dan basmi serigala yang mengganggu desa!"`;
                questBtn.style.display = 'none';
            }
        } else if (storyStep === 4) {
            talkText.innerText = `"Desa ini sudah aman berkatmu! Tapi bukankah kau kemari untuk membangkitkan lagi peternakan warisan orang tuamu? Mari mulai babak baru itu."`;
            questBtn.innerText = "📜 Terima Misi Peternakan";
        } else if (storyStep === 5) {
            if (stats.chickensCount >= questData[5].chickenNeeded && stats.cowsCount >= questData[5].cowNeeded && stats.sheepsCount >= questData[5].sheepNeeded) {
                talkText.innerText = `"Peternakanmu sudah jauh lebih besar sekarang! Orang tuamu pasti bangga melihatnya."`;
                questBtn.innerText = "✅ Lapor Peternakan Berkembang";
            } else {
                talkText.innerText = `"Belilah hewan ternak dari Pak Mamat: minimal 3 Ayam, 2 Sapi, dan 2 Domba, supaya peternakanmu punya fondasi kuat."`;
                questBtn.style.display = 'none';
            }
        } else if (storyStep === 6) {
            if (stats.totalProduceCount >= questData[6].produceNeeded) {
                talkText.innerText = `"Telur, susu, wol — semua mengalir deras dari peternakanmu. Ini baru namanya usaha yang sehat!"`;
                questBtn.innerText = "✅ Lapor Hasil Panen";
            } else {
                talkText.innerText = `"Rawat dan panen terus hasil ternakmu. Kumpulkan total ${questData[6].produceNeeded} hasil panen (telur+susu+wol) untuk membuktikan peternakan ini benar-benar hidup."`;
                questBtn.style.display = 'none';
            }
        } else if (storyStep === 7) {
            talkText.innerText = `"Dari puing kebangkrutan di kota, kau bangkit di sini. Peternakan warisan orang tuamu kini sukses besar. Kisahmu pantas dikenang, Juragan."`;
            questBtn.innerText = "🏆 Tutup Kisah (TAMAT)";
        } else {
            talkText.innerText = pickRandomLine(npcFlavorLines.walidesa_idle);
            questBtn.style.display = 'none';
        }
    } else if (npcFlavorLines[npcKey]) {
        document.getElementById(`talk-${npcKey}`).innerText = pickRandomLine(npcFlavorLines[npcKey]);
    }

    document.getElementById(`dialogue-${npcKey}`).style.display = 'block';
    const dlg = document.getElementById(`dialogue-${npcKey}`);
    if (dlg && npcResidents[npcKey] && !dlg.querySelector('.dynamic-gift-btn')) {
        const btn = document.createElement('button');
        btn.className = 'gift-btn dynamic-gift-btn';
        btn.innerText = `🎁 Berikan Hadiah — Favorit: ${npcResidents[npcKey].favorite}`;
        btn.onclick = () => openGiftModal(npcKey);
        dlg.insertBefore(btn, dlg.lastElementChild);
    }
}

function triggerGameEnding() {
    isUIOpen = true;
    document.exitPointerLock();
    document.getElementById('ending-day').innerText = stats.day;
    document.getElementById('ending-level').innerText = stats.level;
    document.getElementById('ending-animals').innerText = stats.chickensCount + stats.cowsCount + stats.sheepsCount;
    document.getElementById('ending-produce').innerText = stats.totalProduceCount;
    document.getElementById('ending-modal').style.display = 'block';
    showNotification("🏆 SELAMAT! Kamu telah menamatkan permainan!");
}

function continueAfterEnding() {
    document.getElementById('ending-modal').style.display = 'none';
    closeModal();
}

function openShop(type) {
    const closingDay = getShopClosingDay(type);
    if (closingDay !== null && getWeekdayIndex() === closingDay) {
        showNotification(`🔒 Toko tutup hari ${getWeekdayName()}. Buka kembali ${getWeekdayName(((closingDay + 1) % 7) + 1)}.`);
        return;
    }
    document.querySelectorAll('.modal-box').forEach(m => m.style.display = 'none');
    const modal = document.getElementById('subshop-modal');
    const title = document.getElementById('shop-title');
    const content = document.getElementById('shop-content');
    modal.style.display = 'block';

    if (type === 'walidesa') {
        title.innerText = "🏪 TOKO HASIL BUMI (WALIDESA)";
        content.innerHTML = `
            <div class="shop-row"><span>Benih Jagung - 10 Gold</span><button class="btn-shop-item" onclick="buyItem('seeds',10)">Beli</button></div>
            <div class="shop-row"><span>Benih Pakan Ternak - 8 Gold</span><button class="btn-shop-item" onclick="buyItem('fodderSeeds',8)">Beli</button></div>
            <div class="shop-row"><span>Potion HP - 20 Gold</span><button class="btn-shop-item" onclick="buyItem('potion',20)">Beli</button></div>
            <div class="shop-row"><span>Pedang Besi - 80 Gold</span><button class="btn-shop-item" onclick="buySword()">Beli</button></div>
            <hr style="border-color:#444;">
            <div class="shop-row"><span>Jual 1 Kayu (+5 Gold)</span><button class="btn-shop-item" onclick="sellItem('wood',5)">Jual</button></div>
            <div class="shop-row"><span>Jual 1 Batu (+8 Gold)</span><button class="btn-shop-item" onclick="sellItem('stone',8)">Jual</button></div>
            <div class="shop-row"><span>Jual 1 Jagung (+18 Gold)</span><button class="btn-shop-item" onclick="sellItem('crop',18)">Jual</button></div>
        `;
    } else if (type === 'dudung') {
        title.innerText = "🎣 TOKO PANCING & HASIL TANGKAPAN (MANG DUDUNG)";
        content.innerHTML = `
            <div class="shop-row">
                <div><b>Set Alat Pancing</b> - 50 Gold<br><small style="color:#aaa;">Wajib dimiliki untuk memancing</small></div>
                <button class="btn-shop-item" onclick="buyFishingRod()">${stats.hasFishingRod ? 'Sudah Punya' : 'Beli'}</button>
            </div>
            <div class="shop-row"><span>Umpan Cacing (5 Biji) - 10 Gold</span><button class="btn-shop-item" onclick="buyBait(5, 10)">Beli</button></div>
            <hr style="border-color:#444;">
            <div class="shop-row"><span>Jual 1 Ikan Mujair (+12 Gold)</span><button class="btn-shop-item" onclick="sellFish('mujair',12)">Jual</button></div>
            <div class="shop-row"><span>Jual 1 Ikan Lele (+20 Gold)</span><button class="btn-shop-item" onclick="sellFish('lele',20)">Jual</button></div>
            <div class="shop-row"><span>Jual 1 Ikan Emas (+35 Gold)</span><button class="btn-shop-item" onclick="sellFish('emas',35)">Jual</button></div>
            <div class="shop-row"><span>Jual 1 Ikan Toman (+75 Gold)</span><button class="btn-shop-item" onclick="sellFish('toman',75)">Jual</button></div>
        `;
    } else if (type === 'mamat_coop') {
        title.innerText = "🏠 PEMBANGUNAN KANDANG & SILO (PAK MAMAT)";
        content.innerHTML = `
            <div class="shop-row">
                <div><b>Kandang Ayam</b><br><small style="color:#aaa;">Butuh: 6 Kayu, 4 Batu, 60 Gold</small></div>
                <button class="btn-shop-item" onclick="buildCoop('chicken')">${stats.hasChickenCoop ? 'Sudah Ada' : 'Bangun'}</button>
            </div>
            <div class="shop-row">
                <div><b>Kandang Sapi & Domba</b><br><small style="color:#aaa;">Butuh: 12 Kayu, 8 Batu, 120 Gold</small></div>
                <button class="btn-shop-item" onclick="buildCoop('big')">${stats.hasBigCoop ? 'Sudah Ada' : 'Bangun'}</button>
            </div>
            <div class="shop-row">
                <div><b>Silo Penampung Pakan</b><br><small style="color:#aaa;">Butuh: 10 Kayu, 10 Batu, 100 Gold</small></div>
                <button class="btn-shop-item" onclick="buildCoop('silo')">${stats.hasSilo ? 'Sudah Ada' : 'Bangun'}</button>
            </div>
        `;
    } else if (type === 'mamat_livestock') {
        title.innerText = "🐮 PEMBELIAN HEWAN TERNAK";
        content.innerHTML = `
            <div class="shop-row">
                <div><b>Ayam</b> - 35 Gold<br><small style="color:#aaa;">Membutuhkan Kandang Ayam</small></div>
                <button class="btn-shop-item" onclick="buyLivestock('chicken', 35)">Beli</button>
            </div>
            <div class="shop-row">
                <div><b>Sapi</b> - 90 Gold<br><small style="color:#aaa;">Membutuhkan Kandang Sapi & Domba</small></div>
                <button class="btn-shop-item" onclick="buyLivestock('cow', 90)">Beli</button>
            </div>
            <div class="shop-row">
                <div><b>Domba</b> - 70 Gold<br><small style="color:#aaa;">Membutuhkan Kandang Sapi & Domba</small></div>
                <button class="btn-shop-item" onclick="buyLivestock('sheep', 70)">Beli</button>
            </div>
        `;
    } else if (type === 'mamat_shop') {
        title.innerText = "🥛 KEDAI PETERNAKAN & PAKAN (PAK MAMAT)";
        content.innerHTML = `
            <div class="shop-row"><span>Pakan Ternak siap pakai - 6 Gold</span><button class="btn-shop-item" onclick="buyItem('fodder',6)">Beli</button></div>
            <div class="shop-row"><span>Benih Pakan Ternak - 8 Gold</span><button class="btn-shop-item" onclick="buyItem('fodderSeeds',8)">Beli</button></div>
            <div class="shop-row"><span>Susu Murni (Pulih 30 Stamina) - 15 Gold</span><button class="btn-shop-item" onclick="buyItem('milk',15)">Beli</button></div>
            <div class="shop-row"><span>Telur Ayam - 10 Gold</span><button class="btn-shop-item" onclick="buyItem('egg',10)">Beli</button></div>
            <hr style="border-color:#444;">
            <div class="shop-row"><span>Jual 1 Susu (+22 Gold)</span><button class="btn-shop-item" onclick="sellItem('milk',22)">Jual</button></div>
            <div class="shop-row"><span>Jual 1 Telur (+14 Gold)</span><button class="btn-shop-item" onclick="sellItem('egg',14)">Jual</button></div>
            <div class="shop-row"><span>Jual 1 Wol Domba (+28 Gold)</span><button class="btn-shop-item" onclick="sellItem('wool',28)">Jual</button></div>
        `;
    } else if (type === 'siti') {
        title.innerText = "🔨 BENGKEL PANDAI BESI (NENG SITI)";
        content.innerHTML = `
            <div class="shop-row"><span>Upgrade Kapak (Tembaga/Silver/Diamond)</span><button class="btn-shop-item" onclick="upgradeAxe()">Upgrade</button></div>
            <div class="shop-row"><span>Upgrade Beliung (Tembaga/Silver/Diamond)</span><button class="btn-shop-item" onclick="upgradePick()">Upgrade</button></div>
            <div class="shop-row"><span>Tempa Pedang (Silver/Emas/Diamond)</span><button class="btn-shop-item" onclick="upgradeSword()">Upgrade</button></div>
        `;
    }
    if (closingDay !== null) {
        content.insertAdjacentHTML('afterbegin', `<div style="text-align:center;color:#ffcc66;font-size:12px;margin-bottom:8px;">📅 Tutup setiap ${getWeekdayName(closingDay + 1)}</div>`);
    }
}

function buyFishingRod() {
    if (stats.hasFishingRod) return showNotification("⚠️ Kamu sudah punya Pancingan!");
    if (stats.gold >= 50) {
        stats.gold -= 50;
        stats.hasFishingRod = true;
        showNotification("🎣 Membeli Set Alat Pancing! Beli umpan & siap memancing.");
        updateUI();
        openShop('dudung');
    } else showNotification("⚠️ Gold tidak cukup!");
}

function buyBait(count, price) {
    if (stats.gold >= price) {
        stats.gold -= price;
        stats.baitCount += count;
        showNotification(`🪱 Mendapatkan +${count} Umpan Pancing!`);
        updateUI();
    } else showNotification("⚠️ Gold tidak cukup!");
}

function sellFish(type, price) {
    if (stats.fishes[type] > 0) {
        stats.fishes[type]--;
        stats.gold += price;
        updateUI();
        openShop('dudung');
        showNotification(`💰 Terjual 1 Ikan! (+${price} Gold)`);
    } else showNotification("⚠️ Kamu tidak punya jenis ikan ini!");
}

function buildCoop(coopType) {
    if (coopType === 'chicken') {
        if (stats.hasChickenCoop) return showNotification("⚠️ Kamu sudah membangun Kandang Ayam!");
        if (stats.wood >= 6 && stats.stone >= 4 && stats.gold >= 60) {
            stats.wood -= 6; stats.stone -= 4; stats.gold -= 60;
            stats.hasChickenCoop = true;
            buildChickenCoopMesh();
            showNotification("🏠 Kandang Ayam berhasil dibangun!");
            updateUI();
            closeModal();
        } else showNotification("⚠️ Bahan/Gold tidak cukup! (6 Kayu, 4 Batu, 60 Gold)");
    } else if (coopType === 'big') {
        if (stats.hasBigCoop) return showNotification("⚠️ Kamu sudah membangun Kandang Sapi & Domba!");
        if (stats.wood >= 12 && stats.stone >= 8 && stats.gold >= 120) {
            stats.wood -= 12; stats.stone -= 8; stats.gold -= 120;
            stats.hasBigCoop = true;
            buildBigCoopMesh();
            showNotification("🏠 Kandang Sapi & Domba berhasil dibangun!");
            updateUI();
            closeModal();
        } else showNotification("⚠️ Bahan/Gold tidak cukup! (12 Kayu, 8 Batu, 120 Gold)");
    } else if (coopType === 'silo') {
        if (stats.hasSilo) return showNotification("⚠️ Kamu sudah membangun Silo!");
        if (stats.wood >= 10 && stats.stone >= 10 && stats.gold >= 100) {
            stats.wood -= 10; stats.stone -= 10; stats.gold -= 100;
            stats.hasSilo = true;
            buildSiloMesh();
            showNotification("🏰 Silo Pakan berhasil dibangun!");
            updateUI();
            closeModal();
        } else showNotification("⚠️ Bahan/Gold tidak cukup! (10 Kayu, 10 Batu, 100 Gold)");
    }
}

function buyLivestock(type, cost) {
    if (type === 'chicken') {
        if (!stats.hasChickenCoop) return showNotification("⚠️ Bangun Kandang Ayam terlebih dahulu!");
        if (stats.chickensCount >= 5) return showNotification("⚠️ Kandang Ayam sudah penuh (Maks 5)!");
        if (stats.gold >= cost) {
            stats.gold -= cost;
            stats.chickensCount++;
            createAnimal('chicken');
            showNotification("🐔 Membeli 1 Ayam!");
            updateUI();
        } else showNotification("⚠️ Gold tidak cukup!");
    } else if (type === 'cow') {
        if (!stats.hasBigCoop) return showNotification("⚠️ Bangun Kandang Sapi & Domba terlebih dahulu!");
        if (stats.cowsCount + stats.sheepsCount >= 6) return showNotification("⚠️ Kandang Besar sudah penuh (Maks 6 hewan)!");
        if (stats.gold >= cost) {
            stats.gold -= cost;
            stats.cowsCount++;
            createAnimal('cow');
            showNotification("🐮 Membeli 1 Sapi!");
            updateUI();
        } else showNotification("⚠️ Gold tidak cukup!");
    } else if (type === 'sheep') {
        if (!stats.hasBigCoop) return showNotification("⚠️ Bangun Kandang Sapi & Domba terlebih dahulu!");
        if (stats.cowsCount + stats.sheepsCount >= 6) return showNotification("⚠️ Kandang Besar sudah penuh (Maks 6 hewan)!");
        if (stats.gold >= cost) {
            stats.gold -= cost;
            stats.sheepsCount++;
            createAnimal('sheep');
            showNotification("🐑 Membeli 1 Domba!");
            updateUI();
        } else showNotification("⚠️ Gold tidak cukup!");
    }
    checkQuestProgress();
}

function upgradeAxe() {
    if (stats.axeLvl >= 3) { showNotification("⚠️ Kapak sudah level maksimal!"); return; }
    const advanced = stats.axeLvl === 2;
    const canUpgrade = advanced
        ? stats.gold >= 140 && stats.wood >= 8 && stats.silver >= 3 && stats.diamond >= 1
        : stats.gold >= 50 && stats.wood >= 5 && stats.copper >= 2;
    if (canUpgrade) {
        if (advanced) { stats.gold -= 140; stats.wood -= 8; stats.silver -= 3; stats.diamond--; }
        else { stats.gold -= 50; stats.wood -= 5; stats.copper -= 2; }
        stats.axeLvl++;
        showNotification(`🔨 Kapak berhasil diupgrade ke Level ${stats.axeLvl}!`);
        updateUI();
    } else showNotification(advanced ? "⚠️ Butuh 8 Kayu, 3 Silver, 1 Diamond, 140 Gold." : "⚠️ Butuh 5 Kayu, 2 Tembaga, 50 Gold.");
}

function upgradePick() {
    if (stats.pickLvl >= 3) { showNotification("⚠️ Beliung sudah level maksimal!"); return; }
    const advanced = stats.pickLvl === 2;
    const canUpgrade = advanced
        ? stats.gold >= 140 && stats.stone >= 8 && stats.silver >= 3 && stats.diamond >= 1
        : stats.gold >= 50 && stats.stone >= 5 && stats.copper >= 2;
    if (canUpgrade) {
        if (advanced) { stats.gold -= 140; stats.stone -= 8; stats.silver -= 3; stats.diamond--; }
        else { stats.gold -= 50; stats.stone -= 5; stats.copper -= 2; }
        stats.pickLvl++;
        showNotification(`🔨 Beliung berhasil diupgrade ke Level ${stats.pickLvl}!`);
        updateUI();
    } else showNotification(advanced ? "⚠️ Butuh 8 Batu, 3 Silver, 1 Diamond, 140 Gold." : "⚠️ Butuh 5 Batu, 2 Tembaga, 50 Gold.");
}

function upgradeSword() {
    if (!stats.hasSword) return showNotification("⚠️ Beli Pedang terlebih dahulu!");
    if (stats.swordDamage >= 50) return showNotification("⚠️ Pedang sudah level maksimal!");
    const advanced = stats.swordDamage >= 30;
    const canUpgrade = advanced
        ? stats.gold >= 250 && stats.oreGold >= 3 && stats.diamond >= 2
        : stats.gold >= 120 && stats.silver >= 3 && stats.oreGold >= 1;
    if (canUpgrade) {
        if (advanced) { stats.gold -= 250; stats.oreGold -= 3; stats.diamond -= 2; stats.swordDamage = 50; }
        else { stats.gold -= 120; stats.silver -= 3; stats.oreGold--; stats.swordDamage = 30; }
        showNotification(`⚔️ Pedang ditempa menjadi Level ${advanced ? 3 : 2}! Damage meningkat.`);
        updateUI();
    } else showNotification(advanced ? '⚠️ Butuh 3 Emas, 2 Diamond, 250 Gold.' : '⚠️ Butuh 3 Silver, 1 Emas, 120 Gold.');
}

function buySword() {
    if (stats.hasSword) return showNotification("⚠️ Sudah punya Pedang!");
    if (stats.gold >= 80) {
        stats.gold -= 80; stats.hasSword = true;
        showNotification("⚔️ Beli Pedang Besi! Pilih Slot [6].");
        updateUI();
    } else showNotification("⚠️ Gold tidak cukup!");
}

function sellItem(item, price) {
    if (stats[item] > 0) {
        stats[item]--; stats.gold += price; updateUI();
        showNotification(`💰 Terjual! (+${price} Gold)`);
    } else showNotification("⚠️ Barang tidak ada!");
}

function buyItem(item, price) {
    if (stats.gold >= price) {
        stats.gold -= price; stats[item]++; updateUI();
        showNotification("✅ Pembelian Berhasil!");
    } else showNotification("⚠️ Gold tidak cukup!");
}

function usePotion() {
    if (stats.potion > 0) {
        if (stats.hp >= stats.maxHp) {
            showNotification("⚠️ HP kamu sudah penuh!");
            return;
        }
        stats.potion--; 
        stats.hp = Math.min(stats.maxHp, stats.hp + 40);
        updateUI(); 
        showNotification("🧪 Meminum Potion (+40 HP)");
    } else {
        showNotification("⚠️ Potion kamu habis!");
    }
}

function closeModal() {
    isUIOpen = false;
    document.querySelectorAll('.modal-box').forEach(m => m.style.display = 'none');
    if (stats.hp > 0 && !isGamePaused) document.body.requestPointerLock();
}

function setSlot(num) {
    activeSlot = num;
    document.querySelectorAll('.inv-slot').forEach(s => s.classList.remove('active'));
    const targetSlot = document.getElementById(`slot-${num}`);
    if (targetSlot) targetSlot.classList.add('active');

    // Tampilkan/sembunyikan joran di tangan
    if (fishingRodMesh) {
        fishingRodMesh.visible = (num === 3);
    }
}

function showNotification(text) {
    const notif = document.getElementById('notification');
    notif.innerText = text;
    notif.style.display = 'block';
    setTimeout(() => { notif.style.display = 'none'; }, 2200);
}

function addEXP(amount) {
    stats.exp += amount;
    if (stats.exp >= stats.nextExp) {
        stats.level++;
        stats.exp -= stats.nextExp;
        stats.nextExp = Math.floor(stats.nextExp * 1.5);

        stats.maxHp += 15;

        stats.hp = stats.maxHp;
        stats.stamina = stats.maxStamina;

        showNotification(`🎉 LEVEL UP! Level ${stats.level} | Max HP bertambah! Cari Buah Ajaib untuk menaikkan stamina.`);
    }
    updateUI();
}

function collectMagicFruit(source) {
    if (!stats.magicFruits || stats.magicFruits[source]) return false;
    stats.magicFruits[source] = true;
    stats.maxStamina += 10;
    stats.stamina = stats.maxStamina;
    const sourceNames = { dungeon: 'Dungeon', mine: 'Tambang', quest: 'Misi', hidden: 'Tempat tersembunyi' };
    showNotification(`🍎 Buah Ajaib ditemukan dari ${sourceNames[source]}! Max Stamina +10.`);
    updateUI();
    return true;
}

function checkGameOver() {
    if (stats.hp <= 0) {
        moveForward = moveBackward = moveLeft = moveRight = false;
        if (dungeonState.active && !dungeonDeathHandled) {
            dungeonDeathHandled = true;
            exitDungeon();
            loseDungeonItems();
            updateUI();
        }
        if (mineState.active) {
            abandonMineOnDeath();
            loseDungeonItems();
            updateUI();
        }
        if (document.pointerLockElement) document.exitPointerLock();
        isUIOpen = true;
        closeModal();
        document.getElementById('instructions').style.display = 'none';
        document.getElementById('game-over-modal').style.display = 'block';
    }
}

function respawnPlayer() {
    stats.hp = stats.maxHp;
    stats.stamina = stats.maxStamina;
    player.position.set(0, 5, -42);
    dungeonDeathHandled = false;
    document.getElementById('game-over-modal').style.display = 'none';
    isUIOpen = false;
    updateUI();
    document.body.requestPointerLock();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateUI() {
    document.getElementById('lvl-count').innerText = stats.level;
    document.getElementById('exp-count').innerText = stats.exp;
    document.getElementById('exp-next').innerText = stats.nextExp;
    document.getElementById('exp-fill').style.width = `${(stats.exp / stats.nextExp) * 100}%`;

    document.getElementById('hp-count').innerText = stats.hp;
    document.getElementById('maxhp-count').innerText = stats.maxHp;
    document.getElementById('stamina-count').innerText = Math.floor(stats.stamina);
    document.getElementById('maxstamina-count').innerText = stats.maxStamina;
    document.getElementById('stamina-fill').style.width = `${(stats.stamina / stats.maxStamina) * 100}%`;

    document.getElementById('gold-count').innerText = stats.gold;
    document.getElementById('magic-fruit-count').innerText = `${Object.values(stats.magicFruits).filter(Boolean).length}/4`;
    document.getElementById('wood-count').innerText = stats.wood;
    document.getElementById('stone-count').innerText = stats.stone;
    document.getElementById('copper-count').innerText = stats.copper;
    document.getElementById('silver-count').innerText = stats.silver;
    document.getElementById('ore-gold-count').innerText = stats.oreGold;
    document.getElementById('diamond-count').innerText = stats.diamond;
    
    // UI Ikan & Umpan
    document.getElementById('bait-count').innerText = stats.baitCount;
    document.getElementById('fish-mujair-count').innerText = stats.fishes.mujair;
    document.getElementById('fish-lele-count').innerText = stats.fishes.lele;
    document.getElementById('fish-emas-count').innerText = stats.fishes.emas;
    document.getElementById('fish-toman-count').innerText = stats.fishes.toman;

    document.getElementById('crop-count').innerText = stats.crop;
    document.getElementById('fodder-count').innerText = stats.fodder;
    document.getElementById('silo-count').innerText = stats.siloStorage;
    document.getElementById('silo-max').innerText = stats.siloMaxStorage;
    document.getElementById('milk-count').innerText = stats.milk;
    document.getElementById('egg-count').innerText = stats.egg;
    document.getElementById('wool-count').innerText = stats.wool;
    document.getElementById('seed-count').innerText = stats.seeds;
    document.getElementById('fodder-seed-count').innerText = stats.fodderSeeds;
    document.getElementById('potion-count').innerText = stats.potion;

    document.getElementById('day-count').innerText = getWeekdayName();
    let hrs = stats.hour < 10 ? `0${stats.hour}` : stats.hour;
    let mins = Math.floor(stats.minute) < 10 ? `0${Math.floor(stats.minute)}` : Math.floor(stats.minute);
    document.getElementById('clock-count').innerText = `${hrs}:${mins}`;

    checkGameOver();
}

function animate() {
    requestAnimationFrame(animate);

    if (stats.hp <= 0) {
        renderer.render(scene, camera);
        return;
    }

    const time = performance.now();
    const delta = (time - prevTime) / 1000;
    prevTime = time;
    updateAmbienceArea();
    updateSky(delta);
    dungeonLights.forEach(torch => {
        const flicker = 0.82 + Math.sin(performance.now() * 0.012 + torch.phase) * 0.12 + Math.sin(performance.now() * 0.027 + torch.phase) * 0.06;
        torch.light.intensity = 1.6 * flicker;
        torch.flame.scale.set(0.9 + flicker * 0.12, 0.85 + flicker * 0.18, 0.9 + flicker * 0.12);
    });
    if (hotSpringCooldown > 0) hotSpringCooldown = Math.max(0, hotSpringCooldown - delta);
    if (hotSpringGroup) {
        hotSpringGroup.children.forEach((obj, i) => {
            if (obj.userData && obj.userData.baseY) {
                obj.position.y = obj.userData.baseY + Math.sin(performance.now()*0.001 + obj.userData.phase) * 0.18;
                obj.material.opacity = 0.14 + (Math.sin(performance.now()*0.0015 + i) + 1) * 0.04;
            }
        });
    }

    if (textures.water) {
        textures.water.offset.y += delta * 0.1;
    }

    nameplates.forEach(np => np.quaternion.copy(camera.quaternion));

    if (isGamePaused) {
        renderer.render(scene, camera);
        return;
    }

    if (!isUIOpen) {
        updateGameTime(delta);
    }
    
    updateWalkingNPC(delta);
    updateMonsters(delta);
    updateDamageTexts(delta);
    updateAnimals(delta);
    updateFishingAnimation(delta);

    if (isLocked && !isUIOpen) {
        playerVelocity.y -= 25 * delta;
        const inputVec = new THREE.Vector3();
        if (moveForward) inputVec.z -= 1;
        if (moveBackward) inputVec.z += 1;
        if (moveLeft) inputVec.x -= 1;
        if (moveRight) inputVec.x += 1;

        inputVec.normalize().applyQuaternion(player.quaternion);
        const moveX = inputVec.x * 12 * delta;
        const moveZ = inputVec.z * 12 * delta;
        const nextX = player.position.x + moveX;
        const nextZ = player.position.z + moveZ;
        if (!isBlockedByBuilding(nextX, player.position.z)) player.position.x = nextX;
        if (!isBlockedByBuilding(player.position.x, nextZ)) player.position.z = nextZ;
        player.position.y += playerVelocity.y * delta;

        if (player.position.y < 1.6) {
            playerVelocity.y = 0; player.position.y = 1.6; isGrounded = true;
        }
        updateMountainGround();

        checkDoorTarget();
        checkSleepTarget();
        if (insideBuilding) checkInteriorNPCTarget();

        const distWalidesa = player.position.distanceTo(npcWalidesa.position);
        const distMamat = player.position.distanceTo(npcPakMamat.position);
        const distSiti = player.position.distanceTo(npcNengSiti.position);
        const distDudung = player.position.distanceTo(npcMangDudung.position);
        const distJaja = player.position.distanceTo(npcPamanJaja.position);
        const distHouse = player.position.distanceTo(houseMesh.position);
        let nearbyPartner = null;
        partnerNPCs.forEach(partner => {
            if (player.position.distanceTo(partner.position) < 6 && (!nearbyPartner || player.position.distanceTo(partner.position) < nearbyPartner.distance)) {
                nearbyPartner = { mesh: partner, distance: player.position.distanceTo(partner.position), key: partner.userData.partnerKey };
            }
        });
        let nearbyFamily = null;
        familyNPCs.forEach(familyMember => {
            const distance = player.position.distanceTo(familyMember.position);
            if (distance < 5 && (!nearbyFamily || distance < nearbyFamily.distance)) {
                nearbyFamily = { mesh: familyMember, distance, key: familyMember.userData.interactionKey };
            }
        });

        activeTargetObject = null;
        if (!mineState.active && mineEntranceMesh && player.position.distanceTo(mineEntranceMesh.position) < 9) {
            activeTargetObject = 'mine_entrance';
        } else if (mineState.active && mineStairsMesh && player.position.distanceTo(mineStairsMesh.getWorldPosition(new THREE.Vector3())) < 5) {
            activeTargetObject = 'mine_stairs';
        } else if (mineState.active && mineLiftMesh && player.position.distanceTo(mineLiftMesh.getWorldPosition(new THREE.Vector3())) < 5) {
            activeTargetObject = 'mine_lift';
        } else if (mineState.active && mineExitMesh && player.position.distanceTo(mineExitMesh.getWorldPosition(new THREE.Vector3())) < 5) {
            activeTargetObject = 'mine_exit';
        } else if (!dungeonState.active && dungeonEntranceMesh && player.position.distanceTo(dungeonEntranceMesh.position) < 9) {
            activeTargetObject = 'dungeon_entrance';
        } else if (dungeonState.active && dungeonStairsMesh && player.position.distanceTo(dungeonStairsMesh.getWorldPosition(new THREE.Vector3())) < 5) {
            activeTargetObject = 'dungeon_stairs';
        } else if (siloMesh && player.position.distanceTo(siloMesh.position) < 5) {
            activeTargetObject = 'silo';
        } else if (chickenFeederMesh && player.position.distanceTo(chickenFeederMesh.getWorldPosition(new THREE.Vector3())) < 4) {
            activeTargetObject = 'feeder_chicken';
        } else if (bigFeederMesh && player.position.distanceTo(bigFeederMesh.getWorldPosition(new THREE.Vector3())) < 5) {
            activeTargetObject = 'feeder_big';
        } else if (hotSpringGroup && player.position.distanceTo(hotSpringGroup.position) < 8) {
            activeTargetObject = 'hotspring';
        }

        activeTargetAnimal = null;
        for (let a of animals) {
            if (player.position.distanceTo(a.mesh.position) < 3.5) {
                activeTargetAnimal = a;
                break;
            }
        }

        const prompt = document.getElementById('prompt');
        if (activeTargetSleep) {
            activeTargetNPC = null;
            prompt.innerText = 'Tekan [E] Tidur & Lewati Hari';
            prompt.style.display = 'block';
        } else if (activeTargetDoor) {
            prompt.innerText = activeTargetDoor.isExit ? 'Tekan [E] Keluar dari Bangunan' : `Tekan [E] Masuk ke ${activeTargetDoor.label}`;
            prompt.style.display = 'block';
        } else if (insideBuilding && activeTargetNPC) {
            const npcNames = { walidesa: 'Walidesa', mamat: 'Pak Mamat', siti: 'Neng Siti', dudung: 'Mang Dudung', jaja: 'Paman Jaja' };
            prompt.innerText = `Tekan [E] Bicara dengan ${npcNames[activeTargetNPC] || 'NPC'}`;
            prompt.style.display = 'block';
        } else if (activeTargetAnimal) {
            activeTargetNPC = null;
            if (activeTargetAnimal.hasProduce) {
                let actionText = activeTargetAnimal.type === 'chicken' ? 'Ambil Telur' : (activeTargetAnimal.type === 'cow' ? 'Perah Susu' : 'Cukur Wol');
                prompt.innerText = `Tekan [E] ${actionText} (${activeTargetAnimal.type.toUpperCase()})`;
            } else {
                let statusText = activeTargetAnimal.isFed ? 'Kenyang' : 'Lapar (Beri Makan)';
                prompt.innerText = `Tekan [E] Beri Makan (${activeTargetAnimal.type.toUpperCase()} - ${statusText})`;
            }
            prompt.style.display = 'block';
        } else if (activeTargetObject === 'silo') {
            prompt.innerText = `Tekan [E] Simpan Pakan ke Silo (${stats.siloStorage}/${stats.siloMaxStorage})`;
            prompt.style.display = 'block';
        } else if (activeTargetObject === 'feeder_chicken') {
            prompt.innerText = "Tekan [E] Isi Palung Pakan Ayam";
            prompt.style.display = 'block';
        } else if (activeTargetObject === 'feeder_big') {
            prompt.innerText = "Tekan [E] Isi Palung Pakan Sapi & Domba";
            prompt.style.display = 'block';
        } else if (activeTargetObject === 'hotspring') {
            prompt.innerText = hotSpringCooldown > 0 ? `♨️ Pemandian sedang cooldown (${Math.ceil(hotSpringCooldown)} dtk)` : "Tekan [E] Berendam & Isi Energi";
            prompt.style.display = 'block';
        } else if (activeTargetObject === 'dungeon_entrance') {
            prompt.innerText = 'Tekan [E] Masuk ke Dungeon Senja';
            prompt.style.display = 'block';
        } else if (activeTargetObject === 'dungeon_stairs') {
            prompt.innerText = dungeonEnemies.length > 0 ? 'Kalahkan semua monster untuk membuka tangga' : (dungeonState.floor === dungeonState.totalFloors ? 'Tekan [E] Ambil Reward Dungeon' : 'Tekan [E] Turun ke Lantai Berikutnya');
            prompt.style.display = 'block';
        } else if (activeTargetObject === 'mine_entrance') {
            prompt.innerText = 'Tekan [E] Masuk Tambang';
            prompt.style.display = 'block';
        } else if (activeTargetObject === 'mine_stairs') {
            prompt.innerText = mineState.stairsOpen ? 'Tekan [E] Turun ke lantai berikutnya' : 'Cari dan pecahkan batu kunci dengan Beliung';
            prompt.style.display = 'block';
        } else if (activeTargetObject === 'mine_lift') {
            prompt.innerText = mineState.floor % 5 === 0 ? 'Tekan [E] Simpan lantai di Lift' : 'Lift aktif setiap 5 lantai';
            prompt.style.display = 'block';
        } else if (activeTargetObject === 'mine_exit') {
            prompt.innerText = 'Tekan [E] Keluar dari Tambang';
            prompt.style.display = 'block';
        } else if (distWalidesa < 6) {
            activeTargetNPC = 'walidesa';
            prompt.innerText = "Tekan [E] Bicara dengan Walidesa";
            prompt.style.display = 'block';
        } else if (distMamat < 6) {
            activeTargetNPC = 'mamat';
            prompt.innerText = "Tekan [E] Bicara dengan Pak Mamat (Peternak)";
            prompt.style.display = 'block';
        } else if (distSiti < 6) {
            activeTargetNPC = 'siti';
            prompt.innerText = "Tekan [E] Bicara dengan Neng Siti (Pandai Besi)";
            prompt.style.display = 'block';
        } else if (distDudung < 6) {
            activeTargetNPC = 'dudung';
            prompt.innerText = "Tekan [E] Bicara dengan Mang Dudung (Nelayan)";
            prompt.style.display = 'block';
        } else if (distJaja < 6) {
            activeTargetNPC = 'jaja';
            prompt.innerText = "Tekan [E] Bicara dengan Paman Jaja";
            prompt.style.display = 'block';
        } else if (nearbyPartner) {
            activeTargetNPC = nearbyPartner.key;
            const profile = partnerProfiles.find(item => item.key === nearbyPartner.key);
            prompt.innerText = `Tekan [E] Bicara dengan ${profile.name}`;
            prompt.style.display = 'block';
        } else if (nearbyFamily) {
            activeTargetNPC = nearbyFamily.key;
            prompt.innerText = `Tekan [E] Bicara dengan ${nearbyFamily.mesh.userData.familyName}`;
            prompt.style.display = 'block';
        } else if (distHouse < 8) {
            activeTargetNPC = 'house';
            prompt.innerText = "Tekan [E] Tidur & Lewati Hari";
            prompt.style.display = 'block';
        } else {
            activeTargetNPC = null;
            prompt.style.display = 'none';
        }

        monsters.forEach(m => {
            let dist = m.mesh.position.distanceTo(player.position);
            if (dist < 15 && dist > 1.8) {
                m.mesh.lookAt(player.position.x, m.mesh.position.y, player.position.z);
                m.mesh.translateZ(m.speed);
            } else if (dist <= 1.8) {
                m.attackTimer += delta;
                if (m.attackTimer >= 1.5) {
                    const damage = m.damage || 8;
                    stats.hp = Math.max(0, stats.hp - damage);
                    showDamageText(player.position, damage, '#ff4757');
                    showNotification(`⚠️ Diserang Monster! (-${damage} HP)`);
                    updateUI();
                    m.attackTimer = 0;
                }
            }
        });
    }

    renderer.render(scene, camera);
}

function createMine() {
    const mine = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.95 });
    const stoneMat = new THREE.MeshStandardMaterial({ map: textures.stone, roughness: 1 });
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 5, 0.6), woodMat);
    const postR = postL.clone(); postR.position.x = 7;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(8, 0.7, 0.7), woodMat);
    beam.position.set(3.5, 4.6, 0);
    const darkOpening = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0x16131b }));
    darkOpening.rotation.x = Math.PI / 2;
    darkOpening.position.set(3.5, 2.2, 0.35);
    mine.add(postL, postR, beam, darkOpening);
    mine.position.set(78, 0, 25);
    const label = createNameplate('⛏️ TAMBANG MINERAL', 'rgba(30,25,20,.95)', '#ffd166');
    label.position.set(3.5, 6.5, 0);
    mine.add(label);
    scene.add(mine);
    mineEntranceMesh = mine;

    mineRoom = new THREE.Group();
    const roomFloor = new THREE.Mesh(new THREE.BoxGeometry(38, 0.3, 34), stoneMat);
    roomFloor.position.y = -0.15;
    const roomWallMat = new THREE.MeshStandardMaterial({ color: 0x302b35, roughness: 1 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(38, 8, 0.5), roomWallMat);
    backWall.position.set(0, 4, -17);
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 34), roomWallMat);
    leftWall.position.set(-19, 4, 0);
    const rightWall = leftWall.clone(); rightWall.position.x = 19;
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(38, 0.5, 34), new THREE.MeshStandardMaterial({ color: 0x17151d }));
    ceiling.position.y = 8;
    mineRoom.add(roomFloor, backWall, leftWall, rightWall, ceiling);
    mineRoom.position.set(120, 0, 25);
    scene.add(mineRoom);
    mineRoom.visible = false;

    mineStairsMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0x77717f, roughness: 0.8 }));
    mineStairsMesh.position.set(0, 0.2, 13);
    mineLiftMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0xd4ac0d, emissive: 0x5a3d00, emissiveIntensity: 0.35 }));
    mineLiftMesh.position.set(12, 0.2, 0);
    mineExitMesh = new THREE.Mesh(new THREE.TorusGeometry(2, 0.3, 8, 16), new THREE.MeshBasicMaterial({ color: 0x9b59b6 }));
    mineExitMesh.rotation.x = Math.PI / 2;
    mineExitMesh.position.set(-12, 0.3, 0);
    mineRoom.add(mineStairsMesh, mineLiftMesh, mineExitMesh);
    const stairsLabel = createNameplate('🪨 TANGGA', 'rgba(25,20,30,.9)', '#dfe6e9');
    stairsLabel.position.set(0, 1.4, 13);
    const liftLabel = createNameplate('🛗 LIFT CHECKPOINT', 'rgba(25,20,30,.9)', '#ffd166');
    liftLabel.position.set(12, 1.4, 0);
    const exitLabel = createNameplate('🚪 KELUAR', 'rgba(25,20,30,.9)', '#c8d6e5');
    exitLabel.position.set(-12, 1.4, 0);
    mineRoom.add(stairsLabel, liftLabel, exitLabel);
    const mineLight = new THREE.PointLight(0xff8a3d, 1.2, 32);
    mineLight.position.set(0, 6, 0);
    mineRoom.add(mineLight);
}

function getMineMineral(floor) {
    if (floor <= 10) return ['copper', 0xd97736];
    if (floor <= 20) return ['silver', 0xdfe6e9];
    if (floor <= 30) return ['oreGold', 0xffd166];
    return ['diamond', 0x74f2ff];
}

function clearMineFloor() {
    mineNodes.forEach(node => scene.remove(node.mesh));
    mineNodes = [];
    if (mineKeyRock) scene.remove(mineKeyRock);
    mineKeyRock = null;
    if (mineFloorLabel && mineRoom) mineRoom.remove(mineFloorLabel);
    mineFloorLabel = null;
    worldObjects = worldObjects.filter(object => !object.mine);
}

function createMineRock(type, position, color, isKey = false) {
    const rock = new THREE.Group();
    const base = new THREE.Mesh(new THREE.DodecahedronGeometry(isKey ? 1.45 : 1.15, 1), new THREE.MeshStandardMaterial({ map: textures.stone, roughness: 1 }));
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(isKey ? 0.35 : 0.55, 1), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: isKey ? 0.2 : 0.8, metalness: 0.35, roughness: 0.25 }));
    crystal.position.y = 0.8;
    rock.add(base, crystal);
    rock.position.copy(position);
    scene.add(rock);
    const object = { mesh: rock, type: isKey ? 'mine_key' : 'mineral', mineral: type, hp: isKey ? 3 : 2, color, mine: true };
    worldObjects.push(object);
    if (isKey) mineKeyRock = rock;
    else mineNodes.push(object);
}

function spawnMineFloor(floor) {
    clearMineFloor();
    const [mineral, color] = getMineMineral(floor);
    [[-12, -8], [0, -10], [12, -7], [-10, 5], [4, 6], [14, 10]].forEach(([x, z], index) => {
        createMineRock(mineral, new THREE.Vector3(120 + x, 0.8, 25 + z), color);
    });
    createMineRock('stone', new THREE.Vector3(120, 0.8, 25), 0x8d99ae, true);
    mineState.floor = floor;
    mineState.stairsOpen = false;
    mineFloorLabel = createNameplate(`⛏️ LANTAI TAMBANG ${floor}/50`, 'rgba(25,20,30,.92)', '#ffd166');
    mineFloorLabel.position.set(0, 6.7, -13);
    mineRoom.add(mineFloorLabel);
    showNotification(`⛏️ Lantai ${floor}: hancurkan batu kunci untuk menemukan tangga.`);
}

function enterMine() {
    mineState.active = true;
    if (mineRoom) mineRoom.visible = true;
    mineEntranceMesh.visible = false;
    spawnMineFloor(mineState.floor || mineState.checkpoint);
    player.position.set(120, 1.6, 15);
    showNotification(`⛏️ Memasuki lantai tambang ${mineState.floor}.`);
}

function exitMine() {
    clearMineFloor();
    if (mineRoom) mineRoom.visible = false;
    if (mineEntranceMesh) mineEntranceMesh.visible = true;
    mineState.active = false;
    mineState.floor = 0;
    player.position.set(78, 1.6, 33);
    showNotification('🏕️ Keluar dari tambang.');
}

function abandonMineOnDeath() {
    clearMineFloor();
    if (mineRoom) mineRoom.visible = false;
    if (mineEntranceMesh) mineEntranceMesh.visible = true;
    mineState.active = false;
    mineState.floor = 0;
    player.position.set(78, 1.6, 33);
    showNotification('💀 Kamu pingsan di tambang. Kembali ke checkpoint lift terakhir.');
}

function advanceMineFloor() {
    if (!mineState.stairsOpen) {
        showNotification('⚠️ Hancurkan batu kunci terlebih dahulu!');
        return;
    }
    if (mineState.floor >= 50) {
        showNotification('🏆 Lantai terdalam tambang telah dicapai!');
        collectMagicFruit('mine');
        return;
    }
    const nextFloor = mineState.floor + 1;
    spawnMineFloor(nextFloor);
    player.position.set(120, 1.6, 15);
}

function saveMineCheckpoint() {
    if (mineState.floor % 5 !== 0) {
        showNotification('🛗 Lift aktif setiap 5 lantai.');
        return;
    }
    mineState.checkpoint = mineState.floor;
    showNotification(`🛗 Lift menyimpan checkpoint lantai ${mineState.floor}.`);
}