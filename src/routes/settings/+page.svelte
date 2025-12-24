<script lang="ts">
  import { onMount } from 'svelte';
  import { appStore } from '$lib/stores/app.svelte';
  
  interface Settings {
    geofenceRadius: number;
    autoAssign: boolean;
    maxWaitTime: number;
    notificationSound: boolean;
  }
  
  let settings = $state<Settings>({
    geofenceRadius: 30,
    autoAssign: false,
    maxWaitTime: 300,
    notificationSound: true
  });
  
  let loading = $state(true);
  let saving = $state(false);
  let activeTab = $state<'general' | 'traccar' | 'notifications' | 'system'>('general');
  
  async function fetchSettings() {
    loading = true;
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          settings = { ...settings, ...data.data };
        }
      }
    } catch (err) {
      console.error('Ayarlar yüklenemedi:', err);
    } finally {
      loading = false;
    }
  }
  
  onMount(() => {
    fetchSettings();
  });
</script>

<div class="p-6">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-bold">⚙️ Sistem Ayarları</h1>
      <p class="text-dark-400 text-sm mt-1">Shuttle sistemini yapılandırın</p>
    </div>
  </div>

  <div class="flex gap-6">
    <!-- Sidebar Tabs -->
    <div class="w-64 space-y-1">
      {#each [
        { id: 'general', icon: '🎛️', label: 'Genel Ayarlar' },
        { id: 'traccar', icon: '📡', label: 'Traccar Entegrasyonu' },
        { id: 'notifications', icon: '🔔', label: 'Bildirimler' },
        { id: 'system', icon: '🖥️', label: 'Sistem' }
      ] as tab}
        <button onclick={() => activeTab = tab.id as typeof activeTab}
          class="w-full px-4 py-3 rounded-xl text-left transition-all flex items-center gap-3
            {activeTab === tab.id ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' : 'bg-dark-800 text-dark-300 hover:bg-dark-750 border border-transparent'}">
          <span class="text-xl">{tab.icon}</span>
          <span class="font-medium">{tab.label}</span>
        </button>
      {/each}
    </div>
    
    <!-- Content -->
    <div class="flex-1 bg-dark-800 rounded-xl p-6 border border-dark-700">
      {#if activeTab === 'general'}
        <h2 class="text-lg font-semibold mb-6">🎛️ Genel Ayarlar</h2>
        <div class="space-y-6">
          <div>
            <label for="geofenceRadius" class="block text-sm text-dark-400 mb-2">Varsayılan Geofence Yarıçapı (metre)</label>
            <input id="geofenceRadius" type="number" bind:value={settings.geofenceRadius} min="10" max="100"
              class="w-full max-w-xs px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl focus:outline-none focus:border-primary-500" />
            <p class="text-xs text-dark-500 mt-1">Araçların durağa yaklaştığını algılama mesafesi</p>
          </div>
          <div>
            <label for="maxWaitTime" class="block text-sm text-dark-400 mb-2">Maksimum Bekleme Süresi (saniye)</label>
            <input id="maxWaitTime" type="number" bind:value={settings.maxWaitTime} min="60" max="600"
              class="w-full max-w-xs px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl focus:outline-none focus:border-primary-500" />
            <p class="text-xs text-dark-500 mt-1">Bu süre aşılırsa uyarı verilir</p>
          </div>
          <div class="flex items-center justify-between max-w-md">
            <div>
              <div class="font-medium">Otomatik Atama</div>
              <p class="text-xs text-dark-500">Çağrıları en yakın araca otomatik ata</p>
            </div>
            <button 
              onclick={() => settings.autoAssign = !settings.autoAssign}
              aria-label="Otomatik atama {settings.autoAssign ? 'kapalı' : 'açık'}"
              class="w-14 h-7 rounded-full transition-colors {settings.autoAssign ? 'bg-primary-500' : 'bg-dark-600'}">
              <div class="w-6 h-6 bg-white rounded-full shadow transition-transform {settings.autoAssign ? 'translate-x-7' : 'translate-x-0.5'}"></div>
            </button>
          </div>
        </div>
      {:else if activeTab === 'traccar'}
        <h2 class="text-lg font-semibold mb-6">📡 Traccar Entegrasyonu</h2>
        <div class="space-y-6">
          <!-- Detaylı Ayarlar Linki -->
          <a 
            href="/settings/traccar"
            class="block p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl hover:bg-cyan-500/20 transition-colors"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="text-2xl">🎯</span>
                <div>
                  <div class="font-medium text-cyan-400">Traccar GPS Ayarları</div>
                  <p class="text-sm text-dark-400 mt-1">Araç-cihaz eşleştirme, GPS düzeltme ve canlı takip ayarları</p>
                </div>
              </div>
              <span class="text-cyan-400 text-xl">→</span>
            </div>
          </a>
          
          <div class="p-4 bg-dark-700/50 border border-dark-600 rounded-xl">
            <div class="flex items-start gap-3">
              <span class="text-xl">ℹ️</span>
              <div>
                <div class="font-medium text-dark-300">Sunucu Yapılandırması</div>
                <p class="text-sm text-dark-400 mt-1">
                  Traccar bağlantı bilgileri <code class="px-1.5 py-0.5 bg-dark-600 rounded text-xs">.env</code> dosyasından okunur:
                </p>
                <ul class="text-xs text-dark-500 mt-2 space-y-1 font-mono">
                  <li>• TRACCAR_URL</li>
                  <li>• TRACCAR_USER</li>
                  <li>• TRACCAR_PASSWORD</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      {:else if activeTab === 'notifications'}
        <h2 class="text-lg font-semibold mb-6">🔔 Bildirim Ayarları</h2>
        <div class="space-y-4">
          <div class="flex items-center justify-between max-w-md p-4 bg-dark-700/50 rounded-xl">
            <div>
              <div class="font-medium">Ses Bildirimleri</div>
              <p class="text-xs text-dark-500">Yeni çağrılarda ses çal</p>
            </div>
            <button 
              onclick={() => settings.notificationSound = !settings.notificationSound}
              aria-label="Ses bildirimleri {settings.notificationSound ? 'kapalı' : 'açık'}"
              class="w-14 h-7 rounded-full transition-colors {settings.notificationSound ? 'bg-primary-500' : 'bg-dark-600'}">
              <div class="w-6 h-6 bg-white rounded-full shadow transition-transform {settings.notificationSound ? 'translate-x-7' : 'translate-x-0.5'}"></div>
            </button>
          </div>
        </div>
      {:else if activeTab === 'system'}
        <h2 class="text-lg font-semibold mb-6">🖥️ Sistem Bilgileri</h2>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="p-4 bg-dark-700/50 rounded-xl">
              <div class="text-dark-400 text-sm">Versiyon</div>
              <div class="font-mono mt-1">1.0.0</div>
            </div>
            <div class="p-4 bg-dark-700/50 rounded-xl">
              <div class="text-dark-400 text-sm">Veritabanı</div>
              <div class="font-mono mt-1">PostgreSQL</div>
            </div>
            <div class="p-4 bg-dark-700/50 rounded-xl">
              <div class="text-dark-400 text-sm">Framework</div>
              <div class="font-mono mt-1">SvelteKit</div>
            </div>
            <div class="p-4 bg-dark-700/50 rounded-xl">
              <div class="text-dark-400 text-sm">Mod</div>
              <div class="font-mono mt-1">{appStore.demoEnabled ? 'Demo Aktif' : 'Canlı'}</div>
            </div>
          </div>
          
          <!-- Demo Modu Toggle -->
          <div class="pt-4 border-t border-dark-700">
            <div class="flex items-center justify-between max-w-md p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <div>
                <div class="font-medium text-yellow-400">🎮 Demo Modu</div>
                <p class="text-xs text-dark-400 mt-1">Demo butonları ve simülasyon özellikleri</p>
              </div>
              <button 
                onclick={() => appStore.toggleDemoEnabled()}
                aria-label="Demo modu {appStore.demoEnabled ? 'kapalı' : 'açık'}"
                class="w-14 h-7 rounded-full transition-colors {appStore.demoEnabled ? 'bg-yellow-500' : 'bg-dark-600'}">
                <div class="w-6 h-6 bg-white rounded-full shadow transition-transform {appStore.demoEnabled ? 'translate-x-7' : 'translate-x-0.5'}"></div>
              </button>
            </div>
            {#if !appStore.demoEnabled}
              <p class="text-xs text-dark-500 mt-2 ml-1">Demo kapatıldığında arayüzdeki tüm demo butonları gizlenir.</p>
            {/if}
          </div>
          
          <div class="pt-4 border-t border-dark-700">
            <button class="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg font-medium transition-colors">
              🗑️ Önbelleği Temizle
            </button>
          </div>
        </div>
      {/if}
      
      <!-- Save Button -->
      <div class="mt-8 pt-6 border-t border-dark-700 flex justify-end">
        <button onclick={async () => {
          saving = true;
          try {
            // Save settings to API
            appStore.addNotification('success', 'Başarılı', 'Ayarlar kaydedildi');
          } catch {
            appStore.addNotification('error', 'Hata', 'Ayarlar kaydedilemedi');
          } finally {
            saving = false;
          }
        }} disabled={saving}
          class="px-6 py-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 rounded-xl font-medium transition-colors flex items-center gap-2">
          {#if saving}
            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          {/if}
          💾 Kaydet
        </button>
      </div>
    </div>
  </div>
</div>
