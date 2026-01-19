-- Migration: 005 - Video Calls & Daily.co Integration
-- Description: Add tables for video calls, meetings, and Daily.co integration

-- ===========================================
-- VIDEO CALLS & MEETINGS
-- ===========================================

-- Rooms/salas de reuniones
CREATE TABLE meeting_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    room_url TEXT UNIQUE, -- Daily.co room URL
    room_token TEXT, -- Daily.co room token for authentication
    daily_room_id TEXT UNIQUE, -- Daily.co internal room ID
    is_active BOOLEAN DEFAULT true,
    max_participants INTEGER DEFAULT 50,
    privacy TEXT NOT NULL CHECK (privacy IN ('public', 'private', 'agency')) DEFAULT 'agency',

    -- Settings
    enable_chat BOOLEAN DEFAULT true,
    enable_screenshare BOOLEAN DEFAULT true,
    enable_recording BOOLEAN DEFAULT false,
    enable_transcription BOOLEAN DEFAULT false,
    enable_breakout_rooms BOOLEAN DEFAULT false,

    -- Scheduling
    scheduled_start TIMESTAMP WITH TIME ZONE,
    scheduled_end TIMESTAMP WITH TIME ZONE,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_by UUID NOT NULL REFERENCES auth.users(id),
    agency_id UUID NOT NULL REFERENCES agencies(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for meeting rooms
CREATE INDEX idx_meeting_rooms_agency_id ON meeting_rooms(agency_id);
CREATE INDEX idx_meeting_rooms_created_by ON meeting_rooms(created_by);
CREATE INDEX idx_meeting_rooms_active ON meeting_rooms(is_active) WHERE is_active = true;
CREATE INDEX idx_meeting_rooms_scheduled ON meeting_rooms(scheduled_start, scheduled_end) WHERE scheduled_start IS NOT NULL;

-- Meeting participants
CREATE TABLE meeting_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meeting_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

    -- Participant info
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('host', 'co_host', 'presenter', 'attendee')) DEFAULT 'attendee',
    permissions JSONB DEFAULT '{
        "can_chat": true,
        "can_screenshare": true,
        "can_record": false,
        "can_mute_others": false,
        "can_remove_others": false
    }',

    -- Participation tracking
    joined_at TIMESTAMP WITH TIME ZONE,
    left_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (left_at - joined_at)) / 60
    ) STORED,

    -- Status
    status TEXT NOT NULL CHECK (status IN ('invited', 'joined', 'declined', 'left')) DEFAULT 'invited',
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(meeting_id, user_id)
);

-- Create indexes for participants
CREATE INDEX idx_meeting_participants_meeting_id ON meeting_participants(meeting_id);
CREATE INDEX idx_meeting_participants_user_id ON meeting_participants(user_id);
CREATE INDEX idx_meeting_participants_status ON meeting_participants(status);

-- Meeting recordings
CREATE TABLE meeting_recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meeting_rooms(id) ON DELETE CASCADE,
    recording_id TEXT UNIQUE NOT NULL, -- Daily.co recording ID
    recording_url TEXT, -- URL to access the recording
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    format TEXT NOT NULL DEFAULT 'mp4',

    -- Metadata
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    processed BOOLEAN DEFAULT false,
    processing_status TEXT CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',

    -- Transcription (if enabled)
    transcription_url TEXT,
    transcription_status TEXT CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for recordings
CREATE INDEX idx_meeting_recordings_meeting_id ON meeting_recordings(meeting_id);
CREATE INDEX idx_meeting_recordings_processing_status ON meeting_recordings(processing_status);

