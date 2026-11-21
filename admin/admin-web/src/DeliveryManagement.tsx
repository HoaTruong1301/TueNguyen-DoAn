
import { useCallback, useEffect, useState } from 'react'
import './DeliveryManagement.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import DeliveryRouteMap from './DeliveryRouteMap'

const deliveryMarkerIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

function LocationPicker({
  onSelect,
}: {
  onSelect: (latitude: number, longitude: number) => void
}) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng)
    },
  })

  return null
}

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'
).replace(/\/$/, '')

type DeliveryStatus =
  | 'pending'
  | 'assigned'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'cancelled'

type Delivery = {
  id: string
  order_id: string
  order_code: string
  customer_name: string
  customer_phone?: string | null
  grand_total: number
  recipient_name: string
  recipient_phone: string
  address_snapshot: unknown
  status: DeliveryStatus
  driver_name?: string | null
  driver_phone?: string | null
  delivery_fee: number
  created_at: string
  updated_at: string
}

type Props = {
  token: string
}

type ApiResult<T> = {
  success: boolean
  data?: T
  page?: number
  limit?: number
  message?: string
}

const statusLabels: Record<DeliveryStatus, string> = {
  pending: 'Chờ phân công',
  assigned: 'Đã phân công',
  picked_up: 'Đã lấy hàng',
  out_for_delivery: 'Đang giao',
  delivered: 'Đã giao',
  failed: 'Giao thất bại',
  cancelled: 'Đã hủy',
}

const nextStatuses: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending: ['assigned', 'cancelled'],
  assigned: ['picked_up', 'cancelled'],
  picked_up: ['out_for_delivery', 'failed'],
  out_for_delivery: ['delivered', 'failed'],
  delivered: [],
  failed: ['assigned', 'cancelled'],
  cancelled: [],
}

const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)

  if (options.body) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok || payload.success === false) {
    throw new Error(
      payload.message ||
      payload.error?.message ||
      `Yêu cầu thất bại (${response.status})`,
    )
  }

  return payload as T
}

function formatAddress(value: unknown): string {
  if (!value) return 'Chưa có địa chỉ'

  if (typeof value === 'string') {
    try {
      return formatAddress(JSON.parse(value))
    } catch {
      return value
    }
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return String(value)
  }

  const address = value as Record<string, unknown>
  const fields = [
    address.address,
    address.addressLine,
    address.street,
    address.streetAddress,
    address.ward,
    address.district,
    address.province,
    address.city,
    address.fullAddress,
  ]

  const parts = fields
    .filter((item): item is string =>
      typeof item === 'string' && item.trim().length > 0,
    )
    .map((item) => item.trim())

  return [...new Set(parts)].join(', ') || 'Chưa có địa chỉ'
}

