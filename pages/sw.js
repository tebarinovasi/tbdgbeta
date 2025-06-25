// sw.js - Service Worker untuk pelacakan latar belakang

// Impor skrip Supabase. Service Worker punya scope terpisah.
importScripts('https://esm.sh/@supabase/supabase-js@2');

const SUPABASE_URL = 'https://zunrijrufbpldgfztroz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1bnJpanJ1ZmJwbGRnZnp0cm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMjY4MzcsImV4cCI6MjA2NDYwMjgzN30.bUDiCIx-gM_nBUZWoU8N2311MlwQq7SOt1-fkyyWdbU';
const supabase = self.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Helper untuk IndexedDB ---
function getDb() {
    return new Promise((resolve, reject) => {
        const request = self.indexedDB.open('app_state', 1);
        request.onerror = () => reject("Error opening DB");
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            db.createObjectStore('tracking_info', { keyPath: 'key' });
        };
    });
}

function getTrackingInfo() {
    return new Promise(async (resolve) => {
        const db = await getDb();
        const transaction = db.transaction(['tracking_info'], 'readonly');
        const store = transaction.objectStore('tracking_info');
        const request = store.get('current');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
}

// --- Logika Inti Service Worker ---

// Event listener ini akan dipicu secara periodik oleh browser
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'background-location-sync') {
        console.log('[SW] Sync periodik dipicu. Mengambil lokasi...');
        event.waitUntil(fetchLocationAndPost());
    }
});

async function fetchLocationAndPost() {
    const trackingInfo = await getTrackingInfo();
    
    // Hanya jalankan jika ada info tracking (artinya, petugas sedang dalam status "Absen Masuk")
    if (!trackingInfo || !trackingInfo.officerUserId || !trackingInfo.activeAttendanceId) {
        console.log('[SW] Tidak ada info tracking aktif. Melewatkan sync.');
        return;
    }

    try {
        // 1. Ambil posisi GPS saat ini
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 15000 // Beri waktu lebih untuk mendapatkan lock GPS
            });
        });

        const { latitude, longitude, accuracy } = position.coords;
        console.log(`[SW] Lokasi didapat: ${latitude}, ${longitude}`);

        const locationData = {
            officer_id: trackingInfo.officerUserId,
            attendance_id: trackingInfo.activeAttendanceId,
            latitude: latitude,
            longitude: longitude,
            accuracy: accuracy,
            timestamp: new Date().toISOString()
        };

        // 2. Kirim data ke Supabase
        const { error } = await supabase.from('officer_locations').insert(locationData);
        if (error) throw error;

        console.log('[SW] Update lokasi dari background berhasil dikirim:', locationData);

    } catch (error) {
        console.error('[SW] Gagal mengambil atau mengirim lokasi:', error.message);
    }
}