-- Meeting events/logs for analytics
CREATE TABLE meeting_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meeting_rooms(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES meeting_participants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'joined', 'left', 'chat', 'screenshare_started', 'recording_started', etc.
    event_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for events
CREATE INDEX idx_meeting_events_meeting_id ON meeting_events(meeting_id, timestamp);
CREATE INDEX idx_meeting_events_participant_id ON meeting_events(participant_id);
CREATE INDEX idx_meeting_events_type ON meeting_events(event_type);

-- Chat messages during meetings
CREATE TABLE meeting_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meeting_rooms(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES meeting_participants(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    message_type TEXT NOT NULL CHECK (message_type IN ('text', 'emoji', 'system')) DEFAULT 'text',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- For threaded replies (optional)
    parent_message_id UUID REFERENCES meeting_chat_messages(id) ON DELETE CASCADE
);

-- Create indexes for chat messages
CREATE INDEX idx_meeting_chat_meeting_id ON meeting_chat_messages(meeting_id, timestamp);
CREATE INDEX idx_meeting_chat_participant_id ON meeting_chat_messages(participant_id);

-- ===========================================
-- BOOKING INTEGRATION
-- ===========================================

-- Link meetings to bookings (optional)
CREATE TABLE booking_meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    meeting_id UUID NOT NULL REFERENCES meeting_rooms(id) ON DELETE CASCADE,
    meeting_type TEXT NOT NULL CHECK (meeting_type IN ('checkin', 'checkout', 'maintenance', 'consultation', 'other')) DEFAULT 'consultation',
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(booking_id, meeting_id)
);

-- Create indexes for booking meetings
CREATE INDEX idx_booking_meetings_booking_id ON booking_meetings(booking_id);
CREATE INDEX idx_booking_meetings_meeting_id ON booking_meetings(meeting_id);

-- ===========================================
-- DAILY.CO WEBHOOKS & EVENTS
-- ===========================================

-- Daily.co webhook events for processing
CREATE TABLE daily_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    room_name TEXT,
    room_url TEXT,
    participant_id TEXT,
    participant_name TEXT,
    event_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for Daily webhooks
CREATE INDEX idx_daily_webhooks_event_type ON daily_webhook_events(event_type);
CREATE INDEX idx_daily_webhooks_room_name ON daily_webhook_events(room_name);
CREATE INDEX idx_daily_webhooks_processed ON daily_webhook_events(processed);

-- ===========================================
-- BREAKOUT ROOMS
-- ===========================================

-- Breakout rooms within meetings
CREATE TABLE breakout_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_meeting_id UUID NOT NULL REFERENCES meeting_rooms(id) ON DELETE CASCADE,
    room_name TEXT NOT NULL,
    room_url TEXT UNIQUE,
    room_token TEXT,
    max_participants INTEGER DEFAULT 10,

    -- Timing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (closed_at - created_at)) / 60
    ) STORED,

    -- Status
    is_active BOOLEAN DEFAULT true
);

-- Create indexes for breakout rooms
CREATE INDEX idx_breakout_rooms_parent_meeting ON breakout_rooms(parent_meeting_id);
CREATE INDEX idx_breakout_rooms_active ON breakout_rooms(is_active) WHERE is_active = true;

