ALTER TABLE member.user_profiles
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS uq_member_user_profiles_user_id
ON member.user_profiles(user_id);