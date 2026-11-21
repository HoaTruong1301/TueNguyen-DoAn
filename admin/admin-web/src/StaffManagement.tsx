
import { useCallback, useEffect, useState } from 'react'
import './StaffManagement.css'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'
).replace(/\/$/, '')

type Staff = {
  admin_id: string
  user_id: string
  email: string
  phone: string | null
  user_status: string
  admin_status: string
  full_name: string | null
  created_at: string
  roles: string[]
}

type Role = {
  id: string
  name: string
  code: string
  description: string | null
  permission_count: number
}

type Activity = {
  id: string
  admin_email: string
  action: string
  description: string
  ip_address: string | null
  created_at: string
  metadata: unknown
}

type Props = {
  token: string
}

type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  const result = await response.json()

  if (!response.ok || result.success === false) {
    throw new Error(result.message || 'Có lỗi xảy ra')
  }

  return result.data as T
}

const actionLabels: Record<string, string> = {
  CREATE: 'Tạo nhân viên',
  UPDATE_ROLE: 'Thay đổi vai trò',
  BLOCK_STAFF: 'Khóa tài khoản',
  UNBLOCK_STAFF: 'Mở khóa tài khoản',
}

const dateTime = (value: string) =>
  new Date(value).toLocaleString('vi-VN')

export default function StaffManagement({ token }: Props) {
  const [tab, setTab] = useState<'staff' | 'logs'>('staff')
  const [staff, setStaff] = useState<Staff[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [logs, setLogs] = useState<Activity[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [search, setSearch] = useState('')
  const [logAction, setLogAction] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    roleCode: '',
  })

  const loadStaff = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: '20',
        search,
      })
      const data = await request<{
        items: Staff[]
        pagination: Pagination
      }>(`/admin/staff?${query}`, token)

      setStaff(data.items)
      setPagination(data.pagination)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải nhân viên')
    } finally {
      setLoading(false)
    }
  }, [token, search])

  const loadRoles = useCallback(async () => {
    try {
      const data = await request<Role[]>('/admin/staff/roles', token)
      setRoles(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải vai trò')
    }
  }, [token])

  const loadLogs = useCallback(async (page = 1) => {
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: '20',
        search,
        action: logAction,
      })
      const data = await request<{
        items: Activity[]
        pagination: Pagination
      }>(`/admin/staff/activity-logs?${query}`, token)

      setLogs(data.items)
      setPagination(data.pagination)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải nhật ký')
    } finally {
      setLoading(false)
    }
  }, [token, search, logAction])

  useEffect(() => {
    void loadRoles()
  }, [loadRoles])

  useEffect(() => {
    if (tab === 'staff') {
      void loadStaff(1)
    } else {
      void loadLogs(1)
    }
  }, [tab, loadStaff, loadLogs])

  async function createStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      await request('/admin/staff', token, {
        method: 'POST',
        body: JSON.stringify(form),
      })

      setShowCreate(false)
      setForm({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        roleCode: '',
      })
      await loadStaff(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tạo nhân viên')
    } finally {
      setSaving(false)
    }
  }

  async function changeRole(item: Staff, roleCode: string) {
    if (!roleCode || roleCode === item.roles[0]) return
    if (!window.confirm(`Thay đổi vai trò của ${item.full_name || item.email}?`)) return

    setError('')
    try {
      await request(`/admin/staff/${item.admin_id}/role`, token, {
        method: 'PATCH',
        body: JSON.stringify({ roleCode }),
      })
      await loadStaff(pagination.page)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể thay đổi vai trò')
    }
  }

  async function changeStatus(item: Staff) {
    const blocked = item.user_status === 'blocked'
    const nextStatus = blocked ? 'active' : 'blocked'
    const label = blocked ? 'mở khóa' : 'khóa'

    if (!window.confirm(`Bạn có chắc muốn ${label} tài khoản ${item.email}?`)) return

    setError('')
    try {
      await request(`/admin/staff/${item.admin_id}/status`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      })
      await loadStaff(pagination.page)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể cập nhật trạng thái')
    }
  }

  const currentPage = pagination.page
  const totalPages = pagination.totalPages

  return (
    <div className="staff-page">
      <div className="staff-header">
        <div>
          <h1>Quản lý nhân viên</h1>
          <p>Quản lý tài khoản và phân quyền nhân sự quản trị</p>
        </div>
        {tab === 'staff' && (
          <button className="staff-primary-btn" onClick={() => setShowCreate(true)}>
            + Thêm nhân viên
          </button>
        )}
      </div>

      <div className="staff-tabs">
        <button
          className={tab === 'staff' ? 'active' : ''}
          onClick={() => setTab('staff')}
        >
          Danh sách nhân viên
        </button>
        <button
          className={tab === 'logs' ? 'active' : ''}
          onClick={() => setTab('logs')}
        >
          Nhật ký hoạt động
        </button>
      </div>

      <div className="staff-toolbar">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo tên, email, số điện thoại..."
        />
        {tab === 'logs' && (
          <select value={logAction} onChange={e => setLogAction(e.target.value)}>
            <option value="">Tất cả hành động</option>
            <option value="CREATE">Tạo nhân viên</option>
            <option value="UPDATE_ROLE">Thay đổi vai trò</option>
            <option value="BLOCK_STAFF">Khóa tài khoản</option>
            <option value="UNBLOCK_STAFF">Mở khóa tài khoản</option>
          </select>
        )}
        <button
          className="staff-secondary-btn"
          onClick={() => tab === 'staff' ? void loadStaff(1) : void loadLogs(1)}
        >
          Tìm kiếm
        </button>
      </div>

      {error && <div className="staff-error">{error}</div>}

      {loading ? (
        <div className="staff-loading">Đang tải dữ liệu...</div>
      ) : tab === 'staff' ? (
        <>
          <div className="staff-table-wrap">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Email</th>
                  <th>Điện thoại</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(item => {
                  const blocked = item.user_status === 'blocked'
                  const isSuperAdmin = item.roles.includes('SUPER_ADMIN')

                  return (
                    <tr key={item.admin_id}>
                      <td>
                        <strong>{item.full_name || 'Chưa cập nhật'}</strong>
                      </td>
                      <td>{item.email}</td>
                      <td>{item.phone || '—'}</td>
                      <td>
                        {isSuperAdmin ? (
                          <span className="staff-role-super">SUPER ADMIN</span>
                        ) : (
                          <select
                            value={item.roles[0] || ''}
                            onChange={e => void changeRole(item, e.target.value)}
                          >
                            {roles.map(role => (
                              <option key={role.id} value={role.code}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        <span className={`staff-status ${blocked ? 'blocked' : 'active'}`}>
                          {blocked ? 'Đã khóa' : 'Hoạt động'}
                        </span>
                      </td>
                      <td>{dateTime(item.created_at)}</td>
                      <td>
                        {!isSuperAdmin && (
                          <button
                            className={blocked ? 'staff-unlock-btn' : 'staff-lock-btn'}
                            onClick={() => void changeStatus(item)}
                          >
                            {blocked ? 'Mở khóa' : 'Khóa'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {staff.length === 0 && (
                  <tr><td colSpan={7} className="staff-empty">Không tìm thấy nhân viên</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="staff-footer">
            <span>Tổng cộng: {pagination.total} nhân viên</span>
            <div className="staff-pagination">
              <button disabled={currentPage <= 1} onClick={() => void loadStaff(currentPage - 1)}>
                Trước
              </button>
              <span>Trang {currentPage} / {Math.max(1, totalPages)}</span>
              <button disabled={currentPage >= totalPages} onClick={() => void loadStaff(currentPage + 1)}>
                Sau
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="staff-table-wrap">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người thực hiện</th>
                  <th>Hành động</th>
                  <th>Mô tả</th>
                  <th>Địa chỉ IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td>{dateTime(log.created_at)}</td>
                    <td>{log.admin_email || 'Hệ thống'}</td>
                    <td>
                      <span className="staff-log-action">
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td>{log.description}</td>
                    <td>{log.ip_address || '—'}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={5} className="staff-empty">Chưa có hoạt động</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="staff-footer">
            <span>Tổng cộng: {pagination.total} hoạt động</span>
            <div className="staff-pagination">
              <button disabled={currentPage <= 1} onClick={() => void loadLogs(currentPage - 1)}>
                Trước
              </button>
              <span>Trang {currentPage} / {Math.max(1, totalPages)}</span>
              <button disabled={currentPage >= totalPages} onClick={() => void loadLogs(currentPage + 1)}>
                Sau
              </button>
            </div>
          </div>
        </>
      )}

      {showCreate && (
        <div className="staff-modal-overlay" onMouseDown={e => {
          if (e.target === e.currentTarget) setShowCreate(false)
        }}>
          <form className="staff-modal" onSubmit={createStaff}>
            <div className="staff-modal-header">
              <div>
                <h2>Thêm nhân viên</h2>
                <p>Tạo tài khoản quản trị mới</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)}>✕</button>
            </div>

            <label>Họ và tên</label>
            <input
              required minLength={2} maxLength={100}
              value={form.fullName}
              onChange={e => setForm({ ...form, fullName: e.target.value })}
              placeholder="Nhập họ và tên"
            />

            <label>Email</label>
            <input
              required type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="example@email.com"
            />

            <label>Số điện thoại</label>
            <input
              required
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="0912345678"
            />

            <label>Mật khẩu</label>
            <input
              required type="password" minLength={8} maxLength={72}
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Tối thiểu 8 ký tự"
            />

            <label>Vai trò</label>
            <select
              required
              value={form.roleCode}
              onChange={e => setForm({ ...form, roleCode: e.target.value })}
            >
              <option value="">-- Chọn vai trò --</option>
              {roles.map(role => (
                <option key={role.id} value={role.code}>{role.name}</option>
              ))}
            </select>

            <div className="staff-modal-actions">
              <button type="button" className="staff-secondary-btn" onClick={() => setShowCreate(false)}>
                Hủy
              </button>
              <button type="submit" className="staff-primary-btn" disabled={saving || !roles.length}>
                {saving ? 'Đang tạo...' : 'Tạo nhân viên'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
