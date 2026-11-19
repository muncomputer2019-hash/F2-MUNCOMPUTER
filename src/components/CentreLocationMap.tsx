/// <reference types="google.maps" />
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiIsLoaded,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  CheckCircle2,
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Route as RouteIcon,
  Search,
  Settings,
} from 'lucide-react';
import { formatFullAddress } from '../config/businessConfig';
import { useAuth } from '../context/AuthContext';
import { useWebsiteSettings } from '../context/WebsiteSettingsContext';
import { getShopMapsUrl, parseLatLngFromInput } from '../services/publicData';
import { saveWebsiteSettingsToFirestore } from '../services/websiteSettingsService';

declare const __GOOGLE_MAPS_API_KEY__: string | undefined;

const GOOGLE_MAPS_API_KEY =
  (typeof globalThis !== 'undefined' &&
    (globalThis as { GOOGLE_MAPS_API_KEY?: string }).GOOGLE_MAPS_API_KEY) ||
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  (typeof __GOOGLE_MAPS_API_KEY__ !== 'undefined' ? __GOOGLE_MAPS_API_KEY__ : '') ||
  '';

const ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];

type TravelModeOption = 'DRIVING' | 'WALKING' | 'TWO_WHEELER';

interface RouteSummary {
  distanceMeters: number;
  durationMillis: number;
}

interface SearchRequest {
  query: string;
  nonce: number;
}

function isQuotaError(err: unknown): boolean {
  const str = String(err || '').toUpperCase();
  return (
    str.includes('RESOURCE_EXHAUSTED') ||
    str.includes('OVER_QUERY_LIMIT') ||
    str.includes('OVERQUOTA') ||
    str.includes('QUOTAEXCEEDED') ||
    str.includes('429')
  );
}

interface InnerMapContentProps {
  businessName: string;
  officialAddress: string;
  savedCoords: google.maps.LatLngLiteral | null;
  draftPinCoords: google.maps.LatLngLiteral | null;
  draftZoomRequest: { coords: google.maps.LatLngLiteral; nonce: number } | null;
  adminSearchRequest: SearchRequest | null;
  originSearchRequest: SearchRequest | null;
  isAdmin: boolean;
  userGps: google.maps.LatLngLiteral | null;
  userOriginLabel: string;
  travelMode: TravelModeOption;
  onCentreResolved: (coords: google.maps.LatLngLiteral | null, formattedAddress: string) => void;
  onAdminPinMoved: (coords: google.maps.LatLngLiteral, statusNote?: string) => void;
  onAdminSearchError: (msg: string | null) => void;
  onOriginResolved: (coords: google.maps.LatLngLiteral, label: string) => void;
  onOriginSearchError: (msg: string | null) => void;
  onRouteComputed: (summary: RouteSummary | null, errorMsg: string | null) => void;
}

