import type React from 'react';

export interface PingMapProps {
  barycenter: { latitude: number; longitude: number };
  memberLocations: Array<{ id: string; latitude: number; longitude: number }>;
  places: Array<{ id: string; latitude: number; longitude: number; name: string }>;
}

declare const PingMap: React.ComponentType<PingMapProps>;
export default PingMap;
