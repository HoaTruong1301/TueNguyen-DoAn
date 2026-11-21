-- =========================================================
-- MIGRATION 017: REVIEWS, RATINGS & CUSTOMER FEEDBACK
-- Tuệ Nguyên
-- =========================================================

CREATE SCHEMA IF NOT EXISTS review;

-- =========================================================
-- 1. REVIEWS
-- =========================================================

CREATE TABLE IF NOT EXISTS review.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    order_id UUID,

    food_id UUID,

    reservation_id UUID,

    review_type VARCHAR(30) NOT NULL
        CHECK (
            review_type IN (
                'food',
                'order',
                'delivery',
                'reservation',
                'service'
            )
        ),

    rating SMALLINT NOT NULL
        CHECK (rating BETWEEN 1 AND 5),

    title VARCHAR(200),

    content TEXT,

    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'approved',
                'rejected',
                'hidden',
                'deleted'
            )
        ),

    is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,

    is_featured BOOLEAN NOT NULL DEFAULT FALSE,

    admin_note TEXT,

    moderated_by UUID,

    moderated_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 2. REVIEW IMAGES
-- =========================================================

CREATE TABLE IF NOT EXISTS review.review_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    review_id UUID NOT NULL,

    media_file_id UUID,

    image_url TEXT,

    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT review_images_review_fk
        FOREIGN KEY (review_id)
        REFERENCES review.reviews(id)
        ON DELETE CASCADE
);

-- =========================================================
-- 3. REVIEW REPLIES
-- Admin / nhà hàng trả lời đánh giá.
-- =========================================================

CREATE TABLE IF NOT EXISTS review.review_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    review_id UUID NOT NULL,

    admin_user_id UUID,

    content TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'published'
        CHECK (
            status IN (
                'draft',
                'published',
                'hidden',
                'deleted'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT review_replies_review_fk
        FOREIGN KEY (review_id)
        REFERENCES review.reviews(id)
        ON DELETE CASCADE
);

-- =========================================================
-- 4. REVIEW REPORTS
-- Khách báo cáo review spam / sai phạm.
-- =========================================================

CREATE TABLE IF NOT EXISTS review.review_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    review_id UUID NOT NULL,

    reported_by UUID NOT NULL,

    reason VARCHAR(50) NOT NULL
        CHECK (
            reason IN (
                'spam',
                'offensive',
                'fake',
                'irrelevant',
                'advertising',
                'other'
            )
        ),

    description TEXT,

    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'reviewing',
                'resolved',
                'rejected'
            )
        ),

    handled_by UUID,

    handled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT review_reports_review_fk
        FOREIGN KEY (review_id)
        REFERENCES review.reviews(id)
        ON DELETE CASCADE
);

-- =========================================================
-- 5. REVIEW REACTIONS
-- Like / helpful.
-- =========================================================

CREATE TABLE IF NOT EXISTS review.review_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    review_id UUID NOT NULL,

    user_id UUID NOT NULL,

    reaction_type VARCHAR(30) NOT NULL DEFAULT 'helpful'
        CHECK (
            reaction_type IN (
                'helpful',
                'not_helpful'
            )
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT review_reactions_unique
        UNIQUE (
            review_id,
            user_id
        ),

    CONSTRAINT review_reactions_review_fk
        FOREIGN KEY (review_id)
        REFERENCES review.reviews(id)
        ON DELETE CASCADE
);

-- =========================================================
-- 6. INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_reviews_user
ON review.reviews(user_id);

CREATE INDEX IF NOT EXISTS idx_reviews_order
ON review.reviews(order_id);

CREATE INDEX IF NOT EXISTS idx_reviews_food
ON review.reviews(food_id);

CREATE INDEX IF NOT EXISTS idx_reviews_reservation
ON review.reviews(reservation_id);

CREATE INDEX IF NOT EXISTS idx_reviews_type
ON review.reviews(review_type);

CREATE INDEX IF NOT EXISTS idx_reviews_rating
ON review.reviews(rating);

CREATE INDEX IF NOT EXISTS idx_reviews_status
ON review.reviews(status);

CREATE INDEX IF NOT EXISTS idx_reviews_featured
ON review.reviews(is_featured);

CREATE INDEX IF NOT EXISTS idx_reviews_created
ON review.reviews(created_at);

CREATE INDEX IF NOT EXISTS idx_review_images_review
ON review.review_images(review_id);

CREATE INDEX IF NOT EXISTS idx_review_replies_review
ON review.review_replies(review_id);

CREATE INDEX IF NOT EXISTS idx_review_reports_review
ON review.review_reports(review_id);

CREATE INDEX IF NOT EXISTS idx_review_reports_status
ON review.review_reports(status);

CREATE INDEX IF NOT EXISTS idx_review_reactions_review
ON review.review_reactions(review_id);

CREATE INDEX IF NOT EXISTS idx_review_reactions_user
ON review.review_reactions(user_id);

-- =========================================================
-- END MIGRATION 017
-- =========================================================