import { User, Role, Prisma, ActivityLevel } from '@prisma/client';
import httpStatus from 'http-status';
import prisma from '../client';
import { encryptPassword } from '../utils/encryption';
import { IUser } from '../models/interfaces/user.interface';
import ApiError from '../utils/apiError';
import redis from '../redis';

type CreateUserInput = {
  email: string;
  password: string;
  name: string;
  role?: Role;
  avatar?: string | null;
  height?: number | null;
  weight?: number | null;
  sex?: boolean | null;
  birthday?: Date | string | null;
  activityLevel?: ActivityLevel | null;
};

/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
const createUser = async (userBody: CreateUserInput): Promise<User> => {
  if (await getUserByEmail(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email đã được sử dụng');
  }
  return prisma.user.create({
    data: {
      email: userBody.email,
      name: userBody.name,
      password: await encryptPassword(userBody.password),
      role: userBody.role ?? Role.USER,
      activityLevel: userBody.activityLevel ?? ActivityLevel.SEDENTARY,
      avatar: userBody.avatar ?? null,
      height: userBody.height ?? null,
      weight: userBody.weight ?? null,
      ...(userBody.sex === null || userBody.sex === undefined ? {} : { sex: userBody.sex }),
      ...(userBody.birthday ? { birthday: new Date(userBody.birthday) } : {})
    }
  });
};

/**
 * Query for users
 * @param {Object} filter - Prisma filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryUsers = async <Key extends keyof User>(
  filter: object,
  options: {
    limit?: number;
    page?: number;
    sortBy?: string;
    sortType?: 'asc' | 'desc';
  },
  keys: Key[] = [
    'id',
    'email',
    'name',
    'avatar',
    'password',
    'role',
    'isEmailVerified',
    'createdAt',
    'updatedAt',
    'height',
    'weight',
    'sex',
    'birthday',
    'activityLevel'
  ] as Key[]
): Promise<Pick<User, Key>[]> => {
  const page = options.page ?? 1;
  const limit = options.limit ?? 10;
  const sortBy = options.sortBy;
  const sortType = options.sortType ?? 'desc';
  const users = await prisma.user.findMany({
    where: filter,
    select: keys.reduce((obj, k) => ({ ...obj, [k]: true }), {}),
    skip: (page - 1) * limit,
    take: limit,
    orderBy: sortBy ? { [sortBy]: sortType } : undefined
  });
  return users as Pick<User, Key>[];
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @param {Array<Key>} keys
 * @returns {Promise<Pick<User, Key> | null>}
 */
const getUserById = async <Key extends keyof User>(
  id: number,
  keys: Key[] = [
    'id',
    'email',
    'name',
    'avatar',
    'password',
    'role',
    'isEmailVerified',
    'createdAt',
    'updatedAt',
    'height',
    'weight',
    'sex',
    'birthday',
    'activityLevel'
  ] as Key[]
): Promise<Pick<User, Key> | null> => {
  return prisma.user.findUnique({
    where: { id },
    select: keys.reduce((obj, k) => ({ ...obj, [k]: true }), {})
  }) as Promise<Pick<User, Key> | null>;
};

/**
 * Get user by email
 * @param {string} email
 * @param {Array<Key>} keys
 * @returns {Promise<Pick<User, Key> | null>}
 */
const getUserByEmail = async <Key extends keyof User>(
  email: string,
  keys: Key[] = [
    'id',
    'email',
    'name',
    'avatar',
    'password',
    'role',
    'isEmailVerified',
    'createdAt',
    'updatedAt',
    'height',
    'weight',
    'sex',
    'birthday',
    'activityLevel'
  ] as Key[]
): Promise<Pick<User, Key> | null> => {
  return prisma.user.findUnique({
    where: { email },
    select: keys.reduce((obj, k) => ({ ...obj, [k]: true }), {})
  }) as Promise<Pick<User, Key> | null>;
};

/**
 * Update user by id
 * @param {ObjectId} userId
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */
const updateUserById = async <Key extends keyof User>(
  userId: number,
  updateBody: Prisma.UserUpdateInput,
  keys: Key[] = ['id', 'email', 'name', 'role'] as Key[]
): Promise<Pick<User, Key> | null> => {
  const user = await getUserById(userId, ['id', 'email', 'name']);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy người dùng');
  }

  if (updateBody.email && (await getUserByEmail(updateBody.email as string))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email đã được sử dụng');
  }

  if (updateBody.password && typeof updateBody.password === 'string') {
    updateBody.password = await encryptPassword(updateBody.password);
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: updateBody,
    select: keys.reduce((obj, k) => ({ ...obj, [k]: true }), {})
  });

  return updatedUser as Pick<User, Key> | null;
};

/**
 * Delete user by id
 * @param {ObjectId} userId
 * @returns {Promise<User>}
 */
const deleteUserById = async (userId: number): Promise<User> => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Không tìm thấy người dùng');
  }
  await prisma.user.delete({ where: { id: user.id } });
  return user;
};

const getMe = async (userId: number): Promise<IUser> => {
  const user = (await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      role: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true,
      height: true,
      weight: true,
      sex: true,
      birthday: true,
      activityLevel: true
    }
  })) as IUser | null;

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy người dùng');
  }

  return user;
};
const updateMe = async (userId: number, updateBody: Prisma.UserUpdateInput): Promise<IUser> => {
  const user = await getUserById(userId, ['id', 'email', 'name']);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy người dùng');
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: updateBody.name,
      avatar: updateBody.avatar,
      height: updateBody.height,
      weight: updateBody.weight,
      sex: updateBody.sex,
      birthday: updateBody.birthday,
      activityLevel: updateBody.activityLevel,
      password: updateBody.password
        ? await encryptPassword(updateBody.password as string)
        : undefined
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...userWithoutPassword } = updatedUser;
  return userWithoutPassword;
};
const createPushToken = async (
  userId: number,
  token: string,
  deviceName: string
): Promise<void> => {
  await prisma.pushToken.create({
    data: {
      userId,
      token,
      deviceName
    }
  });
};

const clearGlobalCache = async (): Promise<void> => {
  if (redis) {
    await redis.flushall().catch(() => null);
    console.log(`[UserService] Cleared entire system cache (FLUSHALL).`);
  }
};

export default {
  createUser,
  queryUsers,
  getUserById,
  getUserByEmail,
  updateUserById,
  deleteUserById,
  getMe,
  updateMe,
  createPushToken,
  clearGlobalCache
};
