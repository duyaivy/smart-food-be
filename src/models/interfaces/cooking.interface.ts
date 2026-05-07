import { CookingStatus } from '@prisma/client';

export enum CookingSortBy {
  CREATED_AT = 'CREATED_AT',
  UPDATED_AT = 'UPDATED_AT',
  STARTED_AT = 'STARTED_AT',
  ENDED_AT = 'ENDED_AT',
  DURATION_MINUTES = 'DURATION_MINUTES'
}

export type CreateCookingInput = {
  dishId: number;
};

export type GetCookingsFilter = {
  status?: CookingStatus[];
};

export type GetCookingsOptions = {
  sortBy?: CookingSortBy;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  page?: number;
};

export type CookingListResult<T> = {
  control: {
    total: number;
    page: number;
    limit: number;
  };
  results: T[];
};
