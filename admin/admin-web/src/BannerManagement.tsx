
import { useEffect, useState } from 'react'
import './BannerManagement.css'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:3000/api/v1'
).replace(/\/$/, '')

interface Banner {
  id: string
  title: string
  subtitle: string | null
  image_url: string
  mobile_image_url: string | null
  action_type: string
  action_value: string | null
  sort_order: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  created_at: string
}

interface Props {
  token: string
}

interface BannerForm {
  title: string
  subtitle: string
  image_url: string
  mobile_image_url: string
  action_type: string
  action_value: string
  sort_order: number
  starts_at: string
  ends_at: string
  is_active: boolean
}

const emptyForm: BannerForm = {
  title: '',
  subtitle: '',
  image_url: '',
  mobile_image_url: '',
  action_type: 'none',
  action_value: '',
  sort_order: 0,
  starts_at: '',
  ends_at: '',
  is_active: true,
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
    throw new Error(result.message || 'Có lỗi xảy ra')
  }

  return result
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('vi-VN')
}

async function uploadBannerImage(
  file: File,
  token: string
): Promise<string> {
  const formData = new FormData()
  formData.append('image', file)

  const response = await fetch(
    `${API_BASE_URL}/admin/banners/upload`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  )

  const result = await response.json()

  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Không thể tải ảnh lên')
  }

  return result.data.image_url
}

function toDateTimeLocal(value: string | null) {
  if (!value) return ''

  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000

  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 16)
}