const InnerMapContent: React.FC<InnerMapContentProps> = ({
  businessName,
  officialAddress,
  savedCoords,
  draftPinCoords,
  draftZoomRequest,
  adminSearchRequest,
  originSearchRequest,
  isAdmin,
  userGps,
  userOriginLabel,
  travelMode,
  onCentreResolved,
  onAdminPinMoved,
  onAdminSearchError,
  onOriginResolved,
  onOriginSearchError,
  onRouteComputed,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');

  const [centreCoords, setCentreCoords] = useState<google.maps.LatLngLiteral | null>(
    draftPinCoords || savedCoords
  );
  const [resolvedAddress, setResolvedAddress] = useState<string>(officialAddress);
  const [infoOpen, setInfoOpen] = useState(true);
  const [markerRef, marker] = useAdvancedMarkerRef();
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const lastSavedKeyRef = useRef<string>('');

  // Keep draft pin synced without jarring zoom resets while Admin drags or clicks
  useEffect(() => {
    if (draftPinCoords) {
      setCentreCoords(draftPinCoords);
      setResolvedAddress(officialAddress);
      setInfoOpen(true);
    }
  }, [draftPinCoords, officialAddress]);

  // Recenter/zoom when Admin jumps explicitly via pasted coordinates/URL
  useEffect(() => {
    if (!map || !draftZoomRequest) return;
    map.panTo(draftZoomRequest.coords);
    map.setZoom(18);
  }, [map, draftZoomRequest]);

  // Use Admin-saved GPS coordinates directly when available; otherwise fallback to Places search
  useEffect(() => {
    if (!map || draftPinCoords) return;

    if (savedCoords) {
      const savedKey = `${savedCoords.lat},${savedCoords.lng},${officialAddress}`;
      setCentreCoords(savedCoords);
      setResolvedAddress(officialAddress);
      setInfoOpen(true);
      onCentreResolved(savedCoords, officialAddress);
      if (lastSavedKeyRef.current !== savedKey) {
        lastSavedKeyRef.current = savedKey;
        map.setCenter(savedCoords);
        map.setZoom(17);
      }
      return;
    }

    if (!placesLib) return;
    let cancelled = false;

    const locateCentre = async () => {
      try {
        const PlaceClass = placesLib.Place as unknown as {
          searchByText: (req: {
            textQuery: string;
            fields: string[];
            region?: string;
            maxResultCount?: number;
          }) => Promise<{ places?: google.maps.places.Place[] }>;
        };

        let response = await PlaceClass.searchByText({
          textQuery: `${businessName}, ${officialAddress}`,
          fields: ['id', 'displayName', 'formattedAddress', 'location', 'viewport'],
          region: 'IN',
          maxResultCount: 1,
        });

        if (!response?.places?.length) {
          response = await PlaceClass.searchByText({
            textQuery: officialAddress,
            fields: ['id', 'displayName', 'formattedAddress', 'location', 'viewport'],
            region: 'IN',
            maxResultCount: 1,
          });
        }

        if (cancelled) return;
        const firstPlace = response?.places?.[0];
        if (!firstPlace?.location) return;

        const loc = firstPlace.location;
        const coords: google.maps.LatLngLiteral = {
          lat: typeof loc.lat === 'function' ? loc.lat() : (loc as unknown as { lat: number }).lat,
          lng: typeof loc.lng === 'function' ? loc.lng() : (loc as unknown as { lng: number }).lng,
        };

        const formatted = officialAddress || firstPlace.formattedAddress || '';
        setCentreCoords(coords);
        setResolvedAddress(formatted);
        onCentreResolved(coords, formatted);

        if (firstPlace.viewport) {
          map.fitBounds(firstPlace.viewport);
        } else {
          map.setCenter(coords);
          map.setZoom(16);
        }
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onCentreResolved(null, officialAddress);
      }
    };

    void locateCentre();
    return () => {
      cancelled = true;
    };
  }, [placesLib, map, businessName, officialAddress, savedCoords, draftPinCoords, onCentreResolved]);

  // Admin locality/place search to move map to shop area for click/drag placement
  useEffect(() => {
    if (!map || !placesLib || !adminSearchRequest) return;
    let cancelled = false;

    const jumpToPlace = async () => {
      try {
        onAdminSearchError(null);
        const PlaceClass = placesLib.Place as unknown as {
          searchByText: (req: {
            textQuery: string;
            fields: string[];
            region?: string;
            maxResultCount?: number;
          }) => Promise<{ places?: google.maps.places.Place[] }>;
        };

        const response = await PlaceClass.searchByText({
          textQuery: adminSearchRequest.query,
          fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
          region: 'IN',
          maxResultCount: 1,
        });

        if (cancelled) return;
        const firstPlace = response?.places?.[0];
        if (!firstPlace?.location) {
          onAdminSearchError(
            'Area not found. Try a nearby chowmatha/village name (e.g. "Mamudpur, Domkal") or paste coordinates.'
          );
          return;
        }

        const loc = firstPlace.location;
        const coords: google.maps.LatLngLiteral = {
          lat: Number(
            (typeof loc.lat === 'function' ? loc.lat() : (loc as unknown as { lat: number }).lat).toFixed(7)
          ),
          lng: Number(
            (typeof loc.lng === 'function' ? loc.lng() : (loc as unknown as { lng: number }).lng).toFixed(7)
          ),
        };

        map.setCenter(coords);
        map.setZoom(18);
        onAdminPinMoved(
          coords,
          `Jumped near "${firstPlace.displayName || firstPlace.formattedAddress || adminSearchRequest.query}". Switch to Satellite view and click/drag the blue pin directly onto your shop before saving.`
        );
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        if (!cancelled) {
          onAdminSearchError('Unable to look up that locality right now. Click/drag directly on the map.');
        }
      }
    };

    void jumpToPlace();
    return () => {
      cancelled = true;
    };
  }, [map, placesLib, adminSearchRequest, onAdminPinMoved, onAdminSearchError]);

  // Public visitor starting-point search (works even when browser GPS permission is blocked)
  useEffect(() => {
    if (!placesLib || !originSearchRequest) return;
    let cancelled = false;

    const findOrigin = async () => {
      try {
        onOriginSearchError(null);
        const parsedDirect = parseLatLngFromInput(originSearchRequest.query);
        if (parsedDirect) {
          onOriginResolved(parsedDirect, `${parsedDirect.lat.toFixed(4)}, ${parsedDirect.lng.toFixed(4)}`);
          return;
        }

        const PlaceClass = placesLib.Place as unknown as {
          searchByText: (req: {
            textQuery: string;
            fields: string[];
            region?: string;
            maxResultCount?: number;
          }) => Promise<{ places?: google.maps.places.Place[] }>;
        };

        const queryWithRegion = /west bengal|murshidabad|india/i.test(originSearchRequest.query)
          ? originSearchRequest.query
          : `${originSearchRequest.query}, Murshidabad, West Bengal`;

        let response = await PlaceClass.searchByText({
          textQuery: queryWithRegion,
          fields: ['displayName', 'formattedAddress', 'location'],
          region: 'IN',
          maxResultCount: 1,
        });

        if (!response?.places?.length) {
          response = await PlaceClass.searchByText({
            textQuery: originSearchRequest.query,
            fields: ['displayName', 'formattedAddress', 'location'],
            region: 'IN',
            maxResultCount: 1,
          });
        }

        if (cancelled) return;
        const firstPlace = response?.places?.[0];
        if (!firstPlace?.location) {
          onOriginSearchError(
            'Starting place not found. Try a nearby village, bazaar, or town name (e.g. Domkal, Islampur, Juginda).'
          );
          return;
        }

        const loc = firstPlace.location;
        const coords: google.maps.LatLngLiteral = {
          lat: typeof loc.lat === 'function' ? loc.lat() : (loc as unknown as { lat: number }).lat,
          lng: typeof loc.lng === 'function' ? loc.lng() : (loc as unknown as { lng: number }).lng,
        };
        onOriginResolved(
          coords,
          firstPlace.displayName || firstPlace.formattedAddress || originSearchRequest.query
        );
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        if (!cancelled) {
          onOriginSearchError(
            'Could not find that starting place right now. Try Open in Google Maps below.'
          );
        }
      }
    };

    void findOrigin();
    return () => {
      cancelled = true;
    };
  }, [placesLib, originSearchRequest, onOriginResolved, onOriginSearchError]);

  // Compute route when visitor provides GPS OR starting town
  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!routesLib || !map || !userGps || !centreCoords) {
      return;
    }

    let cancelled = false;

    const calculateRoute = async () => {
      try {
        const RouteClass = routesLib.Route as unknown as {
          computeRoutes: (req: {
            origin: google.maps.LatLngLiteral;
            destination: google.maps.LatLngLiteral;
            travelMode: TravelModeOption;
            fields: string[];
          }) => Promise<{
            routes?: Array<{
              distanceMeters?: number;
              durationMillis?: number;
              viewport?: google.maps.LatLngBounds;
              createPolylines?: () => google.maps.Polyline[];
            }>;
          }>;
        };

        const response = await RouteClass.computeRoutes({
          origin: userGps,
          destination: centreCoords,
          travelMode,
          fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
        });

        if (cancelled) return;

        const primaryRoute = response?.routes?.[0];
        if (!primaryRoute) {
          onRouteComputed(null, 'No road route could be calculated from that starting location.');
          return;
        }

        if (typeof primaryRoute.createPolylines === 'function') {
          const newPolylines = primaryRoute.createPolylines();
          newPolylines.forEach((polyline) => {
            polyline.setOptions({
              strokeColor: '#1e40af',
              strokeWeight: 5,
            });
            polyline.setMap(map);
          });
          polylinesRef.current = newPolylines;
        }

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport);
        }

        onRouteComputed(
          {
            distanceMeters: primaryRoute.distanceMeters ?? 0,
            durationMillis: primaryRoute.durationMillis ?? 0,
          },
          null
        );
      } catch (err) {
        if (isQuotaError(err)) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onRouteComputed(
          null,
          'Unable to calculate route automatically. Use the Google Maps directions link below.'
        );
      }
    };

    void calculateRoute();

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, userGps, centreCoords, travelMode, onRouteComputed]);

  return (
    <>
      {centreCoords && (
        <>
          <AdvancedMarker
            ref={markerRef}
            position={centreCoords}
            title={
              isAdmin ? `${businessName} (Click map or drag pin to exact shop spot)` : businessName
            }
            draggable={isAdmin}
            onClick={() => setInfoOpen(true)}
            onDragEnd={(e) => {
              if (!isAdmin || !e.latLng) return;
              onAdminPinMoved({
                lat: Number(e.latLng.lat().toFixed(7)),
                lng: Number(e.latLng.lng().toFixed(7)),
              });
            }}
          >
            <Pin background="#1e40af" borderColor="#1e3a8a" glyphColor="#ffffff" scale={1.15} />
          </AdvancedMarker>

          {infoOpen && marker && (
            <InfoWindow anchor={marker} maxWidth={270} onCloseClick={() => setInfoOpen(false)}>
              <div className="space-y-1 text-slate-900 p-0.5">
                <p className="font-bold text-xs">{businessName}</p>
                <p className="text-[11px] text-slate-600 leading-snug">{resolvedAddress}</p>
                {isAdmin && (
                  <p className="text-[10px] font-medium text-emerald-700 pt-0.5">
                    Admin: Drag pin or click anywhere on map to adjust shop spot
                  </p>
                )}
              </div>
            </InfoWindow>
          )}
        </>
      )}

      {userGps && (
        <AdvancedMarker position={userGps} title={userOriginLabel || 'Your Starting Location'}>
          <Pin background="#047857" borderColor="#064e3b" glyphColor="#ffffff" scale={1.0} />
        </AdvancedMarker>
      )}
    </>
  );
};

