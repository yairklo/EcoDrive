import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { v4 as uuidv4 } from 'uuid';
import { api } from './api';

const OUTBOX_KEY = '@ecodrive_outbox';

export type OutboxItemType = 'TRIP_SYNC' | 'REFUEL_LOG';

export interface OutboxItem {
  clientUuid: string;
  type: OutboxItemType;
  payload: any;
  synced: boolean;
  createdAt: number;
}

export class OutboxQueue {
  private isFlushing = false;

  constructor() {
    // Listen for network changes to automatically flush
    NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        this.flushQueue();
      }
    });
  }

  public async getQueue(): Promise<OutboxItem[]> {
    try {
      const data = await AsyncStorage.getItem(OUTBOX_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to get outbox queue', e);
      return [];
    }
  }

  private async saveQueue(queue: OutboxItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to save outbox queue', e);
    }
  }

  public async enqueue(type: OutboxItemType, payload: any): Promise<OutboxItem> {
    const queue = await this.getQueue();
    const clientUuid = uuidv4();
    
    const item: OutboxItem = {
      clientUuid,
      type,
      payload: { ...payload, clientUuid },
      synced: false,
      createdAt: Date.now(),
    };

    queue.push(item);
    await this.saveQueue(queue);

    // Attempt immediate sync if online
    const netState = await NetInfo.fetch();
    if (netState.isConnected && netState.isInternetReachable) {
      this.flushQueue(); // background flush
    }

    return item;
  }

  public async flushQueue(): Promise<void> {
    if (this.isFlushing) return;
    this.isFlushing = true;

    try {
      const queue = await this.getQueue();
      const pendingItems = queue.filter(item => !item.synced);

      if (pendingItems.length === 0) {
        this.isFlushing = false;
        return;
      }

      let modified = false;

      for (const item of pendingItems) {
        try {
          if (item.type === 'TRIP_SYNC') {
            await api.post('/api/trips/sync', item.payload);
          } else if (item.type === 'REFUEL_LOG') {
            await api.post('/api/refuel', item.payload);
          }
          item.synced = true;
          modified = true;
        } catch (error: any) {
          console.error(`Outbox sync failed for ${item.type}:`, error);
          // If it's a 4xx error (validation/auth), we might want to drop it to avoid infinite loop.
          // For now, we will just leave it as false to retry later if it's 5xx/network.
        }
      }

      if (modified) {
        // Remove synced items from queue to save space, or just mark them synced.
        // We will remove synced items.
        const newQueue = queue.filter(item => !item.synced);
        await this.saveQueue(newQueue);
      }
    } finally {
      this.isFlushing = false;
    }
  }
}

export const outbox = new OutboxQueue();
