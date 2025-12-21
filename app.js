// ---------------------------
// 0) Helpers
// ---------------------------
const $ = (id) => document.getElementById(id);

function money(n) {
    return `S/ ${n.toFixed(2)}`;
}

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ---------------------------
// 1) "Auth" demo (front-end)
// ---------------------------
function setLoggedIn(email) {
    localStorage.setItem("uniride_user", JSON.stringify({ email }));
}

function getUser() {
    const raw = localStorage.getItem("uniride_user");
    return raw ? JSON.parse(raw) : null;
}

function logout() {
    localStorage.removeItem("uniride_user");
    renderAuth();
}

function renderAuth() {
    const user = getUser();

    if (user) {
        $("loginCard").classList.add("hidden");
        $("homeCard").classList.remove("hidden");
        $("userEmail").textContent = user.email;
        $("userName").textContent = "Estudiante UAP";
    } else {
        $("loginCard").classList.remove("hidden");
        $("homeCard").classList.add("hidden");
    }
}

$("loginBtn").addEventListener("click", () => {
    const email = $("email").value.trim().toLowerCase();
    const pass = $("password").value;

    if (email.endsWith("@autonoma.edu.pe") && pass.length >= 8) {
        $("loginMsg").style.color = "green";
        $("loginMsg").textContent = "Acceso concedido ✅";
        setLoggedIn(email);
        renderAuth();
        initMapOnce();
    } else {
        $("loginMsg").style.color = "crimson";
        $("loginMsg").textContent =
            "Credenciales inválidas. Usa tu correo institucional (@autonoma.edu.pe) ó contraseña inválida.";
    }
});

$("logoutBtn").addEventListener("click", logout);

// ---------------------------
// 2) Tabs
// ---------------------------
document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const tab = btn.dataset.tab;
        document.querySelectorAll(".tabpane").forEach((p) => p.classList.add("hidden"));
        $("tab-" + tab).classList.remove("hidden");
    });
});

// ---------------------------
// 3) Mapa + Geoloc + Ruta (Leaflet + OSRM)
// ---------------------------
let map, originMarker, destMarker, routeLine;
let origin = null;        // { lat, lon }
let destination = null;   // { lat, lon }

function initMapOnce() {
    if (map) return;

    // Default: Lima (si aún no hay GPS)
    map = L.map("map", { zoomControl: false }).setView([-12.0464, -77.0428], 12);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // Tap en el mapa para marcar DESTINO manual
    map.on("click", (e) => {
        setDestination(e.latlng.lat, e.latlng.lng, "Destino (seleccionado en mapa)");
    });
}

async function getCurrentLocation() {
    $("tripMsg").textContent = "";

    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Tu navegador no soporta geolocalización."));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude
                });
            },
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
    });
}

function setOrigin(lat, lon) {
    origin = { lat, lon };
    $("originTxt").value = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

    if (originMarker) originMarker.remove();
    originMarker = L.marker([lat, lon]).addTo(map).bindPopup("📍 Tu ubicación").openPopup();

    map.setView([lat, lon], 16);
}

function setDestination(lat, lon, label = "Destino") {
    destination = { lat, lon };
    $("destTxt").value = label;

    if (destMarker) destMarker.remove();
    destMarker = L.marker([lat, lon]).addTo(map).bindPopup("🎯 Destino");
}

$("locBtn").addEventListener("click", async () => {
    try {
        initMapOnce();
        $("originTxt").value = "Obteniendo ubicación...";
        const loc = await getCurrentLocation();
        setOrigin(loc.lat, loc.lon);
    } catch (e) {
        $("originTxt").value = "";
        $("tripMsg").style.color = "crimson";
        $("tripMsg").textContent =
            "No pude obtener tu ubicación. Activa GPS y permisos del navegador.";
    }
});

$("centerBtn").addEventListener("click", () => {
    if (origin) map.setView([origin.lat, origin.lon], 16);
});

