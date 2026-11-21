import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import { RESTAURANT_LOCATION } from './restaurantConfig'

const customerIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const restaurantIcon = L.divIcon({
  className: '',
  html: '<div style="font-size:30px;line-height:30px;text-align:center">🍃</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 28],
})

type Point = [number, number]

function parseCoordinates(value: unknown): Point | null {
  let data: unknown = value
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return null
    }
  }
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  const lat = Number(record.latitude)
  const lng = Number(record.longitude)
  if (
    record.latitude == null || record.longitude == null ||
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180
  ) {
    return null
  }
  return [lat, lng]
}

export default function DeliveryRouteMap({ address }: { address: unknown }) {
  const customer = useMemo(() => parseCoordinates(address), [address])
  const restaurant: Point = [RESTAURANT_LOCATION.latitude, RESTAURANT_LOCATION.longitude]
  const [route, setRoute] = useState<Point[]>([])
  const [info, setInfo] = useState<{ km: number; minutes: number } | null>(null)
  const [routeError, setRouteError] = useState('')

  useEffect(() => {
    setRoute([])
    setInfo(null)
    setRouteError('')
    if (!customer) return

    const controller = new AbortController()
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${restaurant[1]},${restaurant[0]};${customer[1]},${customer[0]}` +
      `?overview=full&geometries=geojson`

    fetch(url, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Dịch vụ đường đi không phản hồi'))))
      .then((body) => {
        const best = body?.routes?.[0]
        if (body?.code !== 'Ok' || !best) throw new Error('Không tìm thấy đường đi')
        setRoute((best.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]))
        setInfo({ km: best.distance / 1000, minutes: best.duration / 60 })
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setRouteError('Chưa vẽ được đường đi (hiển thị đường thẳng). Vẫn có thể mở Google Maps.')
        }
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer])

  if (!customer) {
    return (
      <p className="delivery-muted">
        Đơn này chưa có toạ độ giao hàng (khách chưa ghim vị trí trên bản đồ), nên chưa vẽ được đường đi.
      </p>
    )
  }

  const googleUrl =
    `https://www.google.com/maps/dir/?api=1&origin=${restaurant[0]},${restaurant[1]}` +
    `&destination=${customer[0]},${customer[1]}&travelmode=driving`

  return (
    <>
      <div style={{ height: 320, width: '100%', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
        <MapContainer
          bounds={L.latLngBounds([restaurant, customer]).pad(0.2)}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Polyline positions={route.length >= 2 ? route : [restaurant, customer]} color="#176b55" weight={5} />
          <Marker position={restaurant} icon={restaurantIcon}>
            <Popup>{RESTAURANT_LOCATION.name}</Popup>
          </Marker>
          <Marker position={customer} icon={customerIcon}>
            <Popup>Nhà khách hàng</Popup>
          </Marker>
        </MapContainer>
      </div>
      <div className="delivery-address-detail">
        <span>Quãng đường từ nhà hàng đến khách</span>
        <strong>
          {info ? `${info.km.toFixed(1)} km · khoảng ${Math.ceil(info.minutes)} phút` : 'Đang tính…'}
        </strong>
      </div>
      {routeError && <p className="delivery-muted">{routeError}</p>}
      <a className="delivery-primary-button" href={googleUrl} target="_blank" rel="noopener noreferrer"
         style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}>
        Mở chỉ đường trong Google Maps
      </a>
    </>
  )
}
