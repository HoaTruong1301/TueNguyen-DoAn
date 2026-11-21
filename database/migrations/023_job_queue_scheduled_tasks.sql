-- ============================================================
-- TUỆ NGUYÊN
-- Migration 023 - Job Queue & Scheduled Tasks
-- ============================================================

CREATE SCHEMA IF NOT EXISTS job;

-- ============================================================
-- 1. JOBS
-- Hàng đợi các công việc backend cần xử lý
-- ============================================================

CREATE TABLE IF NOT EXISTS job.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_type VARCHAR(100) NOT NULL,
    queue_name VARCHAR(100) NOT NULL DEFAULT 'default',

    priority VARCHAR(20) NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'critical')),

    status VARCHAR(30) NOT NULL DEFAULT 'queued'
        CHECK (
            status IN (
                'queued',
                'running',
                'retry_waiting',
                'succeeded',
                'failed',
                'cancelled'
            )
        ),

    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB,

    idempotency_key VARCHAR(255),

    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,

    run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(255),

    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,

    last_error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_queue_status
ON job.jobs(queue_name, status);

CREATE INDEX IF NOT EXISTS idx_jobs_run_at
ON job.jobs(run_at);

CREATE INDEX IF NOT EXISTS idx_jobs_status_run_at
ON job.jobs(status, run_at);

CREATE INDEX IF NOT EXISTS idx_jobs_type
ON job.jobs(job_type);

CREATE INDEX IF NOT EXISTS idx_jobs_created_at
ON job.jobs(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_idempotency_key
ON job.jobs(idempotency_key)
WHERE idempotency_key IS NOT NULL;


-- ============================================================
-- 2. JOB ATTEMPTS
-- Lịch sử từng lần backend thực thi job
-- ============================================================

CREATE TABLE IF NOT EXISTS job.job_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    job_id UUID NOT NULL,

    attempt_number INTEGER NOT NULL,

    status VARCHAR(30) NOT NULL
        CHECK (
            status IN (
                'running',
                'succeeded',
                'failed'
            )
        ),

    worker_id VARCHAR(255),

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,

    error_message TEXT,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_attempts_job_id
ON job.job_attempts(job_id);

CREATE INDEX IF NOT EXISTS idx_job_attempts_status
ON job.job_attempts(status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_job_attempt_number
ON job.job_attempts(job_id, attempt_number);


-- ============================================================
-- 3. SCHEDULES
-- Các tác vụ chạy định kỳ
-- ============================================================

CREATE TABLE IF NOT EXISTS job.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(100) NOT NULL UNIQUE,

    name VARCHAR(255) NOT NULL,

    description TEXT,

    cron_expression VARCHAR(100) NOT NULL,

    timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',

    job_type VARCHAR(100) NOT NULL,

    queue_name VARCHAR(100) NOT NULL DEFAULT 'default',

    priority VARCHAR(20) NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'critical')),

    payload JSONB NOT NULL DEFAULT '{}'::jsonb,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    next_run_at TIMESTAMPTZ,

    last_run_at TIMESTAMPTZ,

    last_job_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedules_active_next_run
ON job.schedules(is_active, next_run_at);

CREATE INDEX IF NOT EXISTS idx_schedules_job_type
ON job.schedules(job_type);


-- ============================================================
-- 4. JOB LOCKS
-- Chống nhiều worker chạy cùng một tác vụ
-- ============================================================

CREATE TABLE IF NOT EXISTS job.locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    lock_key VARCHAR(255) NOT NULL UNIQUE,

    locked_by VARCHAR(255) NOT NULL,

    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    locked_until TIMESTAMPTZ NOT NULL,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_job_locks_locked_until
ON job.locks(locked_until);


-- ============================================================
-- 5. DEAD LETTER JOBS
-- Lưu các job thất bại sau khi retry hết số lần
-- ============================================================

CREATE TABLE IF NOT EXISTS job.dead_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    original_job_id UUID,

    job_type VARCHAR(100) NOT NULL,

    queue_name VARCHAR(100) NOT NULL,

    payload JSONB NOT NULL DEFAULT '{}'::jsonb,

    attempts INTEGER NOT NULL DEFAULT 0,

    last_error TEXT,

    failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    resolved_at TIMESTAMPTZ,

    resolved_by VARCHAR(255),

    resolution_note TEXT,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_dead_letters_failed_at
ON job.dead_letters(failed_at);

CREATE INDEX IF NOT EXISTS idx_dead_letters_job_type
ON job.dead_letters(job_type);

CREATE INDEX IF NOT EXISTS idx_dead_letters_unresolved
ON job.dead_letters(resolved_at)
WHERE resolved_at IS NULL;


