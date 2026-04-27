export type HandleScanUploadInput = {
  file?: Express.Multer.File;
  weight: number;
  deviceUid: string;
  scanId: string;
  requestReceivedAtMs: number;
};

export type ScanHttpResponse = {
  deviceUid: string;
  weight: number;
  imageUrl: string;
  status: 'RECEIVED';
};

export type ScanMqttPayload = {
  deviceUid: string;
  ingredientName: string | null;
  calories: number | null;
  weight: number;
  status: 'DONE' | 'FAILED';
  message: string;
};

export type PairDeviceInput = {
  userId: number;
  deviceUid: string;
  apiKey: string;
};

export type GetDeviceStatusInput = {
  userId: number;
  deviceUid: string;
};

export type DeviceListItem = {
  id: number;
  deviceUid: string;
  ownerId: number | null;
  createdAt?: Date;
};

export type PairDeviceResponse = {
  id: number;
  deviceUid: string;
  ownerId: number | null;
};

export type DeviceStatusResponse = {
  deviceUid: string;
  isOnline: boolean;
  batteryLevel: number | null;
  wifiSsid: string | null;
  signalStrength: number | null;
  lastSeenAt: string | null;
};

export type DeviceHeartbeatPayload = {
  deviceUid: string;
  batteryLevel: number | null;
  wifiSsid: string | null;
  signalStrength: number | null;
  timestamp: string;
};

export type CachedDeviceStatus = {
  deviceUid: string;
  batteryLevel: number | null;
  wifiSsid: string | null;
  signalStrength: number | null;
  lastSeenAt: string;
};

export type UnpairDeviceInput = {
  userId: number;
  deviceUid: string;
};

export type UnpairDeviceResponse = {
  id: number;
  deviceUid: string;
  ownerId: number | null;
};
