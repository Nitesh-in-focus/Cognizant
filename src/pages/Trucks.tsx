import React, { useEffect, useState } from 'react';
import {
  Radio,
  RefreshCw,
  Search,
  Truck,
  Phone,
  Weight,
  MapPin,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';
import { StatusBadge } from '../components/common/StatusBadge';

export const Trucks: React.FC = () => {
  const { refreshKey, triggerRefresh } = useApp();

  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTrucks();
  }, [refreshKey]);

  const fetchTrucks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trucks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrucks(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTrucks = trucks.filter(
    (t) =>
      !searchQuery ||
      t.vehicle_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.driver_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Radio className="w-5 h-5 text-blue-600" />
            Carrier Fleet & Vehicle Telematics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registered fleet carrier vehicles, assigned driver contacts, gross payload capacities, and yard locations.
          </p>
        </div>

        <button
          onClick={triggerRefresh}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
          title="Refresh Fleet"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vehicle plate number, driver..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 font-medium"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Registered Vehicles: <strong className="text-slate-900">{filteredTrucks.length}</strong>
        </div>
      </div>

      {/* Trucks Table (Sections 24, 25, 26) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Vehicle Number</th>
                <th className="py-3 px-4">Assigned Driver</th>
                <th className="py-3 px-4">Driver Phone</th>
                <th className="py-3 px-4">Payload Capacity</th>
                <th className="py-3 px-4">Operational Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    Loading Fleet...
                  </td>
                </tr>
              ) : filteredTrucks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No vehicles found.
                  </td>
                </tr>
              ) : (
                filteredTrucks.map((truck) => (
                  <tr key={truck.truck_id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-blue-600">
                      {truck.vehicle_number}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {truck.driver_name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{truck.driver_phone}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {truck.capacity ? `${Number(truck.capacity).toLocaleString()} kg` : '2,500 kg'}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={truck.status || 'ACTIVE'} size="sm" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Trucks;