const MapStatusOverlay: React.FC = () => {
  const isLoaded = useApiIsLoaded();
  const status = useApiLoadingStatus();

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="absolute inset-0 bg-slate-50/95 flex items-center justify-center p-6 text-center">
        <div className="max-w-sm space-y-2">
          <MapPin className="w-6 h-6 text-blue-800 mx-auto" />
          <p className="text-sm font-semibold text-slate-900">
            Interactive map unavailable right now
          </p>
          <p className="text-xs text-slate-600">
            Please use the direct Google Maps GPS Directions button below to navigate to MUN
            COMPUTER.
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="absolute inset-0 bg-slate-50 flex items-center justify-center text-xs text-slate-500">
        Loading Google Maps GPS view...
      </div>
    );
  }

  return null;
};

export const CentreLocationMap: React.FC = () => {
  const { settings } = useWebsiteSettings();
  const { isAdmin, firebaseUser } = useAuth();
  const businessName = settings.businessName || 'MUN COMPUTER';
  const officialAddress = formatFullAddress(settings);

  const isInsideIframe = useMemo(() => {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const currentPageHref = typeof window !== 'undefined' ? window.location.href : '/';

  const savedCoords = useMemo<google.maps.LatLngLiteral | null>(() => {
    if (
      typeof settings.shopLat === 'number' &&
      typeof settings.shopLng === 'number' &&
      Number.isFinite(settings.shopLat) &&
      Number.isFinite(settings.shopLng)
    ) {
      return { lat: settings.shopLat, lng: settings.shopLng };
    }
    return null;
  }, [settings.shopLat, settings.shopLng]);

  const [centreCoords, setCentreCoords] = useState<google.maps.LatLngLiteral | null>(savedCoords);
  const [resolvedAddress, setResolvedAddress] = useState<string>(officialAddress);
  const [userGps, setUserGps] = useState<google.maps.LatLngLiteral | null>(null);
  const [userOriginLabel, setUserOriginLabel] = useState<string>('');
  const [originInput, setOriginInput] = useState<string>('');
  const [originSearchRequest, setOriginSearchRequest] = useState<SearchRequest | null>(null);
  const [travelMode, setTravelMode] = useState<TravelModeOption>('DRIVING');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsPermissionBlocked, setGpsPermissionBlocked] = useState(false);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Admin quick live GPS, search/URL jump & click/drag states
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminStatusMsg, setAdminStatusMsg] = useState<string | null>(null);
  const [adminErrorMsg, setAdminErrorMsg] = useState<string | null>(null);
  const [adminGpsDenied, setAdminGpsDenied] = useState(false);
  const [adminDraggedCoords, setAdminDraggedCoords] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [draftZoomRequest, setDraftZoomRequest] = useState<{
    coords: google.maps.LatLngLiteral;
    nonce: number;
  } | null>(null);
  const [adminPlaceInput, setAdminPlaceInput] = useState<string>('');
  const [adminSearchRequest, setAdminSearchRequest] = useState<SearchRequest | null>(null);

  useEffect(() => {
    setResolvedAddress(officialAddress);
    if (savedCoords) {
      setCentreCoords(savedCoords);
    }
  }, [officialAddress, savedCoords]);

  const handleCentreResolved = useCallback(
    (coords: google.maps.LatLngLiteral | null, formatted: string) => {
      if (coords) setCentreCoords(coords);
      if (formatted) setResolvedAddress(formatted);
    },
    []
  );

  const handleRouteComputed = useCallback(
    (summary: RouteSummary | null, errMsg: string | null) => {
      setRouteSummary(summary);
      setRouteError(errMsg);
    },
    []
  );

  const handleAdminPinMoved = useCallback(
    (coords: google.maps.LatLngLiteral, statusNote?: string) => {
      setAdminDraggedCoords(coords);
      setAdminStatusMsg(statusNote || null);
      setAdminErrorMsg(null);
      setAdminGpsDenied(false);
    },
    []
  );

  const handleAdminSearchError = useCallback((msg: string | null) => {
    setAdminErrorMsg(msg);
  }, []);

  const handleOriginResolved = useCallback(
    (coords: google.maps.LatLngLiteral, label: string) => {
      setUserGps(coords);
      setUserOriginLabel(label);
      setGpsError(null);
      setGpsPermissionBlocked(false);
      setRouteError(null);
    },
    []
  );

  const handleOriginSearchError = useCallback((msg: string | null) => {
    if (msg) {
      setGpsError(msg);
    }
  }, []);

  const handleLocateUserGps = () => {
    setGpsError(null);
    setGpsPermissionBlocked(false);
    setRouteError(null);

    if (!('geolocation' in navigator)) {
      setGpsError('GPS geolocation is not supported on this browser. Enter your starting village below instead.');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setUserOriginLabel('Your GPS Location');
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsPermissionBlocked(true);
          setGpsError(
            isInsideIframe
              ? 'Browser preview blocked automatic GPS access. Enter your village/town below to preview your route, or open this page in a new tab / Google Maps.'
              : 'Location access was denied by browser settings. Enter your village/town below to preview your route, or use Open in Google Maps.'
          );
        } else {
          setGpsError('Unable to detect your GPS location right now. Type your starting village/town below instead.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleSearchVisitorOrigin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = originInput.trim();
    if (!trimmed) return;
    setGpsError(null);
    setGpsPermissionBlocked(false);
    setRouteError(null);
    setOriginSearchRequest({ query: trimmed, nonce: Date.now() });
  };

  const handleAdminJumpOrPaste = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = adminPlaceInput.trim();
    if (!trimmed) return;
    setAdminErrorMsg(null);
    setAdminStatusMsg(null);
    setAdminGpsDenied(false);

    const parsed = parseLatLngFromInput(trimmed);
    if (parsed) {
      setAdminDraggedCoords(parsed);
      setDraftZoomRequest({ coords: parsed, nonce: Date.now() });
      setAdminStatusMsg(
        `Pin moved to ${parsed.lat.toFixed(6)}, ${parsed.lng.toFixed(6)}. Click "Save Selected Pin" to lock it permanently.`
      );
      return;
    }

    setAdminSearchRequest({ query: trimmed, nonce: Date.now() });
  };

  const handleAdminCaptureLiveShopGps = () => {
    if (!isAdmin || !firebaseUser) return;
    setAdminErrorMsg(null);
    setAdminStatusMsg(null);
    setAdminGpsDenied(false);

    if (!('geolocation' in navigator)) {
      setAdminErrorMsg(
        'Browser GPS geolocation is not supported here. Switch map to Satellite and click your shop roof directly.'
      );
      return;
    }

    setAdminSaving(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(7));
        const lng = Number(pos.coords.longitude.toFixed(7));
        const accuracyMeters = Math.round(pos.coords.accuracy || 0);
        try {
          await saveWebsiteSettingsToFirestore(
            { ...settings, shopLat: lat, shopLng: lng },
            firebaseUser.uid,
            'UPDATE_SHOP_GPS_LOCATION',
            `Captured live GPS from map card (${lat}, ${lng})`
          );
          setAdminDraggedCoords(null);
          setAdminStatusMsg(
            `Permanent shop GPS saved (${lat.toFixed(6)}, ${lng.toFixed(6)}${
              accuracyMeters > 0 ? `, accuracy ±${accuracyMeters}m` : ''
            }). Visitors now get directions directly here.`
          );
        } catch (err) {
          setAdminErrorMsg(
            err instanceof Error ? err.message : 'Unable to save shop GPS location.'
          );
        } finally {
          setAdminSaving(false);
        }
      },
      (err) => {
        setAdminSaving(false);
        if (err.code === err.PERMISSION_DENIED) {
          setAdminGpsDenied(true);
          setAdminErrorMsg(
            isInsideIframe
              ? 'Preview window blocked live GPS permission. Either click "Open Full Page in New Tab" on your phone at the shop, OR paste a Google Maps link / click directly on the Satellite map below.'
              : 'Location permission denied in browser settings. Enable location permission, OR paste a Google Maps link / click directly on the Satellite map below.'
          );
        } else {
          setAdminErrorMsg(
            'Could not get high-accuracy GPS fix. Paste a Google Maps link or click/drag the blue pin directly onto your shop.'
          );
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const handleSaveDraggedPin = async () => {
    if (!isAdmin || !firebaseUser || !adminDraggedCoords) return;
    setAdminErrorMsg(null);
    setAdminStatusMsg(null);
    setAdminGpsDenied(false);
    setAdminSaving(true);
    try {
      await saveWebsiteSettingsToFirestore(
        {
          ...settings,
          shopLat: adminDraggedCoords.lat,
          shopLng: adminDraggedCoords.lng,
        },
        firebaseUser.uid,
        'UPDATE_SHOP_GPS_LOCATION',
        `Saved adjusted map pin (${adminDraggedCoords.lat}, ${adminDraggedCoords.lng})`
      );
      setAdminStatusMsg(
        `Permanent shop pin saved at ${adminDraggedCoords.lat.toFixed(6)}, ${adminDraggedCoords.lng.toFixed(6)}.`
      );
      setAdminDraggedCoords(null);
    } catch (err) {
      setAdminErrorMsg(err instanceof Error ? err.message : 'Failed to save adjusted pin.');
    } finally {
      setAdminSaving(false);
    }
  };

  const activeCoords = adminDraggedCoords || savedCoords || centreCoords;
  const directionsQuery = activeCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${activeCoords.lat},${activeCoords.lng}`
    : getShopMapsUrl(settings);

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-blue-800">
              <MapPin className="w-4 h-4" />
              <span>GPS Centre Locator</span>
              {savedCoords && (
                <span className="font-mono-tabular text-[11px] text-emerald-700 font-semibold">
                  · Exact Shop Pin ({savedCoords.lat.toFixed(5)}, {savedCoords.lng.toFixed(5)})
                </span>
              )}
            </div>
            <h3 className="font-display text-lg font-bold text-slate-950">
              {businessName} — Location &amp; GPS Directions
            </h3>
            <p className="text-xs text-slate-600">{resolvedAddress || officialAddress}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleLocateUserGps}
              disabled={gpsLoading || !GOOGLE_MAPS_API_KEY}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              {gpsLoading ? 'Detecting GPS...' : 'Use My GPS & Show Route'}
            </button>

            <a
              href={directionsQuery}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <Navigation className="w-3.5 h-3.5 text-blue-800" />
              Open in Google Maps
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Starting Village/Place Route Input (Always works even if browser GPS is blocked) */}
        {GOOGLE_MAPS_API_KEY && (
          <form
            onSubmit={handleSearchVisitorOrigin}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={originInput}
                onChange={(e) => setOriginInput(e.target.value)}
                placeholder="Or enter your village / town to show road route (e.g., Domkal, Juginda, Islampur)"
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
              />
            </div>
            <button
              type="submit"
              disabled={!originInput.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-900 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RouteIcon className="w-3.5 h-3.5" />
              <span>Show Route From Here</span>
            </button>
          </form>
        )}
      </div>

      {/* Admin-Only Live Shop GPS Capture, Link Paste, Search & Click/Drag Pin Fine-Tuning Toolbar */}
      {isAdmin && (
        <div className="px-5 py-3.5 bg-emerald-50/80 border-b border-emerald-200 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="font-bold text-emerald-950">
                Admin Location Control: Set Permanent Live Shop Pin
              </p>
              <p className="text-emerald-800">
                Switch map to <strong>Satellite</strong> and click anywhere on your shop roof, drag
                the blue pin, paste a Google Maps link, or capture live GPS.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAdminCaptureLiveShopGps}
                disabled={adminSaving}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                {adminSaving ? 'Saving Live GPS...' : 'Save My Present Live GPS Here'}
              </button>

              {adminDraggedCoords && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleSaveDraggedPin()}
                    disabled={adminSaving}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Save Selected Pin ({adminDraggedCoords.lat.toFixed(5)},{' '}
                    {adminDraggedCoords.lng.toFixed(5)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminDraggedCoords(null)}
                    className="px-2.5 py-2 font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                </>
              )}

              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 px-3 py-2 font-semibold text-emerald-950 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap"
              >
                <Settings className="w-3.5 h-3.5" />
                Edit Address
              </Link>
            </div>
          </div>

          <form
            onSubmit={handleAdminJumpOrPaste}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
          >
            <input
              type="text"
              value={adminPlaceInput}
              onChange={(e) => setAdminPlaceInput(e.target.value)}
              placeholder='Paste Google Maps URL or "24.1385, 88.5321" OR search landmark (e.g. Mamudpur, Domkal)'
              className="flex-1 px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
            <button
              type="submit"
              disabled={!adminPlaceInput.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 font-semibold text-emerald-950 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Move Pin / Jump Map</span>
            </button>
          </form>

          {adminStatusMsg && (
            <p className="font-semibold text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{adminStatusMsg}</span>
            </p>
          )}
          {adminErrorMsg && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 space-y-1.5">
              <p className="font-semibold">{adminErrorMsg}</p>
              {adminGpsDenied && isInsideIframe && (
                <a
                  href={currentPageHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-800 rounded-md hover:bg-blue-900"
                >
                  <span>Open Full Page in New Tab (for Live GPS)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {(userGps || gpsError || routeError || routeSummary) && (
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {userGps && (
              <>
                <span className="font-medium text-slate-700 mr-1">
                  {userOriginLabel ? `From ${userOriginLabel} ·` : ''} Mode:
                </span>
                {(['DRIVING', 'TWO_WHEELER', 'WALKING'] as TravelModeOption[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTravelMode(mode)}
                    className={`px-2.5 py-1 rounded-md border cursor-pointer transition-colors ${
                      travelMode === mode
                        ? 'bg-slate-950 text-white border-slate-950'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {mode === 'TWO_WHEELER'
                      ? 'Bike'
                      : mode === 'DRIVING'
                        ? 'Car'
                        : 'Walk'}
                  </button>
                ))}
              </>
            )}
          </div>

          {routeSummary && (
            <div className="flex items-center gap-4 font-medium text-slate-900">
              <span className="inline-flex items-center gap-1.5">
                <RouteIcon className="w-3.5 h-3.5 text-blue-800" />
                Distance:{' '}
                <strong className="font-mono-tabular">
                  {(routeSummary.distanceMeters / 1000).toFixed(2)} km
                </strong>
              </span>
              <span>
                Est. Travel Time:{' '}
                <strong className="font-mono-tabular">
                  {Math.max(1, Math.round(routeSummary.durationMillis / 60000))} mins
                </strong>
              </span>
            </div>
          )}

          {(gpsError || routeError) && (
            <div className="flex flex-wrap items-center gap-2.5 text-red-700 font-medium">
              <span>{gpsError || routeError}</span>
              {gpsPermissionBlocked && isInsideIframe && (
                <a
                  href={currentPageHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-900 bg-white border border-blue-200 rounded-md hover:bg-blue-50 whitespace-nowrap"
                >
                  <span>Open Full Page for GPS</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>
      )}

      <div className="relative w-full h-[360px] sm:h-[420px] bg-slate-100">
        {GOOGLE_MAPS_API_KEY ? (
          <APIProvider
            apiKey={GOOGLE_MAPS_API_KEY}
            libraries={['places', 'marker', 'routes']}
            language="en"
            region="IN"
          >
            <GoogleMap
              mapId="DEMO_MAP_ID"
              defaultCenter={savedCoords || { lat: 0, lng: 0 }}
              defaultZoom={savedCoords ? 17 : 2}
              gestureHandling="cooperative"
              streetViewControl={false}
              mapTypeControl={true}
              internalUsageAttributionIds={ATTRIBUTION_IDS}
              style={{ width: '100%', height: '100%' }}
              onClick={(e) => {
                if (!isAdmin || !e.detail.latLng) return;
                handleAdminPinMoved(
                  {
                    lat: Number(e.detail.latLng.lat.toFixed(7)),
                    lng: Number(e.detail.latLng.lng.toFixed(7)),
                  },
                  'Selected new shop spot on map. Click "Save Selected Pin" above to publish permanently.'
                );
              }}
            >
              <InnerMapContent
                businessName={businessName}
                officialAddress={officialAddress}
                savedCoords={savedCoords}
                draftPinCoords={adminDraggedCoords}
                draftZoomRequest={draftZoomRequest}
                adminSearchRequest={adminSearchRequest}
                originSearchRequest={originSearchRequest}
                isAdmin={isAdmin}
                userGps={userGps}
                userOriginLabel={userOriginLabel}
                travelMode={travelMode}
                onCentreResolved={handleCentreResolved}
                onAdminPinMoved={handleAdminPinMoved}
                onAdminSearchError={handleAdminSearchError}
                onOriginResolved={handleOriginResolved}
                onOriginSearchError={handleOriginSearchError}
                onRouteComputed={handleRouteComputed}
              />
            </GoogleMap>
            <MapStatusOverlay />
          </APIProvider>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-50">
            <MapPin className="w-7 h-7 text-blue-800" />
            <div className="space-y-1 max-w-md">
              <p className="text-sm font-semibold text-slate-950">{businessName}</p>
              <p className="text-xs text-slate-600">{officialAddress}</p>
            </div>
            <a
              href={directionsQuery}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-800 rounded-lg hover:bg-blue-900"
            >
              <Navigation className="w-3.5 h-3.5" />
              Open GPS Directions in Google Maps
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
