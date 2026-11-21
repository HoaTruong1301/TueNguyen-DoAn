import { useEffect, useRef, useState, type FormEvent } from 'react'
import './FoodManagement.css'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '')
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '')

type Category = {
  id: string
  name: string
}

type Food = {
  id: string
  category_id: string
  category_name?: string
  name: string
  description?: string | null
  price: number
  sale_price?: number | null
  image_url?: string | null
  status: 'available' | 'unavailable'
}

type FoodOption = {
  id?: string
  name: string
  price_adjustment: number
  is_default: boolean
  is_available: boolean
  sort_order: number
}

type FoodOptionGroup = {
  id?: string
  name: string
  selection_type: 'single' | 'multiple'
  is_required: boolean
  min_select: number
  max_select: number | null
  sort_order: number
  options: FoodOption[]
}

type FoodForm = {
  category_id: string
  name: string
  price: string
  sale_price: string
  description: string
  image: File | null
}

type Props = {
  token: string
}

const emptyForm: FoodForm = {
  category_id: '',
  name: '',
  price: '',
  sale_price: '',
  description: '',
  image: null,
}

const defaultToppingGroup: FoodOptionGroup = {
  name: 'Topping',
  selection_type: 'multiple',
  is_required: false,
  min_select: 0,
  max_select: null,
  sort_order: 0,
  options: [
    {
      name: 'Trân châu',
      price_adjustment: 0,
      is_default: false,
      is_available: true,
      sort_order: 0,
    },
    {
      name: 'Sương sáo',
      price_adjustment: 0,
      is_default: false,
      is_available: true,
      sort_order: 1,
    },
    {
      name: 'Thạch quế hoa',
      price_adjustment: 0,
      is_default: false,
      is_available: true,
      sort_order: 2,
    },
  ],
}

async function request(path: string, token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error?.message || payload.message || `Lỗi yêu cầu (${response.status})`)
  }

  return payload
}

function getItems<T>(payload: any): T[] {
  const data = payload?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.foods)) return data.foods
  if (Array.isArray(data?.categories)) return data.categories
  if (Array.isArray(payload?.items)) return payload.items
  return []
}

