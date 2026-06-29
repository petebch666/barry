import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { colors } from '@/lib/theme';

interface PingMapProps {
  barycenter: { latitude: number; longitude: number };
  memberLocations: Array<{ id: string; latitude: number; longitude: number }>;
  places: Array<{ id: string; latitude: number; longitude: number; name: string }>;
}

export default function PingMap({ barycenter, memberLocations, places }: PingMapProps) {
  return (
    <View style={styles.wrapper}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: barycenter.latitude,
          longitude: barycenter.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        accessible={false}
      >
        <Marker coordinate={barycenter} title="Meeting point" pinColor="#7C3AED" />
        {memberLocations.map((r) => (
          <Marker
            key={r.id}
            coordinate={{ latitude: r.latitude, longitude: r.longitude }}
            pinColor="#94A3B8"
          />
        ))}
        {places.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            title={p.name}
            pinColor="#F59E0B"
          />
        ))}
        <Circle
          center={barycenter}
          radius={800}
          strokeColor={colors.accent + '30'}
          fillColor={colors.accent + '08'}
        />
      </MapView>
      <View style={styles.label}>
        <Text style={styles.labelText}>⭐ Meeting point</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: 18, overflow: 'hidden', height: 200, position: 'relative' },
  map: { flex: 1 },
  label: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  labelText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
});