export default function BannerManagement({ token }: Props) {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingBanner, setEditingBanner] =
    useState<Banner | null>(null)

  const [form, setForm] = useState<BannerForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingMobileImage, setUploadingMobileImage] = useState(false) 

  async function loadBanners() {
    setLoading(true)
    setError('')

    try {
      const result = await request<{
        success: boolean
        data: Banner[]
      }>('/admin/banners', token)

      setBanners(result.data || [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tải danh sách Banner'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBanners()
  }, [token])

  function openCreate() {
    setEditingBanner(null)
    setForm(emptyForm)
    setShowModal(true)
    setError('')
    setSuccess('')
  }

  function openEdit(banner: Banner) {
    setEditingBanner(banner)

    setForm({
      title: banner.title,
      subtitle: banner.subtitle || '',
      image_url: banner.image_url,
      mobile_image_url: banner.mobile_image_url || '',
      action_type: banner.action_type || 'none',
      action_value: banner.action_value || '',
      sort_order: banner.sort_order || 0,
      starts_at: toDateTimeLocal(banner.starts_at),
      ends_at: toDateTimeLocal(banner.ends_at),
      is_active: banner.is_active,
    })

    setShowModal(true)
    setError('')
    setSuccess('')
  }

  function updateForm<K extends keyof BannerForm>(
    key: K,
    value: BannerForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  async function handleImageChange(
    file: File | undefined,
    type: 'desktop' | 'mobile'
    ) {
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP')
        return
    }

    if (file.size > 5 * 1024 * 1024) {
        setError('Kích thước ảnh không được vượt quá 5MB')
        return
    }

    const setUploading =
        type === 'desktop'
        ? setUploadingImage
        : setUploadingMobileImage

    const field = type === 'desktop'
        ? 'image_url'
        : 'mobile_image_url'

    setUploading(true)
    setError('')
    setSuccess('')

    try {
        const imageUrl = await uploadBannerImage(file, token)
        updateForm(field, imageUrl)
        setSuccess('Tải ảnh lên thành công')
    } catch (err) {
        setError(
        err instanceof Error ? err.message : 'Không thể tải ảnh lên'
        )
    } finally {
        setUploading(false)
    }
    }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        ...form,
        subtitle: form.subtitle || null,
        mobile_image_url: form.mobile_image_url || null,
        action_value: form.action_value || null,
        starts_at: form.starts_at
          ? new Date(form.starts_at).toISOString()
          : null,
        ends_at: form.ends_at
          ? new Date(form.ends_at).toISOString()
          : null,
      }

      if (editingBanner) {
        await request(
          `/admin/banners/${editingBanner.id}`,
          token,
          'PATCH',
          payload
        )
      } else {
        await request(
          '/admin/banners',
          token,
          'POST',
          payload
        )
      }

      setShowModal(false)
      setSuccess(
        editingBanner
          ? 'Cập nhật Banner thành công'
          : 'Tạo Banner thành công'
      )

      await loadBanners()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể lưu Banner'
      )
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(banner: Banner) {
    setError('')
    setSuccess('')

    try {
      await request(
        `/admin/banners/${banner.id}/status`,
        token,
        'PATCH',
        { is_active: !banner.is_active }
      )

      setSuccess('Cập nhật trạng thái thành công')
      await loadBanners()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật trạng thái'
      )
    }
  }

  async function deleteBanner(banner: Banner) {
    const confirmed = window.confirm(
      `Bạn có chắc muốn xóa Banner "${banner.title}"?`
    )

    if (!confirmed) return

    setError('')
    setSuccess('')

    try {
      await request(
        `/admin/banners/${banner.id}`,
        token,
        'DELETE'
      )

      setSuccess('Xóa Banner thành công')
      await loadBanners()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể xóa Banner'
      )
    }
  }

  return (
    <div className="banner-page">
      <div className="banner-header">
        <div>
          <h2>Quản lý Banner</h2>
          <p>Quản lý hình ảnh quảng bá trên ứng dụng</p>
        </div>

        <div className="banner-header-right">
          <div className="banner-total">
            <span>Tổng Banner</span>
            <strong>{banners.length}</strong>
          </div>

          <button
            type="button"
            className="banner-add-button"
            onClick={openCreate}
          >
            + Thêm Banner
          </button>
        </div>
      </div>

      {error && <div className="banner-error">{error}</div>}
      {success && <div className="banner-success">{success}</div>}

      <div className="banner-table-wrapper">
        <table className="banner-table">
          <thead>
            <tr>
              <th>Hình ảnh</th>
              <th>Thông tin Banner</th>
              <th>Liên kết</th>
              <th>Thứ tự</th>
              <th>Thời gian</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="banner-empty">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : banners.length === 0 ? (
              <tr>
                <td colSpan={7} className="banner-empty">
                  Chưa có Banner nào
                </td>
              </tr>
            ) : (
              banners.map((banner) => (
                <tr key={banner.id}>
                  <td>
                    <img
                        className="banner-thumbnail"
                        src={
                            banner.image_url.startsWith('http')
                            ? banner.image_url
                            : `http://localhost:3000${banner.image_url}`
                        }
                        alt={banner.title}
                        />
                  </td>

                  <td>
                    <div className="banner-info">
                      <strong>{banner.title}</strong>
                      <small>{banner.subtitle || 'Không có mô tả'}</small>
                    </div>
                  </td>

                  <td>
                    <span>{banner.action_type}</span>
                    <small className="banner-action-value">
                      {banner.action_value || '—'}
                    </small>
                  </td>

                  <td>{banner.sort_order}</td>

                  <td>
                    <small>
                      Từ: {formatDate(banner.starts_at)}
                    </small>
                    <small>
                      Đến: {formatDate(banner.ends_at)}
                    </small>
                  </td>

                  <td>
                    <button
                      type="button"
                      className={`banner-status ${banner.is_active ? 'active' : 'inactive'}`}
                      onClick={() => toggleStatus(banner)}
                    >
                      {banner.is_active ? 'Hoạt động' : 'Đã tắt'}
                    </button>
                  </td>

                  <td>
                    <div className="banner-actions">
                      <button
                        type="button"
                        onClick={() => openEdit(banner)}
                      >
                        Sửa
                      </button>

                      <button
                        type="button"
                        className="delete"
                        onClick={() => deleteBanner(banner)}
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

      {showModal && (
        <div
          className="banner-modal-overlay"
          onClick={() => setShowModal(false)}
        >
          <div
            className="banner-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="banner-modal-header">
              <div>
                <h3>
                  {editingBanner ? 'Chỉnh sửa Banner' : 'Thêm Banner mới'}
                </h3>
                <p>Nhập thông tin hiển thị Banner</p>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="banner-form-grid">
                <div className="banner-field full">
                  <label>Tiêu đề *</label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => updateForm('title', e.target.value)}
                    placeholder="Nhập tiêu đề Banner"
                  />
                </div>

                <div className="banner-field full">
                  <label>Mô tả</label>
                  <input
                    value={form.subtitle}
                    onChange={(e) => updateForm('subtitle', e.target.value)}
                    placeholder="Nhập mô tả"
                  />
                </div>

                <div className="banner-field full">
                    <label>Hình ảnh Banner *</label>

                    <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        required={!form.image_url}
                        disabled={uploadingImage}
                        onChange={(e) => {
                        handleImageChange(e.target.files?.[0], 'desktop')
                        e.target.value = ''
                        }}
                    />

                    {uploadingImage && (
                        <small>Đang tải ảnh lên...</small>
                    )}

                    {form.image_url && (
                        <div>
                        <img
                            className="banner-preview"
                            src={
                            form.image_url.startsWith('http')
                                ? form.image_url
                                : `http://localhost:3000${form.image_url}`
                            }
                            alt="Xem trước Banner"
                        />
                        </div>
                    )}
                    </div>

                {form.image_url && (
                  <div className="banner-field full">
                    <label>Xem trước</label>
                    <img
                      className="banner-preview"
                      src={form.image_url}
                      alt="Xem trước Banner"
                    />
                  </div>
                )}

                <div className="banner-field full">
                    <label>Hình ảnh Banner điện thoại</label>

                    <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={uploadingMobileImage}
                        onChange={(e) => {
                        handleImageChange(e.target.files?.[0], 'mobile')
                        e.target.value = ''
                        }}
                    />

                    {uploadingMobileImage && (
                        <small>Đang tải ảnh điện thoại lên...</small>
                    )}

                    {form.mobile_image_url && (
                        <div>
                        <img
                            className="banner-preview"
                            src={
                            form.mobile_image_url.startsWith('http')
                                ? form.mobile_image_url
                                : `http://localhost:3000${form.mobile_image_url}`
                            }
                            alt="Xem trước Banner điện thoại"
                        />
                        </div>
                    )}
                    </div>

                <div className="banner-field">
                  <label>Loại hành động</label>
                  <select
                    value={form.action_type}
                    onChange={(e) => updateForm('action_type', e.target.value)}
                  >
                    <option value="none">Không có</option>
                    <option value="url">Đường dẫn URL</option>
                    <option value="product">Sản phẩm</option>
                    <option value="category">Danh mục</option>
                    <option value="promotion">Khuyến mãi</option>
                  </select>
                </div>

                <div className="banner-field">
                  <label>Giá trị hành động</label>
                  <input
                    value={form.action_value}
                    onChange={(e) => updateForm('action_value', e.target.value)}
                    placeholder="URL hoặc ID liên kết"
                  />
                </div>

                <div className="banner-field">
                  <label>Thứ tự hiển thị</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => updateForm('sort_order', Number(e.target.value))}
                  />
                </div>

                <div className="banner-field">
                  <label>Trạng thái</label>
                  <select
                    value={form.is_active ? 'true' : 'false'}
                    onChange={(e) => updateForm('is_active', e.target.value === 'true')}
                  >
                    <option value="true">Hoạt động</option>
                    <option value="false">Tạm tắt</option>
                  </select>
                </div>

                <div className="banner-field">
                  <label>Ngày bắt đầu</label>
                  <input
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(e) => updateForm('starts_at', e.target.value)}
                  />
                </div>

                <div className="banner-field">
                  <label>Ngày kết thúc</label>
                  <input
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(e) => updateForm('ends_at', e.target.value)}
                  />
                </div>
              </div>

              <div className="banner-modal-footer">
                <button
                  type="button"
                  className="banner-cancel-button"
                  onClick={() => setShowModal(false)}
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  className="banner-save-button"
                  disabled={saving}
                >
                  {saving ? 'Đang lưu...' : 'Lưu Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