// Geocodificar destino (Nominatim)
async function geocodeDestination(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    const data = await res.json();
    if (!data || !data[0]) return null;

    return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        name: data[0].display_name
    };
}

// Ruta con OSRM (sin key)
async function getRouteOSRM(o, d) {
    const url = `https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data || data.code !== "Ok") return null;

    const route = data.routes[0];
    return {
        distanceKm: route.distance / 1000,
        durationMin: route.duration / 60,
        geojson: route.geometry
    };
}

function drawRoute(geojson) {
    if (routeLine) routeLine.remove();
    routeLine = L.geoJSON(geojson).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding: [20, 20] });
}

// Tarifa simple
function calculateFare(distanceKm) {
    const base = 4.50;      // base
    const perKm = 1.60;     // por km
    const safetyFee = 0.90; // fee fijo
    return base + (perKm * distanceKm) + safetyFee;
}

// ---------------------------
// 4) Botón Ver ruta y costo (FIX llaves)
// ---------------------------
$("routeBtn").addEventListener("click", async () => {
    $("tripMsg").textContent = "";
    $("confirmBtn").disabled = true;

    try {
        initMapOnce();

        // 1) Origen
        if (!origin) {
            const loc = await getCurrentLocation();
            setOrigin(loc.lat, loc.lon);
        }

        // 2) Destino
        const destText = $("destTxt").value.trim();

        if (destText && (!destination || destText !== "Destino (seleccionado en mapa)")) {
            const geo = await geocodeDestination(destText);

            if (!geo) {
                $("tripMsg").style.color = "crimson";
                $("tripMsg").textContent =
                    "No encontré ese destino. Prueba con una dirección más específica o marca en el mapa.";
                return;
            }

            setDestination(geo.lat, geo.lon, geo.name);
        }

        if (!destination) {
            $("tripMsg").style.color = "crimson";
            $("tripMsg").textContent = "Selecciona un destino (escribe o toca el mapa).";
            return;
        }

        // 3) Ruta
        const route = await getRouteOSRM(origin, destination);

        if (!route) {
            // fallback
            const km = haversineKm(origin.lat, origin.lon, destination.lat, destination.lon);
            const total = calculateFare(km);

            $("distanceOut").textContent = `${km.toFixed(2)} km`;
            $("timeOut").textContent = `${Math.round((km / 18) * 60)} min`;
            $("fareOut").textContent = money(total);

            $("confirmBtn").disabled = false;
            $("tripMsg").style.color = "#0b3c78";
            $("tripMsg").textContent = "Ruta estimada (sin trazo).";
            return;
        }

        drawRoute(route.geojson);

        const total = calculateFare(route.distanceKm);
        $("distanceOut").textContent = `${route.distanceKm.toFixed(2)} km`;
        $("timeOut").textContent = `${Math.round(route.durationMin)} min`;
        $("fareOut").textContent = money(total);

        $("confirmBtn").disabled = false;

    } catch (e) {
        $("tripMsg").style.color = "crimson";
        $("tripMsg").textContent =
            "Error al calcular ruta/costo. Revisa tu conexión y permisos de GPS.";
    }
});

$("confirmBtn").addEventListener("click", () => {
    $("tripMsg").style.color = "green";
    $("tripMsg").textContent =
        "Viaje confirmado ✅ (demo). Próximo paso: asignar conductor + tracking en tiempo real.";
});

// ---------------------------
// 5) PWA Install + Service Worker
// ---------------------------
let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $("installBtn").hidden = false;
});

$("installBtn").addEventListener("click", async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    deferredPrompt = null;
    $("installBtn").hidden = true;
});

// Register SW
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        const isHttp = location.protocol === "http:" || location.protocol === "https:";
        if (!isHttp) {
            console.warn("Service Worker deshabilitado: solo funciona en http/https (no en file://).");
            return;
        }
        navigator.serviceWorker.register("./sw.js")
            .catch(err => console.error("SW register error:", err));
    });
}


// Init
renderAuth();
if (getUser()) {
    initMapOnce();
}
