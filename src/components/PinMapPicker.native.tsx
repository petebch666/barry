import { StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { MapErrorBoundary } from './MapErrorBoundary';

interface Props {
  initialLocation: { latitude: number; longitude: number };
  onLocationChange: (loc: { latitude: number; longitude: number }) => void;
}

export default function PinMapPicker({ initialLocation, onLocationChange }: Props) {
  return (
    <MapErrorBoundary>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        accessible={false}
      >
        <Marker
          coordinate={initialLocation}
          draggable
          onDragEnd={(e) => onLocationChange(e.nativeEvent.coordinate)}
          pinColor="#7C3AED"
        />
      </MapView>
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  map: { height: 240, borderRadius: 14, overflow: 'hidden' },
});
