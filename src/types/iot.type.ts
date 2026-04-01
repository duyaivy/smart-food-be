export type HandleScanUploadInput = {
  file?: Express.Multer.File;
  weight: number;
  deviceUid: string;
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
  imageUrl: string;
};
