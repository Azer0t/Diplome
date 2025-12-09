/* ============================================
   ІМПОРТИ БІБЛІОТЕК ТА МОДУЛІВ
   ============================================ */
// Завантаження Three.js та необхідних модулів з CDN
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MathUtils } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

/* ============================================
   ОБРОБКА ПОМИЛОК ІМПОРТУ
   ============================================ */
// Перехоплення помилок завантаження модулів (наприклад, якщо не запущений локальний сервер)
window.addEventListener('error', (e) => {
    if (e.message.includes('Failed to resolve module specifier')) {
        console.error('Помилка імпорту Three.js. Переконайтеся, що <script type="module"> та локальний сервер запущено.');
        alert('Помилка: Перевірте консоль (F12). Запустіть через http://localhost.');
    }
});

/* ============================================
   ПОСИЛАННЯ НА DOM-ЕЛЕМЕНТИ
   ============================================ */
// Отримання посилань на HTML-елементи для подальшої роботи з ними
const app = document.getElementById('app');
const loadingOverlay = document.getElementById('loading');
const progressText = document.getElementById('progress-text');
const progressBar = document.getElementById('progress-bar');
const hotspotsRoot = document.getElementById('hotspots');
const infoPanel = document.getElementById('info-panel');
const infoTitle = document.getElementById('info-title');
const infoText = document.getElementById('info-text');
const infoImage = document.getElementById('info-image');
const infoClose = document.getElementById('info-close');

const btnOrbit = document.getElementById('btn-orbit');
const btnFps = document.getElementById('btn-fps');
const btnReset = document.getElementById('btn-reset');
const btnFullscreen = document.getElementById('btn-fullscreen');
const toggleShadows = document.getElementById('toggle-shadows');
const btnScreenshot = document.getElementById('btn-screenshot');
const annotationsList = document.getElementById('annotations-list');

/* ============================================
   НАЛАШТУВАННЯ РЕНДЕРЕРА
   ============================================ */
// Створення WebGL-рендерера для відображення 3D-сцени в браузері
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

/* ============================================
   СТВОРЕННЯ СЦЕНИ ТА КАМЕРИ
   ============================================ */
// Ініціалізація 3D-сцени та налаштування камери для огляду моделі
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe8f2);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 0, 0);

/* ============================================
   НАЛАШТУВАННЯ ОСВІТЛЕННЯ СЦЕНИ
   ============================================ */
// Створення системи освітлення для реалістичного відображення моделі.
// Використовується триточкова схема: ключове світло, заповнювальне та контрове, а також глобальне освітлення.
const hemi = new THREE.HemisphereLight(0xffffff, 0xaec4d8, 0.4);
scene.add(hemi);

const dirKey = new THREE.DirectionalLight(0xffffff, 1.8);
dirKey.position.set(14, 24, 10);
dirKey.castShadow = true;
dirKey.shadow.mapSize.set(2048, 2048);
dirKey.shadow.camera.near = 0.5;
dirKey.shadow.camera.far = 220;
dirKey.shadow.normalBias = 0.02;
scene.add(dirKey);


const dirFill = new THREE.DirectionalLight(0xfffbf0, 0.3);
dirFill.position.set(-18, 14, -12);
dirFill.castShadow = false;
scene.add(dirFill);


const dirRim = new THREE.DirectionalLight(0xd0e4ff, 0.25);
dirRim.position.set(-6, 18, 20);
dirRim.castShadow = false;
scene.add(dirRim);

/* ============================================
   СТВОРЕННЯ ПІДЛОГИ
   ============================================ */
