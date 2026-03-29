import React from 'react';
import { GoogleMap, useJsApiLoader, DrawingManager, Polygon } from '@react-google-maps/api';

// Interfaces para exportação
export interface Coordinate {
    lat: number;
    lng: number;
}

export interface DeliveryZone {
    id: string;
    name: string;
    fee: number;
    minOrder: number;
    color: string;
    coordinates?: Coordinate[];
}

const mapContainerStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '0.75rem'
};

const center = { lat: -22.9519, lng: -46.5419 }; // Bragança Paulista
const libraries: ("drawing" | "geometry" | "places")[] = ['drawing'];

export const DeliveryMap: React.FC<{
    zones: DeliveryZone[];
    onPolygonComplete: (polygon: google.maps.Polygon) => void;
}> = ({ zones, onPolygonComplete }) => {

    // Puxa a chave do arquivo .env (Precisa ter o prefixo VITE_)
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
        libraries: libraries
    });

    // Caso a chave esteja errada ou as APIs não estejam ativas no Google Cloud
    if (loadError) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-red-900/20 text-red-500 rounded-xl border border-red-900/50 p-4 text-center">
                Erro ao carregar o Google Maps. <br /> Verifique a chave e o faturamento no console do Google.
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500 rounded-xl">
                <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span>Carregando mapa...</span>
                </div>
            </div>
        );
    }

    return (
        <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={13}
            options={{
                disableDefaultUI: false,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
            }}
        >
            {/* O DrawingManager só aparece se o objeto window.google existir */}
            {window.google && (
                <DrawingManager
                    onPolygonComplete={onPolygonComplete}
                    options={{
                        drawingControl: true,
                        drawingControlOptions: {
                            position: window.google.maps.ControlPosition.TOP_CENTER,
                            drawingModes: [window.google.maps.drawing.OverlayType.POLYGON],
                        },
                        polygonOptions: {
                            fillColor: '#10b981',
                            fillOpacity: 0.4,
                            strokeWeight: 2,
                            strokeColor: '#10b981',
                            clickable: true,
                            editable: true,
                            zIndex: 1,
                        },
                    }}
                />
            )}

            {/* Renderiza as zonas que já estão salvas no banco */}
            {zones.map(zone => (
                zone.coordinates && zone.coordinates.length > 0 && (
                    <Polygon
                        key={zone.id}
                        paths={zone.coordinates}
                        options={{
                            fillColor: zone.color,
                            fillOpacity: 0.4,
                            strokeColor: zone.color,
                            strokeWeight: 2,
                        }}
                    />
                )
            ))}
        </GoogleMap>
    );
};