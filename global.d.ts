/// <reference types="@types/google.maps" />
declare module 'canvas-confetti';

// Google Maps callback
interface Window {
  googleMapsReady?: boolean;
  initGoogleMaps?: () => void;
}

export {}
