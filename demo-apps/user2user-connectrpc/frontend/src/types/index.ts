// Используем те же типы, что и в user2user
export interface Message {
  message_id: string;
  dialog_id: string;
  sender_id: string;
  type: string;
  content: string;
  meta?: any;
  statuses?: MessageStatus[];
  reaction_set?: any;
  sender_info?: SenderInfo;
  created_at: number;
  topic_id?: string;
  topic?: any;
}

export interface MessageStatus {
  user_id: string;
  status: string;
  read_at: number;
  created_at: number;
}

export interface SenderInfo {
  user_id: string;
  name: string;
  created_at: number;
  meta?: any;
}

export interface Dialog {
  dialog_id: string;
  tenant_id: string;
  name: string;
  created_by: string;
  created_at: number;
  updated_at: number;
  meta?: any;
  member?: DialogMember;
  last_message?: Message;
}

export interface DialogMember {
  user_id: string;
  meta?: any;
  state?: MemberState;
}

export interface MemberState {
  unread_count: number;
  last_seen_at: number;
  last_message_at: number;
  is_active: boolean;
}

export interface Update {
  update_id: string;
  tenant_id: string;
  user_id: string;
  entity_id: string;
  event_type: string;
  data: any;
  created_at: number;
}

export interface User {
  userId: string;
  name: string;
}

export const DEMO_USERS: User[] = [
  { userId: 'user_1', name: 'User 1' },
  { userId: 'user_2', name: 'User 2' },
];
