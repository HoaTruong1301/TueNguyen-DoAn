-- ============================================================
-- TUỆ NGUYÊN
-- Migration 025 - File Upload Security & Virus Scan
-- ============================================================

CREATE SCHEMA IF NOT EXISTS system;

-- ============================================================
-- 1. FILE UPLOAD SECURITY
-- Thông tin bảo mật và trạng thái kiểm tra file
-- ============================================================

CREATE TABLE IF NOT EXISTS system.file_security (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    media_file_id UUID NOT NULL UNIQUE,

    scan_status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            scan_status IN (
                'pending',
                'scanning',
                'clean',
                'infected',
                'failed',
                'skipped'
            )
        ),

    scanner_name VARCHAR(100),

    scanner_version VARCHAR(100),

    scan_started_at TIMESTAMPTZ,

    scan_completed_at TIMESTAMPTZ,

    scan_result JSONB NOT NULL DEFAULT '{}'::jsonb,

    threat_name VARCHAR(255),

    quarantine_path TEXT,

    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,

    blocked_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_security_scan_status
ON system.file_security(scan_status);

CREATE INDEX IF NOT EXISTS idx_file_security_blocked
ON system.file_security(is_blocked);

CREATE INDEX IF NOT EXISTS idx_file_security_created
ON system.file_security(created_at);


-- ============================================================
-- 2. FILE UPLOAD REQUESTS
-- Theo dõi quá trình upload từ lúc bắt đầu đến hoàn thành
-- ============================================================

CREATE TABLE IF NOT EXISTS system.file_upload_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID,

    media_file_id UUID,

    upload_token_hash VARCHAR(255),

    original_filename TEXT NOT NULL,

    requested_mime_type VARCHAR(100),

    detected_mime_type VARCHAR(100),

    declared_size BIGINT,

    actual_size BIGINT,

    extension VARCHAR(20),

    upload_status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            upload_status IN (
                'pending',
                'uploading',
                'uploaded',
                'scanning',
                'completed',
                'rejected',
                'failed',
                'cancelled'
            )
        ),

    rejection_reason TEXT,

    ip_address INET,

    user_agent TEXT,

    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_requests_user
ON system.file_upload_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_upload_requests_status
ON system.file_upload_requests(upload_status);

CREATE INDEX IF NOT EXISTS idx_upload_requests_expires
ON system.file_upload_requests(expires_at);

CREATE INDEX IF NOT EXISTS idx_upload_requests_created
ON system.file_upload_requests(created_at);


-- ============================================================
-- 3. FILE SECURITY POLICIES
-- Chính sách upload theo loại file
-- ============================================================

CREATE TABLE IF NOT EXISTS system.file_security_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(100) NOT NULL UNIQUE,

    name VARCHAR(255) NOT NULL,

    description TEXT,

    allowed_mime_types JSONB NOT NULL DEFAULT '[]'::jsonb,

    allowed_extensions JSONB NOT NULL DEFAULT '[]'::jsonb,

    max_file_size_bytes BIGINT NOT NULL,

    max_files_per_request INTEGER NOT NULL DEFAULT 1,

    require_scan BOOLEAN NOT NULL DEFAULT TRUE,

    require_image_validation BOOLEAN NOT NULL DEFAULT FALSE,

    require_image_dimensions BOOLEAN NOT NULL DEFAULT FALSE,

    min_width INTEGER,

    max_width INTEGER,

    min_height INTEGER,

    max_height INTEGER,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_security_policies_active
ON system.file_security_policies(is_active);


-- ============================================================
-- 4. DEFAULT SECURITY POLICIES
-- ============================================================

INSERT INTO system.file_security_policies (
    code,
    name,
    description,
    allowed_mime_types,
    allowed_extensions,
    max_file_size_bytes,
    max_files_per_request,
    require_scan,
    require_image_validation,
    require_image_dimensions,
    min_width,
    max_width,
    min_height,
    max_height
)
VALUES (
    'food_image',
    'Food image',
    'Ảnh món ăn',
    '[
        "image/jpeg",
        "image/png",
        "image/webp"
    ]'::jsonb,
    '[
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    ]'::jsonb,
    5242880,
    10,
    TRUE,
    TRUE,
    TRUE,
    300,
    6000,
    300,
    6000
)
ON CONFLICT (code) DO NOTHING;


