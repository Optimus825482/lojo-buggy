<script lang="ts">
  import { onMount } from 'svelte';

  // Types
  interface Report {
    id: number;
    name: string;
    type: string;
    format: string;
    dateFrom: string;
    dateTo: string;
    vehicleId: number | null;
    filePath: string | null;
    fileSize: number | null;
    generatedAt: string | null;
    emailSentTo: string[] | null;
    emailSentAt: string | null;
    createdAt: string;
  }

  interface ScheduledReport {
    id: number;
    name: string;
    type: string;
    format: string;
    frequency: string;
    vehicleId: number | null;
    emailRecipients: string[];
    isActive: boolean;
    lastRunAt: string | null;
    nextRunAt: string | null;
    runTime: string;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
  }

  interface Vehicle {
    id: number;
    name: string;
    plateNumber: string;
  }

  // State
  let loading = $state(true);
  let reports = $state<Report[]>([]);
  let scheduledReports = $state<ScheduledReport[]>([]);
  let vehicles = $state<Vehicle[]>([]);
  let activeTab = $state<'reports' | 'scheduled' | 'create'>('reports');
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);

  // Create Report Form
  let createForm = $state({
    name: '',
    type: 'daily' as string,
    format: 'pdf' as string,
    dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    vehicleId: null as number | null,
    sendEmail: false,
    emailRecipients: '',
  });

  // Scheduled Report Form
  let scheduleForm = $state({
    name: '',
    type: 'daily' as string,
    format: 'pdf' as string,
    frequency: 'daily' as string,
    vehicleId: null as number | null,
    emailRecipients: '',
    runTime: '08:00',
    dayOfWeek: 1,
    dayOfMonth: 1,
  });

  let creating = $state(false);
  let scheduling = $state(false);

  onMount(() => {
    fetchData();
  });

  async function fetchData() {
    loading = true;
    error = null;

    try {
      const [reportsRes, scheduledRes, vehiclesRes] = await Promise.all([
        fetch('/api/reports'),
        fetch('/api/reports/scheduled'),
        fetch('/api/vehicles'),
      ]);

      const reportsData = await reportsRes.json();
      const scheduledData = await scheduledRes.json();
      const vehiclesData = await vehiclesRes.json();

      if (reportsData.success) reports = reportsData.data;
      if (scheduledData.success) scheduledReports = scheduledData.data;
      if (vehiclesData.success) vehicles = vehiclesData.data;
    } catch (err) {
      error = 'Veri yüklenirken hata oluştu';
    } finally {
      loading = false;
    }
  }

  async function createReport() {
    creating = true;
    error = null;
    success = null;

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          emailRecipients: createForm.sendEmail 
            ? createForm.emailRecipients.split(',').map(e => e.trim()).filter(Boolean)
            : [],
        }),
      });

      const data = await res.json();
      if (data.success) {
        success = 'Rapor oluşturuldu';
        await fetchData();
        activeTab = 'reports';
      } else {
        error = data.message;
      }
    } catch (err) {
      error = 'Rapor oluşturma hatası';
    } finally {
      creating = false;
    }
  }

  async function createScheduledReport() {
    scheduling = true;
    error = null;
    success = null;

    try {
      const res = await fetch('/api/reports/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scheduleForm,
          emailRecipients: scheduleForm.emailRecipients.split(',').map(e => e.trim()).filter(Boolean),
        }),
      });

      const data = await res.json();
      if (data.success) {
        success = 'Zamanlanmış rapor oluşturuldu';
        await fetchData();
        activeTab = 'scheduled';
      } else {
        error = data.message;
      }
    } catch (err) {
      error = 'Zamanlanmış rapor oluşturma hatası';
    } finally {
      scheduling = false;
    }
  }

  async function deleteReport(id: number) {
    if (!confirm('Bu raporu silmek istediğinize emin misiniz?')) return;

    try {
      const res = await fetch(`/api/reports?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        success = 'Rapor silindi';
        await fetchData();
      } else {
        error = data.message;
      }
    } catch (err) {
      error = 'Silme hatası';
    }
  }

  async function toggleScheduled(id: number, isActive: boolean) {
    try {
      const res = await fetch(`/api/reports/scheduled?action=toggle&id=${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchData();
      }
    } catch (err) {
      error = 'Güncelleme hatası';
    }
  }

  async function runScheduledNow(id: number) {
    try {
      const res = await fetch(`/api/reports/scheduled?action=run&id=${id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        success = 'Rapor çalıştırıldı';
        await fetchData();
      } else {
        error = data.message;
      }
    } catch (err) {
      error = 'Çalıştırma hatası';
    }
  }

  async function deleteScheduled(id: number) {
    if (!confirm('Bu zamanlanmış raporu silmek istediğinize emin misiniz?')) return;

    try {
      const res = await fetch(`/api/reports/scheduled?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        success = 'Zamanlanmış rapor silindi';
        await fetchData();
      } else {
        error = data.message;
      }
    } catch (err) {
      error = 'Silme hatası';
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('tr-TR');
  }

  function formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('tr-TR');
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  const typeLabels: Record<string, string> = {
    daily: 'Günlük',
    weekly: 'Haftalık',
    monthly: 'Aylık',
    custom: 'Özel',
    vehicle: 'Araç',
    trip: 'Seyahat',
  };

  const frequencyLabels: Record<string, string> = {
    daily: 'Günlük',
    weekly: 'Haftalık',
    monthly: 'Aylık',
  };

  const dayLabels = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
</script>

<svelte:head>
  <title>Raporlar | Buggy Shuttle</title>
</svelte:head>

<div class="min-h-screen bg-slate-900 text-white p-6">
  <div class="max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold">📊 Raporlar</h1>
        <p class="text-slate-400 text-sm mt-1">Rapor oluşturma, planlama ve dışa aktarma</p>
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

    {#if success}
      <div class="mb-6 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400">
        ✅ {success}
      </div>
    {/if}

    <!-- Tabs -->
    <div class="flex gap-2 mb-6">
      <button
        onclick={() => activeTab = 'reports'}
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {activeTab === 'reports' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
      >
        📄 Raporlar ({reports.length})
      </button>
      <button
        onclick={() => activeTab = 'scheduled'}
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {activeTab === 'scheduled' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
      >
        ⏰ Zamanlanmış ({scheduledReports.length})
      </button>
      <button
        onclick={() => activeTab = 'create'}
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {activeTab === 'create' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
      >
        ➕ Yeni Rapor
      </button>
    </div>

    {#if loading}
      <div class="flex items-center justify-center py-20">
        <div class="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
        <span class="ml-3 text-slate-400">Yükleniyor...</span>
      </div>
    {:else}

      <!-- Reports List -->
      {#if activeTab === 'reports'}
        <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-700">
            <h2 class="text-lg font-semibold">Oluşturulan Raporlar</h2>
          </div>

          {#if reports.length === 0}
            <div class="p-8 text-center text-slate-500">
              Henüz rapor oluşturulmamış
            </div>
          {:else}
            <div class="divide-y divide-slate-700">
              {#each reports as report}
                <div class="p-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors">
                  <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center text-2xl">
                      {report.format === 'pdf' ? '📕' : report.format === 'excel' ? '📗' : '📄'}
                    </div>
                    <div>
                      <div class="font-medium">{report.name}</div>
                      <div class="text-xs text-slate-400 flex items-center gap-2">
                        <span class="px-2 py-0.5 bg-slate-700 rounded">{typeLabels[report.type] || report.type}</span>
                        <span>{formatDate(report.dateFrom)} - {formatDate(report.dateTo)}</span>
                        {#if report.fileSize}
                          <span>• {formatFileSize(report.fileSize)}</span>
                        {/if}
                      </div>
                      {#if report.emailSentTo && report.emailSentTo.length > 0}
                        <div class="text-xs text-green-400 mt-1">
                          ✉️ {report.emailSentTo.join(', ')} adresine gönderildi
                        </div>
                      {/if}
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-slate-500">{formatDateTime(report.createdAt)}</span>
                    {#if report.filePath}
                      <a
                        href="/api/reports/download/{report.id}"
                        class="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 rounded-lg text-sm transition-colors"
                      >
                        ⬇️ İndir
                      </a>
                    {/if}
                    <button
                      onclick={() => deleteReport(report.id)}
                      class="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Scheduled Reports -->
      {#if activeTab === 'scheduled'}
        <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-700">
            <h2 class="text-lg font-semibold">Zamanlanmış Raporlar</h2>
          </div>

          {#if scheduledReports.length === 0}
            <div class="p-8 text-center text-slate-500">
              Henüz zamanlanmış rapor yok
            </div>
          {:else}
            <div class="divide-y divide-slate-700">
              {#each scheduledReports as sr}
                <div class="p-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors">
                  <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-lg flex items-center justify-center text-2xl {sr.isActive ? 'bg-green-500/20' : 'bg-slate-700'}">
                      ⏰
                    </div>
                    <div>
                      <div class="font-medium flex items-center gap-2">
                        {sr.name}
                        <span class="px-2 py-0.5 text-xs rounded {sr.isActive ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'}">
                          {sr.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </div>
                      <div class="text-xs text-slate-400 flex items-center gap-2 mt-1">
                        <span class="px-2 py-0.5 bg-slate-700 rounded">{typeLabels[sr.type] || sr.type}</span>
                        <span class="px-2 py-0.5 bg-slate-700 rounded">{frequencyLabels[sr.frequency]}</span>
                        <span>🕐 {sr.runTime}</span>
                        {#if sr.frequency === 'weekly' && sr.dayOfWeek !== null}
                          <span>• {dayLabels[sr.dayOfWeek]}</span>
                        {/if}
                        {#if sr.frequency === 'monthly' && sr.dayOfMonth !== null}
                          <span>• Ayın {sr.dayOfMonth}. günü</span>
                        {/if}
                      </div>
                      <div class="text-xs text-slate-500 mt-1">
                        📧 {sr.emailRecipients.join(', ')}
                      </div>
                      {#if sr.nextRunAt}
                        <div class="text-xs text-cyan-400 mt-1">
                          Sonraki çalışma: {formatDateTime(sr.nextRunAt)}
                        </div>
                      {/if}
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      onclick={() => toggleScheduled(sr.id, !sr.isActive)}
                      class="px-3 py-1.5 rounded-lg text-sm transition-colors {sr.isActive ? 'bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400' : 'bg-green-600/20 hover:bg-green-600/40 text-green-400'}"
                    >
                      {sr.isActive ? '⏸️ Durdur' : '▶️ Başlat'}
                    </button>
                    <button
                      onclick={() => runScheduledNow(sr.id)}
                      class="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 rounded-lg text-sm transition-colors"
                    >
                      🚀 Şimdi Çalıştır
                    </button>
                    <button
                      onclick={() => deleteScheduled(sr.id)}
                      class="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- Create Report Form -->
      {#if activeTab === 'create'}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Tek Seferlik Rapor -->
          <div class="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
              📄 Tek Seferlik Rapor Oluştur
            </h2>

            <div class="space-y-4">
              <div>
                <label class="block text-sm text-slate-400 mb-1">Rapor Adı</label>
                <input
                  type="text"
                  bind:value={createForm.name}
                  placeholder="Örn: Aralık 2024 Raporu"
                  class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-slate-400 mb-1">Rapor Tipi</label>
                  <select bind:value={createForm.type} class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                    <option value="daily">Günlük</option>
                    <option value="weekly">Haftalık</option>
                    <option value="monthly">Aylık</option>
                    <option value="custom">Özel</option>
                    <option value="vehicle">Araç Bazlı</option>
                    <option value="trip">Seyahat</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm text-slate-400 mb-1">Format</label>
                  <select bind:value={createForm.format} class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-slate-400 mb-1">Başlangıç Tarihi</label>
                  <input type="date" bind:value={createForm.dateFrom} class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
                <div>
                  <label class="block text-sm text-slate-400 mb-1">Bitiş Tarihi</label>
                  <input type="date" bind:value={createForm.dateTo} class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
              </div>

              <div>
                <label class="block text-sm text-slate-400 mb-1">Araç (Opsiyonel)</label>
                <select bind:value={createForm.vehicleId} class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                  <option value={null}>Tüm Araçlar</option>
                  {#each vehicles as v}
                    <option value={v.id}>{v.name} ({v.plateNumber})</option>
                  {/each}
                </select>
              </div>

              <div>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" bind:checked={createForm.sendEmail} class="w-4 h-4 rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500" />
                  <span class="text-sm text-slate-300">Email ile gönder</span>
                </label>
              </div>

              {#if createForm.sendEmail}
                <div>
                  <label class="block text-sm text-slate-400 mb-1">Email Adresleri (virgülle ayırın)</label>
                  <input
                    type="text"
                    bind:value={createForm.emailRecipients}
                    placeholder="email1@example.com, email2@example.com"
                    class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              {/if}

              <button
                onclick={createReport}
                disabled={creating || !createForm.name}
                class="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {#if creating}
                  <div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Oluşturuluyor...
                {:else}
                  📄 Rapor Oluştur
                {/if}
              </button>
            </div>
          </div>

          <!-- Zamanlanmış Rapor -->
          <div class="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
              ⏰ Zamanlanmış Rapor Oluştur
            </h2>

            <div class="space-y-4">
              <div>
                <label class="block text-sm text-slate-400 mb-1">Rapor Adı</label>
                <input
                  type="text"
                  bind:value={scheduleForm.name}
                  placeholder="Örn: Günlük Özet Raporu"
                  class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-slate-400 mb-1">Rapor Tipi</label>
                  <select bind:value={scheduleForm.type} class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                    <option value="daily">Günlük</option>
                    <option value="weekly">Haftalık</option>
                    <option value="monthly">Aylık</option>
                    <option value="vehicle">Araç Bazlı</option>
                    <option value="trip">Seyahat</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm text-slate-400 mb-1">Format</label>
                  <select bind:value={scheduleForm.format} class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-slate-400 mb-1">Sıklık</label>
                  <select bind:value={scheduleForm.frequency} class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                    <option value="daily">Günlük</option>
                    <option value="weekly">Haftalık</option>
                    <option value="monthly">Aylık</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm text-slate-400 mb-1">Çalışma Saati</label>
                  <input type="time" bind:value={scheduleForm.runTime} class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                </div>
              </div>

              {#if scheduleForm.frequency === 'weekly'}
                <div>
                  <label class="block text-sm text-slate-400 mb-1">Gün</label>
                  <select bind:value={scheduleForm.dayOfWeek} class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                    {#each dayLabels as day, i}
                      <option value={i}>{day}</option>
                    {/each}
                  </select>
                </div>
              {/if}

              {#if scheduleForm.frequency === 'monthly'}
                <div>
                  <label class="block text-sm text-slate-400 mb-1">Ayın Günü</label>
                  <select bind:value={scheduleForm.dayOfMonth} class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                    {#each Array.from({length: 28}, (_, i) => i + 1) as day}
                      <option value={day}>{day}</option>
                    {/each}
                  </select>
                </div>
              {/if}

              <div>
                <label class="block text-sm text-slate-400 mb-1">Araç (Opsiyonel)</label>
                <select bind:value={scheduleForm.vehicleId} class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                  <option value={null}>Tüm Araçlar</option>
                  {#each vehicles as v}
                    <option value={v.id}>{v.name} ({v.plateNumber})</option>
                  {/each}
                </select>
              </div>

              <div>
                <label class="block text-sm text-slate-400 mb-1">Email Adresleri (virgülle ayırın)</label>
                <input
                  type="text"
                  bind:value={scheduleForm.emailRecipients}
                  placeholder="email1@example.com, email2@example.com"
                  class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <button
                onclick={createScheduledReport}
                disabled={scheduling || !scheduleForm.name || !scheduleForm.emailRecipients}
                class="w-full px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {#if scheduling}
                  <div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Oluşturuluyor...
                {:else}
                  ⏰ Zamanlanmış Rapor Oluştur
                {/if}
              </button>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>