// Додавання простої площини як підлоги для моделі (отримує тіні від об'єктів)
const groundGeo = new THREE.PlaneGeometry(400, 400);
const groundMat = new THREE.MeshStandardMaterial({ color: 0xcfd8e3, roughness: 1, metalness: 0 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
scene.add(ground);

/* ============================================
   ЗАВАНТАЖЕННЯ HDR-ОТОЧЕННЯ
   ============================================ */
// Завантаження HDR-текстури для реалістичного освітлення та відбиттів (PBR)
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader?.();
new RGBELoader()
    .load(
        'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/royal_esplanade_1k.hdr',
        (hdrTexture) => {
            const envMap = pmrem.fromEquirectangular(hdrTexture).texture;
            scene.environment = envMap;
            hdrTexture.dispose?.();
        },
        undefined,
        (e) => console.warn('HDR env load failed, continuing without it.', e)
    );

/* ============================================
   НАЛАШТУВАННЯ КОНТРОЛІВ КАМЕРИ
   ============================================ */
// Створення системи керування камерою: Orbit (обертання навколо моделі) та FPS (від першої особи)
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 2.5, 0);
orbit.enableDamping = true;
orbit.dampingFactor = 0.05;
orbit.minDistance = 2;
orbit.maxDistance = 80;
orbit.maxPolarAngle = Math.PI * 0.49;

// Початкова позиція камери
const initialDistance = 12;
camera.position.set(initialDistance, 6, initialDistance);
orbit.update();

const clock = new THREE.Clock();

// Змінні для керування режимом вільного польоту (Fly Mode)
let isFlying = false;
let isDragging = false;
const flySpeed = 15;
const flyLookSpeed = 0.003;
let flyEuler = new THREE.Euler(0, 0, 0, 'YXZ');

// Допоміжні об'єкти для обчислення орієнтації камери
let flyYaw = new THREE.Object3D();
let flyPitch = new THREE.Object3D();
flyYaw.add(flyPitch);

const moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };

let activeControls = 'orbit';
function setActiveControls(mode) {
    activeControls = mode;
    orbit.enabled = mode === 'orbit';
    isFlying = (mode === 'fly');

    if (isFlying) {
        // Ініціалізація орієнтації для режиму польоту на основі поточної камери
        flyEuler.setFromQuaternion(camera.quaternion);
        flyEuler.z = 0;

        btnOrbit.classList.remove('active');
        btnFps.classList.add('active');
        document.body.style.cursor = 'grab';
    } else {
        // Повернення до режиму Orbit: встановлення точки інтересу перед камерою
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(camera.quaternion);
        const target = camera.position.clone().add(direction.multiplyScalar(10));
        orbit.target.copy(target);

        btnOrbit.classList.add('active');
        btnFps.classList.remove('active');
        document.body.style.cursor = 'default';
        orbit.update();
    }
}

// Обробка миші для режиму Fly (огляд)
renderer.domElement.addEventListener('mousedown', (e) => {
    if (activeControls === 'fly' && e.button === 0) {
        isDragging = true;
        document.body.style.cursor = 'grabbing';
    }
});

window.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        if (activeControls === 'fly') document.body.style.cursor = 'grab';
    }
});

renderer.domElement.addEventListener('mousemove', (e) => {
    if (activeControls === 'fly' && isDragging) {
        const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0;
        const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0;

        flyEuler.y -= movementX * flyLookSpeed;
        flyEuler.x -= movementY * flyLookSpeed;

        // Обмеження кута огляду по вертикалі
        flyEuler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, flyEuler.x));

        camera.quaternion.setFromEuler(flyEuler);
    }
});

// Обробники клавіатури для переміщення
const onKeyDown = (event) => {
    switch (event.code) {
        case 'KeyW': moveState.forward = true; break;
        case 'KeyS': moveState.backward = true; break;
        case 'KeyA': moveState.left = true; break;
        case 'KeyD': moveState.right = true; break;
        case 'Space': moveState.up = true; event.preventDefault(); break;
        case 'ShiftLeft': moveState.down = true; break;
    }
};

const onKeyUp = (event) => {
    switch (event.code) {
        case 'KeyW': moveState.forward = false; break;
        case 'KeyS': moveState.backward = false; break;
        case 'KeyA': moveState.left = false; break;
        case 'KeyD': moveState.right = false; break;
        case 'Space': moveState.up = false; event.preventDefault(); break;
        case 'ShiftLeft': moveState.down = false; break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

/* ============================================
   ОБРОБНИКИ ПОДІЙ КНОПОК КЕРУВАННЯ
   ============================================ */
// Налаштування обробників для перемикання режимів камери та інших функцій UI
btnOrbit.addEventListener('click', () => {
    setActiveControls('orbit');
});
btnFps.addEventListener('click', () => setActiveControls('fly'));

// Гарячі клавіші
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key.toLowerCase()) {
        case '1':
            e.preventDefault();
            setActiveControls('orbit');
            btnOrbit.click();
            break;
        case '2':
            e.preventDefault();
            setActiveControls('fly');
            btnFps.click();
            break;
        case 'r':
            e.preventDefault();
            btnReset.click();
            break;
        case 'f':
            e.preventDefault();
            btnFullscreen.click();
            break;
        case 's':
            e.preventDefault();
            toggleShadows.checked = !toggleShadows.checked;
            toggleShadows.dispatchEvent(new Event('change'));
            break;
        case 'p':
            e.preventDefault();
            btnScreenshot?.click();
            break;
    }
});

