function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const msg = document.getElementById("login-msg");

    if (email.includes("@autonoma.edu.pe") && password.length >= 4) {
        msg.style.color = "green";
        msg.textContent = "Acceso concedido. Bienvenido a UniRide 🚗";
    } else {
        msg.style.color = "red";
        msg.textContent = "Credenciales inválidas. Usa tu correo institucional.";
    }
}

function getLocation() {
    const locationText = document.getElementById("location");

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            locationText.textContent = `Tu ubicación actual: Lat ${lat.toFixed(4)}, Lon ${lon.toFixed(4)}`;
        });
    } else {
        locationText.textContent = "La geolocalización no es soportada por tu navegador.";
    }
}

function calculateFare() {
    const destination = document.getElementById("destination").value;
    const fareText = document.getElementById("fare");

    if (destination === "") {
        fareText.textContent = "Ingresa un destino válido.";
        return;
    }

    // Costo fijo simulado (puede reemplazarse con API real)
    const baseFare = 5.00;
    const distanceCost = Math.floor(Math.random() * 5) + 3;
    const total = baseFare + distanceCost;

    fareText.textContent = `Destino: ${destination} | Total a pagar: S/. ${total.toFixed(2)}`;
}
