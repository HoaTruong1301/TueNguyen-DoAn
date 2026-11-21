import * as XLSX from 'xlsx'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import './App.css'
import FoodManagement from './FoodManagement'
import DeliveryManagement from './DeliveryManagement'
import ReviewManagement from './ReviewManagement'
import StaffManagement from './StaffManagement'
import CustomerManagement from './CustomerManagement'
import BannerManagement from './BannerManagement'
import VoucherManagement from './VoucherManagement'
import InventoryManagement from './InventoryManagement'
import StaffAudit from './StaffAudit'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '')
const TOKEN_KEY = 'tue_nguyen_admin_access_token'

type OrderStatus =
  | 'pending' | 'confirmed' | 'preparing' | 'ready'
  | 'out_for_delivery' | 'delivered' | 'completed' | 'cancelled' | 'rejected'

type Order = {
  id: string
  order_code: string
  customer_name: string
  customer_phone?: string | null
  order_type?: string
  source?: string
  status: OrderStatus
  grand_total: number
  total_items?: number
  item_count?: number
  created_at: string
}

type OrderOption = {
  id: string
  foodOptionId: string
  group: string
  name: string
  priceAdjustment: number
  quantity: number
}

type OrderItem = {
  id: string
  food_id: string
  food_name_snapshot: string
  quantity: number
  unit_price: number
  discount_amount: number
  line_total: number
  note?: string | null
  options: OrderOption[]
}

type OrderPayment = {
  id: string
  payment_method: string
  payment_status: string
  amount: number
  currency: string
  transaction_id?: string | null
  provider?: string | null
  failure_reason?: string | null
  paid_at?: string | null
  refunded_at?: string | null
  created_at: string
}

type OrderHistory = {
  id: string
  old_status: OrderStatus | null
  new_status: OrderStatus
  changed_by?: string | null
  note?: string | null
  created_at: string
}

type OrderDetail = Order & {
  user_id: string
  reservation_id?: string | null
  order_type: string
  source: string
  customer_phone?: string | null
  customer_email?: string | null
  note?: string | null
  delivery_address_snapshot?: unknown
  subtotal: number
  discount_total: number
  delivery_fee: number
  tax_total: number
  currency: string
  cancellation_reason?: string | null
  rejected_reason?: string | null
  confirmed_at?: string | null
  preparing_at?: string | null
  ready_at?: string | null
  delivered_at?: string | null
  completed_at?: string | null
  cancelled_at?: string | null
  updated_at: string
  items: OrderItem[]
  statusHistory: OrderHistory[]
  payments: OrderPayment[]
}

type Overview = {
  totalMembers: number
  totalOrders: number
  processingOrders: number
  completedRevenue: number
  completedOrders: number
  cancelledOrders: number
  revenueByDay: {
    date: string
    revenue: number
  }[]
}

type ApiResult<T> = {
  success: boolean
  data: T
  message?: string
  error?: { message?: string }
}

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  preparing: 'Đang chuẩn bị',
  ready: 'Sẵn sàng giao',
  out_for_delivery: 'Đang giao',
  delivered: 'Đã giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  rejected: 'Bị từ chối',
}

const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled', 'rejected'],
  confirmed: ['preparing', 'cancelled', 'rejected'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
  rejected: [],
}

const money = (amount: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount || 0)

