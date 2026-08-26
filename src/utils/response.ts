export const successResponse = ({
  code = 200,
  message = 'Thành công',
  data = null
}: {
  code?: number;
  message?: string;
  data?: unknown;
}) => ({
  code,
  message,
  data
});

export const errorResponse = ({
  code = 500,
  message = 'Có lỗi xảy ra',
  data = null
}: {
  code?: number;
  message?: string;
  data?: unknown;
}) => ({
  code,
  message,
  data
});
