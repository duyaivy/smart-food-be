type RenderTemplateParams = {
  title: string;
  description: string;
  content: string;
  buttonText?: string;
  buttonUrl?: string;
  headExtras?: string;
  footerText?: string;
};

const baseTemplate = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{title}}</title>
  <meta name="description" content="{{description}}" />
  {{headExtras}}
</head>

<body style="margin:0;padding:0;background:#f6f9fc;font-family:Arial,sans-serif;">
  <div
    style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 8px 24px rgba(0,0,0,0.08);">
    <h2 style="margin-top:0;color:#111827;">{{title}}</h2>

    <div style="color:#374151;font-size:15px;line-height:1.7;">
      {{content}}
    </div>

    {{buttonSection}}

    <p style="margin-top:24px;color:#6b7280;font-size:13px;">
      {{footerText}}
    </p>
  </div>
</body>
</html>
`;

export const renderTemplate = ({
  title,
  description,
  content,
  buttonText = '',
  buttonUrl = '',
  headExtras = '',
  footerText = 'Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.'
}: RenderTemplateParams): string => {
  const buttonSection =
    buttonText && buttonUrl
      ? `
    <div style="margin-top:24px;">
      <a href="${buttonUrl}"
        style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;">
        ${buttonText}
      </a>
    </div>
  `
      : '';

  return baseTemplate
    .replace(/{{title}}/g, title)
    .replace(/{{description}}/g, description)
    .replace(/{{content}}/g, content)
    .replace(/{{buttonSection}}/g, buttonSection)
    .replace(/{{headExtras}}/g, headExtras)
    .replace(/{{footerText}}/g, footerText);
};

export default renderTemplate;
