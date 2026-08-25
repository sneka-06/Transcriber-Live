export type ConnectionStatus = 'connected' | 'disconnected';

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Message {
  id: number;
  sessionId: number;
  speaker: string; // "You" | "Others"
  text: string;
  createdAt: string;
}
