import { useCallback, useEffect, useMemo, useState } from 'react'
import './InventoryManagement.css'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'
).replace(/\/$/, '')

type Warehouse = { id: string; code: string; name: string; is_sales_warehouse: boolean }
type Item = { id: string; sku: string; name: string; unit: string; category: string | null; min_stock: number; last_cost: number }
type StockRow = {
  warehouse_id: string
  warehouse_name: string
  item_id: string
  sku: string
  item_name: string
  unit: string
  min_stock: number
  last_cost: number
  quantity: number
  status: 'ok' | 'low' | 'negative'
}
type PO = {
  id: string
  po_code: string
  supplier_name: string
  status: 'ordered' | 'received' | 'cancelled'
  note: string | null
  total_amount: number
  created_at: string
  received_at: string | null
  warehouse_name: string
  items: { item_name: string; unit: string; quantity: number; unit_cost: number }[] | null
}
type Transfer = {
  id: string
  transfer_code: string
  note: string | null
  created_at: string
  from_name: string
  to_name: string
  created_by_email: string | null
  items: { item_name: string; unit: string; quantity: number }[] | null
}
type Movement = {
  id: string
  movement_type: string
  quantity: number
  balance_after: number
  reason: string | null
  created_at: string
  item_name: string
  unit: string
  warehouse_name: string
  created_by_email: string | null
}
type FoodRecipe = {
  id: string
  name: string
  recipe: { item_id: string; item_name: string; unit: string; quantity_per_serving: number }[]
}
type Line = { itemId: string; quantity: string; unitCost: string }

type Tab = 'stock' | 'receive' | 'orders' | 'transfer' | 'waste' | 'recipes' | 'history'

const TABS: { key: Tab; label: string }[] = [
  { key: 'stock', label: 'Tồn kho' },
  { key: 'receive', label: 'Nhập hàng' },
  { key: 'orders', label: 'Đặt hàng NCC' },
  { key: 'transfer', label: 'Điều chuyển' },
  { key: 'waste', label: 'Huỷ hàng' },
  { key: 'recipes', label: 'Công thức món' },
  { key: 'history', label: 'Lịch sử kho' },
]

const MOVEMENT_LABEL: Record<string, string> = {
  purchase_in: 'Nhập hàng',
  sale_out: 'Bán hàng (bill)',
  transfer_out: 'Chuyển đi',
  transfer_in: 'Chuyển đến',
  waste: 'Huỷ hàng',
  adjust: 'Điều chỉnh',
}

const PO_LABEL: Record<PO['status'], string> = {
  ordered: 'Chờ nhận hàng',
  received: 'Đã nhập kho',
  cancelled: 'Đã huỷ',
}

async function request<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/admin/inventory${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `Yêu cầu thất bại (${response.status})`)
  }
  return payload.data as T
}

const fmtNum = (n: number) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 3 })
const fmtMoney = (n: number) => `${Number(n).toLocaleString('vi-VN')} đ`
const fmtTime = (s: string) => new Date(s).toLocaleString('vi-VN')

const emptyLine = (): Line => ({ itemId: '', quantity: '', unitCost: '' })

function LinesEditor({
  items,
  lines,
  onChange,
  showCost,
}: {
  items: Item[]
  lines: Line[]
  onChange: (lines: Line[]) => void
  showCost?: boolean
}) {
  const update = (index: number, patch: Partial<Line>) =>
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)))

  return (
    <div className="inv-lines">
      {lines.map((line, index) => {
        const item = items.find((i) => i.id === line.itemId)
        return (
          <div className="inv-line" key={index}>
            <select
              value={line.itemId}
              onChange={(e) => {
                const next = items.find((i) => i.id === e.target.value)
                update(index, {
                  itemId: e.target.value,
                  unitCost: showCost && next && !line.unitCost ? String(next.last_cost) : line.unitCost,
                })
              }}
            >
              <option value="">— Chọn nguyên liệu —</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit})
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="any"
              placeholder={item ? `Số lượng (${item.unit})` : 'Số lượng'}
              value={line.quantity}
              onChange={(e) => update(index, { quantity: e.target.value })}
            />
            {showCost && (
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Đơn giá"
                value={line.unitCost}
                onChange={(e) => update(index, { unitCost: e.target.value })}
              />
            )}
            <button
              type="button"
              className="inv-icon-btn"
              aria-label="Xoá dòng"
              disabled={lines.length === 1}
              onClick={() => onChange(lines.filter((_, i) => i !== index))}
            >
              ✕
            </button>
          </div>
        )
      })}
      <button type="button" className="inv-link-btn" onClick={() => onChange([...lines, emptyLine()])}>
        + Thêm dòng
      </button>
    </div>
  )
}