function imageUrl(url?: string | null) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`
}

function money(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

export default function FoodManagement({ token }: Props) {
  const [foods, setFoods] = useState<Food[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [keyword, setKeyword] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Food | null>(null)
  const [form, setForm] = useState<FoodForm>(emptyForm)
  const [preview, setPreview] = useState('')
  const [optionGroups, setOptionGroups] = useState<FoodOptionGroup[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
  if (showForm && editing) {
    formRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }
}, [showForm, editing])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [foodResult, categoryResult] = await Promise.all([
        request('/admin/foods', token),
        request('/admin/food-categories', token),
      ])
      setFoods(getItems<Food>(foodResult))
      setCategories(getItems<Category>(categoryResult))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được thực đơn.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [token])

  function openCreate() {
  setEditing(null)
  setForm({
    ...emptyForm,
    category_id: categories[0]?.id || '',
  })
  setPreview('')
  setOptionGroups([
    {
      ...defaultToppingGroup,
      options: defaultToppingGroup.options.map((option) => ({ ...option })),
    },
  ])
  setShowForm(true)
  setError('')
  setSuccess('')
}

  async function openEdit(food: Food) {
  setEditing(food)
  setForm({
    category_id: food.category_id,
    name: food.name,
    price: String(food.price ?? ''),
    sale_price: food.sale_price ? String(food.sale_price) : '',
    description: food.description || '',
    image: null,
  })

  setPreview(food.image_url ? imageUrl(food.image_url) : '')
  setOptionGroups([])
  setLoadingOptions(true)
  setShowForm(true)
  setError('')
  setSuccess('')

  try {
    const result = await request(
      `/admin/foods/${encodeURIComponent(food.id)}/options`,
      token,
    )

    const groups = Array.isArray(result.data)
      ? result.data
      : Array.isArray(result.data?.groups)
        ? result.data.groups
        : []

    setOptionGroups(groups)
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : 'Không tải được danh sách topping.',
    )
  } finally {
    setLoadingOptions(false)
  }
}

  function chooseImage(file: File | null) {
    setForm((current) => ({ ...current, image: file }))
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview)
    setPreview(file ? URL.createObjectURL(file) : (editing?.image_url ? imageUrl(editing.image_url) : ''))
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.category_id || !form.name.trim() || !form.price || Number(form.price) <= 0) {
      setError('Vui lòng chọn danh mục, nhập tên món và giá hợp lệ.')
      return
    }

    setSaving(true)
    try {
      const body = new FormData()
      body.append('category_id', form.category_id)
      body.append('name', form.name.trim())
      body.append('price', form.price)
      body.append('sale_price', form.sale_price)
      body.append('description', form.description)
      if (form.image) body.append('image', form.image)

      const path = editing
        ? `/admin/foods/${encodeURIComponent(editing.id)}`
        : '/admin/foods'

            const foodResult = await request(path, token, {
        method: editing ? 'PUT' : 'POST',
        body,
      })

      const foodId = editing?.id || foodResult.data?.id

      if (!foodId) {
        throw new Error('Không lấy được ID món ăn để lưu topping.')
      }

      await request(`/admin/foods/${encodeURIComponent(foodId)}/options`, token, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groups: optionGroups.map((group, groupIndex) => ({
            ...group,
            name: group.name.trim(),
            sort_order: groupIndex,
            options: group.options
              .filter((option) => option.name.trim() !== '')
              .map((option, optionIndex) => ({
                ...option,
                name: option.name.trim(),
                price_adjustment: Number(option.price_adjustment) || 0,
                sort_order: optionIndex,
              })),
          })),
        }),
      })

      setSuccess(
        editing
          ? 'Đã cập nhật món ăn và topping.'
          : 'Đã thêm món ăn và topping thành công.',
      )
      setShowForm(false)
      setForm(emptyForm)
      setPreview('')
      setOptionGroups([
        {
          ...defaultToppingGroup,
          options: defaultToppingGroup.options.map((option) => ({ ...option })),
        },
      ])
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được món ăn.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(food: Food) {
    const nextStatus = food.status === 'available' ? 'unavailable' : 'available'
    if (!window.confirm(nextStatus === 'unavailable' ? `Ẩn món "${food.name}"?` : `Hiện lại món "${food.name}"?`)) return

    setError('')
    setSuccess('')
    try {
      await request(`/admin/foods/${encodeURIComponent(food.id)}/status`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      setSuccess(nextStatus === 'unavailable' ? 'Đã ẩn món ăn.' : 'Đã hiển thị món ăn.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được trạng thái.')
    }
  }

  async function deleteFood(food: Food) {
    if (!window.confirm(`Bạn chắc chắn muốn xóa món "${food.name}"?`)) return

    setError('')
    setSuccess('')
    try {
      await request(`/admin/foods/${encodeURIComponent(food.id)}`, token, {
        method: 'DELETE',
      })
      setSuccess('Đã xóa món ăn.')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được món ăn.')
    }
  }

  const filteredFoods = foods.filter((food) =>
    food.name.toLowerCase().includes(keyword.trim().toLowerCase()),
  )

  return (
    <div className="food-page">
      <div className="food-page-heading">
        <div>
          <div className="food-eyebrow">QUẢN LÝ SẢN PHẨM</div>
          <h1>Quản lý thực đơn</h1>
          <p>Thêm món ăn, cập nhật giá bán và hình ảnh hiển thị cho khách hàng.</p>
        </div>
        <button className="food-primary-button" onClick={openCreate} type="button">
          + Thêm món mới
        </button>
      </div>

      {error && <div className="food-alert food-alert-error">{error}</div>}
      {success && <div className="food-alert food-alert-success">{success}</div>}

      <div className="food-toolbar">
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Tìm món ăn theo tên..."
        />
        <button type="button" onClick={() => void loadData()}>Làm mới</button>
        <span>{filteredFoods.length} món ăn</span>
      </div>

      {showForm && (
        <form ref={formRef} className="food-form-card" onSubmit={submitForm} >
          <div className="food-form-heading">
            <h2>{editing ? 'Cập nhật món ăn' : 'Thêm món ăn mới'}</h2>
            <button type="button" className="food-close-button" onClick={() => setShowForm(false)}>×</button>
          </div>

          {loadingOptions && (
            <div className="food-empty">
              Đang tải danh sách topping...
            </div>
          )}

          <div className="food-form-grid">
            <label>
              Danh mục *
              <select
                value={form.category_id}
                onChange={(event) => setForm({ ...form, category_id: event.target.value })}
                required
              >
                <option value="">-- Chọn danh mục --</option>
                {categories.map((category) => (
                  <option value={category.id} key={category.id}>{category.name}</option>
                ))}
              </select>
            </label>

            <label>
              Tên món *
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Nhập tên món ăn"
                required
              />
            </label>

            <label>
              Giá bán (VNĐ) *
              <input
                type="number"
                min="1"
                step="any"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
                placeholder="Ví dụ: 89000"
                required
              />
            </label>

            <label>
              Giá khuyến mãi (VNĐ)
              <input
                type="number"
                min="0"
                step="any"
                value={form.sale_price}
                onChange={(event) => setForm({ ...form, sale_price: event.target.value })}
                placeholder="Có thể để trống"
              />
            </label>

            <label className="food-full-width">
              Mô tả món ăn
              <textarea
                rows={3}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="Nhập mô tả món ăn..."
              />
            </label>

            <label className="food-full-width">
              Hình ảnh món ăn (JPG, PNG, WEBP – tối đa 5MB)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => chooseImage(event.target.files?.[0] || null)}
              />
            </label>

            {preview && (
              <div className="food-image-preview food-full-width">
                <img src={preview} alt="Ảnh xem trước món ăn" />
                <span>Ảnh xem trước</span>
              </div>
            )}
          </div>

                    <div className="food-options-section food-full-width">
            <div className="food-options-heading">
              <div>
                <h3>Tùy chọn món ăn</h3>
                <p>Quản lý topping và giá cộng thêm cho món ăn.</p>
              </div>
            </div>

            {loadingOptions ? (
              <div className="food-empty">Đang tải danh sách topping...</div>
            ) : (
              optionGroups.map((group, groupIndex) => (
                <div className="food-option-group" key={group.id || groupIndex}>
                  <div className="food-option-group-heading">
                    <strong>{group.name}</strong>
                    <span>
                      {group.selection_type === 'multiple'
                        ? 'Được chọn nhiều'
                        : 'Chỉ chọn một'}
                    </span>
                  </div>


                  {group.options.map((option, optionIndex) => (
                    <div
                      className="food-option-row"
                      key={option.id || `${groupIndex}-${optionIndex}`}
                    >
                      <label className="food-option-name">
                        <input
                          type="checkbox"
                          checked={option.is_available}
                          onChange={(event) => {
                            setOptionGroups((current) =>
                              current.map((item, index) =>
                                index === groupIndex
                                  ? {
                                      ...item,
                                      options: item.options.map((opt, i) =>
                                        i === optionIndex
                                          ? { ...opt, is_available: event.target.checked }
                                          : opt,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }}
                        />

                        <input
                          type="text"
                          value={option.name}
                          placeholder="Tên topping"
                          onChange={(event) => {
                            const name = event.target.value
                            setOptionGroups((current) =>
                              current.map((item, index) =>
                                index === groupIndex
                                  ? {
                                      ...item,
                                      options: item.options.map((opt, i) =>
                                        i === optionIndex ? { ...opt, name } : opt,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }}
                        />
                      </label>

                      <label className="food-option-price">
                        Giá cộng thêm (VNĐ)
                        <input
                          type="number"
                          min="0"
                          value={option.price_adjustment}
                          onChange={(event) => {
                            const price = Number(event.target.value)
                            setOptionGroups((current) =>
                              current.map((item, index) =>
                                index === groupIndex
                                  ? {
                                      ...item,
                                      options: item.options.map((opt, i) =>
                                        i === optionIndex
                                          ? { ...opt, price_adjustment: price }
                                          : opt,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        className="food-delete-button"
                        onClick={() => {
                          setOptionGroups((current) =>
                            current.map((item, index) =>
                              index === groupIndex
                                ? {
                                    ...item,
                                    options: item.options.filter((_, i) => i !== optionIndex),
                                  }
                                : item,
                            ),
                          )
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  ))}


                  <button
                    type="button"
                    className="food-cancel-button"
                    onClick={() => {
                      setOptionGroups((current) =>
                        current.map((item, index) =>
                          index === groupIndex
                            ? {
                                ...item,
                                options: [
                                  ...item.options,
                                  {
                                    name: '',
                                    price_adjustment: 0,
                                    is_default: false,
                                    is_available: true,
                                    sort_order: item.options.length,
                                  },
                                ],
                              }
                            : item,
                        ),
                      )
                    }}
                  >
                    + Thêm topping
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="food-form-actions">
            <button type="button" className="food-cancel-button" onClick={() => setShowForm(false)}>
              Hủy
            </button>
            <button type="submit" className="food-primary-button" disabled={saving}>
              {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm món ăn'}
            </button>
          </div>
        </form>
      )}

      <div className="food-table-card">
        {loading ? (
          <div className="food-empty">Đang tải thực đơn...</div>
        ) : filteredFoods.length === 0 ? (
          <div className="food-empty">Chưa có món ăn phù hợp.</div>
        ) : (
          <div className="food-table-scroll">
            <table className="food-table">
              <thead>
                <tr>
                  <th>HÌNH ẢNH</th>
                  <th>TÊN MÓN</th>
                  <th>DANH MỤC</th>
                  <th>GIÁ BÁN</th>
                  <th>TRẠNG THÁI</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {filteredFoods.map((food) => (
                  <tr key={food.id}>
                    <td>
                      {food.image_url ? (
                        <img className="food-thumbnail" src={imageUrl(food.image_url)} alt={food.name} />
                      ) : (
                        <div className="food-no-image">Chưa có ảnh</div>
                      )}
                    </td>
                    <td>
                      <strong>{food.name}</strong>
                      {food.description && <small className="food-description">{food.description}</small>}
                    </td>
                    <td>{food.category_name || categories.find((item) => item.id === food.category_id)?.name || '—'}</td>
                    <td>
                      <strong>{money(food.sale_price || food.price)}</strong>
                      {food.sale_price && <small className="food-old-price">{money(food.price)}</small>}
                    </td>
                    <td>
                      <span className={`food-status ${food.status === 'available' ? 'is-available' : 'is-hidden'}`}>
                        {food.status === 'available' ? 'Đang bán' : 'Đã ẩn'}
                      </span>
                    </td>
                    <td>
                      <div className="food-row-actions">
                        <button type="button" onClick={() => openEdit(food)}>Sửa</button>
                        <button type="button" onClick={() => void toggleStatus(food)}>
                          {food.status === 'available' ? 'Ẩn' : 'Hiện'}
                        </button>
                        <button type="button" className="food-delete-button" onClick={() => void deleteFood(food)}>Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