// Скидання камери
btnReset.addEventListener('click', () => {
    if (activeControls === 'orbit') {
        const distance = 12;
        camera.position.set(distance, 6, distance);
        orbit.target.set(0, 2.5, 0);
        orbit.update();
    } else {
        camera.position.set(0, 2, 10);
        flyEuler.set(0, 0, 0, 'YXZ');
        camera.quaternion.setFromEuler(flyEuler);
    }
});

// Повноекранний режим
btnFullscreen.addEventListener('click', () => {
    const elem = document.querySelector('.viewer-3d');
    if (!document.fullscreenElement) {
        elem?.requestFullscreen?.();
    } else {
        document.exitFullscreen?.();
    }
});

// Перемикання тіней
toggleShadows.addEventListener('change', () => {
    const enabled = toggleShadows.checked;
    renderer.shadowMap.enabled = enabled;
    scene.traverse(obj => {
        if (obj.isMesh) {
            obj.castShadow = enabled;
            obj.receiveShadow = enabled;
        }
    });
});

/* ============================================
   МЕНЕДЖЕР ЗАВАНТАЖЕННЯ ТА ІНДИКАТОР ПРОГРЕСУ
   ============================================ */
// Відстеження прогресу завантаження
const loadingManager = new THREE.LoadingManager();
loadingManager.onProgress = (url, loaded, total) => {
    const pct = total ? Math.round((loaded / total) * 100) : 0;
    progressBar.style.width = pct + '%';
    progressText.textContent = `Завантаження… ${pct}%`;
};
loadingManager.onLoad = () => {
    loadingOverlay.style.display = 'none';
};

/* ============================================
   НАЛАШТУВАННЯ ЗАВАНТАЖУВАЧА МОДЕЛЕЙ
   ============================================ */
// Конфігурація GLTFLoader та DRACOLoader
const gltfLoader = new GLTFLoader(loadingManager);
const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
draco.setDecoderConfig({ type: 'js' });
gltfLoader.setDRACOLoader(draco);

/* ============================================
   ЗАВАНТАЖЕННЯ 3D-МОДЕЛІ ЦЕРКВИ
   ============================================ */
// URL моделі
const MODEL_URL = 'https://huggingface.co/Arnel13/diplome/resolve/main/Optimized_model.glb?download=true';
let modelRoot = null;

gltfLoader.load(
    MODEL_URL,
    (gltf) => {
        modelRoot = gltf.scene;
        modelRoot.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                if (node.material) {
                    if ('envMapIntensity' in node.material) node.material.envMapIntensity = 1.1;
                    node.material.needsUpdate = true;
                }
            }
        });

        // Центрування та масштабування моделі
        const box = new THREE.Box3().setFromObject(modelRoot);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const desiredSize = 12;
        const scale = desiredSize / Math.max(size.x, size.y, size.z);
        modelRoot.scale.setScalar(scale);
        modelRoot.position.sub(center.multiplyScalar(scale));
        modelRoot.position.y = 0;

        scene.add(modelRoot);

        orbit.target.set(0, 2.5, 0);

        if (activeControls === 'orbit') {
            const distance = 12;
            camera.position.set(distance, 6, distance);
        }

        orbit.update();
    },
    undefined,
    (err) => {
        progressText.textContent = 'Не вдалося завантажити модель';
        console.error(err);
    }
);

/* ============================================
   СИСТЕМА АНОТАЦІЙ (HOTSPOTS)
   ============================================ */
// Дані про точки інтересу
const hotspots = [
    {
        id: 'church',
        position: new THREE.Vector3(0, 3, 13),
        title: 'Вознесенська церква',
        text: 'Унікальна пам\'ятка високого класицизму (1795–1801). Храм має рідкісну для української архітектури центричну композицію: кругла в плані, тридільна, трьохбанна споруда, оперезана коловою галереєю. Збудована на місці старого дерев\'яного храму.',
        image: './assets/images/church_main.jpg'
    },
    {
        id: 'bell-tower',
        position: new THREE.Vector3(27, 3, 12),
        title: 'Дзвіниця (Варваринська церква)',
        text: 'Спочатку збудована як тепла церква Св. Варвари (1753), пізніше (1895) перебудована у триярусну дзвіницю. Поєднує риси бароко та класицизму. Є пам\'яткою архітектури національного значення.',
        image: './assets/images/bell_tower.jpg'
    }
];

const hotspotElems = new Map();