function toPayload(lines: Line[], withCost: boolean) {
  return lines
    .filter((l) => l.itemId && Number(l.quantity) > 0)
    .map((l) => ({
      itemId: l.itemId,
      quantity: Number(l.quantity),
      ...(withCost ? { unitCost: Number(l.unitCost || 0) } : {}),
    }))
}

export default function InventoryManagement({ token }: { token: string }) {
  const [tab, setTab] = useState<Tab>('stock')
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const [stock, setStock] = useState<StockRow[]>([])
  const [stockWh, setStockWh] = useState('')
  const [onlyAlert, setOnlyAlert] = useState(false)
  const [pos, setPos] = useState<PO[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [moveType, setMoveType] = useState('')
  const [foods, setFoods] = useState<FoodRecipe[]>([])
  const [editFood, setEditFood] = useState<FoodRecipe | null>(null)
  const [recipeLines, setRecipeLines] = useState<Line[]>([emptyLine()])

  // form state
  const [supplier, setSupplier] = useState('')
  const [toWh, setToWh] = useState('')
  const [poNote, setPoNote] = useState('')
  const [poLines, setPoLines] = useState<Line[]>([emptyLine()])
  const [fromWh, setFromWh] = useState('')
  const [trNote, setTrNote] = useState('')
  const [trLines, setTrLines] = useState<Line[]>([emptyLine()])
  const [wasteWh, setWasteWh] = useState('')
  const [wasteReason, setWasteReason] = useState('')
  const [wasteLines, setWasteLines] = useState<Line[]>([emptyLine()])

  const run = useCallback(async (fn: () => Promise<void>, okText?: string) => {
    setBusy(true)
    setMessage(null)
    try {
      await fn()
      if (okText) setMessage({ type: 'ok', text: okText })
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Có lỗi xảy ra' })
    } finally {
      setBusy(false)
    }
  }, [])

  const loadStock = useCallback(
    () =>
      request<StockRow[]>(`/stock${stockWh ? `?warehouseId=${stockWh}` : ''}`, token).then(setStock),
    [token, stockWh],
  )

  useEffect(() => {
    void run(async () => {
      const [w, i] = await Promise.all([
        request<Warehouse[]>('/warehouses', token),
        request<Item[]>('/items', token),
      ])
      setWarehouses(w)
      setItems(i)
      setToWh((cur) => cur || w[0]?.id || '')
      setFromWh((cur) => cur || w[0]?.id || '')
      setWasteWh((cur) => cur || w.find((x) => x.is_sales_warehouse)?.id || w[0]?.id || '')
    })
  }, [token, run])

  useEffect(() => {
    void run(async () => {
      if (tab === 'stock') await loadStock()
      if (tab === 'orders' || tab === 'receive')
        setPos(await request<PO[]>('/purchase-orders', token))
      if (tab === 'transfer') setTransfers(await request<Transfer[]>('/transfers', token))
      if (tab === 'recipes') setFoods(await request<FoodRecipe[]>('/recipes', token))
      if (tab === 'history')
        setMovements(
          await request<Movement[]>(`/movements?limit=200${moveType ? `&type=${moveType}` : ''}`, token),
        )
    })
  }, [tab, token, run, loadStock, moveType])

  const alerts = useMemo(() => stock.filter((s) => s.status !== 'ok').length, [stock])
  const shownStock = onlyAlert ? stock.filter((s) => s.status !== 'ok') : stock

  const submitPo = (receiveNow: boolean) =>
    run(async () => {
      const payloadItems = toPayload(poLines, true)
      if (!supplier.trim()) throw new Error('Vui lòng nhập nhà cung cấp')
      if (!toWh) throw new Error('Vui lòng chọn kho nhận')
      if (payloadItems.length === 0) throw new Error('Cần ít nhất 1 dòng hàng hợp lệ')
      await request('/purchase-orders', token, {
        method: 'POST',
        body: JSON.stringify({
          supplierName: supplier,
          warehouseId: toWh,
          note: poNote,
          items: payloadItems,
          receiveNow,
        }),
      })
      setSupplier('')
      setPoNote('')
      setPoLines([emptyLine()])
      setPos(await request<PO[]>('/purchase-orders', token))
    }, receiveNow ? 'Đã nhập hàng và cộng vào tồn kho' : 'Đã tạo đơn đặt hàng')

  const poTotal = poLines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitCost || 0), 0)

  const renderPoForm = (receive: boolean) => (
    <div className="inv-card">
      <h3>{receive ? 'Phiếu nhập hàng' : 'Tạo đơn đặt hàng'}</h3>
      <div className="inv-grid">
        <label>
          Nhà cung cấp
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="VD: Chợ đầu mối, NCC rau sạch…" />
        </label>
        <label>
          Kho nhận
          <select value={toWh} onChange={(e) => setToWh(e.target.value)}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </label>
      </div>
      <LinesEditor items={items} lines={poLines} onChange={setPoLines} showCost />
      <label>
        Ghi chú
        <input value={poNote} onChange={(e) => setPoNote(e.target.value)} placeholder="Không bắt buộc" />
      </label>
      <div className="inv-actions">
        <strong>Tổng tiền: {fmtMoney(poTotal)}</strong>
        {receive ? (
          <button className="inv-primary" disabled={busy} onClick={() => void submitPo(true)}>
            Nhập kho ngay
          </button>
        ) : (
          <>
            <button className="inv-secondary" disabled={busy} onClick={() => void submitPo(false)}>
              Lưu đơn chờ nhận
            </button>
            <button className="inv-primary" disabled={busy} onClick={() => void submitPo(true)}>
              Đặt &amp; nhận hàng luôn
            </button>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="inv-page">
      <header className="inv-header">
        <div>
          <h1>Quản lý kho</h1>
          <p>Tồn kho tự trừ khi bấm hoàn tất bill; tự cộng khi nhận hàng từ nhà cung cấp.</p>
        </div>
      </header>

      <nav className="inv-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>

      {message && <div className={`inv-msg ${message.type}`}>{message.text}</div>}

      {tab === 'stock' && (
        <div className="inv-card">
          <div className="inv-toolbar">
            <select value={stockWh} onChange={(e) => setStockWh(e.target.value)}>
              <option value="">Tất cả kho</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <label className="inv-check">
              <input type="checkbox" checked={onlyAlert} onChange={(e) => setOnlyAlert(e.target.checked)} />
              Chỉ hiện hàng sắp hết / âm kho ({alerts})
            </label>
          </div>
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr><th>Kho</th><th>Nguyên liệu</th><th className="r">Tồn</th><th className="r">Tối thiểu</th><th>Tình trạng</th></tr>
              </thead>
              <tbody>
                {shownStock.map((s) => (
                  <tr key={`${s.warehouse_id}-${s.item_id}`}>
                    <td>{s.warehouse_name}</td>
                    <td>{s.item_name}</td>
                    <td className="r"><strong>{fmtNum(s.quantity)}</strong> {s.unit}</td>
                    <td className="r">{fmtNum(s.min_stock)} {s.unit}</td>
                    <td>
                      <span className={`inv-badge ${s.status}`}>
                        {s.status === 'ok' ? 'Đủ hàng' : s.status === 'low' ? 'Sắp hết' : 'Âm kho'}
                      </span>
                    </td>
                  </tr>
                ))}
                {shownStock.length === 0 && <tr><td colSpan={5} className="inv-empty">Chưa có dữ liệu</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'receive' && (
        <>
          {renderPoForm(true)}
          <div className="inv-card">
            <h3>Phiếu nhập gần đây</h3>
            <PoTable pos={pos.filter((p) => p.status === 'received').slice(0, 10)} />
          </div>
        </>
      )}

      {tab === 'orders' && (
        <>
          {renderPoForm(false)}
          <div className="inv-card">
            <h3>Danh sách đơn đặt hàng</h3>
            <PoTable
              pos={pos}
              onReceive={(id) =>
                void run(async () => {
                  await request(`/purchase-orders/${id}/receive`, token, { method: 'POST' })
                  setPos(await request<PO[]>('/purchase-orders', token))
                }, 'Đã nhận hàng, tồn kho đã được cộng')
              }
              onCancel={(id) =>
                void run(async () => {
                  await request(`/purchase-orders/${id}/cancel`, token, { method: 'POST' })
                  setPos(await request<PO[]>('/purchase-orders', token))
                }, 'Đã huỷ đơn đặt hàng')
              }
            />
          </div>
        </>
      )}

      {tab === 'transfer' && (
        <>
          <div className="inv-card">
            <h3>Phiếu điều chuyển kho</h3>
            <div className="inv-grid">
              <label>
                Từ kho
                <select value={fromWh} onChange={(e) => setFromWh(e.target.value)}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
              <label>
                Đến kho
                <select value={toWh} onChange={(e) => setToWh(e.target.value)}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
            </div>
            <LinesEditor items={items} lines={trLines} onChange={setTrLines} />
            <label>
              Ghi chú
              <input value={trNote} onChange={(e) => setTrNote(e.target.value)} placeholder="Không bắt buộc" />
            </label>
            <div className="inv-actions">
              <button
                className="inv-primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const payloadItems = toPayload(trLines, false)
                    if (fromWh === toWh) throw new Error('Kho xuất và kho nhận phải khác nhau')
                    if (payloadItems.length === 0) throw new Error('Cần ít nhất 1 dòng hàng hợp lệ')
                    await request('/transfers', token, {
                      method: 'POST',
                      body: JSON.stringify({ fromWarehouseId: fromWh, toWarehouseId: toWh, note: trNote, items: payloadItems }),
                    })
                    setTrLines([emptyLine()])
                    setTrNote('')
                    setTransfers(await request<Transfer[]>('/transfers', token))
                  }, 'Đã điều chuyển: kho xuất đã trừ, kho nhận đã cộng')
                }
              >
                Điều chuyển
              </button>
            </div>
          </div>
          <div className="inv-card">
            <h3>Lịch sử điều chuyển</h3>
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead><tr><th>Mã</th><th>Thời gian</th><th>Từ → Đến</th><th>Hàng</th><th>Người tạo</th></tr></thead>
                <tbody>
                  {transfers.map((t) => (
                    <tr key={t.id}>
                      <td>{t.transfer_code}</td>
                      <td>{fmtTime(t.created_at)}</td>
                      <td>{t.from_name} → {t.to_name}</td>
                      <td>{(t.items ?? []).map((i) => `${i.item_name} ×${fmtNum(i.quantity)} ${i.unit}`).join(', ')}</td>
                      <td>{t.created_by_email ?? '—'}</td>
                    </tr>
                  ))}
                  {transfers.length === 0 && <tr><td colSpan={5} className="inv-empty">Chưa có phiếu</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'waste' && (
        <div className="inv-card">
          <h3>Huỷ hàng (hư hỏng, hết hạn, hao hụt)</h3>
          <div className="inv-grid">
            <label>
              Kho
              <select value={wasteWh} onChange={(e) => setWasteWh(e.target.value)}>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label>
              Lý do (bắt buộc)
              <input value={wasteReason} onChange={(e) => setWasteReason(e.target.value)} placeholder="VD: rau héo, hết hạn…" />
            </label>
          </div>
          <LinesEditor items={items} lines={wasteLines} onChange={setWasteLines} />
          <div className="inv-actions">
            <button
              className="inv-danger"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const payloadItems = toPayload(wasteLines, false)
                  if (!wasteReason.trim()) throw new Error('Vui lòng nhập lý do huỷ hàng')
                  if (payloadItems.length === 0) throw new Error('Cần ít nhất 1 dòng hàng hợp lệ')
                  await request('/waste', token, {
                    method: 'POST',
                    body: JSON.stringify({ warehouseId: wasteWh, reason: wasteReason, items: payloadItems }),
                  })
                  setWasteLines([emptyLine()])
                  setWasteReason('')
                }, 'Đã huỷ hàng và trừ khỏi tồn kho (có ghi vết người thao tác)')
              }
            >
              Xác nhận huỷ hàng
            </button>
          </div>
        </div>
      )}

      {tab === 'recipes' && (
        <div className="inv-card">
          <h3>Công thức món (định lượng cho 1 phần)</h3>
          <p className="inv-hint">Khi bill hoàn tất, hệ thống trừ nguyên liệu theo công thức này nhân số lượng món.</p>
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Món</th><th>Nguyên liệu</th><th></th></tr></thead>
              <tbody>
                {foods.map((f) => (
                  <tr key={f.id}>
                    <td>{f.name}</td>
                    <td>
                      {f.recipe.length === 0
                        ? <span className="inv-muted">Chưa có công thức</span>
                        : f.recipe.map((r) => `${r.item_name} ${fmtNum(r.quantity_per_serving)} ${r.unit}`).join(' · ')}
                    </td>
                    <td className="r">
                      <button
                        className="inv-link-btn"
                        onClick={() => {
                          setEditFood(f)
                          setRecipeLines(
                            f.recipe.length
                              ? f.recipe.map((r) => ({ itemId: r.item_id, quantity: String(r.quantity_per_serving), unitCost: '' }))
                              : [emptyLine()],
                          )
                        }}
                      >
                        Sửa
                      </button>
                    </td>
                  </tr>
                ))}
                {foods.length === 0 && <tr><td colSpan={3} className="inv-empty">Chưa có món ăn</td></tr>}
              </tbody>
            </table>
          </div>
          {editFood && (
            <div className="inv-modal" onClick={() => setEditFood(null)}>
              <div className="inv-modal-body" onClick={(e) => e.stopPropagation()}>
                <h3>Công thức: {editFood.name}</h3>
                <LinesEditor items={items} lines={recipeLines} onChange={setRecipeLines} />
                <div className="inv-actions">
                  <button className="inv-secondary" onClick={() => setEditFood(null)}>Đóng</button>
                  <button
                    className="inv-primary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await request(`/recipes/${editFood.id}`, token, {
                          method: 'PUT',
                          body: JSON.stringify({ items: toPayload(recipeLines, false) }),
                        })
                        setEditFood(null)
                        setFoods(await request<FoodRecipe[]>('/recipes', token))
                      }, 'Đã lưu công thức')
                    }
                  >
                    Lưu công thức
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="inv-card">
          <div className="inv-toolbar">
            <select value={moveType} onChange={(e) => setMoveType(e.target.value)}>
              <option value="">Mọi loại biến động</option>
              {Object.entries(MOVEMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead><tr><th>Thời gian</th><th>Loại</th><th>Kho</th><th>Nguyên liệu</th><th className="r">Số lượng</th><th className="r">Tồn sau</th><th>Người / Lý do</th></tr></thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{fmtTime(m.created_at)}</td>
                    <td>{MOVEMENT_LABEL[m.movement_type] ?? m.movement_type}</td>
                    <td>{m.warehouse_name}</td>
                    <td>{m.item_name}</td>
                    <td className={`r ${Number(m.quantity) < 0 ? 'neg' : 'pos'}`}>
                      {Number(m.quantity) > 0 ? '+' : ''}{fmtNum(m.quantity)} {m.unit}
                    </td>
                    <td className="r">{fmtNum(m.balance_after)}</td>
                    <td>{[m.created_by_email, m.reason].filter(Boolean).join(' — ') || '—'}</td>
                  </tr>
                ))}
                {movements.length === 0 && <tr><td colSpan={7} className="inv-empty">Chưa có biến động</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function PoTable({
  pos,
  onReceive,
  onCancel,
}: {
  pos: PO[]
  onReceive?: (id: string) => void
  onCancel?: (id: string) => void
}) {
  return (
    <div className="inv-table-wrap">
      <table className="inv-table">
        <thead><tr><th>Mã</th><th>NCC</th><th>Kho</th><th>Hàng</th><th className="r">Tổng</th><th>Trạng thái</th>{onReceive && <th></th>}</tr></thead>
        <tbody>
          {pos.map((p) => (
            <tr key={p.id}>
              <td>{p.po_code}<div className="inv-muted">{fmtTime(p.created_at)}</div></td>
              <td>{p.supplier_name}</td>
              <td>{p.warehouse_name}</td>
              <td>{(p.items ?? []).map((i) => `${i.item_name} ×${fmtNum(i.quantity)} ${i.unit}`).join(', ')}</td>
              <td className="r">{fmtMoney(p.total_amount)}</td>
              <td><span className={`inv-badge po-${p.status}`}>{PO_LABEL[p.status]}</span></td>
              {onReceive && (
                <td className="r">
                  {p.status === 'ordered' && (
                    <>
                      <button className="inv-link-btn" onClick={() => onReceive(p.id)}>Nhận hàng</button>{' '}
                      <button className="inv-link-btn danger" onClick={() => onCancel?.(p.id)}>Huỷ</button>
                    </>
                  )}
                </td>
              )}
            </tr>
          ))}
          {pos.length === 0 && <tr><td colSpan={7} className="inv-empty">Chưa có đơn</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
