
import { useEffect, useState } from 'react'
import './CustomerManagement.css'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:3000/api/v1'
).replace(/\/$/, '')

interface Customer {
  id: string
  email: string | null
  phone: string | null
  account_phone: string | null
  full_name: string | null
  avatar_url: string | null
  date_of_birth: string | null
  gender: string | null
  status: string
  email_verified_at: string | null
  phone_verified_at: string | null
  last_login_at: string | null
  created_at: string
  updated_at: string
  locked_until: string | null
  total_addresses: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface Props {
  token: string
}

async function request<T>(
  path: string,
  token: string
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  const result = await response.json()

  if (!response.ok || result.success === false) {
    throw new Error(result.message || 'Không thể tải dữ liệu')
  }

  return result
}

function formatDate(value: string | null) {
  if (!value) return '—'

  return new Date(value).toLocaleDateString('vi-VN')
}

function formatDateTime(value: string | null) {
  if (!value) return 'Chưa đăng nhập'

  return new Date(value).toLocaleString('vi-VN')
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: 'Hoạt động',
    blocked: 'Đã khóa',
    suspended: 'Tạm ngưng',
    pending: 'Chờ xác thực',
  }

  return labels[status] || status
}

export default function CustomerManagement({ token }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  })

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadCustomers() {
      setLoading(true)
      setError('')

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '10',
          sortBy,
        })

        if (search.trim()) {
          params.set('search', search.trim())
        }

        if (status) {
          params.set('status', status)
        }

        const result = await request<{
          success: boolean
          data: Customer[]
          pagination: Pagination
        }>(`/admin/members?${params.toString()}`, token)

        if (!cancelled) {
          setCustomers(result.data || [])
          setPagination(result.pagination)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Không thể tải danh sách khách hàng'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCustomers()

    return () => {
      cancelled = true
    }
  }, [token, page, search, status, sortBy])

  async function openCustomer(customer: Customer) {
    setSelectedCustomer(customer)

    try {
      const result = await request<{
        success: boolean
        data: Customer
      }>(`/admin/members/${customer.id}`, token)

      setSelectedCustomer(result.data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tải thông tin khách hàng'
      )
    }
  }

  return (
    <div className="customer-page">
      <div className="customer-header">
        <div>
          <h2>Quản lý khách hàng</h2>
          <p>Theo dõi và quản lý thông tin khách hàng</p>
        </div>

        <div className="customer-total">
          <span>Tổng khách hàng</span>
          <strong>{pagination.total.toLocaleString('vi-VN')}</strong>
        </div>
      </div>

      <div className="customer-toolbar">
        <input
          type="text"
          placeholder="Tìm tên, email hoặc số điện thoại..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="blocked">Đã khóa</option>
          <option value="suspended">Tạm ngưng</option>
          <option value="pending">Chờ xác thực</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value)
            setPage(1)
          }}
        >
          <option value="newest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
          <option value="name">Theo tên</option>
        </select>
      </div>

      {error && (
        <div className="customer-error">{error}</div>
      )}

      <div className="customer-table-wrapper">
        <table className="customer-table">
          <thead>
            <tr>
              <th>Khách hàng</th>
              <th>Số điện thoại</th>
              <th>Email</th>
              <th>Trạng thái</th>
              <th>Địa chỉ</th>
              <th>Ngày tham gia</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="customer-empty">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="customer-empty">
                  Không tìm thấy khách hàng
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <div className="customer-person">
                      {customer.avatar_url ? (
                        <img
                          src={customer.avatar_url}
                          alt=""
                        />
                      ) : (
                        <div className="customer-avatar">
                          {(customer.full_name || 'K')
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                      )}

                      <div>
                        <strong>
                          {customer.full_name || 'Chưa cập nhật'}
                        </strong>
                        <small>
                          {customer.gender || 'Chưa cập nhật'}
                        </small>
                      </div>
                    </div>
                  </td>

                  <td>{customer.phone || '—'}</td>
                  <td>{customer.email || '—'}</td>

                  <td>
                    <span
                      className={`customer-status ${customer.status}`}
                    >
                      {statusLabel(customer.status)}
                    </span>
                  </td>

                  <td>{customer.total_addresses || 0}</td>
                  <td>{formatDate(customer.created_at)}</td>

                  <td>
                    <button
                      className="customer-detail-button"
                      onClick={() => openCustomer(customer)}
                      type="button"
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="customer-pagination">
        <span>
          Hiển thị {customers.length} / {pagination.total} khách hàng
        </span>

        <div>
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => current - 1)}
          >
            Trước
          </button>

          <strong>
            {pagination.page} / {Math.max(1, pagination.totalPages)}
          </strong>

          <button
            type="button"
            disabled={page >= pagination.totalPages || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            Sau
          </button>
        </div>
      </div>

      {selectedCustomer && (
        <div
          className="customer-modal-overlay"
          onClick={() => setSelectedCustomer(null)}
        >
          <div
            className="customer-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="customer-modal-header">
              <div>
                <h3>Thông tin khách hàng</h3>
                <p>Chi tiết tài khoản và hồ sơ</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
              >
                ×
              </button>
            </div>

            <div className="customer-detail-profile">
              {selectedCustomer.avatar_url ? (
                <img src={selectedCustomer.avatar_url} alt="" />
              ) : (
                <div className="customer-avatar large">
                  {(selectedCustomer.full_name || 'K')
                    .charAt(0)
                    .toUpperCase()}
                </div>
              )}

              <div>
                <strong>
                  {selectedCustomer.full_name || 'Chưa cập nhật'}
                </strong>
                <span>
                  {statusLabel(selectedCustomer.status)}
                </span>
              </div>
            </div>

            <div className="customer-detail-grid">
              <div>
                <label>Email</label>
                <strong>{selectedCustomer.email || '—'}</strong>
              </div>

              <div>
                <label>Số điện thoại</label>
                <strong>{selectedCustomer.phone || '—'}</strong>
              </div>

              <div>
                <label>Giới tính</label>
                <strong>{selectedCustomer.gender || '—'}</strong>
              </div>

              <div>
                <label>Ngày sinh</label>
                <strong>
                  {formatDate(selectedCustomer.date_of_birth)}
                </strong>
              </div>

              <div>
                <label>Số địa chỉ</label>
                <strong>{selectedCustomer.total_addresses || 0}</strong>
              </div>

              <div>
                <label>Ngày tham gia</label>
                <strong>{formatDate(selectedCustomer.created_at)}</strong>
              </div>

              <div>
                <label>Xác thực email</label>
                <strong>
                  {selectedCustomer.email_verified_at
                    ? 'Đã xác thực'
                    : 'Chưa xác thực'}
                </strong>
              </div>

              <div>
                <label>Xác thực điện thoại</label>
                <strong>
                  {selectedCustomer.phone_verified_at
                    ? 'Đã xác thực'
                    : 'Chưa xác thực'}
                </strong>
              </div>

              <div className="full">
                <label>Đăng nhập gần nhất</label>
                <strong>
                  {formatDateTime(selectedCustomer.last_login_at)}
                </strong>
              </div>
            </div>

            <div className="customer-modal-footer">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
