export interface MeetingRoom {
  id: string;
  name: string;
  description?: string;
  roomUrl?: string;
  roomToken?: string;
  dailyRoomId?: string;
  isActive: boolean;
  maxParticipants: number;
  privacy: 'public' | 'private' | 'agency';

  // Settings
  enableChat: boolean;
  enableScreenshare: boolean;
  enableRecording: boolean;
  enableTranscription: boolean;
  enableBreakoutRooms: boolean;

  // Scheduling
  scheduledStart?: Date;
  scheduledEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;

  // Metadata
  createdBy: string;
  agencyId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MeetingParticipant {
  id: string;
  meetingId: string;
  userId: string;
  agencyId: string;

  // Participant info
  displayName: string;
  role: 'host' | 'co_host' | 'presenter' | 'attendee';
  permissions: {
    canChat: boolean;
    canScreenshare: boolean;
    canRecord: boolean;
    canMuteOthers: boolean;
    canRemoveOthers: boolean;
  };

  // Participation tracking
  joinedAt?: Date;
  leftAt?: Date;
  durationMinutes?: number;

  // Status
  status: 'invited' | 'joined' | 'declined' | 'left';
  invitedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface MeetingRecording {
  id: string;
  meetingId: string;
  recordingId: string;
  recordingUrl?: string;
  durationSeconds?: number;
  fileSizeBytes?: number;
  format: string;

  // Metadata
  startedAt?: Date;
  endedAt?: Date;
  processed: boolean;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';

  // Transcription
  transcriptionUrl?: string;
  transcriptionStatus: 'pending' | 'processing' | 'completed' | 'failed';

  createdAt: Date;
  updatedAt: Date;
}

export interface MeetingEvent {
  id: string;
  meetingId: string;
  participantId?: string;
  eventType: string;
  eventData: Record<string, any>;
  timestamp: Date;
}

export interface MeetingChatMessage {
  id: string;
  meetingId: string;
  participantId: string;
  message: string;
  messageType: 'text' | 'emoji' | 'system';
  timestamp: Date;
  parentMessageId?: string;
}

export interface BookingMeeting {
  id: string;
  bookingId: string;
  meetingId: string;
  meetingType: 'checkin' | 'checkout' | 'maintenance' | 'consultation' | 'other';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyWebhookEvent {
  id: string;
  eventType: string;
  roomName?: string;
  roomUrl?: string;
  participantId?: string;
  participantName?: string;
  eventData: Record<string, any>;
  processed: boolean;
  processedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
}

export interface BreakoutRoom {
  id: string;
  parentMeetingId: string;
  roomName: string;
  roomUrl?: string;
  roomToken?: string;
  maxParticipants: number;

  // Timing
  createdAt: Date;
  closedAt?: Date;
  durationMinutes?: number;

  // Status
  isActive: boolean;
}

export interface BreakoutParticipant {
  id: string;
  breakoutRoomId: string;
  participantId: string;
  joinedAt: Date;
  leftAt?: Date;
}

// Request/Response types
export interface CreateMeetingRequest {
  name: string;
  description?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  maxParticipants?: number;
  privacy?: 'public' | 'private' | 'agency';
  enableChat?: boolean;
  enableScreenshare?: boolean;
  enableRecording?: boolean;
  enableTranscription?: boolean;
  enableBreakoutRooms?: boolean;
  participants?: string[]; // User IDs
}

export interface UpdateMeetingRequest {
  name?: string;
  description?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  maxParticipants?: number;
  privacy?: 'public' | 'private' | 'agency';
  enableChat?: boolean;
  enableScreenshare?: boolean;
  enableRecording?: boolean;
  enableTranscription?: boolean;
  enableBreakoutRooms?: boolean;
}

export interface JoinMeetingRequest {
  meetingId: string;
  displayName?: string;
}

export interface MeetingAnalytics {
  id: string;
  name: string;
  agencyId: string;
  createdBy: string;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  totalParticipants: number;
  participantsJoined: number;
  avgParticipationMinutes?: number;
  recordingCount: number;
  chatMessagesCount: number;
}

export interface DailyMeetingActivity {
  day: Date;
  meetingsCreated: number;
  activeAgencies: number;
  meetingsStarted: number;
  avgMeetingDurationMinutes?: number;
}

export interface ParticipantEngagement {
  userId: string;
  agencyId: string;
  meetingsAttended: number;
  totalParticipationMinutes: number;
  avgMeetingDuration?: number;
  lastParticipation?: Date;
}

// Daily.co specific types
export interface DailyRoomConfig {
  name: string;
  privacy: 'public' | 'private';
  properties: {
    max_participants?: number;
    enable_chat?: boolean;
    enable_screenshare?: boolean;
    enable_recording?: boolean;
    start_video_off?: boolean;
    start_audio_off?: boolean;
    owner_only_broadcast?: boolean;
    enable_knocking?: boolean;
    enable_breakout_rooms?: boolean;
  };
}

export interface DailyRoomResponse {
  name: string;
  url: string;
  id: string;
  privacy: string;
  config: DailyRoomConfig;
  created_at: string;
  updated_at: string;
}

export interface DailyParticipant {
  session_id: string;
  user_id?: string;
  user_name?: string;
  joined_at: string;
  left_at?: string;
  recordings?: any[];
  tracks: {
    [trackId: string]: {
      kind: 'audio' | 'video' | 'screenVideo';
      state: 'off' | 'sendable' | 'loading' | 'playable' | 'interrupted';
      subscribed?: boolean;
    };
  };
}

export interface DailyRecording {
  id: string;
  room_name: string;
  status: 'finished' | 'processing' | 'failed';
  started_at: string;
  ended_at?: string;
  duration?: number;
  max_participants?: number;
  size?: number;
  url?: string;
  download_url?: string;
}

// Real-time event types for Daily.co
export interface DailyEvent {
  action:
    | 'participant-joined'
    | 'participant-updated'
    | 'participant-left'
    | 'track-started'
    | 'track-stopped'
    | 'recording-started'
    | 'recording-stopped'
    | 'room-joined'
    | 'room-updated'
    | 'room-left'
    | 'error'
    | 'network-quality-changed'
    | 'active-speaker-change'
    | 'app-message';
  participant?: DailyParticipant;
  participants?: DailyParticipant[];
  track?: any;
  recording?: DailyRecording;
  room?: DailyRoomResponse;
  error?: any;
  network?: any;
  activeSpeaker?: string;
  message?: any;
}

// Meeting state management
export interface MeetingState {
  room: MeetingRoom;
  participants: MeetingParticipant[];
  localParticipant?: MeetingParticipant;
  recordings: MeetingRecording[];
  chatMessages: MeetingChatMessage[];
  breakoutRooms: BreakoutRoom[];
  isRecording: boolean;
  isTranscribing: boolean;
  meetingEnded: boolean;
}

// Video call UI components
export interface VideoControls {
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenShareEnabled: boolean;
  recordingEnabled: boolean;
  chatEnabled: boolean;
  breakoutRoomsEnabled: boolean;
}

export interface ParticipantTile {
  participant: MeetingParticipant;
  isLocal: boolean;
  isSpeaking: boolean;
  videoTrack?: any;
  audioTrack?: any;
  screenTrack?: any;
}