-- Breakout room participants
CREATE TABLE breakout_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    breakout_room_id UUID NOT NULL REFERENCES breakout_rooms(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES meeting_participants(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,

    UNIQUE(breakout_room_id, participant_id)
);

-- Create indexes for breakout participants
CREATE INDEX idx_breakout_participants_breakout_room ON breakout_participants(breakout_room_id);
CREATE INDEX idx_breakout_participants_participant ON breakout_participants(participant_id);

-- ===========================================
-- RLS POLICIES (Row Level Security)
-- ===========================================

-- Enable RLS on all tables
ALTER TABLE meeting_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE breakout_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE breakout_participants ENABLE ROW LEVEL SECURITY;

-- Meeting rooms policies
CREATE POLICY "Users can view meeting rooms in their agency" ON meeting_rooms
    FOR SELECT USING (
        agency_id IN (
            SELECT agency_id FROM user_agencies WHERE user_id = auth.uid()
        ) OR created_by = auth.uid()
    );

CREATE POLICY "Users can create meeting rooms in their agency" ON meeting_rooms
    FOR INSERT WITH CHECK (
        agency_id IN (
            SELECT agency_id FROM user_agencies WHERE user_id = auth.uid()
        ) AND created_by = auth.uid()
    );

CREATE POLICY "Users can update their own meeting rooms" ON meeting_rooms
    FOR UPDATE USING (created_by = auth.uid());

-- Meeting participants policies
CREATE POLICY "Users can view participants in their meetings" ON meeting_participants
    FOR SELECT USING (
        meeting_id IN (
            SELECT id FROM meeting_rooms
            WHERE agency_id IN (
                SELECT agency_id FROM user_agencies WHERE user_id = auth.uid()
            ) OR created_by = auth.uid()
        )
    );

CREATE POLICY "Users can manage their own participation" ON meeting_participants
    FOR ALL USING (user_id = auth.uid());

-- Meeting recordings policies
CREATE POLICY "Users can view recordings from their meetings" ON meeting_recordings
    FOR SELECT USING (
        meeting_id IN (
            SELECT id FROM meeting_rooms
            WHERE agency_id IN (
                SELECT agency_id FROM user_agencies WHERE user_id = auth.uid()
            ) OR created_by = auth.uid()
        )
    );

-- Meeting events policies (read-only for analytics)
CREATE POLICY "Users can view events from their meetings" ON meeting_events
    FOR SELECT USING (
        meeting_id IN (
            SELECT id FROM meeting_rooms
            WHERE agency_id IN (
                SELECT agency_id FROM user_agencies WHERE user_id = auth.uid()
            ) OR created_by = auth.uid()
        )
    );

-- Chat messages policies
CREATE POLICY "Users can view chat in their meetings" ON meeting_chat_messages
    FOR SELECT USING (
        meeting_id IN (
            SELECT id FROM meeting_rooms
            WHERE agency_id IN (
                SELECT agency_id FROM user_agencies WHERE user_id = auth.uid()
            ) OR created_by = auth.uid()
        )
    );

CREATE POLICY "Users can send chat messages in their meetings" ON meeting_chat_messages
    FOR INSERT WITH CHECK (
        participant_id IN (
            SELECT id FROM meeting_participants WHERE user_id = auth.uid()
        )
    );

-- Booking meetings policies
CREATE POLICY "Users can view booking meetings for their bookings" ON booking_meetings
    FOR SELECT USING (
        booking_id IN (
            SELECT id FROM bookings WHERE user_id = auth.uid()
        )
    );

-- ===========================================
-- FUNCTIONS & TRIGGERS
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_meeting_rooms_updated_at
    BEFORE UPDATE ON meeting_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meeting_participants_updated_at
    BEFORE UPDATE ON meeting_participants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meeting_recordings_updated_at
    BEFORE UPDATE ON meeting_recordings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_meetings_updated_at
    BEFORE UPDATE ON booking_meetings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to track meeting participation
CREATE OR REPLACE FUNCTION track_meeting_participation()
RETURNS TRIGGER AS $$
BEGIN
    -- Log participation events
    IF TG_OP = 'INSERT' THEN
        INSERT INTO meeting_events (meeting_id, participant_id, event_type, event_data)
        VALUES (NEW.meeting_id, NEW.id, 'participant_invited', jsonb_build_object('status', NEW.status));

    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            INSERT INTO meeting_events (meeting_id, participant_id, event_type, event_data)
            VALUES (NEW.meeting_id, NEW.id, 'participant_status_changed',
                   jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
        END IF;

        IF OLD.joined_at IS NULL AND NEW.joined_at IS NOT NULL THEN
            INSERT INTO meeting_events (meeting_id, participant_id, event_type, event_data)
            VALUES (NEW.meeting_id, NEW.id, 'participant_joined', jsonb_build_object('timestamp', NEW.joined_at));
        END IF;

        IF OLD.left_at IS NULL AND NEW.left_at IS NOT NULL THEN
            INSERT INTO meeting_events (meeting_id, participant_id, event_type, event_data)
            VALUES (NEW.meeting_id, NEW.id, 'participant_left', jsonb_build_object('timestamp', NEW.left_at));
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add trigger for participation tracking
CREATE TRIGGER meeting_participation_trigger
    AFTER INSERT OR UPDATE ON meeting_participants
    FOR EACH ROW
    EXECUTE FUNCTION track_meeting_participation();

-- Function to create meeting room in Daily.co (would be called from application)
-- This is a placeholder - actual implementation would call Daily.co API
CREATE OR REPLACE FUNCTION create_daily_room(
    room_name TEXT,
    privacy TEXT DEFAULT 'private',
    max_participants INTEGER DEFAULT 50
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- This would make an HTTP call to Daily.co API
    -- For now, return a mock response
    result := jsonb_build_object(
        'room_url', 'https://hotelcrm.daily.co/' || room_name,
        'room_id', gen_random_uuid()::text,
        'room_token', encode(gen_random_bytes(32), 'hex'),
        'created', true
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- INITIAL DATA
-- ===========================================

-- Insert sample meeting room template
INSERT INTO meeting_rooms (
    name,
    description,
    privacy,
    enable_chat,
    enable_screenshare,
    enable_recording,
    created_by,
    agency_id
) VALUES (
    'Sala de Reuniones Principal',
    'Sala principal para reuniones generales del hotel',
    'agency',
    true,
    true,
    false,
    '00000000-0000-0000-0000-000000000000', -- Will be updated with actual user
    '00000000-0000-0000-0000-000000000000'  -- Will be updated with actual agency
) ON CONFLICT DO NOTHING;

-- ===========================================
-- VIEWS FOR ANALYTICS
-- ===========================================

-- View for meeting analytics
CREATE VIEW meeting_analytics AS
SELECT
    mr.id,
    mr.name,
    mr.agency_id,
    mr.created_by,
    mr.scheduled_start,
    mr.scheduled_end,
    mr.actual_start,
    mr.actual_end,
    COUNT(DISTINCT mp.id) as total_participants,
    COUNT(DISTINCT CASE WHEN mp.status = 'joined' THEN mp.id END) as participants_joined,
    AVG(mp.duration_minutes) as avg_participation_minutes,
    COUNT(DISTINCT mrec.id) as recording_count,
    COUNT(DISTINCT mchat.id) as chat_messages_count
FROM meeting_rooms mr
LEFT JOIN meeting_participants mp ON mr.id = mp.meeting_id
LEFT JOIN meeting_recordings mrec ON mr.id = mrec.meeting_id
LEFT JOIN meeting_chat_messages mchat ON mr.id = mchat.meeting_id
GROUP BY mr.id, mr.name, mr.agency_id, mr.created_by, mr.scheduled_start, mr.scheduled_end, mr.actual_start, mr.actual_end;

-- View for daily meeting activity
CREATE VIEW daily_meeting_activity AS
SELECT
    DATE_TRUNC('day', mr.created_at) as day,
    COUNT(*) as meetings_created,
    COUNT(DISTINCT mr.agency_id) as active_agencies,
    SUM(CASE WHEN mr.actual_start IS NOT NULL THEN 1 ELSE 0 END) as meetings_started,
    AVG(EXTRACT(EPOCH FROM (mr.actual_end - mr.actual_start)) / 60) as avg_meeting_duration_minutes
FROM meeting_rooms mr
WHERE mr.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', mr.created_at)
ORDER BY day DESC;

-- View for participant engagement
CREATE VIEW participant_engagement AS
SELECT
    mp.user_id,
    mp.agency_id,
    COUNT(DISTINCT mp.meeting_id) as meetings_attended,
    SUM(mp.duration_minutes) as total_participation_minutes,
    AVG(mp.duration_minutes) as avg_meeting_duration,
    MAX(mp.joined_at) as last_participation
FROM meeting_participants mp
WHERE mp.status = 'joined'
GROUP BY mp.user_id, mp.agency_id;

-- ===========================================
-- MIGRATION COMPLETE
-- ===========================================

-- Add comments for documentation
COMMENT ON TABLE meeting_rooms IS 'Meeting rooms for video calls with Daily.co integration';
COMMENT ON TABLE meeting_participants IS 'Participants in video meetings with roles and permissions';
COMMENT ON TABLE meeting_recordings IS 'Recorded meetings with metadata and transcription';
COMMENT ON TABLE meeting_events IS 'Event log for meeting analytics and tracking';
COMMENT ON TABLE meeting_chat_messages IS 'Chat messages during video meetings';
COMMENT ON TABLE booking_meetings IS 'Links meetings to hotel bookings';
COMMENT ON TABLE daily_webhook_events IS 'Webhook events from Daily.co for processing';
COMMENT ON TABLE breakout_rooms IS 'Breakout rooms within larger meetings';
COMMENT ON TABLE breakout_participants IS 'Participants in breakout rooms';