INSERT INTO system.file_security_policies (
    code,
    name,
    description,
    allowed_mime_types,
    allowed_extensions,
    max_file_size_bytes,
    max_files_per_request,
    require_scan,
    require_image_validation,
    require_image_dimensions,
    min_width,
    max_width,
    min_height,
    max_height
)
VALUES (
    'avatar',
    'Member avatar',
    'Ảnh đại diện thành viên',
    '[
        "image/jpeg",
        "image/png",
        "image/webp"
    ]'::jsonb,
    '[
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    ]'::jsonb,
    2097152,
    1,
    TRUE,
    TRUE,
    TRUE,
    100,
    3000,
    100,
    3000
)
ON CONFLICT (code) DO NOTHING;


INSERT INTO system.file_security_policies (
    code,
    name,
    description,
    allowed_mime_types,
    allowed_extensions,
    max_file_size_bytes,
    max_files_per_request,
    require_scan,
    require_image_validation,
    require_image_dimensions,
    min_width,
    max_width,
    min_height,
    max_height
)
VALUES (
    'banner',
    'Banner image',
    'Ảnh banner CMS',
    '[
        "image/jpeg",
        "image/png",
        "image/webp"
    ]'::jsonb,
    '[
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    ]'::jsonb,
    10485760,
    10,
    TRUE,
    TRUE,
    TRUE,
    600,
    8000,
    200,
    5000
)
ON CONFLICT (code) DO NOTHING;


INSERT INTO system.file_security_policies (
    code,
    name,
    description,
    allowed_mime_types,
    allowed_extensions,
    max_file_size_bytes,
    max_files_per_request,
    require_scan,
    require_image_validation,
    require_image_dimensions,
    min_width,
    max_width,
    min_height,
    max_height
)
VALUES (
    'review_image',
    'Review image',
    'Ảnh đánh giá món ăn/dịch vụ',
    '[
        "image/jpeg",
        "image/png",
        "image/webp"
    ]'::jsonb,
    '[
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    ]'::jsonb,
    5242880,
    8,
    TRUE,
    TRUE,
    TRUE,
    200,
    6000,
    200,
    6000
)
ON CONFLICT (code) DO NOTHING;


INSERT INTO system.file_security_policies (
    code,
    name,
    description,
    allowed_mime_types,
    allowed_extensions,
    max_file_size_bytes,
    max_files_per_request,
    require_scan,
    require_image_validation,
    require_image_dimensions,
    min_width,
    max_width,
    min_height,
    max_height
)
VALUES (
    'support_attachment',
    'Support attachment',
    'File đính kèm hỗ trợ khách hàng',
    '[
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf"
    ]'::jsonb,
    '[
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".pdf"
    ]'::jsonb,
    10485760,
    5,
    TRUE,
    FALSE,
    FALSE,
    NULL,
    NULL,
    NULL,
    NULL
)
ON CONFLICT (code) DO NOTHING;


-- ============================================================
-- 5. FILE HASHES
-- Chống upload trùng và hỗ trợ kiểm tra file
-- ============================================================

CREATE TABLE IF NOT EXISTS system.file_hashes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    media_file_id UUID NOT NULL,

    algorithm VARCHAR(30) NOT NULL,

    hash_value VARCHAR(255) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_hashes_media_file
ON system.file_hashes(media_file_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_file_hash_algorithm_value
ON system.file_hashes(algorithm, hash_value);


-- ============================================================
-- 6. FILE ACCESS LOG
-- Theo dõi truy cập file nhạy cảm
-- ============================================================

CREATE TABLE IF NOT EXISTS system.file_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    media_file_id UUID,

    user_id UUID,

    action VARCHAR(30) NOT NULL
        CHECK (
            action IN (
                'view',
                'download',
                'upload',
                'delete',
                'restore',
                'scan',
                'quarantine'
            )
        ),

    ip_address INET,

    user_agent TEXT,

    success BOOLEAN NOT NULL DEFAULT TRUE,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_access_logs_media
ON system.file_access_logs(media_file_id);

CREATE INDEX IF NOT EXISTS idx_file_access_logs_user
ON system.file_access_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_file_access_logs_action
ON system.file_access_logs(action);

CREATE INDEX IF NOT EXISTS idx_file_access_logs_created
ON system.file_access_logs(created_at);


-- ============================================================
-- 7. COMMENTS
-- ============================================================

COMMENT ON TABLE system.file_security IS
'Security scan state for uploaded media files';

COMMENT ON TABLE system.file_upload_requests IS
'Tracks file upload lifecycle and validation';

COMMENT ON TABLE system.file_security_policies IS
'Upload restrictions by file category';

COMMENT ON TABLE system.file_hashes IS
'Cryptographic hashes of uploaded files';

COMMENT ON TABLE system.file_access_logs IS
'Security and access audit log for media files';