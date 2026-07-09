import config from '../config/config';
import { renderTemplate } from './template';

export const renderVerifyEmailSuccessPage = (): string => {
  const appUrl = config.clientUrl || '';

  return renderTemplate({
    title: 'Xác thực email thành công',
    description: 'Tài khoản của bạn đã được xác thực thành công.',
    content:
      '<p>Tài khoản của bạn đã được xác thực. Bạn có thể quay lại ứng dụng để tiếp tục sử dụng.</p>',
    buttonText: appUrl ? 'Mở ứng dụng' : '',
    buttonUrl: appUrl,
    headExtras: appUrl
      ? `<link rel="canonical" href="${appUrl}" />
         <meta property="og:url" content="${appUrl}" />`
      : ''
  });
};

export default {
  renderVerifyEmailSuccessPage
};
