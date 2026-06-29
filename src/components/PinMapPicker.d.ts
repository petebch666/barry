interface Props {
  initialLocation: { latitude: number; longitude: number };
  onLocationChange: (loc: { latitude: number; longitude: number }) => void;
}
declare const PinMapPicker: (props: Props) => JSX.Element | null;
export default PinMapPicker;
