-- =========================================================
-- MIGRATION 014: MEDIA & FILE STORAGE
-- Tuệ Nguyên
-- =========================================================

CREATE SCHEMA IF NOT EXISTS system;

-- =========================================================
-- 1. MEDIA FILES
-- =========================================================

CREATE TABLE IF NOT EXISTS system.media_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),

    file_path TEXT NOT NULL,
    file_url TEXT,

    mime_type VARCHAR(100),
    file_extension VARCHAR(20),

    file_size BIGINT,

    width INTEGER,
    height INTEGER,

    storage_provider VARCHAR(30) NOT NULL DEFAULT 'local'
        CHECK (
            storage_provider IN (
                'local',
                's3',
                'cloudflare_r2',
                'cloudinary'
            )
        ),

    bucket_name VARCHAR(255),

    folder VARCHAR(255),

    entity_type VARCHAR(100),
    entity_id UUID,

    alt_text VARCHAR(500),
    description TEXT,

    uploaded_by UUID,

    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 2. MEDIA FOLDERS
-- =========================================================

CREATE TABLE IF NOT EXISTS system.media_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(255) NOT NULL,

    slug VARCHAR(255) NOT NULL UNIQUE,

    parent_id UUID,

    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT media_folders_parent_fk
        FOREIGN KEY (parent_id)
        REFERENCES system.media_folders(id)
        ON DELETE SET NULL
);

-- =========================================================
-- 3. MEDIA TAGS
-- =========================================================

CREATE TABLE IF NOT EXISTS system.media_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL UNIQUE,

    slug VARCHAR(100) NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 4. MEDIA FILE TAGS
-- =========================================================

CREATE TABLE IF NOT EXISTS system.media_file_tags (
    media_file_id UUID NOT NULL,

    tag_id UUID NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (
        media_file_id,
        tag_id
    ),

    CONSTRAINT media_file_tags_file_fk
        FOREIGN KEY (media_file_id)
        REFERENCES system.media_files(id)
        ON DELETE CASCADE,

    CONSTRAINT media_file_tags_tag_fk
        FOREIGN KEY (tag_id)
        REFERENCES system.media_tags(id)
        ON DELETE CASCADE
);

-- =========================================================
-- 5. INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_media_files_folder
ON system.media_files(folder);

CREATE INDEX IF NOT EXISTS idx_media_files_entity
ON system.media_files(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_media_files_uploaded_by
ON system.media_files(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_media_files_active
ON system.media_files(is_active);

CREATE INDEX IF NOT EXISTS idx_media_files_created_at
ON system.media_files(created_at);

CREATE INDEX IF NOT EXISTS idx_media_folders_parent
ON system.media_folders(parent_id);

CREATE INDEX IF NOT EXISTS idx_media_folders_active
ON system.media_folders(is_active);

CREATE INDEX IF NOT EXISTS idx_media_file_tags_tag
ON system.media_file_tags(tag_id);

-- =========================================================
-- 6. DEFAULT FOLDERS
-- =========================================================

INSERT INTO system.media_folders (
    name,
    slug,
    description
)
VALUES
(
    'Món ăn',
    'foods',
    'Hình ảnh món ăn'
)
ON CONFLICT (slug)
DO NOTHING;

INSERT INTO system.media_folders (
    name,
    slug,
    description
)
VALUES
(
    'Danh mục món ăn',
    'food-categories',
    'Hình ảnh danh mục món ăn'
)
ON CONFLICT (slug)
DO NOTHING;

INSERT INTO system.media_folders (
    name,
    slug,
    description
)
VALUES
(
    'Banner',
    'banners',
    'Hình ảnh banner ứng dụng và website'
)
ON CONFLICT (slug)
DO NOTHING;

INSERT INTO system.media_folders (
    name,
    slug,
    description
)
VALUES
(
    'Chiến dịch',
    'campaigns',
    'Hình ảnh chiến dịch marketing'
)
ON CONFLICT (slug)
DO NOTHING;

INSERT INTO system.media_folders (
    name,
    slug,
    description
)
VALUES
(
    'Avatar',
    'avatars',
    'Ảnh đại diện thành viên'
)
ON CONFLICT (slug)
DO NOTHING;

INSERT INTO system.media_folders (
    name,
    slug,
    description
)
VALUES
(
    'Khác',
    'others',
    'Các file khác'
)
ON CONFLICT (slug)
DO NOTHING;

-- =========================================================
-- END MIGRATION 014
-- =========================================================