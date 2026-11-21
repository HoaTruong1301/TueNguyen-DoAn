
import { useCallback, useEffect, useState } from 'react'
import './ReviewManagement.css'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'
).replace(/\/$/, '')

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'hidden' | 'deleted'
type ReviewType = 'food' | 'order' | 'delivery' | 'reservation' | 'service'

type ReviewImage = {
  id?: string
  image_url?: string | null
}

type Review = {
  id: string
  user_id: string
  customer_name?: string | null
  order_id?: string | null
  food_id?: string | null
  reservation_id?: string | null
  review_type: ReviewType
  rating: number
  title?: string | null
  content?: string | null
  status: ReviewStatus
  is_verified_purchase: boolean
  is_featured: boolean
  admin_note?: string | null
  moderated_by?: string | null
  moderated_at?: string | null
  created_at: string
  updated_at: string
  images: ReviewImage[]
  reply_id?: string | null
  reply_content?: string | null
  reply_status?: string | null
  reply_updated_at?: string | null
}

type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

type ReviewSummary = {
  total: number
  pending: number
  approved: number
  rejected: number
  hidden: number
  average_rating: number
}

type Props = {
  token: string
}

type ApiResult<T> = {
  success: boolean
  data?: T
  pagination?: Pagination
  summary?: ReviewSummary
  message?: string
}

const statusLabels: Record<ReviewStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  hidden: 'Đã ẩn',
  deleted: 'Đã xóa',
}

