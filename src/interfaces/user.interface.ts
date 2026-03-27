import { Role } from '@prisma/client';

export interface IUser {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  password?: string;
  role: Role;
  sex: boolean | null;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  height: number | null;
  weight: number | null;
  birthday: Date | null;
}