function DeliveryManagement({ token }: Props) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [status, setStatus] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Delivery | null>(null)
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const [gpsLocation, setGpsLocation] = useState<{
    latitude: number
    longitude: number
  } | null>(null)

  const [savingLocation, setSavingLocation] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: '20',
      })

      if (status !== 'all') query.set('status', status)

      const result = await request<ApiResult<Delivery[]>>(
        `/delivery/admin/orders?${query.toString()}`,
        token,
      )

      setDeliveries(result.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách giao hàng.')
    } finally {
      setLoading(false)
    }
  }, [token, page, status])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function openDetail(delivery: Delivery) {
    setSelected(delivery)
    setDriverName(delivery.driver_name || '')
    setDriverPhone(delivery.driver_phone || '')
    setNote('')
    setError('')
    setSuccess('')
  }

  async function assignDriver() {
    if (!selected || !driverName.trim() || !driverPhone.trim()) {
      setError('Vui lòng nhập tên và số điện thoại người giao hàng.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await request(
        `/delivery/admin/orders/${encodeURIComponent(selected.order_id)}/assign`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({
            driverName: driverName.trim(),
            driverPhone: driverPhone.trim(),
          }),
        },
      )

      setSuccess('Đã phân công người giao hàng.')
      await loadData()

      setSelected((current) => current ? {
        ...current,
        driver_name: driverName.trim(),
        driver_phone: driverPhone.trim(),
        status: 'assigned',
      } : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể phân công người giao hàng.')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(newStatus: DeliveryStatus) {
    if (!selected || saving) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await request(
        `/delivery/admin/orders/${encodeURIComponent(selected.order_id)}/status`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: newStatus,
            note: note.trim() || undefined,
          }),
        },
      )

      setSuccess('Đã cập nhật trạng thái giao hàng.')
      setNote('')

      setSelected((current) => current
        ? { ...current, status: newStatus }
        : null,
      )

      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái.')
    } finally {
      setSaving(false)
    }
  }

  async function saveDeliveryLocation() {
  if (!selected || !gpsLocation) {
    setError('Vui lòng chọn vị trí trên bản đồ.')
    return
  }

  try {
    setSavingLocation(true)
    setError('')
    setSuccess('')

    await request(
      `/delivery/admin/orders/${selected.order_id}/tracking`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          latitude: gpsLocation.latitude,
          longitude: gpsLocation.longitude,
        }),
      },
    )

    setSuccess('Đã cập nhật vị trí người giao hàng.')
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : 'Không thể cập nhật vị trí người giao hàng.',
    )
  } finally {
    setSavingLocation(false)
  }
}

  const filteredDeliveries = deliveries.filter((item) => {
    const value = keyword.trim().toLowerCase()

    if (!value) return true

    return [
      item.order_code,
      item.customer_name,
      item.customer_phone,
      item.recipient_name,
      item.recipient_phone,
      item.driver_name,
    ].some((field) => String(field || '').toLowerCase().includes(value))
  })

  const counts = {
    total: deliveries.length,
    pending: deliveries.filter((item) => item.status === 'pending').length,
    processing: deliveries.filter((item) =>
      ['assigned', 'picked_up', 'out_for_delivery'].includes(item.status),
    ).length,
    completed: deliveries.filter((item) => item.status === 'delivered').length,
  }

  return (
    <div className="delivery-page">
      <div className="delivery-heading">
        <div>
          <div className="delivery-eyebrow">VẬN HÀNH GIAO NHẬN</div>
          <h1>Quản lý giao hàng</h1>
          <p>Phân công người giao hàng và theo dõi tiến trình giao đơn.</p>
        </div>

        <button
          className="delivery-refresh"
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
        >
          ↻ Làm mới
        </button>
      </div>

      {error && <div className="delivery-alert delivery-alert-error">{error}</div>}
      {success && <div className="delivery-alert delivery-alert-success">{success}</div>}

      <div className="delivery-stats">
        <article>
          <span>Tổng đơn trên trang</span>
          <strong>{counts.total}</strong>
        </article>
        <article>
          <span>Chờ phân công</span>
          <strong>{counts.pending}</strong>
        </article>
        <article>
          <span>Đang xử lý</span>
          <strong>{counts.processing}</strong>
        </article>
        <article>
          <span>Đã giao</span>
          <strong>{counts.completed}</strong>
        </article>
      </div>

      <section className="delivery-panel">
        <div className="delivery-panel-heading">
          <div>
            <h2>Danh sách giao hàng</h2>
            <p>Thông tin đơn hàng và người phụ trách giao nhận.</p>
          </div>
          <span>{filteredDeliveries.length} đơn hàng</span>
        </div>

        <div className="delivery-toolbar">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm mã đơn, khách hàng, người nhận, shipper..."
          />

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="delivery-empty">Đang tải danh sách giao hàng...</div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="delivery-empty">Không tìm thấy đơn giao hàng phù hợp.</div>
        ) : (
          <div className="delivery-table-scroll">
            <table className="delivery-table">
              <thead>
                <tr>
                  <th>MÃ ĐƠN</th>
                  <th>NGƯỜI NHẬN</th>
                  <th>ĐỊA CHỈ</th>
                  <th>NGƯỜI GIAO</th>
                  <th>TRẠNG THÁI</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveries.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.order_code}</strong>
                      <small>{new Date(item.created_at).toLocaleString('vi-VN')}</small>
                    </td>
                    <td>
                      <strong>{item.recipient_name}</strong>
                      <small>{item.recipient_phone}</small>
                    </td>
                    <td className="delivery-address-cell">
                      {formatAddress(item.address_snapshot)}
                    </td>
                    <td>
                      <strong>{item.driver_name || 'Chưa phân công'}</strong>
                      <small>{item.driver_phone || '—'}</small>
                    </td>
                    <td>
                      <span className={`delivery-status status-${item.status}`}>
                        {statusLabels[item.status]}
                      </span>
                    </td>
                    <td>
                      <button
                        className="delivery-detail-button"
                        type="button"
                        onClick={() => openDetail(item)}
                      >
                        Chi tiết ↗
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="delivery-pagination">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => value - 1)}
          >
            ← Trước
          </button>
          <span>Trang {page}</span>
          <button
            type="button"
            disabled={deliveries.length < 20 || loading}
            onClick={() => setPage((value) => value + 1)}
          >
            Sau →
          </button>
        </div>
      </section>

      {selected && (
        <div className="delivery-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelected(null)
        }}>
          <section className="delivery-modal">
            <header className="delivery-modal-heading">
              <div>
                <span className="delivery-eyebrow">CHI TIẾT VẬN CHUYỂN</span>
                <h2>{selected.order_code}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)}>×</button>
            </header>

            <div className="delivery-modal-body">
              <section className="delivery-detail-section">
                <h3>Thông tin đơn hàng</h3>
                <div className="delivery-detail-grid">
                  <div><span>Khách hàng</span><strong>{selected.customer_name || '—'}</strong></div>
                  <div><span>Số điện thoại khách</span><strong>{selected.customer_phone || '—'}</strong></div>
                  <div><span>Người nhận</span><strong>{selected.recipient_name}</strong></div>
                  <div><span>Số điện thoại nhận</span><strong>{selected.recipient_phone}</strong></div>
                  <div><span>Tổng đơn hàng</span><strong>{money(selected.grand_total)}</strong></div>
                  <div><span>Phí giao hàng</span><strong>{money(selected.delivery_fee)}</strong></div>
                </div>
                <div className="delivery-address-detail">
                  <span>Địa chỉ giao hàng</span>
                  <strong>{formatAddress(selected.address_snapshot)}</strong>
                </div>
              </section>

              <section className="delivery-detail-section">
                <h3>Vị trí khách &amp; đường đi từ nhà hàng</h3>
                <DeliveryRouteMap address={selected.address_snapshot} />
              </section>

              <section className="delivery-detail-section">
                <h3>Phân công người giao hàng</h3>
                <div className="delivery-form-grid">
                  <label>
                    Tên người giao hàng
                    <input
                      value={driverName}
                      onChange={(event) => setDriverName(event.target.value)}
                      placeholder="Nhập tên shipper"
                    />
                  </label>
                  <label>
                    Số điện thoại
                    <input
                      value={driverPhone}
                      onChange={(event) => setDriverPhone(event.target.value)}
                      placeholder="Nhập số điện thoại"
                    />
                  </label>
                </div>
                {['pending', 'assigned', 'failed'].includes(selected.status) && (
                  <button
                    className="delivery-primary-button"
                    type="button"
                    disabled={saving}
                    onClick={() => void assignDriver()}
                  >
                    {saving ? 'Đang lưu...' : 'Lưu phân công'}
                  </button>
                )}
              </section>

                            <section className="delivery-detail-section">
                <h3>Vị trí người giao hàng</h3>

                {['picked_up', 'out_for_delivery'].includes(selected.status) ? (
                  <>
                    <p className="delivery-muted">
                      Nhấn vào bản đồ để chọn vị trí hiện tại của người giao hàng.
                    </p>

                    <div style={{
                      height: 350,
                      width: '100%',
                      borderRadius: 12,
                      overflow: 'hidden',
                      marginBottom: 16,
                    }}>
                      <MapContainer
                        center={[10.762622, 106.660172]}
                        zoom={15}
                        style={{ height: '100%', width: '100%' }}
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        <LocationPicker
                          onSelect={(latitude, longitude) => {
                            setGpsLocation({ latitude, longitude })
                          }}
                        />

                        {gpsLocation && (
                          <Marker
                            position={[
                              gpsLocation.latitude,
                              gpsLocation.longitude,
                            ]}
                            icon={deliveryMarkerIcon}
                          />
                        )}
                      </MapContainer>
                    </div>

                    {gpsLocation && (
                      <div className="delivery-address-detail">
                        <span>Vị trí đã chọn</span>
                        <strong>
                          Vĩ độ: {gpsLocation.latitude.toFixed(7)}
                          <br />
                          Kinh độ: {gpsLocation.longitude.toFixed(7)}
                        </strong>
                      </div>
                    )}

                    <button
                      className="delivery-primary-button"
                      type="button"
                      disabled={!gpsLocation || savingLocation}
                      onClick={() => void saveDeliveryLocation()}
                    >
                      {savingLocation
                        ? 'Đang lưu vị trí...'
                        : 'Lưu vị trí người giao hàng'}
                    </button>
                  </>
                ) : (
                  <p className="delivery-muted">
                    Bản đồ chỉ khả dụng khi đơn hàng đã lấy hàng hoặc đang giao.
                  </p>
                )}
              </section>

              <section className="delivery-detail-section">
                <h3>Cập nhật tiến trình giao hàng</h3>
                <div className="delivery-current-status">
                  Trạng thái hiện tại
                  <span className={`delivery-status status-${selected.status}`}>
                    {statusLabels[selected.status]}
                  </span>
                </div>

                {nextStatuses[selected.status].length > 0 ? (
                  <>
                    <label className="delivery-note-field">
                      Ghi chú
                      <textarea
                        rows={3}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Nhập ghi chú cho lần cập nhật này..."
                      />
                    </label>
                    <div className="delivery-status-actions">
                      {nextStatuses[selected.status].map((nextStatus) => (
                        <button
                          key={nextStatus}
                          type="button"
                          disabled={saving}
                          onClick={() => void updateStatus(nextStatus)}
                        >
                          {saving ? 'Đang cập nhật...' : `Chuyển sang ${statusLabels[nextStatus]}`}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="delivery-muted">Đơn giao hàng đã kết thúc.</p>
                )}
              </section>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default DeliveryManagement
