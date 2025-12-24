<script lang="ts">
  import { page } from '$app/state';
  import { appStore } from '$lib/stores/app.svelte';

  // Navigation links with Iconify icons
  const navLinks = [
    { href: '/', label: 'Dashboard', icon: 'icon-[mdi--view-dashboard]' },
    { href: '/vehicles', label: 'Araçlar', icon: 'icon-[mdi--bus]' },
    { href: '/stops', label: 'Duraklar', icon: 'icon-[mdi--map-marker]' },
    { href: '/calls', label: 'Çağrılar', icon: 'icon-[mdi--phone-ring]' },
    { href: '/reports', label: 'Raporlar', icon: 'icon-[mdi--chart-line]' },
    { href: '/settings', label: 'Ayarlar', icon: 'icon-[mdi--cog]' },
  ];

  // Mobil menü
  let mobileMenuOpen = $state(false);
  let notificationPanelOpen = $state(false);

  function isActive(href: string): boolean {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname.startsWith(href);
  }
</script>

<nav class="bg-dark-900 border-b border-dark-700 sticky top-0 z-50">
  <div class="max-w-full mx-auto px-4">
    <div class="flex items-center justify-between h-16">
      
      <!-- Logo & Brand -->
      <div class="flex items-center gap-4">
        <a href="/" class="flex items-center gap-3 group">
          <div class="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
            <span class="w-6 h-6 icon-[mdi--bus] text-white"></span>
          </div>
          <div class="hidden sm:block">
            <h1 class="text-lg font-bold text-white">Lujo Shuttle</h1>
            <p class="text-xs text-dark-400 -mt-1">GPS Takip Sistemi</p>
          </div>
        </a>

        <!-- Mode Toggle - Sadece demo aktifse göster -->
        {#if appStore.demoEnabled}
        <div class="hidden md:flex items-center gap-1 ml-6 px-1 py-1 bg-dark-800 rounded-lg border border-dark-700">
          <button
            onclick={() => appStore.setMode('demo')}
            class="px-3 py-1.5 rounded text-xs font-medium transition-all {appStore.isDemo ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'text-dark-400 hover:text-white'}"
          >
            🎮 DEMO
          </button>
          <button
            onclick={() => appStore.setMode('live')}
            class="px-3 py-1.5 rounded text-xs font-medium transition-all {appStore.isLive ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-dark-400 hover:text-white'}"
          >
            🔴 CANLI
          </button>
        </div>
        {/if}
      </div>

      <!-- Desktop Navigation -->
      <div class="hidden lg:flex items-center gap-1">
        {#each navLinks as link}
          <a
            href={link.href}
            class="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
              {isActive(link.href) 
                ? 'bg-primary-500/20 text-primary-400' 
                : 'text-dark-300 hover:text-white hover:bg-dark-800'}"
          >
            <span class="w-5 h-5 {link.icon}"></span>
            <span>{link.label}</span>
          </a>
        {/each}
      </div>

      <!-- Right Side -->
      <div class="flex items-center gap-3">
        <!-- Status Indicator - Sadece demo aktifse göster -->
        {#if appStore.demoEnabled}
        <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-dark-800 rounded-lg border {appStore.isDemo ? 'border-yellow-500/30' : 'border-green-500/30'}">
          <div class="w-2 h-2 rounded-full {appStore.isDemo ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse"></div>
          <span class="text-xs font-medium {appStore.isDemo ? 'text-yellow-400' : 'text-green-400'}">
            {appStore.isDemo ? 'DEMO' : 'CANLI'}
          </span>
        </div>
        {/if}

        <!-- Sound Toggle -->
        <button 
          onclick={() => appStore.toggleSound()}
          class="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          title={appStore.soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
        >
          <span class="w-5 h-5 {appStore.soundEnabled ? 'icon-[mdi--volume-high]' : 'icon-[mdi--volume-off]'}"></span>
        </button>

        <!-- Notifications -->
        <div class="relative z-[9999]">
          <button 
            onclick={() => notificationPanelOpen = !notificationPanelOpen}
            class="relative p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
          >
            <span class="w-5 h-5 icon-[mdi--bell-outline]"></span>
            {#if appStore.unreadCount > 0}
              <span class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {appStore.unreadCount}
              </span>
            {/if}
          </button>

          <!-- Notification Panel -->
          {#if notificationPanelOpen}
            <div class="absolute right-0 top-12 w-80 bg-dark-800 border border-dark-700 rounded-xl shadow-2xl z-[9999] overflow-hidden">
              <div class="p-3 border-b border-dark-700 flex items-center justify-between">
                <h3 class="font-semibold text-white">🔔 Bildirimler</h3>
                {#if appStore.notifications.length > 0}
                  <button 
                    onclick={() => appStore.clearNotifications()}
                    class="text-xs text-dark-400 hover:text-white"
                  >
                    Temizle
                  </button>
                {/if}
              </div>
              <div class="max-h-80 overflow-y-auto">
                {#if appStore.notifications.length === 0}
                  <div class="p-6 text-center text-dark-400">
                    <div class="text-3xl mb-2">✨</div>
                    <p class="text-sm">Bildirim yok</p>
                  </div>
                {:else}
                  {#each appStore.notifications as notif}
                    <div class="p-3 border-b border-dark-700/50 hover:bg-dark-700/30 transition-colors">
                      <div class="flex items-start gap-2">
                        <span class="text-lg">
                          {notif.type === 'success' ? '✅' : notif.type === 'error' ? '❌' : notif.type === 'warning' ? '⚠️' : 'ℹ️'}
                        </span>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium text-white">{notif.title}</p>
                          <p class="text-xs text-dark-400 truncate">{notif.message}</p>
                          <p class="text-[10px] text-dark-500 mt-1">
                            {new Date(notif.timestamp).toLocaleTimeString('tr-TR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <!-- User Menu -->
        <button class="flex items-center gap-2 p-1.5 hover:bg-dark-800 rounded-lg transition-colors">
          <div class="w-8 h-8 bg-gradient-to-br from-primary-500 to-pink-500 rounded-lg flex items-center justify-center">
            <span class="text-sm font-bold text-white">OP</span>
          </div>
          <span class="hidden sm:block text-sm text-dark-300">Operatör</span>
        </button>

        <!-- Mobile Menu Button -->
        <button
          onclick={() => mobileMenuOpen = !mobileMenuOpen}
          class="lg:hidden p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg"
        >
          {#if mobileMenuOpen}
            <span class="w-6 h-6 icon-[mdi--close]"></span>
          {:else}
            <span class="w-6 h-6 icon-[mdi--menu]"></span>
          {/if}
        </button>
      </div>
    </div>
  </div>

  <!-- Mobile Menu -->
  {#if mobileMenuOpen}
    <div class="lg:hidden border-t border-dark-700 bg-dark-900">
      <div class="px-4 py-3 space-y-1">
        <!-- Mode Toggle Mobile - Sadece demo aktifse göster -->
        {#if appStore.demoEnabled}
        <div class="flex items-center gap-2 p-2 mb-3">
          <button
            onclick={() => appStore.setMode('demo')}
            class="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all {appStore.isDemo ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-dark-800 text-dark-400'}"
          >
            🎮 DEMO
          </button>
          <button
            onclick={() => appStore.setMode('live')}
            class="flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all {appStore.isLive ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-dark-800 text-dark-400'}"
          >
            🔴 CANLI
          </button>
        </div>
        {/if}

        {#each navLinks as link}
          <a
            href={link.href}
            onclick={() => mobileMenuOpen = false}
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
              {isActive(link.href) 
                ? 'bg-primary-500/20 text-primary-400' 
                : 'text-dark-300 hover:text-white hover:bg-dark-800'}"
          >
            <span class="w-5 h-5 {link.icon}"></span>
            <span>{link.label}</span>
          </a>
        {/each}
      </div>
    </div>
  {/if}
</nav>
