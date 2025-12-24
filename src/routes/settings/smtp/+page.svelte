<script lang="ts">
  import { onMount } from 'svelte';

  // State
  let loading = $state(true);
  let saving = $state(false);
  let testing = $state(false);
  let sendingTest = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);

  // Form
  let form = $state({
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    fromEmail: '',
    fromName: 'Buggy Shuttle',
  });

  let testEmail = $state('');
  let hasExistingConfig = $state(false);

  onMount(() => {
    fetchSettings();
  });

  async function fetchSettings() {
    loading = true;
    try {
      const res = await fetch('/api/settings/smtp');
      const data = await res.json();
      if (data.success && data.data) {
        form = {
          host: data.data.host,
          port: data.data.port,
          secure: data.data.secure,
          username: data.data.username,
          password: '', // Şifreyi gösterme
          fromEmail: data.data.fromEmail,
          fromName: data.data.fromName,
        };
        hasExistingConfig = true;
      }
    } catch (err) {
      error = 'Ayarlar yüklenemedi';
    } finally {
      loading = false;
    }
  }

  async function saveSettings() {
    saving = true;
    error = null;
    success = null;

    try {
      const res = await fetch('/api/settings/smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        success = 'SMTP ayarları kaydedildi';
        hasExistingConfig = true;
      } else {
        error = data.message;
      }
    } catch (err) {
      error = 'Kaydetme hatası';
    } finally {
      saving = false;
    }
  }

  async function testConnection() {
    testing = true;
    error = null;
    success = null;

    try {
      const res = await fetch('/api/settings/smtp?action=test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        success = 'SMTP bağlantısı başarılı!';
      } else {
        error = data.message;
      }
    } catch (err) {
      error = 'Bağlantı testi hatası';
    } finally {
      testing = false;
    }
  }

  async function sendTestEmail() {
    if (!testEmail) {
      error = 'Test email adresi girin';
      return;
    }

    sendingTest = true;
    error = null;
    success = null;

    try {
      const res = await fetch('/api/settings/smtp?action=send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail }),
      });
      const data = await res.json();
      if (data.success) {
        success = `Test emaili ${testEmail} adresine gönderildi`;
      } else {
        error = data.message;
      }
    } catch (err) {
      error = 'Email gönderme hatası';
    } finally {
      sendingTest = false;
    }
  }
</script>

<svelte:head>
  <title>SMTP Ayarları | Buggy Shuttle</title>
</svelte:head>

<div class="min-h-screen bg-slate-900 text-white p-6">
  <div class="max-w-2xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold">📧 SMTP Email Ayarları</h1>
        <p class="text-slate-400 text-sm mt-1">Rapor gönderimi için email yapılandırması</p>
      </div>
      <a href="/settings" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-colors">
        ← Ayarlar
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

    {#if loading}
      <div class="flex items-center justify-center py-20">
        <div class="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
      </div>
    {:else}
      <!-- SMTP Form -->
      <div class="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
        <h2 class="text-lg font-semibold mb-4">Sunucu Ayarları</h2>

        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-slate-400 mb-1">SMTP Host</label>
              <input
                type="text"
                bind:value={form.host}
                placeholder="smtp.gmail.com"
                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label class="block text-sm text-slate-400 mb-1">Port</label>
              <input
                type="number"
                bind:value={form.port}
                placeholder="587"
                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" bind:checked={form.secure} class="w-4 h-4 rounded bg-slate-700 border-slate-600 text-cyan-500 focus:ring-cyan-500" />
              <span class="text-sm text-slate-300">SSL/TLS Kullan (Port 465 için)</span>
            </label>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-slate-400 mb-1">Kullanıcı Adı</label>
              <input
                type="text"
                bind:value={form.username}
                placeholder="email@example.com"
                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label class="block text-sm text-slate-400 mb-1">Şifre / App Password</label>
              <input
                type="password"
                bind:value={form.password}
                placeholder={hasExistingConfig ? '••••••••' : 'Şifre'}
                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-slate-400 mb-1">Gönderen Email</label>
              <input
                type="email"
                bind:value={form.fromEmail}
                placeholder="noreply@example.com"
                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label class="block text-sm text-slate-400 mb-1">Gönderen Adı</label>
              <input
                type="text"
                bind:value={form.fromName}
                placeholder="Buggy Shuttle"
                class="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div class="flex gap-3 pt-4">
            <button
              onclick={saveSettings}
              disabled={saving || !form.host || !form.username}
              class="flex-1 px-4 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {#if saving}
                <div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
              {/if}
              💾 Kaydet
            </button>
            <button
              onclick={testConnection}
              disabled={testing || !form.host || !form.username || !form.password}
              class="px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {#if testing}
                <div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
              {/if}
              🔌 Bağlantı Test
            </button>
          </div>
        </div>
      </div>

      <!-- Test Email -->
      {#if hasExistingConfig}
        <div class="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
          <h2 class="text-lg font-semibold mb-4">Test Email Gönder</h2>

          <div class="flex gap-3">
            <input
              type="email"
              bind:value={testEmail}
              placeholder="test@example.com"
              class="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              onclick={sendTestEmail}
              disabled={sendingTest || !testEmail}
              class="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {#if sendingTest}
                <div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
              {/if}
              📤 Test Gönder
            </button>
          </div>
        </div>
      {/if}

      <!-- Gmail Rehberi -->
      <div class="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
          📖 Gmail Kurulum Rehberi
        </h2>

        <div class="space-y-4 text-sm text-slate-300">
          <div class="flex gap-3">
            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">1</div>
            <div>
              <p class="font-medium text-white">2 Adımlı Doğrulamayı Etkinleştirin</p>
              <p class="text-slate-400">Google Hesabı → Güvenlik → 2 Adımlı Doğrulama</p>
            </div>
          </div>

          <div class="flex gap-3">
            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">2</div>
            <div>
              <p class="font-medium text-white">Uygulama Şifresi Oluşturun</p>
              <p class="text-slate-400">Google Hesabı → Güvenlik → Uygulama Şifreleri → "Mail" seçin</p>
            </div>
          </div>

          <div class="flex gap-3">
            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">3</div>
            <div>
              <p class="font-medium text-white">Ayarları Girin</p>
              <div class="mt-2 p-3 bg-slate-700/50 rounded-lg font-mono text-xs">
                <p>Host: <span class="text-cyan-400">smtp.gmail.com</span></p>
                <p>Port: <span class="text-cyan-400">587</span></p>
                <p>SSL/TLS: <span class="text-cyan-400">Kapalı</span></p>
                <p>Kullanıcı: <span class="text-cyan-400">email@gmail.com</span></p>
                <p>Şifre: <span class="text-cyan-400">[Uygulama Şifresi]</span></p>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
          <p class="text-yellow-400 text-sm">
            ⚠️ Normal Gmail şifrenizi değil, oluşturduğunuz Uygulama Şifresini kullanın!
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>
