<script lang="ts">
  import { onMount } from 'svelte';

  // State
  let loading = $state(true);
  let syncing = $state(false);
  let syncingGeofences = $state(false);
  let traccarStatus = $state<any>(null);
  let mappings = $state<any[]>([]);
  let unlinkedDevices = $state<any[]>([]);
  let summary = $state<any>(null);
  let geofenceSyncStatus = $state<any>(null);
  let error = $state<string | null>(null);
  let successMessage = $state<string | null>(null);
  let lastSyncResult = $state<any[]>([]);

  // GPS Düzeltme ayarları
  let snapToRouteEnabled = $state(true);
  let stopSnapRadius = $state(15);
  let routeMaxDistance = $state(40);

  // Linking state
  let linkingVehicleId = $state<number | null>(null);
  let selectedDeviceId = $state<number | null>(null);

  onMount(() => {
    fetchData();
  });

  async function fetchData() {
    loading = true;
    error = null;

    try {
      // Traccar durumu
      const statusRes = await fetch('/api/traccar?action=status');
      const statusData = await statusRes.json();
      traccarStatus = statusData.success ? statusData.data : null;

      // Eşleştirme durumu
      const syncRes = await fetch('/api/traccar/sync');
      const syncData = await syncRes.json();
      
      if (syncData.success) {
        mappings = syncData.data.mappings;
        unlinkedDevices = syncData.data.unlinkedDevices;
        summary = syncData.data.summary;
      }

      // Geofence senkronizasyon durumu
      await fetchGeofenceSyncStatus();
    } catch (err) {
      error = 'Veri yüklenirken hata oluştu';
      console.error(err);
    } finally {
      loading = false;
    }
  }

  async function fetchGeofenceSyncStatus() {
    try {
      const res = await fetch('/api/traccar/geofence-sync');
      const data = await res.json();
      if (data.success) {
        geofenceSyncStatus = data.data;
      }
    } catch (err) {
      console.error('Geofence sync status error:', err);
    }
  }

  async function syncPositions() {
    syncing = true;
    error = null;
    successMessage = null;

    try {
      const snapParam = snapToRouteEnabled ? '' : '&snap=false';
      const res = await fetch(`/api/traccar/sync?stopRadius=${stopSnapRadius}&routeMax=${routeMaxDistance}${snapParam}`, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        successMessage = data.message;
        lastSyncResult = data.data.updates || [];
        await fetchData();
      } else {
        error = data.message;
      }
    } catch (err) {
      error = 'Senkronizasyon hatası';
    } finally {
      syncing = false;
    }
  }

  async function linkDevice(vehicleId: number, deviceId: number) {
    error = null;
    successMessage = null;

    try {
      const res = await fetch('/api/traccar/sync?action=link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId, traccarDeviceId: deviceId })
      });
      const data = await res.json();

      if (data.success) {
        successMessage = data.message;
        linkingVehicleId = null;
        selectedDeviceId = null;
        await fetchData();
      } else {
        error = data.message;
      }
    } catch (err) {
      error = 'Eşleştirme hatası';
    }
  }

  async function unlinkDevice(vehicleId: number) {
    error = null;
    successMessage = null;

    try {
      const res = await fetch('/api/traccar/sync?action=unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId })
      });
      const data = await res.json();

      if (data.success) {
        successMessage = data.message;
        await fetchData();
      } else {
        error = data.message;
      }
    } catch (err) {
      error = 'Eşleştirme kaldırma hatası';
    }
  }

  async function syncGeofences(force = false) {
    syncingGeofences = true;
    error = null;
    successMessage = null;

    try {
      const url = force ? '/api/traccar/geofence-sync?force=true' : '/api/traccar/geofence-sync';
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        successMessage = `Geofence senkronizasyonu tamamlandı: ${data.data.created} oluşturuldu, ${data.data.updated} güncellendi, ${data.data.linked} bağlantı yapıldı`;
        await fetchGeofenceSyncStatus();
      } else {
        error = data.message;
      }
    } catch (err) {
      error = 'Geofence senkronizasyon hatası';
    } finally {
      syncingGeofences = false;
    }
  }

  async function deleteAllGeofences() {
    if (!confirm('Traccar\'daki tüm Buggy Shuttle geofence\'lerini silmek istediğinize emin misiniz?')) return;

    syncingGeofences = true;
    error = null;
    successMessage = null;

    try {
      const res = await fetch('/api/traccar/geofence-sync', { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        successMessage = data.message;
        await fetchGeofenceSyncStatus();
      } else {
        error = data.message;
      }
    } catch (err) {
      error = 'Geofence silme hatası';
    } finally {
      syncingGeofences = false;
    }
  }

  function startLinking(vehicleId: number) {
    linkingVehicleId = vehicleId;
    selectedDeviceId = null;
  }

  function cancelLinking() {
    linkingVehicleId = null;
    selectedDeviceId = null;
  }
</script>

<svelte:head>
  <title>Traccar Ayarları | Buggy Shuttle</title>
</svelte:head>

<div class="min-h-screen bg-slate-900 text-white p-6">
  <div class="max-w-4xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold">📡 Traccar GPS Entegrasyonu</h1>
        <p class="text-slate-400 text-sm mt-1">Araç-cihaz eşleştirmesi ve canlı konum takibi</p>
      </div>
      <a href="/" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">
        ← Ana Sayfa
      </a>
    </div>

    <!-- Messages -->
    {#if error}
      <div class="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400">
        ❌ {error}
      </div>
    {/if}

    {#if successMessage}
      <div class="mb-6 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400">
        ✅ {successMessage}
      </div>
    {/if}

    {#if loading}
      <div class="flex items-center justify-center py-20">
        <div class="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
        <span class="ml-3 text-slate-400">Yükleniyor...</span>
      </div>
    {:else}
      <!-- Traccar Status Card -->
      <div class="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700">
        <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <span class="w-3 h-3 rounded-full {traccarStatus?.connected ? 'bg-green-500' : 'bg-red-500'}"></span>
          Traccar Sunucu Durumu
        </h2>
        
        {#if traccarStatus?.connected}
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-slate-700/50 rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-cyan-400">{summary?.totalTraccarDevices || 0}</div>
              <div class="text-xs text-slate-400">Toplam Cihaz</div>
            </div>
            <div class="bg-slate-700/50 rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-green-400">{summary?.onlineDevices || 0}</div>
              <div class="text-xs text-slate-400">Online</div>
            </div>
            <div class="bg-slate-700/50 rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-yellow-400">{summary?.linkedVehicles || 0}</div>
              <div class="text-xs text-slate-400">Eşleştirilmiş</div>
            </div>
            <div class="bg-slate-700/50 rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-slate-400">{summary?.totalVehicles || 0}</div>
              <div class="text-xs text-slate-400">Toplam Araç</div>
            </div>
          </div>
        {:else}
          <div class="text-red-400 text-sm">
            ⚠️ Traccar sunucusuna bağlanılamıyor. Lütfen .env dosyasındaki TRACCAR_URL, TRACCAR_USER ve TRACCAR_PASSWORD değerlerini kontrol edin.
          </div>
        {/if}
      </div>

      <!-- GPS Düzeltme Ayarları -->
      <div class="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700">
        <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
          🎯 GPS Konum Düzeltme (Snap to Route)
        </h2>
        <p class="text-sm text-slate-400 mb-4">
          GPS sapmasını düzeltmek için araç konumlarını rota çizgilerine veya duraklara yapıştırır.
        </p>
        
        <div class="space-y-4">
          <!-- Toggle -->
          <label class="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              bind:checked={snapToRouteEnabled}
              class="w-5 h-5 rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500"
            />
            <span class="text-sm text-white">Konum düzeltmeyi etkinleştir</span>
          </label>
          
          {#if snapToRouteEnabled}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-slate-700/30 rounded-lg">
              <!-- Durak Snap Yarıçapı -->
              <div>
                <label for="stopSnapRadius" class="block text-xs text-slate-400 mb-2">
                  Durak Snap Yarıçapı: {stopSnapRadius}m
                </label>
                <input 
                  id="stopSnapRadius"
                  type="range" 
                  min="5" 
                  max="30" 
                  bind:value={stopSnapRadius}
                  class="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <p class="text-xs text-slate-500 mt-1">Araç bu mesafe içindeyse durağa çekilir</p>
              </div>
              
              <!-- Rota Max Mesafe -->
              <div>
                <label for="routeMaxDistance" class="block text-xs text-slate-400 mb-2">
                  Rota Max Mesafe: {routeMaxDistance}m
                </label>
                <input 
                  id="routeMaxDistance"
                  type="range" 
                  min="20" 
                  max="100" 
                  bind:value={routeMaxDistance}
                  class="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <p class="text-xs text-slate-500 mt-1">Bu mesafeden uzaksa düzeltme yapılmaz</p>
              </div>
            </div>
          {/if}
        </div>

      </div>

      <!-- Traccar Geofence Senkronizasyonu -->
      <div class="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700">
        <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
          🎯 Traccar Geofence Senkronizasyonu
        </h2>
        <p class="text-sm text-slate-400 mb-4">
          Buggy Shuttle duraklarını Traccar'a geofence olarak senkronize eder. Bu sayede Traccar otomatik olarak 
          araçların durağa giriş/çıkış event'lerini üretir.
        </p>

        {#if geofenceSyncStatus}
          <!-- Sync Status Summary -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div class="bg-slate-700/50 rounded-lg p-3 text-center">
              <div class="text-xl font-bold text-white">{geofenceSyncStatus.summary?.totalStops || 0}</div>
              <div class="text-xs text-slate-400">Toplam Durak</div>
            </div>
            <div class="bg-slate-700/50 rounded-lg p-3 text-center">
              <div class="text-xl font-bold text-green-400">{geofenceSyncStatus.summary?.syncedStops || 0}</div>
              <div class="text-xs text-slate-400">Senkronize</div>
            </div>
            <div class="bg-slate-700/50 rounded-lg p-3 text-center">
              <div class="text-xl font-bold text-yellow-400">{geofenceSyncStatus.summary?.notSyncedStops || 0}</div>
              <div class="text-xs text-slate-400">Bekleyen</div>
            </div>
            <div class="bg-slate-700/50 rounded-lg p-3 text-center">
              <div class="text-xl font-bold text-cyan-400">{geofenceSyncStatus.summary?.bsGeofences || 0}</div>
              <div class="text-xs text-slate-400">Traccar Geofence</div>
            </div>
          </div>

          <!-- Stops List -->
          {#if geofenceSyncStatus.stops && geofenceSyncStatus.stops.length > 0}
            <div class="bg-slate-700/30 rounded-lg p-3 mb-4 max-h-48 overflow-y-auto">
              <div class="text-xs text-slate-400 mb-2">Durak Senkronizasyon Durumu:</div>
              <div class="space-y-1">
                {#each geofenceSyncStatus.stops as stop}
                  <div class="flex items-center justify-between text-sm py-1 px-2 rounded {stop.synced ? 'bg-green-500/10' : 'bg-yellow-500/10'}">
                    <span class="flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full {stop.synced ? 'bg-green-500' : 'bg-yellow-500'}"></span>
                      {stop.stopName}
                    </span>
                    <span class="text-xs text-slate-500">
                      {stop.synced ? `✓ ID: ${stop.traccarGeofenceId}` : 'Senkronize edilmedi'}
                    </span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Orphan Geofences Warning -->
          {#if geofenceSyncStatus.orphanGeofences && geofenceSyncStatus.orphanGeofences.length > 0}
            <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
              <div class="text-yellow-400 text-sm font-medium mb-1">⚠️ Yetim Geofence'ler</div>
              <p class="text-xs text-slate-400 mb-2">
                Bu geofence'ler Traccar'da var ama Buggy Shuttle'da karşılığı yok:
              </p>
              <div class="text-xs text-slate-500">
                {geofenceSyncStatus.orphanGeofences.map((g: any) => g.name).join(', ')}
              </div>
            </div>
          {/if}
        {/if}

        <!-- Action Buttons -->
        <div class="flex flex-wrap gap-3">
          <button
            onclick={() => syncGeofences(false)}
            disabled={syncingGeofences || !traccarStatus?.connected}
            class="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {#if syncingGeofences}
              <div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
            {:else}
              🔄
            {/if}
            Senkronize Et
          </button>
          
          <button
            onclick={() => syncGeofences(true)}
            disabled={syncingGeofences || !traccarStatus?.connected}
            class="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            🔃 Yeniden Oluştur
          </button>
          
          <button
            onclick={deleteAllGeofences}
            disabled={syncingGeofences || !traccarStatus?.connected}
            class="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 disabled:bg-slate-600 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            🗑️ Tümünü Sil
          </button>
          
          <button
            onclick={fetchGeofenceSyncStatus}
            disabled={syncingGeofences}
            class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
          >
            ↻ Durumu Yenile
          </button>
        </div>

        <!-- Info Box -->
        <div class="mt-4 p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
          <div class="text-cyan-400 text-sm font-medium mb-1">ℹ️ Nasıl Çalışır?</div>
          <ul class="text-xs text-slate-400 space-y-1">
            <li>• Her durak için Traccar'da bir CIRCLE geofence oluşturulur</li>
            <li>• Geofence yarıçapı durak ayarlarından alınır (varsayılan: 15m)</li>
            <li>• Tüm cihazlara bu geofence'ler otomatik bağlanır</li>
            <li>• Araç durağa girdiğinde/çıktığında Traccar event üretir</li>
            <li>• Bu event'ler WebSocket üzerinden anlık olarak alınır</li>
          </ul>
        </div>
      </div>

      <!-- Sync Button & Last Result -->
      <div class="flex items-center justify-between mb-6 gap-4">
        {#if lastSyncResult.length > 0}
          <div class="flex-1 text-xs text-slate-400">
            Son sync: {lastSyncResult.length} araç güncellendi
            {#if lastSyncResult.some(r => r.correctionType !== 'none')}
              <span class="text-cyan-400 ml-2">
                ({lastSyncResult.filter(r => r.correctionType === 'route').length} rota, 
                {lastSyncResult.filter(r => r.correctionType === 'stop').length} durak düzeltmesi)
              </span>
            {/if}
          </div>
        {:else}
          <div></div>
        {/if}
        <button
          onclick={syncPositions}
          disabled={syncing || !traccarStatus?.connected}
          class="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          {#if syncing}
            <div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
            Senkronize Ediliyor...
          {:else}
            🔄 Konumları Senkronize Et
          {/if}
        </button>
      </div>

      <!-- Vehicle-Device Mappings -->
      <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-700">
          <h2 class="text-lg font-semibold">🚐 Araç - Cihaz Eşleştirmeleri</h2>
        </div>

        <div class="divide-y divide-slate-700">
          {#each mappings as mapping}
            <div class="p-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors">
              <div class="flex items-center gap-4">
                <!-- Vehicle Info -->
                <div class="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-2xl">
                  🚐
                </div>
                <div>
                  <div class="font-medium">{mapping.vehicleName}</div>
                  <div class="text-xs text-slate-400">Araç ID: {mapping.vehicleId}</div>
                </div>

                <!-- Arrow -->
                <div class="text-slate-500 text-2xl px-4">→</div>

                <!-- Device Info -->
                {#if mapping.linked && mapping.traccarDevice}
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center text-xl {mapping.traccarDevice.status === 'online' ? 'bg-green-500/20' : 'bg-slate-700'}">
                      📱
                    </div>
                    <div>
                      <div class="font-medium flex items-center gap-2">
                        {mapping.traccarDevice.name}
                        <span class="w-2 h-2 rounded-full {mapping.traccarDevice.status === 'online' ? 'bg-green-500' : 'bg-slate-500'}"></span>
                      </div>
                      <div class="text-xs text-slate-400">ID: {mapping.traccarDevice.uniqueId}</div>
                    </div>
                  </div>
                {:else if linkingVehicleId === mapping.vehicleId}
                  <!-- Device Selection -->
                  <div class="flex items-center gap-2">
                    <select
                      bind:value={selectedDeviceId}
                      class="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value={null}>Cihaz seçin...</option>
                      {#each unlinkedDevices as device}
                        <option value={device.id}>
                          {device.name} ({device.uniqueId}) - {device.status}
                        </option>
                      {/each}
                    </select>
                    <button
                      onclick={() => selectedDeviceId && linkDevice(mapping.vehicleId, selectedDeviceId)}
                      disabled={!selectedDeviceId}
                      class="px-3 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 rounded-lg text-sm transition-colors"
                    >
                      ✓
                    </button>
                    <button
                      onclick={cancelLinking}
                      class="px-3 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                {:else}
                  <div class="text-slate-500 italic text-sm">Eşleştirilmemiş</div>
                {/if}
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2">
                {#if mapping.linked}
                  {#if mapping.lastPosition}
                    <div class="text-xs text-slate-400 mr-4">
                      📍 {mapping.lastPosition.lat.toFixed(5)}, {mapping.lastPosition.lng.toFixed(5)}
                      <br>
                      🕐 {new Date(mapping.lastPosition.time).toLocaleTimeString('tr-TR')}
                    </div>
                  {/if}
                  <button
                    onclick={() => unlinkDevice(mapping.vehicleId)}
                    class="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm transition-colors"
                  >
                    Bağlantıyı Kes
                  </button>
                {:else if linkingVehicleId !== mapping.vehicleId}
                  <button
                    onclick={() => startLinking(mapping.vehicleId)}
                    disabled={unlinkedDevices.length === 0}
                    class="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 disabled:text-slate-500 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
                  >
                    Cihaz Bağla
                  </button>
                {/if}
              </div>
            </div>
          {/each}

          {#if mappings.length === 0}
            <div class="p-8 text-center text-slate-500">
              Henüz araç bulunmuyor
            </div>
          {/if}
        </div>
      </div>

      <!-- Unlinked Devices -->
      {#if unlinkedDevices.length > 0}
        <div class="mt-6 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-700">
            <h2 class="text-lg font-semibold">📱 Eşleştirilmemiş Traccar Cihazları</h2>
          </div>
          <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {#each unlinkedDevices as device}
              <div class="bg-slate-700/50 rounded-lg p-3 flex items-center gap-3">
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-xl {device.status === 'online' ? 'bg-green-500/20' : 'bg-slate-600'}">
                  📱
                </div>
                <div class="flex-1">
                  <div class="font-medium text-sm">{device.name}</div>
                  <div class="text-xs text-slate-400">ID: {device.uniqueId}</div>
                </div>
                <span class="px-2 py-1 rounded text-xs {device.status === 'online' ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'}">
                  {device.status}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Traccar Client Kurulum Rehberi -->
      <div class="mt-6 bg-gradient-to-br from-slate-800 to-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-700 bg-cyan-500/10">
          <h2 class="text-lg font-semibold flex items-center gap-2">
            📲 Traccar Client Kurulum Rehberi
          </h2>
          <p class="text-sm text-slate-400 mt-1">Sürücü telefonlarına GPS takip uygulaması kurulumu</p>
        </div>

        <div class="p-6 space-y-6">
          <!-- Adım 1: Uygulama İndirme -->
          <div class="flex gap-4">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
              1
            </div>
            <div class="flex-1">
              <h3 class="font-semibold text-white mb-2">Uygulamayı İndirin</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <a 
                  href="https://play.google.com/store/apps/details?id=org.traccar.client" 
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors group"
                >
                  <div class="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center text-2xl">
                    🤖
                  </div>
                  <div>
                    <div class="font-medium text-sm group-hover:text-cyan-400 transition-colors">Android</div>
                    <div class="text-xs text-slate-400">Google Play Store</div>
                  </div>
                  <span class="ml-auto text-slate-500 group-hover:text-cyan-400">→</span>
                </a>
                <a 
                  href="https://apps.apple.com/app/traccar-client/id843156974" 
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors group"
                >
                  <div class="w-10 h-10 rounded-lg bg-slate-500/20 flex items-center justify-center text-2xl">
                    🍎
                  </div>
                  <div>
                    <div class="font-medium text-sm group-hover:text-cyan-400 transition-colors">iOS (iPhone)</div>
                    <div class="text-xs text-slate-400">App Store</div>
                  </div>
                  <span class="ml-auto text-slate-500 group-hover:text-cyan-400">→</span>
                </a>
              </div>
            </div>
          </div>

          <!-- Adım 2: Traccar'da Cihaz Oluşturma -->
          <div class="flex gap-4">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
              2
            </div>
            <div class="flex-1">
              <h3 class="font-semibold text-white mb-2">Traccar'da Cihaz Oluşturun</h3>
              <div class="bg-slate-700/30 rounded-lg p-4 space-y-3">
                <div class="flex items-start gap-2">
                  <span class="text-cyan-400">•</span>
                  <span class="text-sm text-slate-300">
                    <a href="https://traccar.optimistdemo.cloud" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:underline">
                      traccar.optimistdemo.cloud
                    </a> adresine giriş yapın
                  </span>
                </div>
                <div class="flex items-start gap-2">
                  <span class="text-cyan-400">•</span>
                  <span class="text-sm text-slate-300">Sol menüden <strong class="text-white">"Cihazlar"</strong> sekmesine gidin</span>
                </div>
                <div class="flex items-start gap-2">
                  <span class="text-cyan-400">•</span>
                  <span class="text-sm text-slate-300"><strong class="text-white">"+"</strong> butonuna tıklayarak yeni cihaz ekleyin</span>
                </div>
                <div class="flex items-start gap-2">
                  <span class="text-cyan-400">•</span>
                  <span class="text-sm text-slate-300">
                    <strong class="text-white">İsim:</strong> Buggy 1, Buggy 2 vb.<br>
                    <strong class="text-white">Tanımlayıcı (ID):</strong> buggy001, buggy002 vb. (benzersiz olmalı)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Adım 3: Uygulama Ayarları -->
          <div class="flex gap-4">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
              3
            </div>
            <div class="flex-1">
              <h3 class="font-semibold text-white mb-2">Uygulama Ayarlarını Yapın</h3>
              <div class="bg-slate-700/30 rounded-lg p-4">
                <p class="text-sm text-slate-400 mb-3">Traccar Client uygulamasını açın ve şu ayarları girin:</p>
                
                <div class="space-y-3">
                  <!-- Server URL -->
                  <div class="bg-slate-800 rounded-lg p-3">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-xs text-slate-400">Server URL (Sunucu Adresi)</span>
                      <button 
                        onclick={() => navigator.clipboard.writeText('http://185.9.38.66:5055')}
                        class="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        📋 Kopyala
                      </button>
                    </div>
                    <code class="text-cyan-400 font-mono text-sm">http://185.9.38.66:5055</code>
                  </div>

                  <!-- Device ID -->
                  <div class="bg-slate-800 rounded-lg p-3">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-xs text-slate-400">Device Identifier (Cihaz Kimliği)</span>
                    </div>
                    <code class="text-yellow-400 font-mono text-sm">buggy001</code>
                    <p class="text-xs text-slate-500 mt-1">⚠️ Traccar'da oluşturduğunuz cihaz ID'si ile aynı olmalı!</p>
                  </div>

                  <!-- Frequency -->
                  <div class="bg-slate-800 rounded-lg p-3">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-xs text-slate-400">Frequency (Güncelleme Sıklığı)</span>
                    </div>
                    <code class="text-green-400 font-mono text-sm">5 saniye</code>
                    <p class="text-xs text-slate-500 mt-1">Önerilen: 5-10 saniye arası</p>
                  </div>

                  <!-- Accuracy -->
                  <div class="bg-slate-800 rounded-lg p-3">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-xs text-slate-400">Location Accuracy (Konum Hassasiyeti)</span>
                    </div>
                    <code class="text-green-400 font-mono text-sm">High (Yüksek)</code>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Adım 4: Takibi Başlat -->
          <div class="flex gap-4">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
              4
            </div>
            <div class="flex-1">
              <h3 class="font-semibold text-white mb-2">Takibi Başlatın</h3>
              <div class="bg-slate-700/30 rounded-lg p-4 space-y-3">
                <div class="flex items-start gap-2">
                  <span class="text-green-400">✓</span>
                  <span class="text-sm text-slate-300">Uygulamada <strong class="text-white">"Service Status"</strong> anahtarını açın</span>
                </div>
                <div class="flex items-start gap-2">
                  <span class="text-green-400">✓</span>
                  <span class="text-sm text-slate-300">Konum izni isteğini <strong class="text-white">"Her Zaman İzin Ver"</strong> olarak onaylayın</span>
                </div>
                <div class="flex items-start gap-2">
                  <span class="text-green-400">✓</span>
                  <span class="text-sm text-slate-300">Pil optimizasyonunu devre dışı bırakın (arka planda çalışması için)</span>
                </div>
                <div class="flex items-start gap-2">
                  <span class="text-green-400">✓</span>
                  <span class="text-sm text-slate-300">Status kısmında <strong class="text-green-400">"Location sent"</strong> mesajını görmelisiniz</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Adım 5: Eşleştirme -->
          <div class="flex gap-4">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
              5
            </div>
            <div class="flex-1">
              <h3 class="font-semibold text-white mb-2">Bu Sayfadan Eşleştirin</h3>
              <div class="bg-slate-700/30 rounded-lg p-4">
                <p class="text-sm text-slate-300">
                  Cihaz konum göndermeye başladığında, yukarıdaki <strong class="text-white">"Araç - Cihaz Eşleştirmeleri"</strong> 
                  bölümünde görünecektir. İlgili aracın yanındaki <strong class="text-cyan-400">"Cihaz Bağla"</strong> butonuna 
                  tıklayarak eşleştirmeyi tamamlayın.
                </p>
              </div>
            </div>
          </div>

          <!-- Sorun Giderme -->
          <div class="mt-4 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
            <h4 class="text-yellow-400 font-medium mb-2 flex items-center gap-2">
              ⚠️ Sorun Giderme
            </h4>
            <ul class="text-sm text-slate-300 space-y-2">
              <li class="flex items-start gap-2">
                <span class="text-yellow-400">•</span>
                <span><strong>Cihaz görünmüyor:</strong> Server URL ve Device ID'nin doğru olduğundan emin olun</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-yellow-400">•</span>
                <span><strong>Konum güncellenmiyor:</strong> Telefonun GPS'inin açık olduğunu kontrol edin</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-yellow-400">•</span>
                <span><strong>Arka planda durıyor:</strong> Pil optimizasyonunu kapatın, uygulamayı "korumalı uygulamalar"a ekleyin</span>
              </li>
              <li class="flex items-start gap-2">
                <span class="text-yellow-400">•</span>
                <span><strong>Bağlantı hatası:</strong> İnternet bağlantısını kontrol edin (WiFi veya mobil veri)</span>
              </li>
            </ul>
          </div>

          <!-- Otomatik Senkronizasyon Bilgisi -->
          <div class="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
            <div class="text-cyan-400 font-medium flex items-center gap-2">
              🔄 Otomatik Senkronizasyon
            </div>
            <p class="text-sm text-slate-400 mt-2">
              Ana sayfada <strong class="text-white">"Canlı Takip"</strong> modu açıkken, araç konumları 
              Traccar'dan otomatik olarak çekilir ve haritada güncellenir. GPS düzeltme algoritması 
              sayesinde araçlar her zaman rota üzerinde görünür.
            </p>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
