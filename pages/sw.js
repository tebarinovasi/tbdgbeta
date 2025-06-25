// sw.js - BARU & DIPERBAIKI

// Impor skrip Supabase dari CDN yang menyediakan UMD bundle, lebih cocok untuk importScripts.
importScripts('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');

// Script di atas akan membuat variabel global bernama `supabase`
// Jadi kita tinggal menggunakannya.
const { createClient } = supabase; 

const SUPABASE_URL = 'https://zunrijrufbpldgfztroz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1bnJpanJ1ZmJwbGRnZnp0cm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMjY4MzcsImV4cCI6MjA2NDYwMjgzN30.bUDiCIx-gM_nBUZWoU8N2311MlwQq7SOt1-fkyyWdbU';

// Buat client Supabase langsung menggunakan createClient yang sudah di-ekspos
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Helper untuk IndexedDB ---
// ... (sisa kode helper IndexedDB Anda tidak perlu diubah) ...
function getDb() {
    // ...
}
function getTrackingInfo() {
    // ...
}


// --- Logika Inti Service Worker ---
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'background-location-sync') {
        console.log('[SW] Sync periodik dipicu. Mengambil lokasi...');
        event.waitUntil(fetchLocationAndPost());
    }
});

async function fetchLocationAndPost() {
    const trackingInfo = await getTrackingInfo();
    
    if (!trackingInfo || !trackingInfo.officerUserId || !trackingInfo.activeAttendanceId) {
        console.log('[SW] Tidak ada info tracking aktif. Melewatkan sync.');
        return;
    }

    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 15000 
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

        // Ganti 'supabase' menjadi 'supabaseClient' yang sudah kita buat di atas
        const { error } = await supabaseClient.from('officer_locations').insert(locationData);
        if (error) throw error;

        console.log('[SW] Update lokasi dari background berhasil dikirim:', locationData);

    } catch (error) {
        console.error('[SW] Gagal mengambil atau mengirim lokasi:', error.message);
    }
}
