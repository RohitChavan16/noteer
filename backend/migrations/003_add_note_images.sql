CREATE TABLE IF NOT EXISTS note_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    original_name TEXT,
    mime_type TEXT,
    size BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_note_images_note_id ON note_images(note_id);
CREATE INDEX idx_note_images_user_id ON note_images(user_id);