/* ============================================
   ФУНКЦІЇ РОБОТИ З АНОТАЦІЯМИ
   ============================================ */
// Створення точок в DOM
function createHotspot(h) {
    const el = document.createElement('button');
    el.className = 'hotspot';
    el.setAttribute('aria-label', h.title);
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        openInfo(h);
    });
    hotspotsRoot.appendChild(el);
    hotspotElems.set(h.id, el);
}

function rebuildHotspots() {
    hotspotsRoot.innerHTML = '';
    hotspotElems.clear();
    hotspots.forEach(createHotspot);
    if (annotationsList) {
        annotationsList.innerHTML = '';
        for (const h of hotspots) {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.textContent = h.title;
            btn.addEventListener('click', () => {
                openInfo(h);
            });
            li.appendChild(btn);
            annotationsList.appendChild(li);
        }
    }
}

// Відображення інформаційної панелі
function openInfo(h) {
    infoTitle.textContent = h.title;
    infoText.textContent = h.text;
    if (h.image) {
        infoImage.src = h.image;
        infoImage.style.display = 'block';
    } else {
        infoImage.style.display = 'none';
    }
    infoPanel.classList.add('open');
    infoPanel.setAttribute('aria-hidden', 'false');
}

infoClose.addEventListener('click', () => {
    infoPanel.classList.remove('open');
    infoPanel.setAttribute('aria-hidden', 'true');
});

/* ============================================
   ОБРОБКА ЗМІНИ РОЗМІРУ ВІКНА
   ============================================ */
// Адаптивність
function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

/* ============================================
   ГОЛОВНИЙ ЦИКЛ РЕНДЕРИНГУ
   ============================================ */
// Оновлення кадру
function render() {
    requestAnimationFrame(render);
    const dt = clock.getDelta();

    if (activeControls === 'orbit') {
        orbit.update();
    } else if (activeControls === 'fly') {
        const velocity = new THREE.Vector3();

        if (moveState.forward) velocity.z -= 1;
        if (moveState.backward) velocity.z += 1;
        if (moveState.left) velocity.x -= 1;
        if (moveState.right) velocity.x += 1;
        if (moveState.up) velocity.y += 1;
        if (moveState.down) velocity.y -= 1;

        if (velocity.lengthSq() > 0) {
            velocity.normalize();
            velocity.multiplyScalar(flySpeed * dt);
            velocity.applyQuaternion(camera.quaternion);
            camera.position.add(velocity);
            camera.position.y = Math.max(0.5, camera.position.y);
        }
    }

    updateHotspotsScreenPositions();
    renderer.render(scene, camera);
}
requestAnimationFrame(render);

/* ============================================
   ПРОЕКЦІЯ 3D-ПОЗИЦІЙ НА ЕКРАН
   ============================================ */
// Розрахунок екранних координат для анотацій
const tmpVector = new THREE.Vector3();
function updateHotspotsScreenPositions() {
    const width = renderer.domElement.clientWidth;
    const height = renderer.domElement.clientHeight;

    for (const h of hotspots) {
        const el = hotspotElems.get(h.id);
        if (!el) continue;

        tmpVector.copy(h.position);
        if (modelRoot) {
            tmpVector.applyMatrix4(modelRoot.matrixWorld);
        }

        const ndc = tmpVector.clone().project(camera);
        const isBehind = ndc.z > 1 || ndc.z < -1;

        if (isBehind) {
            el.style.display = 'none';
            continue;
        }

        const x = (ndc.x * 0.5 + 0.5) * width;
        const y = (-(ndc.y * 0.5) + 0.5) * height;
        el.style.display = 'block';
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
    }
}

/* ============================================
   ІНІЦІАЛІЗАЦІЯ ПРОГРАМИ
   ============================================ */
onResize();
rebuildHotspots();
setActiveControls('orbit');

/* ============================================
   ФУНКЦІЯ ЗНІМКУ ЕКРАНА
   ============================================ */
btnScreenshot?.addEventListener('click', () => {
    const dataURL = renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'romny_vosnesenska.png';
    a.click();
});

/* ============================================
   LIGHTBOX GALERY
   ============================================ */
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');
const galleryImages = document.querySelectorAll('.gallery img');

galleryImages.forEach(img => {
    img.addEventListener('click', () => {
        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt;
        lightbox.classList.add('active');
        lightbox.setAttribute('aria-hidden', 'false');
    });
});

function closeLightbox() {
    lightbox.classList.remove('active');
    lightbox.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
        lightboxImg.src = '';
    }, 300);
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
        closeLightbox();
    }
});
