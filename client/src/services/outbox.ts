import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api } from './api';

const OUTBOX_KEY = '@ecodrive_outbox';

export type OutboxItemType = 'TRIP_SYNC' | 'REFUEL_LOG' | 'VEHICLE_SETUP' | 'AUTH_SYNC';

export interface OutboxItem {
  clientUuid: string;
  type: OutboxItemType;
  payload: any;
  synced: boolean;
  createdAt: number;
}

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export class OutboxQueue {
  private isFlushing = false;

  constructor() {
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
    const clientUuid = payload.vehicleId || generateUUID();
    
    const item: OutboxItem = {
      clientUuid,
      type,
      payload: { ...payload, clientUuid },
      synced: false,
      createdAt: Date.now(),
    };

    queue.push(item);
    await this.saveQueue(queue);

    const netState = await NetInfo.fetch();
    if (netState.isConnected && netState.isInternetReachable) {
      this.flushQueue();
    }

    return item;
  }

  public async flushQueue(): Promise<void> {
    if (this.isFlushing) return;
    this.isFlushing = true;

    try {
      const queue = await this.getQueue();
      let pendingItems = queue.filter(item => !item.synced);

      if (pendingItems.length === 0) {
        this.isFlushing = false;
        return;
      }

      // Prioritize VEHICLE_SETUP first so subsequent items link correctly
      pendingItems.sort((a, b) => {
        if (a.type === 'VEHICLE_SETUP' && b.type !== 'VEHICLE_SETUP') return -1;
        if (b.type === 'VEHICLE_SETUP' && a.type !== 'VEHICLE_SETUP') return 1;
        return a.createdAt - b.createdAt;
      });

      let modified = false;

      for (const item of pendingItems) {
        try {
          if (item.type === 'VEHICLE_SETUP') {
            await api.post('/api/vehicles', item.payload);
          } else if (item.type === 'TRIP_SYNC') {
            await api.post('/api/trips/sync', item.payload);
          } else if (item.type === 'REFUEL_LOG') {
            await api.post('/api/refuel', item.payload);
          }
          item.synced = true;
          modified = true;
        } catch (error: any) {
          console.error(`Outbox sync failed for ${item.type}:`, error);
          if (error.response?.status === 401) {
            // Unauthenticated (Guest Mode). We must halt the flush until the user logs in.
            break;
          }
        }
      }

      if (modified) {
        const newQueue = queue.filter(item => !item.synced);
        await this.saveQueue(newQueue);
      }
    } finally {
      this.isFlushing = false;
    }
  }
}

export const outbox = new OutboxQueue();
