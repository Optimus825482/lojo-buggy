<script lang="ts">
  import { onMount } from 'svelte';
  import { appStore } from '$lib/stores/app.svelte';
  
  interface TraccarDevice {
    id: number;
    name: string;
    uniqueId: string;
    status: string;
  }
  
  interface Vehicle {
    id: number;
    name: string;
    plateNumber: string;
    status: 'available' | 'busy' | 'offline' | 'maintenance';
    lat: number;
    lng: number;
    speed: number;
    lastSeen: Date;
    totalTrips: number;
    todayTrips: number;
    traccarId: number | null;
    traccarDevice?: TraccarDevice | null;
  }
  
  let vehicles = $state<Vehicle[]>([]);
  let unlinkedDevices = $state<TraccarDevice[]>([]);
  let loading = $state(true);
  let loadingTraccar = $state(false);
  let showAddModal = $state(false);
  let showEditModal = $state(false);
  let selectedVehicle = $state<Vehicle | null>(null);
  
  // Form state
  let formData = $state({
    name: '',
    plateNumber: '',
    status: 'available' as Vehicle['status'],
    traccarId: null as number | null
  });
  
  async function fetchVehicles() {
    loading = true;
    try {
      const res = await fetch('/api/vehicles');
      if (res.ok) {
        const data = await res.json();
        vehicles = data.data.map((v: any) => ({
          ...v,
          lastSeen: new Date(v.lastSeen || v.updatedAt),
          totalTrips: v.totalTrips || Math.floor(Math.random() * 500),
          todayTrips: v.todayTrips || Math.floor(Math.random() * 20),
          traccarId: v.traccarId || null,
          traccarDevice: null
        }));
      }
      // Traccar eşleştirme bilgilerini de çek
      await fetchTraccarMappings();
    } catch (err) {
      console.error('Araçlar yüklenemedi:', err);
      appStore.addNotification('error', 'Hata', 'Araçlar yüklenemedi');
    } finally {
      loading = false;
    }
  }
  
  async function fetchTraccarMappings() {
    loadingTraccar = true;
    try {
      const res = await fetch('/api/traccar/sync');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // Eşleştirilmemiş cihazları kaydet
          unlinkedDevices = data.data.unlinkedDevices || [];
          
          // Araçlara Traccar cihaz bilgilerini ekle
          const mappings = data.data.mappings || [];
          vehicles = vehicles.map(v => {
            const mapping = mappings.find((m: any) => m.vehicleId === v.id);
            return {
              ...v,
              traccarDevice: mapping?.traccarDevice || null
            };
          });
        }
      }
    } catch (err) {
      console.error('Traccar bilgileri yüklenemedi:', err);
    } finally {
      loadingTraccar = false;
    }
  }
  
  function openAddModal() {
    formData = { name: '', plateNumber: '', status: 'available', traccarId: null };
    showAddModal = true;
  }
  
  function openEditModal(vehicle: Vehicle) {
    selectedVehicle = vehicle;
    formData = {
      name: vehicle.name,
      plateNumber: vehicle.plateNumber,
      status: vehicle.status,
      traccarId: vehicle.traccarId
    };
    showEditModal = true;
  }
  
  async function handleAdd() {
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        appStore.addNotification('success', 'Başarılı', 'Araç eklendi');
        showAddModal = false;
        fetchVehicles();
      } else {
        throw new Error('Araç eklenemedi');
      }
    } catch (err) {
      appStore.addNotification('error', 'Hata', 'Araç eklenemedi');
    }
  }
  
  async function handleEdit() {
    if (!selectedVehicle) return;
    
    try {
      // Önce araç bilgilerini güncelle
      const res = await fetch(`/api/vehicles/${selectedVehicle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          plateNumber: formData.plateNumber,
          status: formData.status
        })
      });
      
      if (!res.ok) {
        throw new Error('Araç güncellenemedi');
      }
      
      // Traccar eşleştirmesi değiştiyse
      const oldTraccarId = selectedVehicle.traccarId;
      const newTraccarId = formData.traccarId;
      
      if (oldTraccarId !== newTraccarId) {
        if (newTraccarId) {
          // Yeni cihaz eşleştir
          const linkRes = await fetch('/api/traccar/sync?action=link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vehicleId: selectedVehicle.id,
              traccarDeviceId: newTraccarId
            })
          });
          
          if (!linkRes.ok) {
            const err = await linkRes.json();
            throw new Error(err.message || 'Traccar eşleştirmesi başarısız');
          }
        } else if (oldTraccarId) {
          // Eşleştirmeyi kaldır
          const unlinkRes = await fetch('/api/traccar/sync?action=unlink', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vehicleId: selectedVehicle.id
            })
          });
          
          if (!unlinkRes.ok) {
            throw new Error('Traccar eşleştirmesi kaldırılamadı');
          }
        }
      }
      
      appStore.addNotification('success', 'Başarılı', 'Araç güncellendi');
      showEditModal = false;
      fetchVehicles();
    } catch (err: any) {
      appStore.addNotification('error', 'Hata', err.message || 'Araç güncellenemedi');
    }
  }
  
  async function handleDelete(id: number) {
    if (!confirm('Bu aracı silmek istediğinize emin misiniz?')) return;
    
    try {
      const res = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' });
      if (res.ok) {
        appStore.addNotification('success', 'Başarılı', 'Araç silindi');
        fetchVehicles();
      }
    } catch (err) {
      appStore.addNotification('error', 'Hata', 'Araç silinemedi');
    }
  }
  
  function getStatusBadge(status: Vehicle['status']) {
    const badges = {
      available: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Müsait' },
      busy: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Görevde' },
      offline: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Çevrimdışı' },
      maintenance: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Bakımda' }
    };
    return badges[status] || badges.offline;
  }
  
  onMount(() => {
    fetchVehicles();
  });
</script>

<div class="p-6">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-bold">🚐 Araç Yönetimi</h1>
      <p class="text-dark-400 text-sm mt-1">Shuttle araçlarını yönetin ve takip edin</p>
    </div>
    <button
      onclick={openAddModal}
      class="px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg font-medium transition-colors flex items-center gap-2"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      Yeni Araç
    </button>
  </div>
  
  <!-- Stats Cards -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
    <div class="bg-dark-800 rounded-xl p-4 border border-dark-700">
      <div class="text-dark-400 text-sm">Toplam Araç</div>
      <div class="text-3xl font-bold mt-1">{vehicles.length}</div>
    </div>
    <div class="bg-dark-800 rounded-xl p-4 border border-dark-700">
      <div class="text-dark-400 text-sm">Müsait</div>
      <div class="text-3xl font-bold text-green-400 mt-1">{vehicles.filter(v => v.status === 'available').length}</div>
    </div>
    <div class="bg-dark-800 rounded-xl p-4 border border-dark-700">
      <div class="text-dark-400 text-sm">Görevde</div>
      <div class="text-3xl font-bold text-yellow-400 mt-1">{vehicles.filter(v => v.status === 'busy').length}</div>
    </div>
    <div class="bg-dark-800 rounded-xl p-4 border border-dark-700">
      <div class="text-dark-400 text-sm">Çevrimdışı</div>
      <div class="text-3xl font-bold text-gray-400 mt-1">{vehicles.filter(v => v.status === 'offline' || v.status === 'maintenance').length}</div>
    </div>
  </div>
  
  <!-- Vehicles Table -->
  <div class="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-dark-900">
          <tr>
            <th class="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Araç</th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Plaka</th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Traccar Cihaz</th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Durum</th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Hız</th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Bugün</th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Toplam</th>
            <th class="px-6 py-4 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider">Son Görülme</th>
            <th class="px-6 py-4 text-right text-xs font-semibold text-dark-400 uppercase tracking-wider">İşlemler</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-dark-700">
          {#if loading}
            <tr>
              <td colspan="9" class="px-6 py-12 text-center text-dark-400">
                <div class="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                Yükleniyor...
              </td>
            </tr>
          {:else if vehicles.length === 0}
            <tr>
              <td colspan="9" class="px-6 py-12 text-center text-dark-400">
                <div class="text-4xl mb-2">🚐</div>
                Henüz araç eklenmemiş
              </td>
            </tr>
          {:else}
            {#each vehicles as vehicle}
              {@const badge = getStatusBadge(vehicle.status)}
              <tr class="hover:bg-dark-750 transition-colors">
                <td class="px-6 py-4">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center text-xl">🚐</div>
                    <span class="font-medium">{vehicle.name}</span>
                  </div>
                </td>
                <td class="px-6 py-4 text-dark-300">{vehicle.plateNumber}</td>
                <td class="px-6 py-4">
                  {#if vehicle.traccarDevice}
                    <div class="flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full {vehicle.traccarDevice.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}"></span>
                      <span class="text-dark-300 text-sm">{vehicle.traccarDevice.name}</span>
                    </div>
                  {:else}
                    <span class="text-dark-500 text-sm italic">Eşleştirilmemiş</span>
                  {/if}
                </td>
                <td class="px-6 py-4">
                  <span class="px-3 py-1 rounded-full text-xs font-medium {badge.bg} {badge.text}">
                    {badge.label}
                  </span>
                </td>
                <td class="px-6 py-4 text-dark-300">{vehicle.speed?.toFixed(0) || 0} km/s</td>
                <td class="px-6 py-4 text-dark-300">{vehicle.todayTrips} sefer</td>
                <td class="px-6 py-4 text-dark-300">{vehicle.totalTrips} sefer</td>
                <td class="px-6 py-4 text-dark-400 text-sm">
                  {new Date(vehicle.lastSeen).toLocaleString('tr-TR')}
                </td>
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      onclick={() => openEditModal(vehicle)}
                      class="p-2 hover:bg-dark-700 rounded-lg transition-colors text-dark-400 hover:text-white"
                      title="Düzenle"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onclick={() => handleDelete(vehicle.id)}
                      class="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-dark-400 hover:text-red-400"
                      title="Sil"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- Add Modal -->
{#if showAddModal}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" tabindex="-1" onclick={() => showAddModal = false} onkeydown={(e) => e.key === 'Escape' && (showAddModal = false)}>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="bg-dark-800 rounded-2xl p-6 w-[450px] shadow-2xl border border-dark-700" role="document" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
      <h3 class="text-xl font-bold mb-6">🚐 Yeni Araç Ekle</h3>
      
      <div class="space-y-4">
        <div>
          <label for="add-name" class="block text-sm text-dark-400 mb-2">Araç Adı</label>
          <input
            id="add-name"
            type="text"
            bind:value={formData.name}
            placeholder="Buggy-07"
            class="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl focus:outline-none focus:border-primary-500 transition-colors"
          />
        </div>
        <div>
          <label for="add-plate" class="block text-sm text-dark-400 mb-2">Plaka</label>
          <input
            id="add-plate"
            type="text"
            bind:value={formData.plateNumber}
            placeholder="48 ABC 123"
            class="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl focus:outline-none focus:border-primary-500 transition-colors"
          />
        </div>
        <div>
          <label for="add-status" class="block text-sm text-dark-400 mb-2">Durum</label>
          <select
            id="add-status"
            bind:value={formData.status}
            class="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl focus:outline-none focus:border-primary-500 transition-colors"
          >
            <option value="available">Müsait</option>
            <option value="busy">Görevde</option>
            <option value="offline">Çevrimdışı</option>
            <option value="maintenance">Bakımda</option>
          </select>
        </div>
      </div>
      
      <div class="flex gap-3 mt-6">
        <button
          onclick={() => showAddModal = false}
          class="flex-1 py-3 bg-dark-700 hover:bg-dark-600 rounded-xl transition-colors font-medium"
        >
          İptal
        </button>
        <button
          onclick={handleAdd}
          class="flex-1 py-3 bg-primary-600 hover:bg-primary-500 rounded-xl transition-colors font-medium"
        >
          Ekle
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if showEditModal && selectedVehicle}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" role="dialog" aria-modal="true" tabindex="-1" onclick={() => showEditModal = false} onkeydown={(e) => e.key === 'Escape' && (showEditModal = false)}>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="bg-dark-800 rounded-2xl p-6 w-[500px] shadow-2xl border border-dark-700 max-h-[90vh] overflow-y-auto" role="document" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
      <h3 class="text-xl font-bold mb-6">✏️ Araç Düzenle</h3>
      
      <div class="space-y-4">
        <div>
          <label for="edit-name" class="block text-sm text-dark-400 mb-2">Araç Adı</label>
          <input
            id="edit-name"
            type="text"
            bind:value={formData.name}
            class="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl focus:outline-none focus:border-primary-500 transition-colors"
          />
        </div>
        <div>
          <label for="edit-plate" class="block text-sm text-dark-400 mb-2">Plaka</label>
          <input
            id="edit-plate"
            type="text"
            bind:value={formData.plateNumber}
            class="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl focus:outline-none focus:border-primary-500 transition-colors"
          />
        </div>
        <div>
          <label for="edit-status" class="block text-sm text-dark-400 mb-2">Durum</label>
          <select
            id="edit-status"
            bind:value={formData.status}
            class="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl focus:outline-none focus:border-primary-500 transition-colors"
          >
            <option value="available">Müsait</option>
            <option value="busy">Görevde</option>
            <option value="offline">Çevrimdışı</option>
            <option value="maintenance">Bakımda</option>
          </select>
        </div>
        
        <!-- Traccar Cihaz Eşleştirme -->
        <div class="pt-4 border-t border-dark-700">
          <label for="edit-traccar" class="block text-sm text-dark-400 mb-2">
            📡 Traccar GPS Cihazı
          </label>
          <select
            id="edit-traccar"
            bind:value={formData.traccarId}
            class="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl focus:outline-none focus:border-primary-500 transition-colors"
          >
            <option value={null}>-- Cihaz Seçilmedi --</option>
            {#if selectedVehicle.traccarDevice}
              <!-- Mevcut eşleştirilmiş cihaz -->
              <option value={selectedVehicle.traccarId}>
                ✓ {selectedVehicle.traccarDevice.name} (Mevcut)
              </option>
            {/if}
            {#each unlinkedDevices as device}
              <option value={device.id}>
                {device.name} ({device.status === 'online' ? '🟢 Çevrimiçi' : '⚫ Çevrimdışı'})
              </option>
            {/each}
          </select>
          
          {#if selectedVehicle.traccarDevice}
            <div class="mt-2 p-3 bg-dark-700/50 rounded-lg">
              <div class="flex items-center gap-2 text-sm">
                <span class="w-2 h-2 rounded-full {selectedVehicle.traccarDevice.status === 'online' ? 'bg-green-500' : 'bg-gray-500'}"></span>
                <span class="text-dark-300">Mevcut: {selectedVehicle.traccarDevice.name}</span>
                <span class="text-dark-500">({selectedVehicle.traccarDevice.uniqueId})</span>
              </div>
            </div>
          {:else}
            <p class="mt-2 text-xs text-dark-500">
              Bu araca henüz bir GPS cihazı eşleştirilmemiş. Traccar'da tanımlı cihazlardan birini seçebilirsiniz.
            </p>
          {/if}
          
          {#if loadingTraccar}
            <p class="mt-2 text-xs text-dark-400 animate-pulse">Traccar cihazları yükleniyor...</p>
          {/if}
        </div>
      </div>
      
      <div class="flex gap-3 mt-6">
        <button
          onclick={() => showEditModal = false}
          class="flex-1 py-3 bg-dark-700 hover:bg-dark-600 rounded-xl transition-colors font-medium"
        >
          İptal
        </button>
        <button
          onclick={handleEdit}
          class="flex-1 py-3 bg-primary-600 hover:bg-primary-500 rounded-xl transition-colors font-medium"
        >
          Kaydet
        </button>
      </div>
    </div>
  </div>
{/if}
