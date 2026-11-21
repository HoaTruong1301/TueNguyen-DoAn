
import { useEffect, useState } from 'react'
import './VoucherManagement.css'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:3000/api/v1'
).replace(/\/$/, '')

interface Voucher {
  id: string
  code: string
  name: string
  description: string | null
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: number
  max_discount_amount: number | null
  min_order_amount: number
  usage_limit: number | null
  used_count: number
  per_user_limit: number | null
  starts_at: string
  ends_at: string
  is_active: boolean
  created_at: string
  category_count?: number
  food_count?: number
}

interface Category {
  id: string
  name: string
  slug: string
}

interface Food {
  id: string
  category_id: string
  category_name: string | null
  name: string
  price: number
  sale_price: number | null
  status: string
}

interface VoucherDetail extends Voucher {
  categories: { id: string; name: string }[]
  foods: {
    id: string
    name: string
    price: number
    sale_price: number | null
  }[]
  usage: {
    total_usage: number
    total_discount: number
  }
}

interface Props {
  token: string
}

interface VoucherForm {
  code: string
  name: string
  description: string
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: number
  max_discount_amount: string
  min_order_amount: number
  usage_limit: string
  per_user_limit: string
  starts_at: string
  ends_at: string
  is_active: boolean
  category_ids: string[]
  food_ids: string[]
}

const emptyForm: VoucherForm = {
  code: '',
  name: '',
  description: '',
  discount_type: 'percentage',
  discount_value: 10,
  max_discount_amount: '',
  min_order_amount: 0,
  usage_limit: '',
  per_user_limit: '',
  starts_at: '',
  ends_at: '',
  is_active: true,
  category_ids: [],
  food_ids: [],
}

async function request<T>(
  path: string,
  token: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined
      ? { body: JSON.stringify(body) }
      : {}),
  })

  const result = await response.json()

  if (!response.ok || result.success === false) {
    throw new Error(
      result.message || 'Có lỗi xảy ra'
    )
  }

  return result
}

function formatMoney(value: number | string | null) {
  return Number(value || 0).toLocaleString('vi-VN') + 'đ'
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('vi-VN')
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ''

  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000

  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 16)
}