const typeLabels: Record<ReviewType, string> = {
  food: 'Món ăn',
  order: 'Đơn hàng',
  delivery: 'Giao hàng',
  reservation: 'Đặt bàn',
  service: 'Dịch vụ',
}

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)

  if (options.body) {
    headers.set('Content-Type', 'application/json; charset=utf-8')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Yêu cầu thất bại (${response.status})`)
  }

  return payload as T
}

function formatDate(value: string) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function ReviewManagement({ token }: Props) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [summary, setSummary] = useState<ReviewSummary>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    hidden: 0,
    average_rating: 0,
  })
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  const [status, setStatus] = useState('pending')
  const [reviewType, setReviewType] = useState('all')
  const [rating, setRating] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [selected, setSelected] = useState<Review | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [replyContent, setReplyContent] = useState('')

  const loadReviews = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      })

      if (status !== 'all') params.set('status', status)
      if (reviewType !== 'all') params.set('reviewType', reviewType)
      if (rating !== 'all') params.set('rating', rating)
      if (keyword.trim()) params.set('search', keyword.trim())

      const result = await request<ApiResult<Review[]>>(
        `/review/admin?${params.toString()}`,
        token,
      )

      setReviews(result.data || [])
      setSummary(result.summary || {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        hidden: 0,
        average_rating: 0,
      })
      setPagination(result.pagination || {
        page,
        limit: 20,
        total: 0,
        totalPages: 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải đánh giá.')
    } finally {
      setLoading(false)
    }
  }, [token, page, status, reviewType, rating, keyword])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews])

  const openDetail = (review: Review) => {
  setSelected(review)
  setAdminNote(review.admin_note || '')
  setReplyContent(review.reply_content || '')
  setError('')
  setSuccess('')
}

  const moderate = async (nextStatus: 'approved' | 'rejected' | 'hidden') => {
    if (!selected) return

    const confirmMessages = {
      approved: 'Bạn muốn duyệt đánh giá này?',
      rejected: 'Bạn muốn từ chối đánh giá này?',
      hidden: 'Bạn muốn ẩn đánh giá này?',
    }

    if (!window.confirm(confirmMessages[nextStatus])) return

    setSaving(true)
    setError('')

    try {
      await request(
        `/review/admin/${selected.id}/moderate`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: nextStatus,
            adminNote: adminNote.trim(),
          }),
        },
      )

      setSuccess('Cập nhật trạng thái đánh giá thành công.')
      setSelected(null)
      await loadReviews()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật đánh giá.')
    } finally {
      setSaving(false)
    }
  }


  const saveReply = async () => {
    if (!selected) return

    const content = replyContent.trim()

    if (!content) {
      setError('Vui lòng nhập nội dung phản hồi.')
      return
    }

    if (content.length > 5000) {
      setError('Nội dung phản hồi không được vượt quá 5000 ký tự.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const result = await request<
        ApiResult<{
          id: string
          content: string
          status: string
          updated_at: string
        }>
      >(
        `/review/admin/${selected.id}/reply`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({ content }),
        },
      )

      const reply = result.data

      setSelected((prev) =>
        prev
          ? {
              ...prev,
              reply_id: reply?.id || prev.reply_id,
              reply_content: reply?.content || content,
              reply_status: reply?.status || 'published',
              reply_updated_at: reply?.updated_at || prev.reply_updated_at,
            }
          : prev,
      )

      setReplyContent(reply?.content || content)
      setSuccess('Phản hồi đánh giá thành công.')

      await loadReviews()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể gửi phản hồi đánh giá.',
      )
    } finally {
      setSaving(false)
    }
  }


  const renderStars = (value: number) => (
    <span className="review-stars" aria-label={`${value} trên 5 sao`}>
      {'★'.repeat(value)}
      <span>{'★'.repeat(5 - value)}</span>
    </span>
  )

  return (
    <section className="page-content review-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CHĂM SÓC KHÁCH HÀNG</div>
          <h1>Quản lý đánh giá</h1>
          <p>Quản lý và kiểm duyệt đánh giá từ khách hàng.</p>
        </div>

        <button
          className="review-refresh"
          type="button"
          onClick={() => void loadReviews()}
          disabled={loading}
        >
          ↻ Làm mới
        </button>
      </div>

      <div className="review-summary">
        <div>
          <span>Tổng đánh giá</span>
          <strong>{summary.total}</strong>
        </div>

        <div>
          <span>Chờ duyệt</span>
          <strong>{summary.pending}</strong>
        </div>

        <div>
          <span>Đã duyệt</span>
          <strong>{summary.approved}</strong>
        </div>

        <div>
          <span>Từ chối</span>
          <strong>{summary.rejected}</strong>
        </div>

        <div>
          <span>Đã ẩn</span>
          <strong>{summary.hidden}</strong>
        </div>

        <div>
          <span>Điểm trung bình</span>
          <strong>{Number(summary.average_rating).toFixed(2)} / 5</strong>
        </div>
      </div>

      <div className="review-filters">
        <input
          value={keyword}
          placeholder="Tìm tên khách hàng hoặc nội dung..."
          onChange={(event) => {
            setKeyword(event.target.value)
            setPage(1)
          }}
        />

        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="pending">Chờ duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="rejected">Từ chối</option>
          <option value="hidden">Đã ẩn</option>
        </select>

        <select
          value={reviewType}
          onChange={(event) => {
            setReviewType(event.target.value)
            setPage(1)
          }}
        >
          <option value="all">Tất cả loại đánh giá</option>
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          value={rating}
          onChange={(event) => {
            setRating(event.target.value)
            setPage(1)
          }}
        >
          <option value="all">Tất cả số sao</option>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>{value} sao</option>
          ))}
        </select>
      </div>

      {error && <div className="review-alert error">{error}</div>}
      {success && <div className="review-alert success">{success}</div>}

      <div className="review-table-scroll">
        <table className="review-table">
          <thead>
            <tr>
              <th>KHÁCH HÀNG</th>
              <th>LOẠI ĐÁNH GIÁ</th>
              <th>ĐIỂM</th>
              <th>NỘI DUNG</th>
              <th>TRẠNG THÁI</th>
              <th>NGÀY GỬI</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="review-empty">Đang tải đánh giá...</td></tr>
            ) : reviews.length === 0 ? (
              <tr><td colSpan={7} className="review-empty">Không có đánh giá phù hợp.</td></tr>
            ) : reviews.map((review) => (
              <tr key={review.id}>
                <td>
                  <strong>{review.customer_name || 'Khách hàng'}</strong>
                  <small>{review.is_verified_purchase ? 'Đã xác thực' : 'Chưa xác thực'}</small>
                </td>
                <td>{typeLabels[review.review_type] || review.review_type}</td>
                <td>{renderStars(review.rating)}</td>
                <td className="review-content-cell">
                  {review.title && <strong>{review.title}</strong>}
                  <span>{review.content || 'Không có nội dung'}</span>
                </td>
                <td>
                  <span className={`review-status ${review.status}`}>
                    {statusLabels[review.status] || review.status}
                  </span>
                </td>
                <td>{formatDate(review.created_at)}</td>
                <td>
                  <button
                    className="review-detail-button"
                    type="button"
                    onClick={() => openDetail(review)}
                  >
                    Chi tiết
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="review-pagination">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((value) => value - 1)}
        >
          ← Trước
        </button>
        <span>
          Trang {pagination.page} / {Math.max(pagination.totalPages, 1)}
        </span>
        <button
          type="button"
          disabled={page >= pagination.totalPages || loading}
          onClick={() => setPage((value) => value + 1)}
        >
          Sau →
        </button>
      </div>

      {selected && (
        <div className="review-overlay" onClick={() => setSelected(null)}>
          <div
            className="review-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="review-modal-heading">
              <div>
                <span>CHI TIẾT ĐÁNH GIÁ</span>
                <h2>{selected.customer_name || 'Khách hàng'}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)}>×</button>
            </div>

            <div className="review-modal-body">
              <div className="review-detail-grid">
                <div><span>Loại đánh giá</span><strong>{typeLabels[selected.review_type]}</strong></div>
                <div><span>Điểm đánh giá</span><strong>{renderStars(selected.rating)}</strong></div>
                <div><span>Trạng thái</span><strong>{statusLabels[selected.status]}</strong></div>
                <div><span>Ngày gửi</span><strong>{formatDate(selected.created_at)}</strong></div>
              </div>

              {selected.order_id && (
                <div className="review-detail-field">
                  <span>Mã đơn hàng (ID)</span>
                  <strong>{selected.order_id}</strong>
                </div>
              )}

              {selected.title && (
                <div className="review-detail-field">
                  <span>Tiêu đề</span>
                  <strong>{selected.title}</strong>
                </div>
              )}

              <div className="review-detail-field">
                <span>Nội dung đánh giá</span>
                <p>{selected.content || 'Khách hàng không để lại nội dung.'}</p>
              </div>

              {selected.images?.length > 0 && (
                <div className="review-detail-field">
                  <span>Hình ảnh đính kèm</span>
                  <div className="review-images">
                    {selected.images.map((image, index) => (
                      image.image_url ? (
                        <a
                          key={image.id || index}
                          href={image.image_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img src={image.image_url} alt={`Ảnh đánh giá ${index + 1}`} />
                        </a>
                      ) : null
                    ))}
                  </div>
                </div>
              )}

              <div className="review-detail-field">
                <label htmlFor="review-admin-note">Ghi chú kiểm duyệt</label>
                <textarea
                  id="review-admin-note"
                  rows={4}
                  maxLength={2000}
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  placeholder="Nhập ghi chú cho đánh giá..."
                />
                            </div>

              {selected.status === 'approved' && (
                <div className="review-detail-field">
                  <label htmlFor="review-reply-content">
                    Phản hồi chính thức của Tuệ Nguyên
                  </label>

                  <textarea
                    id="review-reply-content"
                    rows={5}
                    maxLength={5000}
                    value={replyContent}
                    onChange={(event) => setReplyContent(event.target.value)}
                    placeholder="Nhập nội dung phản hồi khách hàng..."
                  />

                  <small>
                    {replyContent.length}/5000 ký tự
                  </small>

                  {selected.reply_content && (
                    <small>
                      Phản hồi hiện tại: {selected.reply_status === 'published' ? 'Đã đăng' : selected.reply_status}
                    </small>
                  )}

                  <button
                    type="button"
                    className="review-action approve"
                    disabled={saving || !replyContent.trim()}
                    onClick={() => void saveReply()}
                  >
                    {saving
                      ? 'Đang lưu...'
                      : selected.reply_id
                        ? 'Cập nhật phản hồi'
                        : 'Gửi phản hồi'}
                  </button>
                </div>
              )}

              <div className="review-modal-actions">
                {selected.status !== 'approved' && (
                  <button
                    type="button"
                    className="review-action approve"
                    disabled={saving}
                    onClick={() => void moderate('approved')}
                  >
                    Duyệt
                  </button>
                )}
                {selected.status !== 'rejected' && (
                  <button
                    type="button"
                    className="review-action reject"
                    disabled={saving}
                    onClick={() => void moderate('rejected')}
                  >
                    Từ chối
                  </button>
                )}
                {selected.status !== 'hidden' && (
                  <button
                    type="button"
                    className="review-action hide"
                    disabled={saving}
                    onClick={() => void moderate('hidden')}
                  >
                    Ẩn đánh giá
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default ReviewManagement
