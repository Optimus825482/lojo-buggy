<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import maplibregl from 'maplibre-gl';
  import { appStore } from '$lib/stores/app.svelte';
  import DemoSimulator from '$lib/components/DemoSimulator.svelte';

  // Map styles
  const MAP_STYLES: Record<string, maplibregl.StyleSpecification> = {
    satellite: {
      version: 8,
      sources: {
        'satellite': {
          type: 'raster',
          tiles: [
            'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: '© Esri',
          maxzoom: 18
        }
      },
      layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }]
    },
    hybrid: {
      version: 8,
      sources: {
        'google': {
          type: 'raster',
          tiles: [
            'https://mt0.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
            'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
            'https://mt2.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
            'https://mt3.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
          ],
          tileSize: 256,
          attribution: '© Google',
          maxzoom: 18
        }
      },
      layers: [{ id: 'google', type: 'raster', source: 'google' }]
    }
  };

  // Buggy routes GeoJSON
  const routesGeoJSON = {
    type: 'FeatureCollection' as const,
    features: [
      { type: 'Feature' as const, properties: { name: 'Rota 1' }, geometry: { type: 'LineString' as const, coordinates: [[27.560724,37.138598],[27.5606261,37.1385691],[27.5605443,37.1384889],[27.5603982,37.1384964],[27.5602882,37.138599],[27.5602252,37.1386696],[27.5601836,37.1387006],[27.5601205,37.1387049],[27.5601192,37.1386643],[27.5601728,37.138598],[27.5602533,37.1385039],[27.5604089,37.1383863],[27.5605376,37.1382767],[27.5607227,37.138142],[27.5609292,37.1381548],[27.5610312,37.1382125],[27.5611492,37.1383644],[27.5613557,37.1387663],[27.5613047,37.1387941],[27.5612055,37.1387663],[27.5610982,37.1385504],[27.5610124,37.1385653],[27.5609614,37.1386851],[27.5607495,37.1385996]] }},
      { type: 'Feature' as const, properties: { name: 'Rota 2' }, geometry: { type: 'LineString' as const, coordinates: [[27.5600924,37.1386728],[27.5599673,37.1386413],[27.5598131,37.1386274],[27.5596602,37.1385707],[27.559569,37.1385408],[27.5594242,37.1384766],[27.5592766,37.1384446],[27.5590889,37.1385365],[27.5589682,37.1385729],[27.5588394,37.1385878],[27.5587643,37.1386584],[27.5586919,37.1387161],[27.5586462,37.1386968],[27.5586436,37.1386604],[27.5587187,37.1385749],[27.5587669,37.1384979]] }},
      { type: 'Feature' as const, properties: { name: 'Rota 3' }, geometry: { type: 'LineString' as const, coordinates: [[27.5587609,37.1384824],[27.5586429,37.1384568],[27.5585034,37.138337],[27.5582406,37.1383071],[27.5580206,37.1384226],[27.5577041,37.1385851],[27.55757,37.138692],[27.5573769,37.1387176],[27.5571355,37.138692],[27.5570336,37.1386022],[27.5571355,37.1383627],[27.5572321,37.1380719],[27.5572804,37.1379308],[27.5574466,37.1379821],[27.5577202,37.1380377],[27.5579187,37.138042],[27.5581869,37.1379778],[27.5587824,37.1379949],[27.5586322,37.1384611]] }},
      { type: 'Feature' as const, properties: { name: 'Rota 4' }, geometry: { type: 'LineString' as const, coordinates: [[27.5587464,37.1381147],[27.5588564,37.1382023],[27.5589476,37.1382152],[27.5594036,37.1381318],[27.5598676,37.1382836],[27.5600902,37.1381895],[27.5605864,37.1377726],[27.5607447,37.1375758],[27.5605945,37.1375074],[27.5602565,37.137516],[27.5600044,37.1375331],[27.5598757,37.1376357],[27.5597576,37.1376999],[27.5595431,37.1377512],[27.5590227,37.1378752],[27.5588081,37.1379607],[27.5587824,37.1379949]] }},
      { type: 'Feature' as const, properties: { name: 'Rota 5' }, geometry: { type: 'LineString' as const, coordinates: [[27.5599443,37.1375972],[27.5598477,37.1374262],[27.5597994,37.1371952],[27.5601588,37.1369643],[27.5604968,37.1366564],[27.5604539,37.136233],[27.5601374,37.1361603],[27.5600086,37.1362288],[27.5596653,37.1368403],[27.5594239,37.1369215],[27.5584154,37.1371739],[27.5579809,37.1372551]] }},
      { type: 'Feature' as const, properties: { name: 'Rota 6' }, geometry: { type: 'LineString' as const, coordinates: [[27.5604539,37.136233],[27.5605447,37.1360256],[27.5607969,37.1357647],[27.5610329,37.1357904],[27.5612689,37.135923],[27.561564,37.1361026],[27.5617035,37.1365259],[27.5617893,37.1374924],[27.5618429,37.1381339],[27.5619019,37.138754],[27.5618697,37.1388566],[27.5618161,37.1388994],[27.5615801,37.1388737],[27.5613557,37.1387663]] }}
    ]
  };

  // State
  let vehicles = $state<any[]>([]);
  let stops = $state<any[]>([]);
  let calls = $state<any[]>([]);
  let tasks = $state<any[]>([]);
  let stats = $state<any>({ todayCalls: 0, completedCalls: 0, pendingCalls: 0, activeTasks: 0, vehicles: { total: 0, available: 0, busy: 0 } });
  let loading = $state(true);
  let currentStyle = $state<'satellite' | 'hybrid'>('satellite');
  let map: maplibregl.Map | null = null;
  let mapContainer: HTMLDivElement;
  let stopMarkers: Map<number, maplibregl.Marker> = new Map();
  let vehicleMarkers: Map<number, maplibregl.Marker> = new Map();
  
  // UI toggles
  let showStats = $state(true);
  let showVehicleBar = $state(true);
  let showSidebar = $state(true);
  
  // Map layer options
  let showRoutes = $state(true);
  let showStops = $state(true);
  let routeStyle = $state<'solid' | 'dashed'>('solid');
  let routeColor = $state('#FF0000'); // Default kırmızı
  let routeWidth = $state(4);
  let showMapOptions = $state(false);
  
  // Task assignment state
  let assignmentMode = $state<'none' | 'selectVehicle' | 'selectCall'>('none');
  let selectedCallForAssignment = $state<any>(null);
  let selectedVehicleForAssignment = $state<any>(null);
  let showAssignmentModal = $state(false);
  
  // Demo simülasyon state
  let activeSimulations = $state<Map<number, { targetStop: any, interval: ReturnType<typeof setInterval> }>>(new Map());
  
  // Hedef seçimi state
  let showDropoffModal = $state(false);
  let selectedTaskForDropoff = $state<any>(null);
  
  // Sağ tık menüsü state - Araç
  let showVehicleContextMenu = $state(false);
  let contextMenuVehicle = $state<any>(null);
  let contextMenuPosition = $state({ x: 0, y: 0 });
  let showStatusModal = $state(false);
  let showSendToStopModal = $state(false);
  let selectedStopForSend = $state<any>(null);
  
  // Sağ tık menüsü state - Çağrı
  let showCallContextMenu = $state(false);
  let contextMenuCall = $state<any>(null);
  
  // Seçili araç rota çizgisi state
  let selectedVehicleRoute = $state<number | null>(null);
  let selectedVehicleInfo = $state<{ vehicle: any, task: any, targetStop: string } | null>(null);
  
  // Traccar canlı takip state
  let traccarEnabled = $state(false);
  let traccarStatus = $state<{ connected: boolean; onlineCount?: number } | null>(null);
  let traccarSyncing = $state(false);
  
  const routeColors = [
    { name: 'Kırmızı', value: '#FF0000' },
    { name: 'Yeşil', value: '#00FF00' },
    { name: 'Neon Mavi', value: '#00FFFF' },
    { name: 'Neon Pembe', value: '#FF00FF' },
    { name: 'Neon Turuncu', value: '#FF6600' },
    { name: 'Beyaz', value: '#FFFFFF' },
    { name: 'Sarı', value: '#FFFF00' },
    { name: 'Mavi', value: '#0066FF' },
  ];

  // Fetch data
  async function fetchData() {
    try {
      const [vehiclesRes, stopsRes, callsRes, statsRes, tasksRes] = await Promise.all([
        fetch('/api/vehicles'),
        fetch('/api/stops'),
        fetch('/api/calls?active=true'),
        fetch('/api/stats?type=live'),
        fetch('/api/tasks?active=true') // Tüm aktif görevleri çek (assigned, pickup, dropoff)
      ]);
      const vehiclesData = await vehiclesRes.json();
      const stopsData = await stopsRes.json();
      const callsData = await callsRes.json();
      const statsData = await statsRes.json();
      const tasksData = await tasksRes.json();
      if (vehiclesData.success) vehicles = vehiclesData.data;
      if (stopsData.success) stops = stopsData.data;
      if (callsData.success) {
        calls = callsData.data;
        console.log('Calls loaded:', calls.length, 'pending:', calls.filter((c: any) => c.status === 'pending').length);
      }
      if (statsData.success) stats = statsData.data;
      if (tasksData.success) {
        // API pagination ile döndürüyor, data doğrudan tasks array
        tasks = Array.isArray(tasksData.data) ? tasksData.data : (tasksData.data?.tasks || []);
        console.log('Tasks loaded:', tasks.length);
        console.log('All tasks:', tasks.map((t: any) => ({ id: t.id, status: t.status, dropoffStopId: t.dropoffStopId, vehicleId: t.vehicleId })));
        console.log('Awaiting dropoff:', tasks.filter((t: any) => t.status === 'pickup' && !t.dropoffStopId).length);
      }
      updateMarkers();
      updateVehicleRouteLine(); // Araç rota çizgisini güncelle (araç hareket ettikçe)
      
      // Traccar canlı takip aktifse, konumları senkronize et
      if (traccarEnabled && !traccarSyncing) {
        syncTraccarPositions();
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      loading = false;
    }
  }

  // Traccar konum senkronizasyonu
  async function syncTraccarPositions() {
    if (traccarSyncing) return;
    traccarSyncing = true;
    
    try {
      const res = await fetch('/api/traccar/sync', { method: 'POST' });
      const data = await res.json();
      
      if (data.success && data.data.updatedCount > 0) {
        // Araç verilerini yeniden çek
        const vehiclesRes = await fetch('/api/vehicles');
        const vehiclesData = await vehiclesRes.json();
        if (vehiclesData.success) {
          vehicles = vehiclesData.data;
          updateMarkers();
          updateVehicleRouteLine();
        }
      }
    } catch (err) {
      console.error('Traccar sync error:', err);
    } finally {
      traccarSyncing = false;
    }
  }

  // Traccar durumunu kontrol et
  async function checkTraccarStatus() {
    try {
      const res = await fetch('/api/traccar?action=status');
      const data = await res.json();
      if (data.success) {
        traccarStatus = data.data;
      }
    } catch (err) {
      traccarStatus = { connected: false };
    }
  }

  // Traccar toggle
  function toggleTraccar() {
    traccarEnabled = !traccarEnabled;
    if (traccarEnabled) {
      checkTraccarStatus();
      syncTraccarPositions();
    }
  }

  function hasPendingCall(stopId: number): boolean {
    return calls.some(c => c.stopId === stopId && c.status === 'pending');
  }

  function getVehicleColor(status: string, taskStatus?: string): string {
    // Pickup durumunda turuncu renk (misafir alındı, hedef bekliyor)
    if (taskStatus === 'pickup') return '#f97316'; // orange-500
    const colors: Record<string, string> = { available: '#22c55e', busy: '#eab308', offline: '#6b7280', maintenance: '#ef4444' };
    return colors[status] || '#6b7280';
  }

  function initMap() {
    if (!browser || !mapContainer) return;
    map = new maplibregl.Map({
      container: mapContainer,
      style: MAP_STYLES[currentStyle],
      center: [27.559, 37.1378],
      zoom: 16,
      minZoom: 14,
      maxZoom: 18,
      attributionControl: false
    });
    map.addControl(new maplibregl.NavigationControl(), 'bottom-left');
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('load', () => {
      addRoutesLayer();
      fetchData();
    });
    
    // Haritaya tıklayınca seçili aracı ve rota çizgisini kapat
    map.on('click', (e) => {
      // Marker'a tıklanmadıysa kapat
      const target = e.originalEvent.target as HTMLElement;
      if (!target.closest('.maplibregl-marker')) {
        selectedVehicleInfo = null;
        clearVehicleRouteLine();
      }
    });
  }

  function addRoutesLayer() {
    if (!map) return;
    if (map.getLayer('routes-line')) map.removeLayer('routes-line');
    if (map.getSource('routes')) map.removeSource('routes');
    
    if (!showRoutes) return;
    
    map.addSource('routes', { type: 'geojson', data: routesGeoJSON });
    map.addLayer({
      id: 'routes-line',
      type: 'line',
      source: 'routes',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 
        'line-color': routeColor, 
        'line-width': routeWidth, 
        'line-opacity': 0.9,
        'line-dasharray': routeStyle === 'dashed' ? [2, 2] : [1, 0]
      }
    });
  }
  
  function updateRoutesStyle() {
    if (!map) return;
    if (map.getLayer('routes-line')) {
      map.setPaintProperty('routes-line', 'line-color', routeColor);
      map.setPaintProperty('routes-line', 'line-width', routeWidth);
      map.setPaintProperty('routes-line', 'line-dasharray', routeStyle === 'dashed' ? [2, 2] : [1, 0]);
    }
  }
  
  function toggleRoutes() {
    showRoutes = !showRoutes;
    if (showRoutes) {
      addRoutesLayer();
    } else {
      if (map?.getLayer('routes-line')) map.removeLayer('routes-line');
      if (map?.getSource('routes')) map.removeSource('routes');
    }
  }
  
  function toggleStops() {
    showStops = !showStops;
    stopMarkers.forEach(marker => {
      if (showStops) {
        marker.getElement().style.display = 'flex';
      } else {
        marker.getElement().style.display = 'none';
      }
    });
  }

  // Araç hedef rota çizgisini göster/gizle - DÜZ ÇİZGİ (rota takip etmek şart değil)
  function showVehicleRouteLine(vehicleId: number) {
    if (!map) return;
    
    // Önceki çizgiyi temizle
    clearVehicleRouteLine();
    
    const vehicle = vehicles.find(v => v.id === vehicleId);
    const task = getVehicleActiveTask(vehicleId);
    
    if (!vehicle || !task) return;
    
    // Hedef durağı belirle
    let targetStop = null;
    if (task.status === 'assigned' && task.pickupStopId) {
      // Pickup noktasına gidiyor
      targetStop = stops.find(s => s.id === task.pickupStopId);
    } else if ((task.status === 'pickup' || task.status === 'dropoff') && task.dropoffStopId) {
      // Dropoff noktasına gidiyor
      targetStop = stops.find(s => s.id === task.dropoffStopId);
    }
    
    if (!targetStop) return;
    
    // DÜZ ÇİZGİ - araçtan hedefe direkt
    const lineCoordinates = [
      [vehicle.lng, vehicle.lat],
      [targetStop.lng, targetStop.lat]
    ];
    
    // GeoJSON oluştur
    const routeGeoJSON = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: lineCoordinates
      }
    };
    
    // Haritaya ekle
    map.addSource('vehicle-route', { type: 'geojson', data: routeGeoJSON as any });
    map.addLayer({
      id: 'vehicle-route-line',
      type: 'line',
      source: 'vehicle-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 
        'line-color': '#00FFFF', // Cyan renk
        'line-width': 4,
        'line-opacity': 0.9,
        'line-dasharray': [3, 2]
      }
    });
    
    // Hedef noktasını işaretle
    map.addSource('vehicle-target', { 
      type: 'geojson', 
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [targetStop.lng, targetStop.lat]
        }
      } as any
    });
    map.addLayer({
      id: 'vehicle-target-point',
      type: 'circle',
      source: 'vehicle-target',
      paint: {
        'circle-radius': 14,
        'circle-color': '#00FFFF',
        'circle-opacity': 0.4,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#00FFFF'
      }
    });
    
    selectedVehicleRoute = vehicleId;
  }
  
  // Araç rota çizgisini temizle
  function clearVehicleRouteLine() {
    if (!map) return;
    
    if (map.getLayer('vehicle-route-line')) map.removeLayer('vehicle-route-line');
    if (map.getSource('vehicle-route')) map.removeSource('vehicle-route');
    if (map.getLayer('vehicle-target-point')) map.removeLayer('vehicle-target-point');
    if (map.getSource('vehicle-target')) map.removeSource('vehicle-target');
    
    selectedVehicleRoute = null;
  }

  // Araç rota çizgisini güncelle - araç hareket ettikçe çizgi de güncellenir
  function updateVehicleRouteLine() {
    if (!map || !selectedVehicleRoute) return;
    
    const vehicle = vehicles.find(v => v.id === selectedVehicleRoute);
    const task = getVehicleActiveTask(selectedVehicleRoute);
    
    if (!vehicle || !task) {
      clearVehicleRouteLine();
      return;
    }
    
    // Hedef durağı belirle
    let targetStop = null;
    if (task.status === 'assigned' && task.pickupStopId) {
      targetStop = stops.find(s => s.id === task.pickupStopId);
    } else if ((task.status === 'pickup' || task.status === 'dropoff') && task.dropoffStopId) {
      targetStop = stops.find(s => s.id === task.dropoffStopId);
    }
    
    if (!targetStop) {
      clearVehicleRouteLine();
      return;
    }
    
    // Yeni koordinatlar
    const newCoordinates = [
      [vehicle.lng, vehicle.lat],
      [targetStop.lng, targetStop.lat]
    ];
    
    // Source'u güncelle (layer'ı silmeden)
    const source = map.getSource('vehicle-route') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: newCoordinates
        }
      });
    }
  }

  function switchStyle(style: 'satellite' | 'hybrid') {
    if (!map || style === currentStyle) return;
    currentStyle = style;
    map.setStyle(MAP_STYLES[style]);
    map.once('style.load', () => {
      if (showRoutes) addRoutesLayer();
      updateMarkers();
    });
  }

  function updateMarkers() {
    if (!map) return;

    // Stop markers
    stops.forEach(stop => {
      const pending = hasPendingCall(stop.id);
      const pendingCall = calls.find(c => c.stopId === stop.id && c.status === 'pending');
      const availableCount = getAvailableVehicles().length;
      
      const el = document.createElement('div');
      el.className = `w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-lg cursor-pointer transition-transform hover:scale-110 ${pending ? 'bg-red-500 animate-pulse' : 'bg-slate-700'}`;
      el.style.zIndex = pending ? '10' : '5';
      el.innerHTML = stop.icon;
      el.style.display = showStops ? 'flex' : 'none';
      el.onclick = (e) => {
        e.stopPropagation();
        map?.flyTo({ center: [stop.lng, stop.lat], zoom: 18, duration: 600 });
        
        const popupContent = `
          <div class="p-3 min-w-[180px]">
            <h3 class="font-bold text-slate-900 text-base">${stop.icon} ${stop.name}</h3>
            ${pending ? `
              <p class="text-red-500 text-sm mt-2 font-medium">⚠️ Bekleyen çağrı var!</p>
              ${availableCount > 0 ? `
                <button 
                  id="stop-call-btn-${stop.id}" 
                  class="mt-3 w-full px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  🚐 Çağrıya Araç Gönder
                </button>
              ` : '<p class="text-xs text-slate-500 mt-2">Müsait araç yok</p>'}
            ` : `
              ${availableCount > 0 ? `
                <button 
                  id="stop-send-btn-${stop.id}" 
                  class="mt-3 w-full px-3 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  🚐 Araç Gönder
                </button>
              ` : '<p class="text-xs text-slate-500 mt-2">Müsait araç yok</p>'}
            `}
          </div>
        `;
        
        const popup = new maplibregl.Popup({ offset: 15 })
          .setLngLat([stop.lng, stop.lat])
          .setHTML(popupContent)
          .addTo(map!);
        
        // Popup açıldıktan sonra butonlara event listener ekle
        setTimeout(() => {
          // Çağrıya araç gönder butonu (bekleyen çağrı varsa)
          if (pending && availableCount > 0 && pendingCall) {
            const callBtn = document.getElementById(`stop-call-btn-${stop.id}`);
            if (callBtn) {
              callBtn.onclick = () => {
                popup.remove();
                selectedCallForAssignment = pendingCall;
                assignmentMode = 'selectVehicle';
                showAssignmentModal = true;
              };
            }
          }
          
          // Durağa araç gönder butonu (çağrı olmasa bile)
          if (!pending && availableCount > 0) {
            const sendBtn = document.getElementById(`stop-send-btn-${stop.id}`);
            if (sendBtn) {
              sendBtn.onclick = () => {
                popup.remove();
                selectedStopForSend = stop;
                showSendToStopModal = true;
              };
            }
          }
        }, 100);
      };
      if (stopMarkers.has(stop.id)) stopMarkers.get(stop.id)!.remove();
      const marker = new maplibregl.Marker({ element: el }).setLngLat([stop.lng, stop.lat]).addTo(map!);
      stopMarkers.set(stop.id, marker);
    });

    // Vehicle markers - daha yüksek z-index
    vehicles.forEach(vehicle => {
      const el = document.createElement('div');
      el.className = 'w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-lg border-2 border-white cursor-pointer transition-transform hover:scale-110';
      el.style.backgroundColor = getVehicleColor(vehicle.status);
      el.style.zIndex = '20';
      el.innerHTML = '🚐';
      
      // Görevde olan araç için border ekle
      const vehicleTask = tasks.find(t => t.vehicleId === vehicle.id && (t.status === 'assigned' || t.status === 'pickup' || t.status === 'dropoff'));
      if (vehicleTask) {
        el.style.borderColor = '#00FFFF';
        el.style.boxShadow = '0 0 10px #00FFFF';
      }
      
      el.onclick = (e) => {
        e.stopPropagation();
        map?.flyTo({ center: [vehicle.lng, vehicle.lat], zoom: 17, duration: 600 });
        
        const activeTask = tasks.find(t => t.vehicleId === vehicle.id && (t.status === 'assigned' || t.status === 'pickup' || t.status === 'dropoff'));
        
        // Hedef durağı bul
        let targetStopName = '';
        if (activeTask) {
          if (activeTask.status === 'assigned' && activeTask.pickupStopId) {
            const pickupStop = stops.find(s => s.id === activeTask.pickupStopId);
            targetStopName = pickupStop ? `📍 ${pickupStop.name}` : '';
          } else if ((activeTask.status === 'pickup' || activeTask.status === 'dropoff') && activeTask.dropoffStopId) {
            const dropoffStop = stops.find(s => s.id === activeTask.dropoffStopId);
            targetStopName = dropoffStop ? `🎯 ${dropoffStop.name}` : '';
          } else if (activeTask.status === 'pickup' && !activeTask.dropoffStopId) {
            targetStopName = '⏳ Hedef Bekliyor';
          }
        }
        
        // Seçili araç bilgisini güncelle (sağ üst köşede card gösterecek)
        selectedVehicleInfo = { vehicle, task: activeTask, targetStop: targetStopName };
        
        // Rota çizgisini göster (aktif task varsa)
        if (activeTask) {
          showVehicleRouteLine(vehicle.id);
        } else {
          clearVehicleRouteLine();
        }
      };
      if (vehicleMarkers.has(vehicle.id)) {
        const existingMarker = vehicleMarkers.get(vehicle.id)!;
        existingMarker.setLngLat([vehicle.lng, vehicle.lat]);
        existingMarker.getElement().style.backgroundColor = getVehicleColor(vehicle.status, vehicleTask?.status);
        // Görevde olan araç için border güncelle
        if (vehicleTask) {
          // Pickup durumunda turuncu border
          if (vehicleTask.status === 'pickup' && !vehicleTask.dropoffStopId) {
            existingMarker.getElement().style.borderColor = '#f97316';
            existingMarker.getElement().style.boxShadow = '0 0 12px #f97316';
          } else {
            existingMarker.getElement().style.borderColor = '#00FFFF';
            existingMarker.getElement().style.boxShadow = '0 0 10px #00FFFF';
          }
        } else {
          existingMarker.getElement().style.borderColor = 'white';
          existingMarker.getElement().style.boxShadow = '';
        }
      } else {
        const marker = new maplibregl.Marker({ element: el }).setLngLat([vehicle.lng, vehicle.lat]).addTo(map!);
        vehicleMarkers.set(vehicle.id, marker);
      }
    });
  }

  function flyToVehicle(vehicle: any) {
    if (map) {
      map.flyTo({ center: [vehicle.lng, vehicle.lat], zoom: 17, duration: 800 });
    }
  }

  // Sidebar'dan çağrıya tıklama - araç seçimi için modal aç
  function handleCallClick(call: any) {
    selectedCallForAssignment = call;
    assignmentMode = 'selectVehicle';
    showAssignmentModal = true;
    
    // Çağrı durağına zoom yap
    if (map && call.stop) {
      map.flyTo({ center: [call.stop.lng, call.stop.lat], zoom: 17, duration: 800 });
    }
  }

  // Vehicle bar'dan araca tıklama - çağrı seçimi için modal aç
  function handleVehicleClick(vehicle: any, e: MouseEvent) {
    e.stopPropagation();
    
    const activeTask = getVehicleActiveTask(vehicle.id);
    
    if (activeTask) {
      // Görevde olan araç - rota çizgisini göster/gizle
      if (selectedVehicleRoute === vehicle.id) {
        clearVehicleRouteLine();
      } else {
        showVehicleRouteLine(vehicle.id);
      }
    } else if (vehicle.status === 'available') {
      // Müsait araç - bekleyen çağrıları göster
      selectedVehicleForAssignment = vehicle;
      assignmentMode = 'selectCall';
      showAssignmentModal = true;
    }
    
    // Her durumda araca zoom yap
    flyToVehicle(vehicle);
  }

  // Araç gönder
  async function assignTask() {
    if (!selectedCallForAssignment || !selectedVehicleForAssignment) return;
    
    const vehicleId = selectedVehicleForAssignment.id;
    const vehicleName = selectedVehicleForAssignment.name;
    const targetStop = selectedCallForAssignment.stop;
    
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: vehicleId,
          callId: selectedCallForAssignment.id,
          pickupStopId: selectedCallForAssignment.stopId
        })
      });
      const data = await res.json();
      
      if (data.success) {
        appStore.addNotification('success', 'Araç Gönderildi', `${vehicleName} → ${targetStop?.name || 'Durak'}`);
        closeAssignmentModal();
        await fetchData();
        
        // Demo modunda araç simülasyonu başlat
        if (appStore.isDemo && targetStop) {
          startVehicleSimulation(vehicleId, targetStop);
        }
      } else {
        appStore.addNotification('error', 'Hata', data.message || 'Araç gönderilemedi');
      }
    } catch (err) {
      appStore.addNotification('error', 'Hata', 'Araç gönderilirken hata oluştu');
    }
  }

  // Tüm rota koordinatlarını tek bir array'e çevir
  function getAllRouteCoordinates(): [number, number][] {
    const allCoords: [number, number][] = [];
    routesGeoJSON.features.forEach(feature => {
      feature.geometry.coordinates.forEach(coord => {
        allCoords.push([coord[0], coord[1]]);
      });
    });
    return allCoords;
  }

  // İki nokta arasındaki mesafeyi hesapla (derece cinsinden)
  function getDistance(p1: [number, number], p2: [number, number]): number {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  // İki nokta arasındaki gerçek mesafeyi metre cinsinden hesapla (Haversine)
  function getDistanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Dünya yarıçapı metre
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Rota üzerinden mesafe hesapla (metre cinsinden)
  function getRouteDistance(fromLng: number, fromLat: number, toLng: number, toLat: number): number {
    const path = findPathToTarget(fromLng, fromLat, toLng, toLat);
    let totalDistance = 0;
    
    // Başlangıç noktasından ilk rota noktasına
    if (path.length > 0) {
      totalDistance += getDistanceInMeters(fromLat, fromLng, path[0][1], path[0][0]);
    }
    
    // Rota boyunca
    for (let i = 0; i < path.length - 1; i++) {
      totalDistance += getDistanceInMeters(path[i][1], path[i][0], path[i+1][1], path[i+1][0]);
    }
    
    return totalDistance;
  }

  // Araçları çağrı noktasına uzaklığa göre sırala
  function getVehiclesSortedByDistance(targetLng: number, targetLat: number): Array<{ vehicle: any, distance: number }> {
    const availableVehicles = getAvailableVehicles();
    
    const vehiclesWithDistance = availableVehicles.map(vehicle => ({
      vehicle,
      distance: getRouteDistance(vehicle.lng, vehicle.lat, targetLng, targetLat)
    }));
    
    // Uzaklığa göre sırala (en yakın önce)
    vehiclesWithDistance.sort((a, b) => a.distance - b.distance);
    
    return vehiclesWithDistance;
  }

  // Mesafeyi formatla
  function formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  }

  // En yakın rota noktasını bul
  function findNearestRoutePoint(lng: number, lat: number): { index: number, point: [number, number] } {
    const coords = getAllRouteCoordinates();
    let minDist = Infinity;
    let nearestIndex = 0;
    
    coords.forEach((coord, i) => {
      const dist = getDistance([lng, lat], coord);
      if (dist < minDist) {
        minDist = dist;
        nearestIndex = i;
      }
    });
    
    return { index: nearestIndex, point: coords[nearestIndex] };
  }

  // Hedefe giden rota yolunu bul (A* benzeri basit path)
  function findPathToTarget(startLng: number, startLat: number, targetLng: number, targetLat: number): [number, number][] {
    const coords = getAllRouteCoordinates();
    const start = findNearestRoutePoint(startLng, startLat);
    const end = findNearestRoutePoint(targetLng, targetLat);
    
    // Basit yaklaşım: start'tan end'e doğru koordinatları al
    const path: [number, number][] = [];
    
    if (start.index <= end.index) {
      for (let i = start.index; i <= end.index; i++) {
        path.push(coords[i]);
      }
    } else {
      // Ters yönde git
      for (let i = start.index; i >= end.index; i--) {
        path.push(coords[i]);
      }
    }
    
    // Hedef noktayı da ekle
    path.push([targetLng, targetLat]);
    
    return path;
  }

  // Demo modunda araç simülasyonu - ROTA TAKİP EDEN
  function startVehicleSimulation(vehicleId: number, targetStop: any) {
    // Önceki simülasyonu durdur
    if (activeSimulations.has(vehicleId)) {
      clearInterval(activeSimulations.get(vehicleId)!.interval);
    }

    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle || !targetStop) return;

    // Rota yolunu hesapla
    const path = findPathToTarget(vehicle.lng, vehicle.lat, targetStop.lng, targetStop.lat);
    let currentPathIndex = 0;

    const interval = setInterval(async () => {
      const currentVehicle = vehicles.find(v => v.id === vehicleId);
      if (!currentVehicle || !targetStop) {
        clearInterval(interval);
        activeSimulations.delete(vehicleId);
        return;
      }

      // Hedefe ulaştık mı?
      const distToTarget = getDistance(
        [currentVehicle.lng, currentVehicle.lat], 
        [targetStop.lng, targetStop.lat]
      );

      if (distToTarget < 0.0002) {
        clearInterval(interval);
        activeSimulations.delete(vehicleId);
        await triggerGeofence(vehicleId, targetStop.id);
        return;
      }

      // Sonraki waypoint'e git
      if (currentPathIndex >= path.length) {
        currentPathIndex = path.length - 1;
      }

      const nextPoint = path[currentPathIndex];
      const distToNext = getDistance(
        [currentVehicle.lng, currentVehicle.lat], 
        nextPoint
      );

      // Waypoint'e ulaştıysa sonrakine geç
      if (distToNext < 0.00015 && currentPathIndex < path.length - 1) {
        currentPathIndex++;
      }

      // Hareket et
      const dx = nextPoint[0] - currentVehicle.lng;
      const dy = nextPoint[1] - currentVehicle.lat;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      const speed = 0.00008; // Biraz yavaşlattım, daha gerçekçi
      const newLng = currentVehicle.lng + (dx / dist) * speed;
      const newLat = currentVehicle.lat + (dy / dist) * speed;
      const heading = Math.atan2(dx, dy) * (180 / Math.PI);

      // Pozisyonu güncelle
      await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: newLat,
          lng: newLng,
          speed: 10 + Math.random() * 5,
          heading: heading
        })
      });

      await fetchData();
    }, 600);

    activeSimulations.set(vehicleId, { targetStop, interval });
  }

  // Geofence tetikle - pickup noktasına ulaşınca hedef seçimi iste
  async function triggerGeofence(vehicleId: number, stopId: number) {
    try {
      // Aracın mevcut konumunu al (stop'a ulaştığı için stop koordinatlarını kullan)
      const stop = stops.find(s => s.id === stopId);
      if (!stop) {
        console.error('Stop bulunamadı:', stopId);
        return;
      }
      
      const res = await fetch('/api/geofence/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId, lat: stop.lat, lng: stop.lng })
      });
      const data = await res.json();
      console.log('Geofence response:', data);
      
      if (data.success && data.data) {
        const vehicle = vehicles.find(v => v.id === vehicleId);
        const responseData = data.data;
        
        // API response'undaki action'a göre bildirim göster
        if (responseData.action === 'pickup') {
          // Pickup noktasına ulaştı, hedef seçimi gerekiyor
          appStore.addNotification('info', 'Misafir Alındı', `${vehicle?.name} ${responseData.stopName} durağında misafiri aldı. Hedef Bekleyen listesinden hedef seçin!`);
        } else if (responseData.action === 'complete') {
          // Dropoff noktasına ulaştı, görev tamamlandı
          appStore.addNotification('success', 'Görev Tamamlandı', `${vehicle?.name} misafiri ${responseData.stopName} durağına bıraktı`);
        } else if (responseData.geofenceTriggered) {
          appStore.addNotification('success', 'Varış', `${vehicle?.name} ${stop?.name} durağına ulaştı`);
        }
      }
      
      await fetchData();
    } catch (err) {
      console.error('Geofence hatası:', err);
    }
  }

  // Hedef durak seç ve aracı gönder
  async function setDropoffAndGo(dropoffStopId: number) {
    if (!selectedTaskForDropoff) return;
    
    const dropoffStop = stops.find(s => s.id === dropoffStopId);
    if (!dropoffStop) return;
    
    try {
      // Task'a dropoff ekle
      const res = await fetch(`/api/tasks/${selectedTaskForDropoff.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setDropoff', dropoffStopId })
      });
      const data = await res.json();
      
      if (data.success) {
        appStore.addNotification('success', 'Hedef Belirlendi', `${selectedTaskForDropoff.vehicle?.name} → ${dropoffStop.name}`);
        
        // Demo modunda simülasyonu başlat
        if (appStore.isDemo) {
          startVehicleSimulation(selectedTaskForDropoff.vehicleId, dropoffStop);
        }
        
        showDropoffModal = false;
        selectedTaskForDropoff = null;
        await fetchData();
      } else {
        appStore.addNotification('error', 'Hata', data.message || 'Hedef belirlenemedi');
      }
    } catch (err) {
      appStore.addNotification('error', 'Hata', 'Hedef belirlenemedi');
    }
  }

  // Hedef bekleyen görevler - pickup durumunda ve dropoff belirlenmemiş
  // Yani: Misafir alındı, merkeze bildirildi, hedef bekleniyor
  function getTasksAwaitingDropoff() {
    return tasks.filter(t => t.status === 'pickup' && !t.dropoffStopId);
  }

  // Araç için aktif görev var mı?
  function getVehicleActiveTask(vehicleId: number) {
    return tasks.find(t => t.vehicleId === vehicleId && (t.status === 'assigned' || t.status === 'pickup' || t.status === 'dropoff'));
  }

  // Sağ tık menüsü aç
  function handleVehicleContextMenu(vehicle: any, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    contextMenuVehicle = vehicle;
    contextMenuPosition = { x: e.clientX, y: e.clientY };
    showVehicleContextMenu = true;
  }

  // Sağ tık menüsü kapat
  function closeContextMenu() {
    showVehicleContextMenu = false;
    contextMenuVehicle = null;
    showCallContextMenu = false;
    contextMenuCall = null;
  }

  // Çağrı sağ tık menüsü aç
  function handleCallContextMenu(call: any, e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    contextMenuCall = call;
    contextMenuPosition = { x: e.clientX, y: e.clientY };
    showCallContextMenu = true;
  }

  // Çağrıyı iptal et
  async function cancelCall(callId: number) {
    try {
      const res = await fetch(`/api/calls/${callId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', reason: 'Manuel iptal' })
      });
      const data = await res.json();
      
      if (data.success) {
        appStore.addNotification('info', 'Çağrı İptal Edildi', 'Çağrı listeden kaldırıldı');
        closeContextMenu();
        await fetchData();
      } else {
        appStore.addNotification('error', 'Hata', data.message || 'Çağrı iptal edilemedi');
      }
    } catch (err) {
      appStore.addNotification('error', 'Hata', 'Çağrı iptal edilirken hata oluştu');
    }
  }

  // Görevi iptal et
  async function cancelTask(taskId: number) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' })
      });
      const data = await res.json();
      
      if (data.success) {
        appStore.addNotification('info', 'Görev İptal Edildi', 'Çağrı bekleyen listeye geri döndü');
        closeContextMenu();
        await fetchData();
      } else {
        appStore.addNotification('error', 'Hata', data.message || 'Görev iptal edilemedi');
      }
    } catch (err) {
      appStore.addNotification('error', 'Hata', 'Görev iptal edilirken hata oluştu');
    }
  }

  // Araç durumunu güncelle
  async function updateVehicleStatus(vehicleId: number, status: string) {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      
      if (data.success) {
        closeContextMenu();
        showStatusModal = false;
        await fetchData();
      } else {
        appStore.addNotification('error', 'Hata', data.message || 'Durum güncellenemedi');
      }
    } catch (err) {
      appStore.addNotification('error', 'Hata', 'Durum güncellenirken hata oluştu');
    }
  }

  // Aracı durağa gönder (çağrı olmadan) - Context Menu'den
  async function sendVehicleToStop(stopId: number) {
    if (!contextMenuVehicle) return;
    
    const targetStop = stops.find(s => s.id === stopId);
    if (!targetStop) return;
    
    try {
      // Önce aracı busy yap
      await fetch(`/api/vehicles/${contextMenuVehicle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'busy' })
      });
      
      appStore.addNotification('success', 'Araç Gönderildi', `${contextMenuVehicle.name} → ${targetStop.name}`);
      showSendToStopModal = false;
      
      // Demo modunda simülasyonu başlat
      if (appStore.isDemo) {
        startVehicleSimulation(contextMenuVehicle.id, targetStop);
      }
      
      closeContextMenu();
      await fetchData();
    } catch (err) {
      appStore.addNotification('error', 'Hata', 'Araç gönderilirken hata oluştu');
    }
  }

  // Seçili aracı seçili durağa gönder (Durak popup'ından)
  async function sendSelectedVehicleToStop(vehicle: any) {
    if (!selectedStopForSend || !vehicle) return;
    
    try {
      // Önce aracı busy yap
      await fetch(`/api/vehicles/${vehicle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'busy' })
      });
      
      appStore.addNotification('success', 'Araç Gönderildi', `${vehicle.name} → ${selectedStopForSend.name}`);
      
      // Demo modunda simülasyonu başlat
      if (appStore.isDemo) {
        startVehicleSimulation(vehicle.id, selectedStopForSend);
      }
      
      showSendToStopModal = false;
      selectedStopForSend = null;
      await fetchData();
    } catch (err) {
      appStore.addNotification('error', 'Hata', 'Araç gönderilirken hata oluştu');
    }
  }

  // Modal kapat
  function closeAssignmentModal() {
    showAssignmentModal = false;
    assignmentMode = 'none';
    selectedCallForAssignment = null;
    selectedVehicleForAssignment = null;
  }

  // Müsait araçlar
  function getAvailableVehicles() {
    return vehicles.filter(v => v.status === 'available');
  }

  // Bekleyen çağrılar
  function getPendingCalls() {
    return calls.filter(c => c.status === 'pending');
  }

  async function createCall(stopId: number) {
    try {
      const res = await fetch('/api/calls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stopId }) });
      const data = await res.json();
      if (data.success) {
        appStore.addNotification('success', 'Çağrı Oluşturuldu', `${stops.find(s => s.id === stopId)?.name} durağından çağrı alındı`);
        await fetchData();
      } else {
        appStore.addNotification('error', 'Hata', data.message || 'Çağrı oluşturulamadı');
      }
    } catch (err) {
      appStore.addNotification('error', 'Hata', 'Çağrı oluşturulurken hata oluştu');
    }
  }

  onMount(() => {
    initMap();
    const interval = setInterval(fetchData, 10000);
    return () => { 
      clearInterval(interval); 
      map?.remove();
      // Simülasyonları temizle
      activeSimulations.forEach(sim => clearInterval(sim.interval));
      activeSimulations.clear();
    };
  });
</script>

<div class="h-[calc(100vh-4rem)] flex flex-col">
  <!-- Top Bar -->
  <div class="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-700">
    <!-- Stats Row -->
    {#if showStats}
      <div class="px-4 py-2 flex items-center justify-between gap-4 border-b border-slate-700/50">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full {appStore.isDemo ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse"></div>
          <!-- Traccar Toggle -->
          <button 
            onclick={toggleTraccar}
            class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all {traccarEnabled ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'}"
            title="Traccar Canlı Takip"
          >
            <span class="text-sm">📡</span>
            {#if traccarEnabled}
              <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            {/if}
          </button>
          <button onclick={() => showStats = false} class="p-1 text-slate-500 hover:text-white" title="Gizle">✕</button>
        </div>
        <div class="flex items-center gap-2 flex-1 justify-center">
          <div class="flex items-center gap-2 bg-slate-800/80 rounded-lg px-3 py-1.5">
            <span class="text-lg font-bold text-teal-400">{stats.vehicles?.available || 0}</span>
            <span class="text-xs text-slate-400">Müsait</span>
          </div>
          <div class="flex items-center gap-2 bg-slate-800/80 rounded-lg px-3 py-1.5">
            <span class="text-lg font-bold text-yellow-400">{stats.pendingCalls || 0}</span>
            <span class="text-xs text-slate-400">Bekleyen</span>
          </div>
          <div class="flex items-center gap-2 bg-slate-800/80 rounded-lg px-3 py-1.5">
            <span class="text-lg font-bold text-blue-400">{stats.activeTasks || 0}</span>
            <span class="text-xs text-slate-400">Aktif</span>
          </div>
          <div class="flex items-center gap-2 bg-slate-800/80 rounded-lg px-3 py-1.5">
            <span class="text-lg font-bold text-green-400">{stats.completedCalls || 0}</span>
            <span class="text-xs text-slate-400">Tamamlanan</span>
          </div>
        </div>
        <div class="flex gap-1 bg-slate-800/80 rounded-lg p-1 relative">
          <button onclick={() => switchStyle('satellite')} class="px-2.5 py-1 rounded text-xs font-medium transition-all {currentStyle === 'satellite' ? 'bg-teal-500 text-white' : 'text-slate-300 hover:bg-slate-700'}">🛰️ Esri</button>
          <button onclick={() => switchStyle('hybrid')} class="px-2.5 py-1 rounded text-xs font-medium transition-all {currentStyle === 'hybrid' ? 'bg-teal-500 text-white' : 'text-slate-300 hover:bg-slate-700'}">🗺️ Hybrid</button>
          <button onclick={() => showMapOptions = !showMapOptions} class="px-2 py-1 rounded text-xs font-medium transition-all {showMapOptions ? 'bg-teal-500 text-white' : 'text-slate-300 hover:bg-slate-700'}">⚙️</button>
          
          <!-- Map Options Dropdown -->
          {#if showMapOptions}
            <div class="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 p-3">
              <h4 class="text-sm font-semibold text-white mb-3">🗺️ Harita Seçenekleri</h4>
              
              <!-- Layers -->
              <div class="space-y-2 mb-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showRoutes} onchange={toggleRoutes} class="w-4 h-4 rounded bg-slate-700 border-slate-600 text-teal-500 focus:ring-teal-500" />
                  <span class="text-sm text-slate-300">🛤️ Rota Çizgilerini Göster</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showStops} onchange={toggleStops} class="w-4 h-4 rounded bg-slate-700 border-slate-600 text-teal-500 focus:ring-teal-500" />
                  <span class="text-sm text-slate-300">🚏 Durakları Göster</span>
                </label>
              </div>
              
              <!-- Route Style -->
              <div class="mb-4">
                <p class="text-xs text-slate-400 mb-2">Çizgi Stili</p>
                <div class="flex gap-2">
                  <button 
                    onclick={() => { routeStyle = 'solid'; updateRoutesStyle(); }}
                    class="flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all {routeStyle === 'solid' ? 'bg-teal-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
                  >
                    ─── Düz
                  </button>
                  <button 
                    onclick={() => { routeStyle = 'dashed'; updateRoutesStyle(); }}
                    class="flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all {routeStyle === 'dashed' ? 'bg-teal-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
                  >
                    - - - Kesikli
                  </button>
                </div>
              </div>
              
              <!-- Route Width -->
              <div class="mb-4">
                <p class="text-xs text-slate-400 mb-2">Çizgi Kalınlığı: {routeWidth}px</p>
                <input 
                  type="range" 
                  min="1" 
                  max="10" 
                  bind:value={routeWidth}
                  oninput={updateRoutesStyle}
                  class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
              </div>
              
              <!-- Route Color -->
              <div>
                <p class="text-xs text-slate-400 mb-2">Çizgi Rengi</p>
                <div class="grid grid-cols-4 gap-1.5">
                  {#each routeColors as color}
                    <button 
                      onclick={() => { routeColor = color.value; updateRoutesStyle(); }}
                      class="w-full h-8 rounded-lg border-2 transition-all hover:scale-105 {routeColor === color.value ? 'border-white shadow-lg' : 'border-slate-600'}"
                      style="background-color: {color.value}"
                      title={color.name}
                    ></button>
                  {/each}
                </div>
              </div>
              
              <!-- Traccar Settings Link -->
              <div class="mt-4 pt-4 border-t border-slate-700">
                <a 
                  href="/settings/traccar"
                  class="flex items-center gap-2 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm transition-colors"
                >
                  <span>📡</span>
                  <span>Traccar GPS Ayarları</span>
                </a>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Vehicle Bar -->
    {#if showVehicleBar}
      <div class="px-4 py-2 flex items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-white">🚐 Araçlar</span>
          <button onclick={() => showVehicleBar = false} class="p-1 text-slate-500 hover:text-white text-xs" title="Gizle">✕</button>
        </div>
        <div class="flex items-center gap-2 flex-1 overflow-x-auto pb-1">
          {#each vehicles as vehicle}
            {@const activeTask = getVehicleActiveTask(vehicle.id)}
            {@const currentStopName = vehicle.currentStop?.name}
            <button 
              onclick={(e) => handleVehicleClick(vehicle, e)}
              oncontextmenu={(e) => handleVehicleContextMenu(vehicle, e)}
              class="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors shrink-0 {vehicle.status === 'available' && getPendingCalls().length > 0 ? 'bg-green-500/20 hover:bg-green-500/30 ring-1 ring-green-500/50' : vehicle.status === 'busy' ? 'bg-yellow-500/10 hover:bg-yellow-500/20 ring-1 ring-yellow-500/30' : 'bg-slate-800/60 hover:bg-slate-700'}"
              title={vehicle.status === 'available' ? 'Sol tık: Araç gönder | Sağ tık: Menü' : 'Sağ tık: Menü'}
            >
              <div class="w-6 h-6 rounded-full flex items-center justify-center text-sm" style="background-color: {getVehicleColor(vehicle.status)}">🚐</div>
              <span class="text-xs text-white font-medium">{vehicle.name}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-full" style="background-color: {getVehicleColor(vehicle.status)}30; color: {getVehicleColor(vehicle.status)}">
                {#if vehicle.status === 'busy'}
                  Görevde
                {:else if vehicle.status === 'offline'}
                  Çevrimdışı
                {:else if vehicle.status === 'maintenance'}
                  Bakımda
                {:else if currentStopName}
                  📍 {currentStopName}
                {:else}
                  Müsait
                {/if}
              </span>
              {#if vehicle.status === 'available' && getPendingCalls().length > 0}
                <span class="text-[10px] text-green-400">+</span>
              {/if}
              {#if activeTask}
                <span class="text-[10px] text-yellow-400">📍</span>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Collapsed toggles -->
    {#if !showStats || !showVehicleBar}
      <div class="px-4 py-1 flex items-center gap-2 border-t border-slate-700/50">
        {#if !showStats}
          <button onclick={() => showStats = true} class="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/50">📊 İstatistikler</button>
        {/if}
        {#if !showVehicleBar}
          <button onclick={() => showVehicleBar = true} class="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/50">🚐 Araçlar</button>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Main Content -->
  <div class="flex-1 flex overflow-hidden">
    <div class="flex-1 relative">
      {#if loading}
        <div class="absolute inset-0 bg-slate-900 flex items-center justify-center z-10">
          <div class="text-center">
            <div class="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-slate-400">Harita yükleniyor...</p>
          </div>
        </div>
      {/if}
      <div bind:this={mapContainer} class="w-full h-full"></div>
      
      <!-- Selected Vehicle Info Card - Sağ Üst Köşe -->
      {#if selectedVehicleInfo}
        <div class="absolute top-4 left-4 z-20 bg-slate-800/95 backdrop-blur-sm border border-slate-600 rounded-xl shadow-2xl p-4 min-w-[200px]">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-bold text-white text-lg flex items-center gap-2">
              <span class="text-2xl">🚐</span>
              {selectedVehicleInfo.vehicle.name}
            </h3>
            <button 
              onclick={() => { selectedVehicleInfo = null; clearVehicleRouteLine(); }}
              class="text-slate-400 hover:text-white text-lg"
            >✕</button>
          </div>
          <p class="text-sm text-slate-400 mb-2">{selectedVehicleInfo.vehicle.plateNumber}</p>
          <div class="flex items-center gap-2 mb-2">
            <span class="text-sm text-slate-300">Durum:</span>
            <span 
              class="text-sm font-semibold px-2 py-0.5 rounded-full"
              style="background-color: {getVehicleColor(selectedVehicleInfo.task ? 'busy' : selectedVehicleInfo.vehicle.status, selectedVehicleInfo.task?.status)}20; color: {getVehicleColor(selectedVehicleInfo.task ? 'busy' : selectedVehicleInfo.vehicle.status, selectedVehicleInfo.task?.status)}"
            >
              {selectedVehicleInfo.task ? (selectedVehicleInfo.task.status === 'pickup' && !selectedVehicleInfo.task.dropoffStopId ? 'Hedef Bekliyor' : 'Görevde') : (selectedVehicleInfo.vehicle.status === 'available' ? 'Müsait' : selectedVehicleInfo.vehicle.status === 'busy' ? 'Görevde' : 'Çevrimdışı')}
            </span>
          </div>
          {#if selectedVehicleInfo.targetStop}
            <div class="mt-3 pt-3 border-t border-slate-600">
              <p class="text-cyan-400 font-medium text-sm">{selectedVehicleInfo.targetStop}</p>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Sidebar Toggle -->
      {#if !showSidebar}
        <button 
          onclick={() => showSidebar = true}
          class="absolute top-4 right-4 z-10 p-2 bg-slate-800/90 hover:bg-slate-700 rounded-lg text-white shadow-lg"
        >
          ◀ Panel
        </button>
      {/if}
    </div>

    <!-- Sidebar -->
    {#if showSidebar}
      <div class="w-72 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden">
        <div class="p-2 border-b border-slate-700 flex items-center justify-between">
          <span class="text-sm font-semibold text-white">📋 Panel</span>
          <button onclick={() => showSidebar = false} class="p-1 text-slate-400 hover:text-white">✕</button>
        </div>
        
        <!-- Pending Calls -->
        <div class="p-3 overflow-y-auto" style="max-height: 40%;">
          <h2 class="text-sm font-semibold text-white mb-2">📞 Bekleyen Çağrılar ({calls.filter(c => c.status === 'pending').length})</h2>
          {#if calls.filter(c => c.status === 'pending').length === 0}
            <div class="text-center py-4 text-slate-500">
              <p class="text-xs">Bekleyen çağrı yok</p>
            </div>
          {:else}
            <div class="space-y-1.5">
              {#each calls.filter(c => c.status === 'pending') as call}
                <button 
                  onclick={() => handleCallClick(call)}
                  oncontextmenu={(e) => handleCallContextMenu(call, e)}
                  class="w-full bg-red-500/10 border border-red-500/30 rounded-lg p-2 hover:bg-red-500/20 transition-colors cursor-pointer text-left"
                  title="Sol tık: Araç gönder | Sağ tık: İptal"
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-xs font-medium text-white">{call.stop?.icon} {call.stop?.name}</div>
                      <div class="text-[10px] text-slate-400">{new Date(call.createdAt).toLocaleTimeString('tr-TR')}</div>
                    </div>
                    <div class="flex items-center gap-2">
                      {#if getAvailableVehicles().length > 0}
                        <span class="text-[10px] text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded">Gönder →</span>
                      {/if}
                      <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Awaiting Dropoff - Hedef Bekleyen Araçlar -->
        <div class="p-3 border-t border-slate-700 overflow-y-auto" style="max-height: 40%;">
          <h2 class="text-sm font-semibold text-white mb-2">🎯 Hedef Bekleyen ({getTasksAwaitingDropoff().length})</h2>
          {#if getTasksAwaitingDropoff().length === 0}
            <div class="text-center py-4 text-slate-500">
              <p class="text-xs">Misafir alan araç yok</p>
              <p class="text-[10px] mt-1">Araç pickup noktasına ulaşınca burada görünür</p>
            </div>
          {:else}
            <div class="space-y-1.5">
              {#each getTasksAwaitingDropoff() as task}
                <button 
                  onclick={() => { selectedTaskForDropoff = task; showDropoffModal = true; }}
                  class="w-full bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 hover:bg-yellow-500/20 transition-colors cursor-pointer text-left"
                  title="Tıkla: Hedef belirle"
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-xs font-medium text-white">🚐 {task.vehicle?.name || `Araç #${task.vehicleId}`}</div>
                      <div class="text-[10px] text-slate-400">📍 Alındı: {task.pickupStop?.name || 'Bilinmeyen'}</div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] text-yellow-400 bg-yellow-500/20 px-1.5 py-0.5 rounded">Hedef Seç →</span>
                      <div class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

{#if appStore.isDemo}
  <div class="fixed bottom-4 left-4 z-50">
    <DemoSimulator {vehicles} {stops} {calls} onRefresh={fetchData} />
  </div>
{/if}

<!-- Task Assignment Modal -->
{#if showAssignmentModal}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div 
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" 
    role="dialog" 
    aria-modal="true" 
    tabindex="-1"
    onclick={closeAssignmentModal} 
    onkeydown={(e) => e.key === 'Escape' && closeAssignmentModal()}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div 
      class="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      role="document"
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
    >
      <!-- Modal Header -->
      <div class="px-5 py-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/80">
        <div class="flex items-center gap-3">
          <span class="text-2xl">{assignmentMode === 'selectVehicle' ? '🚐' : '📞'}</span>
          <div>
            <h3 class="text-lg font-bold text-white">
              {assignmentMode === 'selectVehicle' ? 'Araç Seç' : 'Çağrı Seç'}
            </h3>
            <p class="text-xs text-slate-400">
              {#if assignmentMode === 'selectVehicle' && selectedCallForAssignment}
                {selectedCallForAssignment.stop?.icon} {selectedCallForAssignment.stop?.name} durağına araç gönder
              {:else if assignmentMode === 'selectCall' && selectedVehicleForAssignment}
                {selectedVehicleForAssignment.name} aracını çağrıya gönder
              {/if}
            </p>
          </div>
        </div>
        <button onclick={closeAssignmentModal} class="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
          ✕
        </button>
      </div>

      <!-- Modal Content -->
      <div class="p-5 max-h-80 overflow-y-auto">
        {#if assignmentMode === 'selectVehicle'}
          <!-- Araç Seçimi - Uzaklığa göre sıralı -->
          {#if getAvailableVehicles().length === 0}
            <div class="text-center py-8 text-slate-500">
              <div class="text-4xl mb-2">😔</div>
              <p class="text-sm">Müsait araç yok</p>
            </div>
          {:else}
            {@const sortedVehicles = selectedCallForAssignment?.stop ? getVehiclesSortedByDistance(selectedCallForAssignment.stop.lng, selectedCallForAssignment.stop.lat) : getAvailableVehicles().map(v => ({ vehicle: v, distance: 0 }))}
            <div class="space-y-2">
              {#each sortedVehicles as { vehicle, distance }, index}
                <button 
                  onclick={() => selectedVehicleForAssignment = vehicle}
                  class="w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 {selectedVehicleForAssignment?.id === vehicle.id ? 'bg-green-500/20 border-2 border-green-500 ring-2 ring-green-500/30' : 'bg-slate-700/50 hover:bg-slate-700 border-2 border-transparent'} {index === 0 ? 'ring-2 ring-cyan-500/50' : ''}"
                >
                  <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg" style="background-color: {getVehicleColor(vehicle.status)}">🚐</div>
                  <div class="flex-1">
                    <div class="text-sm font-semibold text-white flex items-center gap-2">
                      {vehicle.name}
                      {#if index === 0}
                        <span class="text-xs px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-300">⭐ Önerilen</span>
                      {/if}
                    </div>
                    <div class="text-xs text-slate-400">{vehicle.plateNumber}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-xs font-medium text-cyan-400">{formatDistance(distance)}</div>
                    <span class="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Müsait</span>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        {:else if assignmentMode === 'selectCall'}
          <!-- Çağrı Seçimi -->
          {#if getPendingCalls().length === 0}
            <div class="text-center py-8 text-slate-500">
              <div class="text-4xl mb-2">✨</div>
              <p class="text-sm">Bekleyen çağrı yok</p>
            </div>
          {:else}
            <div class="space-y-2">
              {#each getPendingCalls() as call}
                <button 
                  onclick={() => selectedCallForAssignment = call}
                  class="w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 {selectedCallForAssignment?.id === call.id ? 'bg-red-500/20 border-2 border-red-500 ring-2 ring-red-500/30' : 'bg-slate-700/50 hover:bg-slate-700 border-2 border-transparent'}"
                >
                  <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-red-500/20">
                    {call.stop?.icon || '📍'}
                  </div>
                  <div class="flex-1">
                    <div class="text-sm font-semibold text-white">{call.stop?.name || 'Bilinmeyen Durak'}</div>
                    <div class="text-xs text-slate-400">{new Date(call.createdAt).toLocaleTimeString('tr-TR')}</div>
                  </div>
                  <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                </button>
              {/each}
            </div>
          {/if}
        {/if}
      </div>

      <!-- Modal Footer -->
      <div class="px-5 py-4 border-t border-slate-700 flex items-center justify-between bg-slate-800/80">
        <button 
          onclick={closeAssignmentModal}
          class="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          İptal
        </button>
        <button 
          onclick={assignTask}
          disabled={!selectedCallForAssignment || !selectedVehicleForAssignment}
          class="px-5 py-2.5 bg-green-500 hover:bg-green-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
        >
          <span>🚐</span>
          <span>Araç Gönder</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Dropoff Selection Modal - Hedef Seçimi -->
{#if showDropoffModal && selectedTaskForDropoff}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div 
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" 
    role="dialog" 
    aria-modal="true" 
    tabindex="-1"
    onclick={() => { showDropoffModal = false; selectedTaskForDropoff = null; }} 
    onkeydown={(e) => e.key === 'Escape' && (showDropoffModal = false, selectedTaskForDropoff = null)}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div 
      class="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      role="document"
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
    >
      <!-- Modal Header -->
      <div class="px-5 py-4 border-b border-slate-700 flex items-center justify-between bg-yellow-500/10">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🎯</span>
          <div>
            <h3 class="text-lg font-bold text-white">Hedef Seç</h3>
            <p class="text-xs text-slate-400">
              {selectedTaskForDropoff.vehicle?.name} misafiri nereye bırakacak?
            </p>
          </div>
        </div>
        <button onclick={() => { showDropoffModal = false; selectedTaskForDropoff = null; }} class="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
          ✕
        </button>
      </div>

      <!-- Task Info -->
      <div class="px-5 py-3 bg-slate-700/30 border-b border-slate-700">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-lg">🚐</div>
          <div>
            <div class="text-sm font-medium text-white">{selectedTaskForDropoff.vehicle?.name}</div>
            <div class="text-xs text-slate-400">📍 Alındı: {selectedTaskForDropoff.pickupStop?.name}</div>
          </div>
        </div>
      </div>

      <!-- Stop Selection -->
      <div class="p-5 max-h-80 overflow-y-auto">
        <p class="text-xs text-slate-400 mb-3">Hedef durağı seçin:</p>
        <div class="space-y-2">
          {#each stops.filter(s => s.id !== selectedTaskForDropoff.pickupStopId) as stop}
            <button 
              onclick={() => setDropoffAndGo(stop.id)}
              class="w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 bg-slate-700/50 hover:bg-slate-700 border-2 border-transparent hover:border-yellow-500/50"
            >
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-slate-600">
                {stop.icon}
              </div>
              <div class="flex-1">
                <div class="text-sm font-semibold text-white">{stop.name}</div>
                <div class="text-xs text-slate-400">ID: {stop.id}</div>
              </div>
              <span class="text-xs text-yellow-400">→</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-5 py-4 border-t border-slate-700 bg-slate-800/80">
        <button 
          onclick={() => { showDropoffModal = false; selectedTaskForDropoff = null; }}
          class="w-full py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          İptal
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Vehicle Context Menu - Sağ Tık Menüsü -->
{#if showVehicleContextMenu && contextMenuVehicle}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div 
    class="fixed inset-0 z-[9998]" 
    onclick={closeContextMenu}
    onkeydown={(e) => e.key === 'Escape' && closeContextMenu()}
    role="presentation"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
    <div 
      class="absolute bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-2 min-w-[180px]"
      style="left: {contextMenuPosition.x}px; top: {contextMenuPosition.y}px;"
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
    >
      <div class="px-3 py-2 border-b border-slate-700">
        <div class="text-sm font-semibold text-white">🚐 {contextMenuVehicle.name}</div>
        <div class="text-xs text-slate-400">{contextMenuVehicle.plateNumber}</div>
      </div>
      
      {#if getVehicleActiveTask(contextMenuVehicle.id)}
        <!-- Görevde - İptal seçeneği -->
        <button 
          onclick={() => { const task = getVehicleActiveTask(contextMenuVehicle.id); if (task) cancelTask(task.id); }}
          class="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2"
        >
          <span>❌</span>
          <span>Görevi İptal Et</span>
        </button>
      {:else}
        <!-- Görevde değil -->
        {#if contextMenuVehicle.status === 'available' && getPendingCalls().length > 0}
          <button 
            onclick={() => { closeContextMenu(); selectedVehicleForAssignment = contextMenuVehicle; assignmentMode = 'selectCall'; showAssignmentModal = true; }}
            class="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-green-500/20 flex items-center gap-2"
          >
            <span>📋</span>
            <span>Görev Ata ({getPendingCalls().length} çağrı)</span>
          </button>
        {/if}
        
        <button 
          onclick={() => { closeContextMenu(); showStatusModal = true; }}
          class="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
        >
          <span>⚙️</span>
          <span>Durumu Güncelle</span>
        </button>
      {/if}
      
      <!-- Müsait araç için durağa gönder seçeneği -->
      {#if contextMenuVehicle.status === 'available' && !getVehicleActiveTask(contextMenuVehicle.id)}
        <button 
          onclick={() => { closeContextMenu(); showSendToStopModal = true; }}
          class="w-full px-3 py-2 text-left text-sm text-cyan-400 hover:bg-cyan-500/20 flex items-center gap-2"
        >
          <span>📍</span>
          <span>Durağa Gönder</span>
        </button>
      {/if}
      
      <div class="border-t border-slate-700 mt-1 pt-1">
        <button 
          onclick={() => { closeContextMenu(); flyToVehicle(contextMenuVehicle); }}
          class="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
        >
          <span>🔍</span>
          <span>Haritada Göster</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Vehicle Status Modal -->
{#if showStatusModal && contextMenuVehicle}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div 
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" 
    role="dialog" 
    aria-modal="true" 
    tabindex="-1"
    onclick={() => { showStatusModal = false; contextMenuVehicle = null; }} 
    onkeydown={(e) => e.key === 'Escape' && (showStatusModal = false, contextMenuVehicle = null)}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div 
      class="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      role="document"
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
    >
      <div class="px-5 py-4 border-b border-slate-700">
        <h3 class="text-lg font-bold text-white">⚙️ Araç Durumu</h3>
        <p class="text-xs text-slate-400">{contextMenuVehicle.name} - {contextMenuVehicle.plateNumber}</p>
      </div>
      
      <div class="p-4 space-y-2">
        <button 
          onclick={() => updateVehicleStatus(contextMenuVehicle.id, 'available')}
          class="w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 {contextMenuVehicle.status === 'available' ? 'bg-green-500/30 border-2 border-green-500' : 'bg-slate-700/50 hover:bg-slate-700 border-2 border-transparent'}"
        >
          <div class="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">✓</div>
          <div>
            <div class="text-sm font-semibold text-white">Müsait</div>
            <div class="text-xs text-slate-400">Görev alabilir</div>
          </div>
        </button>
        
        <button 
          onclick={() => updateVehicleStatus(contextMenuVehicle.id, 'offline')}
          class="w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 {contextMenuVehicle.status === 'offline' ? 'bg-slate-500/30 border-2 border-slate-500' : 'bg-slate-700/50 hover:bg-slate-700 border-2 border-transparent'}"
        >
          <div class="w-8 h-8 rounded-full bg-slate-500 flex items-center justify-center">⏸</div>
          <div>
            <div class="text-sm font-semibold text-white">Çevrimdışı</div>
            <div class="text-xs text-slate-400">Görev alamaz</div>
          </div>
        </button>
        
        <button 
          onclick={() => updateVehicleStatus(contextMenuVehicle.id, 'maintenance')}
          class="w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 {contextMenuVehicle.status === 'maintenance' ? 'bg-red-500/30 border-2 border-red-500' : 'bg-slate-700/50 hover:bg-slate-700 border-2 border-transparent'}"
        >
          <div class="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">🔧</div>
          <div>
            <div class="text-sm font-semibold text-white">Bakımda</div>
            <div class="text-xs text-slate-400">Servis/bakım</div>
          </div>
        </button>
      </div>
      
      <div class="px-5 py-4 border-t border-slate-700">
        <button 
          onclick={() => { showStatusModal = false; contextMenuVehicle = null; }}
          class="w-full py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          İptal
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Send To Stop Modal - Durağa Gönder (Context Menu'den - Araç seçili, durak seç) -->
{#if showSendToStopModal && contextMenuVehicle && !selectedStopForSend}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div 
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" 
    role="dialog" 
    aria-modal="true" 
    tabindex="-1"
    onclick={() => { showSendToStopModal = false; }}
    onkeydown={(e) => e.key === 'Escape' && (showSendToStopModal = false)}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div 
      class="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[80vh] flex flex-col"
      role="document"
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
    >
      <div class="px-5 py-4 border-b border-slate-700">
        <h3 class="text-lg font-bold text-white">📍 Durağa Gönder</h3>
        <p class="text-xs text-slate-400">{contextMenuVehicle.name} - {contextMenuVehicle.plateNumber}</p>
      </div>
      
      <div class="p-4 space-y-2 overflow-y-auto flex-1">
        {#each stops as stop}
          <button 
            onclick={() => sendVehicleToStop(stop.id)}
            class="w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 bg-slate-700/50 hover:bg-cyan-500/20 border-2 border-transparent hover:border-cyan-500"
          >
            <div class="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-xl">{stop.icon}</div>
            <div class="flex-1">
              <div class="text-sm font-semibold text-white">{stop.name}</div>
              <div class="text-xs text-cyan-400">{formatDistance(getRouteDistance(contextMenuVehicle.lng, contextMenuVehicle.lat, stop.lng, stop.lat))}</div>
            </div>
            <span class="text-cyan-400">→</span>
          </button>
        {/each}
      </div>
      
      <div class="px-5 py-4 border-t border-slate-700">
        <button 
          onclick={() => { showSendToStopModal = false; }}
          class="w-full py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          İptal
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Send Vehicle To Stop Modal - Araç Seç (Durak popup'ından - Durak seçili, araç seç) -->
{#if showSendToStopModal && selectedStopForSend && !contextMenuVehicle}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div 
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" 
    role="dialog" 
    aria-modal="true" 
    tabindex="-1"
    onclick={() => { showSendToStopModal = false; selectedStopForSend = null; }}
    onkeydown={(e) => e.key === 'Escape' && (showSendToStopModal = false, selectedStopForSend = null)}
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div 
      class="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[80vh] flex flex-col"
      role="document"
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
    >
      <div class="px-5 py-4 border-b border-slate-700">
        <h3 class="text-lg font-bold text-white">🚐 Araç Seç</h3>
        <p class="text-xs text-slate-400">{selectedStopForSend.icon} {selectedStopForSend.name} durağına gönderilecek</p>
      </div>
      
      <div class="p-4 space-y-2 overflow-y-auto flex-1">
        {#if getAvailableVehicles().length === 0}
          <div class="text-center py-8 text-slate-500">
            <div class="text-4xl mb-2">😔</div>
            <p class="text-sm">Müsait araç yok</p>
          </div>
        {:else}
          {@const sortedVehicles = getVehiclesSortedByDistance(selectedStopForSend.lng, selectedStopForSend.lat)}
          {#each sortedVehicles as { vehicle, distance }, index}
            <button 
              onclick={() => sendSelectedVehicleToStop(vehicle)}
              class="w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 bg-slate-700/50 hover:bg-cyan-500/20 border-2 border-transparent hover:border-cyan-500 {index === 0 ? 'ring-2 ring-cyan-500/50' : ''}"
            >
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg" style="background-color: {getVehicleColor(vehicle.status)}">🚐</div>
              <div class="flex-1">
                <div class="text-sm font-semibold text-white flex items-center gap-2">
                  {vehicle.name}
                  {#if index === 0}
                    <span class="text-xs px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-300">⭐ Önerilen</span>
                  {/if}
                </div>
                <div class="text-xs text-slate-400">{vehicle.plateNumber}</div>
              </div>
              <div class="text-right">
                <div class="text-xs font-medium text-cyan-400">{formatDistance(distance)}</div>
                <span class="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Müsait</span>
              </div>
            </button>
          {/each}
        {/if}
      </div>
      
      <div class="px-5 py-4 border-t border-slate-700">
        <button 
          onclick={() => { showSendToStopModal = false; selectedStopForSend = null; }}
          class="w-full py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          İptal
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Call Context Menu - Bekleyen Çağrı Sağ Tık Menüsü -->
{#if showCallContextMenu && contextMenuCall}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div 
    class="fixed inset-0 z-[9998]" 
    onclick={closeContextMenu}
    onkeydown={(e) => e.key === 'Escape' && closeContextMenu()}
    role="presentation"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
    <div 
      class="absolute bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-2 min-w-[200px]"
      style="left: {contextMenuPosition.x}px; top: {contextMenuPosition.y}px;"
      onclick={(e) => e.stopPropagation()}
      onkeydown={() => {}}
    >
      <div class="px-3 py-2 border-b border-slate-700">
        <div class="text-sm font-semibold text-white">📞 Çağrı #{contextMenuCall.id}</div>
        <div class="text-xs text-slate-400">{contextMenuCall.stop?.name || 'Bilinmeyen Durak'}</div>
        <div class="text-xs text-slate-500 mt-1">
          {contextMenuCall.guestCount || 1} misafir • {new Date(contextMenuCall.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      
      <button 
        onclick={() => { cancelCall(contextMenuCall.id); closeContextMenu(); }}
        class="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2"
      >
        <span>❌</span>
        <span>Çağrıyı İptal Et</span>
      </button>
      
      <div class="border-t border-slate-700 mt-1 pt-1">
        <button 
          onclick={() => { closeContextMenu(); handleCallClick(contextMenuCall); }}
          class="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-green-500/20 flex items-center gap-2"
        >
          <span>🚐</span>
          <span>Araç Gönder</span>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  :global(.maplibregl-popup-content) { border-radius: 8px; padding: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
  :global(.maplibregl-popup-close-button) { font-size: 18px; padding: 4px 8px; }
</style>