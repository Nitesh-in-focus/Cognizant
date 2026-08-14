import React, { useEffect, useState, useRef } from 'react';
import {
  Navigation,
  Gauge,
  Thermometer,
  Clock,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  MapPin,
  Truck,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Radio,
  ExternalLink,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import { Loader } from '@googlemaps/js-api-loader';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../contexts/AppContext';
import { StatusBadge } from '../common/StatusBadge';

export interface Waypoint {
  name: string;
  lat: number;
  lng: number;
  progress: number;
  speed: number;
  temp: number;
  status: string;
}

interface TruckTrackingMapProps {
  shipment?: any;
  onWaypointChange?: (waypoint: Waypoint, progress: number) => void;
  className?: string;
  compact?: boolean;
}

const CORRIDORS: Record<string, Waypoint[]> = {
  PUNE: [
    { name: 'JNPT Port Container Terminal (Mumbai)', lat: 18.9496, lng: 72.9515, progress: 0, speed: 35, temp: 21.0, status: 'DEPARTED' },
    { name: 'Vashi Creek Toll Plaza Checkpost', lat: 19.0657, lng: 72.9984, progress: 20, speed: 52, temp: 21.2, status: 'PASSED' },
    { name: 'Khalapur Toll Plaza (Expressway Start)', lat: 18.7983, lng: 73.2842, progress: 40, speed: 68, temp: 21.4, status: 'PASSED' },
    { name: 'Lonavala Expressway Ghats (Midpoint)', lat: 18.7557, lng: 73.4091, progress: 60, speed: 45, temp: 21.8, status: 'IN_TRANSIT' },
    { name: 'Talegaon Toll Post & Weighbridge', lat: 18.7300, lng: 73.6700, progress: 80, speed: 60, temp: 21.5, status: 'APPROACHING' },
    { name: 'Pune Central Distribution Hub & Yard', lat: 18.5204, lng: 73.8567, progress: 100, speed: 15, temp: 21.2, status: 'DESTINATION_GATE' },
  ],
  DELHI: [
    { name: 'Gurgaon Cyber City Logistics Hub (Delhi NCR)', lat: 28.4595, lng: 77.0266, progress: 0, speed: 40, temp: 19.5, status: 'DEPARTED' },
    { name: 'Kherki Daula Toll Plaza Checkpost', lat: 28.4011, lng: 76.9942, progress: 20, speed: 58, temp: 19.8, status: 'PASSED' },
    { name: 'Dharuhera Industrial Transit Depot', lat: 28.2045, lng: 76.7905, progress: 40, speed: 65, temp: 20.1, status: 'PASSED' },
    { name: 'Kotputli Midpoint Highway Checkpoint', lat: 27.7027, lng: 76.1989, progress: 60, speed: 55, temp: 20.4, status: 'IN_TRANSIT' },
    { name: 'Shahpura Toll & Weighbridge Terminal', lat: 27.3879, lng: 75.9575, progress: 80, speed: 62, temp: 20.2, status: 'APPROACHING' },
    { name: 'Jaipur Central Regional DC & Yard', lat: 26.9124, lng: 75.7873, progress: 100, speed: 20, temp: 19.9, status: 'DESTINATION_GATE' },
  ],
  CHENNAI: [
    { name: 'Whitefield Inland Container Depot (Bengaluru)', lat: 12.9698, lng: 77.7500, progress: 0, speed: 38, temp: 22.0, status: 'DEPARTED' },
    { name: 'Hosur State Border Checkpost', lat: 12.7409, lng: 77.8253, progress: 20, speed: 50, temp: 22.3, status: 'PASSED' },
    { name: 'Krishnagiri Toll Plaza', lat: 12.5186, lng: 78.2137, progress: 40, speed: 70, temp: 22.6, status: 'PASSED' },
    { name: 'Vellore Highway Midpoint Junction', lat: 12.9165, lng: 79.1325, progress: 60, speed: 48, temp: 23.0, status: 'IN_TRANSIT' },
    { name: 'Sriperumbudur Industrial Corridor Post', lat: 12.9675, lng: 79.9400, progress: 80, speed: 58, temp: 22.8, status: 'APPROACHING' },
    { name: 'Chennai Central Port Terminal Yard', lat: 13.0827, lng: 80.2707, progress: 100, speed: 18, temp: 22.5, status: 'DESTINATION_GATE' },
  ],
  KOLKATA: [
    { name: 'Dankuni Freight Logistics Hub (Kolkata)', lat: 22.6845, lng: 88.2934, progress: 0, speed: 32, temp: 23.2, status: 'DEPARTED' },
    { name: 'Singur Toll Plaza Checkpost', lat: 22.8136, lng: 88.2325, progress: 20, speed: 48, temp: 23.5, status: 'PASSED' },
    { name: 'Burdwan Express Highway Junction', lat: 23.2324, lng: 87.8615, progress: 40, speed: 64, temp: 23.9, status: 'PASSED' },
    { name: 'Panagarh Industrial Corridor Depot', lat: 23.4475, lng: 87.4390, progress: 60, speed: 52, temp: 24.1, status: 'IN_TRANSIT' },
    { name: 'Durgapur Steel City Weighbridge', lat: 23.5204, lng: 87.3119, progress: 80, speed: 60, temp: 23.8, status: 'APPROACHING' },
    { name: 'Asansol Regional Distribution Hub & Yard', lat: 23.6739, lng: 86.9524, progress: 100, speed: 15, temp: 23.4, status: 'DESTINATION_GATE' },
  ],
  GUJARAT: [
    { name: 'Sanand Automotive Hub (Ahmedabad)', lat: 22.9927, lng: 72.3811, progress: 0, speed: 42, temp: 24.0, status: 'DEPARTED' },
    { name: 'Nadiad Express Toll Plaza', lat: 22.6916, lng: 72.8634, progress: 20, speed: 60, temp: 24.2, status: 'PASSED' },
    { name: 'Vadodara Industrial Bypass Junction', lat: 22.3072, lng: 73.1812, progress: 40, speed: 72, temp: 24.5, status: 'PASSED' },
    { name: 'Bharuch Narmada Bridge Checkpost', lat: 21.7051, lng: 72.9959, progress: 60, speed: 45, temp: 24.9, status: 'IN_TRANSIT' },
    { name: 'Ankleshwar Chemical Corridor Post', lat: 21.6264, lng: 73.0152, progress: 80, speed: 62, temp: 24.6, status: 'APPROACHING' },
    { name: 'Surat Central Industrial DC & Yard', lat: 21.1702, lng: 72.8311, progress: 100, speed: 20, temp: 24.1, status: 'DESTINATION_GATE' },
  ],
};

export const TruckTrackingMap: React.FC<TruckTrackingMapProps> = ({
  shipment,
  onWaypointChange,
  className = '',
  compact = false,
}) => {
  const { showSnackbar, addAlert, canEditLocation } = useApp();

  // Determine corridor dynamically from shipment data
  const getCorridorWaypoints = (): Waypoint[] => {
    if (!shipment) return CORRIDORS.PUNE;

    const destCity = (shipment.warehouses?.city || shipment.destination_city || '').toUpperCase();
    const origin = (shipment.origin || '').toUpperCase();

    if (destCity.includes('KOLKATA') || origin.includes('KOLKATA')) return CORRIDORS.KOLKATA;
    if (destCity.includes('CHENNAI') || destCity.includes('BENGALURU') || origin.includes('CHENNAI')) return CORRIDORS.CHENNAI;
    if (destCity.includes('DELHI') || destCity.includes('JAIPUR') || origin.includes('DELHI')) return CORRIDORS.DELHI;
    if (destCity.includes('SURAT') || destCity.includes('AHMEDABAD') || origin.includes('GUJARAT')) return CORRIDORS.GUJARAT;

    // Default based on shipment number modulo
    const num = parseInt((shipment.shipment_number || '').replace(/\D/g, ''), 10) || 0;
    const keys = Object.keys(CORRIDORS);
    const selectedKey = keys[num % keys.length];
    return CORRIDORS[selectedKey] || CORRIDORS.PUNE;
  };

  const waypoints = getCorridorWaypoints();

  // Default starting progress index based on shipment status or hash
  const initialIndex = shipment?.status === 'ARRIVED' ? 5 : ((parseInt((shipment?.shipment_number || '').replace(/\D/g, ''), 10) % 4) + 1);

  const [currentStepIndex, setCurrentStepIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<1 | 2 | 5>(1);
  const [mapViewMode, setMapViewMode] = useState<'interactive' | 'satellite' | 'corridor'>('interactive');
  const [syncingWithDb, setSyncingWithDb] = useState(false);

  const googleMapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // When shipment prop changes, reset to the new shipment's waypoint
  useEffect(() => {
    const newIdx = shipment?.status === 'ARRIVED' ? 5 : ((parseInt((shipment?.shipment_number || '').replace(/\D/g, ''), 10) % 4) + 1);
    setCurrentStepIndex(newIdx);
    setIsPlaying(false);
  }, [shipment?.shipment_id, shipment?.shipment_number]);

  const activeWaypoint = waypoints[currentStepIndex] || waypoints[0];
  const progressPercent = activeWaypoint.progress;

  // Google Maps API Loader integration
  useEffect(() => {
    const apiKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY;

    if (apiKey && googleMapRef.current && !mapInstanceRef.current) {
      const loader = new Loader({
        apiKey: apiKey,
        version: 'weekly',
      });

      (loader as any)
        .load()
        .then(() => {
          const google = (window as any).google;
          if (!google) return;

          const map = new google.maps.Map(googleMapRef.current!, {
            center: { lat: activeWaypoint.lat, lng: activeWaypoint.lng },
            zoom: 11,
            mapTypeId: mapViewMode === 'satellite' ? 'hybrid' : 'roadmap',
            disableDefaultUI: false,
          });

          const marker = new google.maps.Marker({
            position: { lat: activeWaypoint.lat, lng: activeWaypoint.lng },
            map: map,
            title: shipment?.shipment_number || 'Carrier Truck',
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 5,
              fillColor: '#2563EB',
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: '#FFFFFF',
              rotation: 90,
            },
          });

          // Draw Route Polyline
          const routePath = new google.maps.Polyline({
            path: waypoints.map((w) => ({ lat: w.lat, lng: w.lng })),
            geodesic: true,
            strokeColor: '#2563EB',
            strokeOpacity: 0.8,
            strokeWeight: 4,
          });
          routePath.setMap(map);

          mapInstanceRef.current = map;
          markerRef.current = marker;
        })
        .catch((err: any) => {
          console.warn('Google Maps API Loader fallback to Embedded Telematics Canvas:', err);
        });
    }
  }, [mapViewMode, shipment?.shipment_id]);

  // Update map marker position when waypoint or shipment changes
  useEffect(() => {
    const google = (window as any).google;
    if (mapInstanceRef.current && markerRef.current && google?.maps) {
      const newPos = { lat: activeWaypoint.lat, lng: activeWaypoint.lng };
      markerRef.current.setPosition(newPos);
      mapInstanceRef.current.panTo(newPos);
    }
    if (onWaypointChange) {
      onWaypointChange(activeWaypoint, progressPercent);
    }
  }, [currentStepIndex, shipment?.shipment_id]);

  // Simulation auto-timer
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        handleStepForward();
      }, 4000 / playSpeed);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, playSpeed, currentStepIndex, waypoints]);

  const handleStepForward = async () => {
    let nextIndex = currentStepIndex + 1;
    if (nextIndex >= waypoints.length) {
      nextIndex = 0; // loop
    }
    setCurrentStepIndex(nextIndex);
    await syncLocationToDatabase(waypoints[nextIndex]);
  };

  const handleReset = () => {
    setCurrentStepIndex(0);
    setIsPlaying(false);
  };

  const syncLocationToDatabase = async (targetWp: Waypoint) => {
    try {
      setSyncingWithDb(true);
      const shipId = shipment?.shipment_id;

      if (shipId) {
        const { data: trucks } = await supabase.from('trucks').select('truck_id').limit(1);
        const truckId = trucks?.[0]?.truck_id || '00000000-0000-4000-8000-000000000001';

        await supabase.from('truck_locations').insert([
          {
            truck_id: truckId,
            shipment_id: shipId,
            location_name: targetWp.name,
            latitude: targetWp.lat,
            longitude: targetWp.lng,
            speed: targetWp.speed,
            status: targetWp.progress >= 100 ? 'ARRIVED_AT_GATE' : 'ON_TIME',
            timestamp: new Date().toISOString(),
          },
        ]);

        if (targetWp.progress >= 100) {
          await supabase
            .from('shipments')
            .update({ status: 'ARRIVED' })
            .eq('shipment_id', shipId);

          addAlert({
            title: `Carrier Arrival: ${shipment?.shipment_number || 'Shipment'}`,
            message: `Truck reached destination gate. Ready for yard check-in.`,
            severity: 'success',
            link: '/yard',
          });
        }
      }
    } catch (err) {
      console.error('Error syncing GPS telemetry:', err);
    } finally {
      setSyncingWithDb(false);
    }
  };

  const googleMapsEmbedUrl = `https://maps.google.com/maps?q=${activeWaypoint.lat},${activeWaypoint.lng}&z=11&output=embed`;
  const originName = waypoints[0]?.name?.split('(')[0] || 'Origin Logistics Hub';
  const destName = waypoints[waypoints.length - 1]?.name?.split('(')[0] || 'Destination DC';

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden ${className}`}>
      {/* Top Header Controls Bar */}
      <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600 text-white shadow-xs">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 leading-none">
                {shipment?.shipment_number || 'Live Highway Corridor GPS'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                Live Tracking Active
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Route: <strong className="text-slate-800">{originName} ➔ {destName}</strong> • Carrier: <strong className="text-blue-600">{shipment?.purchase_orders?.suppliers?.supplier_name || 'National Logistics'}</strong>
            </div>
          </div>
        </div>

        {/* Playback & Manual Override Toolbar (Section 22 of updates3.md) */}
        {canEditLocation() ? (
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1 shadow-2xs">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                isPlaying
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
              <span>{isPlaying ? 'Pause' : 'Gate GPS Override'}</span>
            </button>

            <button
              onClick={handleStepForward}
              className="p-1 rounded hover:bg-slate-100 text-slate-600 text-xs font-semibold px-2 transition-colors cursor-pointer"
              title="Step Next Waypoint"
            >
              Step +1
            </button>

            <button
              onClick={handleReset}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
              title="Reset to Start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-200 mx-1" />

            {/* Speed Selector */}
            <div className="flex items-center text-[10px] font-bold">
              {([1, 2, 5] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setPlaySpeed(s)}
                  className={`px-1.5 py-0.5 rounded transition-colors ${
                    playSpeed === s ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-bold">
            <Radio className="w-3.5 h-3.5 text-cyan-600 animate-pulse" />
            <span>Trusted Telematics (View-Only)</span>
          </div>
        )}
      </div>

      {/* Map Display Container */}
      <div className={`relative ${compact ? 'h-64' : 'h-80 sm:h-96'} w-full bg-slate-950 overflow-hidden`}>
        {/* Real Embedded Google Map for the exact active coordinate */}
        <iframe
          key={`${activeWaypoint.lat}-${activeWaypoint.lng}`}
          title="Google Maps Fleet Track"
          src={googleMapsEmbedUrl}
          className="w-full h-full border-0 opacity-90 filter contrast-105"
          loading="lazy"
        />

        {/* Live GPS Telemetry Floating HUD Overlay */}
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md rounded-xl p-3.5 border border-slate-200/80 shadow-lg text-xs space-y-2.5 max-w-xs z-10">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              Live Telematics HUD
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              {activeWaypoint.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-[10px] uppercase text-slate-400 font-semibold block">Current Speed</span>
              <span className="font-bold text-slate-900 text-xs flex items-center gap-1">
                <Gauge className="w-3 h-3 text-blue-600" />
                {activeWaypoint.speed} km/h
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase text-slate-400 font-semibold block">Cargo Temperature</span>
              <span className="font-bold text-emerald-700 text-xs flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-emerald-600" />
                {activeWaypoint.temp}°C
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase text-slate-400 font-semibold block">Coordinates</span>
              <span className="font-mono text-slate-700 text-[10px]">
                {activeWaypoint.lat.toFixed(4)}, {activeWaypoint.lng.toFixed(4)}
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase text-slate-400 font-semibold block">ETA to DC</span>
              <span className="font-bold text-amber-700 text-xs flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-600" />
                {progressPercent >= 100 ? 'At Facility Gate' : `${Math.round((100 - progressPercent) * 0.8)} mins`}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
            <span className="truncate max-w-[180px]">Location: <strong className="text-slate-800">{activeWaypoint.name}</strong></span>
            {syncingWithDb && <span className="text-blue-600 font-semibold animate-pulse shrink-0">Syncing...</span>}
          </div>
        </div>

        {/* View on Google Maps External Button */}
        <div className="absolute bottom-3 right-3 z-10">
          <a
            href={`https://www.google.com/maps/dir/?api=1&origin=${waypoints[0].lat},${waypoints[0].lng}&destination=${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-md hover:bg-white text-slate-800 font-semibold text-xs border border-slate-200 shadow-md transition-all"
          >
            <span>Open in Google Maps</span>
            <ExternalLink className="w-3 h-3 text-blue-600" />
          </a>
        </div>
      </div>

      {/* Corridor Waypoint Progression Track (Section 18 & 31) */}
      <div className="p-4 bg-slate-50/50 border-t border-slate-200">
        <div className="flex items-center justify-between mb-3 text-xs">
          <div className="font-bold text-slate-900">
            Corridor Progress ({progressPercent}% Completed)
          </div>
          <span className="text-slate-500 font-medium">
            Waypoint {currentStepIndex + 1} of {waypoints.length}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Waypoints Horizontal Track */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {waypoints.map((wp, idx) => {
            const isCurrent = idx === currentStepIndex;
            const isPassed = idx < currentStepIndex;

            return (
              <div
                key={`${wp.name}-${idx}`}
                onClick={() => setCurrentStepIndex(idx)}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                  isCurrent
                    ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-100 shadow-xs'
                    : isPassed
                    ? 'bg-emerald-50/40 border-emerald-200 text-slate-700'
                    : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : isPassed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    W{idx + 1}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">{wp.progress}%</span>
                </div>
                <div className={`text-[11px] font-bold truncate leading-tight ${isCurrent ? 'text-blue-900' : 'text-slate-800'}`}>
                  {wp.name.split('(')[0]}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{wp.speed} km/h</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TruckTrackingMap;
