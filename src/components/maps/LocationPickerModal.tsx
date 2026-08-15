import React, { useState } from 'react';
import { MapPin, Check, X, Search, Navigation, Compass, Globe } from 'lucide-react';
import { Modal } from '../common/Modal';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAddress?: string;
  initialLat?: number;
  initialLng?: number;
  onConfirm: (data: {
    formatted_address: string;
    latitude: number;
    longitude: number;
    city: string;
    state?: string;
  }) => void;
  title?: string;
}

const PRESET_LOGISTICS_HUBS = [
  { name: 'Mumbai JNPT Port & Freight Terminal', city: 'Mumbai', state: 'Maharashtra', lat: 18.9496, lng: 72.9515, address: 'Navi Mumbai Port SEZ Corridor, Nhava Sheva' },
  { name: 'Pune Chakan Industrial Hub & Auto Zone', city: 'Pune', state: 'Maharashtra', lat: 18.7606, lng: 73.8567, address: 'MIDC Phase II, Chakan Logistics Park, Pune' },
  { name: 'Bengaluru Peenya Central DC & Electronics Park', city: 'Bengaluru', state: 'Karnataka', lat: 13.0285, lng: 77.5194, address: 'Peenya Industrial Estate Phase 1, Tumkur Road' },
  { name: 'Delhi NCR Gurugram Freight Terminal', city: 'Gurugram', state: 'Haryana', lat: 28.4595, lng: 77.0266, address: 'Sector 37 D Pace City II, Gurugram Logistics Hub' },
  { name: 'Chennai Sriperumbudur Component Park', city: 'Chennai', state: 'Tamil Nadu', lat: 12.9698, lng: 79.9405, address: 'SIPCOT Industrial Park, Sriperumbudur' },
  { name: 'Ahmedabad Sanand Engineering Hub', city: 'Ahmedabad', state: 'Gujarat', lat: 22.9868, lng: 72.3813, address: 'GIDC Sanand Industrial Estate, Ahmedabad' },
  { name: 'Hyderabad Shamshabad Cargo Terminal', city: 'Hyderabad', state: 'Telangana', lat: 17.2403, lng: 78.4294, address: 'GMR Aerospace & Logistics Park, Shamshabad' },
];

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  initialAddress = '',
  initialLat = 18.9496,
  initialLng = 72.9515,
  onConfirm,
  title = 'Confirm Facility Location on Google Maps',
}) => {
  const [address, setAddress] = useState(initialAddress || PRESET_LOGISTICS_HUBS[0].address);
  const [city, setCity] = useState(PRESET_LOGISTICS_HUBS[0].city);
  const [stateName, setStateName] = useState(PRESET_LOGISTICS_HUBS[0].state);
  const [latitude, setLatitude] = useState<number>(initialLat || PRESET_LOGISTICS_HUBS[0].lat);
  const [longitude, setLongitude] = useState<number>(initialLng || PRESET_LOGISTICS_HUBS[0].lng);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectPreset = (hub: typeof PRESET_LOGISTICS_HUBS[0]) => {
    setAddress(hub.address);
    setCity(hub.city);
    setStateName(hub.state);
    setLatitude(hub.lat);
    setLongitude(hub.lng);
  };

  const handleApplyCoordinates = () => {
    onConfirm({
      formatted_address: address,
      latitude,
      longitude,
      city,
      state: stateName,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="2xl">
      <div className="space-y-4 text-xs">
        {/* Search / Preset Selector */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1">
            Search Industrial Logistics Zone or Select Preset
          </label>
          <div className="relative mb-2">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search major logistics park, port, or city hub..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-50 border border-slate-200 rounded-lg">
            {PRESET_LOGISTICS_HUBS.filter(h => h.name.toLowerCase().includes(searchQuery.toLowerCase()) || h.city.toLowerCase().includes(searchQuery.toLowerCase())).map((hub) => (
              <button
                key={hub.name}
                type="button"
                onClick={() => handleSelectPreset(hub)}
                className={`p-2 rounded-md text-left transition-all cursor-pointer border ${
                  latitude === hub.lat && longitude === hub.lng
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="font-bold truncate">{hub.city} Hub</div>
                <div className="text-[10px] opacity-80 truncate">{hub.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Map Visualization Preview */}
        <div className="relative h-48 bg-slate-900 rounded-xl overflow-hidden border border-slate-300 flex items-center justify-center text-white shadow-inner">
          <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none" />
          
          <div className="text-center p-4 z-10 space-y-2">
            <div className="w-10 h-10 mx-auto rounded-full bg-blue-500/20 border border-blue-400 flex items-center justify-center text-blue-400 animate-pulse">
              <MapPin className="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <div className="font-bold text-sm text-white">{city} Terminal Point</div>
              <div className="text-xs text-slate-300 max-w-md mx-auto truncate mt-0.5">{address}</div>
              <div className="text-[11px] font-mono text-cyan-400 mt-1">
                GPS: {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E
              </div>
            </div>
          </div>

          <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded bg-black/60 backdrop-blur-md text-[10px] text-slate-300 font-mono flex items-center gap-1.5">
            <Globe className="w-3 h-3 text-blue-400" />
            <span>Map Coordinate Precision: High (±5m)</span>
          </div>
        </div>

        {/* Coordinate & Address Input Controls */}
        <div className="space-y-2.5">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Formatted Physical Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-hidden focus:border-blue-500"
              placeholder="Full street address and industrial zone"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="font-semibold text-slate-700 block mb-0.5">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-0.5">State</label>
              <input
                type="text"
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-0.5">Latitude (°N)</label>
              <input
                type="number"
                step="0.0001"
                value={latitude}
                onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 block mb-0.5">Longitude (°E)</label>
              <input
                type="number"
                step="0.0001"
                value={longitude}
                onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Confirmation Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApplyCoordinates}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20"
          >
            <Check className="w-4 h-4" />
            <span>Confirm & Save Location</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