async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error?.message || payload.message || `Yêu cầu thất bại (${response.status})`)
  }

  return payload as T
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [activePage, setActivePage] = useState<
  'dashboard' | 'orders' | 'foods' | 'delivery' | 'reviews' | 'staff' | 'customers' | 'banners' | 'vouchers' | 'inventory' | 'staffAudit'
  >('dashboard')
  const [revenuePeriod, setRevenuePeriod] = useState<7 | 30>(7)
  const [exporting, setExporting] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  const [overview, setOverview] = useState<Overview | null>(null)
  const orderStatusData = [
  {
    name: 'Đang xử lý',
    value: overview?.processingOrders ?? 0,
    color: '#f59e0b',
  },
  {
    name: 'Đã hoàn tất',
    value: overview?.completedOrders ?? 0,
    color: '#16a34a',
  },
  {
    name: 'Đã hủy',
    value: overview?.cancelledOrders ?? 0,
    color: '#ef4444',
  },
]
  const [orders, setOrders] = useState<Order[]>([])
  const [totalOrders, setTotalOrders] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest'>('newest')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null)
  const [discountAmount, setDiscountAmount] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [discounting, setDiscounting] = useState(false)
  const [discountMsg, setDiscountMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [statusNote, setStatusNote] = useState('')
  const [statusUpdateError, setStatusUpdateError] = useState('')
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState('')
  const pageSize = 10

  const exportOrdersToExcel = async () => {
  if (!token || exporting) return

  setExporting(true)
  setError('')

  try {
    const query = new URLSearchParams({
      page: '1',
      limit: '100',
      sortBy,
    })

    if (status !== 'all') {
      query.set('status', status)
    }

    if (debouncedSearch.trim()) {
      query.set('search', debouncedSearch.trim())
    }

    type OrdersResponse = {
      items: Order[]
      pagination?: {
        totalPages: number
      }
    }

    const firstResult = await apiRequest<ApiResult<OrdersResponse>>(
      `/admin/orders?${query.toString()}`,
      {},
      token,
    )

    const allOrders = [...(firstResult.data?.items || [])]
    const totalPages = firstResult.data?.pagination?.totalPages || 1

    for (let currentPage = 2; currentPage <= totalPages; currentPage++) {
      query.set('page', String(currentPage))

      const result = await apiRequest<ApiResult<OrdersResponse>>(
        `/admin/orders?${query.toString()}`,
        {},
        token,
      )

      allOrders.push(...(result.data?.items || []))
    }

    if (allOrders.length === 0) {
      setError('Không có đơn hàng để xuất Excel.')
      return
    }

    const rows = allOrders.map((order) => ({
      'Mã đơn hàng': order.order_code,
      'Khách hàng': order.customer_name,
      'Số điện thoại': order.customer_phone,
      'Loại đơn': order.order_type,
      'Nguồn đơn': order.source,
      'Trạng thái': statusLabels[order.status] || order.status,
      'Tổng tiền': Number(order.grand_total),
      'Số sản phẩm': order.total_items,
      'Ngày đặt': new Date(order.created_at).toLocaleString('vi-VN'),
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Don hang')

    XLSX.writeFile(
      workbook,
      `danh-sach-don-hang-${new Date().toISOString().slice(0, 10)}.xlsx`,
    )
  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : 'Không thể xuất file Excel.'

    setError(message)

    if (/authorization|unauthorized|token|hết hạn/i.test(message)) {
      logout()
    }
  } finally {
    setExporting(false)
  }
}

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setOverview(null)
    setOrders([])
  }, [])

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginError('')
    setLoginLoading(true)

    try {
      const result = await apiRequest<ApiResult<{ accessToken: string }>>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      if (!result.data?.accessToken) throw new Error('API đăng nhập không trả về access token.')
      localStorage.setItem(TOKEN_KEY, result.data.accessToken)
      setToken(result.data.accessToken)
      setPassword('')
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Không thể đăng nhập.')
    } finally {
      setLoginLoading(false)
    }
  }

  const loadDashboard = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')

    try {
      const [overviewResult, ordersResult] = await Promise.all([
        apiRequest<ApiResult<Overview>>('/admin/dashboard/overview', {}, token),
        apiRequest<ApiResult<{
          items: Order[]
          pagination?: { page: number; limit: number; total: number; totalPages: number }
        }>>(
          `/admin/orders?page=${page}&limit=${pageSize}&sortBy=${sortBy}${status !== 'all' ? `&status=${encodeURIComponent(status)}` : ''}${debouncedSearch.trim() ? `&search=${encodeURIComponent(debouncedSearch.trim())}` : ''}`,
          {},
          token,
        ),
      ])

      setOverview(overviewResult.data)
      setOrders(ordersResult.data?.items || [])
      setTotalOrders(ordersResult.data?.pagination?.total ?? ordersResult.data?.items?.length ?? 0)
      setTotalPages(Math.max(1, ordersResult.data?.pagination?.totalPages ?? 1))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải dữ liệu.'
      setError(message)
      if (/authorization|unauthorized|token|hết hạn/i.test(message)) logout()
    } finally {
      setLoading(false)
    }
  }, [token, page, pageSize, status, debouncedSearch, sortBy, logout])
  useEffect(() => {
    if (token) void loadDashboard()
  }, [token, loadDashboard])

  const changeSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const changeStatus = (value: string) => {
    setStatus(value)
    setPage(1)
  }

  const visibleOrders = orders

  const openOrderDetail = async (orderId: string) => {
  setSelectedOrder(null)
  setDetailError('')
  setDetailLoading(true)

    try {
      const result = await apiRequest<ApiResult<OrderDetail>>(
        `/admin/orders/${encodeURIComponent(orderId)}`,
        {},
        token,
      )

      setSelectedOrder(result.data)
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : 'Không thể tải chi tiết đơn hàng.',
      )
    } finally {
      setDetailLoading(false)
    }
  }
  const applyDiscount = async () => {
    if (!selectedOrder || discounting) return
    const amount = Number(discountAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setDiscountMsg({ type: 'err', text: 'Nhập số tiền giảm lớn hơn 0.' })
      return
    }
    if (discountReason.trim().length < 3) {
      setDiscountMsg({ type: 'err', text: 'Vui lòng nhập lý do giảm giá.' })
      return
    }
    setDiscounting(true)
    setDiscountMsg(null)
    try {
      await apiRequest<ApiResult<unknown>>(
        `/admin/orders/${encodeURIComponent(selectedOrder.id)}/discount`,
        { method: 'POST', body: JSON.stringify({ amount, reason: discountReason.trim() }) },
        token,
      )
      const detailResult = await apiRequest<ApiResult<OrderDetail>>(
        `/admin/orders/${encodeURIComponent(selectedOrder.id)}`,
        {},
        token,
      )
      setSelectedOrder(detailResult.data)
      setDiscountAmount('')
      setDiscountReason('')
      setDiscountMsg({ type: 'ok', text: 'Đã giảm giá và ghi vết người thao tác.' })
    } catch (err) {
      setDiscountMsg({ type: 'err', text: err instanceof Error ? err.message : 'Không thể giảm giá.' })
    } finally {
      setDiscounting(false)
    }
  }

  const updateOrderStatus = async (newStatus: OrderStatus) => {
  if (!selectedOrder || updatingStatus) return

  const requiresNote = ['cancelled', 'rejected'].includes(newStatus)

  if (requiresNote && !statusNote.trim()) {
    setStatusUpdateError('Vui lòng nhập lý do hủy hoặc từ chối đơn hàng.')
    return
  }

  setUpdatingStatus(true)
  setStatusUpdateError('')
  setStatusUpdateSuccess('')

  try {
    await apiRequest<ApiResult<unknown>>(
      `/admin/orders/${encodeURIComponent(selectedOrder.id)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          note: statusNote.trim() || undefined,
        }),
      },
      token,
    )

    const detailResult = await apiRequest<ApiResult<OrderDetail>>(
      `/admin/orders/${encodeURIComponent(selectedOrder.id)}`,
      {},
      token,
    )

    setSelectedOrder(detailResult.data)
    setStatusNote('')
    setStatusUpdateSuccess('Cập nhật trạng thái đơn hàng thành công.')

    await loadDashboard()
  } catch (err) {
    setStatusUpdateError(
      err instanceof Error
        ? err.message
        : 'Không thể cập nhật trạng thái đơn hàng.',
    )
  } finally {
    setUpdatingStatus(false)
  }
  }

  // Chờ người dùng gõ xong 0,5 giây mới tìm đơn hàng
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 500)

    return () => clearTimeout(timer)
  }, [search])


function formatAddress(value: unknown): string {
  if (!value) return 'Chưa có địa chỉ giao hàng'

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return formatAddress(parsed)
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
    .filter((part): part is string =>
      typeof part === 'string' && part.trim().length > 0
    )
    .map((part) => part.trim())

  return [...new Set(parts)].join(', ') || 'Chưa có địa chỉ giao hàng'
}

  if (!token) {
    return (
      <div className="login-screen">
        <div className="login-shell">
          <section className="login-intro">
            <div className="intro-brand">
              <div className="intro-mark">TN</div>
              <div>
                <strong>TUỆ NGUYÊN</strong>
                <span>ADMINISTRATION</span>
              </div>
            </div>

            <div className="intro-copy">
              <span className="intro-kicker">KHÔNG GIAN QUẢN TRỊ</span>
              <h1>Chào mừng bạn<br />trở lại!</h1>
              <p>Một không gian tập trung để vận hành, theo dõi và phát triển hoạt động kinh doanh Tuệ Nguyên.</p>
            </div>

            <div className="intro-benefits">
              <div className="benefit-item">
                <span className="benefit-icon">✧</span>
                <div><strong>Vận hành tập trung</strong><small>Theo dõi hoạt động trên cùng một hệ thống.</small></div>
              </div>
              <div className="benefit-item">
                <span className="benefit-icon">⌁</span>
                <div><strong>Dữ liệu rõ ràng</strong><small>Cập nhật thông tin và đơn hàng thuận tiện.</small></div>
              </div>
              <div className="benefit-item">
                <span className="benefit-icon">◇</span>
                <div><strong>Quản trị an toàn</strong><small>Truy cập dành riêng cho tài khoản được cấp quyền.</small></div>
              </div>
            </div>

            <div className="intro-bottom">
              <span className="decorative-orbit orbit-one" />
              <span className="decorative-orbit orbit-two" />
              <span>CHĂM CHÚT TỪNG ĐIỀU NHỎ · BỀN VỮNG MỖI NGÀY</span>
            </div>
          </section>

          <section className="login-form-panel">
            <div className="form-brand">
              <div className="form-brand-mark">TN</div>
              <span>TUỆ NGUYÊN</span>
              <small>ADMINISTRATION</small>
            </div>

            <div className="form-heading">
              <span className="form-eyebrow">CỔNG QUẢN TRỊ HỆ THỐNG</span>
              <h2>Đăng nhập quản trị</h2>
              <p>Vui lòng nhập thông tin tài khoản để tiếp tục.</p>
            </div>

            <form className="login-form" onSubmit={login}>
              <label className="login-field">
                <span>Địa chỉ email</span>
                <div className="input-wrap">
                  <span className="input-icon">✉</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="username"
                    required
                    placeholder="admin@example.com"
                  />
                </div>
              </label>

              <label className="login-field">
                <span>Mật khẩu</span>
                <div className="input-wrap">
                  <span className="input-icon">▣</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    placeholder="Nhập mật khẩu"
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
              </label>

              {loginError && <div className="error-message">{loginError}</div>}

              <button className="login-submit" type="submit" disabled={loginLoading}>
                <span>{loginLoading ? 'Đang xác thực...' : 'Đăng nhập hệ thống'}</span>
                <span className="submit-arrow">→</span>
              </button>
            </form>

            <div className="login-help">
              <span className="help-line" />
              <span>Cần hỗ trợ truy cập?</span>
              <span className="help-line" />
            </div>

            <div className="security-note">
              <span className="security-symbol">✓</span>
              <div>
                <strong>Kết nối quản trị an toàn</strong>
                <small>Chỉ sử dụng tài khoản được cấp quyền bởi hệ thống.</small>
              </div>
            </div>

            <div className="login-copyright">© 2026 TUỆ NGUYÊN · ALL RIGHTS RESERVED</div>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">TN</div>
          <div><strong>Tuệ Nguyên</strong><span>ADMINISTRATION</span></div>
        </div>
        <div className="nav-caption">TỔNG QUAN</div>
        <button className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`} type="button" onClick={() => setActivePage('dashboard')} > <span>▦</span> Dashboard </button>
        <div className="nav-caption">VẬN HÀNH</div>
        <button className={`nav-item ${activePage === "orders" ? "active" : ""}`} type="button" onClick={() => setActivePage("orders")}><span>▤</span> Quản lý đơn hàng</button>
        <button
          className={`nav-item ${activePage === 'delivery' ? 'active' : ''}`}
          type="button"
          onClick={() => setActivePage('delivery')}
        >
          <span>♧</span> Quản lý giao hàng
        </button>
        <button className={`nav-item ${activePage === 'customers' ? 'active' : ''}`} type="button" onClick={() => setActivePage('customers')} > <span>♙</span>Quản lý Khách hàng </button>
        <button className={`nav-item ${activePage === 'staff' ? 'active' : ''}`} type="button" onClick={() => setActivePage('staff')} > <span>👥</span> Quản lý nhân viên </button>
        <button className={`nav-item ${activePage === "foods" ? "active" : ""}`} type="button" onClick={() => setActivePage("foods")}><span>▧</span>Quản lý Thực đơn</button>
        <button className={`nav-item ${activePage === 'reviews' ? 'active' : ''}`}  type="button" onClick={() => setActivePage('reviews')} > <span>☆</span> Quản lý đánh giá </button>
        <button className={`nav-item ${activePage === 'banners' ? 'active' : ''}`} type="button" onClick={() => setActivePage('banners')} > <span>▣</span> Quản lý Banner </button>
        <button className={`nav-item ${activePage === 'vouchers' ? 'active' : ''}`} type="button" onClick={() => setActivePage('vouchers')} > <span>🎟️</span> Quản lý Voucher </button>
        <button className={`nav-item ${activePage === 'inventory' ? 'active' : ''}`} type="button" onClick={() => setActivePage('inventory')} > <span>📦</span> Quản lý kho </button>
        <button className={`nav-item ${activePage === 'staffAudit' ? 'active' : ''}`} type="button" onClick={() => setActivePage('staffAudit')} > <span>🕵️</span> Giám sát nhân viên </button>
        <div className="sidebar-bottom">
          <div className="admin-avatar">AD</div>
          <div className="admin-info"><strong>Quản trị viên</strong><span>Quản lý hệ thống</span></div>
          <button className="logout-button" type="button" onClick={logout}>Đăng xuất</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Trang quản trị / {
              activePage === 'dashboard'
                ? 'Dashboard'
                : activePage === 'foods'
                  ? 'Thực đơn'
                  : activePage === 'delivery'
                    ? 'Quản lý giao hàng'
                    : activePage === 'reviews'
                      ? 'Quản lý đánh giá'
                      : activePage === 'staff'
                        ? 'Quản lý nhân viên'
                        : activePage === 'customers'
                          ? 'Quản lý khách hàng'
                          : activePage === 'banners'
                            ? 'Quản lý Banner'
                            : activePage === 'vouchers'
                              ? 'Quản lý Voucher'
                              : 'Đơn hàng'
            }
          </div>
          <div className="topbar-right">
            <span className="system-status"><span className="status-dot" /> Hệ thống quản trị</span>
            <div className="top-avatar">AD</div>
          </div>
        </header>
        {activePage === 'dashboard' && (
          <section className="page-content">
            <div className="page-heading">
              <div>
                <div className="eyebrow">TỔNG QUAN KINH DOANH</div>
                <h1>Dashboard</h1>
                <p>Tổng quan tình hình hoạt động kinh doanh Tuệ Nguyên.</p>
              </div>

              <button
                className="secondary-button"
                type="button"
                onClick={() => void loadDashboard()}
              >
                ↻ Làm mới dữ liệu
              </button>
            </div>

            {error && <div className="error-message api-error">{error}</div>}

            <div className="stats-grid">
              <article className="stat-card">
                <div className="stat-top">
                  <span>Tổng đơn hàng</span>
                  <span className="stat-icon green">▤</span>
                </div>
                <strong>{overview?.totalOrders ?? '—'}</strong>
                <span className="stat-description">Tổng đơn hàng trong hệ thống</span>
              </article>

              <article className="stat-card">
                <div className="stat-top">
                  <span>Tổng khách hàng</span>
                  <span className="stat-icon blue">♙</span>
                </div>
                <strong>{overview?.totalMembers ?? '—'}</strong>
                <span className="stat-description">Thành viên trong hệ thống</span>
              </article>

              <article className="stat-card">
                <div className="stat-top">
                  <span>Đang xử lý</span>
                  <span className="stat-icon orange">◷</span>
                </div>
                <strong>{overview?.processingOrders ?? '—'}</strong>
                <span className="stat-description">Đơn đang trong quy trình xử lý</span>
              </article>

              <article className="stat-card">
                <div className="stat-top">
                  <span>Đã hoàn tất</span>
                  <span className="stat-icon green">✓</span>
                </div>
                <strong>{overview?.completedOrders ?? '—'}</strong>
                <span className="stat-description">Đơn có trạng thái hoàn tất</span>
              </article>

              <article className="stat-card">
                <div className="stat-top">
                  <span>Đã hủy</span>
                  <span className="stat-icon orange">✕</span>
                </div>
                <strong>{overview?.cancelledOrders ?? '—'}</strong>
                <span className="stat-description">Tổng đơn hàng đã bị hủy</span>
              </article>

              <article className="stat-card">
                <div className="stat-top">
                  <span>Doanh thu hoàn tất</span>
                  <span className="stat-icon purple">₫</span>
                </div>
                <strong className="revenue-value">
                  {overview ? money(overview.completedRevenue) : '—'}
                </strong>
                <span className="stat-description">Chỉ tính đơn đã hoàn tất</span>
              </article>
            </div>

            <div className="dashboard-chart-card">
              
              <div className="dashboard-chart-heading">
                <div>
                  <h2>Doanh thu {revenuePeriod} ngày gần nhất</h2>
                  <p>Thống kê doanh thu từ các đơn hàng đã hoàn tất</p>
                </div>

                <div className="revenue-period-switch">
                  <button
                    type="button"
                    className={revenuePeriod === 7 ? 'active' : ''}
                    onClick={() => setRevenuePeriod(7)}
                  >
                    7 ngày
                  </button>

                  <button
                    type="button"
                    className={revenuePeriod === 30 ? 'active' : ''}
                    onClick={() => setRevenuePeriod(30)}
                  >
                    30 ngày
                  </button>
                </div>
              </div>

              <div style={{ width: '100%', height: 320, position: 'relative' }}>
                {(
                  overview?.revenueByDay ?? []
                ).slice(revenuePeriod === 7 ? -7 : -30).every(
                  (item) => Number(item.revenue) === 0
                ) ? (
                  <div className="revenue-empty-state">
                    Chưa có doanh thu trong {revenuePeriod} ngày gần nhất
                  </div>
                ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={
                      (overview?.revenueByDay ?? []).slice(
                        revenuePeriod === 7 ? -7 : -30
                      )
                    }
                    margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" vertical={false} />

                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => value.slice(5)}
                    />

                    <YAxis
                      tickFormatter={(value) =>
                        `${(Number(value) / 1000).toLocaleString('vi-VN', {
                          maximumFractionDigits: 1,
                        })}k`
                      }
                    />

                    <Tooltip
                      labelFormatter={(value) => `Ngày ${value}`}
                      formatter={(value) => [
                        `${Number(value).toLocaleString('vi-VN')} đ`,
                        'Doanh thu',
                      ]}
                    />

                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#16a34a"
                      strokeWidth={3}
                      fill="url(#revenueGradient)"
                    />
                  </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="dashboard-chart-card">
              <div className="dashboard-chart-heading">
                <div>
                  <h2>Phân bố trạng thái đơn hàng</h2>
                  <p>Tỷ lệ các đơn hàng theo trạng thái hiện tại</p>
                </div>
              </div>

              <div className="order-status-layout">
                <div className="order-status-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={orderStatusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={105}
                        innerRadius={68}
                        paddingAngle={3}
                        label={({ percent }) =>
                          `${(Number(percent) * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {orderStatusData.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Pie>

                      <Tooltip
                        formatter={(value) => [
                          `${Number(value).toLocaleString('vi-VN')} đơn`,
                          'Số lượng',
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="order-status-legend">
                  {orderStatusData.map((item) => (
                    <div className="order-status-legend-item" key={item.name}>
                      <span
                        className="order-status-dot"
                        style={{ backgroundColor: item.color }}
                      />

                      <div className="order-status-legend-info">
                        <span>{item.name}</span>
                        <strong>
                          {item.value.toLocaleString('vi-VN')} đơn
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="order-status-note">
                <span>
                  Tổng số đơn hàng: <strong>{overview?.totalOrders ?? 0}</strong> đơn
                </span>
                <span>Dữ liệu được cập nhật tự động theo trạng thái đơn hàng.</span>
              </div>
            </div>
          </section>
        )}
        {activePage === 'foods' && <FoodManagement token={token} />}
        {activePage === 'delivery' && <DeliveryManagement token={token} />}
        {activePage === 'reviews' && <ReviewManagement token={token} />}
        {activePage === 'staff' && <StaffManagement token={token} />}
        {activePage === 'customers' && ( <CustomerManagement token={token} />)}
        {activePage === 'banners' && ( <BannerManagement token={token} />)}
        {activePage === 'vouchers' && <VoucherManagement token={token} />}
        {activePage === 'inventory' && <InventoryManagement token={token} />}
        {activePage === 'staffAudit' && <StaffAudit token={token} />}
        {activePage === 'orders' && (
        <section className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">VẬN HÀNH KINH DOANH</div>
              <h1>Quản lý đơn hàng</h1>
              <p>Theo dõi và xử lý đơn hàng trên toàn hệ thống.</p>
            </div>
            <button className="secondary-button" type="button" onClick={() => void loadDashboard()}>↻ Làm mới dữ liệu</button>
          </div>

          {error && <div className="error-message api-error">{error}</div>}

          <div className="stats-grid">
            <article className="stat-card"><div className="stat-top"><span>Tổng đơn hàng</span><span className="stat-icon green">▤</span></div><strong>{overview?.totalOrders ?? '—'}</strong><span className="stat-description">Tổng đơn hàng trong hệ thống</span></article>
            <article className="stat-card"><div className="stat-top"><span>Đang xử lý</span><span className="stat-icon orange">◷</span></div><strong>{overview?.processingOrders ?? '—'}</strong><span className="stat-description">Đơn đang trong quy trình xử lý</span></article>
            <article className="stat-card"><div className="stat-top"><span>Đã hoàn tất</span><span className="stat-icon blue">✓</span></div><strong>{overview?.completedOrders ?? '—'}</strong><span className="stat-description">Đơn có trạng thái hoàn tất</span></article>
            <article className="stat-card"><div className="stat-top"><span>Doanh thu hoàn tất</span><span className="stat-icon purple">₫</span></div><strong className="revenue-value">{overview ? money(overview.completedRevenue) : '—'}</strong><span className="stat-description">Chỉ tính đơn đã hoàn tất</span></article>
          </div>

          <section className="orders-panel">
            <div className="panel-heading">
              <div><h2>Danh sách đơn hàng</h2><p>Tra cứu và theo dõi trạng thái xử lý đơn hàng.</p></div>
              <div className="panel-actions">
                <span className="result-count">{totalOrders} đơn hàng</span>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void exportOrdersToExcel()}
                  disabled={orders.length === 0 || exporting}
                >
                  {exporting ? 'Đang xuất...' : '↓ Xuất Excel'}
                </button>
              </div>
            </div>
            <div className="filters">
              <label className="search-box">
                <span>⌕</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => changeSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void loadDashboard()
                    }
                  }}
                  placeholder="Tìm mã đơn, tên hoặc số điện thoại..."
                  aria-label="Tìm kiếm đơn hàng theo mã, tên khách hàng hoặc số điện thoại"
                />
                {debouncedSearch.trim() && (
                  <button
                    type="button"
                    className="clear-search-button"
                    onClick={() => changeSearch('')}
                    aria-label="Xóa nội dung tìm kiếm"
                  >
                    ×
                  </button>
                )}
              </label>
              <select aria-label="Lọc trạng thái đơn hàng" value={status} onChange={(event) => {
                  changeStatus(event.target.value)
                  setPage(1)
                }}>
                <option value="all">Tất cả trạng thái</option>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button className="secondary-button" type="button" onClick={() => { setPage(1); void loadDashboard() }}>Tìm kiếm</button>
            </div>

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'highest') } className="filter-select">
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="highest">Giá trị cao nhất</option>
            </select>

            <div className="table-wrapper">
              <table>
                <thead><tr><th>MÃ ĐƠN HÀNG</th><th>KHÁCH HÀNG</th><th>SỐ MÓN</th><th>TỔNG TIỀN</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead>
                <tbody>
                  {loading && <tr><td colSpan={6} className="empty-state">Đang tải dữ liệu...</td></tr>}
                  {!loading && visibleOrders.map((order) => (
                    <tr key={order.id}>
                      <td><strong className="order-code">{order.order_code}</strong><span className="order-date">{new Date(order.created_at).toLocaleString('vi-VN')}</span></td>
                      <td>{order.customer_name || 'Khách hàng'}</td>
                      <td>{order.total_items ?? order.item_count ?? 0} món</td>
                      <td><strong>{money(Number(order.grand_total))}</strong></td>
                      <td><span className={`badge badge-${order.status}`}><span className="badge-dot" />{statusLabels[order.status] || order.status}</span></td>
                      <td><button className="detail-button" type="button" onClick={() => void openOrderDetail(order.id)}>  Chi tiết ↗ </button></td>
                    </tr>
                  ))}
                  {!loading && visibleOrders.length === 0 && <tr><td colSpan={6} className="empty-state">Không tìm thấy đơn hàng phù hợp.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="table-footer">
              <span>Hiển thị {totalOrders ? (page - 1) * pageSize + 1 : 0} – {Math.min(page * pageSize, totalOrders)} trong tổng số {totalOrders} đơn</span>
              <div className="pagination">
                <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} aria-label="Trang trước">←</button>
                <span>Trang {page} / {totalPages}</span>
                <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} aria-label="Trang sau">→</button>
              </div>
            </div>
          </section>
          <footer className="page-footer">
            <span>© 2026 Tuệ Nguyên</span>
            <span>Web quản trị · Dữ liệu trực tiếp</span>
          </footer>
            </section>
          )}
            </main>

      {(detailLoading || detailError || selectedOrder) && (
        <div
          className="detail-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedOrder(null)
              setDetailError('')
            }
          }}
        >
          <section className="detail-modal">
            <header className="detail-modal-header">
              <div>
                <span className="eyebrow">THÔNG TIN GIAO DỊCH</span>
                <h2>Chi tiết đơn hàng</h2>
                {selectedOrder && (
                  <p>{selectedOrder.order_code}</p>
                )}
              </div>

              <button
                className="detail-close"
                type="button"
                onClick={() => {
                  setSelectedOrder(null)
                  setDetailError('')
                }}
              >
                ×
              </button>
            </header>

            {detailLoading && (
              <div className="detail-message">
                Đang tải thông tin đơn hàng...
              </div>
            )}

            {detailError && (
              <div className="error-message detail-message">
                {detailError}
              </div>
            )}

            {selectedOrder && (
              <div className="detail-body">
                <div className="detail-summary">
                  <div>
                    <span className="detail-label">Mã đơn hàng</span>
                    <strong>{selectedOrder.order_code}</strong>
                  </div>
                  <div>
                    <span className="detail-label">Ngày đặt</span>
                    <strong>
                      {new Date(selectedOrder.created_at).toLocaleString('vi-VN')}
                    </strong>
                  </div>
                  <div>
                    <span className="detail-label">Trạng thái</span>
                    <span className={`badge badge-${selectedOrder.status}`}>
                      <span className="badge-dot" />
                      {statusLabels[selectedOrder.status] || selectedOrder.status}
                    </span>
                  </div>
                </div>

                <section className="detail-section">
                  <h3>Thông tin khách hàng</h3>
                  <div className="detail-info-grid">
                    <div>
                      <span className="detail-label">Họ và tên</span>
                      <strong>{selectedOrder.customer_name || 'Chưa cập nhật'}</strong>
                    </div>
                    <div>
                      <span className="detail-label">Số điện thoại</span>
                      <strong>{selectedOrder.customer_phone || 'Chưa cập nhật'}</strong>
                    </div>
                    <div>
                      <span className="detail-label">Email</span>
                      <strong>{selectedOrder.customer_email || 'Chưa cập nhật'}</strong>
                    </div>
                    <div>
                      <span className="detail-label">Loại đơn</span>
                      <strong>{selectedOrder.order_type || '—'}</strong>
                    </div>
                  </div>

                  <div className="detail-address">
                    <span className="detail-label">Địa chỉ giao hàng</span>
                    <strong className="formatted-address">
                      {formatAddress(selectedOrder.delivery_address_snapshot)}
                    </strong>
                  </div>

                  {selectedOrder.note && (
                    <div className="detail-address">
                      <span className="detail-label">Ghi chú đơn hàng</span>
                      <strong>{selectedOrder.note}</strong>
                    </div>
                  )}
                </section>

                <section className="detail-section">
                  <h3>Sản phẩm trong đơn ({selectedOrder.items?.length || 0})</h3>

                  {selectedOrder.items?.length ? (
                    <div className="detail-items">
                      {selectedOrder.items.map((item) => (
                        <article className="detail-item" key={item.id}>
                          <div className="detail-item-main">
                            <strong>{item.food_name_snapshot}</strong>
                            <span>
                              {money(Number(item.unit_price))} × {item.quantity}
                            </span>

                            {item.options?.map((option) => (
                              <small key={option.id}>
                                {option.group}: {option.name}
                                {Number(option.priceAdjustment) !== 0
                                  ? ` (${money(Number(option.priceAdjustment))})`
                                  : ''}
                              </small>
                            ))}

                            {item.note && <small>Ghi chú: {item.note}</small>}
                          </div>

                          <strong>{money(Number(item.line_total))}</strong>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="detail-muted">Đơn hàng chưa có thông tin sản phẩm.</p>
                  )}
                </section>

                <section className="detail-section">
                  <h3>Tổng thanh toán</h3>
                  <div className="detail-total-row">
                    <span>Tạm tính</span>
                    <strong>{money(Number(selectedOrder.subtotal))}</strong>
                  </div>
                  <div className="detail-total-row">
                    <span>Giảm giá</span>
                    <strong>-{money(Number(selectedOrder.discount_total))}</strong>
                  </div>
                  <div className="detail-total-row">
                    <span>Phí giao hàng</span>
                    <strong>{money(Number(selectedOrder.delivery_fee))}</strong>
                  </div>
                  <div className="detail-total-row">
                    <span>Thuế</span>
                    <strong>{money(Number(selectedOrder.tax_total))}</strong>
                  </div>
                  <div className="detail-total-row detail-grand-total">
                    <span>Tổng cộng</span>
                    <strong>{money(Number(selectedOrder.grand_total))}</strong>
                  </div>
                  {!['completed', 'cancelled', 'rejected'].includes(selectedOrder.status) && (
                    <div className="discount-box">
                      <strong>Giảm giá thủ công</strong>
                      <input
                        type="number"
                        min="0"
                        placeholder="Số tiền giảm (đ)"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Lý do giảm giá (bắt buộc)"
                        value={discountReason}
                        onChange={(e) => setDiscountReason(e.target.value)}
                      />
                      <button type="button" disabled={discounting} onClick={() => void applyDiscount()}>
                        {discounting ? 'Đang lưu…' : 'Áp dụng giảm giá'}
                      </button>
                      {discountMsg && <p className={`discount-msg ${discountMsg.type}`}>{discountMsg.text}</p>}
                      <small>Mọi lần giảm giá đều được ghi lại tên nhân viên ở trang Giám sát.</small>
                    </div>
                  )}
                </section>

                <section className="detail-section">
                  <h3>Thanh toán</h3>
                  {selectedOrder.payments?.length ? (
                    selectedOrder.payments.map((payment) => (
                      <div className="detail-payment" key={payment.id}>
                        <div>
                          <strong>{payment.payment_method}</strong>
                          <small>Trạng thái: {payment.payment_status}</small>
                          {payment.transaction_id && (
                            <small>Mã giao dịch: {payment.transaction_id}</small>
                          )}
                          {payment.failure_reason && (
                            <small>Lý do thất bại: {payment.failure_reason}</small>
                          )}
                        </div>
                        <strong>{money(Number(payment.amount))}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="detail-muted">Chưa có thông tin thanh toán.</p>
                  )}
                </section>

                <section className="detail-section status-update-section">
                    <h3>Cập nhật trạng thái đơn hàng</h3>

                    {nextStatuses[selectedOrder.status].length > 0 ? (
                      <>
                        <div className="status-current">
                          Trạng thái hiện tại:
                          <strong>{statusLabels[selectedOrder.status]}</strong>
                        </div>

                        <div className="status-actions">
                          {nextStatuses[selectedOrder.status].map((nextStatus) => (
                            <button
                              key={nextStatus}
                              type="button"
                              className={`status-action-button status-action-${nextStatus}`}
                              disabled={updatingStatus}
                              onClick={() => void updateOrderStatus(nextStatus)}
                            >
                              {updatingStatus
                                ? 'Đang cập nhật...'
                                : `Chuyển sang ${statusLabels[nextStatus]}`}
                            </button>
                          ))}
                        </div>

                        {nextStatuses[selectedOrder.status].some((item) =>
                          ['cancelled', 'rejected'].includes(item),
                        ) && (
                          <label className="status-note-field">
                            <span>Lý do hủy hoặc từ chối đơn hàng</span>
                            <textarea
                              value={statusNote}
                              onChange={(event) => setStatusNote(event.target.value)}
                              placeholder="Nhập lý do nếu cần hủy hoặc từ chối đơn..."
                              rows={3}
                            />
                          </label>
                        )}
                      </>
                    ) : (
                      <p className="detail-muted">
                        Đơn hàng đã kết thúc, không thể cập nhật trạng thái thêm.
                      </p>
                    )}

                    {statusUpdateError && (
                      <div className="error-message">{statusUpdateError}</div>
                    )}

                    {statusUpdateSuccess && (
                      <div className="status-success-message">
                        {statusUpdateSuccess}
                      </div>
                    )}
                  </section>

                <section className="detail-section">
                  <h3>Lịch sử trạng thái</h3>

                  {selectedOrder.statusHistory?.length ? (
                    <div className="detail-history">
                      {selectedOrder.statusHistory.map((history) => (
                        <div className="history-item" key={history.id}>
                          <span className="history-dot" />
                          <div>
                            <strong>
                              {history.old_status
                                ? `${statusLabels[history.old_status] || history.old_status} → `
                                : ''}
                              {statusLabels[history.new_status] || history.new_status}
                            </strong>
                            <small>
                              {new Date(history.created_at).toLocaleString('vi-VN')}
                            </small>
                            {history.note && <small>{history.note}</small>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="detail-muted">Chưa có lịch sử thay đổi trạng thái.</p>
                  )}
                </section>
              </div>
            )}
          </section>
        </div>
      )}

    </div>
  )
}

export default App