export default function VoucherManagement({ token }: Props) {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<VoucherForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  const loadVouchers = async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        search,
        status,
      })

      const result = await request<{
        data: Voucher[]
        pagination: {
          totalPages: number
        }
      }>(
        `/admin/vouchers?${params.toString()}`,
        token
      )

      setVouchers(result.data)
      setTotalPages(result.pagination.totalPages || 1)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không tải được voucher'
      )
    } finally {
      setLoading(false)
    }
  }

  const loadOptions = async () => {
    try {
      const [categoryResult, foodResult] = await Promise.all([
        request<{ success: boolean; data: Category[] }>(
          '/admin/food-categories',
          token
        ),
        request<{ success: boolean; data: Food[] }>(
          '/admin/foods',
          token
        ),
      ])

      setCategories(categoryResult.data)
      setFoods(foodResult.data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không tải được danh mục và món ăn'
      )
    }
  }

  useEffect(() => {
    loadOptions()
  }, [token])

  useEffect(() => {
    loadVouchers()
  }, [token, page, status])

  const updateForm = <K extends keyof VoucherForm>(
    key: K,
    value: VoucherForm[K]
  ) => {
    setForm(previous => ({
      ...previous,
      [key]: value,
    }))
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({
      ...emptyForm,
      starts_at: toDateTimeLocal(new Date().toISOString()),
      ends_at: toDateTimeLocal(
        new Date(Date.now() + 30 * 86400000).toISOString()
      ),
    })
    setShowModal(true)
  }

  const openEdit = async (id: string) => {
    try {
      setError('')

      const detail = await request<VoucherDetail>(
        `/admin/vouchers/${id}`,
        token
      )

      setEditingId(id)
      setForm({
        code: detail.code,
        name: detail.name,
        description: detail.description || '',
        discount_type: detail.discount_type,
        discount_value: Number(detail.discount_value),
        max_discount_amount:
          detail.max_discount_amount === null
            ? ''
            : String(detail.max_discount_amount),
        min_order_amount: Number(detail.min_order_amount),
        usage_limit:
          detail.usage_limit === null
            ? ''
            : String(detail.usage_limit),
        per_user_limit:
          detail.per_user_limit === null
            ? ''
            : String(detail.per_user_limit),
        starts_at: toDateTimeLocal(detail.starts_at),
        ends_at: toDateTimeLocal(detail.ends_at),
        is_active: detail.is_active,
        category_ids: detail.categories.map(item => item.id),
        food_ids: detail.foods.map(item => item.id),
      })

      setShowModal(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không tải được voucher'
      )
    }
  }

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.code.trim() || !form.name.trim()) {
      setError('Vui lòng nhập mã và tên voucher')
      return
    }

    if (!form.starts_at || !form.ends_at) {
      setError('Vui lòng chọn thời gian áp dụng')
      return
    }

    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      setError('Thời gian kết thúc phải sau thời gian bắt đầu')
      return
    }

    setSaving(true)
    setError('')

    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        max_discount_amount:
          form.max_discount_amount === ''
            ? null
            : Number(form.max_discount_amount),
        min_order_amount: Number(form.min_order_amount),
        usage_limit:
          form.usage_limit === '' ? null : Number(form.usage_limit),
        per_user_limit:
          form.per_user_limit === '' ? null : Number(form.per_user_limit),
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        is_active: form.is_active,
        category_ids: form.category_ids,
        food_ids: form.food_ids,
      }

      await request(
        editingId
          ? `/admin/vouchers/${editingId}`
          : '/admin/vouchers',
        token,
        editingId ? 'PATCH' : 'POST',
        payload
      )

      setShowModal(false)
      await loadVouchers()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không lưu được voucher'
      )
    } finally {
      setSaving(false)
    }
  }


  const toggleStatus = async (voucher: Voucher) => {
    const action = voucher.is_active ? 'tắt' : 'bật'

    if (!window.confirm(`Bạn có chắc muốn ${action} voucher ${voucher.code}?`)) {
      return
    }

    try {
      await request(
        `/admin/vouchers/${voucher.id}/status`,
        token,
        'PATCH',
        { is_active: !voucher.is_active }
      )

      await loadVouchers()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không cập nhật được trạng thái'
      )
    }
  }

  const deleteVoucher = async (voucher: Voucher) => {
    if (!window.confirm(`Bạn có chắc muốn xóa voucher ${voucher.code}?`)) {
      return
    }

    try {
      await request(
        `/admin/vouchers/${voucher.id}`,
        token,
        'DELETE'
      )

      await loadVouchers()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không xóa được voucher'
      )
    }
  }

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    loadVouchers()
  }

  const getVoucherStatus = (voucher: Voucher) => {
    const now = Date.now()

    if (!voucher.is_active) return 'Đã tắt'
    if (new Date(voucher.starts_at).getTime() > now) return 'Chưa bắt đầu'
    if (new Date(voucher.ends_at).getTime() < now) return 'Hết hạn'

    return 'Đang hoạt động'
  }

  const getDiscountText = (voucher: Voucher) => {
    if (voucher.discount_type === 'percentage') {
      return `${Number(voucher.discount_value)}%`
    }

    return formatMoney(voucher.discount_value)
  }

  return (
    <div className="voucher-management">
      <div className="voucher-header">
        <div>
          <h2>Quản lý Voucher</h2>
          <p>Quản lý mã giảm giá và chương trình ưu đãi</p>
        </div>

        <button
          className="voucher-primary-btn"
          onClick={openCreate}
        >
          + Tạo voucher
        </button>
      </div>

      {error && (
        <div className="voucher-error">
          {error}
          <button onClick={() => setError('')}>Đóng</button>
        </div>
      )}

      <form className="voucher-filters" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Tìm theo mã hoặc tên voucher..."
          value={search}
          onChange={event => setSearch(event.target.value)}
        />

        <select
          value={status}
          onChange={event => {
            setStatus(event.target.value)
            setPage(1)
          }}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Đã tắt</option>
          <option value="upcoming">Chưa bắt đầu</option>
          <option value="expired">Hết hạn</option>
        </select>

        <button type="submit">Tìm kiếm</button>
      </form>

      <div className="voucher-table-wrapper">
        <table className="voucher-table">
          <thead>
            <tr>
              <th>Mã voucher</th>
              <th>Tên chương trình</th>
              <th>Giảm giá</th>
              <th>Đã sử dụng</th>
              <th>Thời hạn</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="voucher-empty">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : vouchers.length === 0 ? (
              <tr>
                <td colSpan={7} className="voucher-empty">
                  Chưa có voucher nào
                </td>
              </tr>
            ) : (
              vouchers.map(voucher => (
                <tr key={voucher.id}>
                  <td>
                    <strong>{voucher.code}</strong>
                  </td>

                  <td>
                    <div>{voucher.name}</div>
                    <small>
                      Đơn tối thiểu: {formatMoney(voucher.min_order_amount)}
                    </small>
                  </td>

                  <td>
                    <strong className="voucher-discount">
                      {getDiscountText(voucher)}
                    </strong>
                    {voucher.discount_type === 'percentage' &&
                      voucher.max_discount_amount !== null && (
                        <small>
                          Tối đa {formatMoney(voucher.max_discount_amount)}
                        </small>
                      )}
                  </td>

                  <td>
                    {voucher.used_count}
                    {' / '}
                    {voucher.usage_limit ?? '∞'}
                  </td>

                  <td>
                    <div>{formatDate(voucher.starts_at)}</div>
                    <small>đến {formatDate(voucher.ends_at)}</small>
                  </td>

                  <td>
                    <span
                      className={`voucher-status ${
                        getVoucherStatus(voucher) === 'Đang hoạt động'
                          ? 'is-active'
                          : 'is-inactive'
                      }`}
                    >
                      {getVoucherStatus(voucher)}
                    </span>
                  </td>

                  <td>
                    <div className="voucher-actions">
                      <button
                        type="button"
                        onClick={() => openEdit(voucher.id)}
                      >
                        Sửa
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleStatus(voucher)}
                      >
                        {voucher.is_active ? 'Tắt' : 'Bật'}
                      </button>

                      <button
                        type="button"
                        className="voucher-delete-btn"
                        onClick={() => deleteVoucher(voucher)}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="voucher-pagination">
        <button
          disabled={page <= 1}
          onClick={() => setPage(previous => previous - 1)}
        >
          Trước
        </button>

        <span>
          Trang {page} / {totalPages}
        </span>

        <button
          disabled={page >= totalPages}
          onClick={() => setPage(previous => previous + 1)}
        >
          Sau
        </button>
      </div>


      {showModal && (
        <div
          className="voucher-modal-overlay"
          onClick={() => !saving && setShowModal(false)}
        >
          <div
            className="voucher-modal"
            onClick={event => event.stopPropagation()}
          >
            <div className="voucher-modal-header">
              <h3>
                {editingId ? 'Chỉnh sửa Voucher' : 'Tạo Voucher mới'}
              </h3>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="voucher-form-grid">
                <label>
                  Mã voucher *
                  <input
                    required
                    value={form.code}
                    onChange={event =>
                      updateForm('code', event.target.value.toUpperCase())
                    }
                    placeholder="VD: TUENGUYEN20"
                  />
                </label>

                <label>
                  Tên chương trình *
                  <input
                    required
                    value={form.name}
                    onChange={event =>
                      updateForm('name', event.target.value)
                    }
                    placeholder="Giảm giá khách hàng mới"
                  />
                </label>

                <label className="voucher-full-width">
                  Mô tả
                  <textarea
                    value={form.description}
                    onChange={event =>
                      updateForm('description', event.target.value)
                    }
                    rows={2}
                  />
                </label>

                <label>
                  Loại giảm giá
                  <select
                    value={form.discount_type}
                    onChange={event =>
                      updateForm(
                        'discount_type',
                        event.target.value as VoucherForm['discount_type']
                      )
                    }
                  >
                    <option value="percentage">Phần trăm (%)</option>
                    <option value="fixed_amount">Số tiền cố định (VNĐ)</option>
                  </select>
                </label>

                <label>
                  Giá trị giảm *
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={form.discount_value}
                    onChange={event =>
                      updateForm('discount_value', Number(event.target.value))
                    }
                  />
                </label>

                {form.discount_type === 'percentage' && (
                  <label>
                    Giảm tối đa (VNĐ)
                    <input
                      type="number"
                      min="0"
                      value={form.max_discount_amount}
                      onChange={event =>
                        updateForm('max_discount_amount', event.target.value)
                      }
                      placeholder="Để trống nếu không giới hạn"
                    />
                  </label>
                )}

                <label>
                  Đơn hàng tối thiểu (VNĐ)
                  <input
                    type="number"
                    min="0"
                    value={form.min_order_amount}
                    onChange={event =>
                      updateForm('min_order_amount', Number(event.target.value))
                    }
                  />
                </label>

                <label>
                  Tổng lượt sử dụng
                  <input
                    type="number"
                    min="1"
                    value={form.usage_limit}
                    onChange={event =>
                      updateForm('usage_limit', event.target.value)
                    }
                    placeholder="Không giới hạn"
                  />
                </label>

                <label>
                  Lượt dùng mỗi khách
                  <input
                    type="number"
                    min="1"
                    value={form.per_user_limit}
                    onChange={event =>
                      updateForm('per_user_limit', event.target.value)
                    }
                    placeholder="Không giới hạn"
                  />
                </label>

                <label>
                  Bắt đầu *
                  <input
                    required
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={event =>
                      updateForm('starts_at', event.target.value)
                    }
                  />
                </label>

                <label>
                  Kết thúc *
                  <input
                    required
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={event =>
                      updateForm('ends_at', event.target.value)
                    }
                  />
                </label>

                <label className="voucher-full-width voucher-checkbox">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={event =>
                      updateForm('is_active', event.target.checked)
                    }
                  />
                  Kích hoạt voucher
                </label>
              </div>

              <div className="voucher-modal-section">
                <h4>Áp dụng theo danh mục</h4>
                <p>
                  Không chọn danh mục nào nghĩa là không giới hạn theo danh mục.
                </p>

                <div className="voucher-option-list">
                  {categories.map(category => (
                    <label key={category.id}>
                      <input
                        type="checkbox"
                        checked={form.category_ids.includes(category.id)}
                        onChange={event => {
                          const ids = event.target.checked
                            ? [...form.category_ids, category.id]
                            : form.category_ids.filter(
                                id => id !== category.id
                              )

                          updateForm('category_ids', ids)
                        }}
                      />
                      {category.name}
                    </label>
                  ))}
                </div>
              </div>

              <div className="voucher-modal-section">
                <h4>Áp dụng theo món ăn</h4>
                <p>
                  Không chọn món nào nghĩa là không giới hạn theo món ăn.
                </p>

                <div className="voucher-option-list voucher-food-list">
                  {foods.map(food => (
                    <label key={food.id}>
                      <input
                        type="checkbox"
                        checked={form.food_ids.includes(food.id)}
                        onChange={event => {
                          const ids = event.target.checked
                            ? [...form.food_ids, food.id]
                            : form.food_ids.filter(id => id !== food.id)

                          updateForm('food_ids', ids)
                        }}
                      />

                      <span>
                        {food.name}
                        <small>
                          {food.category_name || 'Chưa phân loại'}
                          {' · '}
                          {formatMoney(food.sale_price ?? food.price)}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="voucher-modal-footer">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  className="voucher-primary-btn"
                  disabled={saving}
                >
                  {saving ? 'Đang lưu...' : 'Lưu Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
