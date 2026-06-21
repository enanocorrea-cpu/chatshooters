/ sw.js - Service Worker Autónomo para Chatshooters
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js');

const firebaseConfig = {
    apiKey: "AIzaSyDoeAo6FTBid6Eq_PerCg_I955jD4iFw_4",
    databaseURL: "https://chatshooters-e4a81-default-rtdb.europe-west1.firebasedatabase.app"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let miUsuarioGlobal = "";
let modoSeñueloGlobal = false;
let chatsVigilados = {};

// Escucha las credenciales enviadas desde la interfaz activa
self.addEventListener('message', (event) => {
    if (event.data && event.data.tipo === 'SET_PERFIL') {
        miUsuarioGlobal = event.data.usuario;
        modoSeñueloGlobal = event.data.modoSeñuelo;
        inicializarEscuchaSegundoPlano();
    }
});

function inicializarEscuchaSegundoPlano() {
    if (!miUsuarioGlobal) return;
    const path = modoSeñueloGlobal ? "coaccion" : "real";

    // Revisa la lista de amigos asignada al usuario
    database.ref(`usuarios/${miUsuarioGlobal}/${path}`).on('value', (snapshot) => {
        if (snapshot.exists()) {
            Object.keys(snapshot.val()).forEach((amigo) => {
                if (amigo === "init" || chatsVigilados[amigo]) return;
                chatsVigilados[amigo] = true;
                vigilarCanalMensajes(amigo, path);
            });
        }
    });
}

function vigilarCanalMensajes(amigo, path) {
    const ID_CONV = [miUsuarioGlobal, amigo].sort().join("_");
    let inicializado = false;

    database.ref(`chats/${path}/${ID_CONV}`).orderByChild('timestamp').limitToLast(1).on('child_added', (snapshot) => {
        // Evita disparar alertas por el historial antiguo al arrancar
        if (!inicializado) {
            inicializado = true;
            return;
        }

        const msg = snapshot.val();
        if (msg && msg.emisor !== miUsuarioGlobal) {
            // DISPARAR NOTIFICACIÓN CON FLAGS DE AUDIO FORZADO PARA EL SISTEMA OPERATIVO
            const title = `Mensaje de ${msg.emisor}`;
            const options = {
                body: msg.contenido,
                icon: 'https://cdn-icons-png.flaticon.com/512/545/545241.png',
                badge: 'https://cdn-icons-png.flaticon.com/512/545/545241.png',
                vibrate: [300, 100, 300],
                sound: 'default', // Fuerza al OS a reproducir sonido en segundo plano
                tag: ID_CONV, // Agrupa notificaciones del mismo chat
                renotify: true,
                data: { url: './' }
            };

            self.registration.showNotification(title, options);
        }
    });
}

// Al presionar la notificación abre o enfoca el entorno táctico
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let client of windowClients) {
                if (client.url && 'focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('./');
        })
    );
});