-- ============================================================
-- 6. DEFAULT SCHEDULES
-- Backend Worker sẽ đọc các schedule này
-- ============================================================

INSERT INTO job.schedules (
    code,
    name,
    description,
    cron_expression,
    timezone,
    job_type,
    queue_name,
    priority,
    payload,
    is_active
)
VALUES (
    'cleanup_expired_otp',
    'Cleanup expired OTP',
    'Xóa hoặc đánh dấu OTP đã hết hạn',
    '*/5 * * * *',
    'Asia/Ho_Chi_Minh',
    'cleanup_expired_otp',
    'maintenance',
    'normal',
    '{}'::jsonb,
    TRUE
)
ON CONFLICT (code) DO NOTHING;


INSERT INTO job.schedules (
    code,
    name,
    description,
    cron_expression,
    timezone,
    job_type,
    queue_name,
    priority,
    payload,
    is_active
)
VALUES (
    'expire_vouchers',
    'Expire vouchers',
    'Cập nhật các voucher đã hết hạn',
    '*/10 * * * *',
    'Asia/Ho_Chi_Minh',
    'expire_vouchers',
    'promotion',
    'normal',
    '{}'::jsonb,
    TRUE
)
ON CONFLICT (code) DO NOTHING;


INSERT INTO job.schedules (
    code,
    name,
    description,
    cron_expression,
    timezone,
    job_type,
    queue_name,
    priority,
    payload,
    is_active
)
VALUES (
    'expire_loyalty_points',
    'Expire loyalty points',
    'Xử lý điểm thành viên hết hạn',
    '0 2 * * *',
    'Asia/Ho_Chi_Minh',
    'expire_loyalty_points',
    'member',
    'normal',
    '{}'::jsonb,
    TRUE
)
ON CONFLICT (code) DO NOTHING;


INSERT INTO job.schedules (
    code,
    name,
    description,
    cron_expression,
    timezone,
    job_type,
    queue_name,
    priority,
    payload,
    is_active
)
VALUES (
    'birthday_rewards',
    'Birthday rewards',
    'Kiểm tra và phát thưởng sinh nhật cho thành viên',
    '0 8 * * *',
    'Asia/Ho_Chi_Minh',
    'birthday_rewards',
    'member',
    'high',
    '{}'::jsonb,
    TRUE
)
ON CONFLICT (code) DO NOTHING;


INSERT INTO job.schedules (
    code,
    name,
    description,
    cron_expression,
    timezone,
    job_type,
    queue_name,
    priority,
    payload,
    is_active
)
VALUES (
    'send_scheduled_notifications',
    'Send scheduled notifications',
    'Gửi các thông báo đã được lên lịch',
    '*/1 * * * *',
    'Asia/Ho_Chi_Minh',
    'send_scheduled_notifications',
    'notification',
    'high',
    '{}'::jsonb,
    TRUE
)
ON CONFLICT (code) DO NOTHING;


INSERT INTO job.schedules (
    code,
    name,
    description,
    cron_expression,
    timezone,
    job_type,
    queue_name,
    priority,
    payload,
    is_active
)
VALUES (
    'auto_close_support_tickets',
    'Auto close support tickets',
    'Tự động đóng các ticket đã xử lý lâu',
    '0 3 * * *',
    'Asia/Ho_Chi_Minh',
    'auto_close_support_tickets',
    'support',
    'low',
    '{}'::jsonb,
    TRUE
)
ON CONFLICT (code) DO NOTHING;


INSERT INTO job.schedules (
    code,
    name,
    description,
    cron_expression,
    timezone,
    job_type,
    queue_name,
    priority,
    payload,
    is_active
)
VALUES (
    'cleanup_old_analytics',
    'Cleanup old analytics',
    'Dọn dữ liệu analytics cũ theo chính sách lưu trữ',
    '0 4 * * 0',
    'Asia/Ho_Chi_Minh',
    'cleanup_old_analytics',
    'analytics',
    'low',
    '{}'::jsonb,
    TRUE
)
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 7. COMMENTS
-- ============================================================

COMMENT ON SCHEMA job IS
'Background jobs, queue, workers and scheduled tasks';

COMMENT ON TABLE job.jobs IS
'Queue of background jobs waiting for backend workers';

COMMENT ON TABLE job.job_attempts IS
'Execution history of background jobs';

COMMENT ON TABLE job.schedules IS
'Recurring scheduled background jobs';

COMMENT ON TABLE job.locks IS
'Distributed locks for backend workers';

COMMENT ON TABLE job.dead_letters IS
'Jobs that permanently failed after all retry attempts';