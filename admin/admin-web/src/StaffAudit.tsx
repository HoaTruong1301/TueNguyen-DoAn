import { useCallback, useEffect, useState } from 'react'
import './StaffAudit.css'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'
).replace(/\/$/, '')

type Bucket = { count: number; amount: number }
type Summary = {
  userId: string
  email: string | null
  phone: string | null
  cancel: Bucket
  discount: Bucket
  waste: Bucket
}
type AuditEvent = {
  event_type: 'cancel' | 'discount' | 'waste'
  created_at: string
  user_id: string
  staff_email: string | null
  order_code: string | null
  amount: number
  reason: string | null
  detail: string | null
  flagged: boolean
}

const TYPE_LABEL: Record<string, string> = {
  cancel: 'Huỷ bill',
  discount: 'Giảm giá',
  waste: 'Huỷ hàng kho',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'chờ xác nhận',
  confirmed: 'đã xác nhận',
  preparing: 'đang chế biến',
  ready: 'đã xong món',
  out_for_delivery: 'đang giao',
}

const money = (n: number) => `${Number(n).toLocaleString('vi-VN')} đ`

function today(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function get<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/admin/staff-audit${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Yêu cầu thất bại (${response.status})`)
  }
  return payload.data as T
}

export default function StaffAudit({ token }: { token: string }) {
  const [from, setFrom] = useState(today(-7))
  const [to, setTo] = useState(today())
  const [type, setType] = useState('')
  const [staffId, setStaffId] = useState('')
  const [onlyFlag, setOnlyFlag] = useState(false)
  const [summary, setSummary] = useState<Summary[]>([])
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const q = new URLSearchParams({ from, to })
      const eq = new URLSearchParams({ from, to, limit: '200' })
      if (type) eq.set('type', type)
      if (staffId) eq.set('staffId', staffId)
      const [s, e] = await Promise.all([
        get<Summary[]>(`/summary?${q}`, token),
        get<AuditEvent[]>(`/events?${eq}`, token),
      ])
      setSummary(s)
      setEvents(e)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [from, to, type, staffId, token])

  useEffect(() => {
    void load()
  }, [load])

  const shown = onlyFlag ? events.filter((e) => e.flagged) : events
  const totalCancel = summary.reduce((s, r) => s + r.cancel.count, 0)
  const totalDiscount = summary.reduce((s, r) => s + r.discount.amount, 0)
  const flaggedCount = events.filter((e) => e.flagged).length

  return (
    <div className="audit-page">
      <header>
        <h1>Giám sát hoạt động nhân viên</h1>
        <p>Ai huỷ bill, ai bấm giảm giá, ai huỷ hàng trong kho — kèm lý do và thời gian.</p>
      </header>

      <div className="audit-filters">
        <label>Từ ngày<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Đến ngày<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        <label>
          Loại thao tác
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="cancel">Huỷ bill</option>
            <option value="discount">Giảm giá</option>
            <option value="waste">Huỷ hàng kho</option>
          </select>
        </label>
        <label>
          Nhân viên
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">Tất cả</option>
            {summary.map((s) => (
              <option key={s.userId} value={s.userId}>{s.email ?? s.phone ?? s.userId}</option>
            ))}
          </select>
        </label>
        <button onClick={() => void load()} disabled={loading}>{loading ? 'Đang tải…' : 'Làm mới'}</button>
      </div>

      {error && <div className="audit-error">{error}</div>}

      <div className="audit-kpis">
        <div><span>Bill bị huỷ</span><strong>{totalCancel}</strong></div>
        <div><span>Tổng tiền giảm giá</span><strong>{money(totalDiscount)}</strong></div>
        <div className={flaggedCount ? 'warn' : ''}><span>Thao tác đáng chú ý</span><strong>{flaggedCount}</strong></div>
      </div>

      <section className="audit-card">
        <h3>Tổng hợp theo nhân viên</h3>
        <div className="audit-wrap">
          <table>
            <thead>
              <tr><th>Nhân viên</th><th className="r">Huỷ bill</th><th className="r">Tiền bill bị huỷ</th><th className="r">Lần giảm giá</th><th className="r">Tiền đã giảm</th><th className="r">Lần huỷ hàng</th></tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.userId} className="clickable" onClick={() => setStaffId(s.userId === staffId ? '' : s.userId)}>
                  <td>{s.email ?? s.phone ?? s.userId}</td>
                  <td className="r">{s.cancel.count}</td>
                  <td className="r">{money(s.cancel.amount)}</td>
                  <td className="r">{s.discount.count}</td>
                  <td className="r">{money(s.discount.amount)}</td>
                  <td className="r">{s.waste.count}</td>
                </tr>
              ))}
              {summary.length === 0 && <tr><td colSpan={6} className="empty">Không có thao tác nào trong khoảng này</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="audit-card">
        <div className="audit-card-head">
          <h3>Chi tiết thao tác</h3>
          <label className="check">
            <input type="checkbox" checked={onlyFlag} onChange={(e) => setOnlyFlag(e.target.checked)} />
            Chỉ hiện thao tác đáng chú ý
          </label>
        </div>
        <div className="audit-wrap">
          <table>
            <thead>
              <tr><th>Thời gian</th><th>Nhân viên</th><th>Thao tác</th><th>Đơn / Hàng</th><th className="r">Giá trị</th><th>Lý do</th><th></th></tr>
            </thead>
            <tbody>
              {shown.map((e, i) => (
                <tr key={`${e.created_at}-${i}`} className={e.flagged ? 'flag' : ''}>
                  <td>{new Date(e.created_at).toLocaleString('vi-VN')}</td>
                  <td>{e.staff_email ?? '—'}</td>
                  <td><span className={`tag ${e.event_type}`}>{TYPE_LABEL[e.event_type]}</span></td>
                  <td>
                    {e.order_code ?? ''}
                    {e.detail && (
                      <div className="sub">
                        {e.event_type === 'cancel' ? `Đang ở: ${STATUS_LABEL[e.detail] ?? e.detail}` : e.detail}
                      </div>
                    )}
                  </td>
                  <td className="r">{money(e.amount)}</td>
                  <td>{e.reason ?? '—'}</td>
                  <td>{e.flagged && <span className="flagmark" title="Đáng chú ý">⚠</span>}</td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={7} className="empty">Không có dữ liệu</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="audit-note">
          ⚠ = huỷ bill khi món đã vào chế biến / đang giao, giảm giá từ 20% tiền hàng trở lên,
          hoặc huỷ hàng kho từ 200.000 đ.
        </p>
      </section>
    </div>
  )
}
